import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Lock de auth = processLock (in-memory, oficial do supabase-js). O lock padrão
// usa navigator.locks (Web Locks API), que NÃO existe em contexto não-seguro
// (o app roda por HTTP em 10.1.65.45). Antes havia um NO-OP, que permitia
// refresh de token CONCORRENTE -> GoTrue 409 "Too many concurrent token refresh"
// -> o cliente pendurava e a página congelava (só F5 destravava). O processLock
// serializa por nome, com re-entrância tratada, sem depender de navigator.locks.

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: processLock,
  },
  global: {
    fetch: (url, options = {}) => {
      const u = typeof url === 'string' ? url : (url && url.url) || '';
      // Endpoints de functions (ex.: envio de email em lote) podem demorar
      // muito mais que uma query normal — 15s abortava o comunicado no meio.
      const timeoutMs = u.includes('/functions/') ? 180000 : 20000;
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      // SEMPRE aplica um timeout — inclusive quando o chamador já passa o próprio
      // signal (cancelamento do react-query OU o refresh de token do GoTrue).
      // Antes, um `if (options.signal) return fetch(...)` deixava esses pedidos
      // SEM timeout: um refresh de token pendurado segurava o processLock para
      // sempre e TODAS as gravações congelavam ("A guardar..." infinito). Aqui
      // combinamos o signal do chamador com o de timeout.
      let signal = timeoutSignal;
      if (options.signal) {
        signal = (typeof AbortSignal.any === 'function')
          ? AbortSignal.any([options.signal, timeoutSignal])
          : options.signal;
      }
      return fetch(url, { ...options, signal });
    },
  },
});
