#!/usr/bin/env node
// Backfill do BD_Facturacao_Trafego_PP.txt (Windows-1252) -> tabela facturacao_trafego_pp.
// Dedup por row_hash (linha inteira). Insere via PostgREST com on_conflict=row_hash.
// Uso: node scripts/backfill-facturacao-pp.mjs
import fs from 'fs';
import crypto from 'crypto';

const TXT = 'c:/dirops/APP_DIROPS_v2/docs/BD_Facturacao_Trafego_PP.txt';
const PGRST = 'http://127.0.0.1:3000';
const SRK = fs.readFileSync('c:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf-8').trim();
const HDR = {
  'Authorization': `Bearer ${SRK}`,
  'apikey': SRK,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=ignore-duplicates,return=minimal',
};

// "76,95" -> 76.95 ; "939.36" -> 939.36 ; "1.234,56" -> 1234.56 ; "" -> null
function num(s) {
  s = (s || '').trim();
  if (!s) return null;
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const COLS = [
  'num_movimento','data_movimento','status','cod_cliente','nome_cliente','num_nota_preco',
  'data_nota_preco','num_factura','data_factura','valor_total','divisa','cambio','valor_total_akz',
  'servico','descricao','valor_linha','valor_linha_akz','diario_ctb','num_reg_ctb','diario_banco',
  'num_reg_banco','data_pagamento','cod_banco','nome_banco','num_doc_banco','divisa_banco','utilizador_criacao',
];
const NUM_IDX = new Set([9, 11, 12, 15, 16]);

function toRow(fields) {
  const raw = fields.slice(0, 27);
  while (raw.length < 27) raw.push('');
  const row = {};
  COLS.forEach((c, i) => { row[c] = NUM_IDX.has(i) ? num(raw[i]) : (raw[i]?.trim() || null); });
  row.row_hash = crypto.createHash('sha256').update(raw.join('\t'), 'utf8').digest('hex');
  row.upload_date = null;            // histórico — sem data de upload
  row.uploaded_by = 'backfill';
  row.source_file = 'BD_Facturacao_Trafego_PP.txt';
  return row;
}

async function postBatch(rows) {
  const res = await fetch(`${PGRST}/facturacao_trafego_pp?on_conflict=row_hash`, {
    method: 'POST', headers: HDR, body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function main() {
  console.log('=== BACKFILL Facturação Tráfego PP ===');
  const content = fs.readFileSync(TXT, 'latin1');
  const lines = content.split(/\r?\n/);
  // linha 0 = título, linha 1 = cabeçalho
  const dataLines = lines.slice(2).filter(l => l.trim().length > 0);
  console.log(`Linhas de dados: ${dataLines.length}`);

  const seen = new Set();
  const rows = [];
  for (const line of dataLines) {
    const r = toRow(line.split('\t'));
    if (seen.has(r.row_hash)) continue;   // dedup local (linhas idênticas)
    seen.add(r.row_hash);
    rows.push(r);
  }
  console.log(`Após dedup por hash: ${rows.length} (removidas ${dataLines.length - rows.length} idênticas)`);

  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await postBatch(rows.slice(i, i + BATCH));
    done += Math.min(BATCH, rows.length - i);
    if (done % 5000 === 0 || done === rows.length) console.log(`  inseridas ${done}/${rows.length}`);
  }
  console.log('OK. Backfill concluído.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
