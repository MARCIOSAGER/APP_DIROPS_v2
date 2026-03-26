#!/usr/bin/env node
// ============================================================
// PASSO 1: Exportar todos os dados do Base44 para JSON
// ============================================================
// Uso: node scripts/01-export-base44.mjs
//
// Resultado: cria arquivos JSON em scripts/data/ (um por entidade)
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BASE44_API_KEY,
  BASE44_APP_ID,
  BASE44_API_URL,
  ENTITY_TABLE_MAP,
  SKIP_ENTITIES,
} from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

// Garante que o diretorio data/ existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function fetchEntity(entityName) {
  const url = `${BASE44_API_URL}/api/apps/${BASE44_APP_ID}/entities/${entityName}`;
  let allRows = [];
  const pageSize = 500;
  let skip = 0;

  while (true) {
    const res = await fetch(`${url}?limit=${pageSize}&skip=${skip}`, {
      headers: {
        'api_key': BASE44_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[${entityName}] HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.rows || data.results || data.data || []);

    if (!Array.isArray(rows) || rows.length === 0) break;

    allRows = allRows.concat(rows);
    const page = Math.floor(skip / pageSize) + 1;
    console.log(`  ${entityName}: pagina ${page} (${rows.length} registros, total ${allRows.length})`);

    if (rows.length < pageSize) break;
    skip += pageSize;
  }

  return allRows;
}

async function main() {
  console.log('=== EXPORTACAO BASE44 ===\n');

  if (!BASE44_API_KEY || !BASE44_APP_ID) {
    console.error('ERRO: Credenciais Base44 nao encontradas.');
    console.error('Copie scripts/.env.migration.example -> scripts/.env.migration e preencha.');
    process.exit(1);
  }

  const entities = Object.keys(ENTITY_TABLE_MAP).filter(e => !SKIP_ENTITIES.includes(e));
  const summary = { success: [], failed: [], skipped: SKIP_ENTITIES };

  // Exportar Users separadamente
  console.log('Exportando: User');
  try {
    const users = await fetchEntity('User');
    const filePath = path.join(DATA_DIR, 'users.json');
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
    console.log(`  -> ${users.length} usuarios salvos\n`);
    summary.success.push({ entity: 'User', count: users.length });
  } catch (err) {
    console.error(`  ERRO: ${err.message}\n`);
    summary.failed.push({ entity: 'User', error: err.message });
  }

  // Exportar cada entidade
  for (const entity of entities) {
    console.log(`Exportando: ${entity}`);
    try {
      const rows = await fetchEntity(entity);
      const filePath = path.join(DATA_DIR, `${ENTITY_TABLE_MAP[entity]}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
      console.log(`  -> ${rows.length} registros salvos\n`);
      summary.success.push({ entity, count: rows.length });
    } catch (err) {
      console.error(`  ERRO: ${err.message}\n`);
      summary.failed.push({ entity, error: err.message });
    }
  }

  // Resumo
  console.log('\n=== RESUMO ===');
  console.log(`Sucesso: ${summary.success.length} entidades`);
  summary.success.forEach(s => console.log(`  ${s.entity}: ${s.count} registros`));

  if (summary.failed.length > 0) {
    console.log(`\nFalhas: ${summary.failed.length} entidades`);
    summary.failed.forEach(f => console.log(`  ${f.entity}: ${f.error}`));
  }

  console.log(`\nIgnoradas: ${summary.skipped.join(', ')}`);
  console.log(`\nArquivos salvos em: ${DATA_DIR}`);

  // Salva resumo
  fs.writeFileSync(
    path.join(DATA_DIR, '_export_summary.json'),
    JSON.stringify(summary, null, 2)
  );
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
