// Lembrete manual de formação (gestor → colaborador): email individual + registo em notificacao_formacao.
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { NotificacaoFormacao } from '@/entities/NotificacaoFormacao';
import { getPublicBaseUrl } from '@/lib/certificadoEmissao';
import { estadoFormacao, ESTADOS } from '@/lib/formacaoEstado';

// O relay da SGA só entrega para @sga.co.ao (outros ficam registados como não entregues).
export const ENTREGAVEL = /@sga\.co\.ao$/i;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtD = (iso) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-PT'); };

// Assunto e corpo do lembrete conforme o estado (em falta, em curso/atrasado, a expirar, expirado).
export function textoLembrete({ curso, matricula, nome, estado, dias, validoAte, baseUrl = '', mensagem = '' }) {
  const url = `${baseUrl}/universidade/formacao?curso=${curso.id}`;
  const t = esc(curso.titulo);
  const quem = esc(nome || '');
  let titulo, corpo, cta;
  if (estado === 'em_falta' || estado === 'nao_inscrito' || !matricula) {
    titulo = `${quem}, tem uma formação obrigatória por fazer`;
    corpo = `O curso <strong>${t}</strong> é obrigatório para a sua função e ainda não está inscrito(a).${curso.prazo_dias ? ` Depois de se inscrever tem <strong>${curso.prazo_dias} dias</strong> para o concluir.` : ''}`;
    cta = 'Inscrever-me';
  } else if (estado === 'expirado') {
    titulo = 'A sua certificação expirou';
    corpo = `A certificação em <strong>${t}</strong> terminou em <strong>${fmtD(validoAte)}</strong>. Faça a recertificação para manter a habilitação.`;
    cta = 'Recertificar agora';
  } else if (estado === 'a_expirar') {
    titulo = 'A sua certificação está a expirar';
    corpo = `A certificação em <strong>${t}</strong> é válida até <strong>${fmtD(validoAte)}</strong>${dias != null ? ` (${dias} dias)` : ''}. Faça a recertificação a tempo.`;
    cta = 'Recertificar agora';
  } else {
    const pct = Math.round(Number(matricula?.progresso_pct) || 0);
    titulo = `${quem}, o curso continua à sua espera`;
    corpo = `Está inscrito(a) em <strong>${t}</strong> e ainda não o concluiu (${pct}% feito).${dias != null ? (dias >= 0 ? ` Faltam <strong>${dias} dias</strong> para o prazo.` : ` O prazo terminou há <strong>${Math.abs(dias)} dias</strong>.`) : ''}`;
    cta = 'Continuar o curso';
  }
  const extra = mensagem ? `<p style="margin:12px 0;padding:10px 12px;border-left:3px solid #7c3aed;background:#f5f3ff;color:#1e1b4b">${esc(mensagem).replace(/\n/g, '<br>')}</p>` : '';
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:600px"><h2 style="margin:0 0 10px;font-size:18px">${titulo}</h2><p style="line-height:1.6">${corpo}</p>${extra}<p style="margin:18px 0"><a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${cta}</a></p><p style="color:#64748b;font-size:12px">Universidade Corporativa · SGA.</p></div>`;
  return { subject: `[Formação] ${estado === 'em_falta' || !matricula ? 'Formação obrigatória em falta' : estado === 'expirado' ? 'Certificação expirada' : estado === 'a_expirar' ? 'Certificação a expirar' : 'Lembrete'} — ${curso.titulo}`, html };
}

// Envia (se o email for entregável) e regista sempre. Devolve { entregue, estado }.
export async function enviarLembrete({ curso, matricula = null, email, nome, por, mensagem = '', externas = [] }) {
  const dest = String(email || matricula?.aluno_email || '').toLowerCase();
  if (!dest || !curso) throw new Error('Destinatário ou curso em falta.');
  const est = estadoFormacao(curso, matricula, { obrigatorio: true, externas });
  const baseUrl = await getPublicBaseUrl().catch(() => '');
  const { subject, html } = textoLembrete({ curso, matricula, nome: nome || matricula?.aluno_nome || dest, estado: est.estado, dias: est.dias, validoAte: est.validoAte, baseUrl, mensagem });
  const entregue = ENTREGAVEL.test(dest);
  if (entregue) await sendEmailDirect({ to: dest, subject, html });
  await NotificacaoFormacao.create({
    tipo: 'lembrete_manual', chave: `lembrete_manual:${matricula?.id || curso.id}:${dest}:${Date.now()}`, destinatario: dest,
    curso_id: curso.id, matricula_id: matricula?.id || null, entregue,
    detalhe: { por: por || null, estado: est.estado, estado_label: ESTADOS[est.estado]?.label || est.estado, mensagem: mensagem || null, assunto: subject },
  }).catch(() => { /* o registo é secundário ao envio */ });
  return { entregue, estado: est.estado };
}
