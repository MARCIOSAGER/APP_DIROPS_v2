import { describe, it, expect, afterEach } from 'vitest';
import { Editor, generateHTML, generateJSON, getSchema } from '@tiptap/core';
import {
  validarDocumentoEstruturado, novoDocumentoEstruturado, numerarLegendas, textoLegenda, legendasAntesDe,
  tipoCaixa, alinhamentoDe, NOS_PERMITIDOS,
} from '../contrato';
import { modeloPadraoDe } from '../modelosPadrao';
import { limparHtmlColado } from '../limparColagem';
import { extensoesContrato, nivelListaNaSeleccao } from '../extensoes';
import { encontrarOcorrencias, contarPalavras, normalizarTexto } from '../procurar';

const txt = (t, marks) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const par = (t, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [txt(t)] });
const doc = (...content) => ({ type: 'doc', content });
const img = (legenda) => ({ type: 'image', attrs: { src: 'data:image/png;base64,AAAA', ...(legenda !== undefined ? { legenda } : {}) } });
const celula = (...content) => ({ type: 'tableCell', content: content.length ? content : [par('x')] });
const tabela = (legenda, ...linhas) => ({
  type: 'table', ...(legenda !== undefined ? { attrs: { legenda } } : {}),
  content: (linhas.length ? linhas : [[celula()]]).map(l => ({ type: 'tableRow', content: l })),
});
const lista = (tipo, ...itens) => ({ type: tipo, content: itens });
const item = (t, sub) => ({ type: 'listItem', content: [par(t), ...(sub ? [sub] : [])] });

function docCom(...conteudos) {
  const d = novoDocumentoEstruturado(modeloPadraoDe('POP'), { numero: 'POP-FNLU-OPS-001', titulo: 'T', aeroporto: 'FNLU', elaboradoPor: 'X' });
  conteudos.forEach((c, i) => { d.seccoes[i].conteudo = c; });
  return d;
}

describe('contrato v2', () => {
  it('aceita alinhamento, caixas por tipo, legendas, quebra de página e listas de 3 níveis', () => {
    const d = docCom(doc(
      par('Justificado', { textAlign: 'justify' }),
      { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [txt('Título')] },
      par('Esquerda', { textAlign: null }),
      { type: 'blockquote', attrs: { tipo: 'aviso' }, content: [par('Cuidado')] },
      { type: 'blockquote', content: [par('Sem tipo (nota)')] },
      img('Planta'),
      tabela('Responsabilidades'),
      { type: 'pageBreak' },
      lista('orderedList', item('1', lista('orderedList', item('a', lista('bulletList', item('i')))))),
    ));
    const r = validarDocumentoEstruturado(d);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual([]);
    expect(NOS_PERMITIDOS).toContain('pageBreak');
  });

  it('recusa valores fora do contrato', () => {
    const d = docCom(doc(
      par('x', { textAlign: 'start' }),
      { type: 'blockquote', attrs: { tipo: 'perigo' }, content: [par('y')] },
      { type: 'image', attrs: { src: 'data:image/png;base64,AA', legenda: 5 } },
    ));
    const r = validarDocumentoEstruturado(d);
    expect(r.valido).toBe(false);
    expect(r.erros.some(e => e.includes('alinhamento «start»'))).toBe(true);
    expect(r.erros.some(e => e.includes('«perigo»'))).toBe(true);
    expect(r.erros.some(e => e.includes('legenda tem de ser texto'))).toBe(true);
  });

  it('lista com 4 níveis só dá aviso', () => {
    const d = docCom(doc(lista('bulletList', item('1', lista('bulletList', item('2', lista('bulletList', item('3', lista('bulletList', item('4'))))))))));
    const r = validarDocumentoEstruturado(d);
    expect(r.valido).toBe(true);
    expect(r.avisos.some(a => a.includes('mais de 3 níveis'))).toBe(true);
  });

  it('documentos antigos (sem os atributos novos) continuam válidos e com os valores por omissão', () => {
    const q = { type: 'blockquote', content: [par('Nota antiga')] };
    const p = par('Antigo');
    const d = docCom(doc(p, q, { type: 'horizontalRule' }, img()));
    expect(validarDocumentoEstruturado(d).erros).toEqual([]);
    expect(tipoCaixa(q)).toBe('nota');
    expect(tipoCaixa({ attrs: { tipo: 'xyz' } })).toBe('nota');
    expect(alinhamentoDe(p)).toBe('left');
    expect(alinhamentoDe(par('c', { textAlign: 'center' }))).toBe('center');
  });
});

describe('numerarLegendas', () => {
  it('numera figuras e tabelas com legenda, em contadores separados, pelo documento todo', () => {
    const f1 = img('Primeira');
    const fSem = img();
    const fVazia = img('   ');
    const t1 = tabela('Tabela A');
    const fNaCelula = img('Dentro da tabela');
    const t2 = tabela('Tabela B', [celula(fNaCelula)]);
    const f3 = img('Terceira');
    const d = docCom(doc(f1, fSem, t1), doc(fVazia, t2), doc(f3));
    const m = numerarLegendas(d);
    expect(m.get(f1)).toBe('Figura 1');
    expect(m.has(fSem)).toBe(false);
    expect(m.has(fVazia)).toBe(false);
    expect(m.get(t1)).toBe('Tabela 1');
    expect(m.get(t2)).toBe('Tabela 2');
    expect(m.get(fNaCelula)).toBe('Figura 2');
    expect(m.get(f3)).toBe('Figura 3');
    expect(m.size).toBe(5);
    expect(textoLegenda(m, f3)).toBe('Figura 3 — Terceira');
    expect(textoLegenda(m, fSem)).toBe('');
    // continua a numeração no editor de uma secção
    expect(legendasAntesDe(d, 0)).toEqual({ figuras: 0, tabelas: 0 });
    expect(legendasAntesDe(d, 2)).toEqual({ figuras: 2, tabelas: 2 });
  });

  it('aceita também um único doc ProseMirror', () => {
    const f = img('Só');
    expect(numerarLegendas(doc(f)).get(f)).toBe('Figura 1');
    expect(numerarLegendas(null).size).toBe(0);
  });
});

// ── HTML típico do clipboard do Word (Windows) ─────────────────────────────────────────────────────────────
const WORD_CABECA = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta name=ProgId content=Word.Document><style><!-- p.MsoNormal {font-family:"Calibri"} --></style><!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]--></head><body lang=PT style='tab-interval:35.4pt'><!--StartFragment-->`;
const WORD_PE = `<!--EndFragment--></body></html>`;
const itemWord = (cls, nivel, marca, texto, lfo = 1, lista = 0) => `<p class=${cls} style='margin-left:${36 * nivel}pt;text-indent:-18.0pt;mso-list:l${lista} level${nivel} lfo${lfo}'><![if !supportLists]><span style='font-family:Symbol;mso-fareast-font-family:Symbol'><span style='mso-list:Ignore'>${marca}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]><span style='font-family:"Arial",sans-serif;color:#C00000'>${texto}<o:p></o:p></span></p>`;

const WORD_LISTA_MULTINIVEL = WORD_CABECA
  + `<p class=MsoNormal style='text-align:justify'><span style='font-size:11.0pt;font-family:"Arial"'>Introdução justificada<o:p></o:p></span></p>`
  + itemWord('MsoListParagraphCxSpFirst', 1, '1.', 'Preparar a inspecção')
  + itemWord('MsoListParagraphCxSpMiddle', 2, 'a)', 'Verificar o veículo')
  + itemWord('MsoListParagraphCxSpMiddle', 3, 'i.', 'Luzes')
  + itemWord('MsoListParagraphCxSpMiddle', 3, 'ii.', 'Rádio')
  + itemWord('MsoListParagraphCxSpMiddle', 2, 'b)', 'Pedir autorização à TWR')
  + itemWord('MsoListParagraphCxSpLast', 1, '2.', 'Percorrer a pista')
  + `<p class=MsoNormal align=center style='text-align:center'><b><span style='font-size:14pt'>Centrado</span></b></p>`
  + itemWord('MsoListParagraphCxSpFirst', 1, '·', 'Marca um', 2, 1)
  + itemWord('MsoListParagraphCxSpLast', 2, 'o', 'Marca dois', 2, 1)
  + WORD_PE;

const WORD_TABELA = WORD_CABECA
  + `<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse;border:none;mso-border-alt:solid windowtext .5pt'>`
  + `<tr style='mso-yfti-irow:0;mso-yfti-firstrow:yes'><td width=200 valign=top style='width:150pt;border:solid windowtext 1.0pt;background:#D9E2F3'><p class=MsoNormal><b><span style='color:red'>Função</span></b></p></td>`
  + `<td width=200 valign=top style='width:150pt'><p class=MsoNormal><b>Responsabilidade</b></p></td></tr>`
  + `<tr style='mso-yfti-irow:1;mso-yfti-lastrow:yes'><td colspan=2 valign=top><p class=MsoNormal style='text-align:justify'><i>Director</i> e <u>chefe</u> de <span style='font-weight:bold'>turno</span></p></td></tr>`
  + `</table>`
  + `<p class=MsoNormal><span class=MsoCommentReference><a href="#_msocom_1" class=msocomanchor>[MS1]</a></span><span style='mso-comment-continuation:1'>texto comentado</span></p>`
  + `<p class=MsoNormal><img width=200 height=100 src="file:///C:/Users/x/AppData/Local/Temp/msohtmlclip1/01/clip_image002.png"></p>`
  + `<span style='font-size:11pt'><br clear=all style='mso-special-character:line-break;page-break-before:always'></span>`
  + `<p class=MsoNormal>Depois da quebra</p>`
  + `<div style='mso-element:comment-list'><div style='mso-element:comment'><p class=MsoCommentText>Comentário do revisor</p></div></div>`
  + WORD_PE;

describe('limparHtmlColado (Word)', () => {
  it('lista multinível do Word → listas aninhadas com o tipo e o nível certos', () => {
    const html = limparHtmlColado(WORD_LISTA_MULTINIVEL);
    expect(html).not.toMatch(/mso-|class=|font-family|color|Symbol|Times New Roman|<o:p|supportLists/i);
    const d = new DOMParser().parseFromString(html, 'text/html').body;
    const ols = d.querySelectorAll(':scope > ol');
    expect(ols).toHaveLength(1);
    const ol = ols[0];
    expect([...ol.children].map(li => li.querySelector('p').textContent.trim())).toEqual(['Preparar a inspecção', 'Percorrer a pista']);
    const nivel2 = ol.children[0].querySelector(':scope > ol');
    expect(nivel2).toBeTruthy();
    expect([...nivel2.children].map(li => li.querySelector('p').textContent.trim())).toEqual(['Verificar o veículo', 'Pedir autorização à TWR']);
    const nivel3 = nivel2.children[0].querySelector(':scope > ol');
    expect([...nivel3.children].map(li => li.textContent.trim())).toEqual(['Luzes', 'Rádio']);
    // a lista de marcas (outra lista do Word) fica separada, com o 2.º nível
    const ul = d.querySelector(':scope > ul');
    expect(ul.children[0].querySelector('p').textContent.trim()).toBe('Marca um');
    expect(ul.children[0].querySelector(':scope > ul > li').textContent.trim()).toBe('Marca dois');
    // marcas do Word não ficam no texto
    expect(d.textContent).not.toMatch(/1\.|a\)|ii\.|·/);
  });

  it('mantém justificado e centrado, e o negrito', () => {
    const html = limparHtmlColado(WORD_LISTA_MULTINIVEL);
    expect(html).toMatch(/<p style="text-align: justify">\s*Introdução justificada/);
    expect(html).toMatch(/<p style="text-align: center"><b>Centrado<\/b><\/p>/);
  });

  it('tabela do Word: mantém células, colspan e marcas; tira estilos, comentários, imagens locais; quebra de página', () => {
    const html = limparHtmlColado(WORD_TABELA);
    expect(html).not.toMatch(/style='|mso-|width=|valign|D9E2F3|\[MS1\]|Comentário do revisor|file:|<img/i);
    expect(html).toMatch(/<td colspan="2"><p style="text-align: justify"><i>Director<\/i> e <u>chefe<\/u> de <strong>turno<\/strong><\/p><\/td>/);
    expect(html).toContain('texto comentado');
    expect(html).toContain('<div data-quebra-pagina=""></div>');
  });

  it('o resultado entra no esquema do editor com os nós do contrato', () => {
    const ext = extensoesContrato();
    const j1 = generateJSON(limparHtmlColado(WORD_LISTA_MULTINIVEL), ext);
    const tipos = j1.content.map(n => n.type);
    expect(tipos).toEqual(['paragraph', 'orderedList', 'paragraph', 'bulletList']);
    expect(j1.content[0].attrs.textAlign).toBe('justify');
    expect(j1.content[2].attrs.textAlign).toBe('center');
    expect(j1.content[2].content[0].marks).toEqual([{ type: 'bold' }]);
    const l3 = j1.content[1].content[0].content[1].content[0].content[1];
    expect(l3.type).toBe('orderedList');
    expect(l3.content).toHaveLength(2);

    const j2 = generateJSON(limparHtmlColado(WORD_TABELA), ext);
    expect(j2.content.map(n => n.type)).toEqual(['table', 'paragraph', 'pageBreak', 'paragraph']);
    const c = j2.content[0].content[1].content[0];
    expect(c.attrs.colspan).toBe(2);
    const marcas = c.content[0].content.flatMap(t => (t.marks || []).map(m => m.type));
    expect(marcas).toEqual(expect.arrayContaining(['italic', 'underline', 'bold']));
    const d = docCom(j1, j2);
    expect(validarDocumentoEstruturado(d).erros).toEqual([]);
  });

  it('texto com marcadores escritos à mão num parágrafo-lista sem o span do Word', () => {
    const html = limparHtmlColado(`<p class=MsoListParagraph>1. Primeiro</p><p class=MsoListParagraph>2. Segundo</p><p class=MsoListParagraph>o texto que começa por o</p>`);
    expect(html).toContain('<ol><li><p>Primeiro</p></li><li><p>Segundo</p></li></ol>');
    expect(html).toContain('o texto que começa por o');
  });

  it('Google Docs: <b style="font-weight:normal"> à volta de tudo não põe tudo a negrito', () => {
    const html = limparHtmlColado('<b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:700">Forte</span> normal</p></b>');
    const j = generateJSON(html, extensoesContrato());
    const textos = j.content[0].content;
    expect(textos[0]).toEqual({ type: 'text', text: 'Forte', marks: [{ type: 'bold' }] });
    expect(textos[1].marks).toBeUndefined();
  });
});

describe('esquema do editor (ida e volta HTML)', () => {
  const ext = extensoesContrato();
  it('legendas, caixas, alinhamento e quebra de página sobrevivem a generateHTML → generateJSON', () => {
    const d = doc(
      par('Centro', { textAlign: 'center' }),
      { type: 'blockquote', attrs: { tipo: 'atencao' }, content: [par('Cuidado')] },
      { type: 'image', attrs: { src: 'data:image/png;base64,AAAA', legenda: 'Planta da placa' } },
      { type: 'table', attrs: { legenda: 'Equipas' }, content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [par('H')] }] }, { type: 'tableRow', content: [celula(par('v'))] }] },
      { type: 'pageBreak' },
      par('Fim'),
    );
    const html = generateHTML(d, ext);
    expect(html).toMatch(/style="text-align: center;?"/);
    expect(html).toContain('data-tipo="atencao"');
    expect(html).toMatch(/<figure class="gd-figura" data-legenda=""><img [^>]*><figcaption>Planta da placa<\/figcaption><\/figure>/);
    expect(html).toMatch(/<table[^>]*><caption contenteditable="false" data-legenda="">Equipas<\/caption>/);
    expect(html).toContain('data-quebra-pagina');
    const volta = generateJSON(html, ext);
    expect(volta.content.map(n => n.type)).toEqual(['paragraph', 'blockquote', 'image', 'table', 'pageBreak', 'paragraph']);
    expect(volta.content[0].attrs.textAlign).toBe('center');
    expect(volta.content[1].attrs.tipo).toBe('atencao');
    expect(volta.content[2].attrs.legenda).toBe('Planta da placa');
    expect(volta.content[3].attrs.legenda).toBe('Equipas');
    expect(volta.content[3].content).toHaveLength(2); // a legenda não vira linha da tabela
  });

  it('documento antigo carrega sem mudar o conteúdo (blockquote passa a «nota»)', () => {
    const antigo = doc(par('a'), { type: 'blockquote', content: [par('b')] }, { type: 'image', attrs: { src: 'data:image/png;base64,AA', width: '100%' } });
    const volta = generateJSON(generateHTML(antigo, ext), ext);
    expect(volta.content[1].attrs.tipo).toBe('nota');
    expect(volta.content[2].attrs.width).toBe('100%');
    expect(volta.content[2].attrs.legenda).toBeNull();
  });
});

describe('listas multinível e quebra de página no editor', () => {
  let ed;
  afterEach(() => { ed?.destroy(); ed = null; });

  it('Aumentar nível pára no 3.º nível', () => {
    ed = new Editor({ extensions: extensoesContrato(), content: doc(lista('bulletList', item('um'), item('dois'), item('três'), item('quatro'))) });
    // cursor no 4.º item
    let pos = 0;
    ed.state.doc.descendants((n, p) => { if (n.isText && n.text === 'quatro') pos = p; });
    ed.commands.setTextSelection(pos + 1);
    expect(ed.commands.aumentarNivelLista()).toBe(true); // nível 2
    expect(ed.commands.aumentarNivelLista()).toBe(false); // não há item anterior no mesmo nível
    expect(nivelListaNaSeleccao(ed.state)).toBe(2);
    // «três» desce para debaixo de «dois» e leva «quatro» consigo → «quatro» fica no 3.º nível
    ed.state.doc.descendants((n, p) => { if (n.isText && n.text === 'três') pos = p; });
    ed.commands.setTextSelection(pos + 1);
    expect(ed.commands.aumentarNivelLista()).toBe(true);
    ed.state.doc.descendants((n, p) => { if (n.isText && n.text === 'quatro') pos = p; });
    ed.commands.setTextSelection(pos + 1);
    expect(nivelListaNaSeleccao(ed.state)).toBe(3);
    expect(ed.commands.aumentarNivelLista()).toBe(false); // máximo
    expect(ed.commands.diminuirNivelLista()).toBe(true);
    expect(validarDocumentoEstruturado(docCom(ed.getJSON())).erros).toEqual([]);
  });

  it('caixa, alinhamento e quebra de página por comando', () => {
    ed = new Editor({ extensions: extensoesContrato(), content: doc(par('texto')) });
    ed.commands.setTextSelection(2);
    ed.commands.definirAlinhamento('justify');
    expect(ed.getJSON().content[0].attrs.textAlign).toBe('justify');
    ed.commands.definirCaixa('aviso');
    expect(ed.getJSON().content[0]).toMatchObject({ type: 'blockquote', attrs: { tipo: 'aviso' } });
    ed.commands.definirCaixa('nota');
    expect(ed.getJSON().content[0].attrs.tipo).toBe('nota');
    ed.commands.tirarCaixa();
    expect(ed.getJSON().content[0].type).toBe('paragraph');
    ed.commands.setTextSelection(ed.state.doc.content.size - 1);
    ed.commands.inserirQuebraPagina();
    expect(ed.getJSON().content.map(n => n.type)).toEqual(['paragraph', 'pageBreak', 'paragraph']);
    ed.commands.definirAlinhamento('left');
    expect(validarDocumentoEstruturado(docCom(ed.getJSON())).erros).toEqual([]);
  });
});

describe('procurar', () => {
  const schema = getSchema(extensoesContrato());
  it('encontra sem olhar a maiúsculas nem acentos, atravessando o negrito', () => {
    const d = schema.nodeFromJSON(doc(
      { type: 'paragraph', content: [txt('A ac'), txt('ção', [{ type: 'bold' }]), txt(' e a ACCAO.')] },
      par('Nenhuma aqui'),
    ));
    const r = encontrarOcorrencias(d, 'acção');
    expect(r).toHaveLength(2);
    expect(d.textBetween(r[0].from, r[0].to)).toBe('acção');
    expect(d.textBetween(r[1].from, r[1].to)).toBe('ACCAO');
    expect(encontrarOcorrencias(d, '')).toEqual([]);
    expect(normalizarTexto('Ação É')).toBe('acao e');
  });

  it('conta palavras', () => {
    const d = schema.nodeFromJSON(doc(par('Verificar a pista 4.1 antes das 06:00.'), par('Fim')));
    expect(contarPalavras(d)).toBe(8);
  });
});
