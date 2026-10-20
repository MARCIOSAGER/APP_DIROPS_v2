// ============================================================
// PDF do Dashboard Operacional — espelha as secções da página inicial:
// KPIs, Top 10 Aeroportos por Volume, Tendência Mensal (MoM) e os 3 gráficos
// (Movimentos por Dia · Pontualidade · Receitas Diárias), TODOS desenhados
// nativamente em jsPDF (vetorial, nítido). É DIFERENTE do "Relatório Executivo"
// operacional (esse é o one-pager da página de Relatórios).
// Fonte de dados: os mesmos props do Dashboard (dashboardStats/serverStats/voos/
// calculos) + série mensal via rpc_relatorio_operacional.
// ============================================================
import { createPdfDoc, fetchEmpresaLogo } from '@/lib/pdfTemplate';
import { supabase } from '@/lib/supabaseClient';
import { OP, fmt, fmt1, buildExecutivoPayload } from '@/lib/operacionalOnePagerCore';
const ARR_C = [59, 130, 246];   // azul (ARR)
const DEP_C = [8, 145, 178];    // ciano (DEP)
const REV_C = [16, 185, 129];   // verde (receita)

// ─── helpers ───
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const compact = (v) => (!v ? '0' : Math.abs(v) >= 1e6 ? fmt1(v / 1e6) + 'M' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v)));
const fmtDia = (s) => { const p = String(s).split('-'); return `${p[2]}/${p[1]}`; }; // "YYYY-MM-DD" → "DD/MM"

// ─── monta o payload e renderiza ───
export async function exportDashboardPdf(opts) {
  const { dashboardStats = {}, serverStats, trends = {}, safety = {}, dias, periodoLabel = '', aeroportoLabel = '', empresaId, fileName } = opts;
  const N = Math.max(1, parseInt(dias, 10) || 30);
  const s = serverStats || dashboardStats || {};

  // KPIs (mesma lógica do DashboardStats)
  let revenue = s.totalTarifas;
  if (revenue == null) revenue = (calculos || []).filter((c) => c.tipo_tarifa !== 'Voo Isento de Tarifas').reduce((a, c) => a + (c.total_tarifa || 0), 0);
  const kpis = [
    { lbl: 'Total de Voos', val: fmt(s.totalVoos || 0), trend: trends.voos },
    { lbl: 'Chegadas (hoje)', val: fmt(s.chegadasHoje || 0) },
    { lbl: 'Partidas (hoje)', val: fmt(s.partidasHoje || 0) },
    { lbl: 'Pontualidade', val: fmt1(s.taxaPontualidade || 0) + '%', good: true },
    { lbl: 'Receita', val: compact(revenue) + ' Kz' },
    { lbl: 'Ocorrências Abertas', val: fmt(s.ocorrenciasAbertas || 0), crit: (s.ocorrenciasAbertas || 0) > 0 },
    { lbl: 'Inspeções Pendentes', val: fmt(s.inspecoesPendentes || 0) },
    { lbl: 'Passageiros', val: (s.passageirosPeriodo ? fmt1(s.passageirosPeriodo / 1000) + 'K' : '0') },
  ];

  const top10 = (dashboardStats.top10Aeroportos || []).slice(0, 10).map((a) => ({
    cod: a.codigo || a.codigo_icao || '—', cidade: a.cidade || '',
    mov: a.totalMovimentos || 0, movArr: a.movimentosArr ?? a.arr ?? 0, movDep: a.movimentosDep ?? a.dep ?? 0,
    pax: a.passageiros || 0, paxArr: a.passageirosArr || 0, paxDep: a.passageirosDep || 0,
    carga: a.carga || 0, cargaArr: a.cargaArr || 0, cargaDep: a.cargaDep || 0,
  }));

  // UMA chamada à RPC cobre o período todo: gráficos (por_dia), pontualidade (kpis)
  // e Tendência Mensal (serie_mensal). Os dados do cliente (~1000 voos) não cobrem
  // 30/90 dias, por isso o servidor é a fonte para os gráficos seguirem o filtro.
  const hoje = new Date();
  const ini = new Date(hoje); ini.setDate(ini.getDate() - (N - 1));
  let porDia = [], kpisR = {}, mom = [];
  try {
    const params = { p_inicio: isoDay(ini), p_fim: isoDay(hoje) };
    if (aeroportoLabel) params.p_aeroporto = aeroportoLabel;
    const { data } = await supabase.rpc('rpc_relatorio_operacional', params);
    const atual = Array.isArray(data) ? (data[0] || {}) : (data || {});
    porDia = atual.por_dia || [];
    kpisR = atual.kpis || {};
    mom = buildExecutivoPayload(atual, {}, {}).mom || [];
  } catch { /* período opcional */ }

  // Série DIÁRIA contínua — TODAS as datas do período (preenche 0 nos dias sem voo).
  // Os rótulos do eixo X são espaçados para caber; os DADOS são diários.
  const byDay = new Map(porDia.map((d) => [d.dia, d]));
  const movSeries = [], revSeries = [];
  for (let i = 0; i < N; i++) {
    const dd = new Date(ini); dd.setDate(dd.getDate() + i);
    const key = isoDay(dd), rec = byDay.get(key) || {}, lbl = fmtDia(key);
    movSeries.push({ label: lbl, ARR: rec.arr || 0, DEP: rec.dep || 0 });
    revSeries.push({ label: lbl, receita: rec.receita_aoa || 0 });
  }
  const at = kpisR.atrasos || {};
  const otp = { pontual: kpisR.voos_pontuais || 0, atrasado: (at.ate_30 || 0) + (at.de_30_60 || 0), muito: at.mais_60 || 0, total: kpisR.voos_avaliados_pont || 0 };
  const chartPeriodLabel = `últimos ${N} dias`;

  const logoDataUrl = await fetchEmpresaLogo(empresaId).catch(() => null);
  const emitido = new Date().toLocaleDateString('pt-AO');

  const doc = await createPdfDoc({ orientation: 'landscape', unit: 'pt' });
  renderDashboardDoc(doc, { kpis, top10, mom, movSeries, revSeries, otp, safety, periodoLabel, chartPeriodLabel, aeroportoLabel, emitido, logoDataUrl });
  doc.save(fileName || `Dashboard_Operacional_${isoDay(new Date())}.pdf`);
}

// ─── renderização ───
function renderDashboardDoc(doc, p) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40, CW = W - 2 * M;
  const sF = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const sT = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const sD = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const ellip = (str, maxW) => {
    str = String(str == null ? '' : str);
    if (doc.getTextWidth(str) <= maxW) return str;
    while (str.length && doc.getTextWidth(str + '…') > maxW) str = str.slice(0, -1);
    return str + '…';
  };
  const marker = (x, yc, dir, sz = 3.4) => {
    if (dir === 'up') doc.triangle(x, yc + sz * 0.5, x + sz, yc + sz * 0.5, x + sz / 2, yc - sz * 0.55, 'F');
    else if (dir === 'down') doc.triangle(x, yc - sz * 0.5, x + sz, yc - sz * 0.5, x + sz / 2, yc + sz * 0.55, 'F');
    else doc.rect(x, yc - 0.4, sz, 0.8, 'F');
  };
  const dCol = (dir) => (dir === 'up' ? OP.good : dir === 'down' ? OP.crit : OP.faint);
  const drawDelta = (d, x, yc, align, size = 6.4) => {
    if (!d) return;
    const col = dCol(d.dir); doc.setFont('helvetica', 'bold'); doc.setFontSize(size); sT(col); sF(col);
    const tw = doc.getTextWidth(d.txt), gap = 2.2, mw = 3.4, tot = mw + gap + tw;
    const x0 = align === 'right' ? x - tot : x;
    marker(x0, yc, d.dir); doc.text(d.txt, x0 + mw + gap, yc + size * 0.34);
  };
  const h2 = (x, y, w, title, hint) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); sT(OP.navy);
    doc.text(title.toUpperCase(), x, y + 7);
    if (hint) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); sT(OP.faint); doc.text(hint, x + w, y + 7, { align: 'right' }); }
    sD(OP.hair); doc.setLineWidth(0.6); doc.line(x, y + 11.5, x + w, y + 11.5);
    return y + 21;
  };
  const footer = (pageLabel) => {
    sD(OP.hair); doc.setLineWidth(0.6); doc.line(M, H - 30, W - M, H - 30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); sT(OP.faint);
    doc.text('SGA · Dashboard Operacional', M, H - 21);
    if (p.emitido) doc.text(`Emitido ${p.emitido}${pageLabel ? '  ·  ' + pageLabel : ''}`, W - M, H - 21, { align: 'right' });
  };

  // ── Masthead reusável (logo em TODAS as páginas) ──
  const masthead = (subtitle) => {
    let yy = 34;
    if (p.logoDataUrl) {
      try {
        const pr = doc.getImageProperties(p.logoDataUrl); const ratio = pr.width / pr.height;
        let lh = 30, lw = lh * ratio; if (lw > 150) { lw = 150; lh = lw / ratio; }
        doc.addImage(p.logoDataUrl, pr.fileType || 'PNG', M, yy - 2, lw, lh);
      } catch { /* sem logo */ }
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); sT(OP.faint);
    doc.text('DASHBOARD · DIREÇÃO DE OPERAÇÕES', W - M, yy + 4, { align: 'right' });
    doc.setFont('times', 'bold'); doc.setFontSize(19); sT(OP.ink);
    doc.text('Dashboard Operacional', W - M, yy + 19, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); sT(OP.muted);
    const meta = [subtitle, p.periodoLabel, p.aeroportoLabel, `Emitido ${p.emitido}`].filter(Boolean).join('  ·  ');
    doc.text(meta, W - M, yy + 30, { align: 'right' });
    yy += 38;
    sD(OP.navy); doc.setLineWidth(1.4); doc.line(M, yy, W - M, yy);
    return yy + 16;
  };
  let y = masthead('');
  // Paisagem tem menos altura: quebra de página automática antes de cada secção
  // que não caiba no que resta (o rodapé/numeração é aplicado no fim, a todas).
  const ensure = (need, sub = '') => { if (y + need > H - 40) { doc.addPage(); y = masthead(sub); } };

  // ── KPIs (4 × 2) ──
  y = h2(M, y, CW, 'Indicadores', p.periodoLabel);
  const cols = 4, gap = 8, cwc = (CW - gap * (cols - 1)) / cols, chc = 40;
  p.kpis.forEach((k, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = M + col * (cwc + gap), cy = y + row * (chc + gap);
    sF(OP.white); sD(OP.hair); doc.setLineWidth(0.7); doc.roundedRect(x, cy, cwc, chc, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.3); sT(OP.faint);
    doc.text(ellip(k.lbl.toUpperCase(), cwc - 14), x + 7, cy + 12);
    doc.setFont('times', 'bold'); doc.setFontSize(15); sT(k.good ? OP.good : k.crit ? OP.crit : OP.navy);
    doc.text(String(k.val), x + 7, cy + 30);
    if (k.trend && k.trend.pct != null) {
      const dir = k.trend.direction === 'up' ? 'up' : 'down';
      drawDelta({ dir, txt: fmt1(k.trend.pct) + '%' }, x + cwc - 7, cy + 27, 'right', 6.4);
    }
  });
  y += 2 * chc + gap + 16;

  // ── Safety (bloco dedicado — segue o período do filtro) ──
  const sf = p.safety || {};
  ensure(21 + 42 + 16);
  y = h2(M, y, CW, 'Safety', sf.dias ? `últimos ${sf.dias} dias · ocorrências de segurança` : 'ocorrências de segurança operacional');
  const sfCards = [
    { lbl: 'Total de Ocorrências', val: fmt(sf.total || 0), col: OP.navy },
    { lbl: 'Ocorrências Abertas', val: fmt(sf.abertas || 0), col: OP.warn },
    { lbl: 'Críticas', val: fmt(sf.criticas || 0), col: (sf.criticas || 0) > 0 ? OP.crit : OP.faint },
    { lbl: 'Resolvidas', val: fmt(sf.resolvidas || 0), col: OP.navy2 },
    { lbl: 'Taxa de Resolução', val: (sf.taxaResolucao != null ? sf.taxaResolucao : '0') + '%', col: OP.good },
  ];
  const sfN = 5, sfGap = 8, sfW = (CW - sfGap * (sfN - 1)) / sfN, sfH = 42;
  sfCards.forEach((c, i) => {
    const x = M + i * (sfW + sfGap);
    sF(OP.white); sD(OP.hair); doc.setLineWidth(0.7); doc.roundedRect(x, y, sfW, sfH, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.3); sT(OP.faint);
    doc.text(ellip(c.lbl.toUpperCase(), sfW - 12), x + 7, y + 13);
    doc.setFont('times', 'bold'); doc.setFontSize(17); sT(c.col);
    doc.text(String(c.val), x + 7, y + 33);
  });
  y += sfH + 16;

  // ── Top 10 Aeroportos por Volume (CARDS — igual ao Dashboard: mesmo estilo/cores) ──
  ensure(21 + 2 * 112 + 7 + 16);
  y = h2(M, y, CW, 'Top 10 Aeroportos por Volume', 'movimentos · passageiros · carga');
  const GRN = [22, 163, 74], PRP = [147, 51, 234], BLU = [37, 99, 235];
  const perRow = 5, cgap = 7, cw = (CW - cgap * (perRow - 1)) / perRow, ch = 112;
  p.top10.forEach((a, idx) => {
    const col = idx % perRow, row = Math.floor(idx / perRow);
    const x = M + col * (cw + cgap), cy = y + row * (ch + cgap), pad = 5, bw = cw - 2 * pad;
    // moldura do card
    sF(OP.white); sD(OP.hair); doc.setLineWidth(0.6); doc.roundedRect(x, cy, cw, ch, 3, 3, 'FD');
    // cabeçalho: #N + ICAO + cidade
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); sT([148, 163, 184]); doc.text('#' + (idx + 1), x + pad, cy + 12);
    const nW = doc.getTextWidth('#' + (idx + 1));
    doc.setFontSize(8); sT(BLU); doc.text(a.cod, x + pad + nW + 4, cy + 12);
    if (a.cidade) { doc.setFont('helvetica', 'normal'); doc.setFontSize(5.4); sT(OP.faint); doc.text(ellip(a.cidade, bw), x + pad, cy + 18.5); }
    // 3 caixas (Movimentos cinza · Passageiros azul · Carga laranja)
    const boxes = [
      { bg: [248, 250, 252], vc: [15, 23, 42], lbl: 'Movimentos:', val: fmt(a.mov), arr: a.movArr, dep: a.movDep, u: '' },
      { bg: [239, 246, 255], vc: [30, 58, 138], lbl: 'Passageiros:', val: fmt(a.pax), arr: a.paxArr, dep: a.paxDep, u: '' },
      { bg: [255, 247, 237], vc: [124, 45, 18], lbl: 'Carga Total:', val: fmt(a.carga) + ' kg', arr: a.cargaArr, dep: a.cargaDep, u: ' kg' },
    ];
    let by = cy + 23; const bh = 27;
    boxes.forEach((b) => {
      sF(b.bg); doc.roundedRect(x + pad, by, bw, bh, 2, 2, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.3); sT(OP.muted); doc.text(b.lbl, x + pad + 3, by + 7);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.3); sT(b.vc); doc.text(ellip(b.val, bw - 6), x + pad + 3, by + 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.3);
      sT(GRN); doc.text('ARR: ' + fmt(b.arr) + b.u, x + pad + 3, by + 24);
      sT(PRP); doc.text('DEP: ' + fmt(b.dep) + b.u, x + pad + bw - 3, by + 24, { align: 'right' });
      by += bh + 2;
    });
  });
  y += 2 * ch + cgap + 16;

  // ── Tendência Mensal (MoM) ──
  if (p.mom && p.mom.length) {
    ensure(21 + 9 + p.mom.length * 22 + 16);
    y = h2(M, y, CW, 'Tendência Mensal', 'mês a mês · variação vs mês anterior · pontualidade em pp');
    const colX = [M, M + CW * 0.30, M + CW * 0.50, M + CW * 0.70, M + CW];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); sT(OP.faint);
    doc.text('MÊS', M, y + 4);
    ['MOVIMENTOS', 'PASSAGEIROS', 'CARGA (T)', 'PONTUALIDADE'].forEach((tt, i) => doc.text(tt, colX[i + 1], y + 4, { align: 'right' }));
    y += 9;
    const rowH = 22;
    const pontCls = (n) => (n == null ? OP.ink : n >= 90 ? OP.good : n >= 78 ? OP.warn : OP.crit);
    p.mom.forEach((r) => {
      if (r.cur) { sF(OP.frame); doc.rect(M, y, CW, rowH, 'F'); }
      sD(OP.hair); doc.setLineWidth(0.5); doc.line(M, y, M + CW, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); sT(r.cur ? OP.navy : OP.ink);
      doc.text(r.mesLabel, M, y + 14);
      const cell = (cx, val, d, vc) => {
        doc.setFont('helvetica', r.cur ? 'bold' : 'normal'); doc.setFontSize(8.6); sT(vc || OP.ink);
        doc.text(String(val), cx, y + 11, { align: 'right' });
        if (d) drawDelta(d, cx, y + 17, 'right', 6.2);
      };
      cell(colX[1], r.mov.val, r.mov.d);
      cell(colX[2], r.pax.val, r.pax.d);
      cell(colX[3], r.carga.val, r.carga.d);
      cell(colX[4], r.pont.val, r.pont.d, pontCls(r.pont.pctNum));
      y += rowH;
    });
    sD(OP.hair); doc.setLineWidth(0.5); doc.line(M, y, M + CW, y);
  }
  // ══════════════ Gráficos (começam em página própria) ══════════════
  doc.addPage();
  y = masthead('Gráficos');

  // Movimentos por Dia (barras agrupadas ARR/DEP) — segue o período do filtro
  y = h2(M, y, CW, 'Movimentos por Dia', `${p.chartPeriodLabel} · ARR / DEP`);
  y = drawGroupedBars(y);
  y += 20;

  // Pontualidade (donut) — do período
  ensure(21 + 120);
  y = h2(M, y, CW, 'Pontualidade dos Voos', 'voos avaliados no período');
  y = drawDonutSection(y);
  y += 20;

  // Receitas Diárias (linha) — segue o período do filtro
  ensure(21 + 108);
  y = h2(M, y, CW, 'Receitas Diárias', `${p.chartPeriodLabel} · Kz`);
  y = drawLine(y);

  // rodapé + numeração em TODAS as páginas (aplicado no fim, já com o total)
  const totalP = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= totalP; pg++) { doc.setPage(pg); footer(`Página ${pg}/${totalP}`); }

  // ---- gráfico: barras agrupadas ----
  function drawGroupedBars(yTop) {
    const data = p.movSeries || [];
    const chartH = 96, baseY = yTop + chartH, plotX = M + 26, plotW = CW - 26;
    const maxV = Math.max(1, ...data.flatMap((d) => [d.ARR, d.DEP]));
    // grelha Y
    sT(OP.faint); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    for (let g = 0; g <= 4; g++) {
      const gy = baseY - (chartH * g / 4), gv = Math.round(maxV * g / 4);
      sD(OP.hair); doc.setLineWidth(0.3); doc.line(plotX, gy, M + CW, gy);
      doc.text(String(gv), plotX - 4, gy + 2, { align: 'right' });
    }
    const n = Math.max(1, data.length), slot = plotW / n;
    const bw = Math.max(1.3, Math.min(13, slot / 2 - 1.1)), off = 0.6;
    const xEvery = n <= 12 ? 1 : Math.ceil(n / 10); // rótulos (valor + data) a cada X dias
    data.forEach((d, i) => {
      const cx = plotX + slot * i + slot / 2;
      const label = i % xEvery === 0;
      [{ v: d.ARR, c: ARR_C, off: -bw - off }, { v: d.DEP, c: DEP_C, off: off }].forEach((b) => {
        const bh = Math.max(0, chartH * b.v / maxV);
        sF(b.c); doc.roundedRect(cx + b.off, baseY - bh, bw, bh, 1, 1, 'F');
        if (label && b.v > 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(n <= 12 ? 6.3 : 5.6); sT(b.c); doc.text(String(b.v), cx + b.off + bw / 2, baseY - bh - 2, { align: 'center' }); }
      });
      if (label) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); sT(OP.faint); doc.text(d.label, cx, baseY + 9, { align: 'center' }); }
    });
    // legenda
    const ly = baseY + 18; let lx = plotX;
    [['Chegadas (ARR)', ARR_C], ['Partidas (DEP)', DEP_C]].forEach(([lbl, c]) => {
      sF(c); doc.roundedRect(lx, ly - 5, 8, 8, 1, 1, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); sT(OP.muted);
      doc.text(lbl, lx + 11, ly + 1); lx += doc.getTextWidth(lbl) + 32;
    });
    return ly + 8;
  }

  // ---- gráfico: donut + distribuição ----
  function drawDonutSection(yTop) {
    const segs = [
      { k: 'No horário (±15 min)', v: p.otp.pontual, c: OP.good },
      { k: 'Atrasados (15–60 min)', v: p.otp.atrasado, c: OP.warn },
      { k: 'Muito atrasados (>60)', v: p.otp.muito, c: OP.crit },
    ];
    const total = p.otp.total || 1;
    const cx = M + 70, cy = yTop + 60, rO = 48, rI = 30;
    // segmentos
    let ang = -Math.PI / 2;
    segs.forEach((s) => {
      const sweep = (s.v / total) * Math.PI * 2;
      if (s.v > 0) {
        const a0 = ang + 0.03, a1 = ang + sweep - 0.03;
        const steps = Math.max(2, Math.ceil((a1 - a0) / 0.15)), pts = [];
        for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; pts.push([cx + rO * Math.cos(a), cy + rO * Math.sin(a)]); }
        for (let i = steps; i >= 0; i--) { const a = a0 + (a1 - a0) * i / steps; pts.push([cx + rI * Math.cos(a), cy + rI * Math.sin(a)]); }
        sF(s.c); const st = pts[0], dl = pts.slice(1).map((q, i) => [q[0] - pts[i][0], q[1] - pts[i][1]]);
        doc.lines(dl, st[0], st[1], [1, 1], 'F', true);
      }
      ang += sweep;
    });
    // centro: % pontual
    const pct = total ? (100 * p.otp.pontual / total) : 0;
    doc.setFont('times', 'bold'); doc.setFontSize(17); sT(OP.good); doc.text(fmt1(pct) + '%', cx, cy + 1, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); sT(OP.muted); doc.text('Pontuais', cx, cy + 12, { align: 'center' });
    // distribuição (direita)
    let ry = yTop + 14; const rx = M + 150, rw = CW - 150 - 4;
    const maxSeg = Math.max(1, ...segs.map((s) => s.v));
    segs.forEach((s) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); sT(OP.ink); doc.text(s.k, rx, ry + 7);
      const trackX = rx, trackY = ry + 10, trackW = rw;
      sF(OP.track); doc.roundedRect(trackX, trackY, trackW, 8, 1.5, 1.5, 'F');
      sF(s.c); doc.roundedRect(trackX, trackY, Math.max(1.5, trackW * s.v / maxSeg), 8, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); sT(OP.muted);
      doc.text(`${fmt(s.v)} · ${fmt1(total ? 100 * s.v / total : 0)}%`, rx + rw, ry + 7, { align: 'right' });
      ry += 26;
    });
    return Math.max(cy + rO, ry) + 6;
  }

  // ---- gráfico: linha (receitas) — segue o período ----
  function drawLine(yTop) {
    const data = p.revSeries || [];
    const chartH = 88, baseY = yTop + chartH, plotX = M + 34, plotW = CW - 34;
    const maxV = Math.max(1, ...data.map((d) => d.receita));
    sT(OP.faint); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    for (let g = 0; g <= 4; g++) {
      const gy = baseY - chartH * g / 4;
      sD(OP.hair); doc.setLineWidth(0.3); doc.line(plotX, gy, M + CW, gy);
      doc.text(compact(maxV * g / 4), plotX - 4, gy + 2, { align: 'right' });
    }
    const n = data.length, step = n > 1 ? plotW / (n - 1) : 0;
    const xy = data.map((d, i) => [plotX + step * i, baseY - chartH * d.receita / maxV]);
    sD(REV_C); doc.setLineWidth(2);
    for (let i = 1; i < xy.length; i++) doc.line(xy[i - 1][0], xy[i - 1][1], xy[i][0], xy[i][1]);
    const xEvery = n <= 12 ? 1 : Math.ceil(n / 9); // rótulos (valor + data) a cada X dias
    data.forEach((d, i) => {
      const [px, py] = xy[i];
      const label = i % xEvery === 0;
      sF(REV_C); doc.circle(px, py, n > 16 ? 1.6 : 2.4, 'F');
      if (label && d.receita > 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); sT([5, 150, 105]); doc.text(compact(d.receita), px, py - 5, { align: 'center' }); }
      if (label) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); sT(OP.faint); doc.text(d.label, px, baseY + 9, { align: 'center' }); }
    });
    return baseY + 14;
  }
}
