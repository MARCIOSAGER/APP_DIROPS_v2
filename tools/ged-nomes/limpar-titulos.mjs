#!/usr/bin/env node
// Limpa os títulos dos documentos do GED que vieram do nome do ficheiro PDF com a Ref MOA + código colados.
// Usa EXACTAMENTE a mesma regra do portal (src/documentos/nomeDocumento.js), para não haver duas verdades.
//   node tools/ged-nomes/limpar-titulos.mjs            → só mostra o que mudaria (pré-visualização)
//   node tools/ged-nomes/limpar-titulos.mjs --apply     → aplica (grava o título limpo; guarda o original em obs)
import fs from 'node:fs';
import { tituloLimpoDoc, tituloEstaSujo } from '../../src/documentos/nomeDocumento.js';

const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const HDR = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const APLICAR = process.argv.includes('--apply');

const docs = await (await fetch(`${PGRST}/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,numero,titulo&limit=5000`, { headers: HDR })).json();
const sujos = docs.filter(d => tituloEstaSujo(d) && tituloLimpoDoc(d) !== String(d.titulo || '').trim());

console.log(`Total de documentos: ${docs.length} · com título a limpar: ${sujos.length}\n`);
for (const d of sujos.slice(0, APLICAR ? 0 : 60)) {
  console.log(`  [${d.numero || '—'}]`);
  console.log(`   antes: ${d.titulo}`);
  console.log(`   novo : ${tituloLimpoDoc(d)}\n`);
}
if (!APLICAR) {
  if (sujos.length > 60) console.log(`… e mais ${sujos.length - 60}. Corra com --apply para aplicar a todos.`);
  console.log('\n(Pré-visualização apenas — nada foi gravado. Use --apply para aplicar.)');
  process.exit(0);
}

// backup dos originais antes de gravar (para poder reverter)
const bak = `C:/dirops/APP_DIROPS_v2/tools/ged-nomes/backup-titulos-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(bak, JSON.stringify(sujos.map(d => ({ id: d.id, numero: d.numero, titulo: d.titulo })), null, 2), 'utf8');
console.log(`Backup dos títulos originais: ${bak}\n`);

let ok = 0, falhou = 0;
for (const d of sujos) {
  const novo = tituloLimpoDoc(d);
  const r = await fetch(`${PGRST}/documento?id=eq.${d.id}`, {
    method: 'PATCH', headers: { ...HDR, Prefer: 'return=minimal' },
    body: JSON.stringify({ titulo: novo }),
  });
  if (r.ok) ok++; else { falhou++; console.error(`  FALHOU ${d.numero}: ${r.status} ${(await r.text()).slice(0, 120)}`); }
}
console.log(`\nAplicado: ${ok} título(s) limpo(s)${falhou ? `, ${falhou} falha(s)` : ''}.`);
