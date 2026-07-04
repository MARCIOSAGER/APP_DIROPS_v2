import { supabase } from '@/lib/supabaseClient';
import { sendNotificationEmail } from '@/functions/sendNotificationEmail';

// Inbox da equipa de suporte que recebe aviso de cada novo ticket.
const SUPORTE_EMAIL = 'oaeroportos@sga.co.ao';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Grava o ticket na tabela dedicada public.ticket_suporte (numero_ticket TKT-XXXXX
// gerado pelo DEFAULT da tabela) e avisa a equipa de suporte por email.
export async function enviarTicketSuporte({ assunto, categoria, mensagem, anexos = [] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: profile } = await supabase
    .from('users')
    .select('email, full_name, empresa_id')
    .eq('auth_id', user.id)
    .single();

  // Normaliza anexos para [{ url, nome, tipo }] (guarda só o essencial).
  const anexosLimpos = (Array.isArray(anexos) ? anexos : [])
    .filter(a => a && a.url)
    .map(a => ({ url: a.url, nome: a.nome || 'ficheiro', tipo: a.tipo || '' }));

  const { data: ticket, error } = await supabase
    .from('ticket_suporte')
    .insert({
      assunto,
      categoria: categoria || 'outro',
      mensagem,
      status: 'aberta',
      solicitante_auth_id: user.id,
      solicitante_email: profile?.email || user.email,
      solicitante_nome: profile?.full_name || user.email,
      empresa_id: profile?.empresa_id || null,
      anexos: anexosLimpos,
    })
    .select()
    .single();

  if (error) throw error;

  // Links absolutos para o email (as URLs guardadas são relativas ao host).
  const base = (typeof window !== 'undefined' && window.location?.origin) || '';
  const anexosHtml = anexosLimpos.length
    ? '<p style="margin:12px 0 4px;"><strong>Anexos (' + anexosLimpos.length + '):</strong></p><ul style="margin:4px 0;padding-left:20px;">' +
      anexosLimpos.map(a => '<li><a href="' + base + esc(a.url) + '" style="color:#2563eb;">' + esc(a.nome) + '</a></li>').join('') +
      '</ul>'
    : '';

  // Notificar o suporte (best-effort — não falha o ticket se o email cair).
  try {
    const html =
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
      '<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">' +
      '<div style="max-width:600px;margin:0 auto;padding:20px;">' +
      '<div style="background:linear-gradient(135deg,#1e3a5f,#1a3050);border-radius:12px 12px 0 0;padding:24px 40px;text-align:center;">' +
      '<h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:1px;">DIROPS — Suporte</h1></div>' +
      '<div style="background:#fff;padding:24px 40px;border:1px solid #e2e8f0;color:#334155;font-size:14px;line-height:1.6;">' +
      '<h2 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Novo ticket: ' + esc(ticket.numero_ticket) + '</h2>' +
      '<p style="margin:4px 0;"><strong>Assunto:</strong> ' + esc(assunto) + '</p>' +
      '<p style="margin:4px 0;"><strong>Categoria:</strong> ' + esc(categoria || 'outro') + '</p>' +
      '<p style="margin:4px 0;"><strong>Solicitante:</strong> ' + esc(ticket.solicitante_nome) + ' (' + esc(ticket.solicitante_email) + ')</p>' +
      '<p style="margin:12px 0 4px;"><strong>Mensagem:</strong></p>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">' + esc(mensagem).replace(/\n/g, '<br>') + '</div>' +
      anexosHtml +
      '</div>' +
      '<div style="background:#f8fafc;border-radius:0 0 12px 12px;padding:14px 40px;border:1px solid #e2e8f0;border-top:none;text-align:center;">' +
      '<p style="margin:0;color:#94a3b8;font-size:11px;">Aceda em DIROPS → Suporte → Gerir Tickets</p></div></div></body></html>';

    await sendNotificationEmail({
      to: SUPORTE_EMAIL,
      subject: `Novo Ticket ${ticket.numero_ticket}: ${assunto}`,
      body: html,
    });
  } catch (e) {
    console.warn('[enviarTicketSuporte] falha ao notificar o suporte por email:', e);
  }

  return { sucesso: true, numero_ticket: ticket.numero_ticket, ticket_id: ticket.id };
}
