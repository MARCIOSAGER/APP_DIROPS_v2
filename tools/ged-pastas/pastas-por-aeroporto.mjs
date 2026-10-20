#!/usr/bin/env node
// Cria uma pasta-raiz por aeroporto (FNLU/FNCT/FNUB/FNMO) e move cada documento para a pasta do seu aeroporto.
// A organização fina é pela codificação (manual/classe) e pela Lista Mestre; a pasta é só navegação por aeroporto.
// A parede AVSEC é por documento (migr 173), por isso mover entre pastas não altera a segurança.
//   node tools/ged-pastas/pastas-por-aeroporto.mjs            → pré-visualização
//   node tools/ged-pastas/pastas-por-aeroporto.mjs --apply     → cria pastas + move docs (backup JSON antes)
import fs from 'node:fs';

const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const HDR = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const APLICAR = process.argv.includes('--apply');

// os 4 aeroportos alvo (id do documentos_aeroporto) + nome da pasta + cor
const AEROS = [
  { id: '7b031fd6-0388-5a61-a8d4-5250ff932a3f', icao: 'FNLU', nome: 'FNLU — Aeroporto 4 de Fevereiro (Luanda)', cor: '#2563eb' },
  { id: '2f1c676c-7ed8-529b-9c11-af691197511e', icao: 'FNCT', nome: 'FNCT — Aeroporto da Catumbela', cor: '#16a34a' },
  { id: '39646957-c5bc-5c55-b5b6-6d52f63a4981', icao: 'FNUB', nome: 'FNUB — Aeroporto da Mukanka (Lubango)', cor: '#ea580c' },
  { id: 'f60f0524-241e-5d70-a845-04775b4067f3', icao: 'FNMO', nome: 'FNMO — Aeroporto Welwitschia Mirabilis (Namibe)', cor: '#7c3aed' },
];

async function get(p) { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); }
async function post(t, body) { const r = await fetch(`${PGRST}/${t}`, { method: 'POST', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`post ${t} → ${r.status} ${await r.text()}`); return (await r.json())[0]; }
async function patch(id, body) { const r = await fetch(`${PGRST}/documento?id=eq.${id}`, { method: 'PATCH', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`patch ${id} → ${r.status} ${await r.text()}`); }

const docs = await get('/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,numero,aeroporto_id,pasta_id&limit=5000');
const porAero = new Map(AEROS.map(a => [a.id, docs.filter(d => d.aeroporto_id === a.id)]));
const semAero = docs.filter(d => !AEROS.some(a => a.id === d.aeroporto_id));

console.log('Pastas-raiz a criar e documentos a mover:');
for (const a of AEROS) console.log(`  ${a.icao}: ${porAero.get(a.id).length} documento(s) → pasta "${a.nome}"`);
console.log(`  (documentos de outros aeroportos / sem aeroporto, NÃO mexidos: ${semAero.length})`);

if (!APLICAR) { console.log('\n(Pré-visualização apenas — nada gravado. Use --apply.)'); process.exit(0); }

// backup do pasta_id antigo de cada doc que vai mover
const mover = AEROS.flatMap(a => porAero.get(a.id));
const bak = `C:/dirops/APP_DIROPS_v2/tools/ged-pastas/backup-pastas-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(bak, JSON.stringify(mover.map(d => ({ id: d.id, pasta_id_antiga: d.pasta_id })), null, 2), 'utf8');
console.log(`\nBackup do pasta_id antigo: ${bak}\n`);

for (const a of AEROS) {
  // idempotente: reutiliza a pasta-raiz limpa se já existir (pelo nome), senão cria
  const existentes = await get(`/pasta?pasta_pai_id=is.null&deleted_at=is.null&aeroporto_id=eq.${a.id}&nome=eq.${encodeURIComponent(a.nome)}&select=id&limit=1`);
  let pastaId = existentes[0]?.id;
  if (!pastaId) {
    const nova = await post('pasta', { nome: a.nome, aeroporto_id: a.id, cor: a.cor, ordem: 0, nivel_acesso: [], herdar_permissoes: true, pasta_pai_id: null, protegida_senha: false });
    pastaId = nova.id;
    console.log(`  criada pasta ${a.icao} (${pastaId})`);
  } else console.log(`  pasta ${a.icao} já existia (${pastaId})`);
  let n = 0;
  for (const d of porAero.get(a.id)) { await patch(d.id, { pasta_id: pastaId }); n++; }
  console.log(`    ${n} documento(s) movido(s) para ${a.icao}`);
}
console.log('\nConcluído. As pastas antigas ficam vazias — apague-as quando quiser (script à parte).');
