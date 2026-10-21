// Cópia assinada de uma revisão aprovada — geradores puros (sem React nem rede: recebem tudo por parâmetro).
//
// A cópia é um ficheiro DERIVADO do PDF original assinado; o original nunca muda. O código de verificação de uma
// revisão são os 12 primeiros hex do SHA-256 do PDF ORIGINAL, em maiúsculas e em grupos 4-4-4 («7F3A-91C2-0B4D»),
// e o QR aponta para <origem>/vd/<código>. A prova continua a ser a assinatura electrónica registada na base
// (documento_assinatura); a cópia é a forma legível dela.
//
//   codigoVerificacao(sha256Hex)                       -> '7F3A-91C2-0B4D'
//   urlVerificacao(origem, codigo)                     -> 'https://…/vd/7F3A-91C2-0B4D'
//   assinaturasParaCapa(linhasAssinatura, rubricas)    -> { elaborado, verificado, aprovado } (opcoes.assinaturas)
//   gerarCopiaEstruturada({ conteudo, … })             -> Blob  (documento do editor: capa com o quadro assinado)
//   gerarCopiaDeFicheiro({ pdfOriginal, … })           -> Blob  (PDF carregado: QR pequeno nas páginas + folha final)
//   gerarCopiaDeFicheiroDetalhada({ … })               -> { blob, paginas, deteccao } (o mesmo, com o relatório)
import { gerarPdf, horaAngola, limparTexto, desenharQuadroAssinaturas, desenharVerificacao, __partilhado } from './gerarPdfEstruturado';
import { revisaoPad, dataPt } from './comum';

// ─── código e endereço de verificação ──────────────────────────────

/** 12 primeiros hex do SHA-256, maiúsculas, 4-4-4. Atira se o SHA-256 não for válido. */
export function codigoVerificacao(sha256Hex) {
  const h = String(sha256Hex || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error('Impressão digital (SHA-256) do PDF original inválida: não é possível calcular o código de verificação.');
  const c = h.slice(0, 12).toUpperCase();
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

/** <origem>/vd/<código> (sem barra duplicada). */
export function urlVerificacao(origem, codigo) {
  const o = String(origem || '').trim().replace(/\/+$/, '');
  return `${o}/vd/${encodeURIComponent(String(codigo || '').trim())}`;
}

// ─── assinaturas do fluxo → quadro da capa ─────────────────────────

const ACTO_PARA_CAMPO = { elaboracao: 'elaborado', revisao: 'verificado', aprovacao: 'aprovado' };
const ORDEM_ACTO = { elaboracao: 1, revisao: 2, aprovacao: 3 };
const PAPEL_ROTULO = { elaborador: 'Elaborador', revisor: 'Revisor', director_aeroporto: 'Director do aeroporto' };
const tempo = (v) => { const t = new Date(v || 0).getTime(); return Number.isNaN(t) ? 0 : t; };

// Uma linha conta se não estiver marcada como inválida (a vista de hoje não tem estas colunas; ficam por
// precaução, para uma anulação futura não aparecer carimbada).
const valida = (l) => l && ACTO_PARA_CAMPO[l.acto] && l.valida !== false && l.ficheiro_intacto !== false
  && !l.anulada && !l.anulada_em && !l.revogada_em && !l.invalidada_em;

function rubricaDe(rubricas, email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !rubricas) return null;
  const v = typeof rubricas.get === 'function' ? rubricas.get(e) : rubricas[e];
  return typeof v === 'string' && v.startsWith('data:image/') ? v : null;
}

/**
 * Linhas de documento_assinaturas_vista (de UMA revisão) → opcoes.assinaturas do gerador.
 *
 * Várias voltas: conta a ronda final (a maior). Uma devolução ao revisor abre ronda nova SEM nova elaboração —
 * por isso os actos ANTERIORES ao primeiro acto assinado na ronda final mantêm a assinatura válida mais recente
 * das rondas anteriores; os actos a partir desse ponto só contam se forem da ronda final (o que foi refeito
 * não pode mostrar a assinatura antiga). Havendo vários fluxos, fica o da assinatura mais recente.
 * Acto em falta → campo ausente (o quadro mostra «Por assinar»).
 */
export function assinaturasParaCapa(linhasAssinatura, rubricasPorEmail = {}) {
  let linhas = (Array.isArray(linhasAssinatura) ? linhasAssinatura : []).filter(valida);
  if (!linhas.length) return {};
  const ultima = linhas.slice().sort((a, b) => tempo(b.assinado_em) - tempo(a.assinado_em))[0];
  if (ultima.fluxo_id) linhas = linhas.filter(l => !l.fluxo_id || String(l.fluxo_id) === String(ultima.fluxo_id));
  const ronda = (l) => Number(l.ronda) || 1;
  const rondaFinal = Math.max(...linhas.map(ronda));
  const daFinal = linhas.filter(l => ronda(l) === rondaFinal);
  const inicioFinal = Math.min(...daFinal.map(l => ORDEM_ACTO[l.acto]));

  const out = {};
  for (const acto of Object.keys(ACTO_PARA_CAMPO)) {
    const cand = (ORDEM_ACTO[acto] < inicioFinal ? linhas : daFinal)
      .filter(l => l.acto === acto)
      .sort((a, b) => ronda(b) - ronda(a) || tempo(b.assinado_em) - tempo(a.assinado_em));
    const l = cand[0];
    if (!l) continue;
    const a = {
      nome: l.nome || l.signatario_nome || l.signatario_email || '',
      papel: PAPEL_ROTULO[l.signatario_papel] || l.signatario_papel || '',
      significado: l.significado || '',
      em: l.assinado_em,
      codigo: l.codigo || '',
    };
    if (l.em_substituicao_de) a.substituicao = l.em_substituicao_de;
    const rub = rubricaDe(rubricasPorEmail, l.signatario_email);
    if (rub) a.rubrica = rub;
    out[ACTO_PARA_CAMPO[acto]] = a;
  }
  return out;
}

// ─── utilitários ───────────────────────────────────────────────────

async function qrDataUrl(texto, largura = 480) {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(texto, { margin: 1, width: largura, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
}

function dataUrlBytes(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function paraUint8(entrada) {
  if (entrada instanceof Uint8Array) return entrada;
  if (entrada instanceof ArrayBuffer) return new Uint8Array(entrada);
  if (ArrayBuffer.isView(entrada)) return new Uint8Array(entrada.buffer, entrada.byteOffset, entrada.byteLength);
  throw new Error('O PDF original tem de chegar como ArrayBuffer.');
}

async function sha256Hex(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;              // HTTP sem crypto.subtle: quem chama já confirmou a impressão digital
  try {
    const h = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

const rotuloRev = (v) => `Rev.${revisaoPad(v)}`;

// ─── a) documento estruturado ──────────────────────────────────────

/**
 * Cópia assinada de um documento do editor estruturado: o mesmo PDF, com o quadro da capa assinado e o QR.
 * @returns {Promise<Blob>}
 */
export async function gerarCopiaEstruturada({ conteudo, linhasAssinatura, rubricas, origem, shaOriginal, logo } = {}) {
  if (!conteudo || typeof conteudo !== 'object') throw new Error('Conteúdo do documento estruturado em falta.');
  const codigo = codigoVerificacao(shaOriginal);
  const o = String(origem || '').replace(/\/+$/, '');
  const cab = conteudo.cabecalho || {};
  const rotulo = [cab.numero, rotuloRev(cab.revisao), codigo].filter(Boolean).join(' · ');
  return gerarPdf(conteudo, {
    logo: logo ?? undefined,
    assinaturas: assinaturasParaCapa(linhasAssinatura, rubricas),
    verificarUrl: `${o}/vd`,
    verificacao: { url: urlVerificacao(o, codigo), codigo: rotulo },
  });
}

// ─── b) PDF carregado como ficheiro ────────────────────────────────

const MM = 72 / 25.4;              // pontos por mm
const LADO_QR_MM = 10;             // QR pequeno nas páginas
const MARGEM_MM = 6;               // distância à borda da folha
const FOLGA_MM = 1.5;              // espaço livre exigido à volta do QR

/** Folha de assinaturas A4 (jsPDF), no padrão SGA. Devolve ArrayBuffer. */
async function folhaAssinaturas({ documento = {}, versao = {}, assinaturas, qr, codigo, rotuloVerificacao, verificarUrl, logo, paginasOriginais }) {
  const { default: JsPDF } = await import('jspdf');
  const P = __partilhado;
  const { PW, PH, ML, CW } = P.MEDIDAS;
  const C = P.CORES;
  const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const medir = P.criarMedidor(pdf);

  pdf.setFillColor(...C.primary);
  pdf.rect(0, 0, PW, 4, 'F');
  P.imagemLogo(pdf, logo, PW / 2, 13, { maxW: 54, maxH: 22, centro: true });

  let y = 46;
  pdf.setDrawColor(...C.primary);
  pdf.setLineWidth(0.6);
  pdf.line(PW / 2 - 20, y - 6, PW / 2 + 20, y - 6);
  y += P.textoCentrado(pdf, medir, 'FOLHA DE ASSINATURAS', y, { tam: 13, b: true, cor: C.primary });
  y += 4;
  y += P.textoCentrado(pdf, medir, documento.titulo || 'Sem título', y, { tam: 15, b: true, cor: P.COR_TEXTO, larg: CW - 10, entrelinha: 1.25 });

  // identificação: número | revisão | data de aprovação | páginas
  const aprovado = assinaturas.aprovado?.em || versao.aprovado_em || null;
  const campos = [
    ['Número', documento.numero || '—'],
    ['Revisão', revisaoPad(versao.versao ?? versao.rotulo)],
    ['Aprovação', aprovado ? (horaAngola(aprovado).slice(0, 10) || dataPt(aprovado)) : '—'],
    ['Páginas do original', paginasOriginais ? String(paginasOriginais) : '—'],
  ];
  const pesos = [2, 1, 1, 1];
  const soma = pesos.reduce((a, b) => a + b, 0);
  const yq = y + 8;
  let xq = ML;
  campos.forEach(([rot, val], k) => {
    const w = (pesos[k] / soma) * CW;
    pdf.setDrawColor(...P.COR_BORDA);
    pdf.setLineWidth(0.25);
    pdf.rect(xq, yq, w, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...C.muted);
    pdf.text(limparTexto(rot.toUpperCase()), xq + w / 2, yq + 5, { align: 'center' });
    const ln = P.partirLinhas(medir, [{ t: limparTexto(val), b: true }], w - 4, 10)[0];
    if (ln) P.desenharLinha(pdf, ln, xq + 2, yq + 11.2, 10, P.COR_TEXTO, 'center', w - 4);
    xq += w;
  });

  // texto de enquadramento
  let yt = yq + 15 + 9;
  const intro = `Esta folha faz parte da cópia assinada do documento ${documento.numero || ''}, revisão ${revisaoPad(versao.versao ?? versao.rotulo)}. `
    + 'As páginas anteriores são o PDF original aprovado, sem alterações de conteúdo; foi-lhes acrescentado apenas um código QR pequeno de verificação. '
    + 'Os actos abaixo foram assinados electronicamente no fluxo de aprovação do Portal de Documentos da SGA.';
  P.partirLinhas(medir, [{ t: limparTexto(intro) }], CW, 8.5).forEach((ln) => {
    P.desenharLinha(pdf, ln, ML, yt, 8.5, C.body, 'left', CW);
    yt += P.alturaLinha(8.5);
  });

  const yQuadro = yt + 5;
  const hQuadro = desenharQuadroAssinaturas(pdf, medir, { x: ML, y: yQuadro, largura: CW, nomes: [], assinaturas });
  const algumaAssinada = ['elaborado', 'verificado', 'aprovado'].some(k => assinaturas[k]);

  // verificação: QR grande à direita, notas à esquerda
  desenharVerificacao(pdf, medir, {
    x: ML, y: yQuadro + hQuadro + 10, largura: CW,
    qr, lQr: 40, codigo: rotuloVerificacao || codigo, verificarUrl, algumaAssinada,
    notaQr: `Leia o código QR (nesta folha ou no canto de cada página) ou abra o Portal de Documentos com o código ${codigo} para confirmar se esta é a revisão em vigor e se o PDF original não foi alterado.`,
    notasExtra: [`Código de verificação da revisão: ${codigo} (impressão digital SHA-256 do PDF original assinado).`],
  });

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...C.muted);
  pdf.text(limparTexto('Documento controlado pelo Portal de Documentos da SGA. As cópias impressas não são controladas.'), PW / 2, PH - 14, { align: 'center' });
  pdf.setFillColor(...C.primary);
  pdf.rect(0, PH - 4, PW, 4, 'F');

  pdf.setProperties({ title: limparTexto(`Folha de assinaturas — ${documento.numero || ''}`), creator: 'SGA — Portal de Documentos' });
  return pdf.output('arraybuffer');
}

// ── detecção de espaço livre (pdf.js) ──

const mMul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
const aplicar = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function caixaDePontos(pts) {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

async function carregarPdfjsPadrao() {
  const { carregarPdfjs } = await import('../components/edicao/extrairTextoPdf');
  return carregarPdfjs();
}

/** Caixas (no espaço do utilizador do PDF) do texto, imagens e traços de uma página. */
async function obstaculosDaPagina(pagina, OPS) {
  const caixas = [];
  const tc = await pagina.getTextContent();
  for (const it of tc.items || []) {
    if (!it.str || !it.str.trim()) continue;
    const [a, b, c, d, e, f] = it.transform;
    const na = Math.hypot(a, b) || 1;
    const nc = Math.hypot(c, d) || 1;
    const dir = [a / na, b / na];
    const per = [c / nc, d / nc];
    const h = it.height || nc;
    const w = it.width || 0;
    const p = (u, v) => [e + dir[0] * u + per[0] * v, f + dir[1] * u + per[1] * v];
    caixas.push(caixaDePontos([p(0, -0.25 * h), p(w, -0.25 * h), p(0, h), p(w, h)]));
  }
  if (OPS) {
    const ol = await pagina.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0];
    const pilha = [];
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i];
      const args = ol.argsArray[i];
      if (fn === OPS.save) pilha.push(ctm);
      else if (fn === OPS.restore) ctm = pilha.pop() || ctm;
      else if (fn === OPS.transform) ctm = mMul(args, ctm);
      else if (fn === OPS.paintFormXObjectBegin) { pilha.push(ctm); if (Array.isArray(args?.[0]) && args[0].length === 6) ctm = mMul(args[0], ctm); }
      else if (fn === OPS.paintFormXObjectEnd) ctm = pilha.pop() || ctm;
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject
        || fn === OPS.paintImageXObjectRepeat || fn === OPS.paintSolidColorImageMask) {
        caixas.push(caixaDePontos([aplicar(ctm, 0, 0), aplicar(ctm, 1, 0), aplicar(ctm, 0, 1), aplicar(ctm, 1, 1)]));
      } else if (fn === OPS.constructPath) {
        const mm = args?.[2];
        if (mm && mm.every(Number.isFinite)) {
          caixas.push(caixaDePontos([aplicar(ctm, mm[0], mm[1]), aplicar(ctm, mm[2], mm[1]), aplicar(ctm, mm[0], mm[3]), aplicar(ctm, mm[2], mm[3])]));
        }
      }
    }
  }
  return caixas;
}

const intersecta = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * Escolhe o canto livre para o QR, em coordenadas da VISTA (origem no canto superior esquerdo, pontos).
 * obstaculos: caixas já na vista. Fundos (≥ 50 % da página) não contam.
 * @returns {{ x, y, lado, canto } | null}
 */
export function escolherCanto(W, H, obstaculos, { lado = LADO_QR_MM * MM, margem = MARGEM_MM * MM, folga = FOLGA_MM * MM } = {}) {
  const area = W * H;
  const obs = (obstaculos || []).filter(o => (o[2] - o[0]) * (o[3] - o[1]) < area * 0.5);
  if (W < lado + 2 * margem || H < lado + 2 * margem) return null;
  const cantos = [
    ['inferior-direito', W - margem - lado, H - margem - lado],
    ['inferior-esquerdo', margem, H - margem - lado],
    ['superior-direito', W - margem - lado, margem],
    ['superior-esquerdo', margem, margem],
  ];
  for (const [canto, x, y] of cantos) {
    const zona = [x - folga, y - folga, x + lado + folga, y + lado + folga];
    if (!obs.some(o => intersecta(o, zona))) return { x, y, lado, canto };
  }
  return null;
}

function erroLeitura(e) {
  const m = `${e?.name || ''} ${e?.message || ''}`;
  if (/encrypt|password/i.test(m)) {
    return new Error('O PDF original está protegido (encriptado ou com senha): não é possível acrescentar-lhe as assinaturas. Carregue uma versão sem protecção.');
  }
  return new Error(`O PDF original não pôde ser lido — o ficheiro está danificado ou não é um PDF${e?.message ? ` (${e.message})` : ''}.`);
}

/**
 * Como gerarCopiaDeFicheiro, mas devolve também o relatório por página.
 * Opções extra: pdfjs (biblioteca pdf.js já carregada; por omissão a do leitor), detectar (false = não analisar
 * o conteúdo e carimbar sempre no canto inferior direito), onProgresso(feitas, total).
 * @returns {Promise<{ blob: Blob, paginas: Array<{ pagina: number, canto: string|null }>, deteccao: boolean }>}
 */
export async function gerarCopiaDeFicheiroDetalhada({
  pdfOriginal, documento = {}, versao = {}, linhasAssinatura, rubricas, origem, shaOriginal, logo,
  pdfjs = null, detectar = true, onProgresso = null,
} = {}) {
  const codigo = codigoVerificacao(shaOriginal);
  if (!pdfOriginal) throw new Error('O PDF original em falta.');
  const bytes = paraUint8(pdfOriginal);
  if (bytes.length < 8 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    // alguns PDFs trazem lixo antes do cabeçalho; o pdf-lib tolera-o, por isso só se recusa o que não tem %PDF perto do início
    const ini = new TextDecoder('latin1').decode(bytes.slice(0, 1024));
    if (!ini.includes('%PDF-')) throw new Error('O ficheiro original não é um PDF.');
  }
  const shaReal = await sha256Hex(bytes);
  if (shaReal && shaReal !== String(shaOriginal).toLowerCase()) {
    throw new Error('O PDF obtido não é o original assinado (a impressão digital não confere). A cópia não foi gerada.');
  }

  const { PDFDocument, degrees } = await import('@cantoo/pdf-lib');
  let doc;
  let paginas;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (doc.isEncrypted) throw new Error('encrypted');
    paginas = doc.getPages();
    paginas.forEach(p => p.getSize());
  } catch (e) {
    throw erroLeitura(e);
  }
  const nOrig = paginas.length;
  if (!nOrig) throw new Error('O PDF original não tem páginas.');

  const o = String(origem || '').replace(/\/+$/, '');
  const url = urlVerificacao(o, codigo);
  const qr = await qrDataUrl(url);
  const qrImg = await doc.embedPng(dataUrlBytes(qr));
  const assinaturas = assinaturasParaCapa(linhasAssinatura, rubricas);

  // análise do conteúdo com pdf.js (numa cópia dos bytes: o pdf.js transfere o buffer para o worker)
  let pdfjsDoc = null;
  let OPS = null;
  if (detectar) {
    try {
      const lib = pdfjs || await carregarPdfjsPadrao();
      OPS = lib.OPS;
      pdfjsDoc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
    } catch (e) {
      if (/password|encrypt/i.test(`${e?.name} ${e?.message}`)) throw erroLeitura(e);
      pdfjsDoc = null;          // sem pdf.js: carimba no canto inferior direito (a margem de 6 mm costuma estar livre)
    }
  }

  const relatorio = [];
  try {
    for (let i = 0; i < nOrig; i++) {
      const pg = paginas[i];
      const rot = ((pg.getRotation().angle % 360) + 360) % 360;
      let escolha = null;
      let conv = null;
      if (pdfjsDoc) {
        const pj = await pdfjsDoc.getPage(i + 1);
        const vp = pj.getViewport({ scale: 1 });
        const obs = (await obstaculosDaPagina(pj, OPS)).map((c) => {
          const r = vp.convertToViewportRectangle(c);
          return [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])];
        });
        escolha = escolherCanto(vp.width, vp.height, obs);
        conv = (x, y) => vp.convertToPdfPoint(x, y);
        pj.cleanup?.();
      } else {
        // sem análise: vista calculada a partir da CropBox e da rotação
        const cb = pg.getCropBox();
        const vira = rot === 90 || rot === 270;
        const W = vira ? cb.height : cb.width;
        const H = vira ? cb.width : cb.height;
        escolha = escolherCanto(W, H, []);
        conv = (x, y) => {
          if (rot === 0) return [cb.x + x, cb.y + cb.height - y];
          if (rot === 90) return [cb.x + y, cb.y + x];
          if (rot === 180) return [cb.x + cb.width - x, cb.y + y];
          return [cb.x + cb.width - y, cb.y + cb.height - x];
        };
      }
      if (escolha) {
        const { x, y, lado } = escolha;
        const caixa = caixaDePontos([conv(x, y), conv(x + lado, y), conv(x, y + lado), conv(x + lado, y + lado)]);
        const s = lado;
        // âncora (canto inferior esquerdo da imagem antes de rodar) para o QR ficar direito na vista
        const ancora = rot === 0 ? [caixa[0], caixa[1]]
          : rot === 90 ? [caixa[2], caixa[1]]
            : rot === 180 ? [caixa[2], caixa[3]]
              : [caixa[0], caixa[3]];
        pg.translateContent(0, 0);   // isola o conteúdo original (q … Q) — PDFs com q/Q desequilibrados
        pg.drawImage(qrImg, { x: ancora[0], y: ancora[1], width: s, height: s, rotate: degrees(rot) });
      }
      relatorio.push({ pagina: i + 1, canto: escolha ? escolha.canto : null });
      if (onProgresso) { try { onProgresso(i + 1, nOrig); } catch { /* */ } }
    }
  } finally {
    try { await pdfjsDoc?.destroy(); } catch { /* */ }
  }

  // folha de assinaturas no fim
  const numero = documento.numero || '';
  const rotuloVerificacao = [numero, rotuloRev(versao.versao ?? versao.rotulo), codigo].filter(Boolean).join(' · ');
  const folhaBytes = await folhaAssinaturas({
    documento, versao, assinaturas, qr, codigo, rotuloVerificacao,
    verificarUrl: `${o}/vd`, logo, paginasOriginais: nOrig,
  });
  const folha = await PDFDocument.load(folhaBytes);
  const copiadas = await doc.copyPages(folha, folha.getPageIndices());
  copiadas.forEach(p => doc.addPage(p));

  doc.setModificationDate(new Date());
  doc.setProducer('SGA — Portal de Documentos (cópia assinada)');
  doc.setKeywords([`verificacao:${codigo}`, `sha256-original:${String(shaOriginal).toLowerCase()}`]);
  const saida = await doc.save({ useObjectStreams: true });
  return { blob: new Blob([saida], { type: 'application/pdf' }), paginas: relatorio, deteccao: !!pdfjsDoc };
}

/**
 * Cópia assinada de um documento carregado como ficheiro (manuais antigos): QR pequeno (10 mm) num canto livre
 * de cada página original + «Folha de assinaturas» A4 no fim.
 * @returns {Promise<Blob>}
 */
export async function gerarCopiaDeFicheiro(opcoes = {}) {
  const { blob } = await gerarCopiaDeFicheiroDetalhada(opcoes);
  return blob;
}

export { horaAngola };
