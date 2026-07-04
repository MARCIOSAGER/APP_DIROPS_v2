#!/usr/bin/env node
// Import DEDUP-SAFE de voos do Base44 -> on-premise public.voo.
// id = UUID v5 determinístico do id Base44 (mesmo voo -> mesmo UUID) e
// Prefer resolution=ignore-duplicates (ON CONFLICT DO NOTHING). Voos já
// existentes são PULADOS; só entram voos novos. Mesma lógica do 03c.
//
// Uso: node scripts/import-voos-base44.mjs
import crypto from 'crypto';
import fs from 'fs';
import { BASE44_API_KEY, BASE44_APP_ID, BASE44_API_URL } from './config.mjs';

const SGA_EMPRESA_ID = '128bc692-3fae-4825-9c55-40565dbedcfb';
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // mesmo namespace do 03c
const PGRST = 'http://127.0.0.1:3000';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const hdr = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };

const BASE44_ID_RE = /^[0-9a-f]{24}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS_TO_REMOVE = ['__v', '_id', 'app_id', 'entity_type', 'row_id', 'is_sample',
  'createdAt', 'updatedAt', 'created_at', 'updated_at', 'created_by_id', 'user_id'];

function uuidV5(name) {
  const nsBytes = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(String(name), 'utf8')])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
function translateValue(v, field) {
  if (typeof v !== 'string') return v;
  if (v === '' && field && field.endsWith('_id')) return null;
  if (UUID_RE.test(v)) return v;
  if (BASE44_ID_RE.test(v)) return uuidV5(v);
  return v;
}
function cleanAndTranslate(record) {
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (FIELDS_TO_REMOVE.includes(k)) continue;
    if (v === null || v === undefined) { out[k] = v; continue; }
    out[k] = Array.isArray(v) ? v.map(x => translateValue(x, k)) : translateValue(v, k);
  }
  if (out.id && !UUID_RE.test(out.id)) delete out.id;
  if (!out.created_date) out.created_date = new Date().toISOString();
  if (!out.empresa_id) out.empresa_id = SGA_EMPRESA_ID;
  return out;
}

async function getVooColumns() {
  const r = await fetch(PGRST + '/', { headers: hdr });
  const spec = await r.json();
  const def = spec.definitions?.voo;
  return def?.properties ? new Set(Object.keys(def.properties)) : null;
}
async function fetchAllVoo() {
  let all = [], skip = 0;
  while (true) {
    const r = await fetch(`${BASE44_API_URL}/api/apps/${BASE44_APP_ID}/entities/Voo?limit=500&skip=${skip}`, { headers: { api_key: BASE44_API_KEY, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error('Voo HTTP ' + r.status + ': ' + (await r.text()).slice(0, 120));
    const d = await r.json(); const rows = Array.isArray(d) ? d : (d.rows || d.results || d.data || []);
    if (!rows.length) break;
    all = all.concat(rows);
    if (rows.length < 500) break;
    skip += 500;
    if (all.length > 100000) break;
  }
  return all;
}

async function main() {
  console.log('Buscando Voo no Base44...');
  const rows = await fetchAllVoo();
  console.log(`  ${rows.length} voos no Base44`);
  const cols = await getVooColumns();
  if (!cols) { console.error('Nao consegui obter colunas de voo via OpenAPI'); process.exit(1); }

  const mapped = rows.map(r => {
    const c = cleanAndTranslate(r);
    const filtered = {};
    for (const k of Object.keys(c)) if (cols.has(k)) filtered[k] = c[k];
    return filtered;
  }).filter(r => r.id);

  const BATCH = 200;
  let attempted = 0, ok = 0, errBatches = 0; const errSamples = [];
  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH);
    attempted += batch.length;
    const res = await fetch(PGRST + '/voo', {
      method: 'POST',
      headers: { ...hdr, Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(batch),
    });
    if (res.ok) ok += batch.length;
    else { errBatches++; const t = await res.text(); if (errSamples.length < 3) errSamples.push(t.slice(0, 200)); }
    process.stdout.write(`\r  processados ${attempted}/${mapped.length}`);
  }
  process.stdout.write('\n');
  console.log(`Enviados (ignore-dup, nao insere se id ja existe): ${ok}, lotes com erro: ${errBatches}`);
  if (errSamples.length) console.log('erros:', errSamples);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
