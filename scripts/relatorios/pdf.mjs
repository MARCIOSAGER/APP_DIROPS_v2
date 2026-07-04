// ============================================================
// Geracao do PDF anexo dos relatorios operacionais (jsPDF, headless/Node).
// Recebe os dados ja agregados (rpc_relatorio_operacional) + helpers de formato
// e devolve o PDF como string base64 (pronto p/ anexar no email).
// ============================================================
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
// Logo SGA (versao p/ fundo claro) — carregada uma vez; fallback p/ texto se faltar.
let LOGO = null;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }
const LOGO_RATIO = 512 / 207;

// paleta (RGB)
const C = {
  primary: [30, 58, 95], accent: [37, 99, 235], sky: [14, 165, 233],
  ink: [15, 23, 42], text: [51, 65, 85], muted: [100, 116, 139],
  line: [226, 232, 240], soft: [248, 250, 252], white: [255, 255, 255],
};

export async function gerarPdf(tipo, per, dados, h) {
  const { fmt, kz, usd, pct, subtitulo, TITULOS, componentesArr } = h;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // ~595
  const PH = doc.internal.pageSize.getHeight();  // ~842
  const M = 40, CW = PW - 2 * M;
  let y = 0;

  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

  // ---------- cabecalho (papel-timbrado branco com logo SGA) ----------
  function header() {
    const topY = 30, logoH = 34, logoW = logoH * LOGO_RATIO;
    if (LOGO) {
      try { doc.addImage(LOGO, 'PNG', M, topY, logoW, logoH); }
      catch { doc.setFont('helvetica', 'bold'); doc.setFontSize(22); setText(C.primary); doc.text('SGA', M, topY + 26); }
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(22); setText(C.primary); doc.text('SGA', M, topY + 26);
    }
    // titulo + periodo (direita)
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(TITULOS[tipo] || 'Relatório de Voos', PW - M, topY + 12, { align: 'right' });
    setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(subtitulo(tipo, per), PW - M, topY + 32, { align: 'right' });
    // linha de destaque
    const lineY = topY + logoH + 12;
    setDraw(C.primary); doc.setLineWidth(2); doc.line(M, lineY, PW - M, lineY);
    y = lineY + 26;
  }
  function newPage() { doc.addPage(); header(); } // header() repõe o cabeçalho e reposiciona y
  function checkBreak(need) { if (y + need > PH - 46) { newPage(); } }

  header();

  // ---------- cards KPI ----------
  const k = dados.kpis || {};
  const cards = [
    ['TOTAL DE VOOS', fmt(k.total_voos), `${fmt(k.arr)} ARR · ${fmt(k.dep)} DEP`],
    ['PASSAGEIROS', fmt(k.passageiros), 'total transportado'],
    ['CARGA', fmt(k.carga_kg) + ' kg', 'total movimentada'],
    ['FATURAÇÃO', usd(k.faturacao_usd), 'tarifas do período (USD)'],
    ['PONTUALIDADE', pct(k.pontualidade_pct), `${fmt(k.voos_pontuais)}/${fmt(k.voos_avaliados_pont)} (ate 15 min)`],
    ['MOVIMENTOS', `${fmt(k.arr)} / ${fmt(k.dep)}`, 'chegadas / partidas'],
  ];
  const CARD_COLORS = [[37, 99, 235], [8, 145, 178], [217, 119, 6], [16, 185, 129], [124, 58, 237], [79, 70, 229]];
  const gap = 10, cwc = (CW - 2 * gap) / 3, chc = 64;
  cards.forEach((c, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = M + col * (cwc + gap), cy = y + row * (chc + gap);
    const ac = CARD_COLORS[i % CARD_COLORS.length];
    setFill(C.soft); setDraw(C.line); doc.setLineWidth(0.8);
    doc.roundedRect(x, cy, cwc, chc, 7, 7, 'FD');
    setFill(ac); doc.roundedRect(x + 10, cy + 12, 4, chc - 24, 2, 2, 'F'); // acento colorido
    setText(C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(c[0], x + 22, cy + 18);
    setText(ac); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(String(c[1]), x + 22, cy + 40);
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(String(c[2]), x + 22, cy + 54);
  });
  y += 2 * chc + gap + 24;

  // ---------- faturacao por componente ----------
  const comp = componentesArr ? componentesArr(dados.faturacao_componentes) : [];

  // ---------- titulo de seccao (mantem titulo + inicio do conteudo juntos) ----------
  function seccao(t, reserva = 60) {
    checkBreak(24 + reserva);
    setFill(C.accent); doc.rect(M, y - 9, 3.5, 14, 'F');
    setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(t, M + 10, y + 2); y += 20;
  }

  // ---------- Faturacao por Componente (barras proporcionais) ----------
  if (comp.length) {
    const totalComp = comp.reduce((s, x) => s + x.usd, 0) || 1;
    const maxUsd = Math.max(...comp.map((x) => x.usd), 1);
    const labelW = 188, valW = 118, barMax = CW - labelW - valW, rh = 19;
    seccao('Faturação por Componente', 3 * rh);
    comp.forEach((x) => {
      if (y + rh > PH - 46) { newPage(); }
      const pctv = 100 * x.usd / totalComp;
      const bw = Math.max(2, Math.round(barMax * x.usd / maxUsd));
      setText(C.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(String(x.label).slice(0, 40), M, y + 12);
      setFill(C.accent); doc.roundedRect(M + labelW, y + 4, bw, 10, 2, 2, 'F');
      setText(C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text(`${usd(x.usd)}  ·  ${pctv.toFixed(1).replace('.', ',')}%`, M + CW, y + 12, { align: 'right' });
      y += rh;
    });
    y += 18;
  }

  // ---------- tabela Por Aeroporto (cabecalho repete ao quebrar pagina) ----------
  const aeroportos = dados.por_aeroporto || [];
  if (aeroportos.length) {
    const cols = [
      { t: 'Aeroporto', w: 72, a: 'left' }, { t: 'Voos', w: 52, a: 'right' },
      { t: 'ARR', w: 48, a: 'right' }, { t: 'DEP', w: 48, a: 'right' },
      { t: 'Pax', w: 62, a: 'right' }, { t: 'Carga (kg)', w: 82, a: 'right' },
      { t: 'Faturação (USD)', w: CW - (72+52+48+48+62+82), a: 'right' },
    ];
    const rh = 20;
    const drawColHeader = () => {
      setFill(C.primary); doc.rect(M, y, CW, rh, 'F');
      setText([203, 213, 225]); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      let cx = M;
      cols.forEach((c) => { const tx = c.a === 'right' ? cx + c.w - 8 : cx + 8; doc.text(c.t.toUpperCase(), tx, y + 13, { align: c.a }); cx += c.w; });
      y += rh;
    };
    seccao('Por Aeroporto', rh + 3 * rh); // titulo + cabecalho + ~3 linhas ficam juntos
    drawColHeader();
    aeroportos.forEach((r, idx) => {
      if (y + rh > PH - 46) { newPage(); drawColHeader(); }
      if (idx % 2 === 0) { setFill(C.soft); doc.rect(M, y, CW, rh, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      const vals = [r.aeroporto, fmt(r.voos), fmt(r.arr), fmt(r.dep), fmt(r.passageiros), fmt(r.carga_kg), usd(r.faturacao_usd)];
      let cx = M;
      cols.forEach((c, ci) => {
        setText(ci === 0 ? C.ink : C.text); doc.setFont('helvetica', ci === 0 ? 'bold' : 'normal');
        const tx = c.a === 'right' ? cx + c.w - 8 : cx + 8;
        doc.text(String(vals[ci]), tx, y + 13, { align: c.a }); cx += c.w;
      });
      setDraw(C.line); doc.setLineWidth(0.5); doc.line(M, y + rh, M + CW, y + rh);
      y += rh;
    });
    // linha de TOTAL
    if (y + rh > PH - 46) { newPage(); drawColHeader(); }
    const totA = aeroportos.reduce((a, r) => ({ voos: a.voos + Number(r.voos || 0), arr: a.arr + Number(r.arr || 0), dep: a.dep + Number(r.dep || 0), pax: a.pax + Number(r.passageiros || 0), carga: a.carga + Number(r.carga_kg || 0), fat: a.fat + Number(r.faturacao_usd || 0) }), { voos: 0, arr: 0, dep: 0, pax: 0, carga: 0, fat: 0 });
    setFill([234, 240, 248]); doc.rect(M, y, CW, rh, 'F');
    const tvals = ['TOTAL', fmt(totA.voos), fmt(totA.arr), fmt(totA.dep), fmt(totA.pax), fmt(totA.carga), usd(totA.fat)];
    let cxt = M;
    cols.forEach((c, ci) => { setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); const tx = c.a === 'right' ? cxt + c.w - 8 : cxt + 8; doc.text(String(tvals[ci]), tx, y + 13, { align: c.a }); cxt += c.w; });
    y += rh + 22;
  }

  // ---------- barras (Por Tipo de Voo / Companhias) ----------
  function barras(t, itens, campo, cor) {
    if (!itens.length) return;
    const labelW = 96, valW = 46, barMax = CW - labelW - valW, rh = 18;
    seccao(t, 3 * rh);
    const max = Math.max(1, ...itens.map((i) => Number(i[campo]) || 0));
    itens.forEach((it) => {
      if (y + rh > PH - 46) { newPage(); }
      const v = Number(it[campo]) || 0, bw = Math.max(2, Math.round(barMax * v / max));
      const nome = it.tipo_voo || it.companhia || it.aeroporto || '';
      setText(C.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      doc.text(String(nome).slice(0, 22), M, y + 12);
      setFill(cor); doc.roundedRect(M + labelW, y + 3, bw, 11, 2, 2, 'F');
      setText(C.ink); doc.setFont('helvetica', 'bold'); doc.text(fmt(v), M + CW, y + 12, { align: 'right' });
      y += rh;
    });
    y += 18;
  }
  barras('Por Tipo de Voo', dados.por_tipo_voo || [], 'voos', C.accent);
  barras('Companhias com mais movimentos', (dados.por_companhia || []).slice(0, 8), 'voos', C.sky);

  // ---------- rodape em todas as paginas ----------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Gerado automaticamente pelo Sistema DIROPS — fonte: base operacional DIROPS', M, PH - 24);
    doc.text(`Página ${p}/${total}`, PW - M, PH - 24, { align: 'right' });
  }

  return Buffer.from(doc.output('arraybuffer')).toString('base64');
}
