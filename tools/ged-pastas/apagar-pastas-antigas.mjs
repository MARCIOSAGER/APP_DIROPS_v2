#!/usr/bin/env node
// Apaga (soft-delete) as pastas ANTIGAS do GED — a árvore AN/AP que foi substituída pelas 4 pastas por aeroporto.
// Só apaga pastas VAZIAS (sem documentos activos lá dentro) e que NÃO sejam uma das 4 novas. É reversível
// (deleted_at), e o script recusa-se a apagar qualquer pasta que ainda tenha documentos.
//   node tools/ged-pastas/apagar-pastas-antigas.mjs            → mostra o que apagaria
//   node tools/ged-pastas/apagar-pastas-antigas.mjs --apply     → aplica
import fs from 'node:fs';
const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const HDR = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const APLICAR = process.argv.includes('--apply');

// as 4 pastas novas por aeroporto (a PRESERVAR)
const NOVAS = new Set([
  'd3171d67-1839-4701-8be0-6f8ce4b6406c', // FNLU
  '270269b5-340b-4cfa-bb2f-a4eb186a4969', // FNCT
  '0dfb82d8-4b0f-4919-a7b1-22feb66547a9', // FNUB
  'da5f2c22-8fba-496c-9fed-10ba2ac1e0c1', // FNMO
]);

const get = async p => { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };
const patch = async (id, b) => { const r = await fetch(PGRST + '/pasta?id=eq.' + id, { method: 'PATCH', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error('patch ' + id + ' ' + r.status + ' ' + await r.text()); };

const pastas = await get('/pasta?deleted_at=is.null&select=id,nome');
const docs = await get('/documento?voo_ligado_id=is.null&deleted_at=is.null&select=pasta_id&limit=5000');
const comDocs = new Set(docs.map(d => d.pasta_id).filter(Boolean));

const apagar = pastas.filter(p => !NOVAS.has(p.id) && !comDocs.has(p.id));
const comConteudo = pastas.filter(p => !NOVAS.has(p.id) && comDocs.has(p.id));

console.log(`Pastas antigas vazias a apagar: ${apagar.length}`);
for (const p of apagar) console.log('  ' + p.nome);
if (comConteudo.length) { console.log(`\nAINDA com documentos (NÃO apago): ${comConteudo.length}`); for (const p of comConteudo) console.log('  ' + p.nome); }
if (!APLICAR) { console.log('\n(preview; use --apply)'); process.exit(0); }
for (const p of apagar) await patch(p.id, { deleted_at: new Date().toISOString() });
console.log(`\nApagadas (soft-delete): ${apagar.length}. Reversível pondo deleted_at a null.`);
