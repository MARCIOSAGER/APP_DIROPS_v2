import { describe, it, expect } from 'vitest';
import { seccaoEmNovaPagina } from '../comum';
import { gerarPdf } from '../gerarPdfEstruturado';
import { exemploPop } from '../exemploPop';
import { bytesDe } from './amostras.test';

const contarPaginas = async (blob) => {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  return (await PDFDocument.load(await bytesDe(blob))).getPageCount();
};

describe('secção principal em página nova', () => {
  it('regra por classe e forçada pelo documento', () => {
    expect(seccaoEmNovaPagina({ modelo: 'MA' })).toBe(true);
    expect(seccaoEmNovaPagina({ modelo: 'PL' })).toBe(true);
    expect(seccaoEmNovaPagina({ modelo: 'PR' })).toBe(true);
    expect(seccaoEmNovaPagina({ modelo: 'POP' })).toBe(false);
    expect(seccaoEmNovaPagina({ modelo: 'FR' })).toBe(false);
    expect(seccaoEmNovaPagina({ modelo: 'POP', opcoes: { seccaoNovaPagina: true } })).toBe(true);
    expect(seccaoEmNovaPagina({ modelo: 'MA', opcoes: { seccaoNovaPagina: false } })).toBe(false);
  });
  it('um manual tem mais páginas que o mesmo conteúdo como POP (uma por secção)', async () => {
    const logo = null;
    const pop = await contarPaginas(await gerarPdf(exemploPop, { logo }));
    const ma = await contarPaginas(await gerarPdf({ ...exemploPop, modelo: 'MA' }, { logo }));
    expect(ma).toBeGreaterThan(pop);
    // capa + controlo/índice + uma página por secção, no mínimo
    expect(ma).toBeGreaterThanOrEqual(2 + exemploPop.seccoes.length);
  }, 60000);
});
