// Relatório "Arrecadação de Pronto Pagamento" — PDF (paisagem) + HTML.
// Páginas: 1) Consolidado (KPIs + gráficos por mês)  2) Por Cliente  3) Por Banco  4) Por Aeroporto.
// Cada matriz tem uma coluna por serviço (TAV*) + Facturado/Arrecadado -14% em USD e AKZ.
import { jsPDF } from 'jspdf';

const RETENCAO = 0.14;
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
// Serviços -> colunas (ordem do dashboard). Facturado = soma de todas.
const SVC_COLS = [
  { k: 'TAV002', t: 'Abertura' }, { k: 'TAV007', t: 'Carga' }, { k: 'TAV003', t: 'Iluminação' },
  { k: 'TAV004', t: 'Estacion.' }, { k: 'TAV005', t: 'Emb.Nac.' }, { k: 'TAV006', t: 'Emb.Intl.' },
  { k: 'TAV009', t: 'Aprox.' }, { k: 'TAV001', t: 'Aterragem' },
];
const C = {
  primary: [30, 58, 95], accent: [37, 99, 235], green: [16, 133, 90], red: [200, 40, 40],
  text: [51, 65, 85], muted: [100, 116, 139], line: [226, 232, 240],
  soft: [248, 250, 252], band: [233, 236, 239], white: [255, 255, 255], head: [30, 58, 95], zebra: [247, 249, 251],
};

function grp(n, dec) { const neg = Number(n) < 0; const v = Math.abs(Number(n) || 0); const s = v.toFixed(dec); let [i, f] = s.split('.'); i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (neg ? '-' : '') + i + (dec ? (',' + f) : ''); }
const akz = (n) => grp(n, 2) + ' Kz';
const usd = (n) => 'USD ' + grp(n, 2);
const kzC = (n) => { n = Number(n) || 0; const a = Math.abs(n); if (a >= 1e6) return grp(n / 1e6, 2) + 'M Kz'; if (a >= 1e3) return grp(n / 1e3, 2) + 'K Kz'; return grp(n, 0) + ' Kz'; };
const usdC = (n) => { n = Number(n) || 0; const a = Math.abs(n); if (a >= 1e6) return '$' + grp(n / 1e6, 2) + 'M'; if (a >= 1e3) return '$' + grp(n / 1e3, 2) + 'K'; return '$' + grp(n, 2); };
const mesLabel = (ym) => { const [y, m] = ym.split('-'); return `${MESES[+m - 1].slice(0, 3).toLowerCase()}/${y}`; };
const mesNome = (ym) => { const [y, m] = ym.split('-'); return `${MESES[+m - 1]}`; };

export function agregarPP(rows) {
  const svc = new Map(), cli = new Map(), mov = new Map();
  let usdT = 0, akzT = 0;
  for (const r of rows) {
    const vu = Number(r.valor_linha) || 0, va = Number(r.valor_linha_akz) || 0;
    usdT += vu; akzT += va;
    const s = svc.get(r.servico) || { descricao: r.descricao || r.servico, qtd: 0, usd: 0, akz: 0 };
    s.qtd++; s.usd += vu; s.akz += va; svc.set(r.servico, s);
    const ck = r.nome_cliente || r.cod_cliente || '—';
    const c = cli.get(ck) || { nome: ck, movs: new Set(), usd: 0, akz: 0 };
    c.movs.add(r.num_movimento); c.usd += vu; c.akz += va; cli.set(ck, c);
    mov.set(r.num_movimento, true);
  }
  return { usdT, akzT, nMov: mov.size, nCli: cli.size, porServico: [...svc.values()].sort((a, b) => b.akz - a.akz), porCliente: [...cli.values()].map(c => ({ ...c, movs: c.movs.size })).sort((a, b) => b.akz - a.akz) };
}

export function agregarConsolidado(rows, ano) {
  // Agrupa TODOS os meses (todos os anos) para o MoM cruzar a virada de ano
  // (Janeiro compara com Dezembro do ano anterior).
  const m = new Map();
  for (const r of rows) {
    const d = r.data_movimento_d; if (!d) continue;
    const key = String(d).slice(0, 7);
    const e = m.get(key) || { mes: key, factAkz: 0, factUsd: 0 };
    e.factAkz += Number(r.valor_linha_akz) || 0; e.factUsd += Number(r.valor_linha) || 0; m.set(key, e);
  }
  const allMonths = [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  allMonths.forEach((e, i) => {
    const p = allMonths[i - 1];
    e.mom = (i > 0 && p.factAkz > 0) ? (e.factAkz - p.factAkz) / p.factAkz * 100 : null;
    e.momValAkz = i > 0 ? e.factAkz - p.factAkz : null;
    e.momValUsd = i > 0 ? e.factUsd - p.factUsd : null;
  });
  // Exibe só os meses do ano filtrado (mas o MoM já foi calculado sobre a série completa).
  const byMonth = ano ? allMonths.filter(e => e.mes.slice(0, 4) === String(ano)) : allMonths;
  return { byMonth, totalAkz: byMonth.reduce((s, e) => s + e.factAkz, 0), totalUsd: byMonth.reduce((s, e) => s + e.factUsd, 0), current: byMonth[byMonth.length - 1] || null, prev: byMonth[byMonth.length - 2] || null };
}

// Agregação anual (YoY) — todos os anos.
export function agregarAnual(rows) {
  const m = new Map();
  for (const r of rows) {
    const d = r.data_movimento_d; if (!d) continue;
    const ano = String(d).slice(0, 4);
    const e = m.get(ano) || { ano, factAkz: 0, factUsd: 0 };
    e.factAkz += Number(r.valor_linha_akz) || 0; e.factUsd += Number(r.valor_linha) || 0; m.set(ano, e);
  }
  const byYear = [...m.values()].sort((a, b) => a.ano.localeCompare(b.ano));
  byYear.forEach((e, i) => { const p = byYear[i - 1]; e.yoy = (i > 0 && p.factAkz > 0) ? (e.factAkz - p.factAkz) / p.factAkz * 100 : null; e.yoyValAkz = i > 0 ? e.factAkz - p.factAkz : null; });
  return byYear;
}

// Agregação genérica por entidade (cliente / banco / aeroporto).
export function agregarPorEntidade(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r); if (!k) continue;
    const e = m.get(k) || { nome: k, movs: new Set(), rec: {}, factUsd: 0, factAkz: 0 };
    e.movs.add(r.num_movimento);
    e.rec[r.servico] = (e.rec[r.servico] || 0) + (Number(r.valor_linha) || 0);
    e.factUsd += Number(r.valor_linha) || 0; e.factAkz += Number(r.valor_linha_akz) || 0;
    m.set(k, e);
  }
  return [...m.values()].map(e => ({ ...e, ops: e.movs.size })).sort((a, b) => b.factAkz - a.factAkz);
}

export function gerarPdfPP(rows, meta = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(); // 842 x 595
  const M = 28, CW = PW - 2 * M;
  const setF = c => doc.setFillColor(...c), setT = c => doc.setTextColor(...c), setD = c => doc.setDrawColor(...c);
  let y = 0;
  let curSub = ''; // subtítulo da seção atual (para o cabeçalho em TODAS as páginas)
  function drawHeader() {
    const topY = 22, logoH = 28;
    if (meta.logo) { try { doc.addImage(meta.logo, 'PNG', M, topY, logoH * (meta.logoRatio || 2.4), logoH); } catch { setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('SGA', M, topY + 20); } }
    else { setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('SGA', M, topY + 20); }
    setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Arrecadação de Pronto Pagamento Consolidado' + (curSub ? ` - ${curSub}` : ''), PW / 2, topY + 13, { align: 'center' });
    setT(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(meta.periodo || '', PW - M, topY + 22, { align: 'right' });
    setD(C.primary); doc.setLineWidth(1.5); doc.line(M, topY + logoH + 6, PW - M, topY + logoH + 6);
    y = topY + logoH + 6 + 14;
  }
  const newPage = () => { doc.addPage(); drawHeader(); };
  const ensure = (h) => { if (y + h > PH - 34) newPage(); };

  // ===== Página 1: Consolidado (mensal = ano do filtro; YoY = todos os anos) =====
  drawHeader();
  const src = meta.consolidadoRows || rows;
  const cons = agregarConsolidado(src, meta.anoConsolidado);
  function kpiBloco(bandLabel, fAkz, fUsd) {
    ensure(70);
    setF(C.band); doc.rect(M, y, CW, 15, 'F'); setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(bandLabel, PW / 2, y + 10, { align: 'center' }); y += 18;
    const cards = [['Arrecadado -14% (AKZ)', kzC(fAkz * (1 - RETENCAO)), C.green], ['Facturado (AKZ)', kzC(fAkz), C.accent], ['Facturado (USD)', usdC(fUsd), C.accent], ['Arrecadado -14% (USD)', usdC(fUsd * (1 - RETENCAO)), C.green]];
    const gap = 10, cw = (CW - 3 * gap) / 4, ch = 42;
    cards.forEach((c, i) => { const x = M + i * (cw + gap); setF(C.soft); setD(C.line); doc.setLineWidth(0.8); doc.roundedRect(x, y, cw, ch, 5, 5, 'FD'); setF(c[2]); doc.roundedRect(x + 8, y + 8, 3, ch - 16, 2, 2, 'F'); setT(c[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(String(c[1]), x + 16, y + 20); setT(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text(c[0], x + 16, y + 34); });
    y += ch + 10;
  }
  const primeiro = cons.byMonth[0]?.mes, ultimo = cons.byMonth[cons.byMonth.length - 1]?.mes;
  const tituloPeriodo = (primeiro && ultimo) ? (primeiro === ultimo ? mesNome(primeiro) : `${mesNome(primeiro)} até ${mesNome(ultimo)}`) : 'Período';
  kpiBloco(tituloPeriodo, cons.totalAkz, cons.totalUsd);
  if (cons.prev) kpiBloco(mesNome(cons.prev.mes), cons.prev.factAkz, cons.prev.factUsd);
  if (cons.current) kpiBloco(mesNome(cons.current.mes), cons.current.factAkz, cons.current.factUsd);

  // Por Ano (YoY) — todos os anos
  const anual = agregarAnual(src);
  if (anual.length) {
    ensure(30 + anual.length * 13);
    setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Arrecadação por Ano — variação (YoY)', M, y); y += 6; setD(C.accent); doc.setLineWidth(1.2); doc.line(M, y, M + 30, y); y += 10;
    const yBase = [90, 150, 110, 150, 120, 70], yScale = CW / yBase.reduce((a, b) => a + b, 0);
    const yc = [{ t: 'Ano', w: yBase[0] * yScale, a: 'left' }, { t: 'Facturado AKZ', w: yBase[1] * yScale, a: 'right' }, { t: 'Facturado USD', w: yBase[2] * yScale, a: 'right' }, { t: 'Arrecadado -14% AKZ', w: yBase[3] * yScale, a: 'right' }, { t: 'Variação AKZ', w: yBase[4] * yScale, a: 'right' }, { t: 'YoY %', w: yBase[5] * yScale, a: 'right' }];
    const yw = yc.reduce((s, c) => s + c.w, 0), hh = 16, rh = 13, x0 = M;
    setF(C.head); doc.rect(x0, y, yw, hh, 'F'); setT(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.3); let x = x0; yc.forEach(c => { doc.text(c.t, c.a === 'right' ? x + c.w - 4 : x + 4, y + 11, { align: c.a === 'right' ? 'right' : 'left' }); x += c.w; }); y += hh;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3);
    anual.forEach((e, i) => {
      const parcial = i === anual.length - 1;
      if (i % 2) { setF(C.zebra); doc.rect(x0, y, yw, rh, 'F'); }
      const vals = [e.ano + (parcial ? ' *' : ''), akz(e.factAkz), usd(e.factUsd), akz(e.factAkz * (1 - RETENCAO)), e.yoyValAkz == null ? '—' : (e.yoyValAkz >= 0 ? '+' : '') + kzC(e.yoyValAkz), e.yoy == null ? '—' : (e.yoy >= 0 ? '+' : '') + grp(e.yoy, 1) + '%'];
      x = x0; yc.forEach((c, ci) => { setT(ci === 5 && e.yoy != null ? (e.yoy >= 0 ? C.green : C.red) : C.text); doc.text(vals[ci], c.a === 'right' ? x + c.w - 4 : x + 4, y + 9, { align: c.a === 'right' ? 'right' : 'left' }); x += c.w; }); y += rh;
    });
    setT(C.muted); doc.setFont('helvetica', 'italic'); doc.setFontSize(6); doc.text('* ano em curso (parcial)', x0, y + 8); y += 13;
  }

  function barChart(x0, y0, w, h, title, data, valFn, isSigned) {
    setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(title, x0 + w / 2, y0, { align: 'center' });
    const plotTop = y0 + 6, plotH = h - 24, plotBot = plotTop + plotH;
    const maxV = Math.max(1, ...data.map(d => Math.abs(valFn(d))));
    const n = Math.max(1, data.length), step = w / n, bw = Math.min(30, step * 0.6), zeroY = isSigned ? plotTop + plotH / 2 : plotBot;
    if (isSigned) { setD(C.line); doc.setLineWidth(0.5); doc.line(x0, zeroY, x0 + w, zeroY); }
    data.forEach((d, i) => {
      const v = valFn(d); const bx = x0 + i * step + (step - bw) / 2; const bh = Math.abs(v) / maxV * (isSigned ? plotH / 2 : plotH) * 0.9; const neg = v < 0;
      setF(neg ? C.red : (isSigned ? C.green : C.primary)); doc.rect(bx, neg ? zeroY : zeroY - bh, bw, bh, 'F');
      setT(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.4);
      doc.text(isSigned ? ((v >= 0 ? '+' : '') + grp(v, 1) + '%') : (title.includes('USD') ? usdC(v) : kzC(v)), bx + bw / 2, (neg ? zeroY + bh + 6 : zeroY - bh - 2), { align: 'center' });
      doc.text(mesLabel(d.mes), bx + bw / 2, plotBot + 8, { align: 'center' });
    });
  }
  ensure(120); const gw = (CW - 2 * 14) / 3, gh = 110;
  barChart(M, y, gw, gh, 'Facturado por mês (AKZ)', cons.byMonth, d => d.factAkz, false);
  barChart(M + gw + 14, y, gw, gh, 'Variação MoM %', cons.byMonth.filter(d => d.mom != null), d => d.mom, true);
  barChart(M + 2 * (gw + 14), y, gw, gh, 'Facturado por mês (USD)', cons.byMonth, d => d.factUsd, false);
  y += gh + 14;

  // Tabela mensal — valores + variação MoM (Kz e %)
  {
    ensure(30 + cons.byMonth.length * 13);
    setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Facturado por Mês — variação (MoM)', M, y); y += 6;
    setD(C.accent); doc.setLineWidth(1.2); doc.line(M, y, M + 30, y); y += 10;
    const mBase = [100, 150, 110, 150, 120, 70], mScale = CW / mBase.reduce((a, b) => a + b, 0);
    const mcols = [{ t: 'Mês', w: mBase[0] * mScale, a: 'left' }, { t: 'Facturado AKZ', w: mBase[1] * mScale, a: 'right' }, { t: 'Facturado USD', w: mBase[2] * mScale, a: 'right' }, { t: 'Arrecadado -14% AKZ', w: mBase[3] * mScale, a: 'right' }, { t: 'Variação AKZ', w: mBase[4] * mScale, a: 'right' }, { t: 'MoM %', w: mBase[5] * mScale, a: 'right' }];
    const mw = mcols.reduce((s, c) => s + c.w, 0); const hh = 16, rh = 13; const x0 = M;
    setF(C.head); doc.rect(x0, y, mw, hh, 'F'); setT(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.3); let x = x0; mcols.forEach(c => { doc.text(c.t, c.a === 'right' ? x + c.w - 4 : x + 4, y + 11, { align: c.a === 'right' ? 'right' : 'left' }); x += c.w; }); y += hh;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3);
    cons.byMonth.forEach((mn, i) => {
      if (i % 2) { setF(C.zebra); doc.rect(x0, y, mw, rh, 'F'); }
      const vals = [mesNome(mn.mes), akz(mn.factAkz), usd(mn.factUsd), akz(mn.factAkz * (1 - RETENCAO)), mn.momValAkz == null ? '—' : (mn.momValAkz >= 0 ? '+' : '') + kzC(mn.momValAkz), mn.mom == null ? '—' : (mn.mom >= 0 ? '+' : '') + grp(mn.mom, 1) + '%'];
      x = x0; mcols.forEach((c, ci) => { setT(ci === 5 && mn.mom != null ? (mn.mom >= 0 ? C.green : C.red) : C.text); doc.text(vals[ci], c.a === 'right' ? x + c.w - 4 : x + 4, y + 9, { align: c.a === 'right' ? 'right' : 'left' }); x += c.w; }); y += rh;
    });
    setF([234, 239, 245]); doc.rect(x0, y, mw, rh, 'F'); setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.3); x = x0;
    const tv = ['TOTAL', akz(cons.totalAkz), usd(cons.totalUsd), akz(cons.totalAkz * (1 - RETENCAO)), '', '']; mcols.forEach((c, ci) => { doc.text(tv[ci], c.a === 'right' ? x + c.w - 4 : x + 4, y + 9, { align: c.a === 'right' ? 'right' : 'left' }); x += c.w; }); y += rh;
  }

  // ===== Matrizes =====
  const fit = (txt, wpt) => { txt = String(txt ?? ''); if (doc.getTextWidth(txt) <= wpt) return txt; let t = txt; while (t.length > 1 && doc.getTextWidth(t + '…') > wpt) t = t.slice(0, -1); return t + '…'; };
  function matriz(sub, entidades, nomeCol, CAP = 70) {
    curSub = sub; newPage();
    // colunas
    const wNome = 150, wOps = 30, wU = 52, wA = 62;
    const wSvc = (CW - wNome - wOps - 2 * wU - 2 * wA) / SVC_COLS.length;
    const cols = [{ t: nomeCol, w: wNome, a: 'left' }, { t: 'Ops', w: wOps, a: 'right' },
    ...SVC_COLS.map(s => ({ t: s.t, w: wSvc, a: 'right', svc: s.k })),
    { t: 'Fact. USD', w: wU, a: 'right' }, { t: 'Arrec. USD', w: wU, a: 'right' }, { t: 'Fact. AKZ', w: wA, a: 'right' }, { t: 'Arrec. AKZ', w: wA, a: 'right' }];
    const hh = 26, rh = 13;
    const drawHead = () => { setF(C.head); doc.rect(M, y, CW, hh, 'F'); setT(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); let x = M; cols.forEach(c => { const lines = doc.splitTextToSize(c.t, c.w - 4); lines.slice(0, 3).forEach((ln, li) => doc.text(ln, c.a === 'right' ? x + c.w - 3 : x + 3, y + 9 + li * 7, { align: c.a === 'right' ? 'right' : 'left' })); x += c.w; }); y += hh; };
    drawHead(); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3);
    const total = { ops: 0, rec: {}, factUsd: 0, factAkz: 0 };
    entidades.forEach(e => { total.ops += e.ops; total.factUsd += e.factUsd; total.factAkz += e.factAkz; SVC_COLS.forEach(s => { total.rec[s.k] = (total.rec[s.k] || 0) + (e.rec[s.k] || 0); }); });
    const show = entidades.slice(0, CAP);
    show.forEach((e, ri) => {
      if (y + rh > PH - 34) { newPage(); drawHead(); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3); }
      if (ri % 2) { setF(C.zebra); doc.rect(M, y, CW, rh, 'F'); }
      setT(C.text); let x = M;
      const cell = (c, v) => { doc.text(v, c.a === 'right' ? x + c.w - 3 : x + 3, y + 9, { align: c.a === 'right' ? 'right' : 'left' }); x += c.w; };
      cell(cols[0], fit(e.nome, wNome - 6)); cell(cols[1], String(e.ops));
      SVC_COLS.forEach((s, si) => cell(cols[2 + si], e.rec[s.k] ? grp(e.rec[s.k], 2) : ''));
      cell(cols[cols.length - 4], grp(e.factUsd, 2)); cell(cols[cols.length - 3], grp(e.factUsd * (1 - RETENCAO), 2));
      cell(cols[cols.length - 2], grp(e.factAkz, 0)); cell(cols[cols.length - 1], grp(e.factAkz * (1 - RETENCAO), 0));
      y += rh;
    });
    // total
    if (y + rh + 2 > PH - 34) { newPage(); drawHead(); }
    setF([234, 239, 245]); doc.rect(M, y, CW, rh + 2, 'F'); setT(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.3); let x = M;
    const tcell = (c, v) => { doc.text(v, c.a === 'right' ? x + c.w - 3 : x + 3, y + 10, { align: c.a === 'right' ? 'right' : 'left' }); x += c.w; };
    tcell(cols[0], entidades.length > CAP ? `TOTAL (${entidades.length} — top ${CAP})` : 'TOTAL'); tcell(cols[1], String(total.ops));
    SVC_COLS.forEach((s, si) => tcell(cols[2 + si], total.rec[s.k] ? grp(total.rec[s.k], 2) : ''));
    tcell(cols[cols.length - 4], grp(total.factUsd, 2)); tcell(cols[cols.length - 3], grp(total.factUsd * (1 - RETENCAO), 2));
    tcell(cols[cols.length - 2], grp(total.factAkz, 0)); tcell(cols[cols.length - 1], grp(total.factAkz * (1 - RETENCAO), 0));
    y += rh + 2;
  }

  matriz('Por Cliente', agregarPorEntidade(rows, r => r.nome_cliente || r.cod_cliente || null), 'Nome Cliente');
  matriz('Por Banco', agregarPorEntidade(rows, r => (r.nome_banco || '').trim() || null), 'Nome Banco');
  matriz('Por Aeroporto', agregarPorEntidade(rows, r => (r.num_movimento || '').slice(0, 4) || null), 'Aeroporto');

  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); setD(C.line); doc.setLineWidth(0.5); doc.line(M, PH - 24, PW - M, PH - 24); setT(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text('SGA  |  Pronto Pagamento  |  Arrecadado = Facturado - 14%', M, PH - 13); doc.text(`pág. ${p}/${pages}`, PW - M, PH - 13, { align: 'right' }); }
  return doc;
}

// HTML (pré-visualização + email): consolidado + matriz por cliente/banco/aeroporto.
export function htmlRelatorioPP(rows, meta = {}) {
  const src = meta.consolidadoRows || rows;
  const cons = agregarConsolidado(src, meta.anoConsolidado);
  const anual = agregarAnual(src);
  const kz = (n) => grp(n, 2) + ' Kz', us = (n) => '$' + grp(n, 2);
  const pct = (n) => (n == null ? '—' : `<span style="color:${n >= 0 ? '#10855a' : '#c82828'}">${n >= 0 ? '+' : ''}${grp(n, 1)}%</span>`);
  const card = (label, val, color) => `<td style="padding:5px" width="25%"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px"><div style="font-size:15px;font-weight:bold;color:${color}">${val}</div><div style="font-size:10px;color:#64748b;margin-top:3px">${label}</div></div></td>`;
  const bloco = (t, fAkz, fUsd) => `<div style="background:#e9ecef;border-radius:4px;padding:5px 8px;text-align:center;font-weight:bold;color:#1e3a5f;font-size:12px;margin:12px 0 2px">${t}</div><table width="100%" cellspacing="0" cellpadding="0"><tr>${card('Arrecadado -14% (AKZ)', kzC(fAkz * (1 - RETENCAO)), '#10855a')}${card('Facturado (AKZ)', kzC(fAkz), '#2563eb')}${card('Facturado (USD)', usdC(fUsd), '#2563eb')}${card('Arrecadado -14% (USD)', usdC(fUsd * (1 - RETENCAO)), '#10855a')}</tr></table>`;
  const primeiro = cons.byMonth[0]?.mes, ultimo = cons.byMonth[cons.byMonth.length - 1]?.mes;
  const tituloPeriodo = (primeiro && ultimo) ? (primeiro === ultimo ? mesNome(primeiro) : `${mesNome(primeiro)} até ${mesNome(ultimo)}`) : 'Período';
  const th = 'style="padding:6px;text-align:left;color:#fff;font-size:10px"', thr = 'style="padding:6px;text-align:right;color:#fff;font-size:10px"';
  const td = 'style="padding:5px 6px;border-bottom:1px solid #eef2f7;font-size:11px"', tdr = 'style="padding:5px 6px;border-bottom:1px solid #eef2f7;text-align:right;font-size:11px"';
  const momV = (v) => v == null ? '—' : (v >= 0 ? '+' : '') + kzC(v);
  const tblAno = `<h3 style="color:#1e3a5f;font-size:14px;margin:18px 0 6px">Arrecadação por Ano — variação (YoY)</h3>
    <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:6px;border-collapse:collapse">
      <tr style="background:#1e3a5f"><td ${'style="padding:6px;text-align:left;color:#fff;font-size:10px"'}>Ano</td><td ${'style="padding:6px;text-align:right;color:#fff;font-size:10px"'}>Facturado AKZ</td><td ${'style="padding:6px;text-align:right;color:#fff;font-size:10px"'}>Facturado USD</td><td ${'style="padding:6px;text-align:right;color:#fff;font-size:10px"'}>Arrecadado -14% AKZ</td><td ${'style="padding:6px;text-align:right;color:#fff;font-size:10px"'}>Variação AKZ</td><td ${'style="padding:6px;text-align:right;color:#fff;font-size:10px"'}>YoY%</td></tr>
      ${anual.map((e, i) => `<tr><td ${'style="padding:5px 6px;border-bottom:1px solid #eef2f7;font-size:11px;font-weight:bold"'}>${e.ano}${i === anual.length - 1 ? ' <span style="color:#94a3b8">*</span>' : ''}</td><td ${'style="padding:5px 6px;border-bottom:1px solid #eef2f7;text-align:right;font-size:11px"'}>${kz(e.factAkz)}</td><td ${'style="padding:5px 6px;border-bottom:1px solid #eef2f7;text-align:right;font-size:11px"'}>${us(e.factUsd)}</td><td ${'style="padding:5px 6px;border-bottom:1px solid #eef2f7;text-align:right;font-size:11px"'}>${kz(e.factAkz * (1 - RETENCAO))}</td><td ${'style="padding:5px 6px;border-bottom:1px solid #eef2f7;text-align:right;font-size:11px"'}>${momV(e.yoyValAkz)}</td><td ${'style="padding:5px 6px;border-bottom:1px solid #eef2f7;text-align:right;font-size:11px"'}>${pct(e.yoy)}</td></tr>`).join('')}
    </table><p style="color:#94a3b8;font-size:10px;margin:4px 0 0">* ano em curso (parcial)</p>`;
  const tblMes = `<h3 style="color:#1e3a5f;font-size:14px;margin:18px 0 6px">Facturado por Mês — variação (MoM)</h3>
    <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:6px;border-collapse:collapse">
      <tr style="background:#1e3a5f"><td ${th}>Mês</td><td ${thr}>Facturado AKZ</td><td ${thr}>Facturado USD</td><td ${thr}>Arrecadado -14% AKZ</td><td ${thr}>Variação AKZ</td><td ${thr}>MoM%</td></tr>
      ${cons.byMonth.map(m => `<tr><td ${td}>${mesNome(m.mes)}</td><td ${tdr}>${kz(m.factAkz)}</td><td ${tdr}>${us(m.factUsd)}</td><td ${tdr}>${kz(m.factAkz * (1 - RETENCAO))}</td><td ${tdr}>${momV(m.momValAkz)}</td><td ${tdr}>${pct(m.mom)}</td></tr>`).join('')}
      <tr style="background:#eef2f7;font-weight:bold"><td ${td}>TOTAL</td><td ${tdr}>${kz(cons.totalAkz)}</td><td ${tdr}>${us(cons.totalUsd)}</td><td ${tdr}>${kz(cons.totalAkz * (1 - RETENCAO))}</td><td ${tdr}></td><td ${tdr}></td></tr>
    </table>`;
  const matrizHtml = (titulo, ents, nomeCol) => {
    const total = { ops: 0, rec: {}, factUsd: 0, factAkz: 0 };
    ents.forEach(e => { total.ops += e.ops; total.factUsd += e.factUsd; total.factAkz += e.factAkz; SVC_COLS.forEach(s => total.rec[s.k] = (total.rec[s.k] || 0) + (e.rec[s.k] || 0)); });
    const head = `<tr style="background:#1e3a5f"><td ${th}>${nomeCol}</td><td ${thr}>Ops</td>${SVC_COLS.map(s => `<td ${thr}>${s.t}</td>`).join('')}<td ${thr}>Fact. USD</td><td ${thr}>Arrec. USD</td><td ${thr}>Fact. AKZ</td><td ${thr}>Arrec. AKZ</td></tr>`;
    const row = (e) => `<tr><td ${td}>${e.nome}</td><td ${tdr}>${e.ops}</td>${SVC_COLS.map(s => `<td ${tdr}>${e.rec[s.k] ? us(e.rec[s.k]) : ''}</td>`).join('')}<td ${tdr}>${us(e.factUsd)}</td><td ${tdr}>${us(e.factUsd * (1 - RETENCAO))}</td><td ${tdr}>${grp(e.factAkz, 0)} Kz</td><td ${tdr}>${grp(e.factAkz * (1 - RETENCAO), 0)} Kz</td></tr>`;
    const totRow = `<tr style="background:#eef2f7;font-weight:bold"><td ${td}>TOTAL</td><td ${tdr}>${total.ops}</td>${SVC_COLS.map(s => `<td ${tdr}>${total.rec[s.k] ? us(total.rec[s.k]) : ''}</td>`).join('')}<td ${tdr}>${us(total.factUsd)}</td><td ${tdr}>${us(total.factUsd * (1 - RETENCAO))}</td><td ${tdr}>${grp(total.factAkz, 0)} Kz</td><td ${tdr}>${grp(total.factAkz * (1 - RETENCAO), 0)} Kz</td></tr>`;
    return `<h3 style="color:#1e3a5f;font-size:14px;margin:18px 0 6px">${titulo}</h3><div style="overflow-x:auto"><table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:6px;border-collapse:collapse;min-width:900px">${head}${ents.slice(0, 60).map(row).join('')}${totRow}</table></div>`;
  };
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:1100px;margin:0 auto;padding:16px">
    <table width="100%" cellspacing="0" cellpadding="0" style="border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:14px"><tr><td width="120"><img src="cid:sgalogo" alt="SGA" style="height:34px"></td><td style="text-align:center;font-size:16px;font-weight:bold;color:#1e3a5f">Arrecadação de Pronto Pagamento Consolidado</td><td style="text-align:right;color:#64748b;font-size:12px">${meta.periodo || ''}</td></tr></table>
    ${bloco(tituloPeriodo, cons.totalAkz, cons.totalUsd)}
    ${cons.prev ? bloco(mesNome(cons.prev.mes), cons.prev.factAkz, cons.prev.factUsd) : ''}
    ${cons.current ? bloco(mesNome(cons.current.mes), cons.current.factAkz, cons.current.factUsd) : ''}
    ${tblAno}
    ${tblMes}
    ${matrizHtml('Por Cliente', agregarPorEntidade(rows, r => r.nome_cliente || r.cod_cliente || null), 'Nome Cliente')}
    ${matrizHtml('Por Banco', agregarPorEntidade(rows, r => (r.nome_banco || '').trim() || null), 'Nome Banco')}
    ${matrizHtml('Por Aeroporto', agregarPorEntidade(rows, r => (r.num_movimento || '').slice(0, 4) || null), 'Aeroporto')}
    <p style="color:#94a3b8;font-size:11px;margin-top:16px">Só movimentos pagos (PP), por data de movimento. Arrecadado = Facturado - 14%. Receitas por serviço em USD.</p>
  </div>`;
}
