// Cliente dos endpoints do quiz (correção no servidor): quiz-state / quiz-start / quiz-save / quiz-submit / quiz-grade.
import { supabase } from '@/lib/supabaseClient';

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

async function chamar(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sessão inválida. Faça login novamente.');
  const r = await fetch(`${BASE}/functions/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const err = new Error(json?.error || `Falha na avaliação (HTTP ${r.status}).`);
    err.status = r.status;
    throw err;
  }
  return json;
}

export const quizApi = {
  estado: (quizId) => chamar(`quiz-state?quiz_id=${encodeURIComponent(quizId)}`),
  iniciar: (quizId) => chamar('quiz-start', { method: 'POST', body: { quiz_id: quizId } }),
  guardar: (tentativaId, respostas, evento) => chamar('quiz-save', { method: 'POST', body: { tentativa_id: tentativaId, respostas, evento } }),
  submeter: (tentativaId, respostas) => chamar('quiz-submit', { method: 'POST', body: { tentativa_id: tentativaId, respostas } }),
  // gestão: detalhe da correcção de uma tentativa (gabarito incluído) e correcção manual das perguntas abertas
  correcao: (tentativaId) => chamar(`quiz-grade?tentativa_id=${encodeURIComponent(tentativaId)}`),
  corrigir: (tentativaId, correcoes) => chamar('quiz-grade', { method: 'POST', body: { tentativa_id: tentativaId, correcoes } }),
};
