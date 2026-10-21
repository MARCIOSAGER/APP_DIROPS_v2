// Gerador DOCX dos documentos estruturados do GED — padrão SGA, pacote `docx`, A4 vertical, fonte Arial.
//
//   gerarDocx(doc, opcoes?) -> Promise<Blob>
//
// Mesma estrutura do PDF: capa (secção sem cabeçalho/rodapé) → controlo do documento (histórico de revisões +
// índice como campo TOC do Word, actualizado ao abrir) → corpo com estilos Título 1-4 reais e numeração
// automática (1., 1.1, 1.1.1), listas numeradas/marcadas reais, tabelas (cabeçalho repetido), imagens e caixas
// de nota. Cabeçalho com logo SGA + número + título; rodapé em tabela «Revisão n.º NN/AA | Data | Página X de Y»
// com os campos PAGE / NUMPAGES.
//
// opcoes: { logo?: dataURL | null, logoUrl?: string }

import {
  nomeClasse, dataPt, revisaoPad, textosRodape, textoSimples, carregarLogo, resolverImagens,
  dataUrlParaBytes, dimensoesImagem, larguraPedida, numerarTitulos, limparXml, caixaDoNo, alinhamentoPedido,
} from './comum';
import { conteudoVazio, numerarLegendas } from './contrato';

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// A4 em twips; 1 mm = 56.7 twips; 1 px (96 dpi) = 15 twips
const A4_W = 11906;
const A4_H = 16838;
const MARGEM_LADO = 1134;   // 20 mm
const MARGEM_TOPO = 1531;   // 27 mm
const MARGEM_FUNDO = 1417;  // 25 mm
const LARGURA_UTIL = A4_W - 2 * MARGEM_LADO; // 9638 twips
const TW_PX = 15;

const COR = {
  primaria: '004A99',
  navy: '1E3A5F',
  texto: '0F172A',
  corpo: '334155',
  suave: '64748B',
  claro: '94A3B8',
  borda: 'CBD5E1',
  zebra: 'F8FAFC',
  // caixas: nota azul, atenção âmbar (a antiga «aviso» adivinhada pelo texto), aviso vermelho
  caixa: {
    nota: { fundo: 'EFF6FF', barra: '2563EB' },
    atencao: { fundo: 'FFF7ED', barra: 'D97706' },
    aviso: { fundo: 'FEF2F2', barra: 'DC2626' },
  },
};

const TIPOS_IMAGEM = new Set(['png', 'jpg', 'gif', 'bmp']);

/**
 * Gera o DOCX do documento estruturado.
 * @param {import('./contrato').DocumentoEstruturado} doc
 * @param {{ logo?: string|null, logoUrl?: string }} [opcoes]
 * @returns {Promise<Blob>}
 */
export async function gerarDocx(doc, opcoes = {}) {
  if (!doc || typeof doc !== 'object') throw new Error('Documento estruturado em falta');
  const D = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, Header, Footer,
    TableOfContents, AlignmentType, HeadingLevel, LevelFormat, BorderStyle, WidthType, ShadingType,
    VerticalAlign, PageNumber, TableLayoutType, HeightRule, PageBreak, SimpleField,
  } = D;

  const [logoUrl, imagens] = await Promise.all([carregarLogo(opcoes), resolverImagens(doc)]);
  const cab = doc.cabecalho || {};
  const { seccoes, titulos } = numerarTitulos(doc);
  const legendas = numerarLegendas(doc);
  const ALINHAR = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
  /** { alignment } quando o nó pede alinhamento (attrs.textAlign); vazio nos documentos antigos. */
  const alinhar = (no) => { const a = alinhamentoPedido(no); return a ? { alignment: ALINHAR[a] } : {}; };

  // ─── Texto ───────────────────────────────────────────────────────
  const run = (texto, o = {}) => new TextRun({ text: limparXml(texto), ...o });

  function corridas(nos, base = {}) {
    const out = [];
    for (const n of nos || []) {
      if (!n || typeof n !== 'object') continue;
      if (n.type === 'text') {
        const m = new Set((n.marks || []).map((x) => x?.type));
        out.push(run(n.text || '', {
          bold: base.bold || m.has('bold') || undefined,
          italics: base.italics || m.has('italic') || undefined,
          underline: m.has('underline') ? {} : undefined,
          color: base.color,
          size: base.size,
        }));
      } else if (n.type === 'hardBreak') {
        out.push(new TextRun({ break: 1 }));
      } else {
        const t = textoSimples(n);
        if (t) out.push(run(t, { bold: base.bold, italics: base.italics, color: base.color, size: base.size }));
      }
    }
    return out;
  }

  // ─── Numeração (títulos, marcas, listas numeradas) ───────────────
  const recuoLista = (nivel) => ({ left: 425 * (nivel + 1), hanging: 300 });
  const marcas = ['•', '–', '▪'];
  const configNumeracao = [
    {
      reference: 'titulos',
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 567, hanging: 567 } } } },
        { level: 1, format: LevelFormat.DECIMAL, text: '%1.%2', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 709, hanging: 709 } } } },
        { level: 2, format: LevelFormat.DECIMAL, text: '%1.%2.%3', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 851, hanging: 851 } } } },
        { level: 3, format: LevelFormat.DECIMAL, text: '%1.%2.%3.%4', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 992, hanging: 992 } } } },
      ],
    },
    {
      reference: 'marcas',
      levels: Array.from({ length: 9 }, (_, l) => ({
        level: l, format: LevelFormat.BULLET, text: marcas[l % 3], alignment: AlignmentType.START,
        style: { paragraph: { indent: recuoLista(l) } },
      })),
    },
  ];
  const formatos = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];
  const sufixos = ['.', ')', '.'];
  const refsNumeradas = new Map(); // start → reference
  const refNumerada = (inicio) => {
    const s = Math.max(1, Number(inicio) || 1);
    if (!refsNumeradas.has(s)) {
      const reference = `numerada-${s}`;
      refsNumeradas.set(s, reference);
      configNumeracao.push({
        reference,
        levels: Array.from({ length: 9 }, (_, l) => ({
          level: l, format: formatos[l % 3], text: `%${l + 1}${sufixos[l % 3]}`, alignment: AlignmentType.START,
          start: l === 0 ? s : 1, style: { paragraph: { indent: recuoLista(l) } },
        })),
      });
    }
    return refsNumeradas.get(s);
  };
  let instancia = 0;

  // ─── Blocos ──────────────────────────────────────────────────────
  // ctx: { largura (twips), nivelLista, cor?, bold?, size?, emTabela? }

  function paragrafo(no, ctx, extra = {}) {
    const filhos = corridas(no.content, { bold: ctx.bold, color: ctx.cor, size: ctx.size });
    return new Paragraph({ children: filhos, spacing: { after: ctx.emTabela ? 0 : 100 }, ...alinhar(no), ...extra });
  }

  function titulo(no, ctx) {
    const nivel = Math.min(4, Math.max(2, Number(no.attrs?.level) || 2));
    if (ctx.emTabela) return [paragrafo(no, { ...ctx, bold: true })];
    const hl = [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][nivel];
    const numerado = !!titulos.get(no);
    return [new Paragraph({
      heading: hl,
      children: corridas(no.content),
      ...alinhar(no),
      ...(numerado ? { numbering: { reference: 'titulos', level: nivel - 1 } } : {}),
    })];
  }

  function lista(no, ctx, ordenada) {
    const nivel = ctx.nivelLista || 0;
    const ref = ordenada ? refNumerada(no.attrs?.start) : 'marcas';
    const inst = ++instancia;
    const out = [];
    for (const li of no.content || []) {
      if (!li || typeof li !== 'object') continue;
      const conteudo = li.type === 'listItem' ? (li.content || []) : [li];
      let primeiro = true;
      for (const f of conteudo) {
        if (f?.type === 'paragraph' || (primeiro && f?.type === 'heading')) {
          out.push(new Paragraph({
            children: corridas(f.content, { bold: ctx.bold || f.type === 'heading', color: ctx.cor, size: ctx.size }),
            spacing: { after: 60 },
            ...alinhar(f),
            ...(primeiro
              ? { numbering: { reference: ref, level: Math.min(8, nivel), instance: inst } }
              : { indent: { left: recuoLista(Math.min(8, nivel)).left } }),
          }));
          primeiro = false;
        } else {
          if (primeiro) {
            // item que começa por uma sublista: marcador sozinho
            out.push(new Paragraph({ children: [], numbering: { reference: ref, level: Math.min(8, nivel), instance: inst } }));
            primeiro = false;
          }
          out.push(...blocos([f], { ...ctx, nivelLista: nivel + 1, largura: ctx.largura - 425 }));
        }
      }
      if (primeiro) out.push(new Paragraph({ children: [], numbering: { reference: ref, level: Math.min(8, nivel), instance: inst } }));
    }
    if (!ctx.emTabela && nivel === 0) out.push(new Paragraph({ children: [], spacing: { after: 0, line: 120 } }));
    return out;
  }

  function imagem(no, ctx) {
    const src = String(no.attrs?.src || '');
    const alt = String(no.attrs?.alt || no.attrs?.title || '');
    const cap = legenda(no, 'Figure');
    const dados = dataUrlParaBytes(imagens.get(src));
    const dim = dados && TIPOS_IMAGEM.has(dados.tipo) ? dimensoesImagem(dados.bytes) : null;
    if (!dim || !dim.w || !dim.h) {
      return [new Paragraph({ keepNext: !!cap || undefined, children: [run(`[Imagem indisponível${alt ? `: ${alt}` : ''}]`, { italics: true, color: COR.suave })] }), ...(cap ? [cap] : [])];
    }
    const maxPx = Math.floor(ctx.largura / TW_PX);
    const ped = larguraPedida(no.attrs);
    let w = ped?.frac ? maxPx * ped.frac : ped?.px ? ped.px : dim.w;
    w = Math.min(w, maxPx);
    let h = (w * dim.h) / dim.w;
    const maxH = 860; // ~ 23 cm
    if (h > maxH) { h = maxH; w = (h * dim.w) / dim.h; }
    const out = [new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: !!alt || !!cap,
      spacing: { before: 80, after: alt || cap ? 40 : 120 },
      children: [new ImageRun({
        type: dados.tipo,
        data: dados.bytes,
        transformation: { width: Math.round(w), height: Math.round(h) },
        altText: { name: alt || 'Imagem', description: alt || 'Imagem', title: alt || 'Imagem' },
      })],
    })];
    if (cap) out.push(cap);
    else if (alt) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(alt, { italics: true, size: 18, color: COR.suave })] }));
    return out;
  }

  /**
   * Parágrafo de legenda com campo SEQ (Figure/Table) já com o número, para o Word poder gerar o índice de figuras
   * e de tabelas. Figura: estilo «Caption», centrada, por baixo. Tabela: estilo «CaptionTabela», à esquerda, por
   * cima e presa à tabela (keepNext). null se o nó não tiver legenda.
   */
  function legenda(no, seq) {
    const rotulo = legendas.get(no);
    if (!rotulo) return null;
    const n = rotulo.replace(/^\D+/, '');
    const texto = String(no.attrs.legenda).trim();
    const figura = seq === 'Figure';
    return new Paragraph({
      style: figura ? 'Caption' : 'CaptionTabela',
      keepNext: figura ? undefined : true,
      children: [
        run(figura ? 'Figura ' : 'Tabela '),
        new SimpleField(`SEQ ${seq} \\* ARABIC`, n),
        run(` — ${texto}`),
      ],
    });
  }

  const borda = (cor = COR.borda, size = 4) => ({ style: BorderStyle.SINGLE, size, color: cor });
  const semBorda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  function largurasColunas(grelha, ncols, largura) {
    const px = new Array(ncols).fill(0);
    for (const l of grelha) for (const c of l) {
      if (Array.isArray(c.no.attrs?.colwidth) && c.no.attrs.colwidth.length === c.cs) c.no.attrs.colwidth.forEach((v, k) => { if (v > 0 && !px[c.col + k]) px[c.col + k] = v; });
    }
    let pesos;
    if (px.every((v) => v > 0)) pesos = px;
    else {
      pesos = new Array(ncols).fill(4);
      const minimos = new Array(ncols).fill(0); // em twips
      for (const l of grelha) for (const c of l) {
        if (c.cs !== 1) continue;
        const t = textoSimples(c.no);
        pesos[c.col] = Math.max(pesos[c.col], Math.min(t.length, 70));
        const palavra = Math.min(26, Math.max(0, ...t.split(/\s+/).map((p) => p.length)));
        minimos[c.col] = Math.max(minimos[c.col], palavra * (c.cab ? 132 : 124) + 260);
      }
      const tot = pesos.reduce((a, b) => a + b, 0);
      const minFrac = minimos.map((m) => Math.min(0.45, m / largura));
      pesos = pesos.map((p, k) => Math.max(p / tot, minFrac[k]));
    }
    const soma = pesos.reduce((a, b) => a + b, 0);
    const ws = pesos.map((p) => Math.floor((p / soma) * largura));
    ws[ws.length - 1] += largura - ws.reduce((a, b) => a + b, 0);
    return ws;
  }

  function tabela(no, ctx) {
    const linhas = (no.content || []).filter((r) => r && r.type === 'tableRow');
    if (!linhas.length) return [];
    // grelha com ocupação (rowspan/colspan)
    const ocupado = [];
    const grelha = [];
    let ncols = 0;
    linhas.forEach((r, ri) => {
      ocupado[ri] = ocupado[ri] || [];
      let c = 0;
      const cels = [];
      for (const cel of r.content || []) {
        if (!cel || typeof cel !== 'object') continue;
        while (ocupado[ri][c]) c++;
        const cs = Math.max(1, Math.min(50, Number(cel.attrs?.colspan) || 1));
        const rs = Math.max(1, Math.min(linhas.length - ri, Number(cel.attrs?.rowspan) || 1));
        for (let dr = 0; dr < rs; dr++) { ocupado[ri + dr] = ocupado[ri + dr] || []; for (let dc = 0; dc < cs; dc++) ocupado[ri + dr][c + dc] = true; }
        cels.push({ no: cel, col: c, cs, rs, cab: cel.type === 'tableHeader' });
        c += cs;
      }
      ncols = Math.max(ncols, c, ocupado[ri].length);
      grelha.push(cels);
    });
    ncols = Math.max(1, ncols);
    const ws = largurasColunas(grelha, ncols, ctx.largura);
    let corpoIdx = 0;
    const rows = grelha.map((cels, ri) => {
      const cabLinha = cels.length > 0 && cels.every((c) => c.cab) && ri === 0;
      const zebra = !cabLinha && (corpoIdx++ % 2 === 1);
      // preencher colunas em falta (linhas mais curtas) com células vazias
      const usadas = new Set();
      for (const c of cels) for (let k = 0; k < c.cs; k++) usadas.add(c.col + k);
      for (let rr = 0; rr < ri; rr++) for (const c of grelha[rr]) if (rr + c.rs > ri) for (let k = 0; k < c.cs; k++) usadas.add(c.col + k);
      const extra = [];
      for (let k = 0; k < ncols; k++) if (!usadas.has(k)) extra.push({ no: { type: 'tableCell', content: [] }, col: k, cs: 1, rs: 1, cab: false });
      const todas = [...cels, ...extra].sort((a, b) => a.col - b.col);
      return new TableRow({
        tableHeader: cabLinha || undefined,
        cantSplit: cabLinha || cels.every((c) => textoSimples(c.no).length < 700) || undefined,
        children: todas.map((c) => {
          const w = ws.slice(c.col, c.col + c.cs).reduce((a, b) => a + b, 0);
          const sub = { ...ctx, largura: w - 200, nivelLista: 0, emTabela: true, bold: c.cab, cor: c.cab ? 'FFFFFF' : undefined, size: 18 };
          let filhos = blocos(c.no.content || [], sub);
          if (!filhos.length) filhos = [new Paragraph({ children: [] })];
          return new TableCell({
            children: filhos,
            columnSpan: c.cs > 1 ? c.cs : undefined,
            rowSpan: c.rs > 1 ? c.rs : undefined,
            width: { size: w, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            verticalAlign: c.cab ? VerticalAlign.CENTER : VerticalAlign.TOP,
            shading: c.cab ? { type: ShadingType.CLEAR, fill: COR.navy, color: 'auto' }
              : zebra ? { type: ShadingType.CLEAR, fill: COR.zebra, color: 'auto' } : undefined,
          });
        }),
      });
    });
    const cap = legenda(no, 'Table');
    return [
      ...(cap ? [cap] : []),
      new Table({
        rows,
        width: { size: ctx.largura, type: WidthType.DXA },
        columnWidths: ws,
        layout: TableLayoutType.FIXED,
        borders: { top: borda(), bottom: borda(), left: borda(), right: borda(), insideHorizontal: borda(), insideVertical: borda() },
      }),
      new Paragraph({ children: [], spacing: { after: 120 } }),
    ];
  }

  function caixa(no, ctx) {
    const { tipo, rotulo } = caixaDoNo(no);
    const cores = COR.caixa[tipo];
    let filhos = blocos(no.content || [], { ...ctx, largura: ctx.largura - 400, emTabela: true });
    if (rotulo) filhos.unshift(new Paragraph({ keepNext: true, spacing: { after: 40 }, children: [run(rotulo, { bold: true, color: cores.barra })] }));
    if (!filhos.length) filhos = [new Paragraph({ children: [] })];
    return [
      new Table({
        width: { size: ctx.largura, type: WidthType.DXA },
        columnWidths: [ctx.largura],
        layout: TableLayoutType.FIXED,
        borders: { top: semBorda, bottom: semBorda, right: semBorda, left: borda(cores.barra, 24), insideHorizontal: semBorda, insideVertical: semBorda },
        rows: [new TableRow({
          children: [new TableCell({
            children: filhos,
            width: { size: ctx.largura, type: WidthType.DXA },
            margins: { top: 100, bottom: 100, left: 180, right: 140 },
            shading: { type: ShadingType.CLEAR, fill: cores.fundo, color: 'auto' },
            borders: { top: semBorda, bottom: semBorda, right: semBorda, left: borda(cores.barra, 24) },
          })],
        })],
      }),
      new Paragraph({ children: [], spacing: { after: 120 } }),
    ];
  }

  function blocos(nos, ctx) {
    const out = [];
    for (const no of nos || []) {
      if (!no || typeof no !== 'object') continue;
      switch (no.type) {
        case 'paragraph': out.push(paragrafo(no, ctx)); break;
        case 'heading': out.push(...titulo(no, ctx)); break;
        case 'bulletList': out.push(...lista(no, ctx, false)); break;
        case 'orderedList': out.push(...lista(no, ctx, true)); break;
        case 'listItem': out.push(...lista({ content: [no] }, ctx, false)); break;
        case 'table': out.push(...tabela(no, ctx)); break;
        case 'image': out.push(...imagem(no, ctx)); break;
        case 'blockquote': out.push(...caixa(no, ctx)); break;
        case 'horizontalRule':
          out.push(new Paragraph({ children: [], spacing: { before: 60, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COR.borda, space: 1 } } }));
          break;
        case 'hardBreak': out.push(new Paragraph({ children: [] })); break;
        // quebra de página (só ao nível do corpo; dentro de tabelas, caixas e listas não se aplica)
        case 'pageBreak': if (!ctx.emTabela && !ctx.nivelLista) out.push(new Paragraph({ children: [new PageBreak()] })); break;
        case 'text': out.push(paragrafo({ content: [no] }, ctx)); break;
        case 'doc': out.push(...blocos(no.content, ctx)); break;
        default: {
          const t = textoSimples(no);
          if (t.trim()) {
            const filhos = [];
            t.split('\n').forEach((l, k) => { if (k) filhos.push(new TextRun({ break: 1 })); filhos.push(run(l, { bold: ctx.bold, color: ctx.cor, size: ctx.size })); });
            out.push(new Paragraph({ children: filhos, spacing: { after: ctx.emTabela ? 0 : 100 } }));
          }
        }
      }
    }
    return out;
  }

  // ─── Capa ────────────────────────────────────────────────────────
  const logo = dataUrlParaBytes(logoUrl);
  const dimLogo = logo && TIPOS_IMAGEM.has(logo.tipo) ? dimensoesImagem(logo.bytes) : null;
  const imagemLogo = (larguraPx, alturaMaxPx) => {
    if (!dimLogo) return null;
    let w = larguraPx;
    let h = (w * dimLogo.h) / dimLogo.w;
    if (h > alturaMaxPx) { h = alturaMaxPx; w = (h * dimLogo.w) / dimLogo.h; }
    return new ImageRun({ type: logo.tipo, data: logo.bytes, transformation: { width: Math.round(w), height: Math.round(h) }, altText: { name: 'SGA', description: 'Logo SGA', title: 'SGA' } });
  };

  const centro = (filhos, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, children: filhos, ...o });
  const aero = [cab.aeroportoNome, cab.aeroporto ? `(${cab.aeroporto})` : ''].filter(Boolean).join(' ');

  const campos = [['NÚMERO', cab.numero || '—'], ['REVISÃO', revisaoPad(cab.revisao)], ['DATA', dataPt(cab.data) || '—']];
  if (cab.classificacao) campos.push(['CLASSIFICAÇÃO', cab.classificacao]);
  const pesosCampos = campos.map((_, k) => (k === 0 ? 2 : 1));
  const somaPesos = pesosCampos.reduce((a, b) => a + b, 0);
  const wsCampos = pesosCampos.map((p) => Math.floor((p / somaPesos) * LARGURA_UTIL));
  wsCampos[wsCampos.length - 1] += LARGURA_UTIL - wsCampos.reduce((a, b) => a + b, 0);
  const quadroId = new Table({
    width: { size: LARGURA_UTIL, type: WidthType.DXA },
    columnWidths: wsCampos,
    layout: TableLayoutType.FIXED,
    borders: { top: borda(), bottom: borda(), left: borda(), right: borda(), insideHorizontal: borda(), insideVertical: borda() },
    rows: [new TableRow({
      children: campos.map(([rot, val], k) => new TableCell({
        width: { size: wsCampos[k], type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
        children: [
          centro([run(rot, { size: 15, color: COR.suave })], { spacing: { after: 60 } }),
          centro([run(val, { bold: true, size: 20, color: COR.texto })]),
        ],
      })),
    })],
  });

  const terco = Math.floor(LARGURA_UTIL / 3);
  const wsAprov = [terco, terco, LARGURA_UTIL - 2 * terco];
  const pessoas = [['Elaborado por', cab.elaboradoPor], ['Verificado por', cab.verificadoPor], ['Aprovado por', cab.aprovadoPor]];
  const celAprov = (k, filhos, o = {}) => new TableCell({ width: { size: wsAprov[k], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: filhos, ...o });
  const quadroAprov = new Table({
    width: { size: LARGURA_UTIL, type: WidthType.DXA },
    columnWidths: wsAprov,
    layout: TableLayoutType.FIXED,
    borders: { top: borda(), bottom: borda(), left: borda(), right: borda(), insideHorizontal: borda(), insideVertical: borda() },
    rows: [
      new TableRow({ tableHeader: true, children: pessoas.map(([rot], k) => celAprov(k, [centro([run(rot, { bold: true, color: 'FFFFFF', size: 18 })])], { shading: { type: ShadingType.CLEAR, fill: COR.navy, color: 'auto' }, verticalAlign: VerticalAlign.CENTER })) }),
      new TableRow({ height: { value: 640, rule: HeightRule.ATLEAST }, children: pessoas.map(([, nome], k) => celAprov(k, [centro([run(nome || '', { bold: true, size: 19 })])], { verticalAlign: VerticalAlign.CENTER })) }),
      new TableRow({ height: { value: 1250, rule: HeightRule.ATLEAST }, children: pessoas.map((_, k) => celAprov(k, [new Paragraph({ children: [run('Assinatura', { size: 14, color: COR.claro })] })])) }),
      new TableRow({ children: pessoas.map((_, k) => celAprov(k, [new Paragraph({ children: [run('Data:   ', { size: 14, color: COR.claro }), run('____ / ____ / ________', { size: 17, color: COR.suave })] })])) }),
    ],
  });

  const logoCapa = imagemLogo(270, 115);
  const capa = [
    centro(logoCapa ? [logoCapa] : [run('SGA', { bold: true, size: 56, color: COR.primaria })], { spacing: { before: 300, after: 400 } }),
    centro([run(aero, { size: 24, color: COR.corpo })], { spacing: { after: 600 } }),
    new Paragraph({ children: [], indent: { left: 4250, right: 4250 }, spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COR.primaria, space: 1 } } }),
    centro([run(nomeClasse(doc.modelo).toUpperCase(), { bold: true, size: 26, color: COR.primaria })], { spacing: { after: 160 } }),
    centro([run(cab.titulo || 'Sem título', { bold: true, size: 44, color: COR.texto })], { spacing: { after: 700 } }),
    quadroId,
    new Paragraph({ children: [], spacing: { after: 700 } }),
    quadroAprov,
    centro([run('Documento controlado pelo Portal de Documentos da SGA. As cópias impressas não são controladas.', { italics: true, size: 15, color: COR.suave })], { spacing: { before: 500 } }),
  ];

  // ─── Cabeçalho e rodapé ──────────────────────────────────────────
  const logoCab = imagemLogo(112, 44);
  const wLogoCab = 2600;
  const cabecalho = new Header({
    children: [
      new Table({
        width: { size: LARGURA_UTIL, type: WidthType.DXA },
        columnWidths: [wLogoCab, LARGURA_UTIL - wLogoCab],
        layout: TableLayoutType.FIXED,
        borders: { top: semBorda, left: semBorda, right: semBorda, insideVertical: semBorda, insideHorizontal: semBorda, bottom: borda(COR.primaria, 10) },
        rows: [new TableRow({
          children: [
            new TableCell({
              width: { size: wLogoCab, type: WidthType.DXA },
              verticalAlign: VerticalAlign.BOTTOM,
              margins: { bottom: 80, left: 0 },
              borders: { top: semBorda, left: semBorda, right: semBorda, bottom: borda(COR.primaria, 10) },
              children: [new Paragraph({ children: logoCab ? [logoCab] : [run('SGA', { bold: true, color: COR.primaria })] })],
            }),
            new TableCell({
              width: { size: LARGURA_UTIL - wLogoCab, type: WidthType.DXA },
              verticalAlign: VerticalAlign.BOTTOM,
              margins: { bottom: 80, right: 0 },
              borders: { top: semBorda, left: semBorda, right: semBorda, bottom: borda(COR.primaria, 10) },
              children: [
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(cab.numero || '', { bold: true, size: 19, color: COR.primaria })] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(cab.titulo || '', { size: 17, color: COR.corpo })] }),
              ],
            }),
          ],
        })],
      }),
    ],
  });

  const { revisao: tRevisao, data: tData } = textosRodape(cab);
  const wsRodape = [terco, terco, LARGURA_UTIL - 2 * terco];
  const celRodape = (k, filhos) => new TableCell({
    width: { size: wsRodape[k], type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: filhos })],
  });
  const estiloRodape = { size: 16, color: COR.corpo };
  const rodape = new Footer({
    children: [
      new Table({
        width: { size: LARGURA_UTIL, type: WidthType.DXA },
        columnWidths: wsRodape,
        layout: TableLayoutType.FIXED,
        borders: { top: borda(COR.suave, 4), bottom: borda(COR.suave, 4), left: borda(COR.suave, 4), right: borda(COR.suave, 4), insideHorizontal: borda(COR.suave, 4), insideVertical: borda(COR.suave, 4) },
        rows: [new TableRow({
          children: [
            celRodape(0, [run(tRevisao, estiloRodape)]),
            celRodape(1, [run(tData, estiloRodape)]),
            celRodape(2, [new TextRun({ ...estiloRodape, children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES] })]),
          ],
        })],
      }),
      ...(cab.classificacao ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [run(cab.classificacao, { size: 13, color: COR.suave })] })] : []),
    ],
  });

  // ─── Controlo do documento ───────────────────────────────────────
  const tituloSimples = (texto, size = 26, antes = 240) => new Paragraph({ spacing: { before: antes, after: 140 }, keepNext: true, children: [run(texto, { bold: true, size, color: COR.primaria })] });
  const hist = (doc.historico || []).filter(Boolean);
  const linhasHist = hist.length ? hist : [{ revisao: cab.revisao, data: cab.data, descricao: 'Emissão inicial', autor: cab.elaboradoPor }];
  const cel = (t, cabe = false) => ({ type: cabe ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: t ? [{ type: 'text', text: String(t) }] : [] }] });
  const tabelaHist = {
    type: 'table',
    content: [
      { type: 'tableRow', content: ['Revisão', 'Data', 'Descrição das alterações', 'Autor'].map((t) => cel(t, true)) },
      ...linhasHist.map((h) => ({ type: 'tableRow', content: [cel(revisaoPad(h.revisao)), cel(dataPt(h.data)), cel(h.descricao), cel(h.autor)] })),
    ],
  };
  // larguras fixas no histórico (revisão e data estreitas)
  tabelaHist.content.forEach((r) => {
    const px = [70, 95, 330, 150];
    r.content.forEach((c, k) => { c.attrs = { colwidth: [px[k]] }; });
  });

  const ctxCorpo = { largura: LARGURA_UTIL, nivelLista: 0 };
  const controlo = [
    tituloSimples('Controlo do documento', 30, 0),
    tituloSimples('Histórico de revisões', 23),
    ...tabela(tabelaHist, ctxCorpo),
    tituloSimples('Índice', 23),
    new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  ];

  // ─── Corpo ───────────────────────────────────────────────────────
  const corpo = [];
  seccoes.forEach((s, i) => {
    corpo.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      numbering: { reference: 'titulos', level: 0 },
      pageBreakBefore: i === 0 ? true : undefined,
      children: [run(s.titulo)],
    }));
    const filhos = s.seccao?.conteudo && !conteudoVazio(s.seccao.conteudo) ? blocos([s.seccao.conteudo], ctxCorpo) : [];
    if (!filhos.length) corpo.push(new Paragraph({ children: [run('Secção sem conteúdo.', { italics: true, color: COR.claro })] }));
    else corpo.push(...filhos);
  });
  if (!seccoes.length) corpo.push(new Paragraph({ pageBreakBefore: true, children: [run('Documento sem secções.', { italics: true, color: COR.claro })] }));

  // ─── Documento ───────────────────────────────────────────────────
  const tituloEstilo = (size, cor, antes, depois, extra = {}) => ({
    run: { font: 'Arial', size, bold: true, color: cor, ...extra.run },
    paragraph: { spacing: { before: antes, after: depois }, keepNext: true, keepLines: true, ...extra.paragraph },
  });
  const pagina = {
    size: { width: A4_W, height: A4_H },
    margin: { top: MARGEM_TOPO, bottom: MARGEM_FUNDO, left: MARGEM_LADO, right: MARGEM_LADO, header: 567, footer: 454 },
  };

  // Números de página do índice já escritos (para LibreOffice/OnlyOffice, que não actualizam o campo TOC);
  // o Word volta a calculá-los ao abrir (updateFields). Módulo pesado (docx/layout), só carregado aqui.
  let pageNumbers;
  if (opcoes.estimarPaginas !== false) {
    try {
      const { estimatePageNumbersWith } = await import('docx/layout');
      pageNumbers = estimatePageNumbersWith({ guess: true });
    } catch { pageNumbers = undefined; }
  }

  const criar = (pn) => new Document({
    ...(pn ? { pageNumbers: pn } : {}),
    creator: limparXml(cab.elaboradoPor || 'SGA'),
    title: limparXml([cab.numero, cab.titulo].filter(Boolean).join(' — ')),
    subject: nomeClasse(doc.modelo),
    description: 'Gerado pelo Portal de Documentos da SGA',
    features: { updateFields: true },
    // justificado: a linha que acaba numa quebra de linha (Shift+Enter) não se estica, como no PDF
    compatibility: { doNotExpandShiftReturn: true },
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20, color: COR.texto }, paragraph: { spacing: { line: 276 } } },
        heading1: tituloEstilo(26, COR.primaria, 360, 160, { paragraph: { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFDBFE', space: 2 } } } }),
        heading2: tituloEstilo(23, COR.primaria, 240, 100),
        heading3: tituloEstilo(21, COR.texto, 200, 80),
        heading4: tituloEstilo(20, COR.texto, 160, 60, { run: { italics: true } }),
      },
      paragraphStyles: [
        { id: 'Caption', name: 'caption', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { italics: true, size: 17, color: COR.corpo }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 } } },
        { id: 'CaptionTabela', name: 'Legenda de tabela', basedOn: 'Caption', next: 'Normal', quickFormat: true, run: { italics: false, bold: true, color: COR.texto }, paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 120, after: 60 }, keepNext: true } },
      ],
    },
    numbering: { config: configNumeracao },
    sections: [
      { properties: { page: pagina }, children: capa },
      { properties: { page: pagina }, headers: { default: cabecalho }, footers: { default: rodape }, children: [...controlo, ...corpo] },
    ],
  });

  const empacotar = async (documento) => {
    try {
      return await Packer.toBlob(documento);
    } catch {
      const ab = await Packer.toArrayBuffer(documento);
      return new Blob([ab], { type: MIME_DOCX });
    }
  };
  if (pageNumbers) {
    try { return await empacotar(criar(pageNumbers)); } catch { /* estimativa falhou: sem números no índice */ }
  }
  return empacotar(criar(undefined));
}

export default gerarDocx;
