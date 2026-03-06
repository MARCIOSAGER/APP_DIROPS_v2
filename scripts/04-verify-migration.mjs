#!/usr/bin/env node
// ============================================================
// PASSO 4: Verificar se a migracao foi bem-sucedida
// ============================================================
// Uso: node scripts/04-verify-migration.mjs
//
// Compara contagem de registros entre JSON exportado e Supabase
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
} from './config.mjs';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERRO: Credenciais Supabase nao encontradas.');
  console.error('Copie scripts/.env.migration.example -> scripts/.env.migration e preencha.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function countTable(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}

async function main() {
  console.log('=== VERIFICACAO DA MIGRACAO ===\n');

  const skipTables = new Set(
    SKIP_ENTITIES.map(e => ENTITY_TABLE_MAP[e]).filter(Boolean)
  );

  let allOk = true;
  const report = [];

  // Verificar usuarios
  console.log('Tabela           | JSON  | Supabase | Status');
  console.log('-'.repeat(55));

  // Users
  const usersFile = path.join(DATA_DIR, 'users.json');
  if (fs.existsSync(usersFile)) {
    const jsonCount = JSON.parse(fs.readFileSync(usersFile, 'utf-8')).length;
    try {
      const dbCount = await countTable('users');
      const status = dbCount >= jsonCount ? 'OK' : 'FALTAM';
      if (status !== 'OK') allOk = false;
      const line = `users${' '.repeat(16 - 5)}| ${String(jsonCount).padEnd(6)}| ${String(dbCount).padEnd(9)}| ${status}`;
      console.log(line);
      report.push({ table: 'users', json: jsonCount, db: dbCount, status });
    } catch (err) {
      console.log(`users${' '.repeat(16 - 5)}| ${String(jsonCount).padEnd(6)}| ERRO${' '.repeat(5)}| ${err.message}`);
      allOk = false;
    }
  }

  // Verificar Auth
  try {
    const { data } = await supabase.auth.admin.listUsers();
    const authCount = data?.users?.length || 0;
    console.log(`auth.users${' '.repeat(16 - 10)}| -     | ${String(authCount).padEnd(9)}| INFO`);
  } catch {
    console.log(`auth.users${' '.repeat(16 - 10)}| -     | ERRO${' '.repeat(5)}| sem acesso admin`);
  }

  // Demais tabelas
  for (const [entity, tableName] of Object.entries(ENTITY_TABLE_MAP)) {
    if (skipTables.has(tableName)) continue;

    const filePath = path.join(DATA_DIR, `${tableName}.json`);
    if (!fs.existsSync(filePath)) continue;

    const jsonCount = JSON.parse(fs.readFileSync(filePath, 'utf-8')).length;
    if (jsonCount === 0) continue;

    try {
      const dbCount = await countTable(tableName);
      const status = dbCount >= jsonCount ? 'OK' : 'FALTAM';
      if (status !== 'OK') allOk = false;

      const name = tableName.slice(0, 16);
      const line = `${name}${' '.repeat(16 - name.length)}| ${String(jsonCount).padEnd(6)}| ${String(dbCount).padEnd(9)}| ${status}`;
      console.log(line);
      report.push({ table: tableName, json: jsonCount, db: dbCount, status });
    } catch (err) {
      const name = tableName.slice(0, 16);
      console.log(`${name}${' '.repeat(16 - name.length)}| ${String(jsonCount).padEnd(6)}| ERRO${' '.repeat(5)}| ${err.message}`);
      allOk = false;
    }
  }

  console.log('-'.repeat(55));
  console.log(allOk ? '\nMigracao verificada com sucesso!' : '\nATENCAO: Alguns registros podem estar faltando.');

  fs.writeFileSync(
    path.join(DATA_DIR, '_verification_report.json'),
    JSON.stringify(report, null, 2)
  );
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
