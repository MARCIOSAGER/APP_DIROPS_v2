// Lançamento xAPI (Tin Can) de um pacote HTML5: pede ao backend o endpoint/auth/actor/registration
// e monta a query string que os pacotes esperam (TinCanJS, Storyline, Rise, iSpring…).
import { supabase } from '@/lib/supabaseClient';

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

export async function lancamentoXapi({ matriculaId, aulaId }) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sessão inválida. Faça login novamente.');
  const r = await fetch(`${BASE}/functions/v1/xapi-launch`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula_id: matriculaId, aula_id: aulaId }) });
  let json = null; try { json = await r.json(); } catch { /* */ }
  if (!r.ok) { const e = new Error(json?.error || `Não foi possível preparar o lançamento xAPI (HTTP ${r.status}).`); e.status = r.status; throw e; }
  return json;
}

// url do index + parâmetros de lançamento (endpoint, auth, actor, registration, activity_id)
export function urlLancamentoXapi(url, l) {
  if (!url || !l) return url;
  const q = new URLSearchParams();
  q.set('endpoint', l.endpoint);
  q.set('auth', l.auth);
  q.set('actor', JSON.stringify(l.actor));
  if (l.registration) q.set('registration', l.registration);
  if (l.activity_id) q.set('activity_id', l.activity_id);
  return `${url}${url.includes('?') ? '&' : '?'}${q.toString()}`;
}
