// ============================================================
// Mapa de Monitoramento de KPIs (tempos de atendimento vs meta), por aeroporto
// e DOM/INT. Fonte: rpc_relatorio_kpis. Layout em grade de cartões coloridos.
// Verde = dentro da meta, vermelho = acima, "–" = sem medição.
// Exporta buildKpisHtml(per, dados, subLabel) e gerarKpisPdf(per, dados, subLabel).
// ============================================================
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
let LOGO = null;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }
const LOGO_RATIO = 512 / 207;

const AIRPORTS = [
  { icao: 'FNUB', nome: 'Lubango', curto: 'Lub' }, { icao: 'FNCT', nome: 'Catumbela', curto: 'Cat' },
  { icao: 'FNMO', nome: 'Namibe', curto: 'Nam' }, { icao: 'FNCA', nome: 'Cabinda', curto: 'Cab' },
];
// Área -> cor + linhas (tipo_codigo, meta). Metas confirmadas vs Power BI.
const AREAS = [
  { area: 'Check-in (Fila)', hex: '#2563eb', rgb: [37, 99, 235], linhas: [['DOM', 'CHECKIN', 20], ['INT', 'CHECKIN_INTERNACIONAL', 30]] },
  { area: 'Segurança (Fila)', hex: '#16a34a', rgb: [22, 163, 74], linhas: [['DOM', 'SEC', 15], ['INT', 'FILA_DO_PONTO_DE_INSPECCAO_SEGURANCA_INTERNACIONAL', 15]] },
  { area: 'Migratório (SME)', hex: '#7c3aed', rgb: [124, 58, 237], linhas: [['DOM', 'CONTROLO_MIGRATORIO_SME_DOMESTICO', 5], ['INT', 'SME_INTERNACIONAL', 10]] },
  { area: 'Aduaneiro (AGT)', hex: '#ea580c', rgb: [234, 88, 12], linhas: [['INT', 'FILA_AGT_INTERNACIONAL', 15]] },
  { area: 'Bagagem', hex: '#0d9488', rgb: [13, 148, 136], linhas: [['1ª DOM', 'Pr_Bag', 15], ['1ª INT', 'TEMPO_DA_1_BAGAGEM_INTERNACIONAL', 20], ['Últ DOM', 'TEMPO_DA_ULTIMA_BAGAGEM_DOMESTICO', 30], ['Últ INT', 'TEMPO_DA_ULTIMA_BAGAGEM_INTERNACIONAL', 45]] },
  { area: 'Embarque', hex: '#4f46e5', rgb: [79, 70, 229], linhas: [['DOM', 'TEMPO_DE_EMBARQUE_DOMESTICO', 40], ['INT', 'TEMPO_DE_EMBARQUE_INTERNACIONAL', 60]] },
];

const buildIdx = (dados) => { const idx = {}; for (const m of (dados.medicoes || [])) idx[m.tipo_codigo + '|' + m.aeroporto] = m; return idx; };
const min1 = (v) => (v == null ? null : String(v).replace('.', ','));

// ---------------- HTML ----------------
export function buildKpisHtml(per, dados, subLabel) {
  const idx = buildIdx(dados);

  const cardHtml = (area) => {
    const head = `<th style="padding:5px 4px;"></th>` + AIRPORTS.map((a) =>
      `<th style="padding:5px 4px;font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:center;">${a.curto}</th>`).join('');
    const rows = area.linhas.map(([label, codigo, meta]) => {
      const cells = AIRPORTS.map((ap) => {
        const m = idx[codigo + '|' + ap.icao];
        if (!m || m.media == null) return `<td style="padding:5px 4px;text-align:center;color:#cbd5e1;">–</td>`;
        const over = Number(m.media) > meta;
        return `<td style="padding:5px 4px;text-align:center;font-weight:700;font-size:13px;color:${over ? '#dc2626' : '#16a34a'};">${min1(m.media)}</td>`;
      }).join('');
      return `<tr><td style="padding:5px 4px;font-size:11px;color:#334155;white-space:nowrap;">${label}<br><span style="color:#94a3b8;font-size:9px;">meta ${meta}′</span></td>${cells}</tr>`;
    }).join('');
    return `<div style="background:#fff;border:1px solid #e8edf3;border-radius:12px;overflow:hidden;">
      <div style="padding:11px 14px;border-bottom:2px solid ${area.hex};">
        <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${area.hex};vertical-align:middle;margin-right:8px;"></span>
        <span style="font-size:14px;font-weight:700;color:#1e293b;vertical-align:middle;">${area.area}</span>
      </div>
      <div style="padding:6px 8px 10px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>${head}</tr>${rows}</table>
      </div></div>`;
  };

  // grade 2 colunas
  let grid = '';
  for (let i = 0; i < AREAS.length; i += 2) {
    grid += `<tr>
      <td width="50%" valign="top" style="padding:7px;">${cardHtml(AREAS[i])}</td>
      <td width="50%" valign="top" style="padding:7px;">${AREAS[i + 1] ? cardHtml(AREAS[i + 1]) : ''}</td>
    </tr>`;
  }
  const legenda = AREAS.map((a) => `<span style="display:inline-block;margin:0 10px;white-space:nowrap;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${a.hex};margin-right:5px;"></span><span style="font-size:11px;color:#64748b;">${a.area}</span></span>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;background:#eef2f7;font-family:Segoe UI,Arial,sans-serif;">
<div style="max-width:720px;margin:0 auto;padding:20px;">
  <div style="background:#fff;border-radius:12px 12px 0 0;padding:22px 30px;border:1px solid #e2e8f0;border-bottom:3px solid #1e3a5f;">
    <table width="100%"><tr>
      <td valign="middle"><img src="cid:sgalogo" alt="SGA" height="42" style="display:block;border:0;"></td>
      <td align="right" valign="middle" style="color:#64748b;font-size:12px;">Mapa de Monitoramento de KPIs<br><span style="color:#1e3a5f;font-size:16px;font-weight:700;">${subLabel}</span></td>
    </tr></table>
  </div>
  <div style="background:#f8fafc;padding:12px 20px;border:1px solid #e2e8f0;border-top:none;">
    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">Tempo médio de atendimento (min) por aeroporto · <span style="color:#16a34a;font-weight:700;">verde</span> dentro da meta · <span style="color:#dc2626;font-weight:700;">vermelho</span> acima · <strong>–</strong> sem medição</p>
  </div>
  <div style="background:#eef2f7;padding:6px;border:1px solid #e2e8f0;border-top:none;">
    <table width="100%" cellpadding="0" cellspacing="0">${grid}</table>
  </div>
  <div style="background:#fff;padding:12px 20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;text-align:center;">${legenda}</div>
  <div style="text-align:center;padding:14px;color:#94a3b8;font-size:11px;">
    Gerado automaticamente pelo Sistema DIROPS · Direção de Operações — SGA
  </div>
</div></body></html>`;
}

// ---------------- PDF ----------------
export async function gerarKpisPdf(per, dados, subLabel) {
  const idx = buildIdx(dados);
  const C = { primary: [30, 58, 95], ink: [30, 41, 59], text: [51, 65, 85], muted: [100, 116, 139], line: [232, 237, 243], soft: [248, 250, 252], green: [22, 163, 74], red: [220, 38, 38], white: [255, 255, 255] };
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
  const M = 40, CW = PW - 2 * M;
  let y = 0;
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

  // cabecalho (repetido em todas as paginas)
  const topY = 30, logoH = 34;
  function header() {
    if (LOGO) { try { doc.addImage(LOGO, 'PNG', M, topY, logoH * LOGO_RATIO, logoH); } catch { /* */ } }
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Mapa de Monitoramento de KPIs', PW - M, topY + 12, { align: 'right' });
    setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(subLabel, PW - M, topY + 32, { align: 'right' });
    setDraw(C.primary); doc.setLineWidth(2); doc.line(M, topY + logoH + 12, PW - M, topY + logoH + 12);
    y = topY + logoH + 12 + 18;
    setText(C.muted); doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5);
    doc.text('Tempo médio (min) por aeroporto — verde dentro da meta, vermelho acima, "-" sem medição.', M, y); y += 16;
  }
  const newPage = () => { doc.addPage(); header(); };
  header();

  const HEAD_H = 26, THEAD_H = 14, RH = 15, PAD = 8;
  const cardH = (area) => HEAD_H + THEAD_H + area.linhas.length * RH + PAD;
  const gap = 14, cardW = (CW - gap) / 2;

  const drawCard = (x, yTop, area) => {
    const h = cardH(area);
    setFill(C.white); setDraw(C.line); doc.setLineWidth(0.8);
    doc.roundedRect(x, yTop, cardW, h, 8, 8, 'FD');
    // titulo + quadradinho colorido
    setFill(area.rgb); doc.roundedRect(x + 13, yTop + 12, 9, 9, 2, 2, 'F');
    setText(C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(area.area, x + 29, yTop + 20);
    setDraw(area.rgb); doc.setLineWidth(1.5); doc.line(x + 13, yTop + HEAD_H, x + cardW - 13, yTop + HEAD_H);
    // tabela
    const labelW = 74, colW = (cardW - 26 - labelW) / AIRPORTS.length;
    let ty = yTop + HEAD_H + 4;
    setText(C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    AIRPORTS.forEach((a, i) => doc.text(a.curto.toUpperCase(), x + 13 + labelW + i * colW + colW / 2, ty + 9, { align: 'center' }));
    ty += THEAD_H;
    area.linhas.forEach(([label, codigo, meta], ri) => {
      if (ri % 2 === 0) { setFill(C.soft); doc.rect(x + 13, ty - 1, cardW - 26, RH, 'F'); }
      setText(C.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(label, x + 13, ty + 9);
      setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text(`meta ${meta}'`, x + 13 + labelW - 6, ty + 9, { align: 'right' });
      AIRPORTS.forEach((a, i) => {
        const m = idx[codigo + '|' + a.icao]; const cx = x + 13 + labelW + i * colW + colW / 2;
        if (!m || m.media == null) { setText([203, 213, 225]); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('-', cx, ty + 9, { align: 'center' }); }
        else { const over = Number(m.media) > meta; setText(over ? C.red : C.green); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(min1(m.media), cx, ty + 9, { align: 'center' }); }
      });
      ty += RH;
    });
    return h;
  };

  for (let i = 0; i < AREAS.length; i += 2) {
    const rowH = Math.max(cardH(AREAS[i]), AREAS[i + 1] ? cardH(AREAS[i + 1]) : 0);
    if (y + rowH > PH - 60) { newPage(); }
    drawCard(M, y, AREAS[i]);
    if (AREAS[i + 1]) drawCard(M + cardW + gap, y, AREAS[i + 1]);
    y += rowH + gap;
  }

  // legenda
  if (y + 24 > PH - 46) { newPage(); }
  y += 2;
  let lx = M;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  AREAS.forEach((a) => {
    setFill(a.rgb); doc.circle(lx + 4, y, 3.2, 'F');
    setText(C.muted); doc.text(a.area, lx + 12, y + 3);
    lx += 14 + doc.getTextWidth(a.area) + 16;
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Mapa de Monitoramento de KPIs — Direção de Operações · SGA', M, PH - 24);
    doc.text(`Página ${p}/${total}`, PW - M, PH - 24, { align: 'right' });
  }
  return Buffer.from(doc.output('arraybuffer')).toString('base64');
}
