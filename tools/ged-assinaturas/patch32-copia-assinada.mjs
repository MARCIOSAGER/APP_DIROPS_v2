#!/usr/bin/env node
// PATCH 32 — assinaturas visíveis: cópia assinada servida no lugar do original + página pública /vd/<código>.
//
// Liga ao server.js o módulo NOVO docs-verificacao.js (mesma pasta), que já lá está. Precisa da migração 186
// (tools/ged-assinaturas/186_assinaturas_visiveis.sql). Sem ela, o servidor continua a funcionar como antes: a troca
// não encontra cópias (serve o original) e a página /vd/ responde «Verificação indisponível».
//
// O que muda, ponto a ponto:
//   1) require do módulo, instanciado com postgrest/resolveStoragePath/STORAGE_ROOT/sgaLogoImg/univIp.
//   2) autorizaDocumento (só LEITURA): a chave de uma CÓPIA ASSINADA (documento_ficheiro papel 'assinado') é
//      assinada com as mesmas regras do PDF da versão — versão em_vigor/aprovado/obsoleto → pode_ver_documento;
//      outro estado → pode_editar_documento. A escrita não muda (uma cópia já gravada nunca se sobrepõe: o ficheiro
//      existe → 403).
//   3) docsRestricaoFicheiro: a chave de uma cópia assinada herda as restrições do seu documento (bloquear_download,
//      carimbo de cópia controlada, registo de acesso).
//   4) storageDownloadSigned e docsServirFicheiro (este cobre /s/ /p/ /v/): quando o ficheiro pedido é o de uma
//      versão com cópia assinada vigente, entrega-se a CÓPIA. As restrições e o carimbo continuam a vir do documento
//      da chave pedida, e o carimbo de «cópia não controlada» é aplicado por cima da cópia como era sobre o original.
//      `?original=1` no endereço assinado desliga a troca. O PDF original do fluxo (papel 'pdf', servido pela rota
//      documentos-aprovacao) nunca é trocado.
//   5) rota pública GET /vd/<código> (e /vd/?codigo=…) — ficha de verificação da revisão (nginx: nginx-vd.conf).
//
// Uso:  node patch32-copia-assinada.mjs --verificar   (confirma que as âncoras existem e o resultado compila; não escreve)
//       node patch32-copia-assinada.mjs               (aplica, com backup server.js.bak-patch32-<data>)
// Idempotente: se o marcador PATCH 32 já lá estiver, não faz nada. Depois: Restart-Service dirops-functions-v2.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const SERVER = process.env.SERVER_JS || 'C:/dirops/sga-onpremise/functions/dirops-functions/server.js';
const verificar = process.argv.includes('--verificar');
const MARCADOR = '// PATCH 32: assinaturas visíveis';

const src = fs.readFileSync(SERVER, 'utf8');
if (src.includes(MARCADOR)) {
  console.log('[patch32] já aplicado — nada a fazer.');
  process.exit(0);
}
const MODULO = path.join(path.dirname(SERVER), 'docs-verificacao.js');
if (!fs.existsSync(MODULO)) {
  console.error('[patch32] falta o módulo ' + MODULO + ' — copie-o para a pasta das funções antes de aplicar.');
  process.exit(1);
}
if (!src.includes('// PATCH 30: versões assinadas')) {
  console.error('[patch32] o patch 30 tem de estar aplicado antes deste (tools/ged-edicao/patch30-versoes-assinadas.mjs).');
  process.exit(1);
}

const trocas = [
  {
    nome: 'require docs-verificacao',
    ancora: "const DocsFluxo = require('./docs-fluxo');     // fluxo de aprovação: assinar, devolver, cancelar, servir o editável\n",
    novo: `const DocsFluxo = require('./docs-fluxo');     // fluxo de aprovação: assinar, devolver, cancelar, servir o editável
${MARCADOR} (migração 186) — cópia assinada servida no lugar do original, e verificação pública /vd/<código>.
const DocsVerif = require('./docs-verificacao').criar({ postgrest, resolveStoragePath, STORAGE_ROOT, sgaLogoImg, univIp });
`,
  },
  {
    nome: 'autorizaDocumento (chave de cópia assinada)',
    ancora: "      return { error: 404, msg: 'não encontrado' };\n    }\n  }\n  if (!docId) {\n    // Chave sem documento no balde privado.",
    novo: `      return { error: 404, msg: 'não encontrado' };
    }
  }
  if (!docId && !escrita) {
    // PATCH 32: a chave pode ser uma cópia assinada (documento_ficheiro papel 'assinado'): as regras do PDF da versão.
    const dona = await DocsVerif.donaDaCopia(key);
    if (dona) {
      const rpc = VERSAO_ESTADOS_LEITURA.has(String(dona.versao_estado || '')) ? 'pode_ver_documento' : 'pode_editar_documento';
      if (await chamadorPode(auth.token, rpc, dona.documento_id)) return null;
      return { error: 404, msg: 'não encontrado' };
    }
  }
  if (!docId) {
    // Chave sem documento no balde privado.`,
  },
  {
    nome: 'docsRestricaoFicheiro (restrições da cópia assinada)',
    ancora: "      const idv = rv.ok && Array.isArray(rv.body) && rv.body[0] && rv.body[0].documento_id;\n      if (!idv) continue;",
    novo: `      // PATCH 32: ou a chave de uma cópia assinada, que herda as restrições do seu documento
      const idv = (rv.ok && Array.isArray(rv.body) && rv.body[0] && rv.body[0].documento_id)
        || ((await DocsVerif.donaDaCopia(k)) || {}).documento_id;
      if (!idv) continue;`,
  },
  {
    nome: 'storageDownloadSigned (servir a cópia assinada)',
    ancora: "  const fp = resolveStoragePath(bucket, key);\n  if (!fp) return sendJSON(res, 404, { error: 'not found' });\n  // Endereço assinado: é por aqui que o portal abre os ficheiros privados.",
    novo: `  let fp = resolveStoragePath(bucket, key);
  if (!fp) return sendJSON(res, 404, { error: 'not found' });
  // PATCH 32: versão com cópia assinada vigente -> entrega-se a cópia (restrições e carimbo continuam a vir da chave
  // pedida). ?original=1 desliga a troca.
  fp = await DocsVerif.copiaServida(fp, url);
  // Endereço assinado: é por aqui que o portal abre os ficheiros privados.`,
  },
  {
    nome: 'docsServirFicheiro (links /s/ /p/ /v/)',
    ancora: 'async function docsServirFicheiro(req, res, fp, doc, quem, modo, falhar) {\n  const nomeOriginal = path.basename(fp);',
    novo: `async function docsServirFicheiro(req, res, fp, doc, quem, modo, falhar) {
  // PATCH 32: a cópia assinada vigente da versão, se existir (já trocada não volta a trocar: a cópia não é a chave
  // de nenhuma versão).
  fp = await DocsVerif.copiaServida(fp, null);
  const nomeOriginal = path.basename(fp);`,
  },
  {
    nome: 'rota pública /vd/',
    ancora: "    if ((p === '/cert/' || p === '/cert') && req.method === 'GET' && url.searchParams.get('codigo')) return serveCertPorCodigo(req, res, url.searchParams.get('codigo'));\n",
    novo: `    if ((p === '/cert/' || p === '/cert') && req.method === 'GET' && url.searchParams.get('codigo')) return serveCertPorCodigo(req, res, url.searchParams.get('codigo'));
    // PATCH 32: verificação pública de revisão assinada (QR da cópia assinada) — /vd/<código>
    if ((p === '/vd' || p.startsWith('/vd/')) && (req.method === 'GET' || req.method === 'HEAD')) return DocsVerif.rota(req, res, url);
`,
  },
];

let saida = src;
let falhas = 0;
for (const t of trocas) {
  const n = saida.split(t.ancora).length - 1;
  if (n !== 1) { console.error(`[patch32] âncora «${t.nome}» encontrada ${n} vezes (esperada 1).`); falhas += 1; continue; }
  saida = saida.replace(t.ancora, () => t.novo);
  console.log(`[patch32] ok: ${t.nome}`);
}
if (falhas) { console.error('[patch32] NÃO aplicado.'); process.exit(1); }

// o resultado tem de compilar (numa cópia temporária, na mesma pasta lógica para os require relativos não importarem)
const tmp = path.join(os.tmpdir(), `server.patch32-${process.pid}.js`);
fs.writeFileSync(tmp, saida, 'utf8');
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', MODULO], { stdio: 'pipe' });
  console.log('[patch32] ok: node --check (server.js modificado e docs-verificacao.js)');
} catch (e) {
  console.error('[patch32] o resultado NÃO compila:\n' + String(e.stderr || e.message));
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmp); } catch { /* */ }
}

if (verificar) { console.log('[patch32] --verificar: aplica sem problemas (nada foi escrito).'); process.exit(0); }

const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bak = path.join(path.dirname(SERVER), `server.js.bak-patch32-${carimbo}`);
fs.copyFileSync(SERVER, bak);
fs.writeFileSync(SERVER, saida, 'utf8');
console.log(`[patch32] aplicado. Backup: ${bak}`);
console.log('[patch32] Falta: bloco nginx (nginx-vd.conf), Restart-Service dirops-functions-v2 e dirops-nginx-v2');
