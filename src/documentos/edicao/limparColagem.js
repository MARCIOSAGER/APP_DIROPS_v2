// Limpeza do HTML colado (sobretudo do Word): tira estilos, classes, fontes, cores, comentários (condicionais e do
// Word), tags «o:p», imagens locais (file://) que o navegador não consegue ler; converte os parágrafos-lista do
// Word (class="MsoListParagraph…", mso-list:l0 level2 lfo1) em listas verdadeiras com níveis (até 3), mantém
// tabelas, negrito/itálico/sublinhado (incluindo os que vêm em <span style="font-weight:bold">), o alinhamento
// centrado/à direita/justificado e as quebras de página. O esquema do TipTap trata do resto: só aceita os nós e
// marcas do contrato.
import { NIVEIS_LISTA_MAX } from './contrato';

const ATRIBUTOS_MANTER = new Set(['src', 'alt', 'colspan', 'rowspan', 'href', 'data-tipo', 'data-quebra-pagina', 'data-legenda']);
const ALINHAMENTOS_COLAR = ['center', 'right', 'justify'];
const BLOCOS_ALINHAVEIS = 'p,h1,h2,h3,h4,h5,h6';

const RE_MARCA_UL = /^[·•▪■□○◦●§oØü\-–—*](\s+|$)/;
const RE_MARCA_OL = /^(\d+(\.\d+)*|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)](\s+|$)/;

function marcadorLista(texto) {
  const t = String(texto || '').replace(/\u00a0/g, ' ').trim();
  if (RE_MARCA_OL.test(t)) return { tipo: 'ol', resto: t.replace(/^(\d+(\.\d+)*|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]\s*/, '') };
  if (RE_MARCA_UL.test(t)) return { tipo: 'ul', resto: t.replace(/^[·•▪■□○◦●§oØü\-–—*]\s*/, '') };
  return null;
}

/** Nível da lista do Word (mso-list:l0 level2 lfo1 → 2), limitado a 1..NIVEIS_LISTA_MAX. */
function nivelWord(el) {
  const m = /mso-list:\s*l\d+\s+level(\d+)/i.exec(el.getAttribute('style') || '');
  const n = m ? Number(m[1]) : 1;
  return Math.max(1, Math.min(NIVEIS_LISTA_MAX, n || 1));
}

function alinhamentoDoElemento(el) {
  const a = String(el.style?.textAlign || el.getAttribute('align') || '').toLowerCase().trim();
  return ALINHAMENTOS_COLAR.includes(a) ? a : null;
}

function embrulhar(dom, el, tag) {
  const w = dom.createElement(tag);
  while (el.firstChild) w.appendChild(el.firstChild);
  el.appendChild(w);
}

function desembrulhar(el) {
  const pai = el.parentNode;
  if (!pai) return;
  while (el.firstChild) pai.insertBefore(el.firstChild, el);
  el.remove();
}

/** Converte os grupos de parágrafos-lista do Word em <ul>/<ol> aninhadas. */
function converterListasWord(dom, body) {
  const ehItemWord = (el) => el?.tagName === 'P' && (/MsoList/i.test(el.className || '') || /mso-list:\s*l\d/i.test(el.getAttribute('style') || ''));
  body.querySelectorAll('p').forEach(p => {
    if (!ehItemWord(p) || !p.isConnected) return;
    const grupo = [];
    let el = p;
    while (el && ehItemWord(el)) { grupo.push(el); el = el.nextElementSibling; }

    const itens = grupo.map(g => {
      const nivel = nivelWord(g);
      let tipo = null;
      let comIgnore = false;
      // marcadores do Word vêm em <span style="mso-list:Ignore">
      g.querySelectorAll('span').forEach(sp => {
        if (!sp.isConnected || !/mso-list:\s*Ignore/i.test(sp.getAttribute('style') || '')) return;
        comIgnore = true;
        if (!tipo) { const mi = marcadorLista(sp.textContent); tipo = mi ? mi.tipo : 'ul'; }
        sp.remove();
      });
      // sem o span do Word, o marcador pode vir escrito no texto («1.», «·») — só aí se procura e se tira
      if (!comIgnore) {
        // aqui não se aceitam «o», «ü», «Ø» como marca: seria a primeira palavra do texto
        const m = /^[\s ]*[oüØ]\s/.test(g.textContent) ? null : marcadorLista(g.textContent);
        if (m) {
          tipo = m.tipo;
          const primeiro = (() => { let n = g.firstChild; while (n && n.nodeType !== 3 && n.firstChild) n = n.firstChild; return n; })();
          if (primeiro && primeiro.nodeType === 3) primeiro.textContent = primeiro.textContent.replace(/^[\s\u00a0]*([·•▪■□○◦●§oØü\-–—*]|(\d+(\.\d+)*|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)])[\s\u00a0]*/, '');
        }
      }
      const li = dom.createElement('li');
      const par = dom.createElement('p');
      const al = alinhamentoDoElemento(g);
      if (al) par.setAttribute('align', al);
      par.innerHTML = g.innerHTML.replace(/^(\s|&nbsp;|\u00a0)+/, '');
      li.appendChild(par);
      return { nivel, tipo: tipo || 'ul', li };
    });

    const raiz = dom.createDocumentFragment();
    const pilha = []; // { nivel, lista, ultimoLi }
    for (const it of itens) {
      while (pilha.length && pilha[pilha.length - 1].nivel > it.nivel) pilha.pop();
      let topo = pilha[pilha.length - 1];
      // mesmo nível mas outro tipo de lista: começa uma lista nova ao lado
      if (topo && topo.nivel === it.nivel && topo.lista.tagName.toLowerCase() !== it.tipo) {
        pilha.pop();
        topo = pilha[pilha.length - 1];
      }
      if (!topo || topo.nivel < it.nivel) {
        const lista = dom.createElement(it.tipo);
        if (topo) {
          if (!topo.ultimoLi) { topo.ultimoLi = dom.createElement('li'); topo.ultimoLi.appendChild(dom.createElement('p')); topo.lista.appendChild(topo.ultimoLi); }
          topo.ultimoLi.appendChild(lista);
        } else raiz.appendChild(lista);
        topo = { nivel: it.nivel, lista, ultimoLi: null };
        pilha.push(topo);
      }
      topo.lista.appendChild(it.li);
      topo.ultimoLi = it.li;
    }
    grupo[0].replaceWith(raiz);
    grupo.slice(1).forEach(g => g.remove());
  });
}

/** Recebe HTML colado, devolve HTML limpo. Sem DOMParser (ex. servidor) devolve uma limpeza por expressões. */
export function limparHtmlColado(html) {
  let s = String(html || '');
  // comentários condicionais (as duas formas do Word) e normais, blocos xml/style/meta/link/script
  s = s.replace(/<!--\[if !supportLists\]-->/gi, '')
    .replace(/<!--\[if !supportLineBreakNewLine\]-->/gi, '')
    .replace(/<!--\[endif\]-->/gi, '')
    .replace(/<!\[if [^\]]*\]>/gi, '')
    .replace(/<!\[endif\]>/gi, '')
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|xml|meta|link|title)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(meta|link)[^>]*\/?>/gi, '')
    .replace(/<\/?o:p[^>]*>/gi, '')
    .replace(/<\/?(v|w|m|o|st1):[^>]*>/gi, '');

  if (typeof DOMParser === 'undefined') {
    return s.replace(/\s(style|class|lang|id|width|height|align|face|size|color)=("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  const dom = new DOMParser().parseFromString(`<body>${s}</body>`, 'text/html');
  const body = dom.body;

  // comentários do Word (lista de comentários, referências «[MS1]») e âncoras de comentário
  body.querySelectorAll('[style*="mso-element:comment"], [style*="mso-element: comment"], .MsoCommentReference, .MsoCommentText, a[href^="#_msocom"]').forEach(el => el.remove());
  body.querySelectorAll('[style*="mso-comment"]').forEach(desembrulhar);

  // imagens locais (Word põe file:///C:/Users/...) ou sem origem utilizável
  body.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (/^(data:image\/|https?:\/\/|\/)/i.test(src)) return;
    const bloco = img.closest('p');
    img.remove();
    // o parágrafo que só tinha a imagem não fica para trás vazio
    if (bloco && !bloco.textContent.replace(/ /g, ' ').trim() && !bloco.querySelector('img')) bloco.remove();
  });

  // quebras de página do Word
  body.querySelectorAll('br').forEach(br => {
    if (!/page-break-before:\s*always/i.test(br.getAttribute('style') || '')) return;
    const q = dom.createElement('div');
    q.setAttribute('data-quebra-pagina', '');
    // a quebra fica entre blocos: sai do parágrafo onde o Word a pôs
    const bloco = br.closest('p,h1,h2,h3,h4,h5,h6');
    if (bloco) {
      const vazio = !bloco.textContent.replace(/\u00a0/g, ' ').trim() && !bloco.querySelector('img');
      bloco.parentNode.insertBefore(q, bloco);
      br.remove();
      if (vazio) bloco.remove();
    } else br.replaceWith(q);
  });
  body.querySelectorAll(BLOCOS_ALINHAVEIS).forEach(el => {
    if (/page-break-before:\s*always/i.test(el.getAttribute('style') || '')) {
      const q = dom.createElement('div');
      q.setAttribute('data-quebra-pagina', '');
      el.parentNode.insertBefore(q, el);
    }
  });

  // parágrafos-lista do Word → <ul>/<ol> aninhadas
  converterListasWord(dom, body);

  // formatação em estilo (Word online, Google Docs, Outlook) → marcas
  body.querySelectorAll('b, strong').forEach(b => {
    if (/font-weight:\s*(normal|[1-4]00)\b/i.test(b.getAttribute('style') || '')) desembrulhar(b);
  });
  body.querySelectorAll('span, font').forEach(sp => {
    const st = sp.getAttribute('style') || '';
    if (/font-weight:\s*(bold|bolder|[6-9]00)\b/i.test(st)) embrulhar(dom, sp, 'strong');
    if (/font-style:\s*italic/i.test(st)) embrulhar(dom, sp, 'em');
    if (/text-decoration(-line)?:[^;]*underline/i.test(st)) embrulhar(dom, sp, 'u');
  });

  // alinhamento (centrado, direita, justificado) dos parágrafos e títulos
  const alinhar = [];
  body.querySelectorAll(BLOCOS_ALINHAVEIS).forEach(el => { const a = alinhamentoDoElemento(el); if (a) alinhar.push([el, a]); });

  // atributos: só os que o esquema usa
  body.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => { if (!ATRIBUTOS_MANTER.has(a.name.toLowerCase())) el.removeAttribute(a.name); });
  });
  for (const [el, a] of alinhar) el.setAttribute('style', `text-align: ${a}`);
  // spans e fonts sem atributos já não servem para nada
  body.querySelectorAll('span, font').forEach(el => { if (!el.attributes.length) desembrulhar(el); });

  // títulos de nível 1 e 5/6 → níveis permitidos (2 a 4)
  body.querySelectorAll('h1,h5,h6').forEach(h => {
    const n = dom.createElement(h.tagName === 'H1' ? 'h2' : 'h4');
    n.innerHTML = h.innerHTML;
    const st = h.getAttribute('style');
    if (st) n.setAttribute('style', st);
    h.replaceWith(n);
  });

  return body.innerHTML;
}
