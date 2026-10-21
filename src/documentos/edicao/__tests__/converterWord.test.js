// «Converter para o editor»: .docx → documento estruturado. Os .docx de teste constroem-se em memória com o pacote
// `docx`; a suite dos ficheiros reais do GED só corre neste servidor (describe.skipIf quando o ficheiro não existe).
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import {
  AlignmentType, Document, HeadingLevel, ImageRun, InternalHyperlink, LevelFormat, Packer, Paragraph, Table, TableCell,
  TableRow, TextRun,
} from 'docx';
import {
  converterDocxParaEstruturado, lerDocx, montarDocumento, limparTitulo, classificarEstilo, dataParaISO, pareceFrase,
  encaixarTitulo, tipoPreliminar, lerLegenda, podeConverterClasse, contarTextoNo, corrigirListas, DESCRICAO_CONVERSAO,
} from '../converterWord';
import { modeloPadraoDe } from '../modelosPadrao';
import { validarDocumentoEstruturado, textoDoNo } from '../contrato';

// PNG 1×1
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

const h1 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 });
const h2 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 });
const p = (t, o = {}) => new Paragraph({ children: [new TextRun(t)], ...o });
const negrito = (t) => new Paragraph({ children: [new TextRun({ text: t, bold: true })] });
const marca = (t, nivel = 0) => new Paragraph({ text: t, bullet: { level: nivel } });
const num = (t, nivel = 0) => new Paragraph({ text: t, numbering: { reference: 'num', level: nivel } });
const celula = (t) => new TableCell({ children: [p(t)] });
const tabela = (linhas) => new Table({ rows: linhas.map(l => new TableRow({ children: l.map(celula) })) });
const imagem = () => new Paragraph({ children: [new ImageRun({ type: 'png', data: PNG, transformation: { width: 40, height: 40 } })] });

const NUMERACAO = {
  config: [{
    reference: 'num',
    levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START },
      { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', alignment: AlignmentType.START },
    ],
  }],
};

async function docx(children) {
  const d = new Document({ numbering: NUMERACAO, sections: [{ children }] });
  const buf = await Packer.toBuffer(d);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const CAB = { numero: 'POP-FNLU-OPS-099', titulo: 'Teste', aeroporto: 'FNLU', aeroportoNome: 'Aeroporto 4 de Fevereiro', elaboradoPor: 'Ana' };

function todos(no, tipo, out = []) {
  if (!no || typeof no !== 'object') return out;
  if (no.type === tipo) out.push(no);
  (no.content || []).forEach(f => todos(f, tipo, out));
  return out;
}
const seccao = (doc, chave) => doc.seccoes.find(s => s.chave === chave);

// ── um POP «de Word»: capa, controlo de revisões, índice, títulos numerados, listas, tabela, imagem, nota ───────
async function popDeWord() {
  return docx([
    new Paragraph({ text: 'POP-FNLU-OPS-099', heading: HeadingLevel.TITLE }),
    negrito('AEROPORTO INTERNACIONAL 4 DE FEVEREIRO'),
    negrito('CONTROLO DE REVISÕES'),
    tabela([['Revisão', 'Data', 'Descrição'], ['00', '01/02/2023', 'Emissão inicial'], ['01', '15/03/2024', 'Revisão geral'], ['', '', '']]),
    negrito('ÍNDICE'),
    new Paragraph({ children: [new InternalHyperlink({ anchor: '_Toc100', children: [new TextRun('1. OBJECTIVO\t2')] })] }),
    new Paragraph({ children: [new InternalHyperlink({ anchor: '_Toc101', children: [new TextRun('2. ÂMBITO\t2')] })] }),
    h1('1.  OBJECTIVO'),
    p('Estabelecer o procedimento de inspecção diária da área de movimento.'),
    h1('2. ÂMBITO'),
    p('Aplica-se a todo o pessoal da Direcção de Operações.'),
    h1('3. RESPONSABILIDADES'),
    marca('Chefe de turno: garante a inspecção.'),
    marca('Regista as anomalias no livro.', 1),
    marca('Técnico: executa a inspecção.'),
    h1('4. PROCEDIMENTO'),
    h2('4.1 Preparação:'),
    num('Coordenar com a Torre.'),
    num('Pedir autorização de entrada.', 1),
    num('Percorrer a pista.'),
    imagem(),
    p('Figura 1 – Mapa da placa'),
    p('Tabela 1 – Equipamentos'),
    tabela([['Equipamento', 'Quantidade'], ['Rádio', '2'], ['Lanterna', '4']]),
    p('NOTA: Usar sempre colete reflector.'),
    p('Texto centrado de teste.', { alignment: AlignmentType.CENTER }),
    h1('5. MEIOS TÉCNICOS'),
    p('Viatura de inspecção com rádio.'),
    h1('6. REGISTOS'),
    p('Ficha FR-FNLU-OPS-003 arquivada no AOC.'),
    p('O DIRECTOR DO AEROPORTO'),
    p('José Exemplo'),
  ]);
}

describe('converterWord — POP construído em memória', () => {
  it('encaixa as secções, tira a numeração e extrai o histórico', async () => {
    const r = await converterDocxParaEstruturado({ arrayBuffer: await popDeWord(), modelo: modeloPadraoDe('POP'), cabecalhoBase: CAB, autor: 'Ana' });
    const { doc, relatorio } = r;
    expect(validarDocumentoEstruturado(doc).erros).toEqual([]);

    expect(textoDoNo(seccao(doc, 'objectivo').conteudo)).toMatch(/inspecção diária/);
    expect(textoDoNo(seccao(doc, 'ambito').conteudo)).toMatch(/Direcção de Operações/);
    expect(textoDoNo(seccao(doc, 'registos').conteudo)).toMatch(/FR-FNLU-OPS-003/);
    // a assinatura do fim saiu (o gerador faz o quadro de aprovação)
    expect(textoDoNo(seccao(doc, 'registos').conteudo)).not.toMatch(/DIRECTOR/);
    expect(relatorio.descartados.map(d => d.tipo)).toEqual(expect.arrayContaining(['indice', 'revisoes', 'tituloDocumento', 'assinatura']));

    // listas de 2 níveis
    const resp = seccao(doc, 'responsabilidades').conteudo;
    const listas = todos(resp, 'bulletList');
    expect(listas.length).toBeGreaterThanOrEqual(2);
    expect(todos(listas[0], 'bulletList').length).toBe(2); // a lista e a aninhada
    expect(textoDoNo(resp)).toMatch(/Regista as anomalias/);

    // títulos sem numeração escrita nem «:» no fim
    const proc = seccao(doc, 'procedimento').conteudo;
    const tit = todos(proc, 'heading');
    expect(tit.map(h => [h.attrs.level, textoDoNo(h).trim()])).toEqual([[2, 'Preparação']]);
    expect(todos(proc, 'orderedList').length).toBeGreaterThanOrEqual(1);

    // imagem e tabela com legenda (o parágrafo «Figura 1 – …» / «Tabela 1 – …» sai do texto)
    const [img] = todos(proc, 'image');
    expect(img.attrs.src).toMatch(/^data:image\/png;base64,/);
    expect(img.attrs.legenda).toBe('Mapa da placa');
    const [tb] = todos(proc, 'table');
    expect(tb.attrs.legenda).toBe('Equipamentos');
    expect(textoDoNo(proc)).not.toMatch(/Figura 1/);

    // «NOTA:» → caixa de nota sem o rótulo; alinhamento centrado
    const [bq] = todos(proc, 'blockquote');
    expect(bq.attrs.tipo).toBe('nota');
    expect(textoDoNo(bq).trim()).toBe('Usar sempre colete reflector.');
    expect(todos(proc, 'paragraph').some(n => n.attrs?.textAlign === 'center')).toBe(true);

    // secção extra na posição do Word (entre Procedimento e Registos)
    const chaves = doc.seccoes.map(s => s.chave);
    const iExtra = doc.seccoes.findIndex(s => s.titulo === 'MEIOS TÉCNICOS');
    expect(iExtra).toBe(chaves.indexOf('procedimento') + 1);
    expect(doc.seccoes[iExtra].obrigatoria).toBe(false);
    expect(chaves.indexOf('registos')).toBeGreaterThan(iExtra);

    // histórico do Word + entrada da conversão; revisão seguinte
    expect(doc.historico.map(h => [h.revisao, h.data, h.descricao])).toEqual([
      ['00', '2023-02-01', 'Emissão inicial'],
      ['01', '2024-03-15', 'Revisão geral'],
      ['02', expect.any(String), DESCRICAO_CONVERSAO],
    ]);
    expect(doc.cabecalho.revisao).toBe('02');
    expect(doc.cabecalho.numero).toBe('POP-FNLU-OPS-099');
    expect(doc.historico[2].autor).toBe('Ana');

    // relatório
    expect(relatorio.imagens).toMatchObject({ total: 1, convertidas: 1, perdidas: 0 });
    expect(relatorio.tabelas.total).toBe(1); // a tabela de revisões foi para o histórico
    expect(relatorio.seccoesEncaixadas).toBe(5);
    expect(relatorio.seccoesExtra).toBe(1);
    expect(relatorio.texto.percentagemConteudo).toBeGreaterThan(95);
    expect(relatorio.blocos.find(b => /OBJECTIVO/.test(b.origem))).toMatchObject({ chave: 'objectivo' });
    expect(relatorio.obrigatoriasVazias).toEqual(['Referências']);
  });

  it('o mapeamento pode mudar-se: montarDocumento com outro destino', async () => {
    const { blocos, historico } = await lerDocx({ arrayBuffer: await popDeWord(), modelo: modeloPadraoDe('POP'), reduzirImagem: null });
    const mudados = blocos.map(b => (b.titulo === 'MEIOS TÉCNICOS' ? { ...b, destino: 'procedimento' } : b));
    const doc = montarDocumento({ blocos: mudados, modelo: modeloPadraoDe('POP'), cabecalho: CAB, historico });
    expect(doc.seccoes.some(s => s.titulo === 'MEIOS TÉCNICOS')).toBe(false);
    const proc = seccao(doc, 'procedimento').conteudo;
    // duas origens na mesma secção → cada uma com o seu título de nível 2; os títulos de dentro descem um nível
    expect(todos(proc, 'heading').map(h => [h.attrs.level, textoDoNo(h).trim()])).toEqual([
      [2, 'PROCEDIMENTO'], [3, 'Preparação'], [2, 'MEIOS TÉCNICOS'],
    ]);
    expect(validarDocumentoEstruturado(doc).valido).toBe(true);
  });
});

describe('converterWord — sinónimos, preâmbulo e documentos sem títulos', () => {
  it('sinónimos encaixam; várias secções do Word na mesma secção do modelo; preâmbulo → Introdução', async () => {
    const ab = await docx([
      p('Este procedimento substitui a instrução de 2019 e foi revisto com a equipa de operações de placa.'),
      p('Aplica-se desde a data da aprovação, em todos os turnos de serviço do aeroporto e a todas as equipas.'),
      p('As equipas devem ler o documento completo antes da primeira inspecção feita com estas regras novas.'),
      p('O texto que se segue está organizado pela ordem das tarefas de cada turno.'),
      h1('Finalidade'), p('Garantir a segurança.'),
      h1('Área de aplicação'), p('Placa de estacionamento.'),
      h1('Documentos de referência'), p('ICAO Anexo 14.'),
      h1('Siglas'), p('AOC — Centro de Operações.'),
      h1('Abreviaturas'), p('FOD — objecto estranho.'),
      h1('Descrição'), p('Passo a passo.'),
    ]);
    const { doc, relatorio } = await converterDocxParaEstruturado({ arrayBuffer: ab, modelo: modeloPadraoDe('POP'), cabecalhoBase: CAB });
    expect(textoDoNo(seccao(doc, 'objectivo').conteudo)).toMatch(/Garantir a segurança/);
    expect(textoDoNo(seccao(doc, 'ambito').conteudo)).toMatch(/Placa/);
    expect(textoDoNo(seccao(doc, 'referencias').conteudo)).toMatch(/Anexo 14/);
    expect(textoDoNo(seccao(doc, 'procedimento').conteudo)).toMatch(/Passo a passo/);
    const def = seccao(doc, 'definicoes').conteudo;
    expect(todos(def, 'heading').map(h => textoDoNo(h).trim())).toEqual(['Siglas', 'Abreviaturas']);
    // o preâmbulo vai para «Introdução» (a primeira secção do modelo já tem texto), no início
    expect(doc.seccoes[0]).toMatchObject({ titulo: 'Introdução', obrigatoria: false });
    expect(textoDoNo(doc.seccoes[0].conteudo)).toMatch(/substitui a instrução de 2019/);
    // sem histórico no Word: a conversão é a revisão 01
    expect(doc.cabecalho.revisao).toBe('01');
    expect(doc.historico).toHaveLength(1);
    expect(relatorio.seccoesExtra).toBe(1);
  });

  it('sem títulos de nível 1: tudo vai para a secção principal, com aviso', async () => {
    const ab = await docx([
      new Paragraph({ text: 'CONTACTOS DO PESSOAL', heading: HeadingLevel.HEADING_3 }),
      tabela([['Cargo', 'Nome', 'Telefone'], ['Director', 'J. Silva', '923 000 000'], ['Chefe de turno', 'M. Costa', '923 111 111']]),
    ]);
    const { doc, relatorio } = await converterDocxParaEstruturado({ arrayBuffer: ab, modelo: modeloPadraoDe('LT'), cabecalhoBase: CAB });
    const lista = seccao(doc, 'lista').conteudo;
    expect(todos(lista, 'table')).toHaveLength(1);
    expect(todos(lista, 'heading')[0].attrs.level).toBe(3);
    expect(textoDoNo(lista)).toMatch(/M\. Costa/);
    expect(relatorio.avisos.join(' ')).toMatch(/não tem títulos de nível 1/);
    expect(validarDocumentoEstruturado(doc).valido).toBe(true);
  });

  it('níveis de lista feitos só com o recuo (o Word numera tudo com o nível 0) e numeração que continua depois da imagem', async () => {
    const recuado = (t, left) => new Paragraph({ text: t, numbering: { reference: 'num', level: 0 }, indent: { left } });
    const ab = await docx([
      h1('PROCEDIMENTO'),
      recuado('Os passageiros não podem transportar:', 709),
      recuado('Armas de fogo:', 1134),
      recuado('Pistolas;', 1560),
      recuado('Espingardas;', 1560),
      recuado('Objectos cortantes:', 1134),
      p('Separador.'),
      num('Primeiro passo.'),
      imagem(),
      num('Segundo passo.'),
    ]);
    const { doc } = await converterDocxParaEstruturado({ arrayBuffer: ab, modelo: modeloPadraoDe('POP'), cabecalhoBase: CAB });
    const proc = seccao(doc, 'procedimento').conteudo;
    const [l1] = proc.content.filter(n => n.type === 'orderedList');
    expect(l1.content).toHaveLength(1);
    const l2 = l1.content[0].content[1];
    expect(l2.content.map(it => textoDoNo(it.content[0]).trim())).toEqual(['Armas de fogo:', 'Objectos cortantes:']);
    expect(l2.content[0].content[1].content.map(it => textoDoNo(it).trim())).toEqual(['Pistolas;', 'Espingardas;']);
    // nenhum item vazio a fazer de pai
    expect(todos(proc, 'listItem').every(it => textoDoNo(it.content[0]).trim())).toBe(true);
    // «1.», imagem, «2.»
    const listas = proc.content.filter(n => n.type === 'orderedList');
    expect(listas[listas.length - 1].attrs.start).toBe(2);
  });

  it('corrigirListas: item oco junta-se ao anterior; lista só de itens ocos sobe', () => {
    const par = (t) => ({ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] });
    const it = (t, ...sub) => ({ type: 'listItem', content: [par(t), ...sub] });
    const ol = (...itens) => ({ type: 'orderedList', content: itens });
    const ul = (...itens) => ({ type: 'bulletList', content: itens });
    const d = { type: 'doc', content: [ol(it('A'), it('', ol(it('a1'))), it('B', ul(it('', ol(it('b1'))))))] };
    const r = corrigirListas(d);
    const [lista] = r.content;
    expect(lista.content).toHaveLength(2);
    expect(textoDoNo(lista.content[0].content[1]).trim()).toBe('a1');
    expect(lista.content[1].content[1].type).toBe('orderedList');
    expect(textoDoNo(lista.content[1].content[1]).trim()).toBe('b1');
  });
});

describe('converterWord — funções auxiliares', () => {
  it('limparTitulo', () => {
    expect(limparTitulo('1.  OBJECTIVO')).toBe('OBJECTIVO');
    expect(limparTitulo('3.1 Manuais de Apoio:')).toBe('Manuais de Apoio');
    expect(limparTitulo('6.3.1. Procedimentos de Rastreio')).toBe('Procedimentos de Rastreio');
    expect(limparTitulo('CAPÍTULO 2 - RESPOSTA À EMERGÊNCIA')).toBe('RESPOSTA À EMERGÊNCIA');
    expect(limparTitulo('- INTRODUÇÃO')).toBe('INTRODUÇÃO');
    expect(limparTitulo('IV. Disposições finais')).toBe('Disposições finais');
    expect(limparTitulo('PERFIL\tDOS\tRESPONSÁVEIS')).toBe('PERFIL DOS RESPONSÁVEIS');
    expect(limparTitulo('Anexo A — Mapa')).toBe('Anexo A — Mapa');
  });

  it('classificarEstilo: Word pt/en, toc, Title e estilos próprios', () => {
    expect(classificarEstilo('heading 1')).toEqual({ tipo: 'titulo', nivel: 1 });
    expect(classificarEstilo('Título 3')).toEqual({ tipo: 'titulo', nivel: 3 });
    expect(classificarEstilo('toc 2')).toEqual({ tipo: 'toc' });
    expect(classificarEstilo('Title')).toEqual({ tipo: 'tituloDocumento' });
    expect(classificarEstilo('1 ATO- Capítulo I')).toEqual({ tipo: 'titulo', nivel: 1 });
    expect(classificarEstilo('3 ATO- 1.1. Título')).toEqual({ tipo: 'titulo', nivel: 2 });
    expect(classificarEstilo('4 ATO- 1.1.1 Título')).toEqual({ tipo: 'titulo', nivel: 3 });
    expect(classificarEstilo('6 ATO- (1) Título')).toEqual({ tipo: 'titulo', nivel: 4 });
    expect(classificarEstilo('7 ATO- i. Título Subdivisão 2')).toEqual({ tipo: 'titulo', nivel: 4 });
    expect(classificarEstilo('0 ATO- Título')).toEqual({ tipo: 'titulo', nivel: 1 });
    expect(classificarEstilo('5 ATO- Par. subtópico')).toBeNull();
    expect(classificarEstilo('List Paragraph')).toBeNull();
  });

  it('pareceFrase: estilos de título usados como itens de lista', () => {
    expect(pareceFrase('Director do Aeroporto (que preside);')).toBe(true);
    expect(pareceFrase('Emergência Aeronáutica,')).toBe(true);
    expect(pareceFrase('Procedimentos especiais de rastreio de funcionários em trabalho de escolta.')).toBe(false);
    expect(pareceFrase('Procedimentos especiais de rastreio de funcionários em trabalho de escolta.', { proprio: true })).toBe(true);
    expect(pareceFrase('OBJECTIVO')).toBe(false);
  });

  it('dataParaISO, tipoPreliminar, lerLegenda, encaixarTitulo, podeConverterClasse', () => {
    expect(dataParaISO('11/07/18')).toBe('2018-07-11');
    expect(dataParaISO('31/10/2022')).toBe('2022-10-31');
    expect(dataParaISO('2024-03-05')).toBe('2024-03-05');
    expect(dataParaISO('12 de Março de 2024')).toBe('2024-03-12');
    expect(dataParaISO('—')).toBe('');
    expect(tipoPreliminar('A – ÍNDICE')).toBe('indice');
    expect(tipoPreliminar('CONTROLO DE REVISÕES')).toBe('revisoes');
    expect(tipoPreliminar('LISTA DE PÁGINAS EFECTIVAS')).toBe('paginas');
    expect(tipoPreliminar('FOLHA DE CONTROLO DA DOCUMENTAÇÃO')).toBe('controlo');
    expect(tipoPreliminar('Procedimento')).toBeNull();
    expect(lerLegenda('Figura 2 – Planta da placa')).toEqual({ tipo: 'figura', texto: 'Planta da placa' });
    expect(lerLegenda('Tabela 3: Contactos')).toEqual({ tipo: 'tabela', texto: 'Contactos' });
    expect(lerLegenda('Figura mostra a placa')).toBeNull();
    const pop = modeloPadraoDe('POP');
    expect(encaixarTitulo('OBJETIVO', pop).chave).toBe('objectivo');
    expect(encaixarTitulo('Aplicabilidade', pop).chave).toBe('ambito');
    expect(encaixarTitulo('Documentos de Referência', pop).chave).toBe('referencias');
    expect(encaixarTitulo('Rastreio de veículos', pop).chave).toBeNull();
    expect(podeConverterClasse('POP').pode).toBe(true);
    expect(podeConverterClasse('FR')).toEqual({ pode: false, motivo: 'formulario' });
    expect(podeConverterClasse('MA')).toEqual({ pode: false, motivo: 'manual' });
    expect(contarTextoNo({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a b c' }] }] })).toBe(3);
  });
});

// ── ficheiros reais do GED (só neste servidor) ──────────────────────────────
const ST = 'C:/dirops/sga-onpremise/storage/private-uploads/';
const REAIS = [
  { classe: 'POP', nome: 'POP-FNLU-PSA-018', f: 'bfd1ee11a_POP-FNLU-PSA-018-AN.02.018POP-FNLU-PSA-018PORTAODEACESSOAPLACADOTECA1.docxfonte.docx', minEncaixe: 3 },
  { classe: 'PR', nome: 'PR-FNLU-PFOA-001', f: '7cc943f1a_PR-FNLU-MOA-001-ProgramadeFormacaodoOperadordeAerodromoPFOAfonte.docx', minEncaixe: 4, historico: 1 },
  { classe: 'PL', nome: 'PL-FNLU-PEA-001', f: '8775996b1_PL-FNLU-PEA-001-PlanodeEmergenciadoAeroportofonte.docx', minEncaixe: 4, historico: 4 },
  { classe: 'LT', nome: 'LT-FNLU-PCA-001', f: 'ca7b74e98_LT-FNLU-PCA-001-LISTADECONTACTOSDEEMERGENCIA.docx', minEncaixe: 1 },
];
const existe = (f) => { try { return fs.existsSync(ST + f); } catch { return false; } };

describe.skipIf(!REAIS.some(r => existe(r.f)))('converterWord — ficheiros reais do GED', () => {
  for (const real of REAIS) {
    it.skipIf(!existe(real.f))(`${real.nome}`, async () => {
      const b = fs.readFileSync(ST + real.f);
      const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      const { doc, relatorio } = await converterDocxParaEstruturado({ arrayBuffer: ab, modelo: modeloPadraoDe(real.classe), cabecalhoBase: CAB });
      expect(validarDocumentoEstruturado(doc).erros).toEqual([]);
      expect(relatorio.seccoesEncaixadas).toBeGreaterThanOrEqual(real.minEncaixe);
      expect(relatorio.texto.percentagemConteudo).toBeGreaterThan(95);
      if (real.historico) expect(doc.historico.length).toBe(real.historico + 1);
      // nenhum título com numeração escrita
      const titulos = doc.seccoes.flatMap(s => todos(s.conteudo, 'heading')).map(h => textoDoNo(h).trim());
      expect(titulos.filter(t => /^\d+(\.\d+)*\.?\s/.test(t))).toEqual([]);
      console.log(`[conversão] ${real.nome}: ${relatorio.seccoesEncaixadas} secções do modelo, ${relatorio.seccoesExtra} extra, `
        + `texto ${relatorio.texto.percentagem}% (conteúdo ${relatorio.texto.percentagemConteudo}%), imagens ${relatorio.imagens.convertidas}/${relatorio.imagens.total}, `
        + `tabelas ${relatorio.tabelas.total}, histórico ${doc.historico.length - 1}, descartados ${relatorio.descartados.length}`);
    }, 120000);
  }
});
