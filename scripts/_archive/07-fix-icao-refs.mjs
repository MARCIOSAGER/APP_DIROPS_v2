#!/usr/bin/env node
// PASSO 7: Migrate tables that store airport references as ICAO codes (Base44 style)
// into FK columns that expect aeroporto.id UUID (on-premise schema).
//
// Affected tables (per audit + v3 migration failures):
//   - medicao_k_p_i        (~2563 rows; aeroporto_id stored as ICAO)
//   - pasta                (~34;   aeroporto)
//   - reclamacao           (~1;    aeroporto_id)
//   - processo_auditoria   (~2;    aeroporto_id)
//   - plano_acao_corretiva (~1;    aeroporto_id)
//
// Strategy:
//   1) Load aeroporto rows from local DB to build ICAO -> UUID map.
//   2) For each affected table, read Base44 export JSON.
//   3) Apply the same cleanAndTranslate + UUID v5 as 03c, plus ICAO-to-UUID rewrite
//      on the known column for that table.
//   4) Skip rows whose ICAO has no match (orphaned; will be reported).
//   5) Insert via PostgREST with resolution=ignore-duplicates.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  EMPRESA_ID_MAP,
  DEFAULT_EMPRESA_ID,
  TABLE_NAME_OVERRIDES,
} from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const POSTGREST_URL = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const BASE44_ID_RE = /^[0-9a-f]{24}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ICAO_RE = /^[A-Z]{4}$/;

const FIELDS_TO_REMOVE = ['__v', '_id', 'app_id', 'entity_type', 'row_id', 'is_sample',
                          'createdAt', 'updatedAt', 'created_at', 'updated_at',
                          'created_by_id', 'user_id'];

// JSON file name -> { dbTable, icaoColumns: { incomingField: outgoingField } }
// incomingField = field name in Base44 JSON. outgoingField = column name in DB (may differ).
const TABLE_CONFIG = {
  medicao_kpi: { dbTable: 'medicao_k_p_i', icaoColumns: { aeroporto_id: 'aeroporto_id' } },
  pasta:                { dbTable: 'pasta',                icaoColumns: { aeroporto_id: 'aeroporto_id' } },
  reclamacao:           { dbTable: 'reclamacao',           icaoColumns: { aeroporto_id: 'aeroporto_id' } },
  processo_auditoria:   { dbTable: 'processo_auditoria',   icaoColumns: { aeroporto_id: 'aeroporto_id' } },
  plano_acao_corretiva: { dbTable: 'plano_acao_corretiva', icaoColumns: { aeroporto_id: 'aeroporto_id' } },
};

function uuidV5(name) {
  const nsBytes = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = crypto.createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function translateValue(v, fieldName) {
  if (typeof v !== 'string') return v;
  if (UUID_RE.test(v)) return v;
  if ((fieldName === 'empresa_id' || fieldName === 'empresa_solicitante_id') && BASE44_ID_RE.test(v)) {
    return EMPRESA_ID_MAP[v] || uuidV5(v);
  }
  if (BASE44_ID_RE.test(v)) return uuidV5(v);
  return v;
}

function cleanAndTranslate(record, icaoMap, cfg) {
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (FIELDS_TO_REMOVE.includes(k)) continue;
    if (v === null || v === undefined) { out[k] = v; continue; }
    // Special: ICAO-to-UUID lookup for known columns
    if (cfg.icaoColumns[k] && typeof v === 'string' && ICAO_RE.test(v.toUpperCase())) {
      const uuid = icaoMap.get(v.toUpperCase());
      if (uuid) {
        out[cfg.icaoColumns[k]] = uuid;
        continue;
      } else {
        // ICAO unknown — skip this field (will be NULL, may still insert if FK nullable)
        continue;
      }
    }
    if (Array.isArray(v)) {
      out[k] = v.map(it => translateValue(it, k));
    } else {
      out[k] = translateValue(v, k);
    }
  }
  if (out.id && !UUID_RE.test(out.id)) delete out.id;
  if (!out.created_date) out.created_date = new Date().toISOString();
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

function filterByCols(rec, cols) {
  const out = {};
  for (const k of Object.keys(rec)) if (cols.has(k)) out[k] = rec[k];
  return out;
}

async function loadIcaoMap() {
  // Fetch ALL aeroportos and build codigo_icao -> id map
  const r = await fetch(POSTGREST_URL + '/aeroporto?select=id,codigo_icao&limit=10000', {
    headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY, 'apikey': SUPABASE_SERVICE_ROLE_KEY },
  });
  const rows = await r.json();
  const m = new Map();
  for (const row of rows) {
    if (row.codigo_icao) m.set(row.codigo_icao.toUpperCase(), row.id);
  }
  return m;
}

async function insertBatch(table, batch) {
  return fetch(POSTGREST_URL + '/' + table, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(batch),
  });
}

async function migrateOne(fileName, cfg, icaoMap) {
  const file = path.join(DATA_DIR, fileName + '.json');
  if (!fs.existsSync(file)) return { table: cfg.dbTable, total: 0, inserted: 0, errors: 0, msg: 'no JSON file' };
  const records = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!Array.isArray(records) || !records.length) return { table: cfg.dbTable, total: 0, inserted: 0, errors: 0 };

  const cols = await getColumns(cfg.dbTable);
  if (!cols) return { table: cfg.dbTable, total: records.length, inserted: 0, errors: records.length, msg: 'no schema' };

  let inserted = 0, errors = 0, firstError = '';
  const BATCH = 100;
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH);
    const batch = slice.map(r => filterByCols(cleanAndTranslate(r, icaoMap, cfg), cols));
    const resp = await insertBatch(cfg.dbTable, batch);
    if (!resp.ok) {
      // Retry one-by-one to count valid
      for (const single of batch) {
        const r2 = await insertBatch(cfg.dbTable, [single]);
        if (r2.ok) inserted++;
        else {
          errors++;
          if (!firstError) firstError = (await r2.text()).slice(0, 180);
        }
      }
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\r  ${cfg.dbTable}: ${Math.round(((i + batch.length) / records.length) * 100)}% (${inserted}/${records.length})  `);
  }
  process.stdout.write('\n');
  return { table: cfg.dbTable, total: records.length, inserted, errors, firstError };
}

async function main() {
  console.log('=== FIX ICAO -> UUID refs ===\n');

  // KILL SWITCH (2026-07-03): parte do pipeline de re-migracao Base44 (roda apos 03c).
  // Faz INSERT (ignore-duplicates) em medicao_kpi/pasta/reclamacao/etc., ressuscitando
  // registos apagados. Desativado (sistema em producao). Force: --force / MIGRATION_ENABLED=1.
  const forcado = process.argv.includes('--force') || process.env.MIGRATION_ENABLED === '1';
  if (!forcado) {
    console.log('SYNC DESATIVADA: fix-icao-refs (re-migracao Base44) desligado (sistema em producao).');
    console.log('Nada foi alterado. Para forcar: node scripts/07-fix-icao-refs.mjs --force');
    return;
  }
  console.log('AVISO: execucao FORCADA — vai reinserir refs do Base44 no sistema atual.\n');

  const icaoMap = await loadIcaoMap();
  console.log(`Loaded ICAO map: ${icaoMap.size} airports`);

  const results = [];
  for (const [fileName, cfg] of Object.entries(TABLE_CONFIG)) {
    try {
      const r = await migrateOne(fileName, cfg, icaoMap);
      results.push(r);
    } catch (e) {
      console.error(`${cfg.dbTable}: FATAL ${e.message}`);
      results.push({ table: cfg.dbTable, fatal: e.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    const status = r.inserted === r.total ? 'OK  ' : (r.inserted === 0 ? 'FAIL' : 'PART');
    console.log(`  [${status}] ${r.table.padEnd(28)} ${r.inserted}/${r.total}  ${r.firstError || r.msg || ''}`);
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
