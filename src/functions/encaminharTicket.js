import { sendNotificationEmail } from '@/functions/sendNotificationEmail';
import { TicketSuporte } from '@/entities/TicketSuporte';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Encaminha um ticket por email para um destinatário (@sga.co.ao) e regista o
// encaminhamento na própria ficha do ticket.
export async function encaminharTicket({ ticket, destinatario, nota, encaminhadoPor }) {
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">' +
    '<div style="max-width:600px;margin:0 auto;padding:20px;">' +
    '<div style="background:linear-gradient(135deg,#1e3a5f,#1a3050);border-radius:12px 12px 0 0;padding:24px 40px;text-align:center;">' +
    '<h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:1px;">DIROPS — Suporte</h1></div>' +
    '<div style="background:#fff;padding:24px 40px;border:1px solid #e2e8f0;color:#334155;font-size:14px;line-height:1.6;">' +
    '<h2 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Ticket encaminhado: ' + esc(ticket.numero_ticket) + '</h2>' +
    (encaminhadoPor ? '<p style="margin:4px 0;color:#64748b;">Encaminhado por <strong>' + esc(encaminhadoPor) + '</strong></p>' : '') +
    (nota ? '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin:8px 0;"><strong>Nota:</strong><br>' + esc(nota).replace(/\n/g, '<br>') + '</div>' : '') +
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">' +
    '<p style="margin:4px 0;"><strong>Assunto:</strong> ' + esc(ticket.assunto) + '</p>' +
    '<p style="margin:4px 0;"><strong>Categoria:</strong> ' + esc(ticket.categoria || 'outro') + '</p>' +
    '<p style="margin:4px 0;"><strong>Estado:</strong> ' + esc(ticket.status) + '</p>' +
    '<p style="margin:4px 0;"><strong>Solicitante:</strong> ' + esc(ticket.solicitante_nome) + ' (' + esc(ticket.solicitante_email) + ')</p>' +
    '<p style="margin:12px 0 4px;"><strong>Mensagem:</strong></p>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">' + esc(ticket.mensagem).replace(/\n/g, '<br>') + '</div>' +
    '</div>' +
    '<div style="background:#f8fafc;border-radius:0 0 12px 12px;padding:14px 40px;border:1px solid #e2e8f0;border-top:none;text-align:center;">' +
    '<p style="margin:0;color:#94a3b8;font-size:11px;">Aceda em DIROPS → Suporte → Gerir Tickets</p></div></div></body></html>';

  const res = await sendNotificationEmail({
    to: destinatario,
    subject: `Ticket encaminhado ${ticket.numero_ticket}: ${ticket.assunto}`,
    body: html,
  });

  // Regista o encaminhamento (best-effort — o email é o principal).
  try {
    await TicketSuporte.update(ticket.id, {
      encaminhado_para: destinatario,
      encaminhado_em: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[encaminharTicket] email enviado mas falha ao registar:', e);
  }

  return res;
}
