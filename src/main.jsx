import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { supabase } from '@/lib/supabaseClient'

// Reporta erros GRAVES do frontend ao alerta central (-> oaeroportos), que
// deduplica no servidor (1 email por tipo/1h). Dedup também no browser + filtro
// de ruído (rede, chunk velho, ResizeObserver) para não spammar. Fire-and-forget.
const _reportedErrors = new Set();
function reportSystemError(titulo, detalhe) {
  try {
    const sig = String(titulo + '|' + (detalhe || '')).slice(0, 200);
    if (!sig) return;
    if (/ResizeObserver|dynamically imported module|module script failed|Load failed|NetworkError|Failed to fetch|AbortError|timeout/i.test(sig)) return;
    if (_reportedErrors.has(sig)) return;
    if (_reportedErrors.size > 50) _reportedErrors.clear();
    _reportedErrors.add(sig);
    supabase.functions.invoke('system-alert', {
      body: {
        origem: 'frontend ' + (location.pathname || ''),
        titulo,
        detalhe: `${detalhe}\n\nURL: ${location.href}`,
        assinatura: 'frontend:' + sig,
      },
    }).catch(() => {});
  } catch { /* o reporter nunca deve quebrar */ }
}

window.addEventListener('error', (event) => {
  reportSystemError('Erro JS (frontend)', event.error?.stack || event.message || String(event));
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);

  // Auto-reload on chunk load failure (stale cache after deploy)
  const msg = event.reason?.message || '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
    const lastReload = sessionStorage.getItem('chunk_reload_at');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload) > 30000) {
      sessionStorage.setItem('chunk_reload_at', String(now));
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          Promise.all(regs.map(r => r.unregister())).then(() => window.location.reload());
        }).catch(() => window.location.reload());
      } else {
        window.location.reload();
      }
    }
  }

  if (window.__SENTRY__ && typeof window.__SENTRY__ === 'object') {
    import('@sentry/react').then(Sentry => Sentry.captureException(event.reason));
  }

  reportSystemError('Promise rejeitada (frontend)', event.reason?.stack || event.reason?.message || String(event.reason));
});

// Auto-reload when Service Worker activates new version (skipWaiting / kill-switch)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const lastSWReload = sessionStorage.getItem('sw_reload_at');
    const now = Date.now();
    if (!lastSWReload || now - parseInt(lastSWReload) > 10000) {
      sessionStorage.setItem('sw_reload_at', String(now));
      window.location.reload();
    }
  });

  // O app atual NÃO usa Service Worker. Remove proativamente qualquer SW antigo
  // (de versões PWA) que fique a servir cache velho — evita ter de forçar refresh.
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs && regs.length) {
      Promise.all(regs.map((r) => r.unregister()))
        .then(() => (self.caches ? caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))) : null))
        .catch(() => {});
    }
  }).catch(() => {});
}

// A-02: Lazy-load Sentry after first paint (~30KB saved from critical path)
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then(Sentry => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      // Replay integration removed — saves ~300KB from the lazy Sentry chunk.
      // If session replay is ever needed for debugging, re-add Sentry.replayIntegration().
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
      tracesSampleRate: 1.0,
      tracePropagationTargets: (() => {
        const targets = ['localhost'];
        const sbUrl = import.meta.env.VITE_SUPABASE_URL;
        if (sbUrl) {
          try { targets.push(new RegExp('^' + sbUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); } catch { /* ignore */ }
        }
        return targets;
      })(),
    });
    // window.__SENTRY__ is set by Sentry.init() internally — do not overwrite
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



