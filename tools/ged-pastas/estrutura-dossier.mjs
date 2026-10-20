// Preenche documento.estrutura_ref (migr 178) — a secção de cada documento no dossier MOA ou PSA entregue à ANAC.
// Prioridade: referência AN/AP no nome do ficheiro original (planos de importação) → regras (estruturaDossier.js).
// Formulários/fichas: sempre MOA:AP.13 (regra do dono), excepto documentos do PSA.
//   node tools/ged-pastas/estrutura-dossier.mjs            (simulação + resumo)
//   node tools/ged-pastas/estrutura-dossier.mjs --apply    (grava; precisa da migração 178)
import fs from 'node:fs';
import path from 'node:path';
import { seccaoPorRegra, refDoNomeOriginal, refValida, nomeSeccao } from '../../src/documentos/estruturaDossier.js';

const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const B = 'http://127.0.0.1:3000';
const APPLY = process.argv.includes('--apply');

// nome original por número actual (os planos guardam o número da importação; os backups de renumeração traduzem)
const orig = new Map();
for (const f of fs.readdirSync('tools/ingest-ged').filter(x => /^plano.*\.json$/.test(x))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join('tools/ingest-ged', f), 'utf8')); } catch { continue; }
  for (const d of (Array.isArray(j) ? j : (j.documentos || []))) if (d.numero && d.principal_abs) orig.set(d.numero + '|' + (d.aeroporto_id || ''), d.principal_abs);
}
const renomes = new Map(); // id → número na importação
for (const b of ['tools/ged-nomes/backup-realinhamento-2026-10-15.json']) {
  if (fs.existsSync(b)) for (const m of JSON.parse(fs.readFileSync(b, 'utf8'))) renomes.set(m.id, m.de);
}
const docs = await (await fetch(B + '/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,numero,titulo,aeroporto_id,classe_codigo,processo_codigo,estrutura_ref&limit=5000', { headers: H })).json();

const res = []; const divergencias = [];
for (const d of docs) {
  const regra = seccaoPorRegra(d);
  const dossier = regra.split(':')[0];
  const p = orig.get((renomes.get(d.id) || d.numero) + '|' + d.aeroporto_id) || '';
  let refFich = refDoNomeOriginal(path.basename(p)) || refDoNomeOriginal(path.basename(path.dirname(p)));
  let final = regra, fonte = 'regra';
  // A estrutura canónica (regras) manda; a referência do ficheiro só decide quando a regra cai em «Outros».
  const caiEmOutros = regra === 'MOA:AP.15' || regra === 'PSA:AP.04';
  if (caiEmOutros && refFich && refValida(`${dossier}:${refFich}`) && d.processo_codigo !== 'PCA') { final = `${dossier}:${refFich}`; fonte = 'ficheiro'; }
  if (refFich && final !== regra) divergencias.push(`${String(d.numero || "(sem número)").padEnd(20)} ficheiro ${refFich.padEnd(6)} regra ${regra.padEnd(10)} → ${final}  ${d.titulo.slice(0, 40)}`);
  // réplicas já guardadas («casa;réplica;…») mantêm-se: a ferramenta só recalcula a casa
  const replicas = String(d.estrutura_ref || '').split(';').slice(1).map(x => x.trim()).filter(Boolean);
  res.push({ id: d.id, numero: d.numero, final, fonte, gravar: [final, ...replicas].join(';') });
}
const porSec = {}; for (const r of res) porSec[r.final] = (porSec[r.final] || 0) + 1;
console.log(`Documentos: ${res.length} · pelo ficheiro: ${res.filter(r => r.fonte === 'ficheiro').length} · pela regra: ${res.filter(r => r.fonte !== 'ficheiro').length}\n`);
for (const k of Object.keys(porSec).sort()) console.log(`  ${k.padEnd(10)} ${String(porSec[k]).padStart(4)}  ${nomeSeccao(k)}`);
console.log(`\nFicheiro diferente da regra (fica o do ficheiro): ${divergencias.length}`);
divergencias.slice(0, 40).forEach(x => console.log('  ' + x));

if (process.argv.includes('--outros')) { for (const r of res.filter(x => /AP.15|PSA:AP.04|AN.05/.test(x.final))) { const d = docs.find(y => y.id === r.id); console.log(`  ${r.final.padEnd(10)} ${String(r.numero || "(sem número)").padEnd(20)} ${d.titulo.slice(0, 55)}`); } }
if (!APPLY) { console.log('\nSIMULAÇÃO — correr com --apply depois da migração 178'); process.exit(0); }

let n = 0;
for (const r of res) {
  const resp = await fetch(B + `/documento?id=eq.${r.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ estrutura_ref: r.gravar }) });
  if (!resp.ok) throw new Error(`${r.numero}: ${resp.status} ${await resp.text()}`);
  n++;
}
console.log(`\nAPLICADO: ${n} documentos com estrutura_ref`);
