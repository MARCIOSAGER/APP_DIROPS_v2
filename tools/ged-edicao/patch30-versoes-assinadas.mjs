#!/usr/bin/env node
// PATCH 30 — ficheiros de versões ANTERIORES (e rascunhos) assinados pelo storage privado.
//
// Até aqui o servidor só assinava a chave que está em `documento.arquivo_privado_uri` (documentoDaChave): o ficheiro
// da versão em vigor. Os ficheiros das outras linhas de `documento_versao.arquivo_uri` davam 404 a toda a gente, e a
// «Comparar versões» do portal não os conseguia abrir. Este patch:
//   1) acrescenta versaoDaChave(key) — as linhas de documento_versao cuja arquivo_uri é a chave pedida;
//   2) em autorizaDocumento (só LEITURA): uma chave que não é de nenhum documento mas é de uma versão passa se
//        - a versão está em_vigor/aprovado/obsoleto  -> pode_ver_documento(documento)  (isolamento por aeroporto,
//          confidencialidade e AVSEC já vivem nessa função);
//        - rascunho/fonte/outro estado               -> pode_editar_documento(documento);
//      A escrita continua como estava (uma versão antiga nunca se substitui por esta porta).
//   3) em docsRestricaoFicheiro: a chave de uma versão herda as restrições do SEU documento (bloquear_download,
//      carimbo) — e por isso também o registo docsLogAcesso, que se pendura em restr.doc.id.
//
// Uso:  node patch30-versoes-assinadas.mjs --verificar   (só confirma que as âncoras existem; não escreve)
//       node patch30-versoes-assinadas.mjs               (aplica, com backup server.js.bak-patch30-<data>)
// Idempotente: se o marcador PATCH 30 já lá estiver, não faz nada. Depois: Restart-Service dirops-functions-v2.
import fs from 'node:fs';
import path from 'node:path';

const SERVER = process.env.SERVER_JS || 'C:/dirops/sga-onpremise/functions/dirops-functions/server.js';
const verificar = process.argv.includes('--verificar');
const MARCADOR = '// PATCH 30: versões assinadas';

const src = fs.readFileSync(SERVER, 'utf8');
if (src.includes(MARCADOR)) {
  console.log('[patch30] já aplicado — nada a fazer.');
  process.exit(0);
}

const trocas = [
  {
    nome: 'versaoDaChave (nova função)',
    ancora: '// Devolve null quando está autorizado, ou { error, msg } para devolver ao cliente.',
    novo: `${MARCADOR} (comparar versões no portal). Linhas de documento_versao cujo ficheiro é esta chave, com as
// mesmas formas de codificação que documentoDaChave experimenta.
async function versaoDaChave(key) {
  const formas = new Set([key]);
  try { formas.add(decodeURIComponent(key)); } catch { /* chave com % solto */ }
  const linhas = [];
  for (const f of formas) {
    for (const v of new Set([f, f.normalize('NFC'), f.normalize('NFD')])) {
      const q = await postgrest('/documento_versao?select=documento_id,estado&arquivo_uri=eq.' + encodeURIComponent(v) + '&limit=20', 'GET');
      if (q.ok && Array.isArray(q.body)) linhas.push(...q.body);
    }
    if (linhas.length) break;
  }
  return linhas;
}
const VERSAO_ESTADOS_LEITURA = new Set(['em_vigor', 'aprovado', 'obsoleto']);

// Devolve null quando está autorizado, ou { error, msg } para devolver ao cliente.`,
  },
  {
    nome: 'autorizaDocumento (leitura de versões)',
    ancora: '  const docId = await documentoDaChave(key);\n  if (!docId) {',
    novo: `  const docId = await documentoDaChave(key);
  if (!docId && !escrita) {
    // PATCH 30: a chave pode ser o ficheiro de uma versão (anterior, rascunho, fonte) e não o actual.
    const versoes = await versaoDaChave(key);
    if (versoes.length) {
      for (const v of versoes) {
        const rpc = VERSAO_ESTADOS_LEITURA.has(String(v.estado || '')) ? 'pode_ver_documento' : 'pode_editar_documento';
        if (await chamadorPode(auth.token, rpc, v.documento_id)) return null;
      }
      return { error: 404, msg: 'não encontrado' };
    }
  }
  if (!docId) {`,
  },
  {
    nome: 'docsRestricaoFicheiro (restrições herdadas pela versão)',
    ancora: "  const doc = (Array.isArray(r.body) ? r.body : []).find(d => fim(d.arquivo_privado_uri) || fim(d.arquivo_url)) || null;\n  const valor = doc ?",
    novo: `  let doc = (Array.isArray(r.body) ? r.body : []).find(d => fim(d.arquivo_privado_uri) || fim(d.arquivo_url)) || null;
  if (!doc) {
    // PATCH 30: ficheiro de uma versão — herda as restrições (e o registo de acesso) do seu documento.
    for (const k of alvos) {
      const rv = await postgrest('/documento_versao?select=documento_id&arquivo_uri=eq.' + encodeURIComponent(k) + '&limit=1', 'GET');
      const idv = rv.ok && Array.isArray(rv.body) && rv.body[0] && rv.body[0].documento_id;
      if (!idv) continue;
      const rd = await docsDocGet('id=eq.' + encodeURIComponent(idv) + '&limit=1', 'id,bloquear_download,requer_senha_adicional,nivel_confidencialidade,pasta_id,arquivo_url,arquivo_privado_uri');
      if (!rd.ok) throw new Error('não foi possível ler as restrições do documento');
      doc = (Array.isArray(rd.body) && rd.body[0]) || null;
      if (doc) break;
    }
  }
  const valor = doc ?`,
  },
];

let saida = src;
let falhas = 0;
for (const t of trocas) {
  const n = saida.split(t.ancora).length - 1;
  if (n !== 1) { console.error(`[patch30] âncora «${t.nome}» encontrada ${n} vezes (esperada 1).`); falhas += 1; continue; }
  saida = saida.replace(t.ancora, () => t.novo);
  console.log(`[patch30] ok: ${t.nome}`);
}
if (falhas) { console.error('[patch30] NÃO aplicado.'); process.exit(1); }
if (verificar) { console.log('[patch30] --verificar: aplica sem problemas (nada foi escrito).'); process.exit(0); }

const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bak = path.join(path.dirname(SERVER), `server.js.bak-patch30-${carimbo}`);
fs.copyFileSync(SERVER, bak);
fs.writeFileSync(SERVER, saida, 'utf8');
console.log(`[patch30] aplicado. Backup: ${bak}`);
console.log('[patch30] Falta: Restart-Service dirops-functions-v2');
