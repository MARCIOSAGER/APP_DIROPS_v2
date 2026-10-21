import { describe, it, expect } from 'vitest';
import {
  problemasDoPasso, problemasParaGerar, resumoPreenchimento, estadoSeccao, actualizarSeccao, actualizarCabecalho,
  nomeBaseFicheiro, rotuloVersao, notaVersao, prepararParaGerar, iniciarRevisao, escolherModelo, indicePasso,
  rotuloEstadoRascunho,
} from '../assistente';
import { novoDocumentoEstruturado } from '../contrato';
import { MODELOS_PADRAO, modeloPadraoDe } from '../modelosPadrao';
import { limparHtmlColado } from '../limparColagem';
import { dimensoesReduzidas } from '../imagens';

const cheio = (t) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });

function novoPop(cab = {}) {
  return novoDocumentoEstruturado(modeloPadraoDe('POP'), {
    numero: 'POP-FNLU-MOA-001', titulo: 'Inspecção', aeroporto: 'FNLU', elaboradoPor: 'J. Silva', data: '2026-10-20', ...cab,
  });
}

describe('passos do assistente', () => {
  it('modelo: precisa de modelo escolhido', () => {
    expect(problemasDoPasso('modelo', { doc: null })).toHaveLength(1);
    expect(problemasDoPasso('modelo', { doc: novoPop() })).toEqual([]);
    expect(indicePasso('seccoes')).toBe(2);
    expect(escolherModelo(MODELOS_PADRAO, 'PR').nome).toBe('Plano ou programa');
  });

  it('cabeçalho: exige aeroporto e campos obrigatórios', () => {
    const d = novoDocumentoEstruturado(modeloPadraoDe('POP'));
    const p = problemasDoPasso('cabecalho', { doc: d, aeroportoId: '' });
    expect(p).toContain('Escolha o aeroporto.');
    expect(p.join(' ')).toMatch(/Número/);
    expect(p.join(' ')).toMatch(/Título/);
    expect(problemasDoPasso('cabecalho', { doc: novoPop(), aeroportoId: 'a1' })).toEqual([]);
  });

  it('secções não bloqueiam o avanço; gerar exige as obrigatórias e o processo (documento novo)', () => {
    let d = novoPop();
    expect(problemasDoPasso('seccoes', { doc: d })).toEqual([]);
    const p = problemasParaGerar(d);
    expect(p.filter(x => x.startsWith('Secção obrigatória')).length).toBe(6);
    expect(p.some(x => /processo/.test(x))).toBe(true);

    for (const s of d.seccoes.filter(x => x.obrigatoria)) d = actualizarSeccao(d, s.id, cheio('ok'));
    d = { ...d, extras: { processo: 'MOA' } };
    expect(problemasParaGerar(d)).toEqual([]);
  });

  it('revisão de documento existente não precisa de processo', () => {
    let d = novoPop();
    for (const s of d.seccoes.filter(x => x.obrigatoria)) d = actualizarSeccao(d, s.id, cheio('ok'));
    d = { ...d, extras: { documentoId: 'doc-1' } };
    expect(problemasParaGerar(d)).toEqual([]);
  });

  it('resumo e estado das secções', () => {
    let d = novoPop();
    let r = resumoPreenchimento(d);
    expect(r).toMatchObject({ total: 8, preenchidas: 0, obrigatorias: 6, obrigatoriasEmFalta: 6, pronto: false });
    expect(estadoSeccao(d.seccoes[0])).toBe('falta');
    expect(estadoSeccao(d.seccoes.find(s => s.chave === 'anexos'))).toBe('opcional');
    d = actualizarSeccao(d, d.seccoes[0].id, cheio('Objectivo'));
    expect(estadoSeccao(d.seccoes[0])).toBe('feita');
    r = resumoPreenchimento(d);
    expect(r.preenchidas).toBe(1);
    expect(r.obrigatoriasEmFalta).toBe(5);
    expect(r.emFalta.map(s => s.chave)).not.toContain('objectivo');
  });

  it('actualizações são imutáveis', () => {
    const d = novoPop();
    const n = actualizarCabecalho(d, { titulo: 'Outro' });
    expect(n.cabecalho.titulo).toBe('Outro');
    expect(d.cabecalho.titulo).toBe('Inspecção');
    const m = actualizarSeccao(d, d.seccoes[1].id, cheio('x'));
    expect(m.seccoes[1]).not.toBe(d.seccoes[1]);
    expect(m.seccoes[0]).toBe(d.seccoes[0]);
  });
});

describe('gerar e rever', () => {
  it('nome dos ficheiros, rótulo e nota', () => {
    const d = novoPop({ revisao: '03' });
    expect(nomeBaseFicheiro(d)).toBe('POP-FNLU-MOA-001 — Inspecção (Rev.03)');
    expect(nomeBaseFicheiro(novoPop({ numero: '', titulo: 'Inspecção diária / pista' }))).toBe('Inspecção diária - pista (Rev.00)');
    expect(rotuloVersao(d)).toBe('Rev. 03');
    expect(notaVersao({ historico: [{ descricao: 'Novo passo' }] })).toMatch(/Novo passo/);
  });

  it('prepararParaGerar cria a emissão inicial e não duplica a revisão actual', () => {
    const d = prepararParaGerar(novoPop(), { autor: 'M' });
    expect(d.historico).toEqual([{ revisao: '00', data: '2026-10-20', descricao: 'Emissão inicial', autor: 'M' }]);
    expect(prepararParaGerar(d).historico).toHaveLength(1);
    const mudou = prepararParaGerar({ ...d, cabecalho: { ...d.cabecalho, revisao: '01' } }, { autor: 'M' });
    expect(mudou.historico.map(h => h.revisao)).toEqual(['00', '01']);
  });

  it('iniciarRevisao parte do conteúdo gerado e incrementa a revisão', () => {
    const gerado = prepararParaGerar(novoPop());
    const emEdicao = { ...gerado, cabecalho: { ...gerado.cabecalho, titulo: 'mexido depois' } };
    const r = iniciarRevisao({ conteudo: emEdicao, conteudo_gerado: gerado }, { descricao: 'Revisão anual', autor: 'M', data: '2027-01-02' });
    expect(r.cabecalho.revisao).toBe('01');
    expect(r.cabecalho.titulo).toBe('Inspecção');
    expect(r.historico.at(-1)).toEqual({ revisao: '01', data: '2027-01-02', descricao: 'Revisão anual', autor: 'M' });
    const r2 = iniciarRevisao({ conteudo: r }, { descricao: 'outra', data: '2027-02-01' });
    expect(r2.cabecalho.revisao).toBe('02');
    expect(r2.historico).toHaveLength(3);
  });

  it('rótulo do estado na lista', () => {
    expect(rotuloEstadoRascunho({ estado: 'gerado' })).toBe('Rascunho gerado');
    expect(rotuloEstadoRascunho({ estado: 'em_edicao', documento_id: 'x' })).toBe('Em revisão no editor');
    expect(rotuloEstadoRascunho({ estado: 'em_edicao' })).toBe('Em edição');
  });
});

describe('colar do Word e imagens', () => {
  it('limpa estilos, classes, comentários, o:p e imagens locais', () => {
    const html = '<!--[if gte mso 9]><xml>x</xml><![endif]--><p class="MsoNormal" style="color:red;font-family:Calibri">Olá<o:p></o:p></p><img src="file:///C:/x.png"><h1 style="x">T</h1>';
    const r = limparHtmlColado(html);
    expect(r).not.toMatch(/style=|class=|o:p|file:|<!--|xml/);
    expect(r).toMatch(/<p>Olá<\/p>/);
    expect(r).toMatch(/<h2>T<\/h2>/);
  });

  it('converte parágrafos-lista do Word em listas', () => {
    const html = '<p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1.<span> </span></span>Primeiro</p>'
      + '<p class="MsoListParagraphCxSpLast" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">2.<span> </span></span>Segundo</p><p>Fim</p>';
    const r = limparHtmlColado(html);
    expect(r).toMatch(/^<ol><li>\s*Primeiro<\/li><li>\s*Segundo<\/li><\/ol><p>Fim<\/p>$/);
  });

  it('marcadores do Word dão lista com marcas', () => {
    const html = '<p class="MsoListParagraph" style="mso-list:l1 level1 lfo2"><span style="mso-list:Ignore">·<span> </span></span>Item</p>';
    expect(limparHtmlColado(html)).toMatch(/^<ul><li>/);
  });

  it('dimensões reduzidas mantêm a proporção e não aumentam', () => {
    expect(dimensoesReduzidas(3200, 1600)).toEqual({ w: 1600, h: 800 });
    expect(dimensoesReduzidas(1000, 4000)).toEqual({ w: 400, h: 1600 });
    expect(dimensoesReduzidas(800, 600)).toEqual({ w: 800, h: 600 });
  });
});
