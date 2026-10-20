import { describe, it, expect } from 'vitest';
import {
  diferencas, diffPalavras, linhasDeItens, linhasRepetidas, limparPaginas, alinharPaginas, compararDocumentos,
  pdfDaVersao, versoesPorOmissao, ehVersaoFonte,
} from '../compararVersoes';

// Um «manual» de N páginas com texto distinto por página (palavras, não só números — como num manual real),
// cabeçalho e rodapé repetidos (com o nº de página a mudar).
const W = ['alfa', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliett', 'kilo', 'lima', 'mike',
  'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu'];
const pal = (p, k) => `${W[(p * 7 + k) % W.length]}${W[(p * 3 + k * 5) % W.length]}`;
const corpo = (p) => Array.from({ length: 6 }, (_, k) => `Regra ${pal(p, k)} aplica-se a ${pal(p, k + 11)} no turno ${pal(p, k + 2)}.`);
function manual(n, { extra = {}, total = n } = {}) {
  const paginas = [];
  for (let p = 1; p <= n; p += 1) {
    paginas.push([
      'MA-FNLU-MOA-001 Manual de Operações do Aeródromo Rev.03',
      ...(extra[p] || corpo(p)),
      `Página ${p} de ${total}`,
    ]);
  }
  return paginas;
}

const aplicar = (a, b, ops) => {
  // reconstrói b a partir de a e das operações, para provar que o diff é coerente
  const out = [];
  for (const [t, i, j] of ops) { if (t === '=') { expect(a[i]).toBe(b[j]); out.push(a[i]); } else if (t === '+') out.push(b[j]); }
  return out;
};

describe('diferencas (Myers)', () => {
  it('iguais não têm edições', () => {
    const ops = diferencas(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(ops.every(o => o[0] === '=')).toBe(true);
  });
  it('reconstrói a lista nova e é mínimo num caso simples', () => {
    const a = ['a', 'b', 'c', 'a', 'b', 'b', 'a'];
    const b = ['c', 'b', 'a', 'b', 'a', 'c'];
    const ops = diferencas(a, b);
    expect(aplicar(a, b, ops)).toEqual(b);
    expect(ops.filter(o => o[0] !== '=').length).toBe(5);   // D clássico do artigo de Myers
  });
  it('listas vazias', () => {
    expect(diferencas([], [])).toEqual([]);
    expect(diferencas([], ['x'])).toEqual([['+', null, 0]]);
    expect(diferencas(['x'], [])).toEqual([['-', 0, null]]);
  });
  it('devolve null quando passa do tecto', () => {
    const a = Array.from({ length: 50 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 50 }, (_, i) => `b${i}`);
    expect(diferencas(a, b, 10)).toBeNull();
  });
});

describe('diffPalavras', () => {
  it('marca só a palavra que mudou', () => {
    const p = diffPalavras(['O limite é 30 minutos.'], ['O limite é 45 minutos.']);
    expect(p).toEqual([
      { tipo: 'igual', texto: 'O limite é' },
      { tipo: 'del', texto: '30' },
      { tipo: 'ins', texto: '45' },
      { tipo: 'igual', texto: 'minutos.' },
    ]);
  });
  it('só inserção ou só remoção', () => {
    expect(diffPalavras([], ['nova linha'])).toEqual([{ tipo: 'ins', texto: 'nova linha' }]);
    expect(diffPalavras(['velha'], [])).toEqual([{ tipo: 'del', texto: 'velha' }]);
  });
});

describe('linhasDeItens', () => {
  it('parte em linhas por hasEOL e normaliza espaços', () => {
    const itens = [{ str: 'Manual', hasEOL: false }, { str: ' ', hasEOL: false }, { str: 'de  Operações', hasEOL: true }, { str: '', hasEOL: true }, { str: 'Cap. 2', hasEOL: false }];
    expect(linhasDeItens(itens)).toEqual(['Manual de Operações', 'Cap. 2']);
  });
});

describe('cabeçalhos e rodapés repetidos', () => {
  it('reconhece-os mesmo com o nº de página a mudar e retira-os', () => {
    const m = manual(6);
    const rep = linhasRepetidas([m]);
    const limpo = limparPaginas(m, rep);
    expect(limpo[0]).toEqual(corpo(1));
  });
});

describe('compararDocumentos', () => {
  it('versões iguais: nada a mostrar', () => {
    const r = compararDocumentos(manual(5), manual(5));
    expect(r.resumo.identicas).toBe(true);
    expect(r.entradas).toEqual([]);
  });

  it('página inserida a meio (caso MOA v8): só essa página aparece, as seguintes não', () => {
    const a = manual(20);
    const b = [...manual(20, { total: 21 })];
    b.splice(10, 0, [
      'MA-FNLU-MOA-001 Manual de Operações do Aeródromo Rev.03',
      'Tabela de posições de estacionamento',
      'Posição 1 Code C', 'Posição 2 Code E', 'Posição 3 Code C', 'Posição 4 Code C', 'Posição 5 Code D',
      'Página 11 de 21',
    ]);
    // renumera os rodapés das seguintes
    for (let p = 11; p < b.length; p += 1) b[p][b[p].length - 1] = `Página ${p + 1} de 21`;
    const r = compararDocumentos(a, b);
    expect(r.resumo.modo).toBe('texto');
    expect(r.resumo.acrescentadas).toBe(1);
    expect(r.resumo.alteradas).toBe(0);
    expect(r.resumo.removidas).toBe(0);
    expect(r.entradas).toHaveLength(1);
    expect(r.entradas[0]).toMatchObject({ tipo: 'acrescentada', paginaB: 11 });
    // a p. 12 nova corresponde à 11 antiga
    expect(r.correspondencia[12]).toBe(11);
  });

  it('página removida', () => {
    const a = manual(8);
    const b = manual(8).filter((_, i) => i !== 3);
    const r = compararDocumentos(a, b);
    expect(r.resumo.removidas).toBe(1);
    expect(r.entradas[0]).toMatchObject({ tipo: 'removida', paginaA: 4 });
    expect(r.resumo.alteradas).toBe(0);
  });

  it('frase alterada numa página: uma alteração, com palavras marcadas', () => {
    const a = manual(10);
    const novo = corpo(7); novo[2] = novo[2].replace(/\.$/, ' nocturno.');
    const b = manual(10, { extra: { 7: novo } });
    const r = compararDocumentos(a, b);
    expect(r.resumo).toMatchObject({ alteradas: 1, acrescentadas: 0, removidas: 0, alteracoes: 1 });
    const e = r.entradas[0];
    expect(e).toMatchObject({ tipo: 'alterada', paginaA: 7, paginaB: 7 });
    const alt = e.itens.find(i => i.tipo === 'alteracao');
    const ultima = corpo(7)[2].split(' ').pop();
    expect(alt.pedacos.some(p => p.tipo === 'del' && p.texto === ultima)).toBe(true);
    expect(alt.pedacos.some(p => p.tipo === 'ins' && p.texto === `${ultima.replace(/\.$/, '')} nocturno.`)).toBe(true);
  });

  it('texto que escorrega de página (reflow) não conta como alteração', () => {
    const linhas = Array.from({ length: 30 }, (_, i) => `Linha ${i} do capítulo com conteúdo próprio ${i * 7}`);
    const a = [linhas.slice(0, 10), linhas.slice(10, 20), linhas.slice(20)];
    const b = [linhas.slice(0, 8), linhas.slice(8, 19), linhas.slice(19)];
    const r = compararDocumentos(a, b, { ignorarRepetidas: false });
    expect(r.resumo.identicas).toBe(true);
  });

  it('com o tecto rebentado cai no alinhamento por páginas e continua a encontrar a página nova', () => {
    const a = manual(12);
    const b = [...manual(12)];
    b.splice(5, 0, ['Página inteiramente nova com várias palavras distintas', 'Outra linha nova diferente']);
    // muda muito texto em todas as páginas para forçar o tecto baixo
    const r = compararDocumentos(a, b, { maxDLinhas: 1 });
    expect(r.resumo.modo).toBe('paginas');
    expect(r.entradas.some(e => e.tipo === 'acrescentada' && e.paginaB === 6)).toBe(true);
    expect(r.resumo.alteradas).toBe(0);
  });

  it('o contexto corta as linhas iguais longe das alterações', () => {
    const a = [['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7']];
    const b = [['l1', 'l2', 'l3', 'L4', 'l5', 'l6', 'l7']];
    const r = compararDocumentos(a, b, { ignorarRepetidas: false, contexto: 1 });
    expect(r.entradas[0].itens.map(i => i.tipo)).toEqual(['salto', 'contexto', 'alteracao', 'contexto', 'salto']);
  });
});

describe('alinharPaginas', () => {
  it('emparelha por semelhança e deixa a página nova sozinha', () => {
    const a = [['alfa bravo charlie'], ['delta echo foxtrot'], ['golf hotel india']];
    const b = [['alfa bravo charlie'], ['tabela posicoes estacionamento'], ['delta echo foxtrot'], ['golf hotel india']];
    expect(alinharPaginas(a, b)).toEqual([{ a: 0, b: 0 }, { a: null, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }]);
  });
});

describe('escolha das versões', () => {
  const moa = [
    { versao: 9, estado: 'fonte', rotulo: 'Fonte editável (.docx) — Revisão 03/26 (actualizada 20/10/2026)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', arquivo_uri: '233e0aa2e_MA-FNLU-MOA-001-Rev03fonte.docx' },
    { versao: 8, estado: 'em_vigor', rotulo: 'Revisão 03/26 (actualizada 20/10/2026)', mime: 'application/pdf', arquivo_uri: '233e0aa2e_MA-FNLU-MOA-001-Rev03.pdf' },
    { versao: 7, estado: 'obsoleto', rotulo: 'Fonte editável (.docx) — Revisão 03/26 (corrigido ANAC)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', arquivo_uri: '686a267fc_MOA-limpofonte.docx' },
    { versao: 6, estado: 'obsoleto', rotulo: 'Revisão 03/26 (corrigido ANAC)', mime: 'application/pdf', arquivo_uri: '686a267fc_MOA-limpo.pdf' },
    { versao: 1, estado: 'obsoleto', rotulo: 'Versão 2026-10-06', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', arquivo_uri: '513055f6d_MOA.docx' },
  ];
  it('fonte editável usa o PDF da mesma revisão', () => {
    expect(ehVersaoFonte(moa[0])).toBe(true);
    expect(pdfDaVersao(moa[0], moa)).toMatchObject({ versao: moa[1], substituta: true });
    expect(pdfDaVersao(moa[2], moa)).toMatchObject({ versao: moa[3], substituta: true });
  });
  it('Office sem PDF irmão usa a pré-visualização do servidor', () => {
    expect(pdfDaVersao(moa[4], moa)).toMatchObject({ versao: moa[4], preVisualizacao: true });
  });
  it('por omissão: em vigor contra a revisão anterior (sem fontes)', () => {
    const { a, b } = versoesPorOmissao(moa, '8');
    expect(b.versao).toBe(8);
    expect(a.versao).toBe(6);
  });
  it('por omissão: em vigor contra o rascunho mais recente', () => {
    const lista = [{ versao: 10, estado: 'rascunho', mime: 'application/pdf', arquivo_uri: 'novo.pdf' }, ...moa];
    const { a, b } = versoesPorOmissao(lista, '8');
    expect(a.versao).toBe(8);
    expect(b.versao).toBe(10);
  });
});
