import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const proxyUrl = 'https://api.marciosager.com';

// Cloudflare Worker proxy disabled — was returning 202 for specific tables (treated as error by client)
// TODO: investigate why api.marciosager.com returns 202 for regra_permissao, aeroporto, etc.
const customFetch = (url, options) => fetch(url, options);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
  global: { fetch: customFetch },
});
