// Galeria «Fotos lado a lado» (table.attrs.estilo = 'fotos'): contrato, editor (HTML ida e volta e comandos),
// PDF (fotos dentro de cada célula, sem bordas, linha que não se parte) e DOCX (sem bordas, SEQ, cantSplit).
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import JSZip from 'jszip';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { jsPDF } from 'jspdf';
import { Editor, generateHTML, generateJSON } from '@tiptap/core';
import {
  validarDocumentoEstruturado, numerarLegendas, novaGaleria, ehTabelaFotos, novoDocumentoEstruturado,
} from '../contrato';
import { modeloPadraoDe } from '../modelosPadrao';
import { extensoesContrato, emGaleria } from '../extensoes';
import { gerarPdf, __interno } from '../gerarPdfEstruturado';
import { gerarDocx } from '../gerarDocxEstruturado';
import { numerarTitulos } from '../comum';
import { bytesDe } from './amostras.test';

// ─── PNG de uma cor (para servir de foto) ──────────────────────────
const TAB_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TAB_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const bloco = (tipo, dados) => {
  const t = Buffer.from(tipo, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
};
/** data URL de um PNG w×h de cor [r,g,b]. */
function pngCor([r, g, b], w = 120, h = 80) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const linha = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { linha[1 + 3 * x] = r; linha[2 + 3 * x] = g; linha[3 + 3 * x] = b; }
  const cru = Buffer.concat(Array.from({ length: h }, () => linha));
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(cru)), bloco('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const txt = (t) => ({ type: 'text', text: t });
const par = (t) => ({ type: 'paragraph', content: t ? [txt(t)] : [] });
const foto = (cor, legenda, extra = {}) => ({ type: 'image', attrs: { src: pngCor(cor), ...(legenda ? { legenda } : {}), ...extra } });
const cel = (...c) => ({ type: 'tableCell', content: c.length ? c : [par()] });
const galeria = (...linhas) => ({ type: 'table', attrs: { estilo: 'fotos' }, content: linhas.map((l) => ({ type: 'tableRow', content: l })) });
const CORES = [[220, 38, 38], [37, 99, 235], [22, 163, 74], [234, 179, 8], [147, 51, 234], [8, 145, 178]];

function docCom(conteudo) {
  const d = novoDocumentoEstruturado(modeloPadraoDe('POP'), { numero: 'POP-FNLU-OPS-001', titulo: 'Galeria', aeroporto: 'FNLU', elaboradoPor: 'X' });
  d.seccoes[0].conteudo = { type: 'doc', content: conteudo };
  return d;
}

describe('contrato — galeria de fotos', () => {
  it('estilo «fotos» é válido; tabela normal continua igual; estilo desconhecido é recusado', () => {
    const g = galeria([cel(foto(CORES[0], 'Placa'), par('Lado norte')), cel(foto(CORES[1]))]);
    expect(ehTabelaFotos(g)).toBe(true);
    const r = validarDocumentoEstruturado(docCom([g]));
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual([]);
    const normal = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [par('A')] }] }, { type: 'tableRow', content: [cel(par('a'))] }] };
    expect(ehTabelaFotos(normal)).toBe(false);
    expect(validarDocumentoEstruturado(docCom([normal]))).toMatchObject({ valido: true, avisos: [] });
    const r2 = validarDocumentoEstruturado(docCom([{ ...normal, attrs: { estilo: 'mosaico' } }]));
    expect(r2.erros.some((e) => e.includes('estilo «mosaico»'))).toBe(true);
  });

  it('avisa (sem recusar) cabeçalho, duas imagens na mesma célula e legenda da galeria', () => {
    const g = {
      type: 'table', attrs: { estilo: 'fotos', legenda: 'x' },
      content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [par('A')] }, cel(foto(CORES[0]), foto(CORES[1]))] }],
    };
    const r = validarDocumentoEstruturado(docCom([g]));
    expect(r.erros).toEqual([]);
    expect(r.avisos.some((a) => a.includes('cabeçalho'))).toBe(true);
    expect(r.avisos.some((a) => a.includes('mais do que uma imagem'))).toBe(true);
    expect(r.avisos.some((a) => a.includes('não leva legenda própria'))).toBe(true);
  });

  it('numera as fotos linha a linha, da esquerda para a direita, a seguir às figuras anteriores; a galeria não é «Tabela N»', () => {
    const antes = foto(CORES[5], 'Antes');
    const f = CORES.map((c, k) => foto(c, `F${k + 1}`));
    const g = { ...galeria([cel(f[0]), cel(f[1]), cel(f[2])], [cel(f[3]), cel(f[4]), cel(f[5])]), attrs: { estilo: 'fotos', legenda: 'ignorada' } };
    const tab = { type: 'table', attrs: { legenda: 'Normal' }, content: [{ type: 'tableRow', content: [cel(par('a'))] }] };
    const mapa = numerarLegendas({ type: 'doc', content: [antes, g, tab] });
    expect(mapa.get(antes)).toBe('Figura 1');
    expect(f.map((n) => mapa.get(n))).toEqual(['Figura 2', 'Figura 3', 'Figura 4', 'Figura 5', 'Figura 6', 'Figura 7']);
    expect(mapa.has(g)).toBe(false);
    expect(mapa.get(tab)).toBe('Tabela 1');
  });

  it('novaGaleria cria colunas × linhas de células vazias', () => {
    const g = novaGaleria(3, 2);
    expect(g.attrs.estilo).toBe('fotos');
    expect(g.content).toHaveLength(2);
    expect(g.content.every((r) => r.content.length === 3 && r.content.every((c) => c.type === 'tableCell'))).toBe(true);
  });
});

describe('editor — galeria de fotos', () => {
  let ed;
  afterEach(() => { ed?.destroy(); ed = null; });

  it('HTML ida e volta: estilo, fotos, larguras e legendas sobrevivem', () => {
    const ext = extensoesContrato();
    const d = { type: 'doc', content: [galeria([cel(foto(CORES[0], 'Norte'), par('Texto curto')), cel(foto(CORES[1], null, { width: '50%' }))])] };
    const html = generateHTML(d, ext);
    expect(html).toMatch(/<table[^>]*data-estilo="fotos"/);
    expect(html).toMatch(/<table[^>]*class="[^"]*gd-fotos/);
    const volta = generateJSON(html, ext);
    const t = volta.content[0];
    expect(t.attrs.estilo).toBe('fotos');
    const [c1, c2] = t.content[0].content;
    expect(c1.content[0]).toMatchObject({ type: 'image', attrs: { legenda: 'Norte' } });
    expect(c1.content[1]).toMatchObject({ type: 'paragraph', content: [{ text: 'Texto curto' }] });
    expect(c2.content[0].attrs.width).toBe('50%');
    // tabela normal não ganha estilo
    const normal = generateJSON(generateHTML({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [cel(par('a'))] }] }] }, ext), ext);
    expect(normal.content[0].attrs.estilo).toBeNull();
  });

  it('inserirGaleria cria a tabela-fotos; «Inserir imagem» numa célula põe a foto a 100% da célula', () => {
    ed = new Editor({ extensions: extensoesContrato(), content: { type: 'doc', content: [par('Início')] } });
    ed.commands.setTextSelection(ed.state.doc.content.size - 1);
    expect(ed.commands.inserirGaleria({ colunas: 3, linhas: 2 })).toBe(true);
    const t = ed.getJSON().content.find((n) => n.type === 'table');
    expect(t.attrs.estilo).toBe('fotos');
    expect(t.content.map((r) => r.content.length)).toEqual([3, 3]);
    // fora da galeria o comando não faz nada
    ed.commands.setTextSelection(2);
    expect(emGaleria(ed.state)).toBe(false);
    expect(ed.commands.colocarFotoNaGaleria({ src: pngCor(CORES[0]) })).toBe(false);
    // 2.ª célula da 1.ª linha
    const celulas = [];
    ed.state.doc.descendants((n, p) => { if (n.type.name === 'tableCell') celulas.push(p); });
    ed.commands.setTextSelection(celulas[1] + 2);
    expect(emGaleria(ed.state)).toBe(true);
    expect(ed.commands.colocarFotoNaGaleria({ src: pngCor(CORES[1]), alt: 'azul' })).toBe(true);
    let c = ed.getJSON().content.find((n) => n.type === 'table').content[0].content[1];
    expect(c.content[0]).toMatchObject({ type: 'image', attrs: { width: '100%', alt: 'azul' } });
    expect(c.content[1].type).toBe('paragraph');
    // trocar a foto mantém a legenda
    ed.commands.updateAttributes('image', { legenda: 'Azul' });
    ed.commands.colocarFotoNaGaleria({ src: pngCor(CORES[2]) });
    c = ed.getJSON().content.find((n) => n.type === 'table').content[0].content[1];
    expect(c.content.filter((n) => n.type === 'image')).toHaveLength(1);
    expect(c.content[0].attrs).toMatchObject({ legenda: 'Azul', src: pngCor(CORES[2]) });
    // acrescentar/remover foto e linha mantém o estilo
    ed.commands.addColumnAfter();
    ed.commands.addRowAfter();
    const t2 = ed.getJSON().content.find((n) => n.type === 'table');
    expect(t2.attrs.estilo).toBe('fotos');
    expect(t2.content.map((r) => r.content.length)).toEqual([4, 4, 4]);
    expect(validarDocumentoEstruturado(docCom(ed.getJSON().content)).erros).toEqual([]);
  });
});

// ─── PDF ───────────────────────────────────────────────────────────
const require_ = createRequire(import.meta.url);
let pdfjs;
beforeAll(async () => {
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require_.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
});

async function lerPdf(blob) {
  const d = await pdfjs.getDocument({ data: new Uint8Array(await bytesDe(blob)) }).promise;
  const paginas = [];
  for (let i = 1; i <= d.numPages; i++) {
    const pg = await d.getPage(i);
    const tc = await pg.getTextContent();
    const ops = await pg.getOperatorList();
    paginas.push({
      itens: tc.items.filter((x) => x.str !== undefined).map((x) => ({ s: x.str, x: x.transform[4], y: x.transform[5] })),
      imagens: ops.fnArray.filter((f) => f === pdfjs.OPS.paintImageXObject).length,
    });
  }
  return paginas;
}
const paginaCom = (paginas, re) => paginas.findIndex((p) => p.itens.some((it) => re.test(it.s)));

describe('PDF — galeria de fotos', () => {
  const desenhar = (no) => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const imagens = new Map();
    const visitar = (n) => { if (n?.type === 'image') imagens.set(n.attrs.src, n.attrs.src); (n?.content || []).forEach(visitar); };
    visitar(no);
    const { ML, CW } = __interno.MEDIDAS;
    const ctx = { pdf, medir: __interno.criarMedidor(pdf), x: ML, w: CW, tam: 10, cor: [0, 0, 0], b: false, imagens, titulos: numerarTitulos({}).titulos, legendas: numerarLegendas(no), nivelLista: 0 };
    const itens = __interno.itensBloco(ctx, no);
    const add = vi.spyOn(pdf, 'addImage');
    const line = vi.spyOn(pdf, 'line');
    const rect = vi.spyOn(pdf, 'rect');
    let y = 40;
    for (const it of itens) { it.draw(pdf, y); y += it.h; }
    return { itens, add: add.mock.calls, line: line.mock.calls, rect: rect.mock.calls, ML, CW };
  };

  it('cada foto fica dentro da sua célula (largura igual, 4 mm entre fotos), centrada; sem bordas nem fundos', () => {
    const g = galeria(
      [cel(foto(CORES[0], 'Uma')), cel(foto(CORES[1], 'Duas', { width: '50%' })), cel(foto(CORES[2]), par('Texto'))],
      [cel(foto(CORES[3])), cel(par()), cel(par())],
    );
    const { itens, add, line, rect, ML, CW } = desenhar(g);
    expect(line).toEqual([]);
    expect(rect).toEqual([]);
    expect(add).toHaveLength(4);
    const wCol = (CW - 2 * 4) / 3;
    const celula = (k) => [ML + k * (wCol + 4), ML + k * (wCol + 4) + wCol];
    const [x0, , w0] = [add[0][2], add[0][3], add[0][4]];
    expect(x0).toBeCloseTo(celula(0)[0], 3);
    expect(w0).toBeCloseTo(wCol, 3); // omissa = 100% da célula
    // 50% da célula, centrada
    expect(add[1][4]).toBeCloseTo(wCol / 2, 3);
    expect(add[1][2] + add[1][4] / 2).toBeCloseTo((celula(1)[0] + celula(1)[1]) / 2, 3);
    add.forEach((a, k) => {
      const col = k % 3;
      expect(a[2]).toBeGreaterThanOrEqual(celula(col)[0] - 0.001);
      expect(a[2] + a[4]).toBeLessThanOrEqual(celula(col)[1] + 0.001);
    });
    // duas linhas → dois itens de linha, nenhum se parte
    const linhas = itens.filter((it) => it.galeria);
    expect(linhas).toHaveLength(2);
    expect(linhas.every((it) => !it.split)).toBe(true);
  });

  it('a linha da galeria não se parte: se não couber, passa toda (fotos e legendas) para a página seguinte', async () => {
    const g = galeria([cel(foto(CORES[0], 'Esquerda')), cel(foto(CORES[1], 'Direita'))]);
    let empurrada = 0;
    // enchimentos diferentes põem a galeria em várias alturas da página, incluindo onde só caberia metade
    for (let n = 22; n <= 40; n += 2) {
      const enche = Array.from({ length: n }, (_, k) => par(`Linha de enchimento ${k + 1}.`));
      const paginas = await lerPdf(await gerarPdf(docCom([...enche, g]), { logo: null }));
      const pEsq = paginaCom(paginas, /Figura 1 — Esquerda/);
      const pFim = paginaCom(paginas, new RegExp(`Linha de enchimento ${n}\\.`));
      expect(pEsq).toBeGreaterThan(0);
      expect(paginaCom(paginas, /Figura 2 — Direita/)).toBe(pEsq);
      expect(paginas[pEsq].imagens).toBe(2);
      if (pEsq === pFim + 1) {
        empurrada++;
        expect(paginas[pFim].imagens).toBe(0);
        // na página seguinte a linha começa logo no topo do corpo
        const a = paginas[pEsq].itens.find((it) => /Figura 1/.test(it.s));
        expect(a.y).toBeGreaterThan(400);
      }
      const a = paginas[pEsq].itens.find((it) => /Figura 1/.test(it.s));
      const b = paginas[pEsq].itens.find((it) => /Figura 2/.test(it.s));
      expect(Math.abs(a.y - b.y)).toBeLessThan(0.5);
      expect(b.x).toBeGreaterThan(a.x + 50);
    }
    expect(empurrada).toBeGreaterThan(0);
  }, 60000);
});

// ─── DOCX ──────────────────────────────────────────────────────────
describe('DOCX — galeria de fotos', () => {
  let documento;
  beforeAll(async () => {
    const g = galeria([cel(foto(CORES[0], 'Norte'), par('Texto curto')), cel(foto(CORES[1], 'Sul'))], [cel(foto(CORES[2], 'Este')), cel(par())]);
    const normal = { type: 'table', attrs: { legenda: 'Normal' }, content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [par('A')] }] }, { type: 'tableRow', content: [cel(par('a'))] }] };
    const zip = await JSZip.loadAsync(await bytesDe(await gerarDocx(docCom([g, normal]), { logo: null, estimarPaginas: false })));
    documento = await zip.file('word/document.xml').async('string');
  }, 60000);

  const tabelas = () => documento.split('<w:tbl>').slice(1).map((t) => t.split('</w:tbl>')[0]);
  const daGaleria = () => tabelas().find((t) => /Norte/.test(t));

  it('sem bordas, colunas de fotos iguais, linhas que não se partem e sem cabeçalho repetido', () => {
    const t = daGaleria();
    const bordas = /<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/.exec(t)[1];
    expect(bordas).not.toMatch(/w:val="single"/);
    expect(bordas).toMatch(/w:val="none"/);
    expect((t.match(/<w:cantSplit\/>/g) || []).length).toBe(2);
    expect(t).not.toContain('<w:tblHeader');
    // colunas: as das pontas têm só a margem interior (4 mm entre fotos)
    const cols = [...t.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => Number(m[1]));
    expect(cols).toHaveLength(2);
    expect(Math.abs(cols[0] - cols[1])).toBeLessThanOrEqual(1);
    expect(cols[0] + cols[1]).toBe(9638);
  });

  it('foto à largura da célula, presa à legenda com SEQ Figure por baixo', () => {
    const t = daGaleria();
    const ext = [...t.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map((m) => Number(m[1]));
    expect(ext).toHaveLength(3);
    // largura útil da foto = (9638 − 2·113)/2 twips = 4706 twips → px (÷15) → EMU (×9525)
    const esperado = Math.round(Math.floor(4706 / 15)) * 9525;
    ext.forEach((cx) => expect(Math.abs(cx - esperado)).toBeLessThanOrEqual(9525));
    expect(t).toMatch(/<w:keepNext\/>[\s\S]*?<w:drawing>[\s\S]*?SEQ Figure \\\* ARABIC[\s\S]*?Norte/);
    expect((t.match(/SEQ Figure/g) || []).length).toBe(3);
    // a tabela normal continua com bordas, cabeçalho e «Tabela 1»
    const normal = tabelas().find((x) => />a</.test(x) || /A<\/w:t>/.test(x));
    expect(normal).toMatch(/w:val="single"/);
    expect(documento).toMatch(/SEQ Table \\\* ARABIC"><w:r><w:t xml:space="preserve">1</);
  });
});

// Amostra visual (só com AMOSTRAS_FOTOS definido): galeria 2×1 e 3×2 em PDF e DOCX.
describe.skipIf(!process.env.AMOSTRAS_FOTOS)('amostra — galeria de fotos', () => {
  it('grava PDF e DOCX', async () => {
    const dir = process.env.AMOSTRAS_FOTOS;
    const logo = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../../../../public/logo-sga.png')).toString('base64')}`;
    const f = (k, leg, w = 160, h = 110) => ({ type: 'image', attrs: { src: pngCor(CORES[k], w, h), ...(leg ? { legenda: leg } : {}) } });
    const enche = Array.from({ length: 22 }, (_, k) => par(`Parágrafo de enchimento ${k + 1} para empurrar a segunda galeria para perto do fim da página.`));
    const d = docCom([
      par('Galeria 2 × 1 (duas fotos lado a lado, com legendas):'),
      galeria([cel(f(0, 'Placa de estacionamento — lado norte')), cel(f(1, 'Placa de estacionamento — lado sul'), par('Foto tirada às 06:00.'))]),
      par('Texto a seguir à primeira galeria.'),
      ...enche,
      par('Galeria 3 × 2 (a 2.ª linha tem uma foto a 50% e uma célula vazia):'),
      galeria(
        [cel(f(2, 'Caminho de circulação A')), cel(f(3, 'Caminho de circulação B', 120, 160)), cel(f(4, 'Caminho de circulação C'))],
        [cel(f(5, 'Torre')), cel({ type: 'image', attrs: { src: pngCor(CORES[0]), width: '50%', legenda: 'Detalhe a 50%' } }), cel(par())],
      ),
      par('Fim da secção.'),
    ]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'galeria.pdf'), await bytesDe(await gerarPdf(d, { logo })));
    fs.writeFileSync(path.join(dir, 'galeria.docx'), await bytesDe(await gerarDocx(d, { logo })));
  }, 60000);
});
