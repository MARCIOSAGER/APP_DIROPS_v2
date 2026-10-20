// Geradores PDF/DOCX dos documentos estruturados (exemplo POP + casos extremos).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { gerarPdf, limparTexto, __interno } from '../gerarPdfEstruturado';
import { gerarDocx } from '../gerarDocxEstruturado';
import { exemploPop } from '../exemploPop';
import { dataPt, rotuloRevisao, numerarTitulos, dimensoesImagem, dataUrlParaBytes } from '../comum';
import { validarDocumentoEstruturado } from '../contrato';
import { casoExtremo, tabelaGrande } from './casos';

const logo = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../../../../public/logo-sga.png')).toString('base64')}`;

const bytesDe = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(Buffer.from(r.result));
  r.onerror = rej;
  r.readAsArrayBuffer(blob);
});
const paginasPdf = (buf) => (buf.toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;
const xmlDocx = async (blob) => {
  const zip = await JSZip.loadAsync(await bytesDe(blob));
  const ficheiros = Object.keys(zip.files);
  const ler = async (re) => (await Promise.all(ficheiros.filter((f) => re.test(f)).map((f) => zip.file(f).async('string')))).join('\n');
  return { documento: await ler(/^word\/document\.xml$/), rodapes: await ler(/^word\/footer\d*\.xml$/), cabecalhos: await ler(/^word\/header\d*\.xml$/), estilos: await ler(/^word\/styles\.xml$/), ficheiros };
};

const simples = (conteudo) => ({ ...exemploPop, seccoes: [{ id: 'x', chave: 'x', titulo: 'Teste', obrigatoria: false, conteudo: { type: 'doc', content: conteudo } }] });

describe('comum', () => {
  it('formata data e revisão como nos manuais SGA', () => {
    expect(dataPt('2026-03-15')).toBe('15/03/2026');
    expect(rotuloRevisao('3', '2026-03-15')).toBe('03/26');
    expect(rotuloRevisao('01', '2025-12-31T10:00:00Z')).toBe('01/25');
  });
  it('numera secções e títulos (1., 1.1, 1.1.1)', () => {
    const { seccoes, titulos } = numerarTitulos(exemploPop);
    expect(seccoes.map((s) => s.numero)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    const proc = exemploPop.seccoes[5].conteudo.content;
    expect(titulos.get(proc[0])).toBe('6.1');
    const horarios = proc.find((n) => n.type === 'heading' && n.attrs.level === 3);
    expect(titulos.get(horarios)).toBe('6.2.1');
  });
  it('lê dimensões do PNG', () => {
    expect(dimensoesImagem(dataUrlParaBytes(logo).bytes)).toEqual({ w: 512, h: 207 });
  });
  it('o exemplo cumpre o contrato (modo estrito)', () => {
    expect(validarDocumentoEstruturado(exemploPop, { estrito: true }).erros).toEqual([]);
  });
});

describe('texto do PDF', () => {
  it('mantém os acentos portugueses e troca o que a Helvetica não tem', () => {
    expect(limparTexto('ç ã é õ º ª « » – — “x” € …')).toBe('ç ã é õ º ª « » – — “x” € …');
    expect(limparTexto('≥ 3 → ✓')).toBe('>= 3 -> v');
    expect(limparTexto('😀')).toBe('?');
  });
  it('parte palavras maiores do que a linha', async () => {
    const { jsPDF } = await import('jspdf');
    const medir = __interno.criarMedidor(new jsPDF({ unit: 'mm' }));
    const linhas = __interno.partirLinhas(medir, [{ t: 'A'.repeat(500), b: false, i: false, u: false }], 50, 10);
    expect(linhas.length).toBeGreaterThan(5);
    for (const l of linhas) expect(l.w).toBeLessThanOrEqual(50.01);
  });
});

describe('gerarPdf', () => {
  it('gera o POP de exemplo (capa + controlo + corpo)', async () => {
    const blob = await gerarPdf(exemploPop, { logo });
    expect(blob).toBeInstanceOf(Blob);
    const buf = await bytesDe(blob);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(paginasPdf(buf)).toBeGreaterThanOrEqual(4);
  }, 60000);

  it('funciona sem logo e sem opções', async () => {
    const blob = await gerarPdf(exemploPop);
    expect(blob.size).toBeGreaterThan(5000);
  }, 60000);

  it('casos extremos: secção vazia/nula, tabela de 60 linhas, nó desconhecido, texto sem espaços, imagem corrompida', async () => {
    const blob = await gerarPdf(casoExtremo(logo), { logo });
    const buf = await bytesDe(blob);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(paginasPdf(buf)).toBeGreaterThanOrEqual(5);
  }, 60000);

  it('tabela de 60 linhas sozinha parte em várias páginas', async () => {
    const um = await bytesDe(await gerarPdf(simples([{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }])));
    const sessenta = await bytesDe(await gerarPdf(simples([tabelaGrande(60)])));
    expect(paginasPdf(sessenta) - paginasPdf(um)).toBeGreaterThanOrEqual(2);
  }, 60000);

  it('aguenta documento sem secções nem histórico', async () => {
    const blob = await gerarPdf({ schema: 1, modelo: 'XX', cabecalho: {}, seccoes: [], historico: [] });
    expect(blob.size).toBeGreaterThan(1000);
  }, 60000);
});

describe('gerarDocx', () => {
  it('gera o POP de exemplo com estilos, TOC, listas reais e rodapé com PAGE/NUMPAGES', async () => {
    const blob = await gerarDocx(exemploPop, { logo });
    expect(blob).toBeInstanceOf(Blob);
    const { documento, rodapes, cabecalhos, estilos, ficheiros } = await xmlDocx(blob);
    expect(documento).toMatch(/TOC \\h \\o &quot;1-2&quot;/);
    expect(documento).toContain('PAGEREF _Toc');
    expect(documento).toContain('w:val="Heading1"');
    expect(documento).toContain('w:val="Heading2"');
    expect(documento).toContain('<w:numPr>');
    expect(documento).toContain('Inspecção diária da área de movimento');
    expect(rodapes).toContain('PAGE');
    expect(rodapes).toContain('NUMPAGES');
    expect(rodapes).toContain('Revisão n.º 01/26');
    expect(rodapes).toContain('Data: 15/03/2026');
    expect(cabecalhos).toContain('POP-FNLU-OPS-012');
    expect(ficheiros.some((f) => f.startsWith('word/media/'))).toBe(true);
    expect(estilos).toContain('w:ascii="Arial"');
  }, 120000);

  it('casos extremos não rebentam', async () => {
    const blob = await gerarDocx(casoExtremo(logo), { logo });
    const { documento } = await xmlDocx(blob);
    expect(documento).toContain('Secção sem conteúdo.');
    expect(documento).toContain('Texto dentro de um nó desconhecido');
    expect(documento).toContain('Imagem indisponível');
    expect(documento).toContain('w:tblHeader');
    expect(documento).toContain('w:gridSpan');
    expect(documento).toContain('w:vMerge');
  }, 120000);

  it('funciona sem logo e sem estimativa de páginas', async () => {
    const blob = await gerarDocx(exemploPop, { logo: null, estimarPaginas: false });
    expect(blob.size).toBeGreaterThan(3000);
  }, 120000);
});
