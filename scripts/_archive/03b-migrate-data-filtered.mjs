#!/usr/bin/env node
// ============================================================
// PASSO 3b: Migra dados como o 03, mas FILTRA colunas desconhecidas
// ============================================================
// Diferenca do 03 original:
//   - Antes de inserir cada tabela, descobre as colunas reais via PostgREST OpenAPI
//   - Filtra cada record para conter apenas colunas existentes
//   - Continua os mesmos campos de cleanRecord (_id, __v, etc.)
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ENTITY_TABLE_MAP,
  SKIP_ENTITIES,
  EMPRESA_ID_MAP,
  DEFAULT_EMPRESA_ID,
} from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const BATCH_SIZE = 100;

const POSTGREST_URL = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';

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

function isUUID(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function baseCleanRecord(r) {
  const c = { ...r };
  for (const f of FIELDS_TO_REMOVE) delete c[f];
  // Non-UUID id → drop entirely (Postgres will assign UUID via default)
  if (c.id && !isUUID(c.id)) {
    delete c.id;
  }
  if (c.empresa_id && !isUUID(c.empresa_id)) {
    c.empresa_id = EMPRESA_ID_MAP[c.empresa_id] || DEFAULT_EMPRESA_ID;
  }
  if (c.empresa_solicitante_id && !isUUID(c.empresa_solicitante_id)) {
    c.empresa_solicitante_id = EMPRESA_ID_MAP[c.empresa_solicitante_id] || DEFAULT_EMPRESA_ID;
  }
  if (!c.created_date) c.created_date = new Date().toISOString();
  return c;
}

// Fetch column list for a table via PostgREST OpenAPI doc
let openApiCache = null;
async function getColumns(tableName) {
  if (!openApiCache) {
    const r = await fetch(POSTGREST_URL + '/', {
      headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY, 'apikey': SUPABASE_SERVICE_ROLE_KEY },
    });
    openApiCache = await r.json();
  }
  // OpenAPI: definitions[tableName].properties.{column}
  const def = openApiCache.definitions?.[tableName];
  if (!def || !def.properties) return null;
  return new Set(Object.keys(def.properties));
}

function filterRecord(record, allowedCols) {
  const filtered = {};
  for (const k of Object.keys(record)) {
    if (allowedCols.has(k)) filtered[k] = record[k];
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
  if (!cols) return { table: tableName, total: records.length, inserted: 0, errors: records.length, skipped: 'no schema' };

  let inserted = 0;
  let errors = 0;
  let firstError = '';

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const slice = records.slice(i, i + BATCH_SIZE);
    const batch = slice.map(r => filterRecord(baseCleanRecord(r), cols));

    const resp = await insertBatch(tableName, batch);
    if (!resp.ok) {
      const text = await resp.text();
      if (!firstError) firstError = text.slice(0, 200);
      // Retry individually to count valid records
      for (const single of batch) {
        const r2 = await insertBatch(tableName, [single]);
        if (r2.ok) inserted++; else errors++;
      }
    } else {
      inserted += batch.length;
    }
    const pct = Math.round(((i + batch.length) / records.length) * 100);
    process.stdout.write(`\r  ${tableName}: ${pct}% (${inserted}/${records.length})  `);
  }
  process.stdout.write('\n');
  return { table: tableName, total: records.length, inserted, errors, firstError };
}

async function main() {
  console.log('=== MIGRATE DATA (filtered version) ===\n');
  const results = [];

  const skip = new Set(SKIP_ENTITIES.map(e => ENTITY_TABLE_MAP[e]).filter(Boolean));
  skip.add('users');

  const seen = new Set(INSERT_ORDER);
  for (const [, table] of Object.entries(ENTITY_TABLE_MAP)) {
    if (!seen.has(table) && !skip.has(table)) INSERT_ORDER.push(table);
  }

  for (const tableName of INSERT_ORDER) {
    if (skip.has(tableName)) continue;
    const file = path.join(DATA_DIR, tableName + '.json');
    if (!fs.existsSync(file)) continue;
    const records = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(records) || records.length === 0) continue;
    try {
      const r = await migrateTable(tableName, records);
      results.push(r);
    } catch (e) {
      console.error(`${tableName}: FATAL ${e.message}`);
      results.push({ table: tableName, total: records.length, inserted: 0, errors: records.length, fatal: e.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    const status = r.inserted === r.total ? 'OK' : (r.inserted === 0 ? 'FAIL' : 'PART');
    console.log(`  [${status}] ${r.table.padEnd(30)} ${r.inserted}/${r.total}   ${r.firstError || ''}`);
  }

  fs.writeFileSync(path.join(DATA_DIR, '_data_migration_result_v2.json'), JSON.stringify(results, null, 2));
  console.log('\nDone. Detail in scripts/data/_data_migration_result_v2.json');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
