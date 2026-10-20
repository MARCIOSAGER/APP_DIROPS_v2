// Upload grande para a Universidade Corporativa (pacotes HTML5, vídeos, Office->PDF).
// Envia os bytes crus por XHR (com progresso) para /functions/v1/lms-upload, que grava
// em streaming no servidor — sem o limite de 10 MB do uploadToBucket.
import { supabase } from '@/lib/supabaseClient';

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

async function tokenSessao() {
  const { data } = await supabase.auth.getSession();
  const t = data?.session?.access_token;
  if (!t) throw new Error('Sessão inválida. Faça login novamente.');
  return t;
}

let _caps = null;
// { libreoffice: bool, max_mb: number }
export async function capacidadesUpload() {
  if (_caps) return _caps;
  try {
    const r = await fetch(`${BASE}/functions/v1/lms-upload`, { headers: { Authorization: `Bearer ${await tokenSessao()}` } });
    _caps = r.ok ? await r.json() : { libreoffice: false, max_mb: 1024 };
  } catch {
    _caps = { libreoffice: false, max_mb: 1024 };
  }
  return _caps;
}

/**
 * uploadGrande({ file, kind, onProgress }) -> { url, path, size, convertido? }
 * kind: 'html5' | 'office' | 'video' | 'file'
 * onProgress(pct 0-100, fase 'upload'|'processar')
 */
export async function uploadGrande({ file, kind, onProgress }) {
  const token = await tokenSessao();
  const url = `${BASE}/functions/v1/lms-upload?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(file.name)}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.timeout = 20 * 60 * 1000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100), 'upload'); };
    xhr.upload.onload = () => onProgress?.(100, 'processar');
    xhr.onload = () => {
      let body = null;
      try { body = JSON.parse(xhr.responseText || 'null'); } catch { /* */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) return resolve(body);
      const msg = body?.error || (xhr.status === 413 ? 'Ficheiro demasiado grande.' : `Falha no carregamento (HTTP ${xhr.status}).`);
      const err = new Error(msg); err.code = body?.code; err.status = xhr.status;
      reject(err);
    };
    xhr.onerror = () => reject(new Error('Falha de rede durante o carregamento. Verifique a ligação e tente de novo.'));
    xhr.ontimeout = () => reject(new Error('O carregamento excedeu o tempo limite.'));
    xhr.send(file);
  });
}
