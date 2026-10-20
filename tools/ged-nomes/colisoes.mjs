#!/usr/bin/env node
// Varredura de colisões de código no GED. Dois casos:
//   • MESMO documento carregado 2–3x (ou pdf+xlsx/docx): mantém um (prefere .pdf; empate → o mais antigo) e
//     faz soft-delete aos restantes.
//   • Documentos DIFERENTES com o mesmo número: mantém o mais antigo e renumera o(s) outro(s) para o próximo
//     número livre da classe-aeroporto-processo (RPC documento_numero_seguinte).
//   node tools/ged-nomes/colisoes.mjs            → pré-visualização
//   node tools/ged-nomes/colisoes.mjs --apply     → aplica (soft-delete + renumerações); faz backup JSON antes
import fs from 'node:fs';

const PGRST = 'http://127.0.0.1:3000';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const HDR = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
const APLICAR = process.argv.includes('--apply');

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const ext = (d) => (String(d.arquivo_privado_uri || d.arquivo_url || '').match(/\.([a-z0-9]{2,5})$/i)?.[1] || '').toLowerCase();
const partes = (n) => { const p = String(n).split('-'); return { classe: p[0], aero: p[1], processo: p[2] }; };
const mesmoDoc = (a, b) => { const x = norm(a), y = norm(b); return x === y || (x.length >= 12 && y.length >= 12 && (x.startsWith(y) || y.startsWith(x))); };

async function get(p) { const r = await fetch(PGRST + p, { headers: HDR }); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); }
async function rpc(fn, body) { const r = await fetch(`${PGRST}/rpc/${fn}`, { method: 'POST', headers: HDR, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`rpc ${fn} → ${r.status} ${await r.text()}`); return r.json(); }
async function patch(id, body) { const r = await fetch(`${PGRST}/documento?id=eq.${id}`, { method: 'PATCH', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`patch ${id} → ${r.status} ${await r.text()}`); }

const docs = await get('/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,numero,titulo,created_date,arquivo_privado_uri,arquivo_url,estado&limit=5000');
const porNumero = new Map();
for (const d of docs) { if (!porNumero.has(d.numero)) porNumero.set(d.numero, []); porNumero.get(d.numero).push(d); }

const accoes = []; // {tipo:'manter'|'apagar'|'renumerar', ...}
for (const [numero, grupo] of porNumero) {
  if (grupo.length < 2) continue;
  grupo.sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)));
  // separa em sub-grupos de "mesmo documento"
  const clusters = [];
  for (const d of grupo) {
    let c = clusters.find(cl => mesmoDoc(cl[0].titulo, d.titulo));
    if (c) c.push(d); else clusters.push([d]);
  }
  // dentro de cada cluster (mesmo doc): manter 1 (prefere pdf, senão mais antigo), apagar o resto
  const mantidosPorCluster = clusters.map(cl => {
    const pdf = cl.find(x => ext(x) === 'pdf');
    const manter = pdf || cl[0];
    for (const x of cl) if (x.id !== manter.id) accoes.push({ tipo: 'apagar', numero, id: x.id, titulo: x.titulo, motivo: `duplicado de ${manter.id} (${ext(x) || '?'})` });
    return manter;
  });
  // se há mais do que um cluster (documentos diferentes), o 1.º fica com o número; os outros renumeram
  for (let i = 1; i < mantidosPorCluster.length; i++) {
    const d = mantidosPorCluster[i];
    const { classe, aero, processo } = partes(numero);
    accoes.push({ tipo: 'renumerar', numeroAntigo: numero, id: d.id, titulo: d.titulo, classe, aero, processo });
  }
}

const apagar = accoes.filter(a => a.tipo === 'apagar');
const renum = accoes.filter(a => a.tipo === 'renumerar');
console.log(`Colisões: ${[...porNumero.values()].filter(g => g.length > 1).length} número(s).`);
console.log(`→ soft-delete (duplicados do mesmo doc): ${apagar.length}`);
console.log(`→ renumerar (documentos diferentes): ${renum.length}\n`);
for (const a of apagar) console.log(`  apagar  [${a.numero}] ${a.titulo}  — ${a.motivo}`);
console.log('');
for (const a of renum) console.log(`  renumerar [${a.numeroAntigo}] ${a.titulo}  → próximo livre de ${a.classe}-${a.aero}-${a.processo}`);

if (!APLICAR) { console.log('\n(Pré-visualização apenas — nada gravado. Use --apply.)'); process.exit(0); }

const bak = `C:/dirops/APP_DIROPS_v2/tools/ged-nomes/backup-colisoes-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(bak, JSON.stringify(accoes, null, 2), 'utf8');
console.log(`\nBackup do plano: ${bak}\n`);

for (const a of apagar) { await patch(a.id, { deleted_at: new Date().toISOString(), deleted_by: `varredura colisões (${a.motivo})` }); }
console.log(`Soft-delete aplicado: ${apagar.length}`);
for (const a of renum) {
  const novo = await rpc('documento_numero_seguinte', { p_classe: a.classe, p_aeroporto: a.aero, p_processo: a.processo });
  const numeroNovo = typeof novo === 'string' ? novo : (Array.isArray(novo) ? novo[0] : novo);
  await patch(a.id, { numero: numeroNovo });
  console.log(`  ${a.numeroAntigo} → ${numeroNovo}  (${a.titulo})`);
}
console.log('\nConcluído.');
