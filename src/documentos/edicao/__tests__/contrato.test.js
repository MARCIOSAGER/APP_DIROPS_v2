import { describe, it, expect } from 'vitest';
import {
  validarDocumentoEstruturado, novoDocumentoEstruturado, conteudoVazio, seccoesObrigatoriasEmFalta,
  proximaRevisao, prepararNovaRevisao, garantirHistoricoInicial, textoDoNo, SCHEMA_VERSAO,
} from '../contrato';
import { MODELOS_PADRAO, modeloPadraoDe } from '../modelosPadrao';

const par = (texto, marks) => ({ type: 'paragraph', content: [{ type: 'text', text: texto, ...(marks ? { marks } : {}) }] });
const doc = (...content) => ({ type: 'doc', content });

function docPreenchido() {
  const d = novoDocumentoEstruturado(modeloPadraoDe('POP'), {
    numero: 'POP-FNLU-MOA-001', titulo: 'Inspecção da pista', aeroporto: 'FNLU', elaboradoPor: 'J. Silva', data: '2026-10-20',
  });
  d.seccoes = d.seccoes.map(s => ({ ...s, conteudo: doc(par(`Texto de ${s.titulo}`)) }));
  return d;
}

describe('modelos padrão', () => {
  it('cobre as nove classes com secções (NRM com a estrutura do RE) e o POP tem as secções típicas', () => {
    expect(MODELOS_PADRAO.map(m => m.classe_codigo).sort()).toEqual(['DO', 'FR', 'LT', 'MA', 'NRM', 'PL', 'POP', 'PR', 'RE']);
    const chaves = modeloPadraoDe('POP').schema.seccoes.map(s => s.chave);
    expect(chaves).toEqual(['objectivo', 'ambito', 'referencias', 'definicoes', 'responsabilidades', 'procedimento', 'registos', 'anexos', 'historico']);
    for (const m of MODELOS_PADRAO) for (const s of m.schema.seccoes) {
      expect(s.ajuda, `${m.classe_codigo}.${s.chave}`).toBeTruthy();
      expect(typeof s.obrigatoria).toBe('boolean');
    }
  });

  it('o documento novo não leva o histórico como secção', () => {
    const d = novoDocumentoEstruturado(modeloPadraoDe('POP'));
    expect(d.schema).toBe(SCHEMA_VERSAO);
    expect(d.modelo).toBe('POP');
    expect(d.seccoes.some(s => s.chave === 'historico')).toBe(false);
    expect(d.seccoes).toHaveLength(8);
    expect(new Set(d.seccoes.map(s => s.id)).size).toBe(8);
    expect(d.cabecalho.revisao).toBe('00');
    expect(d.historico).toEqual([]);
  });
});

describe('validarDocumentoEstruturado', () => {
  it('aceita um rascunho a meio no modo normal e recusa-o no estrito', () => {
    const d = novoDocumentoEstruturado(modeloPadraoDe('POP'));
    expect(validarDocumentoEstruturado(d).valido).toBe(true);
    const r = validarDocumentoEstruturado(d, { estrito: true });
    expect(r.valido).toBe(false);
    expect(r.erros.some(e => e.includes('Objectivo'))).toBe(true);
    expect(r.erros.some(e => e.includes('Número'))).toBe(true);
    // opcionais não aparecem
    expect(r.erros.some(e => e.includes('Anexos'))).toBe(false);
  });

  it('aceita um documento completo no estrito', () => {
    const r = validarDocumentoEstruturado(docPreenchido(), { estrito: true });
    expect(r.erros).toEqual([]);
    expect(r.valido).toBe(true);
  });

  it('aceita todos os nós e marcas do contrato', () => {
    const d = docPreenchido();
    d.seccoes[0].conteudo = doc(
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'T' }] },
      par('a', [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }]),
      { type: 'bulletList', content: [{ type: 'listItem', content: [par('x')] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [par('y')] }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [par('h')] }, { type: 'tableCell', content: [par('c')] }] }] },
      { type: 'image', attrs: { src: 'data:image/jpeg;base64,AAAA', alt: 'x', width: '100%' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] },
      { type: 'horizontalRule' },
      { type: 'blockquote', content: [par('Aviso')] },
    );
    expect(validarDocumentoEstruturado(d, { estrito: true }).erros).toEqual([]);
  });

  it('recusa nós, marcas, níveis de título e imagens fora do contrato', () => {
    const d = docPreenchido();
    d.seccoes[0].conteudo = doc(
      { type: 'codeBlock', content: [{ type: 'text', text: 'x' }] },
      par('a', [{ type: 'strike' }]),
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'T' }] },
      { type: 'image', attrs: { src: 'javascript:alert(1)' } },
    );
    const r = validarDocumentoEstruturado(d);
    expect(r.valido).toBe(false);
    expect(r.erros.join('\n')).toMatch(/codeBlock/);
    expect(r.erros.join('\n')).toMatch(/strike/);
    expect(r.erros.join('\n')).toMatch(/nível 1/);
    expect(r.erros.join('\n')).toMatch(/imagem/);
  });

  it('recusa forma errada: schema, modelo, ids repetidos, data não ISO, histórico', () => {
    const d = docPreenchido();
    const mau = { ...d, schema: 2, modelo: 'XX', cabecalho: { ...d.cabecalho, data: '20/10/2026' }, seccoes: [d.seccoes[0], d.seccoes[0]], historico: [{ revisao: '' }] };
    const e = validarDocumentoEstruturado(mau).erros.join('\n');
    expect(e).toMatch(/schema/);
    expect(e).toMatch(/modelo/);
    expect(e).toMatch(/repetido/);
    expect(e).toMatch(/ISO/);
    expect(e).toMatch(/historico\[0\]/);
    expect(validarDocumentoEstruturado(null).valido).toBe(false);
  });

  it('avisa (sem erro) de código ICAO estranho', () => {
    const d = docPreenchido();
    d.cabecalho.aeroporto = 'Luanda';
    const r = validarDocumentoEstruturado(d);
    expect(r.valido).toBe(true);
    expect(r.avisos.length).toBe(1);
  });
});

describe('conteúdo vazio e obrigatórias', () => {
  it('parágrafo vazio ou só espaços conta como vazio; imagem e tabela contam como preenchido', () => {
    expect(conteudoVazio({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    expect(conteudoVazio(doc(par('   ')))).toBe(true);
    expect(conteudoVazio(null)).toBe(true);
    expect(conteudoVazio(doc({ type: 'image', attrs: { src: 'data:image/png;base64,AA' } }))).toBe(false);
    expect(conteudoVazio(doc({ type: 'table', content: [] }))).toBe(false);
    expect(conteudoVazio(doc(par('ok')))).toBe(false);
  });

  it('lista as obrigatórias em falta', () => {
    const d = docPreenchido();
    d.seccoes = d.seccoes.map(s => (s.chave === 'procedimento' || s.chave === 'anexos' ? { ...s, conteudo: doc({ type: 'paragraph' }) } : s));
    expect(seccoesObrigatoriasEmFalta(d).map(s => s.chave)).toEqual(['procedimento']);
  });

  it('textoDoNo junta o texto', () => {
    expect(textoDoNo(doc(par('a'), par('b')))).toBe('a\nb\n');
  });
});

describe('revisões', () => {
  it('proximaRevisao', () => {
    expect(proximaRevisao('00')).toBe('01');
    expect(proximaRevisao('09')).toBe('10');
    expect(proximaRevisao('99')).toBe('100');
    expect(proximaRevisao('1')).toBe('2');
    expect(proximaRevisao('A')).toBe('B');
    expect(proximaRevisao('')).toBe('00');
    expect(proximaRevisao(undefined)).toBe('00');
    expect(proximaRevisao('rev')).toBe('00');
  });

  it('prepararNovaRevisao aumenta, limpa verificação/aprovação e acrescenta ao histórico sem mexer no original', () => {
    const d = garantirHistoricoInicial({ ...docPreenchido(), cabecalho: { ...docPreenchido().cabecalho, verificadoPor: 'X', aprovadoPor: 'Y' } });
    expect(d.historico).toEqual([{ revisao: '00', data: '2026-10-20', descricao: 'Emissão inicial', autor: 'J. Silva' }]);
    const n = prepararNovaRevisao(d, { descricao: 'Novo passo 5', autor: 'M. Sager', data: '2026-11-01' });
    expect(n.cabecalho.revisao).toBe('01');
    expect(n.cabecalho.data).toBe('2026-11-01');
    expect(n.cabecalho.verificadoPor).toBe('');
    expect(n.cabecalho.aprovadoPor).toBe('');
    expect(n.historico).toHaveLength(2);
    expect(n.historico[1]).toEqual({ revisao: '01', data: '2026-11-01', descricao: 'Novo passo 5', autor: 'M. Sager' });
    expect(d.cabecalho.revisao).toBe('00');
    expect(d.historico).toHaveLength(1);
    expect(validarDocumentoEstruturado(n, { estrito: true }).valido).toBe(true);
  });

  it('garantirHistoricoInicial não duplica', () => {
    const d = garantirHistoricoInicial(docPreenchido());
    expect(garantirHistoricoInicial(d)).toBe(d);
  });
});
