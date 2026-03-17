import { supabase } from '@/lib/supabaseClient';

// Registry of local function implementations
// These run client-side instead of calling Supabase Edge Functions
const localFunctions = {};

// Dynamically import all local functions
const functionModules = import.meta.glob('./*.js', { eager: true });
for (const [path, mod] of Object.entries(functionModules)) {
  if (path === './_invokeFunction.js') continue;
  const name = path.replace('./', '').replace('.js', '');
  if (typeof mod.default === 'function') {
    localFunctions[name] = mod.default;
  } else if (typeof mod[name] === 'function') {
    localFunctions[name] = mod[name];
  }
}

export async function invokeFunction(functionName, params = {}) {
  // 1. Try local function first
  if (localFunctions[functionName]) {
    try {
      return await localFunctions[functionName](params);
    } catch (err) {
      console.error(`[invokeFunction] Local function "${functionName}" failed:`, err);
      throw err;
    }
  }

  // 2. Fallback to Supabase Edge Function
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: params,
  });
  if (error) throw error;
  return data;
}
