#!/usr/bin/env node
// ============================================================
// Import Base44 "TreinamentoLicenca" -> on-premise public.licenca_conducao
// ============================================================
// Os nomes de campo diferem entre Base44 e a tabela on-premise, então mapeamos
// explicitamente (a migração genérica 03c filtra por nome de coluna e
// descartaria os campos renomeados). Idempotente: id = UUID v5 determinístico
// do id Base44 + Prefer resolution=ignore-duplicates.
//
// Uso: node scripts/import-treinamento-licenca.mjs
// ============================================================
import crypto from 'crypto';
import fs from 'fs';
import { BASE44_API_KEY, BASE44_APP_ID, BASE44_API_URL } from './config.mjs';

const SGA_EMPRESA_ID = '128bc692-3fae-4825-9c55-40565dbedcfb';
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // mesmo namespace da 03c
const POSTGREST_URL = 'http://127.0.0.1:3000';
const SERVICE_ROLE_KEY = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidV5(name) {
  const nsBytes = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const nameBytes = Buffer.from(String(name), 'utf8');
  const hash = crypto.createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
const nn = (v) => (v == null || v === '' ? null : v);

async function fetchAll(entity) {
  let all = [], skip = 0;
  while (true) {
    const res = await fetch(`${BASE44_API_URL}/api/apps/${BASE44_APP_ID}/entities/${entity}?limit=500&skip=${skip}`, {
      headers: { api_key: BASE44_API_KEY, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`${entity} HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.rows || data.results || data.data || []);
    if (!rows.length) break;
    all = all.concat(rows);
    if (rows.length < 500) break;
    skip += 500;
  }
  return all;
}

function mapRecord(r) {
  return {
    id: (typeof r.id === 'string' && UUID_RE.test(r.id)) ? r.id : uuidV5(r.id),
    numero_licenca: nn(r.numero_licenca),
    numero_passe: nn(r.numero_passe_acesso),
    nome_condutor: nn(r.nome_colaborador),
    entidade: nn(r.empresa),
    data_emissao: nn(r.data_emissao_licenca),
    data_validade: nn(r.data_validade),
    aeroporto: nn(r.aeroporto),
    categoria: nn(r.categoria_licenca),
    data_treinamento: nn(r.data_treinamento),
    instrutor: nn(r.instrutor),
    resultado: nn(r.resultado),
    status: nn(r.status_licenca),
    observacoes: nn(r.observacoes),
    empresa_id: SGA_EMPRESA_ID,
    created_date: r.created_date || new Date().toISOString(),
    updated_date: r.updated_date || r.created_date || new Date().toISOString(),
  };
}

async function main() {
  console.log('Buscando TreinamentoLicenca no Base44...');
  const rows = await fetchAll('TreinamentoLicenca');
  console.log(`  ${rows.length} registros`);
  const mapped = rows.map(mapRecord);
  console.log('  amostra mapeada:', JSON.stringify(mapped[0]));

  const BATCH = 100;
  let inserted = 0, errors = 0; const errSamples = [];
  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH);
    const res = await fetch(POSTGREST_URL + '/licenca_conducao', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) inserted += batch.length;
    else { errors += batch.length; const t = await res.text(); if (errSamples.length < 3) errSamples.push(t.slice(0, 250)); }
  }
  console.log(`\nInserido (ignore-dup): ${inserted}, erros: ${errors}`);
  if (errSamples.length) console.log('erros:', errSamples);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
