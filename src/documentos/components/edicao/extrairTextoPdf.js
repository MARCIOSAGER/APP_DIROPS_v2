// Abrir o PDF de uma versão e tirar-lhe o texto, página a página, sem prender o ecrã.
//
// O pdf.js faz o trabalho pesado (interpretar o PDF) no seu próprio worker — o mesmo /pdfjs/pdf.worker.min.js do
// leitor. Aqui só se pede página a página e se devolve o controlo ao navegador entre lotes, com progresso, para o MOA
// (~157 páginas, uns 7 s) não congelar a janela. O texto fica em cache por ficheiro enquanto a página estiver aberta:
// trocar a versão B não volta a extrair a A.
import { linhasDeItens } from '@/documentos/compararVersoes';

const WORKER = '/pdfjs/pdf.worker.min.js';
let libPromessa = null;
export function carregarPdfjs() {
  if (!libPromessa) {
    libPromessa = import('pdfjs-dist').then((lib) => { lib.GlobalWorkerOptions.workerSrc = WORKER; return lib; })
      .catch((e) => { libPromessa = null; throw e; });
  }
  return libPromessa;
}

const cacheTexto = new Map();      // chave do ficheiro -> páginas (arrays de linhas)
const MAX_CACHE = 6;
export const textoEmCache = (chave) => (chave ? cacheTexto.get(chave) : undefined);
function guardarCache(chave, paginas) {
  if (!chave) return;
  if (cacheTexto.size >= MAX_CACHE) cacheTexto.delete(cacheTexto.keys().next().value);
  cacheTexto.set(chave, paginas);
}

const abortado = () => { const e = new Error('Cancelado'); e.name = 'AbortError'; return e; };
const ceder = () => new Promise(r => setTimeout(r, 0));

export async function abrirPdfDeUrl(url, { sinal } = {}) {
  const r = await fetch(url, { signal: sinal });
  if (!r.ok) throw new Error(`O ficheiro não chegou do servidor (HTTP ${r.status}).`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (sinal?.aborted) throw abortado();
  const lib = await carregarPdfjs();
  try {
    return await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  } catch (e) {
    throw new Error(e?.name === 'InvalidPDFException' || /Invalid PDF/i.test(e?.message || '')
      ? 'O ficheiro não é um PDF legível.'
      : `Não foi possível abrir o PDF. ${e?.message || ''}`.trim());
  }
}

/** Texto de todas as páginas: [[linha, …], …]. `aoProgresso(feitas, total)`. */
export async function extrairPaginas(pdf, { chave, aoProgresso, sinal, lote = 8 } = {}) {
  const emCache = textoEmCache(chave);
  if (emCache) { aoProgresso?.(emCache.length, emCache.length); return emCache; }
  const total = pdf.numPages;
  const paginas = [];
  for (let i = 1; i <= total; i += 1) {
    if (sinal?.aborted) throw abortado();
    const pagina = await pdf.getPage(i);
    const conteudo = await pagina.getTextContent();
    paginas.push(linhasDeItens(conteudo.items));
    pagina.cleanup?.();
    if (i % lote === 0 || i === total) { aoProgresso?.(i, total); await ceder(); }
  }
  guardarCache(chave, paginas);
  return paginas;
}
