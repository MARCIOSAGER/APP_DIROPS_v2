import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jsPDF at module level — the function imports pdfTemplate which uses jsPDF internally
vi.mock('@/lib/pdfTemplate', () => ({
  createPdfDoc: vi.fn(() => ({
    output: vi.fn((type) => type === 'datauristring' ? 'data:application/pdf;base64,AAAA' : ''),
    save: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  })),
  addHeader: vi.fn(() => 30),
  addFooter: vi.fn(),
  addTable: vi.fn(() => 50),
  addKeyValuePairs: vi.fn(() => 40),
  addSectionTitle: vi.fn(() => 35),
  addInfoBox: vi.fn(() => 40),
  checkPageBreak: vi.fn(),
  fetchEmpresaLogo: vi.fn(() => null),
  PDF: { MARGIN: 14, LINE_HEIGHT: 5, SECTION_GAP: 8 },
}));

// Mock supabase (used inside the function for logo fetch and aeroporto query)
vi.mock('@/lib/supabaseClient', () => {
  const chainable = () => {
    const obj = {
      select: vi.fn(() => obj),
      eq: vi.fn(() => obj),
      single: vi.fn(() => ({ data: null, error: null })),
      data: [],
      error: null,
    };
    // Make it thenable so await works
    obj.then = (resolve) => resolve({ data: [], error: null });
    return obj;
  };
  return {
    supabase: {
      from: vi.fn(() => chainable()),
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'test-user' } } })) },
    },
  };
});

import { gerarRelatorioFaturacaoPdf } from '../gerarProformaPdfSimples';

const baseArgs = {
  calculos: [],
  companhia: { codigo_icao: 'TEST', nome: 'Test Air' },
  aeroporto: { codigo_icao: 'FNLU' },
  periodo_inicio: '2026-01-01',
  periodo_fim: '2026-01-31',
  voos: [],
  voosLigados: [],
  proformasMap: new Map(),
  groupedByCompanhia: null,
};

describe('gerarRelatorioFaturacaoPdf — returnBase64 behavior', () => {
  it('returns { base64, filename } when returnBase64 is true', async () => {
    const result = await gerarRelatorioFaturacaoPdf({ ...baseArgs, returnBase64: true });
    expect(result).toBeDefined();
    expect(result.base64).toBeDefined();
    expect(typeof result.base64).toBe('string');
    expect(result.filename).toMatch(/Extrato_Facturacao_/);
  });

  it('returns { base64, filename } in groupedByCompanhia mode with returnBase64 true', async () => {
    const result = await gerarRelatorioFaturacaoPdf({
      ...baseArgs,
      returnBase64: true,
      groupedByCompanhia: [{ nome: 'Air Test', calculos: [] }],
    });
    expect(result).toBeDefined();
    expect(result.base64).toBeDefined();
    expect(result.filename).toMatch(/TODAS/);
  });

  it('does not return base64 when returnBase64 is false (default download path)', async () => {
    const result = await gerarRelatorioFaturacaoPdf({ ...baseArgs });
    expect(result).toBeUndefined();
  });
});
