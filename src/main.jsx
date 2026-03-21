import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from '@/App.jsx'
import '@/index.css'

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);

  // Auto-reload on chunk load failure (stale cache after deploy)
  const msg = event.reason?.message || '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
    const lastReload = sessionStorage.getItem('chunk_reload_at');
    const now = Date.now();
    // Only reload once per 30s to avoid infinite loop
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

  if (window.Sentry) {
    Sentry.captureException(event.reason);
  }
});

// Auto-reload when Service Worker activates new version (skipWaiting)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const lastSWReload = sessionStorage.getItem('sw_reload_at');
    const now = Date.now();
    if (!lastSWReload || now - parseInt(lastSWReload) > 10000) {
      sessionStorage.setItem('sw_reload_at', String(now));
      window.location.reload();
    }
  });
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/glernwcsuwcyzwsnelad\.supabase\.co/,
      /^https:\/\/app\.marciosager\.com/,
    ],
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



