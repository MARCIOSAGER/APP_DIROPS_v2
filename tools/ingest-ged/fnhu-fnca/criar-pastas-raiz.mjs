// Cria as pastas-raiz de Huambo (FNHU) e Cabinda (FNCA) no GED, no mesmo formato das 4 existentes. Idempotente.
//   node tools/ingest-ged/fnhu-fnca/criar-pastas-raiz.mjs [--apply]
import fs from 'node:fs';
const PG = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const AEROS = [
  { id: '8f02727e-3eef-5bd5-a0d8-247dd2c6c70e', icao: 'FNHU', nome: 'FNHU — Aeroporto Albano Machado (Huambo)', cor: '#0891b2' },
  { id: 'c10c0ab9-e40b-5961-8af7-480b2ab6bea1', icao: 'FNCA', nome: 'FNCA — Aeroporto Maria Mambo Café (Cabinda)', cor: '#be185d' },
];
const apply = process.argv.includes('--apply');
for (const a of AEROS) {
  const r = await (await fetch(`${PG}/pasta?aeroporto_id=eq.${a.id}&pasta_pai_id=is.null&deleted_at=is.null&select=id,nome`, { headers: H })).json();
  if (r.length) { console.log(`${a.icao}: já existe «${r[0].nome}» (${r[0].id})`); continue; }
  if (!apply) { console.log(`${a.icao}: criaria «${a.nome}»`); continue; }
  const c = await fetch(`${PG}/pasta`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ nome: a.nome, cor: a.cor, ordem: 0, aeroporto_id: a.id }) });
  if (!c.ok) throw new Error(`${a.icao}: ${c.status} ${await c.text()}`);
  const [p] = await c.json();
  console.log(`${a.icao}: criada «${p.nome}» (${p.id})`);
}
