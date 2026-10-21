// Contrato v2 nos geradores: alinhamentos (incl. justificado), caixas Nota/Atenção/Aviso, legendas numeradas de
// figuras e tabelas, quebra de página e listas de 3 níveis — no PDF (texto extraído com pdf.js) e no DOCX (XML).
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { jsPDF } from 'jspdf';
import { gerarPdf } from '../gerarPdfEstruturado';
import { gerarDocx } from '../gerarDocxEstruturado';
import { exemploCompleto, IMAGEM_PISTA } from '../exemploCompleto';
import { exemploPop } from '../exemploPop';
import { validarDocumentoEstruturado } from '../contrato';
import { caixaDoNo } from '../comum';
import { bytesDe } from './amostras.test';

const logo = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../../../../public/logo-sga.png')).toString('base64')}`;
const require_ = createRequire(import.meta.url);
let pdfjs;
beforeAll(async () => {
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require_.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
});

const MM = 72 / 25.4;
const MARGEM_DIREITA_PT = 190 * MM; // ML 20 + CW 170

/** Páginas do PDF: [{ itens: [{ s, x, y, w }], ops }] (y em pt a partir de baixo). */
async function lerPdf(blob, { ops = false } = {}) {
  const d = await pdfjs.getDocument({ data: new Uint8Array(await bytesDe(blob)) }).promise;
  const paginas = [];
  for (let i = 1; i <= d.numPages; i++) {
    const pg = await d.getPage(i);
    const tc = await pg.getTextContent();
    const itens = tc.items.filter((x) => x.str !== undefined).map((x) => ({ s: x.str, x: x.transform[4], y: x.transform[5], w: x.width }));
    paginas.push({ itens, ops: ops ? await pg.getOperatorList() : null });
  }
  return paginas;
}
const paginaCom = (paginas, re) => paginas.findIndex((p) => p.itens.some((it) => re.test(it.s)));
const ultimaPaginaCom = (paginas, re) => paginas.findLastIndex((p) => p.itens.some((it) => re.test(it.s)));
const textoPagina = (p) => p.itens.map((it) => it.s).join(' ');

const xmlDe = async (blob) => {
  const zip = await JSZip.loadAsync(await bytesDe(blob));
  const ler = (f) => zip.file(f)?.async('string') ?? '';
  return { documento: await ler('word/document.xml'), numeracao: await ler('word/numbering.xml'), estilos: await ler('word/styles.xml'), definicoes: await ler('word/settings.xml') };
};

const comSeccao = (...conteudo) => ({ ...exemploPop, seccoes: [{ id: 'x', chave: 'x', titulo: 'Teste', obrigatoria: false, conteudo: { type: 'doc', content: conteudo } }] });
const enchimento = (n) => Array.from({ length: n }, (_, k) => ({ type: 'paragraph', content: [{ type: 'text', text: `Linha de enchimento ${k + 1}.` }] }));

describe('exemplo completo', () => {
  it('cumpre o contrato v2 (modo estrito)', () => {
    expect(validarDocumentoEstruturado(exemploCompleto, { estrito: true }).erros).toEqual([]);
  });
  it('caixas: tipo explícito com rótulo; documento antigo adivinha a cor e não leva rótulo', () => {
    expect(caixaDoNo({ type: 'blockquote', attrs: { tipo: 'aviso' }, content: [] })).toEqual({ tipo: 'aviso', rotulo: 'Aviso' });
    expect(caixaDoNo({ type: 'blockquote', attrs: { tipo: 'xpto' }, content: [] })).toEqual({ tipo: 'nota', rotulo: 'Nota' });
    const antigo = (txt) => ({ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: txt }] }] });
    expect(caixaDoNo(antigo('Atenção: x'))).toEqual({ tipo: 'atencao', rotulo: null });
    expect(caixaDoNo(antigo('Uma nota qualquer'))).toEqual({ tipo: 'nota', rotulo: null });
  });
});

describe('PDF — contrato v2', () => {
  let paginas;
  beforeAll(async () => { paginas = await lerPdf(await gerarPdf(exemploCompleto, { logo }), { ops: true }); }, 60000);

  it('justificado: as linhas acabam na margem direita, menos a última e a que acaba em quebra de linha', () => {
    // (o pdf.js junta as palavras de uma linha num só item)
    const pg = paginas[paginaCom(paginas, /^O presente procedimento/)];
    const ini = pg.itens.find((it) => it.s.startsWith('O presente procedimento'));
    const fim = pg.itens.find((it) => it.y < ini.y && /fixados neste documento\.$/.test(it.s));
    const ys = [...new Set(pg.itens.filter((it) => it.y <= ini.y + 0.1 && it.y >= fim.y - 0.1).map((it) => it.y.toFixed(1)))];
    expect(ys.length).toBeGreaterThanOrEqual(4);
    const direita = (y) => Math.max(...pg.itens.filter((it) => it.y.toFixed(1) === y && it.s.trim()).map((it) => it.x + it.w));
    ys.slice(0, -1).forEach((y) => expect(Math.abs(direita(y) - MARGEM_DIREITA_PT)).toBeLessThan(0.6));
    expect(MARGEM_DIREITA_PT - direita(ys[ys.length - 1])).toBeGreaterThan(20);
    // a linha antes da quebra de linha forçada não se estica
    const antesQuebra = pg.itens.find((it) => /inteira:$/.test(it.s));
    expect(MARGEM_DIREITA_PT - (antesQuebra.x + antesQuebra.w)).toBeGreaterThan(5);
  });

  it('centrado e à direita (parágrafos e títulos)', () => {
    const pg = paginas[paginaCom(paginas, /Parágrafo centrado/)];
    const linha = (re) => { const a = pg.itens.find((it) => re.test(it.s)); return pg.itens.filter((it) => Math.abs(it.y - a.y) < 0.1 && it.s.trim()); };
    const ext = (its) => [Math.min(...its.map((i) => i.x)), Math.max(...its.map((i) => i.x + i.w))];
    const [e1, d1] = ext(linha(/Parágrafo centrado/));
    expect(Math.abs((e1 + d1) / 2 - 105 * MM)).toBeLessThan(0.6);
    const [, d2] = ext(linha(/alinhado à direita —/));
    expect(Math.abs(d2 - MARGEM_DIREITA_PT)).toBeLessThan(0.6);
    const [e3, d3] = ext(linha(/Título centrado/));
    expect(Math.abs((e3 + d3) / 2 - 105 * MM)).toBeLessThan(0.6);
    expect(textoPagina(pg)).toMatch(/1\.1 Título centrado/);
    const [, d4] = ext(linha(/Subtítulo alinhado à direita/));
    expect(Math.abs(d4 - MARGEM_DIREITA_PT)).toBeLessThan(0.6);
    // sem alinhamento: à esquerda, na margem
    const [e5] = ext(linha(/Parágrafo sem alinhamento/));
    expect(Math.abs(e5 - 20 * MM)).toBeLessThan(0.6);
  });

  it('três caixas com rótulo em negrito e cores azul / âmbar / vermelho', () => {
    const pg = paginas[paginaCom(paginas, /^Nota$/)];
    for (const r of ['Nota', 'Atenção', 'Aviso']) expect(pg.itens.some((it) => it.s === r)).toBe(true);
    const cores = new Set();
    pg.ops.fnArray.forEach((fn, k) => {
      if (fn === pdfjs.OPS.setFillRGBColor) {
        const a = pg.ops.argsArray[k];
        cores.add(typeof a[0] === 'string' ? a[0].toLowerCase() : `#${Array.from(a).map((v) => Math.round(v <= 1 ? v * 255 : v).toString(16).padStart(2, '0')).join('')}`);
      }
    });
    // (o jsPDF arredonda as componentes a 3 casas: tolerância de 2 em cada uma)
    const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    const perto = (c) => [...cores].some((h) => h.length === 7 && rgb(h).every((v, k) => Math.abs(v - rgb(c)[k]) <= 2));
    for (const c of ['#2563eb', '#d97706', '#dc2626', '#eff6ff', '#fff7ed', '#fef2f2']) expect(perto(c), c).toBe(true);
  });

  it('legendas numeradas: Figura 1/2 por baixo da imagem, Tabela 1/2 por cima da tabela', () => {
    const pg = paginas[paginaCom(paginas, /^Figura 1 — /)];
    const y = (re) => pg.itens.find((it) => re.test(it.s)).y;
    expect(pg.itens.some((it) => it.s === 'Figura 1 — Pista 05/23 com a marcação de eixo e as soleiras')).toBe(true);
    expect(pg.itens.some((it) => it.s === 'Tabela 1 — Prazos de correcção por prioridade')).toBe(true);
    expect(pg.itens.some((it) => /^Figura 2 — Não conformidades/.test(it.s))).toBe(true);
    expect(pg.itens.some((it) => /^Tabela 2 — Equipas e turnos/.test(it.s))).toBe(true);
    // ordem vertical (y cresce para cima): Figura 1 > Tabela 1 > cabeçalho da tabela > Figura 2 > Tabela 2
    expect(y(/^Figura 1/)).toBeGreaterThan(y(/^Tabela 1/));
    expect(y(/^Tabela 1/)).toBeGreaterThan(y(/^Prioridade$/));
    expect(y(/^Prioridade$/)).toBeGreaterThan(y(/^Figura 2/));
    expect(y(/^Figura 2/)).toBeGreaterThan(y(/^Tabela 2/));
    // centrada (figura) e à esquerda (tabela)
    const f = pg.itens.find((it) => /^Figura 1/.test(it.s));
    expect(Math.abs(f.x + f.w / 2 - 105 * MM)).toBeLessThan(0.6);
    expect(Math.abs(pg.itens.find((it) => /^Tabela 1/.test(it.s)).x - 20 * MM)).toBeLessThan(0.6);
    // tabela sem legenda não leva número
    expect(paginas.every((p) => !p.itens.some((it) => /^Tabela 3/.test(it.s)))).toBe(true);
  });

  it('quebra de página: o que vem depois começa no topo de uma página nova', () => {
    const i = ultimaPaginaCom(paginas, /Depois da quebra de página/); // a 1.ª ocorrência é o índice
    expect(i).toBeGreaterThan(paginaCom(paginas, /^Partidas\.$/));
    const corpo = paginas[i].itens.filter((it) => it.y < 297 * MM - 30 * MM && it.y > 25 * MM && it.s.trim());
    const topo = Math.max(...corpo.map((it) => it.y));
    expect(corpo.filter((it) => it.y === topo).map((it) => it.s).join(' ')).toMatch(/4\.1|Depois da quebra/);
  });

  it('listas de 3 níveis: 1. → a) → i. e • → – → ▪, cada nível mais recuado', () => {
    const pg = paginas[paginaCom(paginas, /^Lista ordenada/)];
    const x = (s) => pg.itens.find((it) => it.s === s).x;
    expect(x('1.')).toBeLessThan(x('a)'));
    expect(x('a)')).toBeLessThan(x('i.'));
    expect(pg.itens.some((it) => it.s === 'ii.')).toBe(true);
    expect(pg.itens.some((it) => it.s === 'b)')).toBe(true);
    expect(x('•')).toBeLessThan(x('–'));
    // 3.º nível marcado: quadrado desenhado (não há texto «•» além dos 2 itens do 1.º nível)
    expect(pg.itens.filter((it) => it.s === '•').length).toBe(2);
    expect(x('Medir a profundidade.')).toBeGreaterThan(x('Fissuras e buracos.'));
  });

  it('a legenda nunca fica separada da sua imagem nem da sua tabela, em qualquer posição da página', async () => {
    const orig = jsPDF.API.addImage;
    try {
      for (let n = 34; n <= 52; n += 1) {
        const registos = [];
        jsPDF.API.addImage = function (...a) {
          if (a[0] === IMAGEM_PISTA) registos.push(this.internal.getCurrentPageInfo().pageNumber);
          return orig.apply(this, a);
        };
        const doc = comSeccao(
          ...enchimento(n),
          { type: 'image', attrs: { src: IMAGEM_PISTA, width: '80%', legenda: 'Pista' } },
          ...enchimento(3),
          { type: 'table', attrs: { legenda: 'Prazos' }, content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cab' }] }] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Linha um' }] }] }] },
          ] },
          ...enchimento(n % 7),
        );
        const pags = await lerPdf(await gerarPdf(doc, { logo: null }));
        const pagImg = registos[registos.length - 1]; // 2.ª passagem
        expect(paginaCom(pags, /^Figura 1 — Pista$/) + 1, `imagem n=${n}`).toBe(pagImg);
        expect(paginaCom(pags, /^Tabela 1 — Prazos$/), `tabela n=${n}`).toBe(paginaCom(pags, /^Linha um$/));
        expect(paginaCom(pags, /^Tabela 1 — Prazos$/), `cabeçalho n=${n}`).toBe(paginaCom(pags, /^Cab$/));
      }
    } finally {
      jsPDF.API.addImage = orig;
    }
  }, 240000);
});

describe('DOCX — contrato v2', () => {
  let x;
  beforeAll(async () => { x = await xmlDe(await gerarDocx(exemploCompleto, { logo })); }, 120000);

  it('alinhamentos: w:jc both / center / right; justificado não estica a linha antes de Shift+Enter', () => {
    expect(x.documento).toContain('<w:jc w:val="both"/>');
    expect(x.documento).toContain('<w:jc w:val="right"/>');
    expect(x.definicoes).toContain('w:doNotExpandShiftReturn');
    // o parágrafo justificado leva o jc no próprio parágrafo
    const i = x.documento.indexOf('O presente procedimento');
    const pIni = x.documento.lastIndexOf('<w:p>', i);
    expect(x.documento.slice(pIni, i)).toContain('<w:jc w:val="both"/>');
  });

  it('legendas com campo SEQ (Figure/Table) e número preenchido, na ordem certa', () => {
    const d = x.documento;
    expect(d).toMatch(/Figura <\/w:t><\/w:r><w:fldSimple w:instr="SEQ Figure \\\* ARABIC"><w:r><w:t xml:space="preserve">1<\/w:t>/);
    expect(d).toMatch(/w:instr="SEQ Figure \\\* ARABIC"><w:r><w:t xml:space="preserve">2</);
    expect(d).toMatch(/w:instr="SEQ Table \\\* ARABIC"><w:r><w:t xml:space="preserve">1</);
    expect(d).toMatch(/w:instr="SEQ Table \\\* ARABIC"><w:r><w:t xml:space="preserve">2</);
    expect((d.match(/SEQ Table/g) || []).length).toBe(2);
    // figura: a imagem vem antes da legenda; tabela: a legenda vem antes da tabela e fica presa a ela
    const iFig = d.indexOf('Pista 05/23 com a marcação');
    expect(d.lastIndexOf('<w:drawing>', iFig)).toBeGreaterThan(d.lastIndexOf('</w:tbl>', iFig));
    const iTab = d.indexOf('Prazos de correcção por prioridade');
    expect(iTab).toBeLessThan(d.indexOf('Buraco na pista'));
    expect(d.slice(d.lastIndexOf('<w:p>', iTab), iTab)).toContain('CaptionTabela');
    expect(x.estilos).toContain('w:styleId="Caption"');
    expect(x.estilos).toContain('w:styleId="CaptionTabela"');
  });

  it('quebra de página', () => {
    expect(x.documento).toContain('<w:br w:type="page"/>');
    expect(x.documento.indexOf('<w:br w:type="page"/>')).toBeLessThan(x.documento.lastIndexOf('Depois da quebra de página'));
  });

  it('caixas com rótulo e cores; a antiga sem rótulo', () => {
    const d = x.documento;
    for (const [rot, cor, fundo] of [['Nota', '2563EB', 'EFF6FF'], ['Atenção', 'D97706', 'FFF7ED'], ['Aviso', 'DC2626', 'FEF2F2']]) {
      expect(d).toMatch(new RegExp(`<w:color w:val="${cor}"/>(?:(?!</w:r>).)*<w:t xml:space="preserve">${rot}</w:t>`));
      expect(d).toContain(`w:fill="${fundo}"`);
    }
  });

  it('listas multinível reais: decimal → lowerLetter → lowerRoman e • → – → ▪', () => {
    const n = x.numeracao;
    expect(n).toMatch(/<w:lvl w:ilvl="1"[^>]*>(?:(?!<\/w:lvl>).)*<w:numFmt w:val="lowerLetter"\/>(?:(?!<\/w:lvl>).)*<w:lvlText w:val="%2\)"\/>/);
    expect(n).toMatch(/<w:lvl w:ilvl="2"[^>]*>(?:(?!<\/w:lvl>).)*<w:numFmt w:val="lowerRoman"\/>/);
    expect(n).toContain('<w:lvlText w:val="▪"/>');
    expect(n).toContain('<w:lvlText w:val="–"/>');
    expect(x.documento).toContain('<w:ilvl w:val="2"/>');
  });

  it('documento antigo (sem atributos novos) não ganha alinhamentos, legendas nem quebras', async () => {
    const { documento } = await xmlDe(await gerarDocx(exemploPop, { logo: null, estimarPaginas: false }));
    expect(documento).not.toContain('w:val="both"');
    expect(documento).not.toContain('SEQ ');
    expect(documento).not.toContain('w:type="page"');
  }, 60000);
});
