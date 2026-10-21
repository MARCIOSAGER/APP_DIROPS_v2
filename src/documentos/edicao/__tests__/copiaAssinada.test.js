import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PDFDocument, StandardFonts, degrees, PDFName } from '@cantoo/pdf-lib';
import {
  codigoVerificacao, urlVerificacao, assinaturasParaCapa, gerarCopiaEstruturada, gerarCopiaDeFicheiroDetalhada,
  gerarCopiaDeFicheiro, escolherCanto,
} from '../copiaAssinada';
import { exemploPop } from '../exemploPop';
import { bytesDe } from './amostras.test';

const logo = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../../../../public/logo-sga.png')).toString('base64')}`;
const require_ = createRequire(import.meta.url);
let pdfjs;
beforeAll(async () => {
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require_.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
});

const sha = async (u8) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', u8))).map(b => b.toString(16).padStart(2, '0')).join('');
const SHA_FIXO = '7f3a91c20b4d' + 'e'.repeat(52);

const linha = (acto, extra = {}) => ({
  acto, ronda: 1, fluxo_id: 'f1', nome: `Pessoa ${acto}`, signatario_email: `${acto}@sga.co.ao`,
  signatario_papel: { elaboracao: 'elaborador', revisao: 'revisor', aprovacao: 'director_aeroporto' }[acto],
  significado: `Significado ${acto}`, codigo: `COD-${acto}`, assinado_em: '2026-10-20T10:00:00Z', ...extra,
});

// ─── código e endereço ─────────────────────────────────────────────
describe('código de verificação', () => {
  it('12 primeiros hex em maiúsculas, 4-4-4', () => {
    expect(codigoVerificacao(SHA_FIXO)).toBe('7F3A-91C2-0B4D');
    expect(codigoVerificacao(SHA_FIXO.toUpperCase())).toBe('7F3A-91C2-0B4D');
  });
  it('recusa SHA-256 inválido', () => {
    expect(() => codigoVerificacao('abc')).toThrow(/SHA-256/);
    expect(() => codigoVerificacao(null)).toThrow();
  });
  it('URL /vd/<código> sem barra duplicada', () => {
    expect(urlVerificacao('https://x.sga.co.ao/', '7F3A-91C2-0B4D')).toBe('https://x.sga.co.ao/vd/7F3A-91C2-0B4D');
    expect(urlVerificacao('http://10.1.1.1', 'AAAA-BBBB-CCCC')).toBe('http://10.1.1.1/vd/AAAA-BBBB-CCCC');
  });
});

// ─── mapeamento das assinaturas ────────────────────────────────────
describe('assinaturasParaCapa', () => {
  it('mapeia os três actos com papel, rubrica por email e substituição', () => {
    const r = assinaturasParaCapa([
      linha('elaboracao'), linha('revisao'),
      linha('aprovacao', { em_substituicao_de: 'Director Titular', signatario_email: 'Supl@SGA.co.ao' }),
    ], { 'elaboracao@sga.co.ao': 'data:image/png;base64,AAA', 'supl@sga.co.ao': 'data:image/png;base64,BBB' });
    expect(Object.keys(r)).toEqual(['elaborado', 'verificado', 'aprovado']);
    expect(r.elaborado).toMatchObject({ nome: 'Pessoa elaboracao', papel: 'Elaborador', codigo: 'COD-elaboracao', rubrica: 'data:image/png;base64,AAA' });
    expect(r.verificado.rubrica).toBeUndefined();
    expect(r.aprovado).toMatchObject({ substituicao: 'Director Titular', papel: 'Director do aeroporto', rubrica: 'data:image/png;base64,BBB' });
    expect(r.aprovado.em).toBe('2026-10-20T10:00:00Z');
  });
  it('aceita rubricas em Map e ignora o que não é data URL', () => {
    const r = assinaturasParaCapa([linha('elaboracao')], new Map([['elaboracao@sga.co.ao', 'http://x/y.png']]));
    expect(r.elaborado.rubrica).toBeUndefined();
  });
  it('actos em falta ficam ausentes', () => {
    expect(assinaturasParaCapa([linha('elaboracao')])).toEqual({ elaborado: expect.any(Object) });
    expect(assinaturasParaCapa([])).toEqual({});
    expect(assinaturasParaCapa(null)).toEqual({});
  });
  it('devolução ao elaborador: na ronda final só contam os actos refeitos', () => {
    const r = assinaturasParaCapa([
      linha('elaboracao', { codigo: 'E1' }), linha('revisao', { codigo: 'R1' }),
      linha('elaboracao', { ronda: 2, codigo: 'E2', assinado_em: '2026-10-21T08:00:00Z' }),
    ]);
    expect(r.elaborado.codigo).toBe('E2');
    expect(r.verificado).toBeUndefined();      // a revisão da 1.ª volta não vale depois da devolução
  });
  it('devolução ao revisor: a elaboração da volta anterior mantém-se', () => {
    const r = assinaturasParaCapa([
      linha('elaboracao', { codigo: 'E1' }), linha('revisao', { codigo: 'R1' }),
      linha('revisao', { ronda: 2, codigo: 'R2', assinado_em: '2026-10-21T08:00:00Z' }),
      linha('aprovacao', { ronda: 2, codigo: 'A2', assinado_em: '2026-10-21T09:00:00Z' }),
    ]);
    expect([r.elaborado.codigo, r.verificado.codigo, r.aprovado.codigo]).toEqual(['E1', 'R2', 'A2']);
  });
  it('vários fluxos: fica o da assinatura mais recente; linhas inválidas não contam', () => {
    const r = assinaturasParaCapa([
      linha('elaboracao', { fluxo_id: 'antigo', codigo: 'X', assinado_em: '2026-01-01T00:00:00Z' }),
      linha('aprovacao', { fluxo_id: 'antigo', codigo: 'XA', assinado_em: '2026-01-02T00:00:00Z' }),
      linha('elaboracao', { fluxo_id: 'novo', codigo: 'N', assinado_em: '2026-10-01T00:00:00Z' }),
      linha('revisao', { fluxo_id: 'novo', codigo: 'NR', assinado_em: '2026-10-02T00:00:00Z', valida: false }),
    ]);
    expect(r.elaborado.codigo).toBe('N');
    expect(r.aprovado).toBeUndefined();
    expect(r.verificado).toBeUndefined();
  });
});

// ─── escolha do canto ──────────────────────────────────────────────
describe('escolherCanto', () => {
  const W = 595, H = 842;
  it('canto inferior direito quando está livre', () => {
    expect(escolherCanto(W, H, []).canto).toBe('inferior-direito');
  });
  it('texto no canto → canto oposto; tudo ocupado → null; fundos não contam', () => {
    const cantoID = [520, 790, 595, 842];
    expect(escolherCanto(W, H, [cantoID]).canto).toBe('inferior-esquerdo');
    const todos = [[0, 0, 80, 80], [515, 0, 595, 80], [0, 760, 80, 842], [515, 760, 595, 842]];
    expect(escolherCanto(W, H, todos)).toBeNull();
    expect(escolherCanto(W, H, [[0, 0, W, H]]).canto).toBe('inferior-direito');
  });
});

// ─── PDFs ──────────────────────────────────────────────────────────
async function pdfOriginal({ textoNoCanto = false } = {}) {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  const p1 = d.addPage([595.28, 841.89]);                       // A4 vertical
  p1.drawText('Manual de teste — página 1', { x: 60, y: 780, size: 14, font: f });
  if (textoNoCanto) p1.drawText('Página 1 de 4', { x: 500, y: 30, size: 11, font: f });
  const p2 = d.addPage([841.89, 595.28]);                       // A4 paisagem
  p2.drawText('Página em paisagem', { x: 60, y: 540, size: 14, font: f });
  const p3 = d.addPage([612, 792]);                             // Carta, rodada 90°
  p3.setRotation(degrees(90));
  p3.drawText('Página Carta rodada', { x: 60, y: 700, size: 14, font: f });
  const p4 = d.addPage([300, 300]);                             // pequena e cheia de texto
  for (let y = 5; y < 300; y += 9) p4.drawText('x'.repeat(120), { x: 0, y, size: 8, font: f });
  return d.save();
}

const assinaturasTeste = [linha('elaboracao'), linha('revisao'), linha('aprovacao')];
const qrNaPagina = (pg) => {
  const xo = pg.node.Resources()?.lookup(PDFName.of('XObject'));
  return !!xo && xo.keys().length > 0;
};

describe('gerarCopiaDeFicheiro', () => {
  it('acrescenta a folha de assinaturas, carimba o QR e trata paisagem/rotação/tamanhos', async () => {
    const orig = await pdfOriginal({ textoNoCanto: true });
    const shaO = await sha(orig);
    const r = await gerarCopiaDeFicheiroDetalhada({
      pdfOriginal: orig.buffer.slice(orig.byteOffset, orig.byteOffset + orig.byteLength),
      documento: { numero: 'MA-TEST-001', titulo: 'Manual de teste' }, versao: { versao: 3, aprovado_em: '2026-10-20T10:00:00Z' },
      linhasAssinatura: assinaturasTeste, rubricas: {}, origem: 'https://portal.sga', shaOriginal: shaO, logo, pdfjs,
    });
    expect(r.deteccao).toBe(true);
    const out = await PDFDocument.load(await bytesDe(r.blob));
    expect(out.getPageCount()).toBe(4 + 1);
    expect(out.getKeywords()).toContain(`verificacao:${codigoVerificacao(shaO)}`);
    const [p1, p2, p3, p4, folha] = out.getPages();
    expect(r.paginas.map(p => p.canto)).toEqual(['inferior-esquerdo', 'inferior-direito', 'inferior-direito', null]);
    expect(qrNaPagina(p1)).toBe(true);
    expect(qrNaPagina(p2)).toBe(true);
    expect(p2.getWidth()).toBeGreaterThan(p2.getHeight());
    expect(p3.getRotation().angle).toBe(90);
    expect(qrNaPagina(p3)).toBe(true);
    expect(qrNaPagina(p4)).toBe(false);                          // sem espaço livre: não se carimba
    expect(Math.round(folha.getWidth())).toBe(595);
    expect(qrNaPagina(folha)).toBe(true);                        // QR grande (+ logo) na folha
    // o texto da folha
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await bytesDe(r.blob)), isEvalSupported: false, verbosity: 0 }).promise;
    const tc = await (await doc.getPage(5)).getTextContent();
    const texto = tc.items.map(i => i.str).join(' ');
    expect(texto).toMatch(/FOLHA DE ASSINATURAS/);
    expect(texto).toMatch(/Assinado electronicamente/);
    expect(texto).toContain(codigoVerificacao(shaO));
    await doc.destroy();
  }, 60000);

  it('recusa o PDF que não confere com o SHA-256 do original', async () => {
    const orig = await pdfOriginal();
    await expect(gerarCopiaDeFicheiro({ pdfOriginal: orig, shaOriginal: SHA_FIXO, linhasAssinatura: assinaturasTeste, logo: null, pdfjs }))
      .rejects.toThrow(/não confere/);
  });

  it('erro claro para ficheiro danificado e para PDF encriptado', async () => {
    const lixo = new TextEncoder().encode('isto não é um pdf');
    await expect(gerarCopiaDeFicheiro({ pdfOriginal: lixo, shaOriginal: await sha(lixo), logo: null, pdfjs })).rejects.toThrow(/não é um PDF/);
    const partido = new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Catalog >>\n%%EOF');
    await expect(gerarCopiaDeFicheiro({ pdfOriginal: partido, shaOriginal: await sha(partido), logo: null, pdfjs })).rejects.toThrow(/danificado|não tem páginas/);
    const d = await PDFDocument.create();
    d.addPage();
    d.encrypt({ userPassword: 'segredo', ownerPassword: 'dono' });
    const enc = await d.save();
    await expect(gerarCopiaDeFicheiro({ pdfOriginal: enc, shaOriginal: await sha(enc), logo: null, pdfjs })).rejects.toThrow(/protegido/);
  }, 30000);

  it('sem pdf.js (detectar: false) carimba sempre no canto inferior direito', async () => {
    const orig = await pdfOriginal();
    const r = await gerarCopiaDeFicheiroDetalhada({ pdfOriginal: orig, shaOriginal: await sha(orig), linhasAssinatura: [], logo: null, detectar: false });
    expect(r.deteccao).toBe(false);
    expect(r.paginas.every(p => p.canto === 'inferior-direito')).toBe(true);
    expect((await PDFDocument.load(await bytesDe(r.blob))).getPageCount()).toBe(5);
  }, 30000);
});

describe('gerarCopiaEstruturada', () => {
  it('gera o PDF do editor com o quadro assinado e o QR', async () => {
    const blob = await gerarCopiaEstruturada({
      conteudo: exemploPop, linhasAssinatura: assinaturasTeste, rubricas: {}, origem: 'https://portal.sga', shaOriginal: SHA_FIXO, logo,
    });
    const bytes = await bytesDe(blob);
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBeGreaterThan(2);
    expect(qrNaPagina(out.getPage(0))).toBe(true);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0 }).promise;
    const texto = (await (await doc.getPage(1)).getTextContent()).items.map(i => i.str).join(' ');
    expect(texto).toContain('7F3A-91C2-0B4D');
    expect(texto).toMatch(/Assinado electronicamente/);
    expect(texto).toContain('https://portal.sga/documentos/assinatura');
    await doc.destroy();
  }, 60000);
});
