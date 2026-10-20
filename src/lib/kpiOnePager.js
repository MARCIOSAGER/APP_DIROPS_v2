// ============================================================
// Relatório Executivo de KPIs — "one-pager" para o Conselho.
// Renderizado NATIVAMENTE com jsPDF (vetorial) via pdfTemplate:
// texto nítido, sem truncagem/rasterização, quebras de página
// controladas e arquivo pequeno (~50KB). Substituiu o html2canvas,
// que causava truncagem, % fora das caixas e cortes de página.
// ============================================================
import { createPdfDoc, addHeader, addFooter, addTable, addSectionTitle, PDF } from '@/lib/pdfTemplate';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nf = (n) => new Intl.NumberFormat('pt-PT').format(Number(n) || 0);
const nf1 = (n) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(n) || 0);

// ─── Helpers de desenho nativo ───────────────────────────────
const nivelColor = (pct) => (pct >= 90 ? PDF.colors.success : pct >= 75 ? PDF.colors.warning : PDF.colors.danger);
const setC = (doc, rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
const setF = (doc, rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
const setD = (doc, rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
// Corta texto que não cabe em maxW (mm) e sinaliza com reticências. Nunca "estoura".
const ellip = (doc, s, maxW) => {
  s = String(s == null ? '' : s);
  if (doc.getTextWidth(s) <= maxW) return s;
  while (s.length && doc.getTextWidth(s + '…') > maxW) s = s.slice(0, -1);
  return s + '…';
};

// Faixa de 4 estatísticas-chave (Conformidade · Medições · Aeroportos · Indicadores).
function drawStatBand(doc, y, p, contentW, mLeft) {
  const bandH = 21;
  setF(doc, PDF.colors.white); setD(doc, PDF.colors.separator); doc.setLineWidth(0.3);
  doc.roundedRect(mLeft, y, contentW, bandH, 2, 2, 'FD');
  const qW = contentW / 4;
  setD(doc, PDF.colors.separator); doc.setLineWidth(0.2);
  for (let i = 1; i < 4; i++) doc.line(mLeft + qW * i, y + 3, mLeft + qW * i, y + bandH - 3);
  const cells = [
    { lbl: 'Conformidade Geral', val: `${p.pct}%`, foot: `${nf(p.dentro)} de ${nf(p.total)} dentro`, color: PDF.colors.success },
    { lbl: 'Medições', val: nf(p.total), foot: 'no período', color: PDF.colors.dark },
    { lbl: 'Aeroportos', val: nf(p.nAeroportos), foot: 'monitorados', color: PDF.colors.dark },
    { lbl: 'Indicadores', val: nf(p.nKpis), foot: 'tempos de atendimento', color: PDF.colors.dark },
  ];
  cells.forEach((c, i) => {
    const x = mLeft + qW * i + 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setC(doc, PDF.colors.muted);
    doc.text(ellip(doc, c.lbl.toUpperCase(), qW - 6), x, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); setC(doc, c.color);
    doc.text(String(c.val), x, y + 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setC(doc, PDF.colors.muted);
    doc.text(ellip(doc, c.foot, qW - 6), x, y + 18.5);
  });
  return y + bandH + 6;
}

// Título de coluna (navy, com sublinhado e dica à direita).
function colTitle(doc, x, y, wCol, title, hint) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); setC(doc, PDF.colors.primary);
  doc.text(title.toUpperCase(), x, y + 3);
  if (hint) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setC(doc, PDF.colors.light);
    doc.text(hint, x + wCol, y + 3, { align: 'right' });
  }
  setD(doc, PDF.colors.separator); doc.setLineWidth(0.3); doc.line(x, y + 5, x + wCol, y + 5);
  return y + 9;
}

// Duas colunas: barras de conformidade por aeroporto (esq) | indicadores em atenção (dir).
function drawTwoColumns(doc, y, p, contentW, mLeft) {
  const gap = 9;
  const leftW = contentW * 0.55;
  const rightW = contentW - leftW - gap;
  const rightX = mLeft + leftW + gap;

  // ─── Esquerda: Conformidade por Aeroporto ───
  let ly = colTitle(doc, mLeft, y, leftW, 'Conformidade por Aeroporto', '% dentro da meta');
  const bars = (p.aeroportos || []).slice(0, 6);
  if (!bars.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setC(doc, PDF.colors.light);
    doc.text('Sem dados no período.', mLeft, ly + 3); ly += 6;
  } else {
    const nameW = 30, pctW = 12, trackH = 4.6, rowH = 9;
    bars.forEach((a) => {
      // Nome do aeroporto (cidade) — cabe inteiro; se muito longo, reticências.
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); setC(doc, PDF.colors.dark);
      doc.text(ellip(doc, a.nome, nameW - 1), mLeft, ly + 3.2);
      // Sub-linha: ICAO · medições
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); setC(doc, PDF.colors.light);
      const sub = a.icao && a.icao !== '—' ? `${a.icao} · ${nf(a.total)} med.` : `${nf(a.total)} med.`;
      doc.text(sub, mLeft, ly + 6.6);
      // Barra
      const trackX = mLeft + nameW, trackW = leftW - nameW - pctW;
      setF(doc, [240, 243, 248]); doc.roundedRect(trackX, ly + 0.8, trackW, trackH, 1, 1, 'F');
      const col = nivelColor(a.pct);
      setF(doc, col);
      const fw = Math.max(1.5, trackW * Math.min(100, a.pct) / 100);
      doc.roundedRect(trackX, ly + 0.8, fw, trackH, 1, 1, 'F');
      // %
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setC(doc, col);
      doc.text(`${a.pct}%`, mLeft + leftW, ly + 3.6, { align: 'right' });
      ly += rowH;
    });
  }

  // ─── Direita: Indicadores em Atenção ───
  let ry = colTitle(doc, rightX, y, rightW, 'Indicadores em Atenção', '');
  const att = (p.atencao || []).slice(0, 4);
  if (!att.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setC(doc, PDF.colors.success);
    const l = doc.splitTextToSize('Todos os indicadores dentro da meta.', rightW);
    doc.text(l, rightX, ry + 3); ry += 6 + (l.length - 1) * 4;
  } else {
    att.forEach((a) => {
      const col = a.pct < 75 ? PDF.colors.danger : PDF.colors.warning;
      setF(doc, col); doc.circle(rightX + 1, ry + 1.8, 0.9, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setC(doc, PDF.colors.dark);
      const nameLines = doc.splitTextToSize(a.nome, rightW - 16).slice(0, 2);
      doc.text(nameLines, rightX + 4, ry + 3);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setC(doc, col);
      doc.text(`${a.pct}%`, rightX + rightW, ry + 4, { align: 'right' });
      const sy = ry + 3 + nameLines.length * 3.4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setC(doc, PDF.colors.muted);
      doc.text(`Média ${nf1(a.media)} min · meta ${nf(a.meta)} min`, rightX + 4, sy);
      ry = sy + 5;
    });
  }

  let yy = Math.max(ly, ry) + 2;

  // Destaque positivo (nota verde, largura total)
  if (p.destaque) {
    const txt = p.destaque.replace(/<\/?b>/g, '');
    const lines = doc.splitTextToSize(txt, contentW - 8);
    const boxH = lines.length * 4 + 6;
    setF(doc, [230, 244, 236]); setD(doc, [203, 230, 213]); doc.setLineWidth(0.3);
    doc.roundedRect(mLeft, yy, contentW, boxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setC(doc, [14, 107, 59]);
    doc.text(lines, mLeft + 4, yy + 5);
    yy += boxH + 4;
  }
  return yy;
}

// Monta o documento (jsPDF nativo) do Relatório Executivo. Uso interno.
async function renderOnePagerDoc(payload) {
  const doc = await createPdfDoc({ orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const m = PDF.margin;
  const contentW = W - m.left - m.right;

  let y = addHeader(doc, {
    title: 'KPIs Operacionais',
    subtitle: 'Relatório Executivo',
    logoBase64: payload.logoDataUrl,
    meta: [`Período: ${payload.periodo}`, `Emitido: ${payload.emitido}`],
  });

  y = drawStatBand(doc, y, payload, contentW, m.left);
  y = drawTwoColumns(doc, y, payload, contentW, m.left);

  // Desempenho por Indicador — tabela nativa (quebra de página automática e limpa).
  y = addSectionTitle(doc, y, 'Desempenho por Indicador');
  const rows = (payload.indicadores || []).map((i) => [
    i.nome, nf(i.total), `${nf1(i.media)} / ${nf(i.meta)}`, `${i.pct}%`,
  ]);
  addTable(doc, y, {
    columns: [
      { label: 'Indicador', width: 92, align: 'left' },
      { label: 'Medições', width: 24, align: 'center' },
      { label: 'Média / Meta (min)', width: 40, align: 'center' },
      { label: 'Conformidade', width: 24, align: 'center' },
    ],
    rows,
    rowHeight: 6.5,
  });

  addFooter(doc, {});
  return doc;
}

// Gera o one-pager e salva no disco (download).
export async function exportKpiOnePagerPDF(payload, { fileName = 'Relatorio_Executivo_KPIs.pdf' } = {}) {
  const doc = await renderOnePagerDoc(payload);
  doc.save(fileName);
}

// Igual ao export, mas devolve o PDF em base64 puro (sem prefixo data:) — para anexar em email.
export async function renderKpiOnePagerBase64(payload) {
  const doc = await renderOnePagerDoc(payload);
  const uri = doc.output('datauristring');
  return uri.substring(uri.indexOf('base64,') + 7);
}

// ============================================================
// Corpo de email (HTML "email-safe": tabelas + estilos inline).
// Resumo institucional do período — números-chave, conformidade por
// aeroporto e indicadores em atenção. Renderiza em Outlook/Gmail/etc.
// ============================================================
export function buildKpiEmailSummaryHtml(p, { anexos = [], mensagem = '' } = {}) {
  const color = (pct) => (pct >= 90 ? '#12874a' : pct >= 75 ? '#bd7d12' : '#bf3a30');
  const bgc = (pct) => (pct >= 90 ? '#e6f4ec' : pct >= 75 ? '#fbf1dd' : '#fbe8e6');
  const chip = (pct) => `<span style="display:inline-block;padding:2px 10px;border-radius:12px;background:${bgc(pct)};color:${color(pct)};font-size:12px;font-weight:700">${pct}%</span>`;

  const apRows = (p.aeroportos || []).slice(0, 8).map((a) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;font-size:13px;color:#14243a;font-weight:600">${esc(a.nome)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;font-size:12px;color:#5f6f83;text-align:right;white-space:nowrap">${nf(a.total)} med.</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right">${chip(a.pct)}</td>
    </tr>`).join('');

  const atRows = (p.atencao || []).slice(0, 4).map((a) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;font-size:13px;color:#14243a;font-weight:600">${esc(a.nome)}
        <div style="font-size:11px;color:#8a99ad;font-weight:400;margin-top:2px">Média ${nf1(a.media)} min · meta ${nf(a.meta)} min</div></td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;white-space:nowrap">${chip(a.pct)}</td>
    </tr>`).join('');

  const stat = (lbl, val, foot, valColor) => `
    <td width="25%" style="padding:14px 12px;border:1px solid #e4eaf2;vertical-align:top">
      <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a99ad;margin-bottom:6px">${lbl}</div>
      <div style="font-size:26px;font-weight:700;color:${valColor || '#1e3a5f'};line-height:1.1">${val}</div>
      <div style="font-size:11px;color:#5f6f83;margin-top:4px">${foot}</div>
    </td>`;

  const secTitle = (txt) => `<div style="margin:22px 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#1e3a5f;font-weight:700;border-bottom:1px solid #e4eaf2;padding-bottom:6px">${txt}</div>`;

  const logo = p.logoDataUrl
    ? `<img src="${p.logoDataUrl}" alt="SGA" style="height:40px;display:block;margin:0 auto 8px"/>`
    : `<div style="font-family:Georgia,serif;font-weight:700;font-size:24px;color:#1e3a5f;text-align:center">SGA</div>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#14243a;background:#ffffff;padding:4px">
    <div style="text-align:center;padding:22px 0 16px;border-bottom:2px solid #1e3a5f">
      ${logo}
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a99ad">Relatório Executivo · Direção de Operações</div>
      <div style="font-size:22px;font-weight:700;color:#14243a;margin-top:4px">KPIs Operacionais</div>
      <div style="font-size:12px;color:#5f6f83;margin-top:4px">Período: ${esc(p.periodo)} · Emitido ${esc(p.emitido)}</div>
    </div>

    ${mensagem && mensagem.trim() ? `<div style="margin:16px 0 0;padding:12px 14px;background:#f6f8fb;border-left:3px solid #1e3a5f;border-radius:4px;font-size:13px;color:#14243a;line-height:1.5;white-space:pre-wrap">${esc(mensagem.trim())}</div>` : ''}

    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0">
      <tr>
        ${stat('Conformidade Geral', p.pct + '%', `${nf(p.dentro)} de ${nf(p.total)} dentro da meta`, '#12874a')}
        ${stat('Medições', nf(p.total), 'no período', null)}
        ${stat('Aeroportos', nf(p.nAeroportos), 'monitorados', null)}
        ${stat('Indicadores', nf(p.nKpis), 'monitorados', null)}
      </tr>
    </table>

    ${secTitle('Conformidade por Aeroporto')}
    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
      ${apRows || '<tr><td style="padding:10px;font-size:12px;color:#8a99ad">Sem dados no período.</td></tr>'}
    </table>

    ${secTitle('Indicadores em Atenção')}
    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
      ${atRows || '<tr><td style="padding:10px;font-size:12px;color:#12874a">Todos os indicadores dentro da meta.</td></tr>'}
    </table>

    ${p.destaque ? `<div style="margin-top:16px;padding:12px 14px;background:#e6f4ec;border:1px solid #cbe6d5;border-radius:6px;font-size:12px;color:#0e6b3b">${p.destaque}</div>` : ''}

    ${anexos.length ? `<div style="margin-top:22px;padding:14px;background:#f6f8fb;border:1px solid #e4eaf2;border-radius:6px;font-size:12px;color:#5f6f83"><b style="color:#14243a">Em anexo:</b> ${anexos.map(esc).join(' · ')}</div>` : ''}

    <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e4eaf2;text-align:center;font-size:11px;color:#8a99ad">
      Confidencial · Uso interno — Conselho Executivo<br>
      SGA · Direção de Operações · ${esc(p.emitido)}
    </div>
  </div>`;
}
