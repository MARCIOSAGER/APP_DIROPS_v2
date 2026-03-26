#!/usr/bin/env node
// ============================================================
// PASSO 3: Migrar dados das entidades para Supabase
// ============================================================
// Uso: node scripts/03-migrate-data.mjs
//
// Prerequisito: ter executado 01-export-base44.mjs
//
// O que faz:
// 1. Le os JSONs de scripts/data/
// 2. Insere os registros no Supabase em lotes
// 3. Trata IDs (Base44 usa string, Supabase usa UUID)
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
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
const BATCH_SIZE = 50;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Campos que o Base44 usa mas nao existem no Supabase
const FIELDS_TO_REMOVE = ['__v', '_id', 'app_id', 'entity_type', 'row_id'];

// Ordem de insercao (tabelas referenciadas primeiro)
const INSERT_ORDER = [
  'aeroporto',
  'companhia_aerea',
  'modelo_aeronave',
  'empresa',
  'configuracao_sistema',
  'configuracao_area',
  'configuracao_notificacoes',
  'configuracao_opt_in_zapi',
  'tipo_auditoria',
  'tipo_documento',
  'tipo_inspecao',
  'tipo_kpi',
  'campo_kpi',
  'area_acesso',
  'regra_notificacao',
  'regra_permissao',
  'pasta',
  'placeholder',
  'grupo_whats_app',
  // Entidades dependentes
  'credenciamento',
  'reclamacao',
  'historico_reclamacao',
  'solicitacao_acesso',
  'voo',
  'voo_ligado',
  'registo_aeronave',
  'registo_grf',
  'proforma',
  'calculo_tarifa',
  'tarifa_pouso',
  'tarifa_permanencia',
  'outra_tarifa',
  'imposto',
  'movimento_financeiro',
  'documento',
  'ordem_servico',
  'ocorrencia_safety',
  'inspecao',
  'resposta_inspecao',
  'processo_auditoria',
  'item_auditoria',
  'resposta_auditoria',
  'item_checklist',
  'plano_acao_corretiva',
  'item_pac',
  'medicao_kpi',
  'valor_campo_kpi',
  'historico_notificacao',
];

function cleanRecord(record) {
  const cleaned = { ...record };

  // Remover campos internos do Base44
  for (const field of FIELDS_TO_REMOVE) {
    delete cleaned[field];
  }

  // Se o Base44 usa 'id' como string nao-UUID, preservar como base44_id
  // e deixar o Supabase gerar UUID novo
  if (cleaned.id && typeof cleaned.id === 'string' && !isUUID(cleaned.id)) {
    cleaned.base44_id = cleaned.id;
    delete cleaned.id;
  }

  // Mapear empresa_id do Base44 (ObjectId) para Supabase (UUID)
  if (cleaned.empresa_id && typeof cleaned.empresa_id === 'string' && !isUUID(cleaned.empresa_id)) {
    cleaned.empresa_id = EMPRESA_ID_MAP[cleaned.empresa_id] || DEFAULT_EMPRESA_ID;
  }
  // Mapear empresa_solicitante_id (solicitacao_acesso)
  if (cleaned.empresa_solicitante_id && typeof cleaned.empresa_solicitante_id === 'string' && !isUUID(cleaned.empresa_solicitante_id)) {
    cleaned.empresa_solicitante_id = EMPRESA_ID_MAP[cleaned.empresa_solicitante_id] || DEFAULT_EMPRESA_ID;
  }

  // Remover campos que referenciam IDs Base44 (serao remapeados)
  // created_by_id e user_id sao ObjectIds do Base44 — nao existem no Supabase
  delete cleaned.created_by_id;
  delete cleaned.user_id;
  delete cleaned.is_sample;

  // Garantir created_date
  if (!cleaned.created_date) {
    cleaned.created_date = cleaned.createdAt || cleaned.created_at || new Date().toISOString();
  }

  // Limpar campos vazios de data
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  delete cleaned.created_at;
  delete cleaned.updated_at;

  return cleaned;
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function migrateTable(tableName, records) {
  const total = records.length;
  let inserted = 0;
  let errors = 0;

  // Inserir em lotes
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(cleanRecord);

    const { data, error } = await supabase
      .from(tableName)
      .upsert(batch, {
        onConflict: 'id',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      // Tentar inserir um a um para identificar registros problematicos
      console.warn(`  Lote ${Math.floor(i / BATCH_SIZE) + 1} falhou, tentando individual...`);

      for (const record of batch) {
        const { error: singleErr } = await supabase
          .from(tableName)
          .upsert(record, { onConflict: 'id', ignoreDuplicates: true });

        if (singleErr) {
          errors++;
          if (errors <= 3) {
            console.error(`  Erro no registro: ${JSON.stringify(record).slice(0, 150)}`);
            console.error(`  -> ${singleErr.message}`);
          }
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    // Progresso
    const pct = Math.round(((i + batch.length) / total) * 100);
    process.stdout.write(`\r  Progresso: ${pct}% (${inserted}/${total})`);
  }

  console.log(`\r  Total: ${inserted} inseridos, ${errors} erros${' '.repeat(20)}`);
  return { inserted, errors };
}

async function main() {
  console.log('=== MIGRACAO DE DADOS ===\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERRO: Credenciais Supabase nao encontradas.');
    console.error('Copie scripts/.env.migration.example -> scripts/.env.migration e preencha.');
    process.exit(1);
  }

  if (!fs.existsSync(DATA_DIR)) {
    console.error('ERRO: Diretorio scripts/data/ nao encontrado.');
    console.error('Execute primeiro: node scripts/01-export-base44.mjs');
    process.exit(1);
  }

  const results = { success: [], failed: [], skipped: [] };

  // Migrar na ordem correta
  const allTables = new Set(INSERT_ORDER);

  // Adicionar tabelas que nao estao na lista de ordem
  const skipTables = new Set(
    SKIP_ENTITIES.map(e => ENTITY_TABLE_MAP[e]).filter(Boolean)
  );
  skipTables.add('users'); // Users sao migrados pelo script 02

  for (const [entity, table] of Object.entries(ENTITY_TABLE_MAP)) {
    if (!allTables.has(table) && !skipTables.has(table)) {
      INSERT_ORDER.push(table);
      allTables.add(table);
    }
  }

  for (const tableName of INSERT_ORDER) {
    if (skipTables.has(tableName)) continue;

    const filePath = path.join(DATA_DIR, `${tableName}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`${tableName}: arquivo nao encontrado, pulando`);
      results.skipped.push(tableName);
      continue;
    }

    const records = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!Array.isArray(records) || records.length === 0) {
      console.log(`${tableName}: sem registros, pulando`);
      results.skipped.push(tableName);
      continue;
    }

    console.log(`\n${tableName}: ${records.length} registros`);

    try {
      const result = await migrateTable(tableName, records);
      results.success.push({ table: tableName, ...result });
    } catch (err) {
      console.error(`  ERRO FATAL: ${err.message}`);
      results.failed.push({ table: tableName, error: err.message });
    }
  }

  // Resumo
  console.log('\n\n=== RESUMO ===');
  console.log(`Sucesso: ${results.success.length} tabelas`);
  results.success.forEach(s =>
    console.log(`  ${s.table}: ${s.inserted} inseridos, ${s.errors} erros`)
  );

  if (results.failed.length > 0) {
    console.log(`\nFalhas: ${results.failed.length} tabelas`);
    results.failed.forEach(f => console.log(`  ${f.table}: ${f.error}`));
  }

  if (results.skipped.length > 0) {
    console.log(`\nPuladas: ${results.skipped.join(', ')}`);
  }

  // Salva resultado
  fs.writeFileSync(
    path.join(DATA_DIR, '_data_migration_result.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(`\nResultado salvo em: ${path.join(DATA_DIR, '_data_migration_result.json')}`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
