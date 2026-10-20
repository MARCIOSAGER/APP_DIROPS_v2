// Papéis do regime AVSEC, em PDF nativo (jsPDF, nunca captura de ecrã — ver `kpis_relatorios_nativos_jspdf`).
//
// São papéis para entregar, não ecrãs para olhar. Cada um existe porque a lei pede uma coisa que só em papel se
// pode cumprir:
//
//   • LISTA DE PÁGINAS EFECTIVAS — Instrutivo 32.039.001.A (Despacho n.º 4442/25), secção XIII, alínea k): vai no
//     INÍCIO DO VOLUME. O detentor compara a lista com as folhas que tem na mão; por isso a tabela leva a página,
//     a revisão da página e a data de efectivação, e as canceladas vão marcadas em vez de desaparecerem (o
//     detentor tem de saber que aquela página SAIU, senão fica com ela lá dentro).
//   • COMPARAÇÃO ENTRE DUAS REVISÕES — é a folha de trabalho de quem actualiza a cópia: o que entra, o que sai,
//     o que é substituído (alínea g) do n.º 2 da secção XIV).
//   • FOLHA DE CONFERÊNCIA — secção XIV, n.º 2, alínea i): a conferência é página a página, contra a LPE, e
//     verifica quatro coisas. A folha leva as quatro por escrito e espaço para a assinatura de quem conferiu,
//     porque a conferência é feita de pé, ao lado do armário, e não em frente a um ecrã.
//   • REGISTO DE CREDENCIADOS — secção XIV, n.º 2, alínea d) e alínea e), segunda parte: «bem como apresentação
//     por ocasião de inspecção». É a lista que se mostra ao inspector.
//
// Todos levam o logótipo da SGA e saem em paisagem quando a tabela é larga, como o resto dos relatórios do
// projecto (`relatorios-paisagem-cores-padrao`).
import {
  createPdfDoc, addHeader, addFooter, addTable, addSectionTitle, addKeyValuePairs, checkPageBreak,
  loadImageAsBase64, PDF,
} from '@/lib/pdfTemplate';
import { nomeFicheiro } from '@/lib/formacaoExport';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import { ROTULO_ACCAO_PAGINA, ROTULO_DIFERENCA, ROTULO_ESTADO_COPIA, ROTULO_ESTADO_CREDENCIAL, ROTULO_SUPORTE, nomeSemestre } from '../../hooksAvsec';

const FONTE_PSA = 'Instrutivo 32.039.001.A (Despacho n.º 4442/25)';
const SISTEMA = 'Portal de Documentos — SGA';

// Logótipo da SGA — nunca o do sistema de origem. Sem ele, vai sem logótipo em vez de ir com outro qualquer.
async function logoSga() {
  try { return await loadImageAsBase64('/logo-sga.png'); } catch { return null; }
}
const identidade = (doc) => [doc?.numero, doc?.titulo].filter(Boolean).join(' — ') || 'Documento sem título';
const hoje = () => new Date().toLocaleDateString('pt-PT');

// ── CSV, para quem quer trabalhar os dados ──────────────────────────────────
// Ponto e vírgula e BOM: é o que o Excel em português abre sem fazer perguntas.
const csvCampo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function descarregarCsv(base, cabecalho, linhas) {
  const csv = '﻿' + [cabecalho, ...linhas].map(l => l.map(csvCampo).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nomeFicheiro(base)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ── Lista de Páginas Efectivas ──────────────────────────────────────────────
export const COLUNAS_LEP = ['Página', 'Volume', 'Capítulo', 'Revisão', 'Data de Efectivação', 'Situação'];
export const celulasLep = (p) => [
  p.pagina || '',
  p.volume || '',
  p.capitulo || p.titulo || '',
  p.revisao || '',
  p.efectiva_em ? fmtData(p.efectiva_em) : '',
  ROTULO_ACCAO_PAGINA[p.accao] || p.accao || '',
];

export async function pdfListaPaginasEfectivas({ documento, edicao, paginas, regime, geradoPor }) {
  const doc = await createPdfDoc({ orientation: 'portrait' });
  const logo = await logoSga();
  const efectivas = paginas.filter(p => p.accao !== 'cancelada');
  const canceladas = paginas.filter(p => p.accao === 'cancelada');
  let y = addHeader(doc, {
    title: 'Lista de Páginas Efectivas',
    subtitle: `${FONTE_PSA}, secção XIII, alínea k)`,
    logoBase64: logo,
    date: hoje(),
    meta: [
      `Documento: ${identidade(documento)}`,
      `Revisão do volume: ${edicao?.revisao ?? '—'}`,
      edicao?.volume || regime?.volume ? `Volume: ${edicao?.volume || regime?.volume}` : null,
      edicao?.emitida_em ? `Emitida em: ${fmtData(edicao.emitida_em)}` : null,
      `Páginas efectivas: ${efectivas.length}${canceladas.length ? ` (e ${canceladas.length} cancelada${canceladas.length === 1 ? '' : 's'})` : ''}`,
      regime?.guarda_nome ? `Guarda e controlo: ${regime.guarda_nome}` : null,
      geradoPor ? `Gerado por: ${geradoPor}` : null,
    ].filter(Boolean),
  });

  if (!paginas.length) {
    doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.muted);
    doc.text('Esta lista ainda não tem páginas. Uma lista vazia não prova nada ao detentor.', PDF.margin.left, y + 4);
  } else {
    y = addTable(doc, y, {
      columns: [
        { label: 'Página', width: 24 },
        { label: 'Volume', width: 20 },
        { label: 'Capítulo', width: 54 },
        { label: 'Revisão', width: 22 },
        { label: 'Data de Efectivação', width: 34 },
        { label: 'Situação', width: 28 },
      ],
      rows: paginas.map(celulasLep),
    }) + 6;
  }

  // A conferência é o passo seguinte desta folha: diz-se aqui, porque é aqui que ela se usa.
  y = checkPageBreak(doc, y, 34);
  y = addSectionTitle(doc, y, 'Conferência da cópia');
  doc.setFontSize(PDF.font.small); doc.setTextColor(...PDF.colors.body);
  const largura = PDF.page.portrait.w - PDF.margin.left - PDF.margin.right;
  const aviso = doc.splitTextToSize(
    'Confira a sua cópia contra esta lista pelo menos uma vez por semestre, verificando que nenhuma página foi '
    + 'retirada, inserida, modificada, nem tem alteração manuscrita '
    + `(${FONTE_PSA}, secção XIV, n.º 2, alínea i)). As páginas assinaladas como canceladas devem ser retiradas do volume.`,
    largura);
  doc.text(aviso, PDF.margin.left, y + 3);
  y += aviso.length * 4.2 + 8;

  y = checkPageBreak(doc, y, 26);
  doc.setDrawColor(...PDF.colors.separator);
  doc.line(PDF.margin.left, y + 10, PDF.margin.left + 78, y + 10);
  doc.line(PDF.margin.left + 92, y + 10, PDF.margin.left + 170, y + 10);
  doc.setFontSize(PDF.font.caption); doc.setTextColor(...PDF.colors.muted);
  doc.text('Detentor da cópia (nome e assinatura)', PDF.margin.left, y + 14);
  doc.text('Data', PDF.margin.left + 92, y + 14);

  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: SISTEMA });
  doc.save(`${nomeFicheiro(`LPE_${documento?.numero || 'documento'}_rev_${edicao?.revisao || ''}`)}.pdf`);
}

// ── comparação entre duas revisões ──────────────────────────────────────────
export const COLUNAS_COMPARACAO = ['Página', 'Revisão anterior', 'Data anterior', 'Revisão nova', 'Data nova', 'O que fazer'];
const QUE_FAZER = {
  igual: 'Nada — a página mantém-se',
  substituida: 'Substituir a folha pela nova',
  acrescentada: 'Inserir a folha nova',
  retirada: 'Retirar a folha do volume',
  cancelada: 'Retirar a folha (cancelada)',
};
export const celulasComparacao = (l) => [
  l.pagina || '',
  l.revisao_a || '—',
  l.efectiva_a ? fmtData(l.efectiva_a) : '—',
  l.revisao_b || '—',
  l.efectiva_b ? fmtData(l.efectiva_b) : '—',
  QUE_FAZER[l.diferenca] || ROTULO_DIFERENCA[l.diferenca] || l.diferenca || '',
];

// Sai só o que muda. Uma folha de trabalho com 200 linhas «nada» faz com que ninguém leia as sete que importam.
export async function pdfComparacaoLep({ documento, edicaoA, edicaoB, linhas, geradoPor }) {
  const mudam = linhas.filter(l => l.diferenca !== 'igual');
  const doc = await createPdfDoc({ orientation: 'landscape' });
  const logo = await logoSga();
  let y = addHeader(doc, {
    title: 'Páginas a substituir, inserir e retirar',
    subtitle: `${FONTE_PSA}, secção XIV, n.º 2, alínea g)`,
    logoBase64: logo,
    date: hoje(),
    meta: [
      `Documento: ${identidade(documento)}`,
      `Da revisão ${edicaoA?.revisao ?? '—'}${edicaoA?.emitida_em ? ` (${fmtData(edicaoA.emitida_em)})` : ''} para a revisão ${edicaoB?.revisao ?? '—'}${edicaoB?.emitida_em ? ` (${fmtData(edicaoB.emitida_em)})` : ''}`,
      `Páginas a mexer: ${mudam.length} de ${linhas.length}`,
      geradoPor ? `Gerado por: ${geradoPor}` : null,
    ].filter(Boolean),
  });
  if (!mudam.length) {
    doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.muted);
    doc.text('As duas revisões têm exactamente as mesmas páginas, nas mesmas revisões. Não há nada a substituir.', PDF.margin.left, y + 4);
  } else {
    y = addTable(doc, y, {
      columns: [
        { label: 'Página', width: 26 },
        { label: 'Revisão anterior', width: 32 },
        { label: 'Data anterior', width: 32 },
        { label: 'Revisão nova', width: 30 },
        { label: 'Data nova', width: 32 },
        { label: 'O que fazer', width: 115 },
      ],
      rows: mudam.map(celulasComparacao),
    });
  }
  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: SISTEMA });
  doc.save(`${nomeFicheiro(`LPE_alteracoes_${documento?.numero || 'documento'}`)}.pdf`);
}

// ── folha de conferência semestral ──────────────────────────────────────────
// Leva as quatro perguntas da lei por escrito, uma linha por cópia e espaço para assinar. É para imprimir e levar
// para junto do armário: a conferência faz-se com o volume na mão.
export async function pdfFolhaConferencia({ documento, ciclo, itens, copias, regime, geradoPor }) {
  const doc = await createPdfDoc({ orientation: 'portrait' });
  const logo = await logoSga();
  const porId = new Map((copias || []).map(c => [c.id, c]));
  let y = addHeader(doc, {
    title: `Conferência semestral — ${nomeSemestre(ciclo?.ano, ciclo?.semestre)}`,
    subtitle: `${FONTE_PSA}, secção XIV, n.º 2, alínea i)`,
    logoBase64: logo,
    date: hoje(),
    meta: [
      `Documento: ${identidade(documento)}`,
      ciclo?.revisao ? `Conferido contra a revisão ${ciclo.revisao} da Lista de Páginas Efectivas` : 'Sem Lista de Páginas Efectivas emitida — emitir antes de conferir',
      `Período: ${fmtData(ciclo?.periodo_inicio)} a ${fmtData(ciclo?.periodo_fim)}`,
      ciclo?.prazo ? `Prazo: ${fmtData(ciclo.prazo)}` : null,
      `Cópias a conferir: ${itens.length}`,
      regime?.guarda_nome ? `Responsável pela guarda e controlo: ${regime.guarda_nome}` : null,
      geradoPor ? `Gerado por: ${geradoPor}` : null,
    ].filter(Boolean),
  });

  y = addSectionTitle(doc, y, 'O que se verifica em cada cópia');
  doc.setFontSize(PDF.font.small); doc.setTextColor(...PDF.colors.body);
  const largura = PDF.page.portrait.w - PDF.margin.left - PDF.margin.right;
  for (const linha of [
    '1. Nenhuma página foi retirada do volume.',
    '2. Nenhuma página foi inserida sem constar da Lista de Páginas Efectivas.',
    '3. Nenhuma página foi modificada.',
    '4. Nenhuma página tem alteração manuscrita.',
  ]) {
    const partes = doc.splitTextToSize(linha, largura);
    y = checkPageBreak(doc, y, partes.length * 4.2 + 2);
    doc.text(partes, PDF.margin.left, y + 3);
    y += partes.length * 4.2 + 1;
  }
  y += 5;

  y = checkPageBreak(doc, y, 20);
  y = addTable(doc, y, {
    columns: [
      { label: 'Cópia nº', width: 16, align: 'right' },
      { label: 'Detentor', width: 50 },
      { label: 'Local de guarda', width: 38 },
      { label: 'Revisão na posse', width: 24 },
      { label: 'Conforme (S/N)', width: 24 },
      { label: 'Páginas afectadas', width: 30 },
    ],
    rows: itens.map(i => {
      const c = porId.get(i.copia_id) || {};
      return [
        String(c.numero ?? ''),
        [c.detentor_nome, c.detentor_email].filter(Boolean).join(' · '),
        c.local_guarda || '',
        c.revisao || '',
        i.estado === 'conferida' ? (i.conforme ? 'S' : 'N') : '',
        i.paginas_afectadas || '',
      ];
    }),
  }) + 8;

  y = checkPageBreak(doc, y, 26);
  doc.setDrawColor(...PDF.colors.separator);
  doc.line(PDF.margin.left, y + 10, PDF.margin.left + 78, y + 10);
  doc.line(PDF.margin.left + 92, y + 10, PDF.margin.left + 170, y + 10);
  doc.setFontSize(PDF.font.caption); doc.setTextColor(...PDF.colors.muted);
  doc.text('Conferido por (nome e assinatura)', PDF.margin.left, y + 14);
  doc.text('Data', PDF.margin.left + 92, y + 14);

  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: SISTEMA });
  doc.save(`${nomeFicheiro(`Conferencia_${documento?.numero || 'documento'}_${ciclo?.ano}_S${ciclo?.semestre}`)}.pdf`);
}

// ── registo de credenciados ─────────────────────────────────────────────────
export const COLUNAS_CREDENCIADOS = [
  'Nome', 'Cargo', 'Entidade', 'Correio electrónico', 'Aeroporto', 'Âmbito',
  'Credenciado em', 'Válida até', 'Estado', 'Autorizado por', 'Necessidade de conhecimento', 'Cópias',
];
export const celulasCredenciado = (c, { nomeAeroporto } = {}) => [
  c.nome || '',
  c.cargo || '',
  c.entidade || (c.interno ? 'SGA' : ''),
  c.email || '',
  c.aeroporto_icao || nomeAeroporto?.(c.aeroporto_id) || 'Todos',
  c.processo_nome || c.processo_codigo || 'Todos os documentos classificados',
  c.credenciado_em ? fmtData(c.credenciado_em) : '',
  c.valida_ate ? fmtData(c.valida_ate) : 'Sem termo',
  ROTULO_ESTADO_CREDENCIAL[c.estado_efectivo || c.estado] || '',
  c.autorizado_por || '',
  c.necessidade_saber || '',
  String(c.copias_activas ?? ''),
];

export async function pdfRegistoCredenciados({ credenciados, filtros = [], nomeAeroporto, geradoPor }) {
  const doc = await createPdfDoc({ orientation: 'landscape' });
  const logo = await logoSga();
  let y = addHeader(doc, {
    title: 'Registo de pessoas credenciadas a possuir cópia',
    subtitle: `${FONTE_PSA}, secção XIV, n.º 2, alíneas d), e) e j)`,
    logoBase64: logo,
    date: hoje(),
    meta: [
      ...filtros,
      `Credenciados listados: ${credenciados.length}`,
      geradoPor ? `Gerado por: ${geradoPor}` : null,
    ].filter(Boolean),
  });
  if (!credenciados.length) {
    doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.muted);
    doc.text('Nenhuma pessoa corresponde aos filtros aplicados.', PDF.margin.left, y + 4);
  } else {
    y = addTable(doc, y, {
      columns: [
        { label: 'Nome', width: 44 },
        { label: 'Cargo', width: 34 },
        { label: 'Entidade', width: 26 },
        { label: 'Aeroporto', width: 20 },
        { label: 'Âmbito', width: 40 },
        { label: 'Credenciado', width: 22 },
        { label: 'Válida até', width: 22 },
        { label: 'Estado', width: 22 },
        { label: 'Autorizado por', width: 32 },
        { label: 'Cópias', width: 14, align: 'right' },
      ],
      rows: credenciados.map(c => {
        const t = celulasCredenciado(c, { nomeAeroporto });
        return [t[0], t[1], t[2], t[4], t[5], t[6], t[7], t[8], t[9], t[11]];
      }),
    }) + 6;
    // A necessidade de conhecimento é a justificação da credencial e não cabe numa coluna: vai por extenso.
    y = checkPageBreak(doc, y, 20);
    y = addSectionTitle(doc, y, 'Necessidade de conhecimento, por extenso');
    doc.setFontSize(PDF.font.small);
    const largura = PDF.page.landscape.w - PDF.margin.left - PDF.margin.right;
    for (const c of credenciados) {
      const partes = doc.splitTextToSize(`${c.nome || c.email} — ${c.necessidade_saber || '(sem fundamento escrito)'}`, largura);
      y = checkPageBreak(doc, y, partes.length * 4.2 + 3);
      doc.setTextColor(...PDF.colors.dark);
      doc.text(partes, PDF.margin.left, y + 3);
      y += partes.length * 4.2 + 2;
    }
  }
  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: SISTEMA });
  doc.save(`${nomeFicheiro('Registo_de_credenciados')}.pdf`);
}

// ── lista de distribuição / cópias controladas ──────────────────────────────
export const COLUNAS_COPIAS = [
  'Cópia nº', 'Documento', 'Detentor', 'Cargo', 'Entidade', 'Suporte', 'Local de guarda',
  'Revisão na posse', 'Entregue em', 'Entregue por', 'Recebido em', 'Estado',
];
export const celulasCopia = (c, { identidadeDoc } = {}) => [
  String(c.numero ?? ''),
  identidadeDoc?.(c.documento_id) || '',
  [c.detentor_nome, c.detentor_email].filter(Boolean).join(' · '),
  c.detentor_cargo || '',
  c.entidade || '',
  ROTULO_SUPORTE[c.suporte] || c.suporte || '',
  c.local_guarda || '',
  c.revisao || '',
  c.entregue_em ? fmtData(c.entregue_em) : '',
  c.entregue_por || '',
  c.recebido_em ? fmtData(c.recebido_em) : '',
  ROTULO_ESTADO_COPIA[c.estado] || c.estado || '',
];

// A Lista de Distribuição que vai no início do volume (Apêndice, I — Generalidades, n.º 6), com linhas de
// assinatura: o recebimento prova-se por assinatura de quem recebeu, não por um campo numa base de dados.
export async function pdfListaDistribuicao({ documento, copias, regime, geradoPor }) {
  const doc = await createPdfDoc({ orientation: 'portrait' });
  const logo = await logoSga();
  const activas = copias.filter(c => c.estado === 'activa');
  let y = addHeader(doc, {
    title: 'Lista de Distribuição',
    subtitle: `${FONTE_PSA}, Apêndice (I — Generalidades, n.º 6) e secção XIV, n.º 2, alínea d)`,
    logoBase64: logo,
    date: hoje(),
    meta: [
      `Documento: ${identidade(documento)}`,
      regime?.volume ? `Volume: ${regime.volume}` : null,
      `Cópias controladas em poder de detentores: ${activas.length} de ${copias.length} emitidas`,
      regime?.guarda_nome ? `Guarda e controlo: ${regime.guarda_nome}${regime.guarda_telefone ? ` · ${regime.guarda_telefone}` : ''}` : null,
      geradoPor ? `Gerado por: ${geradoPor}` : null,
    ].filter(Boolean),
  });
  if (!copias.length) {
    doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.muted);
    doc.text('Ainda não há cópias controladas registadas para este documento.', PDF.margin.left, y + 4);
  } else {
    y = addTable(doc, y, {
      columns: [
        { label: 'Cópia nº', width: 16, align: 'right' },
        { label: 'Detentor', width: 48 },
        { label: 'Cargo / entidade', width: 40 },
        { label: 'Suporte', width: 22 },
        { label: 'Revisão', width: 18 },
        { label: 'Entregue', width: 22 },
        { label: 'Assinatura de recepção', width: 36 },
      ],
      rows: copias.map(c => [
        String(c.numero ?? ''),
        [c.detentor_nome, c.detentor_email].filter(Boolean).join(' · '),
        [c.detentor_cargo, c.entidade].filter(Boolean).join(' · '),
        ROTULO_SUPORTE[c.suporte] || '',
        c.revisao || '',
        c.entregue_em ? fmtData(c.entregue_em) : '',
        c.recebido_em ? fmtData(c.recebido_em) : '',
      ]),
    }) + 6;
  }
  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: SISTEMA });
  doc.save(`${nomeFicheiro(`Lista_de_distribuicao_${documento?.numero || 'documento'}`)}.pdf`);
}

// ── registo inviolável das conferências ─────────────────────────────────────
export const COLUNAS_REGISTO = ['Quando', 'Acto', 'Quem', 'Estado antes', 'Estado depois', 'Achados', 'Páginas afectadas', 'Nota'];
export const celulasRegisto = (r, { rotuloActo }) => [
  r.em ? fmtDataHora(r.em) : '',
  rotuloActo?.(r.acto) || r.acto || '',
  r.por_email || '',
  r.estado_antes || '',
  r.estado_depois || '',
  (r.achados || []).join(', '),
  r.paginas_afectadas || '',
  r.nota || '',
];
