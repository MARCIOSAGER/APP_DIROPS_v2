#!/usr/bin/env node
// ============================================================
// Export SGA Cloud → On-Premise
// Lê do Supabase Cloud (somente leitura) e gera JSONs para
// import posterior no Supabase Self-Hosted em SRVKMS001.
//
// USO:
//   node scripts/sga-export/01-export-from-cloud.mjs           # dry-run (default)
//   node scripts/sga-export/01-export-from-cloud.mjs --execute # exporta de verdade
//
// Configuração: scripts/.env.migration (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
// As creds devem apontar para o projeto CLOUD (origem).
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config.mjs';
import {
  SGA_EMPRESA_ID,
  TENANT_TABLES,
  CHILD_TABLES,
  GLOBAL_TABLES,
  SPECIAL_TABLES,
  SKIP_TABLES,
  assertNoOverlap,
  allKnownTables,
} from './tables.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const PAGE_SIZE = 1000;

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has('--execute');
const VERBOSE = args.has('--verbose');

function log(...a) { console.log(...a); }
function warn(...a) { console.warn('  [WARN]', ...a); }
function err(...a) { console.error('  [ERR]', ...a); }

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  err('Credenciais Supabase Cloud não encontradas.');
  err('Copie scripts/.env.migration.example -> scripts/.env.migration e preencha.');
  process.exit(1);
}
if (!SUPABASE_URL.includes('supabase.co')) {
  warn(`SUPABASE_URL não parece ser Cloud (${SUPABASE_URL}). Continuando — verifique que é a origem certa.`);
}

assertNoOverlap();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const manifest = {
  ranAt: new Date().toISOString(),
  mode: EXECUTE ? 'execute' : 'dry-run',
  sgaEmpresaId: SGA_EMPRESA_ID,
  sourceUrl: SUPABASE_URL,
  tables: {},
  warnings: [],
  unknownTables: [],
};

// -------------------- helpers --------------------

async function countAll(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    if (error.code === '42P01' || /does not exist/i.test(error.message)) return null;
    throw error;
  }
  return count ?? 0;
}

async function fetchAll(table, modifyQuery) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (modifyQuery) q = modifyQuery(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function writeJson(name, data) {
  if (!EXECUTE) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

// -------------------- export strategies --------------------

async function exportTenant(table) {
  const totalCount = await countAll(table);
  if (totalCount === null) return { skipped: true, reason: 'table missing in DB' };

  // Filtro: empresa_id = SGA OR empresa_id IS NULL
  const { count: scopedCount, error: countErr } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .or(`empresa_id.eq.${SGA_EMPRESA_ID},empresa_id.is.null`);
  if (countErr) {
    // Pode acontecer se a tabela não tem coluna empresa_id (classificação errada)
    return { error: countErr.message, totalCount };
  }

  if (!EXECUTE) {
    return { strategy: 'tenant', totalCount, scopedCount, filtered: totalCount - scopedCount };
  }

  const rows = await fetchAll(table, q =>
    q.or(`empresa_id.eq.${SGA_EMPRESA_ID},empresa_id.is.null`)
  );
  await writeJson(`${table}.json`, rows);
  return { strategy: 'tenant', totalCount, scopedCount, exported: rows.length };
}

async function exportChild({ table, parentFk, parentTable, parentKey, includeNullFk }) {
  const totalCount = await countAll(table);
  if (totalCount === null) return { skipped: true, reason: 'table missing in DB' };

  // 1. Buscar IDs do pai SGA (paginado pra evitar limite 1000 em IN).
  const parentIds = new Set();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(parentTable)
      .select(parentKey)
      .or(`empresa_id.eq.${SGA_EMPRESA_ID},empresa_id.is.null`)
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { error: error.message, totalCount };
    if (!data || data.length === 0) break;
    for (const row of data) parentIds.add(row[parentKey]);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (parentIds.size === 0 && !includeNullFk) {
    return { strategy: 'child', totalCount, scopedCount: 0, exported: 0, note: 'no SGA parents found' };
  }

  if (!EXECUTE) {
    return {
      strategy: 'child', totalCount,
      parentTable, parentIds: parentIds.size,
      note: 'count via IN (...) requires chunked queries; skipped in dry-run',
    };
  }

  // 2. Buscar filhos em chunks (PostgREST limita .in() a ~1000 valores).
  const ids = [...parentIds];
  const rows = [];
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const chunkRows = await fetchAll(table, q => q.in(parentFk, chunk));
    rows.push(...chunkRows);
  }
  if (includeNullFk) {
    const nullRows = await fetchAll(table, q => q.is(parentFk, null));
    rows.push(...nullRows);
  }
  await writeJson(`${table}.json`, rows);
  return { strategy: 'child', totalCount, exported: rows.length };
}

async function exportGlobal(table) {
  const totalCount = await countAll(table);
  if (totalCount === null) return { skipped: true, reason: 'table missing in DB' };

  if (!EXECUTE) return { strategy: 'global', totalCount, exported: totalCount };

  const rows = await fetchAll(table);
  await writeJson(`${table}.json`, rows);
  return { strategy: 'global', totalCount, exported: rows.length };
}

async function exportSpecial(spec) {
  const { table, kind } = spec;
  const totalCount = await countAll(table);
  if (totalCount === null) return { skipped: true, reason: 'table missing in DB' };

  let modifier;
  if (kind === 'whereId') {
    modifier = q => q.eq(spec.column, spec.value);
  } else if (kind === 'whereEq') {
    modifier = q => spec.includeNull
      ? q.or(`${spec.column}.eq.${spec.value},${spec.column}.is.null`)
      : q.eq(spec.column, spec.value);
  } else {
    return { error: `unknown special kind: ${kind}`, totalCount };
  }

  if (!EXECUTE) {
    const { count: scopedCount } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .modify ? null : null; // PostgREST builder doesn't expose modify; just report total here
    return { strategy: 'special', kind, totalCount };
  }

  const rows = await fetchAll(table, modifier);
  await writeJson(`${table}.json`, rows);
  return { strategy: 'special', kind, totalCount, exported: rows.length };
}

// -------------------- storage --------------------

async function exportStorageManifest() {
  log('\n--- Storage buckets ---');
  const result = { buckets: [] };
  for (const bucket of ['uploads', 'private-uploads']) {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000, offset: 0 });
    if (error) {
      warn(`bucket "${bucket}": ${error.message}`);
      result.buckets.push({ name: bucket, error: error.message });
      continue;
    }
    log(`  ${bucket}: ${data?.length ?? 0} objetos no nível raiz (recurse não suportado por esta listagem flat — usar 02-export-storage-blobs.mjs depois para crawl completo)`);
    result.buckets.push({ name: bucket, rootCount: data?.length ?? 0, sample: data?.slice(0, 5) });
  }
  if (EXECUTE) await writeJson('_storage-objects.json', result);
  return result;
}

// -------------------- discover unknown tables --------------------

async function discoverUnknown() {
  // Usa RPC ou query crua? Service role tem acesso direto ao information_schema via PostgREST?
  // Não — information_schema não é exposto. Uma alternativa é manter uma allowlist baseada nas
  // migrations conhecidas e simplesmente avisar quando uma tabela esperada não responde.
  // Para detectar tabelas novas, dependeria de RPC custom; aceitamos esse limite por ora.
  return [];
}

// -------------------- main --------------------

async function main() {
  log('==========================================');
  log('SGA Cloud → On-Premise EXPORT');
  log(`Modo: ${EXECUTE ? 'EXECUTE (vai escrever JSONs)' : 'DRY-RUN (só contagens)'}`);
  log(`Origem: ${SUPABASE_URL}`);
  log(`SGA empresa_id: ${SGA_EMPRESA_ID}`);
  log('==========================================\n');

  // 1. Tenant tables
  log('--- Tabelas tenant (filtro: empresa_id = SGA OR NULL) ---');
  for (const table of TENANT_TABLES) {
    try {
      const r = await exportTenant(table);
      manifest.tables[table] = r;
      if (r.skipped) warn(`${table}: ${r.reason}`);
      else if (r.error) err(`${table}: ${r.error}`);
      else log(`  ${table.padEnd(28)} total=${r.totalCount?.toString().padStart(7)}  scoped=${r.scopedCount?.toString().padStart(7)}${EXECUTE ? `  exported=${r.exported}` : ''}`);
    } catch (e) {
      err(`${table}: ${e.message}`);
      manifest.tables[table] = { error: e.message };
    }
  }

  // 2. Child tables
  log('\n--- Tabelas filhas (filtro via FK ao pai SGA) ---');
  for (const spec of CHILD_TABLES) {
    try {
      const r = await exportChild(spec);
      manifest.tables[spec.table] = r;
      if (r.skipped) warn(`${spec.table}: ${r.reason}`);
      else if (r.error) err(`${spec.table}: ${r.error}`);
      else log(`  ${spec.table.padEnd(28)} total=${r.totalCount?.toString().padStart(7)}  via ${spec.parentTable}.${spec.parentKey}=${spec.parentFk}${EXECUTE ? `  exported=${r.exported}` : ''}`);
    } catch (e) {
      err(`${spec.table}: ${e.message}`);
      manifest.tables[spec.table] = { error: e.message };
    }
  }

  // 3. Global lookup tables
  log('\n--- Tabelas globais (export integral) ---');
  for (const table of GLOBAL_TABLES) {
    try {
      const r = await exportGlobal(table);
      manifest.tables[table] = r;
      if (r.skipped) warn(`${table}: ${r.reason}`);
      else log(`  ${table.padEnd(28)} total=${r.totalCount?.toString().padStart(7)}${EXECUTE ? `  exported=${r.exported}` : ''}`);
    } catch (e) {
      err(`${table}: ${e.message}`);
      manifest.tables[table] = { error: e.message };
    }
  }

  // 4. Special
  log('\n--- Tabelas com regra especial ---');
  for (const spec of SPECIAL_TABLES) {
    try {
      const r = await exportSpecial(spec);
      manifest.tables[spec.table] = r;
      if (r.skipped) warn(`${spec.table}: ${r.reason}`);
      else if (r.error) err(`${spec.table}: ${r.error}`);
      else log(`  ${spec.table.padEnd(28)} total=${r.totalCount?.toString().padStart(7)}  kind=${spec.kind}${EXECUTE ? `  exported=${r.exported}` : ''}`);
    } catch (e) {
      err(`${spec.table}: ${e.message}`);
      manifest.tables[spec.table] = { error: e.message };
    }
  }

  // 5. Skipped
  log('\n--- Tabelas ignoradas (ephemeral/regenerável) ---');
  for (const table of SKIP_TABLES) {
    log(`  ${table.padEnd(28)} SKIP`);
    manifest.tables[table] = { strategy: 'skip' };
  }

  // 6. Storage
  manifest.storage = await exportStorageManifest();

  // 7. Manifesto
  if (EXECUTE) {
    await writeJson('_manifest.json', manifest);
    log(`\n✅ Export concluído. Veja: scripts/sga-export/data/`);
  } else {
    log(`\nℹ Dry-run concluído. Para executar de verdade: --execute`);
    log(`  Resumo:`);
    const cats = { tenant: 0, child: 0, global: 0, special: 0, skip: 0, error: 0 };
    for (const r of Object.values(manifest.tables)) {
      if (r.error) cats.error++;
      else if (r.strategy) cats[r.strategy]++;
    }
    log(`    tenant=${cats.tenant}  child=${cats.child}  global=${cats.global}  special=${cats.special}  skip=${cats.skip}  err=${cats.error}`);
  }

  if (manifest.warnings.length > 0) {
    log(`\nWarnings: ${manifest.warnings.length}`);
    manifest.warnings.forEach(w => log(`  - ${w}`));
  }
}

main().catch(e => {
  err('Erro fatal:', e);
  process.exit(1);
});
