// Sessões presenciais / online / híbridas: regras puras (vagas, estado, textos, convite .ics) partilhadas
// por frontend e scripts node.
export const ESTADO_SESSAO = {
  agendada: { label: 'Agendada', cor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200' },
  realizada: { label: 'Realizada', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' },
  cancelada: { label: 'Cancelada', cor: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};
export const ESTADO_INSCRICAO = {
  inscrito: { label: 'Inscrito', cor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200' },
  lista_espera: { label: 'Lista de espera', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200' },
  presente: { label: 'Presente', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' },
  ausente: { label: 'Ausente', cor: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200' },
  cancelado: { label: 'Cancelado', cor: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
export const MODALIDADE = {
  presencial: { label: 'Presencial', curto: 'Presencial', cor: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200' },
  online: { label: 'Online (videochamada)', curto: 'Online', cor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200' },
  hibrida: { label: 'Híbrida (sala + online)', curto: 'Híbrida', cor: 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200' },
};
export const PLATAFORMAS = { teams: 'Microsoft Teams', meet: 'Google Meet', zoom: 'Zoom', outra: 'Outra' };
export const MODO = { presencial: 'Presencial', online: 'Online' };
export const OCUPA_VAGA = new Set(['inscrito', 'presente', 'ausente']);

export const modoDe = (sessao, inscricao) => inscricao?.modo || (sessao?.modalidade === 'online' ? 'online' : 'presencial');
export const temLink = (sessao) => !!(sessao && sessao.modalidade !== 'presencial' && String(sessao.link_online || '').trim());

// vagas contam só os presenciais (o online não tem limite); presenças separadas por modo
export function ocupacaoSessao(sessao, inscricoes = []) {
  const minhas = inscricoes.filter(i => i.sessao_id === sessao.id);
  const activas = minhas.filter(i => OCUPA_VAGA.has(i.estado));
  const ocupadas = activas.filter(i => modoDe(sessao, i) === 'presencial').length;
  const online = activas.filter(i => modoDe(sessao, i) === 'online').length;
  const espera = minhas.filter(i => i.estado === 'lista_espera').length;
  const presentes = minhas.filter(i => i.estado === 'presente').length;
  const presentesOnline = minhas.filter(i => i.estado === 'presente' && modoDe(sessao, i) === 'online').length;
  const vagas = sessao.vagas == null ? null : Number(sessao.vagas);
  return { ocupadas, online, inscritos: ocupadas + online, espera, presentes, presentesOnline, presentesPresencial: presentes - presentesOnline, vagas, livres: vagas == null ? null : Math.max(0, vagas - ocupadas), cheia: vagas != null && ocupadas >= vagas };
}

// Fase temporal da sessão: futura | a_decorrer | passada (independente do estado administrativo)
export function faseSessao(sessao, agora = new Date()) {
  const ini = new Date(sessao.inicio), fim = new Date(sessao.fim);
  if (agora < ini) return 'futura';
  if (agora <= fim) return 'a_decorrer';
  return 'passada';
}
// o link da sessão online mostra-se desde 30 min antes até ao fim
export function linkAberto(sessao, agora = new Date()) {
  if (!temLink(sessao)) return false;
  const ini = new Date(sessao.inicio).getTime() - 30 * 60000, fim = new Date(sessao.fim).getTime();
  const t = agora.getTime();
  return t >= ini && t <= fim;
}

export function podeInscrever(sessao, inscricaoAtual, agora = new Date()) {
  if (!sessao || sessao.estado !== 'agendada' || sessao.deleted_at) return false;
  if (faseSessao(sessao, agora) === 'passada') return false;
  return !inscricaoAtual || inscricaoAtual.estado === 'cancelado';
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
// "seg 12 out 2026 · 09:00–12:30" (mesmo dia) ou "12 out 09:00 → 13 out 17:00"
export function fmtPeriodoSessao(sessao) {
  if (!sessao?.inicio || !sessao?.fim) return '';
  const a = new Date(sessao.inicio), b = new Date(sessao.fim);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const mesmoDia = a.toDateString() === b.toDateString();
  const dia = (d) => `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  return mesmoDia ? `${dia(a)} · ${hhmm(a)}–${hhmm(b)}` : `${dia(a)} ${hhmm(a)} → ${dia(b)} ${hhmm(b)}`;
}
export const duracaoSessaoMin = (s) => (s?.inicio && s?.fim ? Math.max(0, Math.round((new Date(s.fim) - new Date(s.inicio)) / 60000)) : 0);
export const localTexto = (s) => [s?.local, s?.aeroporto].filter(Boolean).join(' · ');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Email de convocatória / lembrete / cancelamento de sessão (gestor e dispatcher diário)
export function textoConvocatoria({ sessao, curso, nome, tipo = 'convocatoria', baseUrl = '', mensagem = '', modo = null }) {
  const quem = nome ? esc(String(nome).split(' ')[0]) : 'Colega';
  const periodo = esc(fmtPeriodoSessao(sessao));
  const mod = MODALIDADE[sessao.modalidade] || MODALIDADE.presencial;
  const modoAluno = modo || modoDe(sessao, null);
  const online = sessao.modalidade === 'online' || (sessao.modalidade === 'hibrida' && modoAluno === 'online');
  const link = temLink(sessao) ? String(sessao.link_online).trim() : '';
  const tituloTipo = online ? 'sessão online' : 'sessão presencial';
  const titulo = tipo === 'lembrete' ? `${quem}, a sua ${tituloTipo} é amanhã` : tipo === 'cancelada' ? `${quem}, a ${tituloTipo} foi cancelada` : tipo === 'lista_espera' ? `${quem}, ficou em lista de espera` : `${quem}, está convocado(a) para uma ${tituloTipo}`;
  const linhas = [
    `<strong>${esc(curso?.titulo || '')}</strong> — ${esc(sessao.titulo)}`,
    `<strong>Quando:</strong> ${periodo}`,
    `<strong>Modalidade:</strong> ${esc(mod.label)}${sessao.modalidade === 'hibrida' ? ` — participa <strong>${modoAluno === 'online' ? 'online' : 'presencialmente'}</strong>` : ''}`,
    !online && localTexto(sessao) ? `<strong>Onde:</strong> ${esc(localTexto(sessao))}` : '',
    online && link ? `<strong>Ligação:</strong> <a href="${esc(link)}">${esc(link)}</a>${sessao.plataforma ? ` (${esc(PLATAFORMAS[sessao.plataforma] || sessao.plataforma)})` : ''}` : '',
    sessao.formador_nome ? `<strong>Formador:</strong> ${esc(sessao.formador_nome)}` : '',
    sessao.descricao ? esc(sessao.descricao) : '',
  ].filter(Boolean);
  const extra = mensagem ? `<p style="margin:12px 0;padding:10px 12px;border-left:3px solid #7c3aed;background:#f5f3ff;color:#1e1b4b">${esc(mensagem).replace(/\n/g, '<br>')}</p>` : '';
  const url = `${baseUrl || ''}/universidade/formacao?curso=${curso?.id || sessao.curso_id}`;
  const botoes = tipo === 'cancelada' ? '' : `<p style="margin:18px 0">${online && link ? `<a href="${esc(link)}" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;margin-right:8px">Entrar na sessão online</a>` : ''}<a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Ver o curso e os materiais</a></p>`;
  const rodape = tipo === 'cancelada' ? 'Se já estava inscrito(a), a inscrição foi anulada. ' : online ? 'Entre pela ligação acima à hora marcada; a presença é registada pelo formador (a entrada pela plataforma fica registada). ' : 'A presença é registada pelo formador no fim da sessão. ';
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:600px"><h2 style="margin:0 0 10px;font-size:18px">${titulo}</h2><p style="line-height:1.7">${linhas.join('<br>')}</p>${extra}${botoes}<p style="color:#64748b;font-size:12px">${rodape}O convite em anexo adiciona a sessão ao seu calendário. Universidade Corporativa · SGA.</p></div>`;
  const subject = `[Formação] ${tipo === 'lembrete' ? `Lembrete: ${tituloTipo} amanhã` : tipo === 'cancelada' ? `${online ? 'Sessão online' : 'Sessão presencial'} cancelada` : tipo === 'lista_espera' ? 'Lista de espera — sessão' : `Convocatória — ${tituloTipo}`} — ${curso?.titulo || sessao.titulo}`;
  return { subject, html };
}

// Convite de calendário (RFC 5545) para anexar ao email: METHOD:REQUEST (ou CANCEL) — Outlook/Google adicionam ao calendário.
const icsData = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsTexto = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
export function icsSessao({ sessao, curso, organizadorEmail = 'formacao@sga.co.ao', cancelar = false, sequencia = 0 }) {
  const link = temLink(sessao) ? String(sessao.link_online).trim() : '';
  const local = sessao.modalidade === 'online' ? (link || 'Online') : [localTexto(sessao), sessao.modalidade === 'hibrida' && link ? `Online: ${link}` : ''].filter(Boolean).join(' | ');
  const desc = [curso?.titulo, sessao.descricao, link ? `Ligação: ${link}` : '', sessao.formador_nome ? `Formador: ${sessao.formador_nome}` : ''].filter(Boolean).join('\n');
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SGA//Universidade Corporativa//PT', `METHOD:${cancelar ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT', `UID:sessao-${sessao.id}@dirops.sga.co.ao`, `DTSTAMP:${icsData(new Date().toISOString())}`, `DTSTART:${icsData(sessao.inicio)}`, `DTEND:${icsData(sessao.fim)}`,
    `SUMMARY:${icsTexto(`[Formação] ${sessao.titulo}`)}`, `DESCRIPTION:${icsTexto(desc)}`, `LOCATION:${icsTexto(local)}`, link ? `URL:${link}` : '',
    `ORGANIZER;CN=Gestão de Formação:mailto:${organizadorEmail}`, `SEQUENCE:${sequencia}`, `STATUS:${cancelar ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${icsTexto(sessao.titulo)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return linhas.join('\r\n') + '\r\n';
}
// base64 do .ics para o campo attachments do send-email (browser e node)
export function icsBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  if (typeof btoa === 'function') { let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); }
  return Buffer.from(bytes).toString('base64');
}
