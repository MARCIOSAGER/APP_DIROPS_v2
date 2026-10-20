#!/usr/bin/env node
// ============================================================
// Calcula a impressão digital (SHA-256) dos ficheiros que já estavam no acervo antes de a coluna existir, para a
// detecção de documentos repetidos passar a vê-los. Os carregamentos novos já a calculam no navegador.
//
// Lê os ficheiros directamente do disco, que é muito mais rápido e barato do que os descarregar por endereço
// assinado um a um. Idempotente: só calcula o que falta, a não ser com --forcar. `--dry` não grava nada.
// ============================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PGRST = 'http://127.0.0.1:3000';
const RAIZ = process.env.STORAGE_ROOT || 'C:\\dirops\\sga-onpremise\\storage';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const DRY = process.argv.includes('--dry');
const FORCAR = process.argv.includes('--forcar');
const log = (m) => console.log(`[impressoes] ${m}`);

async function q(caminho, method = 'GET', body) {
  const r = await fetch(PGRST + caminho, { method, headers: { ...HDR, ...(body ? { Prefer: 'return=minimal' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${caminho.split('?')[0]} HTTP ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const caminhoDe = (doc) => {
  const chave = String(doc.arquivo_privado_uri || '').replace(/^\//, '');
  if (chave) return path.join(RAIZ, 'private-uploads', ...chave.split('/'));
  const m = String(doc.arquivo_url || '').match(/\/storage\/v1\/object\/public\/uploads\/(.+?)(?:\?.*)?$/);
  return m ? path.join(RAIZ, 'uploads', ...decodeURIComponent(m[1]).split('/')) : null;
};

const sha = (ficheiro) => new Promise((resolve, reject) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(ficheiro).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
});

const docs = await q('/documento?select=id,titulo,numero,sha256,arquivo_privado_uri,arquivo_url&voo_ligado_id=is.null&deleted_at=is.null&limit=5000');
let feitos = 0, jaTinham = 0, semFicheiro = 0, erros = 0;
const porImpressao = new Map();

for (const d of docs) {
  if (d.sha256 && !FORCAR) { jaTinham++; porImpressao.set(d.sha256, [...(porImpressao.get(d.sha256) || []), d]); continue; }
  const f = caminhoDe(d);
  if (!f || !fs.existsSync(f)) { semFicheiro++; log(`sem ficheiro: ${d.numero || d.titulo}`); continue; }
  try {
    const h = await sha(f);
    porImpressao.set(h, [...(porImpressao.get(h) || []), d]);
    if (!DRY) {
      await q('/documento?id=eq.' + encodeURIComponent(d.id), 'PATCH', { sha256: h });
      await q('/documento_versao?documento_id=eq.' + encodeURIComponent(d.id) + '&sha256=is.null', 'PATCH', { sha256: h }).catch(() => {});
    }
    feitos++;
  } catch (e) { erros++; log(`ERRO ${d.numero || d.titulo}: ${e.message}`); }
}

const repetidos = [...porImpressao.entries()].filter(([, l]) => l.length > 1);
log(`${DRY ? 'a calcular' : 'calculadas'}=${feitos} já tinham=${jaTinham} sem ficheiro=${semFicheiro} erros=${erros}`);
if (repetidos.length) {
  log(`ficheiros repetidos encontrados: ${repetidos.length} grupo(s)`);
  for (const [h, lista] of repetidos.slice(0, 10)) {
    log(`  ${h.slice(0, 12)}… → ${lista.map(d => d.numero || d.titulo.slice(0, 40)).join('  ·  ')}`);
  }
} else log('nenhum ficheiro repetido no acervo');
