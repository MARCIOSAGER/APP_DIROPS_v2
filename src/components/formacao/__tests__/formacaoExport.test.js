import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/pdfTemplate', () => ({ createPdfDoc: vi.fn(), addHeader: vi.fn(), addFooter: vi.fn(), addSectionTitle: vi.fn(), addTable: vi.fn(), addKeyValuePairs: vi.fn(), checkPageBreak: vi.fn(), fetchEmpresaLogo: vi.fn(), loadImageAsBase64: vi.fn(), PDF: { margin: { left: 15 }, font: { body: 9 }, colors: { muted: [0, 0, 0] } } }));

const { diasTexto, nomeFicheiro, fmtDataCurta } = await import('@/lib/formacaoExport');

describe('formacaoExport — auxiliares', () => {
  const hoje = new Date('2026-09-29T12:00:00Z');
  it('descreve os dias até à validade', () => {
    expect(diasTexto('2026-10-29', hoje)).toBe('30 d');
    expect(diasTexto('2026-09-29', hoje)).toBe('expira hoje');
    expect(diasTexto('2026-09-24', hoje)).toBe('expirou há 5 d');
    expect(diasTexto(null, hoje)).toBe('');
  });
  it('gera nomes de ficheiro seguros com a data', () => {
    expect(nomeFicheiro('Alunos — Condução no Lado Ar')).toMatch(/^Alunos_Condução_no_Lado_Ar_\d{4}-\d{2}-\d{2}$/);
    expect(fmtDataCurta('2026-09-29T10:00:00Z')).toMatch(/29\/09\/2026/);
    expect(fmtDataCurta(null)).toBe('');
  });
});
