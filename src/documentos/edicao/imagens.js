// Imagens do editor: entram como data: URL JPEG, redimensionadas (lado maior ≤ 1600 px), para o rascunho e os
// geradores não rebentarem de tamanho. Fundo branco por trás de PNG transparente (JPEG não tem transparência).

export const LADO_MAXIMO = 1600;
export const QUALIDADE_JPEG = 0.85;
/** Acima disto (em caracteres do data: URL) uma imagem colada é reduzida depois de entrar no editor. */
export const LIMITE_DATA_URL = 400 * 1024;

/** Dimensões finais mantendo a proporção. */
export function dimensoesReduzidas(w, h, max = LADO_MAXIMO) {
  const W = Number(w) || 0; const H = Number(h) || 0;
  if (!W || !H) return { w: W, h: H };
  const f = Math.min(1, max / Math.max(W, H));
  return { w: Math.round(W * f), h: Math.round(H * f) };
}

function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = src;
  });
}

const lerComoDataUrl = (ficheiro) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ''));
  r.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
  r.readAsDataURL(ficheiro);
});

/** Redimensiona uma imagem (data: URL ou URL do mesmo domínio) → { src: data:image/jpeg, largura, altura }. */
export async function reduzirImagemSrc(src, { max = LADO_MAXIMO, qualidade = QUALIDADE_JPEG } = {}) {
  const img = await carregarImagem(src);
  const { w, h } = dimensoesReduzidas(img.naturalWidth || img.width, img.naturalHeight || img.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { src: canvas.toDataURL('image/jpeg', qualidade), largura: w, altura: h };
}

/** Ficheiro de imagem escolhido/colado/largado → data: URL JPEG reduzida. */
export async function imagemDeFicheiro(ficheiro, opcoes) {
  if (!ficheiro || !/^image\//.test(ficheiro.type || '')) throw new Error('O ficheiro escolhido não é uma imagem.');
  const dataUrl = await lerComoDataUrl(ficheiro);
  return reduzirImagemSrc(dataUrl, opcoes);
}
