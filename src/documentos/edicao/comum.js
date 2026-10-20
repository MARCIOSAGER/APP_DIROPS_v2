// Peças partilhadas pelos geradores de PDF e DOCX dos documentos estruturados do GED.
// (nomes das classes, datas, rótulo da revisão, logo SGA, imagens, numeração dos títulos)

/** Nome por extenso de cada classe (alinhado com documento_classe, sql 157). */
export const NOME_CLASSE = {
  POP: 'Procedimento Operacional Padrão',
  PR: 'Programa',
  PL: 'Plano',
  MA: 'Manual',
  FR: 'Formulário',
  LT: 'Lista',
  RE: 'Regulamento',
  DO: 'Documento',
};

export const nomeClasse = (m) => NOME_CLASSE[m] || 'Documento';

/** 'AAAA-MM-DD…' → 'dd/mm/aaaa' (sem passar por Date, para não haver saltos de fuso). */
export function dataPt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

/** Revisão com 2 dígitos ('3' → '03'); texto não numérico fica como está. */
export function revisaoPad(rev) {
  const r = String(rev ?? '').trim();
  return /^\d+$/.test(r) ? r.padStart(2, '0') : (r || '00');
}

/** Rótulo do rodapé dos manuais SGA: «03/26» (revisão / ano da data com 2 dígitos). */
export function rotuloRevisao(rev, iso) {
  const m = /^(\d{4})/.exec(String(iso || ''));
  return m ? `${revisaoPad(rev)}/${m[1].slice(2)}` : revisaoPad(rev);
}

/** Textos fixos do rodapé (iguais no PDF e no DOCX). */
export function textosRodape(cab = {}) {
  return {
    revisao: `Revisão n.º ${rotuloRevisao(cab.revisao, cab.data)}`,
    data: `Data: ${dataPt(cab.data)}`,
  };
}

/** Texto simples de qualquer nó (para nós desconhecidos e medições). */
export function textoSimples(no) {
  if (!no || typeof no !== 'object') return '';
  if (no.type === 'text') return String(no.text || '');
  if (no.type === 'hardBreak') return '\n';
  if (!Array.isArray(no.content)) return '';
  const bloco = (t) => ['paragraph', 'heading', 'listItem', 'tableRow', 'blockquote'].includes(t);
  return no.content.map((f) => textoSimples(f) + (bloco(f?.type) ? '\n' : (f?.type === 'tableCell' || f?.type === 'tableHeader' ? ' ' : ''))).join('').replace(/\n+$/, '');
}

/** Caracteres que o XML do Word não aceita. */
export const limparXml = (t) => String(t ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');

// ─── Ficheiros / imagens ───────────────────────────────────────────

function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function urlParaDataUrl(url) {
  if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location) return null;
  try {
    const abs = new URL(url, window.location.href).href;
    const resp = await fetch(abs);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (!/^image\//.test(blob.type || '')) return null;
    return await blobParaDataUrl(blob);
  } catch {
    return null;
  }
}

/** Logo SGA (sempre SGA, nunca DIROPS): opcoes.logo (data URL) ou /logo-sga.png. */
export async function carregarLogo(opcoes = {}) {
  if (opcoes.logo === null) return null;
  if (typeof opcoes.logo === 'string' && opcoes.logo.startsWith('data:image/')) return opcoes.logo;
  return urlParaDataUrl(opcoes.logoUrl || '/logo-sga.png');
}

/** Junta todas as imagens do documento e converte-as em data URL (as que já o são passam directas). */
export async function resolverImagens(doc) {
  const srcs = new Set();
  const visitar = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'image' && n.attrs?.src) srcs.add(String(n.attrs.src));
    if (Array.isArray(n.content)) n.content.forEach(visitar);
  };
  for (const s of doc?.seccoes || []) visitar(s?.conteudo);
  const mapa = new Map();
  await Promise.all([...srcs].map(async (src) => {
    mapa.set(src, src.startsWith('data:image/') ? src : await urlParaDataUrl(src));
  }));
  return mapa;
}

/** data URL → { bytes, tipo ('png'|'jpg'|'gif'|'bmp'|'webp'|…) } ou null. */
export function dataUrlParaBytes(dataUrl) {
  const m = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/is.exec(String(dataUrl || ''));
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const t = m[1].toLowerCase();
    return { bytes, tipo: t === 'jpeg' ? 'jpg' : t };
  } catch {
    return null;
  }
}

/** Largura/altura em píxeis lidas do cabeçalho do ficheiro (PNG, JPEG, GIF, BMP). */
export function dimensoesImagem(bytes) {
  const b = bytes;
  if (!b || b.length < 24) return null;
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const w = (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0;
    const h = (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0;
    return w && h ? { w, h } : null;
  }
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { w: b[6] | b[7] << 8, h: b[8] | b[9] << 8 };
  // BMP
  if (b[0] === 0x42 && b[1] === 0x4d) return { w: Math.abs(b[18] | b[19] << 8 | b[20] << 16 | b[21] << 24), h: Math.abs(b[22] | b[23] << 8 | b[24] << 16 | b[25] << 24) };
  // JPEG: procurar o marcador SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const mk = b[i + 1];
      const len = b[i + 2] << 8 | b[i + 3];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
        return { h: b[i + 5] << 8 | b[i + 6], w: b[i + 7] << 8 | b[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

/**
 * Largura pedida para a imagem (attrs.width: número em px, '300px' ou '50%'), em fracção da largura útil
 * ou em px. Devolve { px } | { frac } | null.
 */
export function larguraPedida(attrs = {}) {
  const w = attrs?.width;
  if (w === undefined || w === null || w === '') return null;
  const s = String(w).trim();
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(s);
  if (pct) return { frac: Math.min(1, Number(pct[1]) / 100) };
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? { px: n } : null;
}

// ─── Numeração dos títulos ─────────────────────────────────────────

/**
 * Numera as secções (1., 2., …) e os títulos dentro delas (h2 → 1.1, h3 → 1.1.1, h4 → 1.1.1.1).
 * Devolve { seccoes: [{ numero, titulo, seccao }], titulos: WeakMap(nó heading → numero) }.
 */
export function numerarTitulos(doc) {
  const titulos = new WeakMap();
  const seccoes = (doc?.seccoes || []).filter(Boolean).map((s, i) => {
    const cont = [i + 1, 0, 0, 0];
    const visitar = (n) => {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'heading') {
        const lv = Math.min(4, Math.max(2, Number(n.attrs?.level) || 2));
        const idx = lv - 1;
        cont[idx] += 1;
        for (let k = idx + 1; k < cont.length; k++) cont[k] = 0;
        titulos.set(n, cont.slice(0, idx + 1).join('.'));
        return;
      }
      // títulos só contam ao nível do bloco (não dentro de tabelas/listas)
      if (n.type === 'doc' || n.type === 'blockquote') (n.content || []).forEach(visitar);
    };
    visitar(s.conteudo);
    return { numero: `${i + 1}`, titulo: String(s.titulo || '').trim() || `Secção ${i + 1}`, seccao: s };
  });
  return { seccoes, titulos };
}
