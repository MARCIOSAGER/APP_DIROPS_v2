// Tratamento da imagem da rubrica — funções PURAS sobre os píxeis (RGBA), testadas em
// __tests__/rubricaImagem.test.js. O componente MinhaRubrica só desenha no canvas e chama estas.
//
// O que se faz a uma rubrica carregada (fotografia ou digitalização de papel):
//   1. tornar o fundo claro transparente (com transição suave, para o traço não ficar serrilhado);
//   2. recortar as margens vazias à volta do traço (com uma pequena folga);
//   3. reduzir para caber em ~600×200, PNG, abaixo de 200 KB.

export const RUBRICA_LARGURA = 600;
export const RUBRICA_ALTURA = 200;
export const RUBRICA_MAX_BYTES = 200 * 1024;
export const LIMIAR_BRANCO = 220;     // a partir daqui (luminância 0–255) é fundo
const RAMPA = 40;                     // entre LIMIAR-RAMPA e LIMIAR o alfa desce gradualmente

export const luminancia = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Torna transparente o fundo claro. Altera `px` (Uint8ClampedArray RGBA) e devolve-o.
 * Píxeis com luminância ≥ limiar → alfa 0; abaixo de limiar-RAMPA → mantêm o alfa; no meio, rampa linear.
 */
export function fundoTransparente(px, { limiar = LIMIAR_BRANCO } = {}) {
  const baixo = limiar - RAMPA;
  for (let i = 0; i < px.length; i += 4) {
    const l = luminancia(px[i], px[i + 1], px[i + 2]);
    if (l >= limiar) px[i + 3] = 0;
    else if (l > baixo) px[i + 3] = Math.round(px[i + 3] * ((limiar - l) / RAMPA));
  }
  return px;
}

/** É «tinta»? Opaco o bastante e escuro o bastante. */
export function ehTinta(px, i, { limiar = LIMIAR_BRANCO, alfaMin = 24 } = {}) {
  return px[i + 3] >= alfaMin && luminancia(px[i], px[i + 1], px[i + 2]) < limiar;
}

/**
 * Caixa do traço: { x, y, w, h } com `folga` píxeis à volta (sem sair da imagem), ou null se não há traço.
 */
export function caixaDoTraco(px, largura, altura, { limiar = LIMIAR_BRANCO, folga = 6, alfaMin = 24 } = {}) {
  let x0 = largura; let y0 = altura; let x1 = -1; let y1 = -1;
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      if (ehTinta(px, (y * largura + x) * 4, { limiar, alfaMin })) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const x = Math.max(0, x0 - folga);
  const y = Math.max(0, y0 - folga);
  return { x, y, w: Math.min(largura, x1 + folga + 1) - x, h: Math.min(altura, y1 + folga + 1) - y };
}

/** Dimensões para caber em maxW×maxH mantendo a proporção; nunca amplia. Inteiros ≥ 1. */
export function ajustarDimensoes(w, h, maxW = RUBRICA_LARGURA, maxH = RUBRICA_ALTURA) {
  const W = Math.max(1, Number(w) || 1);
  const H = Math.max(1, Number(h) || 1);
  const f = Math.min(1, maxW / W, maxH / H);
  return { w: Math.max(1, Math.round(W * f)), h: Math.max(1, Math.round(H * f)) };
}

/** Bytes aproximados de um data URL base64. */
export function bytesDataUrl(dataUrl) {
  const s = String(dataUrl || '');
  const i = s.indexOf(',');
  if (i < 0) return 0;
  const b64 = s.slice(i + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

/** Validação mínima do que se vai guardar. Devolve '' se está bem, senão a mensagem. */
export function validarRubrica(dataUrl) {
  if (!dataUrl || !/^data:image\/png;base64,/.test(String(dataUrl))) return 'A rubrica tem de ser uma imagem PNG.';
  const n = bytesDataUrl(dataUrl);
  if (n > RUBRICA_MAX_BYTES) return `A imagem ficou com ${Math.round(n / 1024)} KB; o máximo é ${Math.round(RUBRICA_MAX_BYTES / 1024)} KB. Tente uma imagem mais simples.`;
  if (n < 100) return 'A imagem da rubrica está vazia.';
  return '';
}

/** Tipos aceites ao carregar. */
export function tipoImagemAceite(ficheiro) {
  const t = String(ficheiro?.type || '').toLowerCase();
  const n = String(ficheiro?.name || '').toLowerCase();
  return t === 'image/png' || t === 'image/jpeg' || /\.(png|jpe?g)$/.test(n);
}
