// Limpeza do HTML colado (sobretudo do Word): tira estilos, classes, comentários condicionais, tags «o:p»,
// imagens locais (file://) que o navegador não consegue ler, e converte os parágrafos-lista do Word
// (class="MsoListParagraph…", mso-list) em listas verdadeiras. O esquema do TipTap trata do resto: só aceita os
// nós e marcas do contrato, por isso fontes, cores e tamanhos caem sozinhos.

const ATRIBUTOS_MANTER = new Set(['src', 'alt', 'colspan', 'rowspan', 'href']);

function marcadorLista(texto) {
  const t = String(texto || '').replace(/\u00a0/g, ' ').trim();
  if (/^[·•▪○§o\-–](\s+|$)/.test(t)) return { tipo: 'ul', resto: t.replace(/^[·•▪○§o\-–]\s*/, '') };
  if (/^(\d+|[a-zA-Z]|[ivxIVX]+)[.)](\s+|$)/.test(t)) return { tipo: 'ol', resto: t.replace(/^(\d+|[a-zA-Z]|[ivxIVX]+)[.)]\s*/, '') };
  return null;
}

/** Recebe HTML colado, devolve HTML limpo. Sem DOMParser (ex. servidor) devolve uma limpeza por expressões. */
export function limparHtmlColado(html) {
  let s = String(html || '');
  // comentários condicionais e normais, blocos xml/style/meta/link/script do Word
  s = s.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|xml|meta|link|title)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(meta|link)[^>]*\/?>/gi, '')
    .replace(/<\/?o:p[^>]*>/gi, '')
    .replace(/<\/?(v|w|m):[^>]*>/gi, '');

  if (typeof DOMParser === 'undefined') {
    return s.replace(/\s(style|class|lang|id|width|height|align|face|size|color)="[^"]*"/gi, '');
  }

  const dom = new DOMParser().parseFromString(`<body>${s}</body>`, 'text/html');
  const body = dom.body;

  // imagens locais (Word põe file:///C:/Users/... que o navegador não lê) ou sem origem
  body.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (!src || /^file:/i.test(src) || /^blob:/i.test(src)) img.remove();
  });

  // parágrafos-lista do Word → <ul>/<ol>
  const ehItemWord = (el) => el?.tagName === 'P' && (/MsoList/i.test(el.className || '') || /mso-list/i.test(el.getAttribute('style') || ''));
  body.querySelectorAll('p').forEach(p => {
    if (!ehItemWord(p) || !p.isConnected) return;
    const grupo = [];
    let el = p;
    while (el && ehItemWord(el)) { grupo.push(el); el = el.nextElementSibling; }
    // marcadores do Word vêm em <span style="mso-list:Ignore">
    let tipo = 'ul';
    const itens = grupo.map((g, i) => {
      let comIgnore = false;
      g.querySelectorAll('span').forEach(sp => {
        if (!/mso-list:\s*Ignore/i.test(sp.getAttribute('style') || '')) return;
        comIgnore = true;
        if (i === 0) { const mi = marcadorLista(sp.textContent); if (mi) tipo = mi.tipo; }
        sp.remove();
      });
      // sem o span do Word, o marcador pode vir escrito no texto («1.», «·») — só aí se procura e se tira
      const m = comIgnore ? null : marcadorLista(g.textContent);
      if (i === 0 && m) tipo = m.tipo;
      const li = dom.createElement('li');
      li.innerHTML = g.innerHTML;
      if (m && li.firstChild && li.firstChild.nodeType === 3) li.firstChild.textContent = li.firstChild.textContent.replace(/^\s*([·•▪○§o\-–]|(\d+|[a-zA-Z]|[ivxIVX]+)[.)])\s*/, '');
      return li;
    });
    const lista = dom.createElement(tipo);
    itens.forEach(li => lista.appendChild(li));
    grupo[0].replaceWith(lista);
    grupo.slice(1).forEach(g => g.remove());
  });

  // atributos: só os que o esquema usa
  body.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => { if (!ATRIBUTOS_MANTER.has(a.name.toLowerCase())) el.removeAttribute(a.name); });
  });

  // títulos de nível 1 e 5/6 → níveis permitidos (2 a 4)
  body.querySelectorAll('h1,h5,h6').forEach(h => {
    const n = dom.createElement(h.tagName === 'H1' ? 'h2' : 'h4');
    n.innerHTML = h.innerHTML;
    h.replaceWith(n);
  });

  return body.innerHTML;
}
