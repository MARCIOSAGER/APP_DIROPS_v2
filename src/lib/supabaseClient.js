import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Lock de auth = processLock (in-memory, oficial do supabase-js). O lock padrão
// usa navigator.locks (Web Locks API), que NÃO existe em contexto não-seguro
// (o app roda por HTTP em 10.1.65.45). Antes havia um NO-OP, que permitia
// refresh de token CONCORRENTE -> GoTrue 409 "Too many concurrent token refresh"
// -> o cliente pendurava e a página congelava (só F5 destravava). O processLock
// serializa por nome, com re-entrância tratada, sem depender de navigator.locks.

// O portal da Universidade (/universidade/*) guarda a sessão numa chave própria: entrar no DIROPS não entra na Universidade
// nem vice-versa (as credenciais são as mesmas; as sessões e os refresh tokens são independentes). A escolha é feita no
// arranque da página — as passagens entre as duas áreas são sempre carregamentos completos (<a href>), nunca navegação SPA.
export const NO_PORTAL_UC = typeof window !== 'undefined' && window.location.pathname.startsWith('/universidade');
export const CHAVE_SESSAO_UC = 'sb-universidade-auth';
// Plataforma independente: compilado com VITE_UC_ISOLADO=1, o portal fala com o GoTrue próprio da Universidade (contas em
// auth_uc) através do prefixo /uc/ do nginx (/uc/auth/v1, /uc/rest/v1, /uc/functions/v1, /uc/storage/v1). O DIROPS não muda.
export const UC_ISOLADO = NO_PORTAL_UC && import.meta.env.VITE_UC_ISOLADO === '1';
// O Portal de Documentos (/documentos/*) segue a mesma receita: chave de sessão própria e, quando compilado com
// VITE_GD_ISOLADO=1, base de contas isolada (auth_docs) através do prefixo /gd do nginx.
export const NO_PORTAL_GD = typeof window !== 'undefined' && window.location.pathname.startsWith('/documentos');
export const CHAVE_SESSAO_GD = 'sb-documentos-auth';
export const GD_ISOLADO = NO_PORTAL_GD && import.meta.env.VITE_GD_ISOLADO === '1';
const prefixoPortal = UC_ISOLADO ? '/uc' : GD_ISOLADO ? '/gd' : '';
const urlBase = prefixoPortal ? String(supabaseUrl || '').replace(/\/$/, '') + prefixoPortal : supabaseUrl;
// Raiz da API que este separador usa (muda com o portal). Quem construir endereços à mão — URLs assinadas do
// storage, por exemplo — tem de partir daqui, senão acerta no DIROPS em vez do portal.
export const URL_BASE = String(urlBase || '').replace(/\/$/, '');

export const supabase = createClient(urlBase, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: processLock,
    ...(NO_PORTAL_UC ? { storageKey: CHAVE_SESSAO_UC } : NO_PORTAL_GD ? { storageKey: CHAVE_SESSAO_GD } : {}),
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
        if (typeof AbortSignal.any === 'function') {
          signal = AbortSignal.any([options.signal, timeoutSignal]);
        } else {
          // Fallback p/ browsers sem AbortSignal.any (Chrome 103-115): combina
          // manualmente — aborta no primeiro dos dois. O timeout NUNCA é descartado.
          const ctrl = new AbortController();
          const onAbort = () => ctrl.abort();
          options.signal.addEventListener('abort', onAbort, { once: true });
          timeoutSignal.addEventListener('abort', onAbort, { once: true });
          signal = ctrl.signal;
        }
      }
      return fetch(url, { ...options, signal });
    },
  },
});
