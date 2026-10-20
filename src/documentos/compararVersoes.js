// Comparar duas versões de um documento — a lógica pura (sem React, sem pdf.js, sem rede), para correr num Web Worker
// e para se testar sozinha.
//
// Entrada: o texto de cada versão, página a página, em linhas (o que o pdf.js dá com `hasEOL`). Saída: as páginas
// acrescentadas, removidas e alteradas, e para cada uma o texto com as inserções e remoções marcadas.
//
// Porque NÃO se compara a página 12 com a página 12: basta inserir uma página (a tabela de posições que entrou no
// MOA FNLU v8) para todas as seguintes escorregarem uma casa e o resultado dizer que mudou o manual inteiro. Por isso
// o diff corre sobre o TEXTO INTEIRO, linha a linha, e cada linha leva consigo a página de onde veio. A página é uma
// etiqueta, não uma fronteira: o texto que passou da p. 40 para a p. 41 porque entrou um parágrafo antes continua
// «igual». Só depois se arrumam as diferenças por página.
//
// Dentro de cada alteração faz-se um segundo diff, palavra a palavra, para se ver exactamente o que mudou numa frase
// (o Word volta a partir as linhas de um parágrafo inteiro quando se acrescenta uma palavra).
//
// O diff é o algoritmo de Myers com tecto de esforço. Se as versões forem tão diferentes que o tecto rebenta, cai-se
// para um alinhamento de PÁGINAS por semelhança (programação dinâmica sobre o Jaccard das palavras) e diff dentro de
// cada par — mais grosseiro, mas termina sempre em tempo útil.

// ── linhas ──────────────────────────────────────────────────────────────────
export function normalizarLinha(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

// Os itens do `getTextContent()` do pdf.js em linhas: `hasEOL` marca o fim de linha. (O pdf.js dá normalmente os
// espaços entre palavras como itens próprios; quando não dá, não se inventam espaços.)
export function linhasDeItens(itens) {
  const linhas = [];
  let actual = '';
  for (const it of itens || []) {
    if (!it || typeof it.str !== 'string') continue;
    actual += it.str;
    if (it.hasEOL) { linhas.push(actual); actual = ''; }
  }
  if (actual) linhas.push(actual);
  return linhas.map(normalizarLinha).filter(Boolean);
}

// ── cabeçalhos e rodapés repetidos ──────────────────────────────────────────
// «Página 12 de 157», «MA-FNLU-MOA-001 · Rev.03 · 20/10/2026» e o carimbo de cópia não controlada repetem-se em todas
// as páginas e mudam todos quando entra uma página ou muda a data da revisão. Deixá-los no diff era marcar 157
// páginas como alteradas por causa do número no rodapé. A chave troca os algarismos por # para «Página 12 de 157» e
// «Página 13 de 157» serem a mesma linha repetida.
export const chaveRepeticao = (linha) => normalizarLinha(linha).toLowerCase().replace(/\d+/g, '#');
const SO_NUMERACAO = /^(p[aá]g(ina)?\.?\s*)?#(\s*(de|\/|of)\s*#)?$/;

// Só se DETECTAM nas primeiras e últimas `zona` linhas de cada página (onde vivem cabeçalhos e rodapés): uma linha
// do corpo que só difere nos números de página para página (uma lista numerada, uma tabela) não pode desaparecer.
// Uma vez detectada, a linha sai de qualquer posição: no MOA o pdf.js devolve às vezes o cabeçalho (uma tabela de 5
// linhas) depois do corpo, nas páginas com tabelas.
const naZona = (idx, total, zona) => idx < zona || idx >= total - zona;

export function linhasRepetidas(documentos, { fraccao = 0.5, minimoPaginas = 3, zona = 6 } = {}) {
  const repetidas = new Set();
  for (const paginas of documentos || []) {
    if (!paginas || paginas.length < minimoPaginas) continue;
    const conta = new Map();
    for (const p of paginas) {
      const linhas = p || [];
      const chaves = new Set();
      linhas.forEach((l, idx) => { if (naZona(idx, linhas.length, zona)) chaves.add(chaveRepeticao(l)); });
      for (const k of chaves) conta.set(k, (conta.get(k) || 0) + 1);
    }
    const limiar = Math.max(minimoPaginas, Math.ceil(fraccao * paginas.length));
    for (const [k, n] of conta) if (n >= limiar) repetidas.add(k);
  }
  return repetidas;
}

export function limparPaginas(paginas, repetidas, { zona = 6 } = {}) {
  return (paginas || []).map((p) => {
    const linhas = p || [];
    return linhas.filter((l, idx) => {
      const k = chaveRepeticao(l);
      if (!k || repetidas.has(k)) return false;
      return !(naZona(idx, linhas.length, zona) && SO_NUMERACAO.test(k));
    });
  });
}

// ── Myers com tecto ─────────────────────────────────────────────────────────
// Devolve as operações ['=', i, j] | ['-', i, null] | ['+', null, j] por ordem, ou null se precisar de mais de
// `maxD` edições. A memória do rasto é O(D²), daí o tecto.
function myersCru(a, b, maxD) {
  const n = a.length; const m = b.length;
  const max = n + m;
  if (max === 0) return [];
  const lim = Math.min(max, maxD);
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  v[off + 1] = 0;
  const rasto = [];
  for (let d = 0; d <= lim; d += 1) {
    rasto.push(v.slice(off - d - 1, off + d + 2));       // estado ANTES da passagem d, k ∈ [-d-1, d+1]
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x += 1; y += 1; }
      v[off + k] = x;
      if (x >= n && y >= m) return recuar(rasto, n, m);
    }
  }
  return null;
}

function recuar(rasto, n, m) {
  const ops = [];
  let x = n; let y = m;
  for (let d = rasto.length - 1; d >= 0; d -= 1) {
    const vd = rasto[d];
    const val = (k) => vd[k + d + 1];
    const k = x - y;
    const kAnt = (k === -d || (k !== d && val(k - 1) < val(k + 1))) ? k + 1 : k - 1;
    const xAnt = val(kAnt); const yAnt = xAnt - kAnt;
    while (x > xAnt && y > yAnt) { x -= 1; y -= 1; ops.push(['=', x, y]); }
    if (d > 0) {
      if (x === xAnt) ops.push(['+', null, y - 1]); else ops.push(['-', x - 1, null]);
    }
    x = xAnt; y = yAnt;
  }
  return ops.reverse();
}

// Diff de duas listas de valores comparáveis com ===. Corta o prefixo e o sufixo comuns antes (é o caso normal: duas
// revisões de um manual são iguais em 95 %) e troca as cadeias por inteiros para a comparação ser barata.
export function diferencas(a, b, maxD = 3000) {
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini += 1;
  let fa = a.length; let fb = b.length;
  while (fa > ini && fb > ini && a[fa - 1] === b[fb - 1]) { fa -= 1; fb -= 1; }
  const dic = new Map();
  const cod = (s) => { let c = dic.get(s); if (c === undefined) { c = dic.size; dic.set(s, c); } return c; };
  const ma = new Int32Array(fa - ini); for (let i = ini; i < fa; i += 1) ma[i - ini] = cod(a[i]);
  const mb = new Int32Array(fb - ini); for (let j = ini; j < fb; j += 1) mb[j - ini] = cod(b[j]);
  const meio = myersCru(ma, mb, maxD);
  if (!meio) return null;
  const ops = [];
  for (let i = 0; i < ini; i += 1) ops.push(['=', i, i]);
  for (const [t, i, j] of meio) ops.push([t, i === null ? null : i + ini, j === null ? null : j + ini]);
  for (let i = fa, j = fb; i < a.length; i += 1, j += 1) ops.push(['=', i, j]);
  return ops;
}

// ── palavras ────────────────────────────────────────────────────────────────
export const QUEBRA = '\n';
function palavrasDeLinhas(linhas) {
  const t = [];
  linhas.forEach((l, i) => {
    if (i > 0) t.push(QUEBRA);
    for (const p of l.split(' ')) if (p) t.push(p);
  });
  return t;
}

// Pedaços { tipo: 'igual'|'ins'|'del', texto } — o texto de uma alteração com as palavras marcadas. Pedaços seguidos
// do mesmo tipo juntam-se (palavras separadas por espaço); as quebras de linha vão como '\n' no texto.
export function diffPalavras(linhasAntes, linhasDepois, maxD = 2000) {
  const a = palavrasDeLinhas(linhasAntes || []);
  const b = palavrasDeLinhas(linhasDepois || []);
  let ops = (a.length && b.length) ? diferencas(a, b, maxD) : null;
  if (!ops) ops = [...a.map((_, i) => ['-', i, null]), ...b.map((_, j) => ['+', null, j])];
  const pedacos = [];
  const juntar = (tipo, palavra) => {
    const ult = pedacos[pedacos.length - 1];
    if (ult && ult.tipo === tipo) {
      ult.texto += (palavra === QUEBRA || ult.texto.endsWith(QUEBRA) ? '' : ' ') + palavra;
    } else {
      pedacos.push({ tipo, texto: palavra });
    }
  };
  for (const [t, i, j] of ops) {
    if (t === '=') juntar('igual', a[i]);
    else if (t === '-') juntar('del', a[i]);
    else juntar('ins', b[j]);
  }
  return pedacos;
}

export function contarPalavras(pedacos) {
  let ins = 0; let del = 0;
  for (const p of pedacos || []) {
    const n = p.texto.split(/\s+/).filter(Boolean).length;
    if (p.tipo === 'ins') ins += n; else if (p.tipo === 'del') del += n;
  }
  return { ins, del };
}

// ── alinhamento de páginas por semelhança (plano B) ─────────────────────────
function conjuntoPalavras(linhas) {
  const s = new Set();
  for (const l of linhas || []) for (const p of l.toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (p.length >= 3) s.add(p);
  return s;
}
export function semelhanca(sa, sb) {
  if (!sa.size && !sb.size) return 1;
  if (!sa.size || !sb.size) return 0;
  let comum = 0;
  const [menor, maior] = sa.size < sb.size ? [sa, sb] : [sb, sa];
  for (const p of menor) if (maior.has(p)) comum += 1;
  return comum / (sa.size + sb.size - comum);
}

// Pares { a, b } (índices de página a 0; um deles null quando a página só existe de um lado), por ordem, que
// maximizam a semelhança total sem cruzar pares. Páginas abaixo de `minimo` de semelhança nunca se emparelham.
export function alinharPaginas(paginasA, paginasB, { minimo = 0.25 } = {}) {
  const n = paginasA.length; const m = paginasB.length;
  const ca = paginasA.map(conjuntoPalavras); const cb = paginasB.map(conjuntoPalavras);
  const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const sim = Array.from({ length: n }, () => new Float64Array(m));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const s = semelhanca(ca[i - 1], cb[j - 1]);
      sim[i - 1][j - 1] = s;
      let melhor = Math.max(S[i - 1][j], S[i][j - 1]);
      if (s >= minimo) melhor = Math.max(melhor, S[i - 1][j - 1] + s);
      S[i][j] = melhor;
    }
  }
  const pares = [];
  let i = n; let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && sim[i - 1][j - 1] >= minimo && S[i][j] === S[i - 1][j - 1] + sim[i - 1][j - 1]) {
      pares.push({ a: i - 1, b: j - 1 }); i -= 1; j -= 1;
    } else if (i > 0 && (j === 0 || S[i][j] === S[i - 1][j])) {
      pares.push({ a: i - 1, b: null }); i -= 1;
    } else {
      pares.push({ a: null, b: j - 1 }); j -= 1;
    }
  }
  return pares.reverse();
}

// ── a comparação ────────────────────────────────────────────────────────────
function achatar(paginas) {
  const linhas = []; const inicio = [];
  paginas.forEach((p, i) => { inicio.push(linhas.length); for (const t of p) linhas.push({ texto: t, pagina: i + 1 }); });
  return { linhas, inicio };
}

function opsPorPaginas(pa, pb, A, B, maxD) {
  const ops = [];
  for (const { a, b } of alinharPaginas(pa, pb)) {
    const oa = a === null ? 0 : A.inicio[a]; const ob = b === null ? 0 : B.inicio[b];
    const la = a === null ? [] : pa[a]; const lb = b === null ? [] : pb[b];
    const par = (la.length && lb.length) ? diferencas(la, lb, maxD) : null;
    if (par) { for (const [t, i, j] of par) ops.push([t, i === null ? null : i + oa, j === null ? null : j + ob]); continue; }
    la.forEach((_, i) => ops.push(['-', i + oa, null]));
    lb.forEach((_, j) => ops.push(['+', null, j + ob]));
  }
  return ops;
}

/**
 * Compara duas versões. `paginasA`/`paginasB`: arrays (uma entrada por página) de arrays de linhas.
 * Devolve { resumo, entradas, correspondencia } — `entradas` são as páginas com diferenças, pela ordem do documento:
 *   { chave, tipo: 'alterada'|'acrescentada'|'removida', paginaA, paginaB, alteracoes, palavras: {ins, del},
 *     itens: [{ tipo: 'contexto', texto } | { tipo: 'alteracao', pedacos } | { tipo: 'salto' }] }
 * (paginaA/paginaB são números de página a 1; numa removida paginaB é a página da versão nova junto da qual ela
 * estava; numa alterada paginaA é a página da versão anterior que mais lhe corresponde.)
 */
export function compararDocumentos(paginasA, paginasB, opcoes = {}) {
  const {
    ignorarRepetidas = true, maxDLinhas = 2500, maxDPalavras = 2000, contexto = 1, limiarPagina = 0.9,
  } = opcoes;
  let pa = (paginasA || []).map(p => (p || []).map(normalizarLinha).filter(Boolean));
  let pb = (paginasB || []).map(p => (p || []).map(normalizarLinha).filter(Boolean));
  const semTextoA = pa.filter(p => !p.length).length;
  const semTextoB = pb.filter(p => !p.length).length;
  let repetidas = new Set();
  if (ignorarRepetidas) {
    repetidas = linhasRepetidas([pa, pb]);
    pa = limparPaginas(pa, repetidas); pb = limparPaginas(pb, repetidas);
  }
  const A = achatar(pa); const B = achatar(pb);
  let modo = 'texto';
  let ops = diferencas(A.linhas.map(l => l.texto), B.linhas.map(l => l.texto), maxDLinhas);
  if (!ops) { modo = 'paginas'; ops = opsPorPaginas(pa, pb, A, B, Math.min(maxDLinhas, 800)); }

  // 1.ª passagem: quanto de cada página saiu ou entrou, e que página antiga corresponde a cada nova.
  const totA = new Int32Array(pa.length + 2); const remA = new Int32Array(pa.length + 2);
  const totB = new Int32Array(pb.length + 2); const insB = new Int32Array(pb.length + 2);
  const pares = new Map();
  for (const l of A.linhas) totA[l.pagina] += 1;
  for (const l of B.linhas) totB[l.pagina] += 1;
  for (const [t, i, j] of ops) {
    if (t === '-') remA[A.linhas[i].pagina] += 1;
    else if (t === '+') insB[B.linhas[j].pagina] += 1;
    else {
      const m = pares.get(B.linhas[j].pagina) || new Map();
      const pA = A.linhas[i].pagina; m.set(pA, (m.get(pA) || 0) + 1);
      pares.set(B.linhas[j].pagina, m);
    }
  }
  const correspondencia = {};
  for (const [pB, m] of pares) {
    let melhor = null; let n = -1;
    for (const [pA, c] of m) if (c > n) { n = c; melhor = pA; }
    correspondencia[pB] = melhor;
  }
  const removida = (p) => totA[p] > 0 && remA[p] / totA[p] >= limiarPagina;
  const acrescentada = (p) => totB[p] > 0 && insB[p] / totB[p] >= limiarPagina;

  // página da versão nova seguinte a cada operação (para ancorar remoções que aparecem antes de qualquer linha nova)
  const proxB = new Int32Array(ops.length + 1);
  proxB[ops.length] = pb.length ? pb.length : 1;
  for (let k = ops.length - 1; k >= 0; k -= 1) proxB[k] = ops[k][2] !== null ? B.linhas[ops[k][2]].pagina : proxB[k + 1];

  // 2.ª passagem: itens por página.
  const brutos = new Map();    // chave -> [{ tipo:'igual', texto } | { tipo:'alteracao', antes:[], depois:[] }]
  const ordem = [];            // chaves com alterações, pela ordem em que aparecem
  const vistas = new Set();
  const ancoraRemovida = new Map();
  const lista = (chave) => { let l = brutos.get(chave); if (!l) { l = []; brutos.set(chave, l); } return l; };
  let cursorB = null;
  let grupo = null;            // alteração em curso { chave, antes, depois }
  const fecharGrupo = () => {
    if (!grupo) return;
    lista(grupo.chave).push({ tipo: 'alteracao', antes: grupo.antes, depois: grupo.depois });
    if (!vistas.has(grupo.chave)) { vistas.add(grupo.chave); ordem.push(grupo.chave); }
    grupo = null;
  };
  ops.forEach(([t, i, j], k) => {
    if (t === '=') {
      fecharGrupo();
      cursorB = B.linhas[j].pagina;
      lista(`B:${cursorB}`).push({ tipo: 'igual', texto: B.linhas[j].texto });
      return;
    }
    let chave; let texto; let lado;
    if (t === '-') {
      const pA = A.linhas[i].pagina;
      if (removida(pA)) {
        chave = `A:${pA}`;
        if (!ancoraRemovida.has(pA)) ancoraRemovida.set(pA, cursorB ?? proxB[k]);
      } else {
        chave = `B:${cursorB ?? proxB[k]}`;
      }
      texto = A.linhas[i].texto; lado = 'antes';
    } else {
      cursorB = B.linhas[j].pagina;
      chave = `B:${cursorB}`;
      texto = B.linhas[j].texto; lado = 'depois';
    }
    if (grupo && grupo.chave !== chave) fecharGrupo();
    if (!grupo) grupo = { chave, antes: [], depois: [] };
    grupo[lado].push(texto);
  });
  fecharGrupo();

  const entradas = ordem.map((chave) => {
    const [lado, numero] = chave.split(':'); const pagina = Number(numero);
    const crus = brutos.get(chave) || [];
    const itens = [];
    let alteracoes = 0; const palavras = { ins: 0, del: 0 };
    // contexto: linhas iguais a `contexto` itens de uma alteração ficam; as restantes viram um «salto»
    const perto = crus.map((it, idx) => {
      if (it.tipo !== 'igual') return true;
      for (let d = 1; d <= contexto; d += 1) {
        if (crus[idx - d]?.tipo === 'alteracao' || crus[idx + d]?.tipo === 'alteracao') return true;
      }
      return false;
    });
    crus.forEach((it, idx) => {
      if (it.tipo === 'igual') {
        if (perto[idx]) itens.push({ tipo: 'contexto', texto: it.texto });
        else if (itens[itens.length - 1]?.tipo !== 'salto') itens.push({ tipo: 'salto' });
        return;
      }
      const pedacos = diffPalavras(it.antes, it.depois, maxDPalavras);
      const c = contarPalavras(pedacos);
      palavras.ins += c.ins; palavras.del += c.del;
      alteracoes += 1;
      itens.push({ tipo: 'alteracao', pedacos });
    });
    if (lado === 'A') {
      return { chave, tipo: 'removida', paginaA: pagina, paginaB: ancoraRemovida.get(pagina) ?? null, alteracoes, palavras, itens };
    }
    return {
      chave, tipo: acrescentada(pagina) ? 'acrescentada' : 'alterada',
      paginaA: correspondencia[pagina] ?? null, paginaB: pagina, alteracoes, palavras, itens,
    };
  });

  const resumo = {
    modo,
    paginasA: pa.length, paginasB: pb.length,
    semTextoA, semTextoB,
    acrescentadas: entradas.filter(e => e.tipo === 'acrescentada').length,
    removidas: entradas.filter(e => e.tipo === 'removida').length,
    alteradas: entradas.filter(e => e.tipo === 'alterada').length,
    alteracoes: entradas.reduce((s, e) => s + e.alteracoes, 0),
    palavrasInseridas: entradas.reduce((s, e) => s + e.palavras.ins, 0),
    palavrasRemovidas: entradas.reduce((s, e) => s + e.palavras.del, 0),
    linhasRepetidasIgnoradas: repetidas.size,
    identicas: entradas.length === 0,
  };
  return { resumo, entradas, correspondencia };
}

// ── que versões comparar ────────────────────────────────────────────────────
export const ehVersaoFonte = (v) => v?.estado === 'fonte' || /^\s*fonte\s*edit/i.test(String(v?.rotulo || ''));
const nomeDe = (v) => String(v?.arquivo_nome || v?.arquivo_uri || v?.arquivo_url || '').toLowerCase().split('?')[0];
export function ehPdfVersao(v) {
  return String(v?.mime || '').toLowerCase().includes('pdf') || nomeDe(v).endsWith('.pdf');
}
const OFFICE = /\.(docx?|odt|rtf|xlsx?|ods|pptx?|odp)$/;
export function ehOfficeVersao(v) {
  const mime = String(v?.mime || '').toLowerCase();
  return OFFICE.test(nomeDe(v)) || /officedocument|msword|ms-excel|ms-powerpoint|opendocument/.test(mime);
}
const raizRevisao = (v) => String(v?.rotulo || '')
  .replace(/^\s*fonte\s+edit[aá]vel\s*(\([^)]*\))?\s*[—–-]?\s*/i, '').trim().toLowerCase();
const raizFicheiro = (v) => String(v?.arquivo_uri || v?.arquivo_nome || '').toLowerCase()
  .split('?')[0].replace(/\.[a-z0-9]+$/, '').replace(/(\.[a-z0-9]+)?fonte\.?$/, '');

/**
 * O ficheiro que se compara para a versão `v`: o próprio PDF; para uma fonte editável (docx/pptx), o PDF da MESMA
 * revisão (mesmo nome de ficheiro sem «fonte», ou o mesmo rótulo sem «Fonte editável (.docx) —»); sem PDF irmão,
 * a pré-visualização em PDF que o servidor gera a partir do Office. null se não houver forma de ter um PDF.
 *   → { versao, substituta: bool, preVisualizacao: bool }
 */
export function pdfDaVersao(v, versoes = []) {
  if (!v) return null;
  if (ehPdfVersao(v)) return { versao: v, substituta: false, preVisualizacao: false };
  const pdfs = versoes.filter(x => x !== v && ehPdfVersao(x));
  const rf = raizFicheiro(v); const rr = raizRevisao(v);
  const irmao = (rf && pdfs.find(x => raizFicheiro(x) === rf)) || (rr && pdfs.find(x => raizRevisao(x) === rr)) || null;
  if (irmao) return { versao: irmao, substituta: true, preVisualizacao: false };
  if (ehOfficeVersao(v)) return { versao: v, substituta: false, preVisualizacao: true };
  return null;
}

const num = (v) => Number(v?.versao ?? -Infinity);
const mesmoFicheiro = (x, y) => !!x && !!y && (x === y || (!!x.arquivo_uri && x.arquivo_uri === y.arquivo_uri));

/**
 * As duas versões por omissão: a em vigor contra o rascunho mais recente (se houver um mais novo); senão as duas
 * últimas revisões que dão PDF. As fontes editáveis não entram na escolha automática (são o mesmo texto do PDF da
 * revisão). → { a, b } (a = anterior, b = nova; qualquer uma pode ser null)
 */
export function versoesPorOmissao(versoes = [], vActual = null) {
  const comparaveis = versoes
    .filter(v => !ehVersaoFonte(v) && pdfDaVersao(v, versoes))
    .sort((x, y) => num(y) - num(x));
  const emVigor = comparaveis.find(v => String(v.versao) === String(vActual))
    || comparaveis.find(v => v.estado === 'em_vigor') || null;
  const rascunho = comparaveis.find(v => ['rascunho', 'aprovado', 'em_revisao', 'em_aprovacao'].includes(v.estado)
    && num(v) > num(emVigor) && !mesmoFicheiro(v, emVigor));
  if (emVigor && rascunho) return { a: emVigor, b: rascunho };
  const b = emVigor || comparaveis[0] || null;
  if (!b) return { a: null, b: null };
  const a = comparaveis.find(v => num(v) < num(b) && !mesmoFicheiro(v, b))
    || comparaveis.find(v => v !== b && !mesmoFicheiro(v, b)) || null;
  return { a, b };
}
