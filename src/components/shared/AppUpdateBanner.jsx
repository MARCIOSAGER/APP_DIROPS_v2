import React, { useEffect, useRef, useState } from 'react';

/**
 * Detecta quando um novo build foi publicado e oferece recarregar.
 *
 * Porquê: navegar pelo menu é SPA — NÃO recarrega o JS. Sem isto, depois de
 * um deploy (ex.: uma correção de travamento) o utilizador continua a correr
 * o código ANTIGO em memória até dar F5 manual. Cada build do Vite gera o
 * script de entrada com um hash novo em index.html; comparamos o hash actual
 * (o que a página carregou) com o do index.html publicado. Sem Service Worker
 * (o SW causava staleness) — apenas um fetch periódico do index.html.
 */

const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 min

// src (com hash) do <script type="module"> de entrada num HTML de index.
function extractEntry(html) {
  const m = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)
    || html.match(/src=["'](\/assets\/index-[^"']+\.js)["']/i);
  return m ? m[1] : null;
}

// O que ESTA página carregou (a partir do <script> já no DOM) — baseline exacto.
function loadedEntry() {
  const s = document.querySelector('script[type="module"][src*="/assets/index-"]')
    || document.querySelector('script[type="module"][src]');
  try { return s ? new URL(s.src, location.href).pathname : null; } catch { return null; }
}

export default function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const baseline = useRef(null);

  useEffect(() => {
    if (import.meta.env.DEV) return; // em dev não há index com hash
    baseline.current = loadedEntry();
    if (!baseline.current) return; // não conseguimos identificar a versão -> não incomoda

    let cancelled = false;
    async function check() {
      if (cancelled || document.hidden) return;
      try {
        const res = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const entry = extractEntry(await res.text());
        if (entry && entry !== baseline.current && !cancelled) setUpdateAvailable(true);
      } catch { /* offline/blip — tenta na próxima */ }
    }

    const id = setInterval(check, CHECK_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    check(); // primeira verificação imediata
    return () => { cancelled = true; clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 99999, background: '#1e3a5f', color: '#fff', padding: '10px 14px',
      borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.28)', display: 'flex',
      alignItems: 'center', gap: 12, fontSize: 14, maxWidth: '92vw',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <span>🔄 Nova versão disponível.</span>
      <button
        onClick={() => window.location.reload()}
        style={{ background: '#fff', color: '#1e3a5f', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
      >Atualizar agora</button>
      <button
        onClick={() => setUpdateAvailable(false)}
        aria-label="Fechar"
        style={{ background: 'transparent', color: '#cbd5e1', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}
      >×</button>
    </div>
  );
}
