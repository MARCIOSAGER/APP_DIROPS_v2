#!/usr/bin/env node
// ============================================================
// PASSO 5: Importar dados que FALTAM do Base44 para Supabase
// ============================================================
// - Compara Base44 export com Supabase actual
// - Insere apenas registros novos (sem duplicar)
// - Cria mapeamento base44_id → supabase_uuid
// - Resolve foreign keys (VooLigado, CalculoTarifa)
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  EMPRESA_ID_MAP,
  DEFAULT_EMPRESA_ID,
} from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const BATCH_SIZE = 50;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ID mapping: base44_id → supabase_uuid
const idMap = new Map();
const MAP_FILE = path.join(DATA_DIR, '_id_mapping.json');

function loadIdMap() {
  if (fs.existsSync(MAP_FILE)) {
    const data = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
    for (const [k, v] of Object.entries(data)) {
      idMap.set(k, v);
    }
    console.log(`  ID map carregado: ${idMap.size} entradas`);
  }
}

function saveIdMap() {
  const obj = Object.fromEntries(idMap);
  fs.writeFileSync(MAP_FILE, JSON.stringify(obj, null, 2));
}

function mapEmpresaId(base44EmpresaId) {
  if (!base44EmpresaId) return DEFAULT_EMPRESA_ID;
  if (base44EmpresaId.match(/^[0-9a-f]{8}-/)) return base44EmpresaId; // already UUID
  return EMPRESA_ID_MAP[base44EmpresaId] || DEFAULT_EMPRESA_ID;
}

// ─── VOO IMPORT ──────────────────────────────────────────────

async function importVoos() {
  console.log('\n=== IMPORTAR VOOS ===\n');

  const base44Voos = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'voo.json'), 'utf-8'));
  console.log(`Base44: ${base44Voos.length} voos`);

  // Fetch ALL existing voos from Supabase (SGA only) - paginated
  console.log('Buscando voos existentes no Supabase...');
  let existingVoos = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('voo')
      .select('id,numero_voo,data_operacao,tipo_movimento,aeroporto_operacao,created_date')
      .eq('empresa_id', DEFAULT_EMPRESA_ID)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Erro fetch voos:', error.message); break; }
    if (!data || data.length === 0) break;
    existingVoos = existingVoos.concat(data);
    from += PAGE;
  }
  console.log(`Supabase SGA: ${existingVoos.length} voos`);

  // Build lookup set: natural key = numero_voo|data_operacao|tipo_movimento|aeroporto_operacao|horario_real
  const existingKeys = new Set();
  for (const v of existingVoos) {
    const key = `${v.numero_voo}|${v.data_operacao}|${v.tipo_movimento}|${v.aeroporto_operacao}`;
    existingKeys.add(key);
  }

  // Filter only missing voos
  const missing = base44Voos.filter(v => {
    const key = `${v.numero_voo}|${v.data_operacao}|${v.tipo_movimento}|${v.aeroporto_operacao}`;
    return !existingKeys.has(key);
  });

  console.log(`Novos para importar: ${missing.length}`);
  if (missing.length === 0) {
    console.log('Nenhum voo novo para importar.');
    return;
  }

  // Insert in batches
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE).map(v => {
      const base44Id = v.id;
      const record = { ...v };

      // Remove Base44 internal fields
      delete record.id;
      delete record.created_by_id;
      delete record.is_sample;
      delete record.__v;
      delete record._id;

      // Map empresa_id
      record.empresa_id = DEFAULT_EMPRESA_ID;

      // Track base44 id
      record.created_by = record.created_by || 'importacao_base44';
      record.updated_by = 'importacao_base44';

      // Clean voo_ligado_id (will be remapped later)
      delete record.voo_ligado_id;

      return { base44Id, record };
    });

    const records = batch.map(b => b.record);

    const { data, error } = await supabase
      .from('voo')
      .insert(records)
      .select('id');

    if (error) {
      // Try one by one
      for (const b of batch) {
        const { data: single, error: singleErr } = await supabase
          .from('voo')
          .insert(b.record)
          .select('id');

        if (singleErr) {
          errors++;
          if (errors <= 5) console.error(`  Erro: ${singleErr.message} | voo: ${b.record.numero_voo} ${b.record.data_operacao}`);
        } else if (single?.[0]) {
          idMap.set(b.base44Id, single[0].id);
          inserted++;
        }
      }
    } else if (data) {
      for (let j = 0; j < data.length; j++) {
        idMap.set(batch[j].base44Id, data[j].id);
        inserted++;
      }
    }

    const pct = Math.round(((i + batch.length) / missing.length) * 100);
    process.stdout.write(`\r  Progresso: ${pct}% (${inserted} inseridos, ${errors} erros)`);
  }

  console.log(`\n  Resultado: ${inserted} inseridos, ${errors} erros`);
  saveIdMap();
}

// ─── ALSO MAP EXISTING VOOS ─────────────────────────────────

async function mapExistingVoos() {
  console.log('\n=== MAPEAR VOOS EXISTENTES ===\n');

  const base44Voos = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'voo.json'), 'utf-8'));

  // For voos that already existed, we need to map base44_id → supabase_id by natural key
  let existingVoos = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('voo')
      .select('id,numero_voo,data_operacao,tipo_movimento,aeroporto_operacao')
      .eq('empresa_id', DEFAULT_EMPRESA_ID)
      .range(from, from + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    existingVoos = existingVoos.concat(data);
    from += PAGE;
  }

  // Build Supabase lookup
  const supabaseLookup = new Map();
  for (const v of existingVoos) {
    const key = `${v.numero_voo}|${v.data_operacao}|${v.tipo_movimento}|${v.aeroporto_operacao}`;
    supabaseLookup.set(key, v.id);
  }

  let mapped = 0;
  for (const v of base44Voos) {
    if (idMap.has(v.id)) continue; // already mapped from insert
    const key = `${v.numero_voo}|${v.data_operacao}|${v.tipo_movimento}|${v.aeroporto_operacao}`;
    const supaId = supabaseLookup.get(key);
    if (supaId) {
      idMap.set(v.id, supaId);
      mapped++;
    }
  }

  console.log(`  Mapeados ${mapped} voos existentes`);
  console.log(`  Total no idMap: ${idMap.size}`);
  saveIdMap();
}

// ─── VOO LIGADO IMPORT ──────────────────────────────────────

async function importVoosLigados() {
  console.log('\n=== IMPORTAR VOOS LIGADOS ===\n');

  const base44VL = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'voo_ligado.json'), 'utf-8'));
  console.log(`Base44: ${base44VL.length} voos ligados`);

  // Fetch existing
  let existingVL = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('voo_ligado')
      .select('id,id_voo_arr,id_voo_dep')
      .eq('empresa_id', DEFAULT_EMPRESA_ID)
      .range(from, from + 999);
    if (error) break;
    if (!data || data.length === 0) break;
    existingVL = existingVL.concat(data);
    from += 1000;
  }
  console.log(`Supabase SGA: ${existingVL.length} voos ligados`);

  // Build existing pairs set
  const existingPairs = new Set(existingVL.map(vl => `${vl.id_voo_arr}|${vl.id_voo_dep}`));

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < base44VL.length; i++) {
    const vl = base44VL[i];
    const base44Id = vl.id;

    // Remap foreign keys
    const arrId = idMap.get(vl.id_voo_arr);
    const depId = idMap.get(vl.id_voo_dep);

    if (!arrId || !depId) {
      skipped++;
      continue;
    }

    // Check if pair already exists
    if (existingPairs.has(`${arrId}|${depId}`)) {
      // Map the base44 VL id to existing supabase VL
      const existing = existingVL.find(e => e.id_voo_arr === arrId && e.id_voo_dep === depId);
      if (existing) idMap.set(base44Id, existing.id);
      skipped++;
      continue;
    }

    const record = {
      id_voo_arr: arrId,
      id_voo_dep: depId,
      empresa_id: DEFAULT_EMPRESA_ID,
      created_date: vl.created_date || new Date().toISOString(),
      created_by: 'importacao_base44',
      updated_by: 'importacao_base44',
    };

    const { data, error } = await supabase
      .from('voo_ligado')
      .insert(record)
      .select('id');

    if (error) {
      errors++;
      if (errors <= 5) console.error(`  Erro: ${error.message}`);
    } else if (data?.[0]) {
      idMap.set(base44Id, data[0].id);
      inserted++;
    }

    if (i % 100 === 0) {
      process.stdout.write(`\r  Progresso: ${Math.round((i / base44VL.length) * 100)}% (${inserted} novos, ${skipped} existentes, ${errors} erros)`);
    }
  }

  console.log(`\n  Resultado: ${inserted} inseridos, ${skipped} existentes/pulados, ${errors} erros`);
  saveIdMap();
}

// ─── CALCULO TARIFA IMPORT ──────────────────────────────────

async function importCalculosTarifa() {
  console.log('\n=== IMPORTAR CALCULOS TARIFA ===\n');

  const base44CT = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'calculo_tarifa.json'), 'utf-8'));
  console.log(`Base44: ${base44CT.length} calculos`);

  // Fetch existing
  let existingCT = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('calculo_tarifa')
      .select('id,voo_id,voo_ligado_id,tipo_tarifa')
      .eq('empresa_id', DEFAULT_EMPRESA_ID)
      .range(from, from + 999);
    if (error) break;
    if (!data || data.length === 0) break;
    existingCT = existingCT.concat(data);
    from += 1000;
  }
  console.log(`Supabase SGA: ${existingCT.length} calculos`);

  const existingVooIds = new Set(existingCT.map(ct => `${ct.voo_id}|${ct.voo_ligado_id}`));

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < base44CT.length; i++) {
    const ct = base44CT[i];
    const base44Id = ct.id;

    // Remap foreign keys
    const vooId = idMap.get(ct.voo_id);
    const vlId = ct.voo_ligado_id ? idMap.get(ct.voo_ligado_id) : null;

    if (!vooId) {
      skipped++;
      continue;
    }

    // Check if already exists
    if (existingVooIds.has(`${vooId}|${vlId}`)) {
      skipped++;
      continue;
    }

    const record = { ...ct };
    delete record.id;
    delete record.created_by_id;
    delete record.is_sample;
    delete record.__v;
    delete record._id;

    record.voo_id = vooId;
    record.voo_ligado_id = vlId;
    record.empresa_id = DEFAULT_EMPRESA_ID;
    record.created_by = record.created_by || 'importacao_base44';
    record.updated_by = 'importacao_base44';

    // Map aeroporto_id if it's a Base44 ObjectId
    if (record.aeroporto_id && !record.aeroporto_id.match(/^[0-9a-f]{8}-/)) {
      const mapped = idMap.get(record.aeroporto_id);
      if (mapped) record.aeroporto_id = mapped;
      else delete record.aeroporto_id;
    }

    const { data, error } = await supabase
      .from('calculo_tarifa')
      .insert(record)
      .select('id');

    if (error) {
      errors++;
      if (errors <= 5) console.error(`  Erro: ${error.message}`);
    } else if (data?.[0]) {
      idMap.set(base44Id, data[0].id);
      inserted++;
    }

    if (i % 100 === 0) {
      process.stdout.write(`\r  Progresso: ${Math.round((i / base44CT.length) * 100)}% (${inserted} novos, ${skipped} existentes, ${errors} erros)`);
    }
  }

  console.log(`\n  Resultado: ${inserted} inseridos, ${skipped} existentes/pulados, ${errors} erros`);
  saveIdMap();
}

// ─── SMALL TABLES IMPORT ────────────────────────────────────

async function importSmallTables() {
  console.log('\n=== IMPORTAR TABELAS MENORES ===\n');

  const tables = [
    { file: 'medicao_kpi.json', table: 'medicao_k_p_i', hasEmpresa: true },
    { file: 'item_pac.json', table: 'item_p_a_c', hasEmpresa: false },
    { file: 'historico_reclamacao.json', table: 'historico_reclamacao', hasEmpresa: false },
    { file: 'pasta.json', table: 'pasta', hasEmpresa: false },
  ];

  for (const { file, table, hasEmpresa } of tables) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ${table}: arquivo não encontrado, pulando`);
      continue;
    }

    const records = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (records.length === 0) {
      console.log(`  ${table}: vazio, pulando`);
      continue;
    }

    // Check current count
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true });

    if (count >= records.length) {
      console.log(`  ${table}: Supabase já tem ${count} (Base44: ${records.length}), pulando`);
      continue;
    }

    console.log(`  ${table}: importando ${records.length} registros (Supabase tem ${count})...`);

    let inserted = 0;
    let errs = 0;

    for (const r of records) {
      const record = { ...r };
      delete record.id;
      delete record.created_by_id;
      delete record.is_sample;

      if (hasEmpresa) {
        record.empresa_id = mapEmpresaId(record.empresa_id);
      }

      // Remap known FK fields
      if (record.tipo_kpi_id && idMap.has(record.tipo_kpi_id)) {
        record.tipo_kpi_id = idMap.get(record.tipo_kpi_id);
      }
      if (record.aeroporto_id && idMap.has(record.aeroporto_id)) {
        record.aeroporto_id = idMap.get(record.aeroporto_id);
      }

      record.updated_by = 'importacao_base44';

      const { error } = await supabase.from(table).insert(record);
      if (error) {
        errs++;
        if (errs <= 2) console.error(`    Erro: ${error.message}`);
      } else {
        inserted++;
      }
    }

    console.log(`    -> ${inserted} inseridos, ${errs} erros`);
  }
}

// ─── MAIN ───────────────────────────────────────────────────

async function main() {
  console.log('=== IMPORTACAO DE DADOS FALTANTES ===');
  console.log(`Empresa SGA: ${DEFAULT_EMPRESA_ID}\n`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERRO: Credenciais Supabase não encontradas no .env.migration');
    process.exit(1);
  }

  loadIdMap();

  // 1. Import missing Voos
  await importVoos();

  // 2. Map existing Voos (build base44_id → supabase_id for already-existing records)
  await mapExistingVoos();

  // 3. Import missing VoosLigados (with remapped voo IDs)
  await importVoosLigados();

  // 4. Import missing CalculosTarifa (with remapped voo IDs)
  await importCalculosTarifa();

  // 5. Import small tables
  await importSmallTables();

  console.log(`\n=== CONCLUIDO ===`);
  console.log(`Total mapeamentos: ${idMap.size}`);
  saveIdMap();
}

main().catch(err => {
  console.error('Erro fatal:', err);
  saveIdMap(); // Save partial progress
  process.exit(1);
});
