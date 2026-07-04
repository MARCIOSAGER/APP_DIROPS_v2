#!/usr/bin/env node
// Migra as fotos (evidencias_fotograficas) das ocorrencias de Safety que ainda
// apontam para o Base44 (https://base44.app/...) para o storage on-premise.
// Idempotente: a key no storage e um hash da URL de origem, e a URL final e
// relativa (/storage/v1/object/public/uploads/safety/<hash>.<ext>) — funciona
// em qualquer host onde o app for servido e evita CORS (mesma origem no PDF).
//
// Uso: node scripts/migrate-safety-photos.mjs
import fs from 'fs';
import crypto from 'crypto';
import { BASE44_API_KEY } from './config.mjs';

const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const PGRST = 'http://127.0.0.1:3000';
const FUNCS = 'http://127.0.0.1:4001';
const jsonHdr = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };

const extFromUrl = (u) => { const m = u.match(/\.(jpe?g|png|gif|webp)(\?|$)/i); return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'; };
const ct = (e) => ({ png: 'image/png', gif: 'image/gif', webp: 'image/webp', jpg: 'image/jpeg' }[e] || 'image/jpeg');

async function migrateUrl(u) {
  const ext = extFromUrl(u);
  const key = 'safety/' + crypto.createHash('sha1').update(u).digest('hex').slice(0, 20) + '.' + ext;
  const res = await fetch(u, { headers: { api_key: BASE44_API_KEY } });
  if (!res.ok) throw new Error('download HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const up = await fetch(FUNCS + '/storage/object/uploads/' + key, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SERVICE, 'Content-Type': ct(ext) },
    body: buf,
  });
  if (!up.ok) throw new Error('upload HTTP ' + up.status + ' ' + (await up.text()).slice(0, 120));
  return '/storage/v1/object/public/uploads/' + key;
}

async function main() {
  const res = await fetch(PGRST + '/ocorrencia_safety?select=id,evidencias_fotograficas', { headers: jsonHdr });
  const rows = await res.json();
  let rowsChanged = 0, photos = 0, errs = 0;
  for (const row of rows) {
    const arr = Array.isArray(row.evidencias_fotograficas) ? row.evidencias_fotograficas : [];
    if (!arr.length) continue;
    let touched = false;
    const nw = [];
    for (const u of arr) {
      if (typeof u === 'string' && u.includes('base44.app')) {
        try { nw.push(await migrateUrl(u)); touched = true; photos++; }
        catch (e) { console.log('  ERRO', row.id, e.message); nw.push(u); errs++; }
      } else if (u) { nw.push(u); }
    }
    if (touched) {
      const p = await fetch(PGRST + '/ocorrencia_safety?id=eq.' + row.id, {
        method: 'PATCH', headers: { ...jsonHdr, Prefer: 'return=minimal' },
        body: JSON.stringify({ evidencias_fotograficas: nw }),
      });
      if (p.ok) rowsChanged++; else console.log('  PATCH falhou', row.id, await p.text());
    }
  }
  console.log(`\nOcorrencias atualizadas: ${rowsChanged}, fotos migradas: ${photos}, erros: ${errs}`);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
