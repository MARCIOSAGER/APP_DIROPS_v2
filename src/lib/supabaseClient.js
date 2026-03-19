import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const proxyUrl = 'https://api.marciosager.com';

// Route only REST API calls through Cloudflare Worker proxy (lower latency for Angola)
// Auth and Storage go directly to Supabase to avoid OAuth/cookie conflicts
const customFetch = (url, options) => {
  if (typeof url === 'string' && url.includes('/rest/v1/')) {
    return fetch(url.replace(supabaseUrl, proxyUrl), options);
  }
  return fetch(url, options);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
  global: { fetch: customFetch },
});
