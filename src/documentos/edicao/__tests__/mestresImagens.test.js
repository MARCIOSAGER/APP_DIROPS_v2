// Imagens próprias de cada aeroporto nos modelos-mestre: attrs.src = '{{imagem.<nome>}}' → extras.imagensLocais[icao][nome].
import { describe, it, expect } from 'vitest';
import {
  substituirCampos, resolverImagensLocais, imagensLocaisUsadas, imagemLocalDoNo, prepararParaAeroporto,
} from '../mestres';
import { validarDocumentoEstruturado, numerarLegendas } from '../contrato';
import { generateHTML, generateJSON } from '@tiptap/core';
import { extensoesContrato } from '../extensoes';

const txt = (t) => ({ type: 'text', text: t });
const par = (t) => ({ type: 'paragraph', content: t ? [txt(t)] : [] });
const tit = (t, level = 2) => ({ type: 'heading', attrs: { level }, content: [txt(t)] });
const img = (nome, legenda, extra = {}) => ({ type: 'image', attrs: { src: `{{imagem.${nome}}}`, ...(legenda ? { legenda } : {}), ...extra } });
const cel = (...c) => ({ type: 'tableCell', content: c.length ? c : [par()] });
const galeria = (...linhas) => ({ type: 'table', attrs: { estilo: 'fotos' }, content: linhas.map((l) => ({ type: 'tableRow', content: l })) });

const JPG = (n) => `data:image/jpeg;base64,/9j/${'A'.repeat(8)}${n}`;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function mestre(conteudo, imagensLocais) {
  return {
    schema: 1,
    modelo: 'RE',
    cabecalho: {
      numero: '{{documento.numero}}', titulo: 'Normas', revisao: '01', data: '2026-10-22', aeroporto: '{{aeroporto.icao}}',
      aeroportoNome: '{{aeroporto.nome}}', elaboradoPor: 'Marcio Sager', aprovadoPor: '{{aeroporto.director}}',
    },
    seccoes: [{ id: 's1-disposicoes', chave: 'disposicoes', titulo: 'Disposições', obrigatoria: true, conteudo: { type: 'doc', content: conteudo } }],
    historico: [],
    extras: { mestre: true, chave: 'teste', alvos: [], imagensLocais },
  };
}
const corpo = (doc) => doc.seccoes[0].conteudo.content;
const avImg = (r) => r.avisos.filter((a) => a.startsWith('sem imagem'));
const CEL_VAZIA = { type: 'tableCell', content: [{ type: 'paragraph' }] };
const VALORES = (icao) => ({ 'aeroporto.icao': icao, 'aeroporto.nome': `Aeroporto ${icao}` });

describe('contrato — imagem local {{imagem.x}}', () => {
  it('é válida só num mestre; num documento normal é erro', () => {
    const m = mestre([img('portoes', 'Portões')], {});
    expect(validarDocumentoEstruturado(m).erros).toEqual([]);
    const normal = { ...m, extras: {} };
    expect(validarDocumentoEstruturado(normal).erros.some((e) => e.includes('{{imagem.portoes}}'))).toBe(true);
  });
  it('imagemLocalDoNo / imagensLocaisUsadas', () => {
    expect(imagemLocalDoNo(img('layout'))).toBe('layout');
    expect(imagemLocalDoNo({ type: 'image', attrs: { src: PNG } })).toBe(null);
    const m = mestre([img('a'), galeria([cel(img('b')), cel(img('a'))]), { type: 'image', attrs: { src: PNG } }], {});
    expect(imagensLocaisUsadas(m)).toEqual(['a', 'b']);
  });
});

describe('substituirCampos — imagens locais', () => {
  it('põe a imagem do aeroporto (por extras.imagensLocais[icao]) e substitui campos no alt/legenda', () => {
    const m = mestre([par('Antes'), img('vista', 'Vista do {{aeroporto.nome}}', { alt: '{{aeroporto.icao}}', width: '100%' }), par('Depois')], {
      FNHU: { vista: JPG(1) }, FNUB: { vista: { src: JPG(2) } },
    });
    const r = substituirCampos(m, VALORES('FNHU'));
    const n = corpo(r.doc)[1];
    expect(n.attrs).toEqual({ src: JPG(1), legenda: 'Vista do Aeroporto FNHU', alt: 'FNHU', width: '100%' });
    expect(avImg(r)).toEqual([]);
    expect(r.imagensEmFalta).toEqual([]);
    // { src } também serve; o icao pode vir das opções
    expect(corpo(substituirCampos(m, VALORES('FNHU'), { icao: 'FNUB' }).doc)[1].attrs.src).toBe(JPG(2));
    // o mestre não é alterado
    expect(corpo(m)[1].attrs.src).toBe('{{imagem.vista}}');
  });

  it('sem a imagem: o nó e a legenda saem, com aviso «sem imagem <nome> para <ICAO>» (a legenda não conta como campo em falta)', () => {
    const m = mestre([par('Antes'), img('vista', 'Vista do {{local.nome_curto}}'), par('Depois')], { FNHU: { outra: JPG(1) } });
    const r = substituirCampos(m, VALORES('FNHU'));
    expect(corpo(r.doc).map((x) => x.type)).toEqual(['paragraph', 'paragraph']);
    expect(avImg(r)).toEqual(['sem imagem vista para FNHU']);
    expect(r.imagensEmFalta).toEqual(['vista']);
    expect(r.emFalta).not.toContain('local.nome_curto');
    expect(JSON.stringify(r.doc)).not.toContain('{{imagem');
    expect(validarDocumentoEstruturado({ ...r.doc, extras: {} }).erros).toEqual([]);
    // a numeração das figuras não conta a que saiu
    const m2 = mestre([img('vista', 'A'), img('layout', 'B')], { FNCA: { layout: PNG } });
    const r2 = substituirCampos(m2, VALORES('FNCA'));
    const leg = numerarLegendas(r2.doc);
    expect([...leg.values()]).toEqual(['Figura 1']);
  });

  it('aeroporto sem nenhuma imagem (nem entrada em imagensLocais) → todas saem', () => {
    const m = mestre([img('a'), img('b'), par('Texto')], { FNHU: { a: PNG } });
    const r = substituirCampos(m, VALORES('FNCT'));
    expect(corpo(r.doc)).toEqual([par('Texto')]);
    expect(avImg(r)).toEqual(['sem imagem a para FNCT', 'sem imagem b para FNCT']);
  });

  it('título que só tinha imagens que saíram sai também; título com texto fica', () => {
    const m = mestre([
      tit('Imagem do aeroporto'), img('vista'), img('foto'),
      tit('Acessos'), par('Portão 1'), img('portoes'),
      tit('Mapa', 3), img('mapa'),
      tit('Regras'), par('…'),
    ], { FNMO: {} });
    const r = substituirCampos(m, VALORES('FNMO'));
    expect(corpo(r.doc)).toEqual([tit('Acessos'), par('Portão 1'), tit('Regras'), par('…')]);
  });

  it('secção que fica vazia leva um parágrafo vazio (documento continua válido)', () => {
    const m = mestre([img('vista')], {});
    const r = substituirCampos(m, VALORES('FNUB'));
    expect(r.doc.seccoes[0].conteudo).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('imagem numa tabela normal: a célula fica com um parágrafo vazio', () => {
    const tab = { type: 'table', content: [{ type: 'tableRow', content: [cel(par('Sinal')), cel(img('sinal'))] }] };
    const r = substituirCampos(mestre([tab], {}), VALORES('FNHU'));
    expect(corpo(r.doc)[0].content[0].content[1]).toEqual(CEL_VAZIA);
  });

  it('src que não é data:image é recusado (conta como em falta)', () => {
    const r = substituirCampos(mestre([img('x')], { FNHU: { x: 'javascript:alert(1)' } }), VALORES('FNHU'));
    expect(r.imagensEmFalta).toEqual(['x']);
  });
});

describe('substituirCampos — galeria «Fotos lado a lado» com imagens locais', () => {
  const g = () => galeria(
    [cel(img('f1', 'Um')), cel(img('f2', 'Dois'), par('texto da 2')), cel(img('f3', 'Três'))],
    [cel(img('f4', 'Quatro')), cel(img('f5', 'Cinco')), cel(img('f6', 'Seis'))],
  );
  const fotos = (doc) => corpo(doc)[0].content.map((r) => r.content.map((c) => c.content.find((x) => x.type === 'image')?.attrs.src || null));

  it('célula sem imagem fica vazia (sai também o texto da célula); as outras ficam no sítio', () => {
    const r = substituirCampos(mestre([g()], { FNHU: { f1: JPG(1), f3: JPG(3), f4: JPG(4), f5: JPG(5), f6: JPG(6) } }), VALORES('FNHU'));
    expect(fotos(r.doc)).toEqual([[JPG(1), null, JPG(3)], [JPG(4), JPG(5), JPG(6)]]);
    expect(corpo(r.doc)[0].content[0].content[1]).toEqual(CEL_VAZIA);
    expect(avImg(r)).toEqual(['sem imagem f2 para FNHU']);
  });

  it('colunas vazias no fim encolhem; linhas vazias saem', () => {
    const r = substituirCampos(mestre([g()], { FNHU: { f1: JPG(1), f4: JPG(4), f5: JPG(5) } }), VALORES('FNHU'));
    expect(fotos(r.doc)).toEqual([[JPG(1), null], [JPG(4), JPG(5)]]);
    const r2 = substituirCampos(mestre([g()], { FNHU: { f1: JPG(1), f2: JPG(2) } }), VALORES('FNHU'));
    expect(fotos(r2.doc)).toEqual([[JPG(1), JPG(2)]]);
    expect(corpo(r2.doc)[0].attrs).toEqual({ estilo: 'fotos' });
    expect(validarDocumentoEstruturado({ ...r2.doc, extras: {} })).toMatchObject({ erros: [], avisos: [] });
  });

  it('galeria sem nenhuma foto sai toda (e o título dela, se só tinha a galeria)', () => {
    const r = substituirCampos(mestre([tit('Fotografias'), g(), tit('Fim')], {}), VALORES('FNCT'));
    expect(corpo(r.doc)).toEqual([tit('Fim')]);
    expect(r.imagensEmFalta).toEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'f6']);
  });

  it('galeria com imagens normais (data:) não é tocada', () => {
    const fixa = galeria([cel({ type: 'image', attrs: { src: PNG } }), cel(img('f2'))]);
    const r = substituirCampos(mestre([fixa], {}), VALORES('FNHU'));
    expect(fotos(r.doc)).toEqual([[PNG]]);
  });
});

describe('resolverImagensLocais / prepararParaAeroporto', () => {
  it('resolverImagensLocais funciona sobre um doc ProseMirror solto', () => {
    const r = resolverImagensLocais({ type: 'doc', content: [img('a'), img('b')] }, { b: PNG }, 'FNCA');
    expect(r.doc.content).toEqual([{ type: 'image', attrs: { src: PNG } }]);
    expect(avImg(r)).toEqual(['sem imagem a para FNCA']);
  });

  it('o rascunho gerado leva as imagens do alvo, avisa as que faltam e não leva extras.imagensLocais', () => {
    const m = mestre([img('vista', 'Vista'), img('portoes', 'Portões')], { FNHU: { vista: JPG(9) }, FNUB: { vista: JPG(1), portoes: JPG(2) } });
    const aero = { id: 'a1', codigo_icao: 'FNHU', nome: 'Aeroporto Albano Machado' };
    const resp = [{ aeroporto_id: 'a1', email: 'dir@sga.co.ao', nome: 'Dir', principal: true }];
    const r = prepararParaAeroporto(m, { icao: 'FNHU', aeroporto_id: 'a1', documento_id: 'd1', numero: 'NRM-FNHU-NOCLA-001', revisao: '00' }, aero, resp, { id: 'd1' }, null, { data: '2026-10-22' });
    expect(corpo(r.conteudo)).toEqual([{ type: 'image', attrs: { src: JPG(9), legenda: 'Vista' } }]);
    expect(r.avisos).toContain('sem imagem portoes para FNHU');
    expect(r.conteudo.extras.imagensLocais).toBeUndefined();
    expect(validarDocumentoEstruturado(r.conteudo, { estrito: true }).erros).toEqual([]);
  });
});

describe('editor — imagem local no mestre', () => {
  it('mostra uma moldura com o nome e o src {{imagem.x}} sobrevive à ida e volta em HTML', () => {
    const ext = extensoesContrato();
    const d = { type: 'doc', content: [img('portoes_acesso', 'Portões')] };
    const html = generateHTML(d, ext);
    expect(html).toContain('data-imagem-local="portoes_acesso"');
    expect(html).toMatch(/dashed/);
    const volta = generateJSON(html, ext);
    expect(volta.content[0].attrs.src).toBe('{{imagem.portoes_acesso}}');
    expect(volta.content[0].attrs.legenda).toBe('Portões');
  });
});
