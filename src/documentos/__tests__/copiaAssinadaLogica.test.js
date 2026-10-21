import { describe, it, expect } from 'vitest';
import {
  nomeCopiaAssinada, rotuloRevCurto, caminhoCopiaAssinada, pdfOriginalDaVersao, escolherModoCopia,
  rubricasPorEmail, linhasDaVersao, umaLinha, codigoDeSha, falta186, erro186, MENSAGEM_SEM_186,
} from '../copiaAssinadaLogica';
import {
  fundoTransparente, caixaDoTraco, ajustarDimensoes, bytesDataUrl, validarRubrica, tipoImagemAceite, LIMIAR_BRANCO,
} from '../rubricaImagem';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

describe('nome da cópia assinada', () => {
  it('código — título (Rev.NN) — assinado.pdf', () => {
    const doc = { numero: 'PR-FNLU-OPS-001', titulo: 'AP.11.001 # PR-FNLU-OPS-001 Procedimento de Pista.pdf' };
    expect(nomeCopiaAssinada(doc, { versao: 3 })).toBe('PR-FNLU-OPS-001 — Procedimento de Pista (Rev.03) — assinado.pdf');
  });
  it('sem código e com caracteres proibidos', () => {
    expect(nomeCopiaAssinada({ titulo: 'Plano: A/B?' }, { versao: 12 })).toBe('Plano- A-B- (Rev.12) — assinado.pdf');
  });
  it('rótulo curto', () => {
    expect(rotuloRevCurto({ versao: '7' })).toBe('Rev.07');
    expect(rotuloRevCurto({ versao: '2a' })).toBe('Rev.2a');
    expect(rotuloRevCurto({})).toBe('');
  });
  it('caminho no balde só com caracteres seguros', () => {
    const c = caminhoCopiaAssinada({ documentoId: 'd1', nome: 'PR — Título ção (Rev.01) — assinado.pdf', agora: new Date('2026-10-21T10:00:00Z') });
    expect(c).toMatch(/^copias-assinadas\/2026\/d1\/\d+_[A-Za-z0-9._-]+\.pdf$/);
  });
});

describe('PDF original da versão', () => {
  const fic = [
    { id: 'p1', papel: 'pdf', ronda: 1, sha256: SHA_A, created_date: '2026-10-01' },
    { id: 'p2', papel: 'pdf', ronda: 2, sha256: SHA_B, created_date: '2026-10-05' },
    { id: 'e1', papel: 'editavel', ronda: 2, sha256: 'c'.repeat(64) },
  ];
  it('o que a aprovação assinou', () => {
    const linhas = [
      { acto: 'elaboracao', ficheiro_sha256: SHA_A, assinado_em: '2026-10-02' },
      { acto: 'aprovacao', ficheiro_sha256: SHA_A, assinado_em: '2026-10-06' },
    ];
    expect(pdfOriginalDaVersao(fic, linhas).id).toBe('p1');
  });
  it('sem correspondência → ronda mais recente', () => {
    expect(pdfOriginalDaVersao(fic, []).id).toBe('p2');
  });
  it('sem PDF → null', () => {
    expect(pdfOriginalDaVersao([{ papel: 'editavel' }], [])).toBeNull();
  });
});

describe('estruturado ou ficheiro', () => {
  const conteudo = { modelo: 'POP', cabecalho: { titulo: 'X' } };
  it('rascunho gerou esta versão e o PDF é o mesmo → estruturado', () => {
    const r = escolherModoCopia({ rascunho: { versao_gerada_id: 'v1', conteudo_gerado: conteudo }, versaoId: 'v1', versaoSha: SHA_A, shaOriginal: SHA_A });
    expect(r.modo).toBe('estruturado');
    expect(r.conteudo).toBe(conteudo);
  });
  it('sha desconhecido não impede', () => {
    expect(escolherModoCopia({ rascunho: { versao_gerada_id: 'v1', conteudo }, versaoId: 'v1', shaOriginal: SHA_A }).modo).toBe('estruturado');
  });
  it('o fluxo trocou o PDF → ficheiro', () => {
    expect(escolherModoCopia({ rascunho: { versao_gerada_id: 'v1', conteudo }, versaoId: 'v1', versaoSha: SHA_A, shaOriginal: SHA_B }).modo).toBe('ficheiro');
  });
  it('rascunho de outra versão, sem rascunho ou sem conteúdo → ficheiro', () => {
    expect(escolherModoCopia({ rascunho: { versao_gerada_id: 'v2', conteudo }, versaoId: 'v1' }).modo).toBe('ficheiro');
    expect(escolherModoCopia({ rascunho: null, versaoId: 'v1' }).modo).toBe('ficheiro');
    expect(escolherModoCopia({ rascunho: { versao_gerada_id: 'v1', conteudo: {} }, versaoId: 'v1' }).modo).toBe('ficheiro');
  });
});

describe('assinaturas e rubricas', () => {
  it('rubricas por email em minúsculas, só imagens', () => {
    expect(rubricasPorEmail([{ email: 'A@SGA.co.ao', imagem: 'data:image/png;base64,xx' }, { email: 'b@x', imagem: 'lixo' }]))
      .toEqual({ 'a@sga.co.ao': 'data:image/png;base64,xx' });
  });
  it('linhas da versão, do último fluxo aprovado, por ordem do acto', () => {
    const l = [
      { versao_id: 'v1', fluxo_id: 'f1', acto: 'elaboracao', acto_ordem: 1, assinado_em: '2026-01-01' },
      { versao_id: 'v1', fluxo_id: 'f2', acto: 'aprovacao', acto_ordem: 3, assinado_em: '2026-02-03' },
      { versao_id: 'v1', fluxo_id: 'f2', acto: 'elaboracao', acto_ordem: 1, assinado_em: '2026-02-01' },
      { versao_id: 'v9', fluxo_id: 'f3', acto: 'aprovacao', acto_ordem: 3, assinado_em: '2026-03-01' },
    ];
    expect(linhasDaVersao(l, 'v1').map(x => `${x.fluxo_id}:${x.acto}`)).toEqual(['f2:elaboracao', 'f2:aprovacao']);
  });
  it('umaLinha aceita objecto, array e null', () => {
    expect(umaLinha([{ a: 1 }])).toEqual({ a: 1 });
    expect(umaLinha({ a: 1 })).toEqual({ a: 1 });
    expect(umaLinha(null)).toBeNull();
  });
  it('código de verificação 4-4-4 em maiúsculas', () => {
    expect(codigoDeSha('7f3a91c20b4d' + '0'.repeat(52))).toBe('7F3A-91C2-0B4D');
    expect(codigoDeSha('abc')).toBe('');
  });
  it('migração 186 em falta', () => {
    expect(falta186({ code: 'PGRST202', message: 'Could not find the function' })).toBe(true);
    expect(falta186({ code: '23505' })).toBe(false);
    expect(erro186({ code: '42883' }, 'x').message).toBe(MENSAGEM_SEM_186);
  });
});

// ── rubrica ─────────────────────────────────────────────────────────────────
function imagem(w, h, tinta = []) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x, y, v = 0] of tinta) { const i = (y * w + x) * 4; px[i] = v; px[i + 1] = v; px[i + 2] = v; }
  return px;
}

describe('rubrica: fundo, recorte e tamanho', () => {
  it('fundo branco fica transparente, tinta fica opaca, cinzento intermédio fica semi', () => {
    const px = imagem(3, 1, [[0, 0, 0], [1, 0, LIMIAR_BRANCO - 20]]);
    fundoTransparente(px);
    expect(px[3]).toBe(255);
    expect(px[7]).toBeGreaterThan(0);
    expect(px[7]).toBeLessThan(255);
    expect(px[11]).toBe(0);
  });
  it('caixa do traço com folga, presa aos limites', () => {
    const px = imagem(100, 50, [[10, 20], [40, 30]]);
    expect(caixaDoTraco(px, 100, 50, { folga: 5 })).toEqual({ x: 5, y: 15, w: 41, h: 21 });
    const borda = imagem(10, 10, [[0, 0], [9, 9]]);
    expect(caixaDoTraco(borda, 10, 10, { folga: 3 })).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });
  it('sem traço → null (também depois de tornar o fundo transparente)', () => {
    const px = fundoTransparente(imagem(20, 20));
    expect(caixaDoTraco(px, 20, 20)).toBeNull();
  });
  it('ajustar dimensões: cabe em 600×200 e nunca amplia', () => {
    expect(ajustarDimensoes(1200, 200)).toEqual({ w: 600, h: 100 });
    expect(ajustarDimensoes(300, 600)).toEqual({ w: 100, h: 200 });
    expect(ajustarDimensoes(100, 50)).toEqual({ w: 100, h: 50 });
  });
  it('tamanho e validação do PNG', () => {
    expect(bytesDataUrl('data:image/png;base64,AAAA')).toBe(3);
    expect(validarRubrica('data:image/jpeg;base64,AAAA')).toMatch(/PNG/);
    expect(validarRubrica(`data:image/png;base64,${'A'.repeat(300 * 1024)}`)).toMatch(/máximo/);
    expect(validarRubrica(`data:image/png;base64,${'A'.repeat(2000)}`)).toBe('');
  });
  it('tipos aceites', () => {
    expect(tipoImagemAceite({ type: 'image/png', name: 'r.png' })).toBe(true);
    expect(tipoImagemAceite({ type: '', name: 'R.JPG' })).toBe(true);
    expect(tipoImagemAceite({ type: 'image/gif', name: 'r.gif' })).toBe(false);
  });
});
