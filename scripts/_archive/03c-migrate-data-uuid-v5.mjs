#!/usr/bin/env node
// ============================================================
// PASSO 3c: Migrate data with DETERMINISTIC UUID v5 mapping
// ============================================================
// Every Base44 ObjectId (24-hex char string) is replaced with a deterministic
// UUID v5 hash. Same ObjectId always produces same UUID, so FK relationships
// are preserved automatically without per-table mapping tables.
//
// Pre-step: truncates all migrated tables (except auth.users / users / empresa).
//   We keep empresa because we want SGA/ATO with the pre-assigned UUIDs.
//
// Schema unknown-column issue from 03b is also handled here (filter via OpenAPI).
// ============================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ENTITY_TABLE_MAP,
  SKIP_ENTITIES,
  EMPRESA_ID_MAP,
  DEFAULT_EMPRESA_ID,
  TABLE_NAME_OVERRIDES,
} from './config.mjs';

function realTable(name) {
  return TABLE_NAME_OVERRIDES[name] || name;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const BATCH_SIZE = 100;
const POSTGREST_URL = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';

// Stable namespace UUID for our deterministic v5 hashing
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace (well-known)

const FIELDS_TO_REMOVE = ['__v', '_id', 'app_id', 'entity_type', 'row_id', 'is_sample',
                          'createdAt', 'updatedAt', 'created_at', 'updated_at',
                          'created_by_id', 'user_id'];

const INSERT_ORDER = [
  'aeroporto', 'companhia_aerea', 'modelo_aeronave', 'empresa',
  'configuracao_sistema', 'configuracao_area', 'configuracao_notificacoes', 'configuracao_opt_in_zapi',
  'tipo_auditoria', 'tipo_documento', 'tipo_inspecao', 'tipo_kpi', 'campo_kpi',
  'area_acesso', 'regra_notificacao', 'regra_permissao',
  'pasta', 'placeholder', 'grupo_whats_app',
  'credenciamento', 'reclamacao', 'historico_reclamacao',
  'solicitacao_acesso',
  'registo_aeronave', 'registo_grf',
  'voo', 'voo_ligado',
  'proforma', 'calculo_tarifa',
  'tarifa_pouso', 'tarifa_permanencia', 'outra_tarifa',
  'imposto', 'movimento_financeiro', 'documento',
  'ordem_servico', 'ocorrencia_safety',
  'inspecao', 'resposta_inspecao',
  'processo_auditoria', 'item_auditoria', 'resposta_auditoria',
  'item_checklist', 'plano_acao_corretiva', 'item_pac',
  'medicao_kpi', 'valor_campo_kpi',
  'historico_notificacao',
];

// Tables to TRUNCATE before reinsert (preserve empresa/users/their tariffs)
const TRUNCATE_TABLES = INSERT_ORDER.filter(t =>
  !['empresa', 'users', 'tarifa_pouso', 'tarifa_permanencia', 'outra_tarifa'].includes(t)
);

const BASE44_ID_RE = /^[0-9a-f]{24}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBase44Id(s) { return typeof s === 'string' && BASE44_ID_RE.test(s); }
function isUUID(s) { return typeof s === 'string' && UUID_RE.test(s); }

// Deterministic UUID v5 from any string + DNS namespace
function uuidV5(name) {
  // namespace bytes
  const nsBytes = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = crypto.createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest();
  // Take first 16 bytes; set version=5 and variant
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

// Translate value: if Base44 ObjectId, return UUID v5; else return as-is.
// Special-case empresa IDs via existing EMPRESA_ID_MAP to keep our SGA/ATO mappings.
function translateValue(v, fieldName) {
  if (typeof v !== 'string') return v;
  // Empty string in an *_id column would fail Postgres uuid cast — coerce to null.
  if (v === '' && fieldName && fieldName.endsWith('_id')) return null;
  if (UUID_RE.test(v)) return v;
  // Special empresa lookup first
  if ((fieldName === 'empresa_id' || fieldName === 'empresa_solicitante_id') && BASE44_ID_RE.test(v)) {
    return EMPRESA_ID_MAP[v] || uuidV5(v);
  }
  if (BASE44_ID_RE.test(v)) return uuidV5(v);
  return v;
}

// SGA canonical empresa_id — used to backfill records missing tenant scope.
// Base44 doesn't have multi-tenant; on-premise has RLS that filters by empresa_id.
const SGA_EMPRESA_ID = '128bc692-3fae-4825-9c55-40565dbedcfb';

// Tables that have an empresa_id column and should default to SGA when absent.
const EMPRESA_BACKFILL_TABLES = new Set([
  'voo','voo_ligado','calculo_tarifa','medicao_kpi','medicao_k_p_i',
  'documento','registo_aeronave','credenciamento','ocorrencia_safety',
  'inspecao','processo_auditoria','reclamacao','ordem_servico',
  'solicitacao_servico','proforma','imposto','users',
]);

function cleanAndTranslate(record, tableName) {
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (FIELDS_TO_REMOVE.includes(k)) continue;
    if (v === null || v === undefined) { out[k] = v; continue; }
    if (Array.isArray(v)) {
      out[k] = v.map(item => translateValue(item, k));
    } else {
      out[k] = translateValue(v, k);
    }
  }
  // Ensure id is UUID (translateValue handles non-UUID Base44 strings)
  if (out.id && !UUID_RE.test(out.id)) delete out.id;
  if (!out.created_date) out.created_date = new Date().toISOString();
  // Default empresa_id to SGA for operational tables that came from Base44 without it.
  if (tableName && EMPRESA_BACKFILL_TABLES.has(tableName) && !out.empresa_id) {
    out.empresa_id = SGA_EMPRESA_ID;
  }
  return out;
}

let openApiCache = null;
async function getColumns(tableName) {
  if (!openApiCache) {
    const r = await fetch(POSTGREST_URL + '/', {
      headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY, 'apikey': SUPABASE_SERVICE_ROLE_KEY },
    });
    openApiCache = await r.json();
  }
  const def = openApiCache.definitions?.[tableName];
  if (!def || !def.properties) return null;
  return new Set(Object.keys(def.properties));
}

function filterByColumns(record, cols) {
  const filtered = {};
  for (const k of Object.keys(record)) {
    if (cols.has(k)) filtered[k] = record[k];
  }
  return filtered;
}

async function insertBatch(tableName, batch) {
  const r = await fetch(POSTGREST_URL + '/' + tableName, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(batch),
  });
  return r;
}

async function migrateTable(tableName, records) {
  const cols = await getColumns(tableName);
  if (!cols) return { table: tableName, total: records.length, inserted: 0, errors: records.length, msg: 'no schema' };

  let inserted = 0;
  let errors = 0;
  const errSamples = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const slice = records.slice(i, i + BATCH_SIZE);
    const batch = slice.map(r => filterByColumns(cleanAndTranslate(r, tableName), cols));

    const resp = await insertBatch(tableName, batch);
    if (!resp.ok) {
      const text = await resp.text();
      // Retry one-by-one
      for (const single of batch) {
        const r2 = await insertBatch(tableName, [single]);
        if (r2.ok) inserted++;
        else {
          errors++;
          if (errSamples.length < 2) errSamples.push((await r2.text()).slice(0, 180));
        }
      }
    } else {
      inserted += batch.length;
    }
    const pct = Math.round(((i + batch.length) / records.length) * 100);
    process.stdout.write(`\r  ${tableName}: ${pct}% (${inserted}/${records.length})  `);
  }
  process.stdout.write('\n');
  return { table: tableName, total: records.length, inserted, errors, errSamples };
}

async function truncateTables() {
  // Use a SQL function call via PostgREST? Easier: write SQL file and run psql separately.
  // For now, this script will skip data already inserted and rely on ON CONFLICT.
  // To do clean reset, run truncate manually: see notes in user message.
  console.log('Skipping truncate — relying on ON CONFLICT (resolution=ignore-duplicates).');
  console.log('To start fresh: psql -c "TRUNCATE TABLE voo, voo_ligado, ... CASCADE"');
}

async function main() {
  console.log('=== MIGRATE DATA v5 (deterministic UUID) ===\n');

  // KILL SWITCH (2026-07-03): migracao Cloud->on-premise concluida; sistema em
  // producao. Este import faz INSERT (ignore-duplicates) de TODAS as entidades do
  // Base44 (voo, calculo_tarifa, etc.), RESSUSCITANDO qualquer registo apagado no
  // on-premise que ainda exista no cloud. Desativado. Para re-migracao DELIBERADA,
  // rode com --force ou MIGRATION_ENABLED=1.
  const forcado = process.argv.includes('--force') || process.env.MIGRATION_ENABLED === '1';
  if (!forcado) {
    console.log('SYNC DESATIVADA: re-migracao de dados do Base44 esta desligada (sistema em producao).');
    console.log('Nada foi alterado. Para forcar: node scripts/03c-migrate-data-uuid-v5.mjs --force');
    return;
  }
  console.log('AVISO: execucao FORCADA — vai reinserir dados do Base44 no sistema atual.\n');

  await truncateTables();

  const results = [];
  const skip = new Set(SKIP_ENTITIES.map(e => ENTITY_TABLE_MAP[e]).filter(Boolean));
  skip.add('users');

  const seen = new Set(INSERT_ORDER);
  for (const [, table] of Object.entries(ENTITY_TABLE_MAP)) {
    if (!seen.has(table) && !skip.has(table)) INSERT_ORDER.push(table);
  }

  for (const fileName of INSERT_ORDER) {
    if (skip.has(fileName)) continue;
    const dbTable = realTable(fileName);
    const file = path.join(DATA_DIR, fileName + '.json');
    if (!fs.existsSync(file)) continue;
    const records = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(records) || records.length === 0) continue;
    try {
      const r = await migrateTable(dbTable, records);
      results.push(r);
    } catch (e) {
      console.error(`${dbTable}: FATAL ${e.message}`);
      results.push({ table: dbTable, total: records.length, inserted: 0, errors: records.length, fatal: e.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    const status = r.inserted === r.total ? 'OK  ' : (r.inserted === 0 ? 'FAIL' : 'PART');
    console.log(`  [${status}] ${r.table.padEnd(30)} ${r.inserted}/${r.total}   ${(r.errSamples?.[0] || '').slice(0,120)}`);
  }

  fs.writeFileSync(path.join(DATA_DIR, '_data_migration_result_v3.json'), JSON.stringify(results, null, 2));
  console.log('\nDone. Detail: scripts/data/_data_migration_result_v3.json');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
