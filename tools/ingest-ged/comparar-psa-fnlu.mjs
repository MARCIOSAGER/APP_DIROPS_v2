// Compara a pasta entregue «01-PSA» do FNLU com o que já está no GED: por conteúdo (SHA-256) e por número.
//   node tools/ingest-ged/comparar-psa-fnlu.mjs [pasta]   → escreve tools/ingest-ged/comparacao-PSA-FNLU.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = process.argv[2] || 'C:/Users/dirops/Downloads/01-PSA';
const ST = 'C:/dirops/sga-onpremise/storage/private-uploads/';
const FNLU = '7b031fd6-0388-5a61-a8d4-5250ff932a3f';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC };
const get = async (p) => { const r = await fetch('http://127.0.0.1:3000' + p, { headers: H }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? andar(path.join(d, e.name)) : [path.join(d, e.name)]);

const docs = await get(`/documento?aeroporto_id=eq.${FNLU}&select=id,numero,titulo,estado,deleted_at,pasta_id,classe_codigo,processo_codigo&limit=5000`);
const vers = [];
for (let i = 0; i < docs.length; i += 150) {
  const ids = docs.slice(i, i + 150).map(d => d.id).join(',');
  vers.push(...await get(`/documento_versao?documento_id=in.(${ids})&select=documento_id,versao,estado,arquivo_uri,sha256`));
}
const porHash = new Map();
for (const v of vers) {
  let h = v.sha256;
  if (!h && v.arquivo_uri && fs.existsSync(ST + v.arquivo_uri)) h = sha(ST + v.arquivo_uri);
  if (!h) continue;
  const d = docs.find(x => x.id === v.documento_id);
  if (!porHash.has(h)) porHash.set(h, []);
  porHash.get(h).push({ numero: d.numero, versao: v.versao, estado: v.estado, apagado: !!d.deleted_at, titulo: d.titulo });
}
const porNumero = new Map(docs.filter(d => !d.deleted_at).map(d => [d.numero, d]));

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const res = [];
for (const f of andar(RAIZ)) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
  const nome = norm(path.basename(f));
  const m = nome.match(/\b([A-Z]{2,4})-(F[LN][NL]U)-([A-Z]{2,6})-(\d{3,4})\b/);
  const numero = m ? `${m[1]}-FNLU-${m[3]}-${m[4].slice(-3)}` : null;
  const ref = (nome.match(/^(A[NP]\.\d{2}(?:\.\d{3})?)/) || [])[1] || null;
  const h = sha(f);
  const iguais = porHash.get(h) || [];
  const doNumero = numero ? porNumero.get(numero) : null;
  res.push({ rel, ext: path.extname(f).slice(1).toLowerCase(), ref, numero, sha: h, tamanho: fs.statSync(f).size,
    iguais, gedNumero: doNumero ? { numero: doNumero.numero, titulo: doNumero.titulo, estado: doNumero.estado } : null });
}
fs.writeFileSync('tools/ingest-ged/comparacao-PSA-FNLU.json', JSON.stringify(res, null, 2));
const vivo = (r) => r.iguais.some(x => !x.apagado);
console.log(`ficheiros: ${res.length}`);
console.log(`  já no GED (mesmo ficheiro, documento activo): ${res.filter(vivo).length}`);
console.log(`  só em documentos apagados: ${res.filter(r => !vivo(r) && r.iguais.length).length}`);
console.log(`  ficheiro novo, mas o número já existe no GED: ${res.filter(r => !r.iguais.length && r.gedNumero).length}`);
console.log(`  ficheiro novo e número inexistente: ${res.filter(r => !r.iguais.length && !r.gedNumero).length}`);
console.log('\n— ficheiro novo, número já existe (o GED tem outro ficheiro):');
for (const r of res.filter(r => !r.iguais.length && r.gedNumero)) console.log(`  ${r.numero.padEnd(18)} ${r.ext.padEnd(4)} GED: «${r.gedNumero.titulo.slice(0, 45)}» ← ${path.basename(r.rel).slice(0, 70)}`);
console.log('\n— novos (número não existe):');
for (const r of res.filter(r => !r.iguais.length && !r.gedNumero)) console.log(`  ${String(r.numero).padEnd(18)} ${r.ext.padEnd(4)} ${r.rel.slice(0, 110)}`);
console.log('\n— só em apagados:');
for (const r of res.filter(r => !vivo(r) && r.iguais.length)) console.log(`  ${String(r.numero).padEnd(18)} → ${r.iguais.map(x => x.numero + ' v' + x.versao).join(', ')}`);
console.log('\n— já no GED com OUTRO número:');
for (const r of res.filter(vivo)) { const a = r.iguais.filter(x => !x.apagado); if (r.numero && !a.some(x => x.numero === r.numero)) console.log(`  ficheiro diz ${String(r.numero).padEnd(18)} GED: ${a.map(x => `${x.numero} v${x.versao} ${x.estado}`).join(', ')}`); }
