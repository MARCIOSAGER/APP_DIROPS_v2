// Importa a pasta entregue «01-PSA» do FNLU para a área AVSEC do GED (a partir de comparacao-PSA-FNLU.json).
//   node tools/ingest-ged/psa-fnlu.mjs plano      → escreve plano-PSA-FNLU.json + copiar-psa-fnlu.ps1 (simulação)
//   (correr o .ps1 no PowerShell: copia os ficheiros para o storage privado)
//   node tools/ingest-ged/psa-fnlu.mjs aplicar    → grava no GED (backup antes) e corre depois pastas-setor-classe --apply
// Regras:
//   · ficheiro igual a um documento activo → nada (salvo MP-FNLU-MOA-001/002, que são os anexos PT-FNLU-PCA-001/002 do PCA
//     e estavam por engano no MOA: renumerados e passados para o PCA/AVSEC);
//   · ficheiro igual a um documento apagado (o dono apagou-os a 06/10 porque estavam fora da área AVSEC) → recupera-o;
//   · .docx de um número que já existe → fonte editável desse documento;
//   · o resto → documento novo. Anexos do PCA são classificados 3.e (planos de contingência) para ficarem atrás da
//     parede AVSEC, porque o manual PCA pertence ao setor Resposta à Emergência.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MODO = process.argv[2] || 'plano';
const RAIZ = 'C:/Users/dirops/Downloads/01-PSA';
const DIR = 'C:/dirops/APP_DIROPS_v2/tools/ingest-ged/';
const FNLU = '7b031fd6-0388-5a61-a8d4-5250ff932a3f';
const PASTA_AVSEC = 'ec6974bf-e4b1-4914-b623-649e8ec9733f';
const SVC = fs.readFileSync('C:/dirops/sga-onpremise/secrets/service_role_key.txt', 'utf8').trim();
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const req = async (m, p, body) => { const r = await fetch('http://127.0.0.1:3000' + p, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p}: ${r.status} ${t}`); return t ? JSON.parse(t) : null; };

const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const ascii = (s) => semAcento(s).replace(/[^A-Za-z0-9.-]+/g, '');

// número corrigido: FLNU→FNLU, 0011→011, AVSE→AVSEC, TR-…-PFT-001 (classe inexistente) → PL como os irmãos
function numeroDe(nomeFich) {
  const n = semAcento(nomeFich);
  const m = n.match(/\b([A-Z]{2,4})-(F[LN][NL]U)-([A-Z]{2,6})-(\d{3,4})\b/);
  if (!m) return null;
  let [, classe, , proc, seq] = m;
  if (proc === 'AVSE') proc = 'AVSEC';
  // TR = Treinamento (classe criada a 19/10 a pedido do dono)
  return { numero: `${classe}-FNLU-${proc}-${seq.slice(-3)}`, classe, processo: proc };
}
function tituloDe(nomeFich) {
  let t = nomeFich.replace(/\.[a-z]+$/i, '');
  t = t.includes('#') ? t.split('#').slice(1).join('#') : t.replace(/^.*?\b[A-Z]{2,4}-F[LN][NL]U-[A-Z]{2,6}-\d{3,4}\b[\s-]*/, '');
  return t.replace(/_/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-–]+|[\s\-–]+$/g, '').trim();
}
// secção do dossier PSA a partir da pasta entregue
function seccaoDe(rel, numero) {
  if (/Lista Mestre/i.test(rel) || /^PR-FNLU-PSA-001\b/.test(path.basename(rel))) return 'PSA:01';
  const an = rel.match(/^AN\.Anexos\/AN\.(0\d)/); if (an) return `PSA:AN.${an[1]}`;
  if (/^AN\.Anexos\/AN\.02\./.test(rel)) return 'PSA:AN.02';
  const ap = rel.match(/^AP\.Apendice\/AP\.(0\d)/); if (ap) return `PSA:AP.${ap[1]}`;
  return null;
}

const comp = JSON.parse(fs.readFileSync(DIR + 'comparacao-PSA-FNLU.json', 'utf8'));
const hashCurto = (sha) => sha.slice(0, 9);

if (MODO === 'plano') {
  const acoes = [];
  const vistos = new Set();
  for (const r of comp) {
    const nome = path.basename(r.rel);
    const info = numeroDe(nome) || {};
    const activos = r.iguais.filter(x => !x.apagado);
    const apagados = r.iguais.filter(x => x.apagado);
    const base = { rel: r.rel, abs: path.join(RAIZ, r.rel), sha: r.sha, ext: r.ext, tamanho: r.tamanho, estrutura_ref: seccaoDe(r.rel, info.numero), data: fs.statSync(path.join(RAIZ, r.rel)).mtime.toISOString().slice(0, 10) };
    if (activos.some(x => /^MP-FNLU-MOA-00[12]$/.test(x.numero))) {
      const de = activos.find(x => /^MP-FNLU-MOA-00[12]$/.test(x.numero)).numero;
      acoes.push({ ...base, accao: 'renumerar-para-pca', de, numero: info.numero, classe: info.classe, processo: info.processo, titulo: tituloDe(nome) });
      continue;
    }
    if (activos.length) { acoes.push({ ...base, accao: 'ja-existe', numero: activos[0].numero }); continue; }
    if (apagados.length) { acoes.push({ ...base, accao: 'recuperar', numero: apagados[0].numero }); continue; }
    if (!info.numero) { acoes.push({ ...base, accao: 'sem-numero' }); continue; }
    if (r.gedNumero && r.ext === 'docx') { acoes.push({ ...base, accao: 'fonte-editavel', numero: info.numero }); continue; }
    if (/Lista Mestre/i.test(nome)) { acoes.push({ ...base, accao: 'novo', numero: 'LT-FNLU-PSA-006', classe: 'LT', processo: 'PSA', titulo: 'Lista Mestre de Documentos PSA (rev.00)', nota: 'O ficheiro diz LT-FNLU-PSA-001, número já usado pela Lista de POP; levou o próximo livre.' }); continue; }
    if (/PFTSAC\.pdf$/.test(nome)) { acoes.push({ ...base, accao: 'versao-antiga', numero: info.numero, nota: 'Versão de 10/06 do PFTSAC; a Rev.00 de 12/06 é a que fica em vigor.' }); continue; }
    if (vistos.has(info.numero)) { acoes.push({ ...base, accao: 'fonte-editavel', numero: info.numero }); continue; }
    vistos.add(info.numero);
    acoes.push({ ...base, accao: 'novo', numero: info.numero, classe: info.classe, processo: info.processo, titulo: tituloDe(nome) });
  }
  for (const a of acoes) if (['novo', 'fonte-editavel', 'versao-antiga', 'renumerar-para-pca'].includes(a.accao) && a.accao !== 'renumerar-para-pca')
    a.stored = `${hashCurto(a.sha)}_${a.numero}-${ascii(a.titulo || path.basename(a.rel)).slice(0, 60)}${a.accao === 'fonte-editavel' ? 'fonte' : ''}.${a.ext}`;
  fs.writeFileSync(DIR + 'plano-PSA-FNLU.json', JSON.stringify(acoes, null, 2));
  const ps = ['$ErrorActionPreference = "Stop"', '$d = "C:\\dirops\\sga-onpremise\\storage\\private-uploads\\"', '$n = 0'];
  for (const a of acoes.filter(x => x.stored)) ps.push(`if (-not (Test-Path ($d + '${a.stored}'))) { Copy-Item -LiteralPath '${a.abs.replace(/\//g, '\\').replace(/'/g, "''")}' -Destination ($d + '${a.stored}'); $n++ }`);
  ps.push('Write-Output "Copiados: $n"');
  fs.writeFileSync(DIR + 'copiar-psa-fnlu.ps1', '\ufeff' + ps.join('\r\n'), 'utf8');
  const cont = {}; for (const a of acoes) cont[a.accao] = (cont[a.accao] || 0) + 1;
  console.log(cont);
  for (const a of acoes.filter(x => x.accao !== 'ja-existe')) console.log(`${a.accao.padEnd(19)} ${String(a.numero).padEnd(18)} ${String(a.estrutura_ref).padEnd(10)} ${a.ext.padEnd(4)} ${a.titulo || ''}${a.de ? ' (era ' + a.de + ')' : ''}${a.nota ? '  — ' + a.nota : ''}`);
  process.exit(0);
}

// ── aplicar ──
const acoes = JSON.parse(fs.readFileSync(DIR + 'plano-PSA-FNLU.json', 'utf8'));
for (const a of acoes.filter(x => x.stored)) if (!fs.existsSync('C:/dirops/sga-onpremise/storage/private-uploads/' + a.stored)) throw new Error('falta copiar: ' + a.stored + ' (correr copiar-psa-fnlu.ps1)');
const docsFNLU = await req('GET', `/documento?aeroporto_id=eq.${FNLU}&select=id,numero,titulo,deleted_at,deleted_by,pasta_id,classe_codigo,processo_codigo,estrutura_ref,classificacao_categoria,classificado,versao_atual&limit=5000`);
if (!fs.existsSync(DIR + 'backup-psa-fnlu-2026-10-19.json')) fs.writeFileSync(DIR + 'backup-psa-fnlu-2026-10-19.json', JSON.stringify(docsFNLU, null, 2));
const activo = (n) => docsFNLU.find(d => d.numero === n && !d.deleted_at);
const classes = await req('GET', '/documento_classe?select=codigo,tipo_codigo');
const tipos = await req('GET', '/documento_tipo?select=codigo,id');
const tipoId = (c) => { const tc = classes.find(x => x.codigo === c)?.tipo_codigo; return tipos.find(t => t.codigo === tc)?.id || tipos.find(t => t.codigo === 'outro')?.id || null; };
const classif = (processo) => processo === 'PCA' ? { classificacao_categoria: '3.e', classificacao_em: new Date().toISOString(), classificacao_por: 'importação PSA FNLU' } : {};
const agora = new Date().toISOString();
const nomeFich = (num, tit, ext) => `${num} - ${tit}.${ext}`.replace(/[\\/:*?"<>|]+/g, '-');

for (const a of acoes) {
  if (a.accao === 'renumerar-para-pca') {
    const d = activo(a.de);
    const titulo = a.titulo.replace(/^MAPA DE QUADRICULA/i, 'Mapa de Quadrícula').replace(/INTERNO/, 'Interno').replace(/EXTERNO/, 'Externo');
    await req('PATCH', `/documento?id=eq.${d.id}`, { numero: a.numero, classe_codigo: a.classe, processo_codigo: a.processo, titulo, estrutura_ref: a.estrutura_ref, pasta_id: PASTA_AVSEC, tipo_id: tipoId(a.classe), updated_date: agora, ...classif('PCA') });
    console.log(`renumerado ${a.de} → ${a.numero} (${titulo})`);
  } else if (a.accao === 'recuperar') {
    const d = docsFNLU.find(x => x.numero === a.numero && x.deleted_at);
    if (activo(a.numero)) { console.log('já activo: ' + a.numero); continue; }
    await req('PATCH', `/documento?id=eq.${d.id}`, { deleted_at: null, deleted_by: null, pasta_id: PASTA_AVSEC, estrutura_ref: a.estrutura_ref, updated_date: agora });
    console.log(`recuperado ${a.numero}`);
  } else if (a.accao === 'novo') {
    if (activo(a.numero)) { console.log('salta (existe): ' + a.numero); continue; }
    const doc = (await req('POST', '/documento', {
      titulo: a.titulo, numero: a.numero, aeroporto_id: FNLU, pasta_id: PASTA_AVSEC, classe_codigo: a.classe, processo_codigo: a.processo,
      tipo_id: tipoId(a.classe), estado: 'em_vigor', usar_storage_privado: true, arquivo_privado_uri: a.stored, publicacao_em: a.data, em_vigor_desde: a.data,
      versao_atual: 1, nivel_confidencialidade: 'interno', responsavel_email: 'oaeroportos@sga.co.ao', estrutura_ref: a.estrutura_ref,
      created_by: 'importação PSA FNLU 2026-10-19', tags: [], ...classif(a.processo),
    }))[0];
    await req('POST', '/documento_versao', { documento_id: doc.id, versao: 1, rotulo: `Entrega PSA (${a.data.split('-').reverse().join('/')})`, arquivo_uri: a.stored, arquivo_nome: nomeFich(a.numero, a.titulo, a.ext), tamanho: a.tamanho, mime: MIME[a.ext], estado: 'em_vigor', vigor_desde: a.data, criado_por: 'importação PSA FNLU', sha256: a.sha });
    docsFNLU.push({ ...doc });
    console.log(`novo ${a.numero} · ${a.titulo}`);
  }
}
// fontes editáveis e versão antiga: depois dos novos (o documento já existe)
const recarregar = async (n) => (await req('GET', `/documento?numero=eq.${n}&aeroporto_id=eq.${FNLU}&deleted_at=is.null&select=id,titulo`))[0];
for (const a of acoes.filter(x => x.accao === 'fonte-editavel' || x.accao === 'versao-antiga')) {
  const d = await recarregar(a.numero);
  const vs = await req('GET', `/documento_versao?documento_id=eq.${d.id}&select=versao,arquivo_uri,sha256`);
  if (vs.some(v => v.sha256 === a.sha || v.arquivo_uri === a.stored)) { console.log('já tem: ' + a.numero); continue; }
  const n = Math.max(0, ...vs.map(v => v.versao)) + 1;
  const fonte = a.accao === 'fonte-editavel';
  await req('POST', '/documento_versao', { documento_id: d.id, versao: n, rotulo: fonte ? 'Fonte editável (.docx)' : 'Versão anterior (10/06/2025)', arquivo_uri: a.stored, arquivo_nome: nomeFich(a.numero, d.titulo, a.ext), tamanho: a.tamanho, mime: MIME[a.ext], estado: fonte ? 'fonte' : 'obsoleto', criado_por: 'importação PSA FNLU', sha256: a.sha, nota: a.nota || null });
  console.log(`${fonte ? 'fonte' : 'versão antiga'} ${a.numero} v${n}`);
}
console.log('\nFeito. Agora: node tools/ged-pastas/pastas-setor-classe.mjs --apply');
