#!/usr/bin/env node
// ============================================================
// Portal de Documentos — fase 1: migra os ficheiros dos documentos do GED do bucket público («uploads», servido sem
// autenticação) para o bucket privado («private-uploads», servido só por URL assinada) e actualiza os registos.
//   • só documentos do GED (voo_ligado_id nulo) ainda públicos;
//   • move o ficheiro em disco (mesmo nome), grava usar_storage_privado=true + arquivo_privado_uri=<nome>,
//     e actualiza documento_versao.arquivo_uri; arquivo_url fica como referência histórica;
//   • idempotente: documentos já privados ou ficheiros já movidos são ignorados; --dry só lista.
// Pré-requisito: backend com o patch 24 (links /s /p /v resolvem private-uploads) — Restart-Service dirops-functions-v2.
// ============================================================
import fs from 'fs';
import path from 'path';

const PGRST = 'http://127.0.0.1:3000';
const STORAGE_ROOT = process.env.STORAGE_ROOT || 'C:\\dirops\\sga-onpremise\\storage';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const DRY = process.argv.includes('--dry');
const log = (m) => console.log(`[mover-privados] ${m}`);

async function q(p, method = 'GET', body, prefer) {
  const r = await fetch(PGRST + p, { method, headers: { ...HDR, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${p.split('?')[0]} HTTP ${r.status} — ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

const docs = await q('/documento?select=id,titulo,arquivo_url,arquivo_privado_uri,usar_storage_privado,voo_ligado_id&voo_ligado_id=is.null&order=created_date.asc&limit=5000');
let movidos = 0, jaPrivados = 0, semFicheiro = 0, erros = 0, ignorados = 0;
for (const d of docs) {
  if (d.usar_storage_privado && d.arquivo_privado_uri) { jaPrivados++; continue; }
  const m = String(d.arquivo_url || '').match(/\/storage\/v1\/object\/public\/uploads\/(.+?)(?:\?.*)?$/);
  if (!m) { ignorados++; log(`ignorado (URL fora do padrão): ${d.titulo} → ${d.arquivo_url || '(sem URL)'}`); continue; }
  const key = decodeURIComponent(m[1]);
  const origem = path.join(STORAGE_ROOT, 'uploads', ...key.split('/'));
  const destino = path.join(STORAGE_ROOT, 'private-uploads', ...key.split('/'));
  const existeOrigem = fs.existsSync(origem), existeDestino = fs.existsSync(destino);
  if (!existeOrigem && !existeDestino) { semFicheiro++; log(`SEM FICHEIRO: ${d.titulo} (${key})`); continue; }
  if (DRY) { log(`[dry] ${existeDestino ? 'já movido' : 'mover'}: ${key}`); movidos++; continue; }
  try {
    if (existeOrigem && !existeDestino) { fs.mkdirSync(path.dirname(destino), { recursive: true }); fs.renameSync(origem, destino); }
    else if (existeOrigem && existeDestino) { fs.unlinkSync(origem); } // já havia cópia privada: remove a pública
    await q('/documento?id=eq.' + encodeURIComponent(d.id), 'PATCH', { usar_storage_privado: true, arquivo_privado_uri: key, updated_date: new Date().toISOString() }, 'return=minimal');
    await q('/documento_versao?documento_id=eq.' + encodeURIComponent(d.id) + '&versao=eq.1', 'PATCH', { arquivo_uri: key }, 'return=minimal').catch(() => {});
    movidos++;
  } catch (e) { erros++; log(`ERRO ${d.titulo}: ${e.message}`); }
}
log(`fim — ${DRY ? 'a mover' : 'movidos'}=${movidos} já privados=${jaPrivados} ignorados=${ignorados} sem ficheiro=${semFicheiro} erros=${erros}`);
