// ============================================================
// Relatório Executivo da Operação — "one-pager" para a Direção.
// Renderização jsPDF PURA (unidade pt, A4), SEM dependências de ambiente:
// recebe um `doc` jsPDF já criado + um payload e desenha tudo. É partilhado por
//   • browser → src/lib/operacionalOnePager.js  (botão "PDF Executivo")
//   • Node    → scripts/relatorios/executivo.mjs (anexo dos emails automáticos)
// Fonte de dados: rpc_relatorio_operacional (migração 060), chamado 2x
// (período atual + anterior) para os comparativos ▲/▼.
// Design aprovado: masthead + faixa de 5 stats c/ deltas, Hora de Pico (hora
// LOCAL/WAT), Pontualidade & Atrasos, top Aeroportos/Companhias, Tendência
// Mensal (MoM, meses nas linhas · variação vs mês anterior por célula).
// ============================================================

// ─── Paleta (RGB) — do mockup aprovado ───────────────────────
import { serieColorList } from './seriesColors.js';

export const OP = {
  navy: [30, 58, 95], navy2: [39, 77, 120], ink: [20, 36, 58], muted: [90, 107, 128],
  faint: [142, 160, 181], hair: [227, 233, 241], frame: [238, 242, 247], white: [255, 255, 255],
  good: [18, 120, 74], goodBg: [230, 243, 236], warn: [181, 121, 26], warnBg: [251, 241, 221],
  crit: [189, 58, 48], critBg: [251, 232, 230], amber: [208, 132, 42], track: [238, 242, 247],
  bar: [47, 94, 143],
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// ─── Formatadores (pt-PT: ponto p/ milhar, vírgula p/ decimal) — sem Intl (Node+browser) ───
export function fmt(n) {
  n = Math.round(Number(n) || 0);
  const s = Math.abs(n).toString(); const p = [];
  for (let i = s.length; i > 0; i -= 3) p.unshift(s.slice(Math.max(0, i - 3), i));
  return (n < 0 ? '-' : '') + p.join('.');
}
export function fmt1(n) {
  n = Number(n) || 0; const neg = n < 0; n = Math.abs(n);
  const r = Math.round(n * 10) / 10; const int = Math.floor(r); const dec = Math.round((r - int) * 10);
  return (neg ? '-' : '') + fmt(int) + ',' + dec;
}
const pctS = (n) => (n == null ? '—' : fmt1(n) + '%');

// ─── Deltas ──────────────────────────────────────────────────
function pctDelta(cur, prev) {
  cur = Number(cur) || 0; prev = Number(prev) || 0;
  if (!prev) return { dir: 'flat', txt: '—', raw: 0 };
  const d = (cur - prev) / prev * 100;
  return { dir: Math.abs(d) < 0.05 ? 'flat' : d > 0 ? 'up' : 'down', txt: fmt1(Math.abs(d)) + '%', raw: d };
}
function ppDelta(cur, prev) {
  if (cur == null || prev == null) return { dir: 'flat', txt: '—', raw: 0 };
  const d = Number(cur) - Number(prev);
  return { dir: Math.abs(d) < 0.05 ? 'flat' : d > 0 ? 'up' : 'down', txt: fmt1(Math.abs(d)) + ' pp', raw: d };
}

// ─── Período anterior (para os comparativos) — partilhado pelos 2 wrappers ───
// Mês-calendário completo → mês anterior (rótulo "vs maio"); senão desloca pelo
// mesmo nº de dias imediatamente antes (rótulo "vs período anterior").
export function periodoAnterior(inicio, fim) {
  const [yi, mi, di] = inicio.split('-').map(Number);
  const [yf, mf, df] = fim.split('-').map(Number);
  const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const lastDay = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  const ehMes = di === 1 && yi === yf && mi === mf && df === lastDay(yf, mf - 1);
  if (ehMes) {
    const pm0 = (mi - 2 + 12) % 12; const py = mi - 2 < 0 ? yi - 1 : yi;
    const mm = String(pm0 + 1).padStart(2, '0');
    return { inicio: `${py}-${mm}-01`, fim: `${py}-${mm}-${String(lastDay(py, pm0)).padStart(2, '0')}`, label: `vs ${MESES[pm0]}` };
  }
  const start = new Date(Date.UTC(yi, mi - 1, di)); const end = new Date(Date.UTC(yf, mf - 1, df));
  const dias = Math.round((end - start) / 86400000) + 1;
  const pe = new Date(start); pe.setUTCDate(pe.getUTCDate() - 1);
  const ps = new Date(pe); ps.setUTCDate(ps.getUTCDate() - (dias - 1));
  return { inicio: iso(ps), fim: iso(pe), label: 'vs período anterior' };
}

// ─── Rótulo do período ("01 a 30 de junho de 2026") — partilhado ───
export const dataExtenso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${String(d).padStart(2, '0')} de ${MESES[m - 1]} de ${y}`; };
export function periodoLabel(inicio, fim) {
  if (inicio === fim) return dataExtenso(inicio);
  const [yi, mi, di] = inicio.split('-').map(Number); const [yf, mf, df] = fim.split('-').map(Number);
  if (yi === yf && mi === mf) return `${String(di).padStart(2, '0')} a ${String(df).padStart(2, '0')} de ${MESES[mi - 1]} de ${yi}`;
  return `${dataExtenso(inicio)} a ${dataExtenso(fim)}`;
}

// ─── buildExecutivoPayload(atual, anterior, meta) ────────────
// atual/anterior = objetos devolvidos por rpc_relatorio_operacional.
export function buildExecutivoPayload(atual, anterior, meta = {}) {
  const k = (atual && atual.kpis) || {};
  const kp = (anterior && anterior.kpis) || {};
  const cmp = meta.comparadoCom || 'vs período anterior';

  // Faixa de 5 estatísticas com deltas
  const stats = [
    { lbl: 'Movimentos', val: fmt(k.total_voos), delta: pctDelta(k.total_voos, kp.total_voos), cmp },
    { lbl: 'Passageiros', val: fmt(k.passageiros), delta: pctDelta(k.passageiros, kp.passageiros), cmp },
    { lbl: 'Pontualidade', val: pctS(k.pontualidade_pct), good: true, delta: ppDelta(k.pontualidade_pct, kp.pontualidade_pct), cmp },
    { lbl: 'Taxa de Ocupação', val: pctS(k.load_factor_pct), delta: ppDelta(k.load_factor_pct, kp.load_factor_pct), cmp },
    { lbl: 'Carga', val: fmt1((k.carga_kg || 0) / 1000), unit: ' t', delta: pctDelta(k.carga_kg, kp.carga_kg), cmp },
  ];

  // Hora de Pico — top 8 horas por movimento, exibidas em ordem cronológica (LOCAL/WAT)
  const ph = (atual.por_hora || []).map((h) => ({ hora: Number(h.hora), mov: Number(h.movimentos) || 0, pax: Number(h.passageiros) || 0 }));
  const porMov = [...ph].sort((a, b) => b.mov - a.mov);
  const peakMax = porMov[0] || { hora: null, mov: 0 };
  const peakHours = porMov.slice(0, 8).sort((a, b) => a.hora - b.hora);

  // Pontualidade & Atrasos
  const at = k.atrasos || {};
  const aval = Number(k.voos_avaliados_pont) || 0;
  const distFaixa = (n) => ({ n: Number(n) || 0, pct: aval ? (100 * (Number(n) || 0) / aval) : 0 });
  const dist = [
    { k: 'No horário', ...distFaixa(k.voos_pontuais), cls: 'good' },
    { k: '15–30 min', ...distFaixa(at.ate_30), cls: 'warn' },
    { k: '30–60 min', ...distFaixa(at.de_30_60), cls: 'amber' },
    { k: '> 60 min', ...distFaixa(at.mais_60), cls: 'crit' },
  ];

  // Top 5 aeroportos / companhias
  const aeroportos = (atual.por_aeroporto || []).slice(0, 5).map((a) => ({
    nome: a.cidade || a.aeroporto, cod: a.aeroporto, voos: Number(a.voos) || 0,
  }));
  const companhias = (atual.por_companhia || []).slice(0, 5).map((c) => ({
    nome: c.nome || c.companhia, cod: c.companhia, voos: Number(c.voos) || 0,
  }));

  // Tendência Mensal (MoM) — últimos 6 meses; delta de cada mês vs o mês anterior da série
  const serie = atual.serie_mensal || [];
  const N = 6;
  const ini = Math.max(0, serie.length - N);
  const mom = [];
  for (let i = ini; i < serie.length; i++) {
    const r = serie[i]; const pv = serie[i - 1];
    const [, mm] = (r.mes || '').split('-').map(Number);
    mom.push({
      mesLabel: cap(MESES[(mm || 1) - 1] || r.mes),
      cur: i === serie.length - 1,
      mov: { val: fmt(r.movimentos), d: pv ? pctDelta(r.movimentos, pv.movimentos) : null },
      pax: { val: fmt(r.passageiros), d: pv ? pctDelta(r.passageiros, pv.passageiros) : null },
      carga: { val: fmt1((r.carga_kg || 0) / 1000), d: pv ? pctDelta(r.carga_kg, pv.carga_kg) : null },
      pont: { val: pctS(r.pontualidade_pct), pctNum: r.pontualidade_pct, d: pv ? ppDelta(r.pontualidade_pct, pv.pontualidade_pct) : null },
    });
  }

  return {
    titulo: meta.titulo || 'Operação Aeroportuária',
    eyebrow: 'Relatório Executivo · Direção de Operações',
    periodoLabel: meta.periodoLabel || '',
    emitido: meta.emitido || '',
    aeroportoLabel: meta.aeroportoLabel || '',
    logoDataUrl: meta.logoDataUrl || null,
    stats,
    peakHours, peakMax, permanencia: k.permanencia_media_h,
    otp: { pct: k.pontualidade_pct, atrasoMedio: k.atraso_medio_min, avaliados: aval, dist },
    aeroportos, companhias, mom,
  };
}

// ─── Render (desenha na página do jsPDF) ─────────────────────
export function renderExecutivoDoc(doc, p) {
  const W = doc.internal.pageSize.getWidth();   // ~595
  const M = 40, CW = W - 2 * M;                 // conteúdo ~515
  const sF = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const sT = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const sD = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  // corta texto a maxW (fonte/estilo já definidos), com reticências
  const ellip = (s, maxW) => {
    s = String(s == null ? '' : s);
    if (doc.getTextWidth(s) <= maxW) return s;
    while (s.length && doc.getTextWidth(s + '…') > maxW) s = s.slice(0, -1);
    return s + '…';
  };
  // Texto com tracking ancorado à DIREITA. O align:'right' do jsPDF ignora o
  // charSpace (mede a largura sem ele), então o texto vaza para fora da margem.
  // Aqui medimos a largura real (base + cs·(n-1)) e desenhamos à esquerda no x certo.
  const textRightSpaced = (s, xRight, yy, cs) => {
    doc.setCharSpace(0);
    const w = doc.getTextWidth(s) + cs * Math.max(0, s.length - 1);
    doc.setCharSpace(cs);
    doc.text(s, xRight - w, yy);
    doc.setCharSpace(0);
  };
  const deltaColor = (dir) => (dir === 'up' ? OP.good : dir === 'down' ? OP.crit : OP.faint);
  // marcador ▲/▼/— desenhado como polígono (fontes-base do jsPDF não têm os glifos)
  const marker = (x, yc, dir, s = 3.4) => {
    if (dir === 'up') doc.triangle(x, yc + s * 0.5, x + s, yc + s * 0.5, x + s / 2, yc - s * 0.55, 'F');
    else if (dir === 'down') doc.triangle(x, yc - s * 0.5, x + s, yc - s * 0.5, x + s / 2, yc + s * 0.55, 'F');
    else doc.rect(x, yc - 0.4, s, 0.8, 'F');
    return s;
  };
  // desenha [marcador][txt] terminando em xRight (align right) OU a partir de x (align left)
  const drawDelta = (d, opts) => {
    if (!d) return;
    const size = opts.size || 6.5; const col = deltaColor(d.dir);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(size); sT(col); sF(col);
    const tw = doc.getTextWidth(d.txt); const gap = 2.2; const mw = d.dir === 'flat' ? 3.4 : 3.4;
    const total = mw + gap + tw;
    const x0 = opts.align === 'right' ? opts.x - total : opts.x;
    marker(x0, opts.yc, d.dir);
    doc.text(d.txt, x0 + mw + gap, opts.yc + size * 0.34);
  };
  const h2 = (x, y, w, title, hint) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); sT(OP.navy); doc.setCharSpace(0.5);
    doc.text(title.toUpperCase(), x, y + 7); doc.setCharSpace(0);
    if (hint) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); sT(OP.faint); doc.text(hint, x + w, y + 7, { align: 'right' }); }
    sD(OP.hair); doc.setLineWidth(0.6); doc.line(x, y + 11.5, x + w, y + 11.5);
    return y + 21;
  };

  let y = 34;

  // ── Masthead ──
  if (p.logoDataUrl) {
    try {
      const pr = doc.getImageProperties(p.logoDataUrl); const ratio = pr.width / pr.height;
      let lh = 30, lw = lh * ratio; if (lw > 150) { lw = 150; lh = lw / ratio; }
      doc.addImage(p.logoDataUrl, pr.fileType || 'PNG', M, y - 2, lw, lh);
    } catch { /* sem logo */ }
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); sT(OP.faint);
  textRightSpaced(p.eyebrow.toUpperCase(), W - M, y + 4, 0.6);
  doc.setFont('times', 'bold'); doc.setFontSize(19); sT(OP.ink);
  doc.text(p.titulo, W - M, y + 19, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); sT(OP.muted);
  const metaLine = p.periodoLabel + (p.aeroportoLabel ? `  ·  ${p.aeroportoLabel}` : '') + (p.emitido ? `  ·  Emitido ${p.emitido}` : '');
  doc.text(metaLine, W - M, y + 30, { align: 'right' });
  y += 34;
  sD(OP.navy); doc.setLineWidth(1.4); doc.line(M, y, W - M, y);
  y += 14;

  // ── Faixa de 5 estatísticas ──
  const bandH = 54; const qW = CW / 5;
  sF(OP.white); sD(OP.hair); doc.setLineWidth(0.7); doc.roundedRect(M, y, CW, bandH, 4, 4, 'FD');
  for (let i = 1; i < 5; i++) { sD(OP.hair); doc.setLineWidth(0.5); doc.line(M + qW * i, y + 6, M + qW * i, y + bandH - 6); }
  p.stats.forEach((s, i) => {
    const x = M + qW * i + 11;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); sT(OP.faint); doc.setCharSpace(0.4);
    doc.text(ellip(s.lbl.toUpperCase(), qW - 18), x, y + 13); doc.setCharSpace(0);
    doc.setFont('times', 'bold'); doc.setFontSize(20); sT(s.good ? OP.good : OP.navy);
    doc.text(String(s.val), x, y + 31);
    if (s.unit) {
      const vw = doc.getTextWidth(String(s.val));
      doc.setFontSize(11); sT(OP.muted); doc.text(s.unit, x + vw + 1.5, y + 31);
    }
    drawDelta(s.delta, { x, yc: y + 44, align: 'left', size: 6.6 });
    // Largura real da variação medida na MESMA fonte (bold 6.6) usada por drawDelta:
    // marcador (3.4) + gap (2.2) + texto. Assim o "vs período anterior" não cola no "pp".
    let dw = 0;
    if (s.delta) { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); dw = 3.4 + 2.2 + doc.getTextWidth(s.delta.txt); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); sT(OP.faint);
    doc.text(s.cmp, x + dw + 4, y + 46);
  });
  y += bandH + 16;

  // ── Linha 1: Hora de Pico (esq, mais larga) + Pontualidade (dir) ──
  const gap = 22; const lW = CW * 0.56; const rW = CW - lW - gap; const rX = M + lW + gap;
  const row1Y = y;

  // Hora de Pico
  let ly = h2(M, row1Y, lW, 'Hora de Pico', 'movimentos/hora · hora local (WAT)');
  const chartTop = ly + 4, chartH = 72, baseY = chartTop + chartH;
  const bw = Math.min(26, (lW - (p.peakHours.length - 1) * 8) / Math.max(1, p.peakHours.length));
  const stepX = p.peakHours.length > 1 ? (lW - bw) / (p.peakHours.length - 1) : 0;
  const pkMax = p.peakMax.mov || 1;
  p.peakHours.forEach((hh, i) => {
    const bx = M + i * stepX;
    const bh = Math.max(3, chartH * hh.mov / pkMax);
    const isPk = hh.hora === p.peakMax.hora;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); sT(isPk ? OP.good : OP.muted);
    doc.text(fmt(hh.mov), bx + bw / 2, baseY - bh - 3, { align: 'center' });
    sF(isPk ? OP.good : OP.bar); doc.roundedRect(bx, baseY - bh, bw, bh, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); sT(OP.faint);
    doc.text(String(hh.hora).padStart(2, '0') + 'h', bx + bw / 2, baseY + 8, { align: 'center' });
  });
  let lyEnd = baseY + 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); sT(OP.muted);
  const pkH = p.peakMax.hora == null ? '—' : String(p.peakMax.hora).padStart(2, '0');
  const note = doc.splitTextToSize(`Horários em hora local de Angola (WAT = UTC+1). Pico às ${pkH}h com ${fmt(p.peakMax.mov)} movimentos.`, lW);
  doc.text(note, M, lyEnd + 2); lyEnd += 2 + note.length * 8.5;

  // Pontualidade & Atrasos
  let ry = h2(rX, row1Y, rW, 'Pontualidade & Atrasos', '');
  doc.setFont('times', 'bold'); doc.setFontSize(30); sT(OP.good);
  doc.text(pctS(p.otp.pct), rX, ry + 20);
  const bigW = doc.getTextWidth(pctS(p.otp.pct));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); sT(OP.muted);
  doc.text('no horário (±15 min)', rX + bigW + 8, ry + 6);
  doc.text(`atraso médio ${fmt1(p.otp.atrasoMedio)} min`, rX + bigW + 8, ry + 15);
  doc.text(`${fmt(p.otp.avaliados)} voos avaliados`, rX + bigW + 8, ry + 24);
  ry += 34;
  const clsColor = { good: OP.good, warn: OP.warn, amber: OP.amber, crit: OP.crit };
  const distMax = Math.max(1, ...p.otp.dist.map((d) => d.n));
  const kW = 62, nW = 74, trackX = rX + kW, trackW = rW - kW - nW;
  p.otp.dist.forEach((d) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); sT(OP.ink);
    doc.text(d.k, rX, ry + 7);
    sF(OP.track); doc.roundedRect(trackX, ry + 1.5, trackW, 8, 1.5, 1.5, 'F');
    const fw = Math.max(1.5, trackW * d.n / distMax);
    sF(clsColor[d.cls]); doc.roundedRect(trackX, ry + 1.5, fw, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); sT(OP.muted);
    doc.text(`${fmt(d.n)} · ${fmt1(d.pct)}%`, rX + rW, ry + 7, { align: 'right' });
    ry += 16.5;
  });

  y = Math.max(lyEnd, ry) + 16;

  // ── Linha 2: Top Aeroportos (esq) + Top Companhias (dir) ──
  const c2gap = 22; const cW = (CW - c2gap) / 2; const c2X = M + cW + c2gap;
  const row2Y = y;
  const ranking = (x, w, titulo, itens) => {
    let yy = h2(x, row2Y, w, titulo, 'top 5');
    const nameW = 162, valW = 38, tX = x + nameW, tW = w - nameW - valW, rh = 19;
    const max = Math.max(1, ...itens.map((i) => i.voos));
    const cores = serieColorList(itens.map((it) => it.cod || it.nome));
    itens.forEach((it, ri) => {
      // Nome com auto-ajuste: encolhe a fonte (8.4 -> 6.4) para caber INTEIRO; só corta em último caso.
      const maxNameW = nameW - 24;
      doc.setFont('helvetica', 'bold'); sT(OP.ink);
      let nmSize = 8.4;
      doc.setFontSize(nmSize);
      while (doc.getTextWidth(String(it.nome || '')) > maxNameW && nmSize > 6.4) { nmSize -= 0.3; doc.setFontSize(nmSize); }
      const nm = ellip(it.nome, maxNameW);
      doc.text(nm, x, yy + 8);
      const nmW = doc.getTextWidth(nm);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); sT(OP.faint);
      doc.text('· ' + it.cod, x + nmW + 3, yy + 8);
      sF(OP.track); doc.roundedRect(tX, yy + 2.5, tW, 8.5, 1.5, 1.5, 'F');
      sF(cores[ri]); doc.roundedRect(tX, yy + 2.5, Math.max(1.5, tW * it.voos / max), 8.5, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4); sT(OP.navy);
      doc.text(fmt(it.voos), x + w, yy + 8, { align: 'right' });
      yy += rh;
    });
    return yy;
  };
  const ae = ranking(M, cW, 'Movimentos por Aeroporto', p.aeroportos);
  const ci = ranking(c2X, cW, 'Movimentos por Companhia', p.companhias);
  y = Math.max(ae, ci) + 16;

  // ── Tendência Mensal (MoM) ──
  let my = h2(M, y, CW, 'Tendência Mensal', 'mês a mês · variação vs mês anterior · pontualidade em pp');
  const colX = [M, M + CW * 0.30, M + CW * 0.50, M + CW * 0.70, M + CW]; // Mês | Mov | Pax | Carga | Pont (bordas direitas)
  // cabeçalho de colunas
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); sT(OP.faint);
  doc.text('MÊS', M, my + 4);
  ['MOVIMENTOS', 'PASSAGEIROS', 'CARGA (T)', 'PONTUALIDADE'].forEach((t, i) => doc.text(t, colX[i + 1], my + 4, { align: 'right' }));
  my += 15;
  const rowH = 26; // linhas espaçosas: valor em cima, variação bem separada por baixo
  const pontCls = (n) => (n == null ? OP.ink : n >= 90 ? OP.good : n >= 78 ? OP.warn : OP.crit);
  p.mom.forEach((r, idx) => {
    // Sombreado alternado (zebra) para o olho seguir a linha até à direita; o mês actual leva realce mais forte.
    if (r.cur) { sF(OP.frame); doc.rect(M, my, CW, rowH, 'F'); }
    else if (idx % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(M, my, CW, rowH, 'F'); }
    sD(OP.hair); doc.setLineWidth(0.5); doc.line(M, my, M + CW, my);
    // mês
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); sT(r.cur ? OP.navy : OP.ink);
    doc.text(r.mesLabel, M, my + 13);
    // células (valor em cima, variação por baixo com folga)
    const cell = (cx, val, d, valColor) => {
      doc.setFont('helvetica', r.cur ? 'bold' : 'normal'); doc.setFontSize(9); sT(valColor || OP.ink);
      doc.text(String(val), cx, my + 12, { align: 'right' });
      if (d) drawDelta(d, { x: cx, yc: my + 20, align: 'right', size: 6.6 });
    };
    cell(colX[1], r.mov.val, r.mov.d);
    cell(colX[2], r.pax.val, r.pax.d);
    cell(colX[3], r.carga.val, r.carga.d);
    cell(colX[4], r.pont.val, r.pont.d, pontCls(r.pont.pctNum));
    my += rowH;
  });
  sD(OP.hair); doc.setLineWidth(0.5); doc.line(M, my, M + CW, my);
  y = my + 14;

  // ── Rodapé (segue o conteúdo; nunca ultrapassa a página) ──
  const H = doc.internal.pageSize.getHeight();
  const fy = Math.min(y + 6, H - 24);
  sD(OP.hair); doc.setLineWidth(0.6); doc.line(M, fy, W - M, fy);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); sT(OP.faint);
  const perm = p.permanencia != null ? `  ·  Permanência média ${fmt1(p.permanencia)} h` : '';
  doc.text(`SGA · Direção de Operações${perm}`, M, fy + 9);
  if (p.emitido) doc.text(`Emitido ${p.emitido}`, W - M, fy + 9, { align: 'right' });
  return y;
}
