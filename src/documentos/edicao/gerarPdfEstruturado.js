// Gerador PDF dos documentos estruturados do GED — padrão SGA, jsPDF nativo (sem html2canvas), A4 vertical.
//
//   gerarPdf(doc, opcoes?) -> Promise<Blob>
//
// Estrutura: capa (logo SGA, aeroporto, classe por extenso, título, número/revisão/data, quadro
// Elaborado/Verificado/Aprovado) → página de controlo (histórico de revisões + índice com páginas) → corpo
// (secções numeradas 1., 1.1, …). Em todas as páginas excepto a capa: cabeçalho (logo + número + título) e
// rodapé em tabela «Revisão n.º NN/AA | Data: dd/mm/aaaa | Página X de Y», como nos manuais da SGA.
//
// O índice precisa dos números de página: o documento é desenhado duas vezes (a 1.ª passagem só mede).
// Fonte: Helvetica padrão do jsPDF (codificação WinAnsi) — cobre todo o português (ç ã õ é º ª « » – “ ” €);
// caracteres fora dessa tabela são trocados por equivalentes (ver limparTexto).
//
// opcoes: { logo?: dataURL | null, logoUrl?: string }

import { PDF } from '@/lib/pdfTemplate';
import {
  nomeClasse, dataPt, revisaoPad, textosRodape, textoSimples, carregarLogo, resolverImagens,
  larguraPedida, numerarTitulos, caixaDoNo, alinhamentoPedido,
  seccaoEmNovaPagina,
} from './comum';
import { numerarLegendas, textoLegenda } from './contrato';
import { larguraHelvetica } from './larguraHelvetica';

// ─── Medidas (mm) ──────────────────────────────────────────────────
const PW = 210;
const PH = 297;
const ML = 20;
const MR = 20;
const CW = PW - ML - MR;
const TOPO = 31;            // início do corpo (abaixo do cabeçalho)
const FUNDO = PH - 25;      // fim do corpo (acima do rodapé)
const PT = 0.3528;          // mm por ponto
const PX = 0.2646;          // mm por píxel (96 dpi)

const C = PDF.colors;
const COR_TEXTO = C.dark;
const COR_BORDA = [203, 213, 225];
const COR_NOTA = { fundo: [239, 246, 255], barra: [37, 99, 235] };
const COR_AVISO = { fundo: [255, 247, 237], barra: [217, 119, 6] };
const COR_PERIGO = { fundo: [254, 242, 242], barra: [220, 38, 38] };
/** Caixas: nota azul, atenção âmbar (a antiga «aviso» adivinhada pelo texto), aviso vermelho. */
const COR_CAIXA = { nota: COR_NOTA, atencao: COR_AVISO, aviso: COR_PERIGO };

const TAM = { corpo: 10, tabela: 9, h1: 13, h2: 11.5, h3: 10.5, h4: 10 };
const ENTRELINHA = 1.38;
const alturaLinha = (tam) => tam * PT * ENTRELINHA;

// ─── Texto ─────────────────────────────────────────────────────────

// WinAnsi (cp1252) além do Latin-1: estes caracteres saem bem com a Helvetica padrão.
const CP1252 = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const TROCAS = {
  '‐': '-', '‑': '-', '‒': '–', '―': '—', '−': '-', '′': "'", '″': '"',
  '≤': '<=', '≥': '>=', '≠': '≠', '≈': '~', '→': '->', '←': '<-', '↔': '<->',
  '⇒': '=>', '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x', '●': '•', '▪': '•',
  '◦': '-', '∙': '•', '•': '•', ' ': ' ', ' ': ' ', ' ': ' ', '​': '',
  ' ': ' ', ' ': ' ', '…': '…', '﻿': '',
};

/** Deixa só caracteres que a Helvetica padrão (WinAnsi) desenha; o resto é trocado ou vira '?'. */
export function limparTexto(t) {
  let s = String(t ?? '').normalize('NFC');
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (ch === '\t') { out += '    '; continue; }
    if (cp < 32) continue;
    if ((cp < 127) || (cp >= 160 && cp <= 255) || CP1252.has(ch)) { out += ch; continue; }
    if (TROCAS[ch] !== undefined) {
      const tr = TROCAS[ch];
      // a troca pode ela própria não ser WinAnsi (≠): cai no '?'
      out += [...tr].every((c) => c.codePointAt(0) < 256 || CP1252.has(c)) ? tr : '?';
      continue;
    }
    // letras com diacríticos fora do Latin-1: tirar o diacrítico (ex. ș → s)
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += base && [...base].every((c) => c.codePointAt(0) < 256) ? base : '?';
  }
  return out;
}

const estiloFonte = (b, i) => (b && i ? 'bolditalic' : b ? 'bold' : i ? 'italic' : 'normal');

/** Mede texto com cache (a mesma palavra aparece muitas vezes). */
function criarMedidor(pdf) {
  const cache = new Map();
  return (t, tam, b, i) => {
    const k = `${tam}|${b ? 1 : 0}${i ? 1 : 0}|${t}`;
    let w = cache.get(k);
    if (w === undefined) {
      const u = larguraHelvetica(t, b);
      if (u !== null) { w = (u / 1000) * tam * PT; cache.set(k, w); return w; }
      pdf.setFont('helvetica', estiloFonte(b, i));
      pdf.setFontSize(tam);
      w = pdf.getTextWidth(t);
      cache.set(k, w);
    }
    return w;
  };
}

/** Nós inline → corridas { t, b, i, u } | { br: true }. */
function corridas(nos, base = {}) {
  const out = [];
  for (const n of nos || []) {
    if (!n || typeof n !== 'object') continue;
    if (n.type === 'text') {
      const marcas = new Set((n.marks || []).map((m) => m?.type));
      out.push({
        t: limparTexto(n.text),
        b: !!base.b || marcas.has('bold'),
        i: !!base.i || marcas.has('italic'),
        u: !!base.u || marcas.has('underline'),
      });
    } else if (n.type === 'hardBreak') {
      out.push({ br: true });
    } else {
      // nó inline desconhecido: o texto simples
      const t = textoSimples(n);
      if (t) out.push({ t: limparTexto(t), b: !!base.b, i: !!base.i, u: !!base.u });
    }
  }
  return out;
}

/**
 * Parte corridas em linhas de largura ≤ largura. Palavras maiores do que a linha partem-se por caracteres.
 * Linha = { segs: [{ t, b, i, u, w }], w }
 */
function partirLinhas(medir, runs, largura, tam) {
  const linhas = [];
  let segs = [];
  let w = 0;
  let espacoPendente = null;
  const fechar = () => {
    linhas.push({ segs, w });
    segs = [];
    w = 0;
    espacoPendente = null;
  };
  // cada segmento guarda as suas peças (palavras e espaços) para a justificação
  const juntar = (t, r, tw, ehEspaco = false) => {
    const ult = segs[segs.length - 1];
    const peca = { t, w: tw, e: ehEspaco };
    if (ult && ult.b === r.b && ult.i === r.i && ult.u === r.u) { ult.t += t; ult.w += tw; ult.pecas.push(peca); } else segs.push({ t, b: r.b, i: r.i, u: r.u, w: tw, pecas: [peca] });
    w += tw;
  };
  for (const r of runs) {
    if (r.br) { fechar(); linhas[linhas.length - 1].br = true; continue; }
    const pecas = r.t.split(/( +)/);
    for (const p of pecas) {
      if (!p) continue;
      if (/^ +$/.test(p)) {
        if (segs.length) espacoPendente = { r, w: medir(' ', tam, r.b, r.i) };
        continue;
      }
      const pw = medir(p, tam, r.b, r.i);
      const ew = espacoPendente ? espacoPendente.w : 0;
      if (w + ew + pw <= largura + 0.01) {
        if (espacoPendente) juntar(' ', espacoPendente.r, ew, true);
        juntar(p, r, pw);
        espacoPendente = null;
        continue;
      }
      if (segs.length) fechar();
      if (pw <= largura + 0.01) { juntar(p, r, pw); continue; }
      // palavra maior do que a linha: partir por caracteres
      let bocado = '';
      let bw = 0;
      for (const ch of p) {
        const cw = medir(ch, tam, r.b, r.i);
        if (bw + cw > largura && bocado) {
          juntar(bocado, r, bw);
          fechar();
          bocado = '';
          bw = 0;
        }
        bocado += ch;
        bw += cw;
      }
      if (bocado) juntar(bocado, r, bw);
    }
  }
  if (segs.length || !linhas.length) fechar();
  return linhas;
}

/**
 * Desenha uma linha (segmentos normal/negrito/itálico). alinhar 'justify': o espaço que sobra é distribuído pelos
 * espaços entre palavras (de todos os segmentos), palavra a palavra; quem chama decide que a última linha do
 * parágrafo (e a que acaba numa quebra de linha) não se justifica.
 */
function desenharLinha(pdf, linha, x, yBase, tam, cor, alinhar = 'left', largura = 0) {
  let cx = x;
  if (alinhar === 'center') cx = x + (largura - linha.w) / 2;
  else if (alinhar === 'right') cx = x + largura - linha.w;
  pdf.setFontSize(tam);
  pdf.setTextColor(...cor);
  if (alinhar === 'justify') {
    const nEsp = linha.segs.reduce((a, s) => a + (s.pecas || []).filter((p) => p.e).length, 0);
    const extra = largura - linha.w;
    if (nEsp > 0 && extra > 0.01 && linha.segs.every((s) => s.pecas)) {
      const porEspaco = extra / nEsp;
      for (const s of linha.segs) {
        pdf.setFont('helvetica', estiloFonte(s.b, s.i));
        const x0 = cx;
        for (const p of s.pecas) {
          if (p.e) { cx += p.w + porEspaco; continue; }
          pdf.text(p.t, cx, yBase);
          cx += p.w;
        }
        if (s.u) {
          pdf.setDrawColor(...cor);
          pdf.setLineWidth(0.2);
          pdf.line(x0, yBase + 0.7, cx, yBase + 0.7);
        }
      }
      return;
    }
  }
  for (const s of linha.segs) {
    pdf.setFont('helvetica', estiloFonte(s.b, s.i));
    pdf.text(s.t, cx, yBase);
    if (s.u) {
      pdf.setDrawColor(...cor);
      pdf.setLineWidth(0.2);
      pdf.line(cx, yBase + 0.7, cx + s.w, yBase + 0.7);
    }
    cx += s.w;
  }
}

// ─── Itens de paginação ────────────────────────────────────────────
// Tudo o que vai para o corpo vira uma lista de itens { h, draw(pdf, y), keep?, split?(alt), marca?, cabecalho? }.
// spacer: true → espaço que desaparece no topo da página.

const espaco = (h) => ({ h, spacer: true, draw() {} });

/** Alinhamento efectivo de uma linha: justificado não se aplica à última linha nem à que acaba em quebra de linha. */
const alinharLinha = (alinhar, linhas, k) => (alinhar === 'justify' && (k === linhas.length - 1 || linhas[k].br) ? 'left' : alinhar);

function itensDeLinhas(linhas, { x, w, tam, cor, alinhar, prefixo }) {
  const lh = alturaLinha(tam);
  return linhas.map((ln, k) => ({
    h: lh,
    base: lh * 0.78,
    draw(pdf, y) {
      desenharLinha(pdf, ln, x, y + lh * 0.78, tam, cor, alinharLinha(alinhar, linhas, k), w);
      if (k === 0 && prefixo) prefixo(pdf, y + lh * 0.78);
    },
  }));
}

function itensParagrafo(ctx, no) {
  const tam = ctx.tam;
  const runs = corridas(no.content, { b: ctx.b });
  const vazio = !runs.some((r) => r.br || (r.t && r.t.trim()));
  if (vazio) return [espaco(alturaLinha(tam) * 0.6)];
  const linhas = partirLinhas(ctx.medir, runs, ctx.w, tam);
  const alinhar = alinhamentoPedido(no) || ctx.alinhar;
  return [...itensDeLinhas(linhas, { ...ctx, alinhar }), espaco(tam * 0.22)];
}

function itensTitulo(ctx, texto, numero, nivel, marca, alinhar = null) {
  const tam = nivel === 1 ? TAM.h1 : nivel === 2 ? TAM.h2 : nivel === 3 ? TAM.h3 : TAM.h4;
  const italico = nivel === 4;
  const cor = nivel <= 2 ? C.primary : C.dark;
  const medir = ctx.medir;
  const num = numero ? `${numero}${nivel === 1 ? '.' : ''}` : '';
  // centrado/à direita: o número segue com o texto (não fica pendurado na margem esquerda)
  const numCorrido = num && (alinhar === 'center' || alinhar === 'right');
  const recuo = num && !numCorrido ? Math.max(medir(num, tam, true, italico) + 3, nivel === 1 ? 8 : 10) : 0;
  const runsT = numCorrido
    ? [{ t: `${num} `, b: true, i: italico }, { t: limparTexto(texto), b: true, i: italico }]
    : [{ t: limparTexto(texto), b: true, i: italico }];
  const linhas = partirLinhas(medir, runsT, ctx.w - recuo, tam);
  const lh = alturaLinha(tam);
  const h = linhas.length * lh + (nivel === 1 ? 1.6 : 0.6);
  const x = ctx.x;
  return [
    espaco(nivel === 1 ? 6 : 3.5),
    {
      h,
      keep: true,
      marca,
      draw(pdf, y) {
        linhas.forEach((ln, k) => {
          const yb = y + lh * k + lh * 0.78;
          if (k === 0 && num && !numCorrido) {
            pdf.setFont('helvetica', italico ? 'bolditalic' : 'bold');
            pdf.setFontSize(tam);
            pdf.setTextColor(...cor);
            pdf.text(num, x, yb);
          }
          if (alinhar && alinhar !== 'left') desenharLinha(pdf, ln, x + recuo, yb, tam, cor, alinharLinha(alinhar, linhas, k), ctx.w - recuo);
          else desenharLinha(pdf, ln, x + recuo, yb, tam, cor);
        });
        if (nivel === 1) {
          pdf.setDrawColor(...C.primaryBorder);
          pdf.setLineWidth(0.3);
          pdf.line(x, y + h - 0.4, x + ctx.w, y + h - 0.4);
        }
      },
    },
    espaco(nivel === 1 ? 2 : 1),
  ];
}

const ROMANOS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];
function marcadorOrdenado(n, nivel) {
  const m = nivel % 3;
  if (m === 0) return `${n}.`;
  if (m === 1) {
    let s = '';
    let k = n;
    while (k > 0) { k -= 1; s = String.fromCharCode(97 + (k % 26)) + s; k = Math.floor(k / 26); }
    return `${s})`;
  }
  return `${ROMANOS[n - 1] || n}.`;
}

function itensLista(ctx, no, ordenada) {
  const nivel = ctx.nivelLista || 0;
  const inicio = Number(no.attrs?.start) || 1;
  const itens = [];
  const filhos = (no.content || []).filter((f) => f && typeof f === 'object');
  const recuo = ordenada ? 7 : 5;
  filhos.forEach((li, k) => {
    // marcas por nível: • → – → ▪ (o ▪ não existe na Helvetica: desenha-se um quadrado)
    const marcador = ordenada ? marcadorOrdenado(inicio + k, nivel) : (nivel % 3 === 0 ? '•' : nivel % 3 === 1 ? '–' : '▪');
    const sub = { ...ctx, x: ctx.x + recuo, w: ctx.w - recuo, nivelLista: nivel + 1 };
    const conteudo = li.type === 'listItem' ? (li.content || []) : [li];
    let blocos = [];
    for (const f of conteudo) blocos.push(...itensBloco(sub, f));
    while (blocos.length && blocos[blocos.length - 1].spacer) blocos.pop();
    if (!blocos.length) blocos = [{ h: alturaLinha(ctx.tam), base: alturaLinha(ctx.tam) * 0.78, draw() {} }];
    const primeiro = blocos.findIndex((b) => !b.spacer);
    const alvo = blocos[primeiro];
    const drawOrig = alvo.draw;
    const base = alvo.base ?? alturaLinha(ctx.tam) * 0.78;
    const xm = ctx.x;
    const tam = ctx.tam;
    const cor = ctx.cor;
    blocos[primeiro] = {
      ...alvo,
      draw(pdf, y) {
        drawOrig.call(alvo, pdf, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(tam);
        pdf.setTextColor(...cor);
        if (marcador === '▪') {
          const lado = tam * PT * 0.3;
          pdf.setFillColor(...cor);
          pdf.rect(xm + 1.1, y + base - tam * PT * 0.42, lado, lado, 'F');
        } else pdf.text(marcador, xm + (ordenada ? 0 : 1), y + base);
      },
    };
    itens.push(...blocos, espaco(tam * 0.12));
  });
  itens.push(espaco(ctx.tam * 0.2));
  return itens;
}

function itensImagem(ctx, no) {
  const src = String(no.attrs?.src || '');
  const dataUrl = ctx.imagens.get(src);
  const alt = limparTexto(no.attrs?.alt || no.attrs?.title || '');
  const legenda = limparTexto(textoLegenda(ctx.legendas, no));
  let props = null;
  if (dataUrl) {
    try { props = ctx.pdf.getImageProperties(dataUrl); } catch { props = null; }
  }
  if (!props || !props.width || !props.height) {
    const linhas = partirLinhas(ctx.medir, [{ t: `[Imagem indisponível${alt ? `: ${alt}` : ''}]`, i: true }], ctx.w, ctx.tam);
    if (legenda) return [{ ...blocoLinhas(linhas, { ...ctx, cor: C.muted }), keep: true }, espaco(1), legendaFigura(ctx, legenda), espaco(2.5)];
    return [...itensDeLinhas(linhas, { ...ctx, cor: C.muted }), espaco(2)];
  }
  const ped = larguraPedida(no.attrs);
  let w = ped?.frac ? ctx.w * ped.frac : ped?.px ? ped.px * PX : props.width * PX;
  w = Math.min(w, ctx.w);
  let h = w * (props.height / props.width);
  const maxH = (FUNDO - TOPO) * 0.85;
  if (h > maxH) { h = maxH; w = h * (props.width / props.height); }
  const x = ctx.x + (ctx.w - w) / 2;
  const fmt = String(props.fileType || 'PNG').toUpperCase();
  // a legenda (Figura N — …) vai num só item e a imagem fica presa a ela: nunca se separam numa quebra de página
  const cap = legenda ? legendaFigura(ctx, legenda) : null;
  const itens = [espaco(1.5), {
    h,
    keep: !!alt || !!cap,
    ...(cap ? { junto: 1 + cap.h } : {}),
    draw(pdf, y) {
      try { pdf.addImage(dataUrl, fmt, x, y, w, h, undefined, 'FAST'); } catch { /* imagem corrompida: fica o espaço */ }
    },
  }];
  if (cap) itens.push(espaco(1), cap);
  else if (alt) {
    const linhas = partirLinhas(ctx.medir, [{ t: alt, i: true }], ctx.w, TAM.tabela);
    itens.push(espaco(1), ...itensDeLinhas(linhas, { ...ctx, tam: TAM.tabela, cor: C.muted, alinhar: 'center' }));
  }
  itens.push(espaco(2.5));
  return itens;
}

/** Várias linhas num único item (não se partem entre páginas). */
function blocoLinhas(linhas, ctx) {
  const its = itensDeLinhas(linhas, ctx);
  return { h: its.reduce((a, b) => a + b.h, 0), base: its[0]?.base, draw(pdf, y) { let yy = y; for (const it of its) { it.draw(pdf, yy); yy += it.h; } } };
}

const TAM_LEGENDA = 8.5;
/** «Figura N — legenda»: por baixo da imagem, centrada, itálico pequeno. */
function legendaFigura(ctx, texto) {
  const linhas = partirLinhas(ctx.medir, [{ t: texto, i: true }], ctx.w, TAM_LEGENDA);
  return blocoLinhas(linhas, { ...ctx, tam: TAM_LEGENDA, cor: C.body, alinhar: 'center' });
}
/** «Tabela N — legenda»: por cima da tabela, à esquerda, negrito pequeno. */
function legendaTabela(ctx, texto) {
  const linhas = partirLinhas(ctx.medir, [{ t: texto, b: true }], ctx.w, TAM_LEGENDA);
  return blocoLinhas(linhas, { ...ctx, tam: TAM_LEGENDA, cor: COR_TEXTO, alinhar: 'left' });
}

function itensLinhaHorizontal(ctx) {
  return [{
    h: 5,
    draw(pdf, y) {
      pdf.setDrawColor(...COR_BORDA);
      pdf.setLineWidth(0.3);
      pdf.line(ctx.x, y + 2.5, ctx.x + ctx.w, y + 2.5);
    },
  }];
}

/** Envolve itens num fundo + barra lateral (caixa de nota/aviso). */
function itensCaixa(ctx, no) {
  const { tipo, rotulo } = caixaDoNo(no);
  const cores = COR_CAIXA[tipo];
  const pad = 3;
  const xCaixa = ctx.x;
  const wCaixa = ctx.w;
  const interior = { ...ctx, x: ctx.x + pad + 2, w: ctx.w - 2 * pad - 2, emCaixa: true };
  let blocos = [];
  for (const f of no.content || []) blocos.push(...itensBloco(interior, f));
  while (blocos.length && blocos[blocos.length - 1].spacer) blocos.pop();
  while (blocos.length && blocos[0].spacer) blocos.shift();
  if (rotulo) {
    // rótulo em negrito, na cor da barra, preso à primeira linha do conteúdo
    const ln = partirLinhas(ctx.medir, [{ t: limparTexto(rotulo), b: true }], interior.w, ctx.tam);
    blocos.unshift({ ...blocoLinhas(ln, { ...interior, cor: cores.barra }), keep: true }, espaco(0.8));
  }
  const fundo = (pdf, y, h) => {
    pdf.setFillColor(...cores.fundo);
    pdf.rect(xCaixa, y, wCaixa, h, 'F');
    pdf.setFillColor(...cores.barra);
    pdf.rect(xCaixa, y, 1.2, h, 'F');
  };
  const envolver = (it) => ({
    ...it,
    spacer: false,
    draw(pdf, y) { fundo(pdf, y, it.h); it.draw(pdf, y); },
    split: it.split ? (alt) => { const p = it.split(alt); return p && p.map(envolver); } : undefined,
  });
  const margem = { h: pad, draw(pdf, y) { fundo(pdf, y, pad); } };
  return [espaco(2), { ...margem, keep: true }, ...blocos.map(envolver), margem, espaco(3)];
}

// ─── Tabelas ───────────────────────────────────────────────────────

function construirGrelha(no) {
  const linhas = (no.content || []).filter((r) => r && r.type === 'tableRow');
  const ocupado = [];
  const grelha = [];
  let ncols = 0;
  linhas.forEach((r, ri) => {
    ocupado[ri] = ocupado[ri] || [];
    let c = 0;
    const celulas = [];
    for (const cel of r.content || []) {
      if (!cel || typeof cel !== 'object') continue;
      while (ocupado[ri][c]) c++;
      const cs = Math.max(1, Math.min(50, Number(cel.attrs?.colspan) || 1));
      const rs = Math.max(1, Math.min(linhas.length - ri, Number(cel.attrs?.rowspan) || 1));
      for (let dr = 0; dr < rs; dr++) {
        ocupado[ri + dr] = ocupado[ri + dr] || [];
        for (let dc = 0; dc < cs; dc++) ocupado[ri + dr][c + dc] = true;
      }
      celulas.push({ no: cel, col: c, cs, rs, cab: cel.type === 'tableHeader', largurasPx: cel.attrs?.colwidth });
      c += cs;
    }
    ncols = Math.max(ncols, c, ocupado[ri].length);
    grelha.push(celulas);
  });
  return { grelha, ncols: Math.max(1, ncols) };
}

function largurasColunas(ctx, grelha, ncols) {
  const pad = 2 * 1.8;
  // 1) colwidth do TipTap (px) quando todas as colunas o têm
  const px = new Array(ncols).fill(0);
  for (const linha of grelha) {
    for (const cel of linha) {
      if (Array.isArray(cel.largurasPx) && cel.largurasPx.length === cel.cs) cel.largurasPx.forEach((v, k) => { if (v > 0 && !px[cel.col + k]) px[cel.col + k] = v; });
    }
  }
  if (px.every((v) => v > 0)) {
    const tot = px.reduce((a, b) => a + b, 0);
    return px.map((v) => (v / tot) * ctx.w);
  }
  // 2) pela quantidade de texto
  const nat = new Array(ncols).fill(8);
  const min = new Array(ncols).fill(8);
  for (const linha of grelha) {
    for (const cel of linha) {
      if (cel.cs !== 1) continue;
      const t = limparTexto(textoSimples(cel.no));
      const partes = t.split('\n');
      const larg = Math.max(...partes.map((p) => ctx.medir(p, TAM.tabela, cel.cab, false)), 0) + pad;
      const palavra = Math.max(...t.split(/\s+/).map((p) => ctx.medir(p, TAM.tabela, cel.cab, false)), 0) + pad;
      nat[cel.col] = Math.max(nat[cel.col], Math.min(larg, ctx.w));
      min[cel.col] = Math.max(min[cel.col], Math.min(palavra, ctx.w * 0.45));
    }
  }
  const somaNat = nat.reduce((a, b) => a + b, 0);
  if (somaNat <= ctx.w) return nat.map((v) => (v / somaNat) * ctx.w);
  const somaMin = min.reduce((a, b) => a + b, 0);
  if (somaMin >= ctx.w) return min.map((v) => (v / somaMin) * ctx.w);
  const resto = ctx.w - somaMin;
  const folga = nat.map((v, k) => Math.max(0, v - min[k]));
  const somaFolga = folga.reduce((a, b) => a + b, 0) || 1;
  return min.map((v, k) => v + (folga[k] / somaFolga) * resto);
}

function itensTabela(ctx, no, { semZebra = false } = {}) {
  const { grelha, ncols } = construirGrelha(no);
  if (!grelha.length) return [];
  const larguras = largurasColunas(ctx, grelha, ncols);
  const xs = [ctx.x];
  for (const l of larguras) xs.push(xs[xs.length - 1] + l);
  const padX = 1.8;
  const padY = 1.5;

  // conteúdo de cada célula como itens
  const cels = grelha.map((linha) => linha.map((cel) => {
    const x = xs[cel.col];
    const w = xs[Math.min(ncols, cel.col + cel.cs)] - x;
    const sub = {
      ...ctx, x: x + padX, w: Math.max(4, w - 2 * padX), tam: TAM.tabela,
      cor: cel.cab ? C.tableHeaderFg : COR_TEXTO, b: cel.cab, nivelLista: 0, emTabela: true,
    };
    let itens = [];
    for (const f of cel.no.content || []) itens.push(...itensBloco(sub, f));
    while (itens.length && itens[itens.length - 1].spacer) itens.pop();
    while (itens.length && itens[0].spacer) itens.shift();
    return { ...cel, x, w, itens, hc: itens.reduce((a, b) => a + b.h, 0) + 2 * padY };
  }));

  // alturas das linhas (rowspan: a última linha abrangida cresce se preciso)
  const alt = cels.map((linha) => Math.max(alturaLinha(TAM.tabela) + 2 * padY, ...linha.filter((c) => c.rs === 1).map((c) => c.hc)));
  cels.forEach((linha, ri) => linha.filter((c) => c.rs > 1).forEach((c) => {
    const soma = alt.slice(ri, ri + c.rs).reduce((a, b) => a + b, 0);
    if (c.hc > soma) alt[ri + c.rs - 1] += c.hc - soma;
  }));

  // grupos de linhas presas por rowspan
  const grupos = [];
  for (let ri = 0; ri < cels.length;) {
    let fim = ri;
    for (let k = ri; k <= fim; k++) for (const c of cels[k]) fim = Math.max(fim, k + c.rs - 1);
    grupos.push([ri, fim]);
    ri = fim + 1;
  }

  const ehCabecalho = (ri) => cels[ri].length > 0 && cels[ri].every((c) => c.cab);
  const desenharCelula = (pdf, c, y, h, itens, zebra, bordaTopo = true) => {
    if (c.cab) { pdf.setFillColor(...C.tableHeader); pdf.rect(c.x, y, c.w, h, 'F'); }
    else if (zebra) { pdf.setFillColor(...C.bgStripe); pdf.rect(c.x, y, c.w, h, 'F'); }
    let yy = y + padY;
    for (const it of itens) { it.draw(pdf, yy); yy += it.h; }
    pdf.setDrawColor(...COR_BORDA);
    pdf.setLineWidth(0.2);
    if (bordaTopo) pdf.line(c.x, y, c.x + c.w, y);
    pdf.line(c.x, y, c.x, y + h);
    pdf.line(c.x + c.w, y, c.x + c.w, y + h);
    pdf.line(c.x, y + h, c.x + c.w, y + h);
  };

  let corpoIdx = 0;
  let cabecalhoItem = null;
  const itens = [espaco(1.5)];
  for (const [ri, rf] of grupos) {
    const h = alt.slice(ri, rf + 1).reduce((a, b) => a + b, 0);
    const cab = ri === rf && ehCabecalho(ri) && corpoIdx === 0;
    const zebra = !semZebra && !cab && corpoIdx % 2 === 1;
    if (!cab) corpoIdx++;
    const offs = [];
    let acc = 0;
    for (let k = ri; k <= rf; k++) { offs.push(acc); acc += alt[k]; }
    const item = {
      h,
      cabecalho: cabecalhoItem,
      draw(pdf, y) {
        for (let k = ri; k <= rf; k++) {
          for (const c of cels[k]) {
            const hh = alt.slice(k, k + c.rs).reduce((a, b) => a + b, 0);
            desenharCelula(pdf, c, y + offs[k - ri], hh, c.itens, zebra);
          }
        }
      },
    };
    // uma linha simples (sem rowspan) pode partir-se entre páginas
    if (ri === rf) {
      const linha = cels[ri];
      const fazerParte = (partes, hParte, continua, zeb) => ({
        h: hParte,
        cabecalho: cabecalhoItem,
        draw(pdf, y) { linha.forEach((c, k) => desenharCelula(pdf, c, y, hParte, partes[k], zeb, !continua)); },
      });
      const partir = (itensPorCel, zeb, continua) => (disp) => {
        const util = disp - 2 * padY;
        if (util < alturaLinha(TAM.tabela)) return null;
        const a = [];
        const b = [];
        for (const its of itensPorCel) {
          let s = 0;
          let k = 0;
          while (k < its.length && s + its[k].h <= util) { s += its[k].h; k++; }
          a.push(its.slice(0, k));
          b.push(its.slice(k));
        }
        if (a.every((x) => !x.length)) return null;
        const hA = Math.max(...a.map((x) => x.reduce((p, q) => p + q.h, 0))) + 2 * padY;
        const hB = Math.max(alturaLinha(TAM.tabela), ...b.map((x) => x.reduce((p, q) => p + q.h, 0))) + 2 * padY;
        const pa = fazerParte(a, Math.max(hA, disp), continua, zeb);
        pa.h = disp;
        const pb = fazerParte(b, hB, true, zeb);
        pb.split = partir(b, zeb, true);
        return [pa, pb];
      };
      if (!cab) item.split = partir(linha.map((c) => c.itens), zebra, false);
    }
    if (cab) { cabecalhoItem = item; item.keep = true; item.cabecalho = null; }
    itens.push(item);
  }
  itens.push(espaco(3));
  // «Tabela N — legenda» por cima; fica presa ao cabeçalho e à primeira linha (nunca sozinha no fim da página)
  const legenda = limparTexto(textoLegenda(ctx.legendas, no));
  if (legenda && !ctx.emTabela) {
    const cap = legendaTabela(ctx, legenda);
    const linhasT = itens.filter((it) => !it.spacer);
    const primeiras = linhasT[0] && linhasT[0] === cabecalhoItem ? linhasT.slice(0, 2) : linhasT.slice(0, 1);
    cap.junto = 1.5 + Math.min(primeiras.reduce((a, b) => a + b.h, 0), (FUNDO - TOPO) * 0.4);
    return [espaco(2), cap, ...itens];
  }
  if (legenda) {
    // tabela dentro de célula: a legenda vai por cima sem regras de paginação
    return [legendaTabela(ctx, legenda), ...itens];
  }
  return itens;
}

// ─── Blocos ────────────────────────────────────────────────────────

function itensBloco(ctx, no) {
  if (!no || typeof no !== 'object') return [];
  switch (no.type) {
    case 'paragraph': return itensParagrafo(ctx, no);
    case 'heading': {
      if (ctx.emTabela) return itensParagrafo({ ...ctx, b: true }, no);
      const nivel = Math.min(4, Math.max(2, Number(no.attrs?.level) || 2));
      const numero = ctx.titulos?.get(no) || '';
      const marca = nivel === 2 && ctx.toc ? ctx.toc.registar(numero, textoSimples(no), 2) : undefined;
      return itensTitulo(ctx, textoSimples(no), numero, nivel, marca, alinhamentoPedido(no));
    }
    case 'bulletList': return itensLista(ctx, no, false);
    case 'orderedList': return itensLista(ctx, no, true);
    case 'listItem': return itensLista(ctx, { content: [no] }, false);
    case 'table': return itensTabela(ctx, no);
    case 'image': return itensImagem(ctx, no);
    case 'horizontalRule': return itensLinhaHorizontal(ctx);
    case 'blockquote': return itensCaixa(ctx, no);
    case 'hardBreak': return [espaco(alturaLinha(ctx.tam))];
    // quebra de página: o resto da secção começa em página nova (dentro de tabelas/caixas/listas não se aplica)
    case 'pageBreak': return ctx.emTabela || ctx.emCaixa || ctx.nivelLista ? [] : [{ quebra: true, h: 0, draw() {} }];
    case 'text': return itensParagrafo(ctx, { content: [no] });
    case 'doc': {
      const out = [];
      for (const f of no.content || []) out.push(...itensBloco(ctx, f));
      return out;
    }
    default: {
      // nó desconhecido: o texto simples, sem rebentar
      const t = textoSimples(no);
      if (!t.trim()) return [];
      const runs = [];
      t.split('\n').forEach((l, k) => { if (k) runs.push({ br: true }); runs.push({ t: limparTexto(l), b: !!ctx.b }); });
      return [...itensDeLinhas(partirLinhas(ctx.medir, runs, ctx.w, ctx.tam), ctx), espaco(ctx.tam * 0.22)];
    }
  }
}

// ─── Paginação ─────────────────────────────────────────────────────

function paginar(pdf, itens, { aoNovaPagina }) {
  let y = TOPO;
  const novaPagina = () => { pdf.addPage('a4', 'portrait'); aoNovaPagina?.(); y = TOPO; };
  const lista = itens.slice();
  const altUtil = FUNDO - TOPO;
  for (let i = 0; i < lista.length; i++) {
    const it = lista[i];
    if (it.quebra) { if (y > TOPO) novaPagina(); continue; }
    if (it.spacer) {
      if (y === TOPO) continue;
      if (y + it.h > FUNDO) { novaPagina(); continue; }
      y += it.h;
      continue;
    }
    // manter com o seguinte (títulos, cabeçalho de tabela)
    let precisa = it.h;
    if (it.junto) precisa += it.junto;
    else if (it.keep) {
      let j = i + 1;
      while (j < lista.length && lista[j].spacer) j++;
      if (j < lista.length && !lista[j].quebra) precisa += Math.min(lista[j].h, altUtil * 0.25);
    }
    if (y + precisa > FUNDO && y > TOPO) {
      const disp = FUNDO - y;
      // só se parte o que é alto (linhas de tabela curtas passam inteiras para a página seguinte)
      const partes = !it.keep && it.split && disp > 10 && it.h > altUtil * 0.3 ? it.split(disp) : null;
      if (partes) {
        partes[0].draw(pdf, y);
        if (it.marca) it.marca(pdf.getNumberOfPages());
        novaPagina();
        lista.splice(i + 1, 0, { ...partes[1], cabecalho: it.cabecalho });
        if (it.cabecalho) { it.cabecalho.draw(pdf, y); y += it.cabecalho.h; }
        continue;
      }
      novaPagina();
      if (it.cabecalho) { it.cabecalho.draw(pdf, y); y += it.cabecalho.h; }
    }
    // mais alto do que uma página inteira
    if (y + it.h > FUNDO && it.split) {
      const partes = it.split(FUNDO - y);
      if (partes) {
        partes[0].draw(pdf, y);
        if (it.marca) it.marca(pdf.getNumberOfPages());
        novaPagina();
        lista.splice(i + 1, 0, { ...partes[1], cabecalho: it.cabecalho });
        if (it.cabecalho) { it.cabecalho.draw(pdf, y); y += it.cabecalho.h; }
        continue;
      }
    }
    it.draw(pdf, y);
    if (it.marca) it.marca(pdf.getNumberOfPages());
    y += it.h;
  }
}

// ─── Capa, cabeçalho, rodapé ───────────────────────────────────────

function imagemLogo(pdf, logo, x, y, { maxW, maxH, centro = false }) {
  if (!logo) return 0;
  try {
    const p = pdf.getImageProperties(logo);
    const r = p.width / p.height;
    let w = maxW;
    let h = w / r;
    if (h > maxH) { h = maxH; w = h * r; }
    pdf.addImage(logo, String(p.fileType || 'PNG').toUpperCase(), centro ? x - w / 2 : x, y, w, h, 'logo-sga', 'FAST');
    return w;
  } catch {
    return 0;
  }
}

function textoCentrado(pdf, medir, texto, y, { tam, b = false, i = false, cor = COR_TEXTO, larg = CW, entrelinha = ENTRELINHA }) {
  const linhas = partirLinhas(medir, [{ t: limparTexto(texto), b, i }], larg, tam);
  const lh = tam * PT * entrelinha;
  linhas.forEach((ln, k) => desenharLinha(pdf, ln, (PW - larg) / 2, y + k * lh, tam, cor, 'center', larg));
  return linhas.length * lh;
}

// ── assinaturas electrónicas do fluxo de aprovação ─────────────────────────────
// opcoes.assinaturas: { elaborado, verificado, aprovado }, cada uma
//   { nome, papel?, significado?, em (ISO), codigo, substituicao?, rubrica? (data URL PNG/JPEG da própria pessoa) }.
// A prova é o registo electrónico (documento_assinatura); a rubrica é só a aparência e nunca substitui os dados.
const ORDEM_ASSINATURAS = ['elaborado', 'verificado', 'aprovado'];
const COR_ASSINADO = { fundo: [240, 253, 244], borda: [134, 239, 172], texto: [21, 128, 61] };

/** Data e hora em hora de Angola, com o fuso escrito (a mesma regra do selo no portal). */
export function horaAngola(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Africa/Luanda', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const v = (t) => p.find(x => x.type === t)?.value || '';
  return `${v('day')}/${v('month')}/${v('year')} ${v('hour')}:${v('minute')} (UTC+1)`;
}

function rubricaNaCaixa(pdf, src, x, y, w, h) {
  try {
    const fmt = /^data:image\/jpe?g/i.test(src) ? 'JPEG' : 'PNG';
    const prop = pdf.getImageProperties(src);
    const esc = Math.min(w / prop.width, h / prop.height);
    const wi = prop.width * esc;
    const hi = prop.height * esc;
    pdf.addImage(src, fmt, x + (w - wi) / 2, y + (h - hi) / 2, wi, hi);
  } catch { /* imagem inválida: fica só o registo electrónico */ }
}

/**
 * Quadro Elaborado / Verificado / Aprovado, com o selo electrónico de cada acto assinado.
 * Partilhado pela capa dos documentos estruturados e pela «Folha de assinaturas» das cópias de ficheiro.
 * @param {{ x?: number, y: number, largura?: number, nomes?: string[], assinaturas?: object }} op
 *   nomes: os nomes do cabeçalho (usados quando o acto ainda não foi assinado); assinaturas: { elaborado, verificado, aprovado }.
 * @returns {number} altura desenhada (mm)
 */
export function desenharQuadroAssinaturas(pdf, medir, { x: x0 = ML, y: ya, largura = CW, nomes = [], assinaturas = {} } = {}) {
  const assin = assinaturas || {};
  const algumaAssinada = ORDEM_ASSINATURAS.some(k => assin[k]);
  const col = largura / 3;
  const rotulos = ['Elaborado por', 'Verificado por', 'Aprovado por'];
  const hCab = 7;
  const hNome = 11;
  // selo: rubrica + «Assinado electronicamente» + significado (+ substituição) + código. Com substituição a rubrica
  // encolhe; a caixa cresce se ainda assim o texto não couber (as três colunas ficam com a mesma altura).
  const hRubDe = (a) => (a.rubrica ? (a.substituicao ? 9 : 11) : 0);
  const sigDe = (a) => partirLinhas(medir, [{ t: limparTexto(a.significado || ''), i: true }], col - 6, 6.6).slice(0, a.rubrica ? 2 : 3);
  const precisa = (a) => 2.5 + hRubDe(a) + 2.6 + 3.4 + sigDe(a).length * alturaLinha(6.6) + (a.substituicao ? alturaLinha(6.4) : 0) + 4.8;
  const hAss = algumaAssinada ? Math.max(ORDEM_ASSINATURAS.some(k => assin[k]?.rubrica) ? 30 : 20, ...ORDEM_ASSINATURAS.filter(k => assin[k]).map(k => precisa(assin[k]))) : 22;
  const hData = 8;
  rotulos.forEach((rot, k) => {
    const x = x0 + k * col;
    const a = assin[ORDEM_ASSINATURAS[k]] || null;
    const nome = a?.nome || nomes[k];
    pdf.setFillColor(...C.tableHeader);
    pdf.rect(x, ya, col, hCab, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...C.white);
    pdf.text(limparTexto(rot), x + col / 2, ya + 4.8, { align: 'center' });
    // nome (e, se assinado, o papel com que assinou)
    const corridasNome = [{ t: limparTexto(nome || ''), b: true }];
    const linhas = partirLinhas(medir, corridasNome, col - 4, 9.5).slice(0, a?.papel ? 1 : 2);
    const lh = alturaLinha(9.5);
    const nLinhas = linhas.length + (a?.papel ? 0.8 : 0);
    const y0 = ya + hCab + (hNome - nLinhas * lh) / 2 + lh * 0.78;
    linhas.forEach((ln, j) => desenharLinha(pdf, ln, x + 2, y0 + j * lh, 9.5, COR_TEXTO, 'center', col - 4));
    if (a?.papel) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...C.muted);
      const papel = partirLinhas(medir, [{ t: limparTexto(a.papel) }], col - 4, 7)[0];
      desenharLinha(pdf, papel, x + 2, y0 + linhas.length * lh + 0.6, 7, C.muted, 'center', col - 4);
    }
    const yA = ya + hCab + hNome;
    if (a) {
      // selo electrónico: rubrica (se a pessoa a tiver) + «Assinado electronicamente», significado e código
      pdf.setFillColor(...COR_ASSINADO.fundo);
      pdf.rect(x, yA, col, hAss, 'F');
      const hRub = hRubDe(a);
      if (a.rubrica) rubricaNaCaixa(pdf, a.rubrica, x + 6, yA + 1.5, col - 12, hRub);
      let yt = yA + 2.5 + hRub + 2.6;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COR_ASSINADO.texto);
      pdf.text(limparTexto('Assinado electronicamente'), x + col / 2, yt, { align: 'center' });
      yt += 3.4;
      const sig = sigDe(a);
      sig.forEach((ln) => { desenharLinha(pdf, ln, x + 3, yt, 6.6, C.muted, 'center', col - 6); yt += alturaLinha(6.6); });
      if (a.substituicao) {
        const sub = partirLinhas(medir, [{ t: limparTexto(`Em substituição de ${a.substituicao}`) }], col - 6, 6.4)[0];
        desenharLinha(pdf, sub, x + 3, yt, 6.4, C.muted, 'center', col - 6); yt += alturaLinha(6.4);
      }
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(7.2);
      pdf.setTextColor(...COR_TEXTO);
      pdf.text(limparTexto(`Código ${a.codigo || ''}`), x + col / 2, yA + hAss - 2.2, { align: 'center' });
      // data e hora do acto
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...C.light);
      pdf.text('Data:', x + 2, yA + hAss + 5.3);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...COR_TEXTO);
      pdf.text(limparTexto(horaAngola(a.em)), x + col / 2 + 4, yA + hAss + 5.3, { align: 'center' });
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...C.light);
      pdf.text(algumaAssinada ? 'Por assinar' : 'Assinatura', x + 2, yA + 3.6);
      pdf.setDrawColor(...C.light);
      pdf.setLineWidth(0.2);
      pdf.line(x + 8, yA + hAss - 4, x + col - 8, yA + hAss - 4);
      pdf.text('Data:', x + 2, yA + hAss + 5.3);
      pdf.setTextColor(...C.muted);
      pdf.setFontSize(8.5);
      pdf.text('____ / ____ / ________', x + col / 2 + 3, yA + hAss + 5.3, { align: 'center' });
    }
    // bordas
    pdf.setDrawColor(...COR_BORDA);
    pdf.setLineWidth(0.25);
    pdf.rect(x, ya, col, hCab + hNome + hAss + hData);
    pdf.line(x, ya + hCab + hNome, x + col, ya + hCab + hNome);
    pdf.line(x, ya + hCab + hNome + hAss, x + col, ya + hCab + hNome + hAss);
  });
  return hCab + hNome + hAss + hData;
}

/**
 * Bloco de verificação: QR à direita (lado lQr mm) com o código por baixo, e as notas à esquerda.
 * @returns {number} y final (mm) do bloco
 */
export function desenharVerificacao(pdf, medir, {
  x = ML, y: yv, largura = CW, qr = null, lQr: lado = 21, codigo = '', verificarUrl = '', algumaAssinada = false,
  notaQr = 'Leia o código QR (nesta capa ou no rodapé de qualquer página) para confirmar se esta é a revisão em vigor e se o conteúdo não foi alterado.',
  notasExtra = [],
} = {}) {
  const lQr = qr ? lado : 0;
  let yFimQr = yv;
  if (qr) {
    const xq = x + largura - lQr;
    try { pdf.addImage(qr, 'PNG', xq, yv - 2, lQr, lQr, undefined, 'FAST'); } catch { /* sem QR */ }
    const tamR = lado > 30 ? 8 : 6.8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(tamR);
    pdf.setTextColor(...C.primary);
    pdf.text('Verificar este documento', xq + lQr / 2, yv + lQr + 1.4, { align: 'center' });
    yFimQr = yv + lQr + 1.4;
    if (codigo) {
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(tamR);
      pdf.setTextColor(...COR_TEXTO);
      // o código pode ser mais largo do que o QR pequeno: centra-se no QR sem passar a margem direita
      const cod = limparTexto(codigo);
      const wc = pdf.getTextWidth(cod);
      const xc = Math.min(xq + lQr / 2, x + largura - wc / 2);
      yFimQr += tamR * PT * 1.3;
      pdf.text(cod, xc, yFimQr, { align: 'center' });
    }
  }
  const larguraNota = largura - (lQr ? lQr + 6 : 0);
  const notas = [];
  if (algumaAssinada) {
    notas.push('Assinaturas electrónicas registadas no fluxo de aprovação do Portal de Documentos da SGA (autenticação com a senha de cada signatário). '
      + (verificarUrl
        ? `Para confirmar uma assinatura, abra ${verificarUrl}/ seguido do código indicado.`
        : 'Cada assinatura confirma-se no Portal de Documentos pelo código indicado.'));
  }
  if (qr && notaQr) notas.push(notaQr);
  notas.push(...notasExtra);
  let yn = yv + 2;
  for (const txt of notas) {
    const linhasV = partirLinhas(medir, [{ t: limparTexto(txt) }], larguraNota, 7.2);
    linhasV.forEach((ln) => { desenharLinha(pdf, ln, x, yn, 7.2, C.muted, lQr ? 'left' : 'center', larguraNota); yn += alturaLinha(7.2); });
    yn += 1.5;
  }
  return Math.max(yn, yFimQr);
}

function desenharCapa(pdf, medir, doc, logo, recursos = {}) {
  const cab = doc.cabecalho || {};
  const assin = recursos.assinaturas || {};
  const algumaAssinada = ORDEM_ASSINATURAS.some(k => assin[k]);
  // faixa superior
  pdf.setFillColor(...C.primary);
  pdf.rect(0, 0, PW, 4, 'F');

  imagemLogo(pdf, logo, PW / 2, 22, { maxW: 72, maxH: 30, centro: true });

  let y = 66;
  const aero = [cab.aeroportoNome, cab.aeroporto ? `(${cab.aeroporto})` : ''].filter(Boolean).join(' ');
  if (aero) y += textoCentrado(pdf, medir, aero, y, { tam: 12, cor: C.body });

  y = Math.max(y + 18, 96);
  pdf.setDrawColor(...C.primary);
  pdf.setLineWidth(0.6);
  pdf.line(PW / 2 - 20, y - 8, PW / 2 + 20, y - 8);
  y += textoCentrado(pdf, medir, nomeClasse(doc.modelo).toUpperCase(), y, { tam: 13, b: true, cor: C.primary });
  y += 6;
  y += textoCentrado(pdf, medir, cab.titulo || 'Sem título', y, { tam: 22, b: true, cor: COR_TEXTO, larg: CW - 10, entrelinha: 1.25 });

  // quadro de identificação
  const campos = [
    ['Número', cab.numero || '—'],
    ['Revisão', revisaoPad(cab.revisao)],
    ['Data', dataPt(cab.data) || '—'],
  ];
  if (cab.classificacao) campos.push(['Classificação', cab.classificacao]);
  const yq = Math.max(y + 14, 160);
  const wq = CW;
  const larguras = campos.map(([, v], k) => (k === 0 ? 2 : 1) * 1);
  const somaL = larguras.reduce((a, b) => a + b, 0);
  let xq = ML;
  campos.forEach(([rot, val], k) => {
    const w = (larguras[k] / somaL) * wq;
    pdf.setDrawColor(...COR_BORDA);
    pdf.setLineWidth(0.25);
    pdf.rect(xq, yq, w, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...C.muted);
    pdf.text(limparTexto(rot.toUpperCase()), xq + w / 2, yq + 5, { align: 'center' });
    const ln = partirLinhas(medir, [{ t: limparTexto(val), b: true }], w - 4, 10)[0];
    desenharLinha(pdf, ln, xq + 2, yq + 11.2, 10, COR_TEXTO, 'center', w - 4);
    xq += w;
  });

  // quadro de aprovação (o mesmo desenho da folha de assinaturas das cópias de ficheiro — ver copiaAssinada.js)
  const ya = (algumaAssinada || recursos.qr) ? 190 : 200;
  const hQuadro = desenharQuadroAssinaturas(pdf, medir, {
    x: ML, y: ya, largura: CW,
    nomes: [cab.elaboradoPor, cab.verificadoPor, cab.aprovadoPor],
    assinaturas: assin,
  });
  desenharVerificacao(pdf, medir, {
    x: ML, y: ya + hQuadro + 6, largura: CW,
    qr: recursos.qr, lQr: 21, codigo: recursos.verificacao?.codigo,
    verificarUrl: recursos.verificarUrl, algumaAssinada,
  });

  // nota de controlo
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...C.muted);
  pdf.text(limparTexto('Documento controlado pelo Portal de Documentos da SGA. As cópias impressas não são controladas.'), PW / 2, PH - 14, { align: 'center' });
  pdf.setFillColor(...C.primary);
  pdf.rect(0, PH - 4, PW, 4, 'F');
}

function desenharCabecalho(pdf, medir, cab, logo) {
  const wLogo = imagemLogo(pdf, logo, ML, 9, { maxW: 30, maxH: 11.5 });
  const xT = ML + (wLogo ? wLogo + 6 : 0);
  const largT = PW - MR - xT;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...C.primary);
  const num = partirLinhas(medir, [{ t: limparTexto(cab.numero || ''), b: true }], largT, 9.5)[0];
  desenharLinha(pdf, num, xT, 14, 9.5, C.primary, 'right', largT);
  // título numa linha (com reticências se não couber)
  let t = limparTexto(cab.titulo || '');
  if (medir(t, 8.5, false, false) > largT) {
    while (t.length > 3 && medir(`${t}…`, 8.5, false, false) > largT) t = t.slice(0, -1);
    t = `${t.trimEnd()}…`;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...C.body);
  pdf.text(t, PW - MR, 19, { align: 'right' });
  pdf.setDrawColor(...C.primary);
  pdf.setLineWidth(0.5);
  pdf.line(ML, 24, PW - MR, 24);
}

function desenharRodape(pdf, cab, pagina, total, qr = null) {
  const { revisao, data } = textosRodape(cab);
  const textos = [revisao, data, `Página ${pagina} de ${total}`];
  const y = PH - 18;
  const h = 7;
  // com QR de verificação: a tabela encolhe e o QR pequeno fica à direita, alinhado com ela
  const lQr = qr ? 11 : 0;
  const w = (CW - (qr ? lQr + 2 : 0)) / 3;
  if (qr) {
    try { pdf.addImage(qr, 'PNG', ML + CW - lQr, y + h / 2 - lQr / 2, lQr, lQr, undefined, 'FAST'); } catch { /* sem QR */ }
  }
  pdf.setDrawColor(...C.muted);
  pdf.setLineWidth(0.25);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...C.body);
  textos.forEach((t, k) => {
    const x = ML + k * w;
    pdf.rect(x, y, w, h);
    pdf.text(limparTexto(t), x + w / 2, y + 4.6, { align: 'center' });
  });
  if (cab.classificacao) {
    pdf.setFontSize(6.5);
    pdf.setTextColor(...C.muted);
    pdf.text(limparTexto(cab.classificacao), PW / 2, y + h + 4, { align: 'center' });
  }
}

// ─── Página de controlo e índice ───────────────────────────────────

function tituloSimples(ctx, texto, tam = TAM.h1) {
  const linhas = partirLinhas(ctx.medir, [{ t: limparTexto(texto), b: true }], ctx.w, tam);
  return [espaco(4), ...itensDeLinhas(linhas, { ...ctx, tam, cor: C.primary }).map((it) => ({ ...it, keep: true })), espaco(2.5)];
}

function itensControlo(ctx, doc, entradasToc, paginasToc) {
  const cab = doc.cabecalho || {};
  const hist = (doc.historico || []).filter(Boolean);
  const linhasHist = hist.length ? hist : [{ revisao: cab.revisao, data: cab.data, descricao: 'Emissão inicial', autor: cab.elaboradoPor }];
  const cel = (t, cabe = false) => ({ type: cabe ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: t ? [{ type: 'text', text: String(t) }] : [] }] });
  const tabela = {
    type: 'table',
    content: [
      { type: 'tableRow', content: ['Revisão', 'Data', 'Descrição das alterações', 'Autor'].map((t) => cel(t, true)) },
      ...linhasHist.map((h) => ({ type: 'tableRow', content: [cel(revisaoPad(h.revisao)), cel(dataPt(h.data)), cel(h.descricao), cel(h.autor)] })),
    ],
  };
  const itens = [
    ...tituloSimples(ctx, 'Controlo do documento', 14).slice(1),
    ...tituloSimples(ctx, 'Histórico de revisões', TAM.h2),
    ...itensTabela(ctx, tabela),
    ...tituloSimples(ctx, 'Índice', TAM.h2),
  ];
  // entradas do índice
  const tam = 10;
  const lh = alturaLinha(tam);
  const wPag = 12;
  for (const e of entradasToc) {
    const recuo = e.nivel === 1 ? 0 : 8;
    const num = e.nivel === 1 ? `${e.numero}.` : e.numero;
    const wNum = e.nivel === 1 ? 8 : 12;
    const x = ctx.x + recuo;
    const larg = ctx.w - recuo - wNum - wPag - 2;
    const linhas = partirLinhas(ctx.medir, [{ t: limparTexto(e.titulo), b: e.nivel === 1 }], larg, tam);
    const pag = paginasToc[e.chave] ? String(paginasToc[e.chave]) : '';
    if (e.nivel === 1) itens.push(espaco(1.2));
    itens.push({
      h: linhas.length * lh,
      draw(pdf, y) {
        linhas.forEach((ln, k) => {
          const yb = y + k * lh + lh * 0.78;
          if (k === 0) {
            pdf.setFont('helvetica', e.nivel === 1 ? 'bold' : 'normal');
            pdf.setFontSize(tam);
            pdf.setTextColor(...COR_TEXTO);
            pdf.text(num, x, yb);
          }
          desenharLinha(pdf, ln, x + wNum, yb, tam, COR_TEXTO);
          if (k === linhas.length - 1) {
            // pontos até ao número de página
            const xi = x + wNum + ln.w + 1.5;
            const xf = ctx.x + ctx.w - wPag;
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...C.light);
            const wp = pdf.getTextWidth('.');
            const n = Math.max(0, Math.floor((xf - xi) / (wp + pdf.getTextWidth(' '))));
            if (n > 0) pdf.text(Array(n).fill('.').join(' ').slice(0, n * 2 - 1), xi, yb);
            pdf.setTextColor(...COR_TEXTO);
            pdf.setFont('helvetica', e.nivel === 1 ? 'bold' : 'normal');
            pdf.text(pag, ctx.x + ctx.w, yb, { align: 'right' });
          }
        });
      },
    });
  }
  return itens;
}

// ─── Montagem ──────────────────────────────────────────────────────

function renderizar(JsPDF, doc, recursos, paginasToc) {
  const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const cab = doc.cabecalho || {};
  pdf.setProperties({
    title: limparTexto([cab.numero, cab.titulo].filter(Boolean).join(' — ')),
    subject: nomeClasse(doc.modelo),
    author: limparTexto(cab.elaboradoPor || 'SGA'),
    creator: 'SGA — Portal de Documentos',
  });
  const medir = criarMedidor(pdf);
  const { seccoes, titulos } = numerarTitulos(doc);

  const paginas = {};
  const entradas = [];
  let seq = 0;
  const toc = {
    registar(numero, titulo, nivel) {
      const chave = `t${seq++}`;
      entradas.push({ chave, numero, titulo, nivel });
      return (pag) => { if (!paginas[chave]) paginas[chave] = pag; };
    },
  };

  const legendas = numerarLegendas(doc);
  const ctx = { pdf, medir, x: ML, w: CW, tam: TAM.corpo, cor: COR_TEXTO, b: false, imagens: recursos.imagens, titulos, legendas, toc, nivelLista: 0 };

  // corpo primeiro (para conhecer as entradas do índice), desenho depois
  const corpo = [];
  const novaPaginaPorSeccao = seccaoEmNovaPagina(doc);
  for (const [iSec, s] of seccoes.entries()) {
    if (novaPaginaPorSeccao && iSec > 0) corpo.push({ quebra: true, h: 0, draw() {} });
    const marca = toc.registar(s.numero, s.titulo, 1);
    corpo.push(...itensTitulo(ctx, s.titulo, s.numero, 1, marca));
    const conteudo = s.seccao?.conteudo;
    const itensS = conteudo ? itensBloco(ctx, conteudo) : [];
    if (!itensS.some((it) => !it.spacer)) {
      const linhas = partirLinhas(medir, [{ t: 'Secção sem conteúdo.', i: true }], CW, TAM.corpo);
      corpo.push(...itensDeLinhas(linhas, { ...ctx, cor: C.light }));
    } else corpo.push(...itensS);
  }

  // capa
  desenharCapa(pdf, medir, doc, recursos.logo, recursos);
  // controlo + índice
  pdf.addPage('a4', 'portrait');
  const controlo = itensControlo(ctx, doc, entradas, paginasToc);
  paginar(pdf, [...controlo, { quebra: true, h: 0, draw() {} }, ...corpo], {});

  // cabeçalhos e rodapés (todas menos a capa)
  const total = pdf.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    pdf.setPage(p);
    desenharCabecalho(pdf, medir, cab, recursos.logo);
    desenharRodape(pdf, cab, p, total, recursos.qr);
  }
  return { pdf, paginas };
}

/**
 * Gera o PDF do documento estruturado.
 * @param {import('./contrato').DocumentoEstruturado} doc
 * @param {{ logo?: string|null, logoUrl?: string, assinaturas?: object, verificarUrl?: string }} [opcoes]
 *   assinaturas: { elaborado, verificado, aprovado } do fluxo de aprovação — preenchem o quadro da capa.
 * @returns {Promise<Blob>}
 */
export async function gerarPdf(doc, opcoes = {}) {
  if (!doc || typeof doc !== 'object') throw new Error('Documento estruturado em falta');
  const { default: JsPDF } = await import('jspdf');
  const [logo, imagens] = await Promise.all([carregarLogo(opcoes), resolverImagens(doc)]);
  // QR de verificação (como nos certificados da Universidade): leva à página do Portal que diz se esta revisão é a
  // que está em vigor, com que conteúdo (SHA-256) e quem a assinou. opcoes.verificacao = { url, codigo }
  let qr = null;
  if (opcoes.verificacao?.url) {
    try {
      const { default: QRCode } = await import('qrcode');
      qr = await QRCode.toDataURL(opcoes.verificacao.url, { margin: 0, width: 320, errorCorrectionLevel: 'M' });
    } catch { qr = null; }
  }
  const recursos = { logo, imagens, assinaturas: opcoes.assinaturas || null, verificarUrl: opcoes.verificarUrl || '', qr, verificacao: opcoes.verificacao || null };
  // 1.ª passagem: descobrir em que página começa cada secção; 2.ª: desenhar o índice com esses números
  const { paginas } = renderizar(JsPDF, doc, recursos, {});
  const { pdf } = renderizar(JsPDF, doc, recursos, paginas);
  return pdf.output('blob');
}

export default gerarPdf;

// para testes
export const __interno = { partirLinhas, corridas, criarMedidor };

// primitivas partilhadas com a folha de assinaturas das cópias de ficheiro (copiaAssinada.js)
export const __partilhado = {
  criarMedidor, partirLinhas, desenharLinha, imagemLogo, textoCentrado, alturaLinha,
  COR_TEXTO, COR_BORDA, CORES: C, PT, MEDIDAS: { PW, PH, ML, MR, CW },
};
