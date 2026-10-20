// ============================================================
// Coletor de erros do cliente → servidor on-premise (/functions/log-error),
// que grava em logs/client-errors.jsonl (durável e revisível). Complementa o
// canal de EMAIL (system-alert): aqui fica o registo persistente de TUDO,
// incluindo os crashes apanhados pelo ErrorBoundary do React — que antes só
// iam para o console (invisíveis). CSP connect-src 'self' permite este envio.
// ============================================================
import { supabase } from '@/lib/supabaseClient';

const _seen = new Set(); // dedup por assinatura, para não inundar o log
let _sent = 0;           // teto por sessão

// Ruído que não vale a pena registar (rede/observers/deploy).
const IGNORAR = /ResizeObserver|dynamically imported module|module script failed|Load failed|NetworkError|Failed to fetch|AbortError|timeout/i;

export function logClientError(kind, error, extra = {}) {
  try {
    const message = (error && (error.message || (error.reason && error.reason.message))) || String(error || 'unknown');
    const stack = String((error && (error.stack || (error.reason && error.reason.stack))) || '');
    const sig = (String(kind) + '|' + message).slice(0, 200);
    if (!message || IGNORAR.test(sig)) return;
    if (_seen.has(sig)) return;
    if (_sent > 40) return;
    if (_seen.size > 100) _seen.clear();
    _seen.add(sig); _sent++;

    let user = '';
    try { user = window.__DIROPS_USER__ || ''; } catch { /* */ }

    supabase.functions.invoke('log-error', {
      body: {
        kind: String(kind || 'error'),
        message: String(message).slice(0, 1000),
        stack: stack.slice(0, 4000),
        page: (location.pathname + location.search).slice(0, 300),
        user,
        userAgent: navigator.userAgent,
        ...extra,
      },
    }).catch(() => {});
  } catch { /* o logger NUNCA deve quebrar a app */ }
}
