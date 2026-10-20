// Recorte automático das margens transparentes ou brancas de uma imagem (assinaturas digitalizadas trazem muito espaço
// à volta do traço). Devolve uma data URL PNG com a caixa útil + margem; se não houver nada a recortar, ou se a imagem
// vier de outra origem (canvas «tainted»), devolve a origem tal como está. Resultados em cache por origem.
const cache = new Map();

export function recortarMargens(src, { limiar = 240, margem = 6, alfaMin = 16 } = {}) {
  if (!src || typeof document === 'undefined') return Promise.resolve(src || null);
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    if (!String(src).startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return resolve(src);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, w, h).data;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (d[i + 3] < alfaMin) continue;                                         // transparente
            if (d[i] >= limiar && d[i + 1] >= limiar && d[i + 2] >= limiar) continue;  // branco / quase branco
            if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
        if (maxX < 0) return resolve(src);
        minX = Math.max(0, minX - margem); minY = Math.max(0, minY - margem);
        maxX = Math.min(w - 1, maxX + margem); maxY = Math.min(h - 1, maxY + margem);
        const cw = maxX - minX + 1, ch = maxY - minY + 1;
        if (cw >= w - 2 && ch >= h - 2) return resolve(src); // nada a recortar
        const o = document.createElement('canvas'); o.width = cw; o.height = ch;
        o.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
        resolve(o.toDataURL('image/png'));
      } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
  cache.set(src, p);
  return p;
}
