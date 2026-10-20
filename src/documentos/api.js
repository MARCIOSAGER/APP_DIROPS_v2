// Cliente do endpoint /functions/documentos-acesso (pedidos de acesso, convites, aprovações, revogações, perfis)
// e da validação de senhas de pasta/documento no servidor. As acções públicas (pedir, verificar, aceitar) funcionam
// sem sessão. Molde: src/universidade/api.js.
import { supabase } from '@/lib/supabaseClient';

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function chamar(funcao, action, body = {}) {
  let token = ANON;
  try { const { data } = await supabase.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch { /* sem sessão */ }
  let r;
  try {
    r = await fetch(`${BASE}/functions/v1/${funcao}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new Error('Sem ligação ao servidor. Verifique a rede e tente novamente.');
  }
  let json = null;
  try { json = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const err = new Error(json?.error || (r.status === 404
      ? 'O serviço de documentos ainda não está activo no servidor (é preciso reiniciar o serviço dirops-functions-v2).'
      : `Falha no pedido (${r.status}).`));
    err.status = r.status;
    throw err;
  }
  return json;
}

export const docsAcesso = (action, body) => chamar('documentos-acesso', action, body);
// Senhas de pasta e de documento: a verificação é no servidor, que devolve uma autorização de curta duração.
export const validarSenhaDocs = (alvo, id, senha) => chamar('documentos-acesso', 'senha', { alvo, id, senha });
