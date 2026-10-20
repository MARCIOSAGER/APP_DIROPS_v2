// Lógica pura da edição de documentos (Fase F0: reserva para edição e revisões em rascunho).
// Sem React nem Supabase, para se testar à parte (src/documentos/__tests__/edicaoLogica.test.js). As regras de
// verdade estão na base de dados (migração 181: doc_reservar / doc_libertar e o trigger em documento_versao);
// isto serve só para o ecrã mostrar o botão certo e dizer, antes de enviar, porque é que não vai dar.

export const DIAS_RESERVA = 7;
const minuscula = (v) => String(v ?? '').trim().toLowerCase();
const instante = (v) => {
  if (!v) return NaN;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
};

// Estado de uma linha de documento_reserva: 'livre' (não há linha), 'activa' ou 'expirada'.
// Uma reserva sem data de expiração legível conta como activa: na dúvida, protege-se o trabalho de quem a fez.
export function estadoReserva(reserva, agora = new Date()) {
  if (!reserva || !reserva.reservado_por) return 'livre';
  const fim = instante(reserva.expira_em);
  if (Number.isNaN(fim)) return 'activa';
  return fim > instante(agora) ? 'activa' : 'expirada';
}

export const reservaActiva = (reserva, agora = new Date()) => estadoReserva(reserva, agora) === 'activa';
export const reservadaPorMim = (reserva, email) => !!reserva && !!email && minuscula(reserva.reservado_por) === minuscula(email);
// Activa e de outra pessoa: é isto que trava o carregamento de uma revisão nova.
export const reservadaPorOutro = (reserva, email, agora = new Date()) => reservaActiva(reserva, agora) && !reservadaPorMim(reserva, email);

// Que botões aparecem. `podeEditar` = a pessoa pode editar ESTE documento (gestor, ou editor que o criou ou é
// responsável) — o mesmo critério de pode_editar_documento() na base.
//   reservar: livre ou expirada (e pode editar); renovar: é minha e está activa;
//   libertar: é minha (activa ou expirada) ou expirada e posso editar; forcar: activa, de outro, e sou gestor.
export function accoesReserva({ reserva, email, podeEditar = false, gestor = false, agora = new Date() } = {}) {
  const estado = estadoReserva(reserva, agora);
  const minha = reservadaPorMim(reserva, email);
  return {
    estado,
    minha,
    reservar: !!podeEditar && !!email && estado !== 'activa',
    renovar: !!podeEditar && minha && estado === 'activa',
    libertar: estado !== 'livre' && (minha || (estado === 'expirada' && !!podeEditar)),
    forcar: estado === 'activa' && !minha && !!gestor && !!podeEditar,
  };
}

// Pode libertar esta reserva? 'libertar' | 'forcar' | null (as mesmas regras da doc_libertar).
export function modoLibertar({ reserva, email, gestor = false, podeEditar = false, agora = new Date() } = {}) {
  const a = accoesReserva({ reserva, email, gestor, podeEditar, agora });
  if (a.libertar) return 'libertar';
  if (a.forcar) return 'forcar';
  return null;
}

// Nome a mostrar no aviso «Em edição por X».
export const quemReservou = (reserva) => (reserva?.reservado_nome || reserva?.reservado_por || 'outra pessoa');

// Mensagem que trava o carregamento de uma revisão nova (null = pode carregar).
export function bloqueioCarregamento(reserva, email, { agora = new Date(), fmt = (d) => String(d ?? '') } = {}) {
  if (!reservadaPorOutro(reserva, email, agora)) return null;
  return `Este documento está reservado para edição por ${quemReservou(reserva)} desde ${fmt(reserva.reservado_em)}. `
    + 'Só essa pessoa pode carregar uma revisão nova. Peça-lhe que o liberte, ou a um gestor que force a libertação.';
}

// ── revisões em rascunho ───────────────────────────────────────────────────
// Modelo já em uso (ex. MA-FNLU-MOA-001: v8 PDF em vigor + v9 .docx com estado «fonte»): o PDF e o ficheiro-fonte
// da MESMA revisão são duas linhas de documento_versao com números seguidos. O PDF é a revisão (aqui «rascunho»);
// o fonte fica logo a seguir com estado «fonte» e rótulo «Fonte editável (.docx) — <rótulo da revisão>», que é
// como a ficha o reconhece e o tira da sequência de revisões. Sem PDF (p.ex. um rascunho só em .docx, vindo do
// editor), o próprio .docx é a revisão em rascunho.
const extensao = (nome) => {
  const n = String(nome || '');
  const i = n.lastIndexOf('.');
  return i < 0 ? '' : n.slice(i + 1).toLowerCase();
};
export const rotuloFonte = (rotulo, nomeFicheiro) => {
  const ext = extensao(nomeFicheiro) || 'docx';
  return `Fonte editável (.${ext})${rotulo ? ` — ${rotulo}` : ''}`;
};

// Número da próxima linha de documento_versao (único por documento).
export function proximaVersao(versoes = [], versaoActualDoc = 0) {
  const nums = (Array.isArray(versoes) ? versoes : []).map(v => Number(v?.versao) || 0);
  return Math.max(Number(versaoActualDoc) || 0, 0, ...nums) + 1;
}

// Plano das linhas a inserir. ficheiros: [{nome, papel:'pdf'|'fonte', ...}] — no máximo um de cada papel.
// Devolve [{ficheiro, versao, estado, rotulo, nota}] pela ordem de inserção. Atira com mensagem em português.
export function planoVersoesRascunho({ ficheiros = [], rotulo = '', nota = '', proxima = 1 } = {}) {
  const lista = (Array.isArray(ficheiros) ? ficheiros : []).filter(Boolean);
  if (!lista.length) throw new Error('Escolha pelo menos um ficheiro para a revisão.');
  for (const f of lista) {
    if (f.papel !== 'pdf' && f.papel !== 'fonte') throw new Error(`Papel de ficheiro desconhecido: ${f.papel}. Use «pdf» ou «fonte».`);
  }
  const pdfs = lista.filter(f => f.papel === 'pdf');
  const fontes = lista.filter(f => f.papel === 'fonte');
  if (pdfs.length > 1 || fontes.length > 1) throw new Error('Uma revisão leva um PDF e, no máximo, um ficheiro-fonte.');
  const pdf = pdfs[0] || null;
  const fonte = fontes[0] || null;
  if (pdf && extensao(pdf.nome) !== 'pdf') throw new Error('O ficheiro da revisão tem de ser um PDF: é o PDF que se aprova, se carimba e se distribui.');
  if (fonte && extensao(fonte.nome) === 'pdf') throw new Error('O ficheiro-fonte é o original editável (.docx, .xlsx…), não um PDF.');

  const r = String(rotulo || '').trim();
  const n = String(nota || '').trim();
  const base = Number(proxima) || 1;
  const rotuloRev = r || String(base);
  const plano = [];
  if (pdf) {
    plano.push({ ficheiro: pdf, versao: base, estado: 'rascunho', rotulo: rotuloRev, nota: n || null });
    if (fonte) {
      plano.push({
        ficheiro: fonte, versao: base + 1, estado: 'fonte', rotulo: rotuloFonte(rotuloRev, fonte.nome),
        nota: `Ficheiro-fonte da revisão v${base} (rascunho).${n ? ` ${n}` : ''}`,
      });
    }
  } else {
    plano.push({ ficheiro: fonte, versao: base, estado: 'rascunho', rotulo: rotuloRev, nota: n || 'Rascunho em formato editável (falta o PDF para aprovação).' });
  }
  return plano;
}
