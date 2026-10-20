import { supabase, NO_PORTAL_UC } from '@/lib/supabaseClient';

// Remetente da Universidade: dentro do portal (/universidade/*) todos os emails saem com o nome configurado em
// Configurações › Email e com o «responder para» configurado, salvo indicação do chamador. Fora do portal (DIROPS)
// mantém-se o remetente geral do sistema. A configuração lê-se uma vez por sessão de página.
let _remetentePortal = null;
async function remetentePortal() {
  if (!NO_PORTAL_UC) return {};
  if (!_remetentePortal) {
    _remetentePortal = (async () => {
      try { const { data } = await supabase.from('universidade_config').select('email_remetente_nome,email_resposta').eq('id', 'geral').maybeSingle(); return data || {}; }
      catch { return {}; }
    })();
  }
  const c = await _remetentePortal;
  return { from_name: String(c.email_remetente_nome || 'Universidade Corporativa · SGA').slice(0, 80), reply_to: c.email_resposta || undefined };
}

export async function sendEmailDirect({ to, bcc, subject, body, html, from_name = undefined, reply_to = undefined, attachments = undefined }) {
  // COMPAT: alguns handlers antigos (Safety, FundoManeio, Inspeções, Manutenção,
  // Credenciamento, Treinamentos) têm assinatura posicional desatualizada e passam
  // o OBJETO {to, subject, message} do SendEmailModal inteiro como `to` — resultava
  // em "[object Object]" no destinatário (e assunto vazio). Normalizamos aqui, num
  // ponto único, em vez de corrigir cada handler.
  if (to && typeof to === 'object' && !Array.isArray(to) && typeof to.to !== 'undefined') {
    if (!subject) subject = to.subject;
    if (!body && !html && to.message) body = to.message;
    to = to.to;
  }
  // Múltiplos destinatários separados por vírgula -> array (o endpoint aceita array).
  if (typeof to === 'string' && to.includes(',')) to = to.split(',').map((s) => s.trim()).filter(Boolean);

  const base = await remetentePortal();
  if (!from_name && base.from_name) from_name = base.from_name;
  if (!reply_to && base.reply_to) reply_to = base.reply_to;

  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, bcc, subject, html: html || body, text: body, ...(attachments?.length ? { attachments } : {}), ...(from_name ? { from_name } : {}), ...(reply_to ? { reply_to } : {}) },
  });
  if (error) throw error;
  return data;
}

export default sendEmailDirect;
