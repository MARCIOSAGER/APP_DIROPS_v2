// Realce do termo procurado sobre a página desenhada.
//
// Como funciona: a camada de texto do pdf.js põe, por cima do canvas, o texto real da página em <span>
// transparentes e posicionados — é o que permite seleccionar e copiar. Em cima disso, procuram-se as palavras no
// texto concatenado, constrói-se um `Range` do DOM para cada ocorrência e pedem-se-lhe os rectângulos
// (`getClientRects`). O realce é desenhado nesses rectângulos.
//
// Porque assim e não a estimar a largura das letras: o navegador já sabe exactamente onde cada letra ficou, e
// pedir-lhe os rectângulos acerta também nas palavras partidas entre dois <span> ou no fim da linha. Qualquer
// cálculo nosso de «largura média do caractere» erra em tabelas, texto justificado e fontes com kerning — e um
// realce um centímetro ao lado da palavra é pior do que não haver realce.
import { dobrar, ocorrencias } from './paginaTexto';

// Os nós de texto da camada, em ordem de leitura, com a posição onde cada um começa no texto concatenado.
function recolherTexto(container) {
  const nos = [];
  let corrido = '';
  const andador = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  for (let no = andador.nextNode(); no; no = andador.nextNode()) {
    const t = no.nodeValue || '';
    if (!t) continue;
    nos.push({ no, inicio: corrido.length, fim: corrido.length + t.length });
    corrido += t;
  }
  return { nos, corrido };
}

const localizar = (nos, posicao) => {
  for (const n of nos) if (posicao >= n.inicio && posicao < n.fim) return { no: n.no, deslocamento: posicao - n.inicio };
  const ultimo = nos[nos.length - 1];
  return ultimo ? { no: ultimo.no, deslocamento: (ultimo.no.nodeValue || '').length } : null;
};

/**
 * Rectângulos a realçar, em coordenadas relativas ao container (percentagens não — píxeis da própria camada,
 * que tem o tamanho da página desenhada).
 * Devolve `[{ ocorrencia, esquerda, topo, largura, altura }]`, agrupáveis por `ocorrencia` para contar acertos
 * (uma palavra ao fim da linha dá dois rectângulos e continua a ser UM acerto).
 */
export function rectangulosDoRealce(container, palavras) {
  if (!container || !palavras?.length) return [];
  const { nos, corrido } = recolherTexto(container);
  if (!corrido) return [];
  const achados = ocorrencias(dobrar(corrido), palavras);
  if (!achados.length) return [];
  const caixa = container.getBoundingClientRect();
  const fora = [];
  achados.forEach((a, indice) => {
    const de = localizar(nos, a.inicio);
    const ate = localizar(nos, a.fim - 1);
    if (!de || !ate) return;
    try {
      const alcance = document.createRange();
      alcance.setStart(de.no, de.deslocamento);
      alcance.setEnd(ate.no, Math.min((ate.no.nodeValue || '').length, ate.deslocamento + 1));
      for (const r of Array.from(alcance.getClientRects())) {
        if (r.width < 0.5 || r.height < 0.5) continue;
        fora.push({
          ocorrencia: indice,
          esquerda: r.left - caixa.left,
          topo: r.top - caixa.top,
          largura: r.width,
          altura: r.height,
        });
      }
      alcance.detach?.();
    } catch { /* um Range impossível não estraga a página: fica sem realce */ }
  });
  return fora;
}

export const contarOcorrencias = (rects) => new Set(rects.map(r => r.ocorrencia)).size;

// Respeitar quem pediu menos movimento no sistema: o salto para a ocorrência é instantâneo em vez de animado.
export const movimentoReduzido = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
