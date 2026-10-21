// Corrige os planos FNHU/FNCA gerados pelo plano.mjs: mantém o CÓDIGO DE CADA FICHEIRO (o plano.mjs renumerou em
// sequência porque não reconheceu «FR- FNHU-…» com espaço). Excepções documentadas:
//   processo SO  → MGSO (Lista MOR, segurança operacional)        processo OPS → PGRF (dispersão de aves)
//   Cabinda: códigos repetidos na origem — os formulários de OBSTÁCULOS passam ao número de Huambo (017 diário, 019 anual)
//   node tools/ingest-ged/fnhu-fnca/corrigir-plano.mjs   → reescreve plano-FNHU.json e plano-FNCA.json (guarda .orig)
import fs from 'node:fs';
const DIR = 'C:/dirops/APP_DIROPS_v2/tools/ingest-ged/';
const PROC = { SO: 'MGSO', OPS: 'PGRF' };
const sem = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const limparTitulo = (t) => t.replace(/^(FR|LT|POP|MA|PL|NRM)\s+(\d{3}\s+)?/, '').replace(/\s*[_ ]CABINDA(\s+\d+)?\s*$/i, '').replace(/\s+/g, ' ').trim();
for (const icao of ['FNHU', 'FNCA']) {
  const f = `${DIR}plano-${icao}.json`;
  if (!fs.existsSync(f + '.orig')) fs.copyFileSync(f, f + '.orig');
  const itens = JSON.parse(fs.readFileSync(f + '.orig', 'utf8'));
  for (const it of itens) {
    const m = it.ficheiro_principal.match(/^([A-Z]{2,4})-\s*FN[A-Z]{2}-([A-Z]+)-?(\d{3})/);
    if (!m) throw new Error('sem código: ' + it.ficheiro_principal);
    let [, classe, proc, seq] = m;
    proc = PROC[proc] || proc;
    const tituloNorm = sem(it.titulo).toLowerCase();
    if (icao === 'FNCA' && classe === 'FR' && /obstacul/.test(tituloNorm)) seq = /anual/.test(tituloNorm) ? '019' : '017';
    const numero = `${classe}-${icao}-${proc}-${seq}`;
    const titulo = limparTitulo(it.titulo);
    const hash = it.stored_principal.split('_')[0];
    const ext = it.stored_principal.split('.').pop();
    const base = sem(`${numero}-${titulo}`).replace(/[^A-Za-z0-9-]+/g, '');
    Object.assign(it, { numero, classe, processo: proc, titulo, stored_principal: `${hash}_${base}.${ext}` });
  }
  const rep = itens.map(i => i.numero).filter((n, k, a) => a.indexOf(n) !== k);
  if (rep.length) throw new Error(`${icao}: códigos repetidos ${rep.join(', ')}`);
  fs.writeFileSync(f, JSON.stringify(itens, null, 2));
  console.log(`== ${icao}: ${itens.length} documentos`);
  for (const i of itens) console.log(`  ${i.numero.padEnd(20)} ${i.titulo.slice(0, 70)}   ← ${i.ficheiro_principal.slice(0, 40)}`);
}
