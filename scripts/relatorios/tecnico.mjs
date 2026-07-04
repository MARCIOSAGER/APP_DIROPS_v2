// ============================================================
// Relatorio Tecnico de Faturacao (2o anexo). Explica COMO se chega aos valores:
//   A) Metodologia (taxa de cambio + regras de cada tarifa)
//   B) Decomposicao da faturacao por componente (USD/AOA/%)
//   C) Detalhe por voo (tabela no PDF ate MAX_TABELA voos; senao vai em CSV)
// gerarTecnicoPdf(...) -> base64 ; gerarCsvDetalhe(...) -> string CSV
// ============================================================
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
let LOGO = null;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }
const LOGO_RATIO = 512 / 207;
// Câmbio NÃO é mais fixo: cada voo carrega a taxa vigente na sua data de operação.
// O relatório usa a taxa EFETIVA do período = faturacao_aoa / faturacao_usd
// (média ponderada real das taxas aplicadas). Calculada dentro de gerarTecnicoPdf.

const C = {
  primary: [30, 58, 95], accent: [37, 99, 235],
  ink: [15, 23, 42], text: [51, 65, 85], muted: [100, 116, 139],
  line: [226, 232, 240], soft: [248, 250, 252], white: [255, 255, 255],
};

const METODOLOGIA = [
  ['Taxa de câmbio', 'Cada voo é convertido pela taxa de câmbio vigente na sua DATA DE OPERAÇÃO (histórico versionado). Os valores são calculados em USD e convertidos para AOA (Kz); o câmbio médio efetivo do período aparece no resumo acima.'],
  ['Aterragem / Descolagem', 'Cobrada por escalão de MTOW (toneladas), de forma cumulativa, conforme a tabela de tarifas de pouso; distingue voo doméstico e internacional.'],
  ['Passageiros', 'Tarifa por passageiro embarcado (na partida). Passageiros em trânsito direto e em trânsito com transbordo são isentos.'],
  ['Permanência (estacionamento)', 'Cobrada por tonelada de MTOW por hora de estacionamento, com as horas iniciais isentas conforme configuração.'],
  ['Carga', 'Cobrada por tonelada de carga na partida.'],
  ['Outras (segurança, iluminação, CUPPSS)', 'Iluminação aplica-se a operações noturnas (18:00–06:00). Segurança e CUPPSS/CUSS conforme aplicável.'],
  ['Impostos', 'Aplicados sobre o subtotal quando configurados para a operação.'],
  ['Fonte', 'Tabela calculo_tarifa (motor de cálculo do DIROPS). Cada voo tem o detalhe completo no sistema (documento "Cálculo de Tarifas Aeroportuárias").'],
];

const COMP_LABELS = {
  passageiros_usd: 'Passageiros', permanencia_usd: 'Permanência (estacionamento)',
  pouso_usd: 'Aterragem / Descolagem', carga_usd: 'Carga',
  servicos_usd: 'Serviços', recursos_usd: 'Recursos', outras_usd: 'Outras (segurança, iluminação, CUPPSS…)',
  impostos_usd: 'Impostos',
};
export const MAX_TABELA = 80; // acima disto, detalhe por voo vai só no CSV

export async function gerarTecnicoPdf(tipo, per, dados, detalhe, h) {
  const { fmt, usd, subtitulo, TITULOS } = h;
  // Taxa efetiva do período (média ponderada real): AOA faturado / USD faturado.
  const _fatUsd = Number((dados.kpis || {}).faturacao_usd) || 0;
  const _fatAoa = Number((dados.kpis || {}).faturacao_aoa) || 0;
  const CAMBIO = _fatUsd > 0 ? (_fatAoa / _fatUsd) : 850;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
  const M = 40, CW = PW - 2 * M;
  let y = 0;
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const kzc = (usdv) => fmt(Math.round((Number(usdv) || 0) * CAMBIO)) + ' Kz';

  // cabecalho (repetido em todas as paginas)
  const topY = 30, logoH = 34, logoW = logoH * LOGO_RATIO;
  const drawPageHeader = () => {
    if (LOGO) { try { doc.addImage(LOGO, 'PNG', M, topY, logoW, logoH); } catch { /* */ } }
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Relatório Técnico de Faturação', PW - M, topY + 12, { align: 'right' });
    setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(subtitulo(tipo, per), PW - M, topY + 32, { align: 'right' });
    setDraw(C.primary); doc.setLineWidth(2); doc.line(M, topY + logoH + 12, PW - M, topY + logoH + 12);
    return topY + logoH + 12 + 22;
  };
  const newPage = () => { doc.addPage(); return drawPageHeader(); };
  y = drawPageHeader();

  // ---------- faixa de cartões KPI (resumo) ----------
  {
    const kzCompact = (n) => { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'M Kz' : fmt(n) + ' Kz'; };
    const compAll = dados.faturacao_componentes || {};
    const totComp = Object.values(compAll).reduce((s, v) => s + (Number(v) || 0), 0);
    const impPct = totComp > 0 ? ((Number(compAll.impostos_usd) || 0) / totComp * 100) : 0;
    const cards = [
      ['FATURAÇÃO (USD)', usd((dados.kpis || {}).faturacao_usd || 0), 'total do período', [16, 185, 129]],
      ['EM KWANZA', kzCompact((dados.kpis || {}).faturacao_aoa || 0), `câmbio médio 1 USD = ${fmt(Math.round(CAMBIO))}`, [37, 99, 235]],
      ['VOOS FATURADOS', fmt(detalhe.length), 'com cálculo de tarifa', [124, 58, 237]],
      ['IMPOSTOS', impPct.toFixed(1).replace('.', ',') + '%', 'sobre o subtotal', [234, 88, 12]],
    ];
    const gap = 9, cw = (CW - 3 * gap) / 4, ch = 56;
    cards.forEach((c, i) => {
      const x = M + i * (cw + gap);
      setFill(C.soft); setDraw(C.line); doc.setLineWidth(0.8); doc.roundedRect(x, y, cw, ch, 6, 6, 'FD');
      setFill(c[3]); doc.roundedRect(x + 8, y + 10, 3.5, ch - 20, 2, 2, 'F');
      setText(C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.text(c[0], x + 17, y + 15);
      setText(c[3]); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.text(String(c[1]), x + 17, y + 33);
      setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text(String(c[2]), x + 17, y + 46);
    });
    y += ch + 24;
  }

  const seccao = (t, reserva = 60) => {
    if (y + 24 + reserva > PH - 46) { y = newPage(); }
    setFill(C.accent); doc.rect(M, y - 9, 3.5, 14, 'F');
    setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(t, M + 10, y + 2); y += 20;
  };

  // A) Metodologia
  seccao('Metodologia de Cálculo', 80);
  METODOLOGIA.forEach(([titulo, texto]) => {
    const linhas = doc.splitTextToSize(texto, CW - 8);
    if (y + 14 + linhas.length * 11 > PH - 46) { y = newPage(); }
    setText(C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text(titulo, M, y); y += 12;
    setText(C.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    linhas.forEach((ln) => { doc.text(ln, M + 8, y); y += 11; });
    y += 4;
  });
  y += 8;

  // B) Decomposicao por componente
  const comp = Object.entries(COMP_LABELS).map(([k, label]) => ({ label, usd: Number((dados.faturacao_componentes || {})[k]) || 0 }))
    .filter((x) => x.usd > 0).sort((a, b) => b.usd - a.usd);
  if (comp.length) {
    const totalComp = comp.reduce((s, x) => s + x.usd, 0) || 1;
    const rh = 20;
    const cols = [ { t: 'Componente', w: CW - 210, a: 'left' }, { t: 'USD', w: 80, a: 'right' }, { t: 'AOA (Kz)', w: 90, a: 'right' }, { t: '%', w: 40, a: 'right' } ];
    seccao('Decomposição da Faturação por Componente', rh + 4 * rh);
    setFill(C.primary); doc.rect(M, y, CW, rh, 'F');
    setText([203, 213, 225]); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    let cx = M; cols.forEach((c) => { const tx = c.a === 'right' ? cx + c.w - 8 : cx + 8; doc.text(c.t.toUpperCase(), tx, y + 13, { align: c.a }); cx += c.w; }); y += rh;
    comp.forEach((x, idx) => {
      if (y + rh > PH - 46) { y = newPage(); }
      if (idx % 2 === 0) { setFill(C.soft); doc.rect(M, y, CW, rh, 'F'); }
      const vals = [x.label, usd(x.usd), kzc(x.usd), (100 * x.usd / totalComp).toFixed(1).replace('.', ',') + '%'];
      cx = M; cols.forEach((c, ci) => {
        setText(ci === 0 ? C.ink : C.text); doc.setFont('helvetica', ci === 0 ? 'bold' : 'normal'); doc.setFontSize(9.5);
        const tx = c.a === 'right' ? cx + c.w - 8 : cx + 8; doc.text(String(vals[ci]), tx, y + 13, { align: c.a }); cx += c.w;
      });
      setDraw(C.line); doc.setLineWidth(0.5); doc.line(M, y + rh, M + CW, y + rh); y += rh;
    });
    // total
    setFill([234, 240, 248]); doc.rect(M, y, CW, rh, 'F');
    const tot = comp.reduce((s, x) => s + x.usd, 0);
    setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('TOTAL', M + 8, y + 13);
    doc.text(usd(tot), M + (CW - 210) + 80 - 8, y + 13, { align: 'right' });
    doc.text(kzc(tot), M + (CW - 210) + 80 + 90 - 8, y + 13, { align: 'right' });
    doc.text('100%', M + CW - 8, y + 13, { align: 'right' });
    y += rh + 22;
  }

  // C) Detalhe por voo (so ate MAX_TABELA; senao nota + CSV)
  const nDet = detalhe.length;
  seccao(`Detalhe por Voo (${fmt(nDet)} voos faturados)`, 40);
  if (nDet === 0) {
    setText(C.muted); doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5);
    doc.text('Nenhum voo com cálculo de tarifa no período.', M, y + 4); y += 16;
  } else if (nDet > MAX_TABELA) {
    setText(C.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const nota = doc.splitTextToSize(`O período tem ${fmt(nDet)} voos faturados — a lista completa, com todos os componentes, tempos e MTOW por voo, segue no ficheiro Excel (XLSX) anexo. Acima fica a decomposição agregada.`, CW);
    nota.forEach((ln) => { doc.text(ln, M, y + 4); y += 12; });
  } else {
    const rh = 15, hh = 20;
    const cols = [
      { t: 'Data', w: 46, a: 'left' }, { t: 'Voo', w: 46, a: 'left' }, { t: 'Aer', w: 30, a: 'left' },
      { t: 'MTOW', u: 't', w: 40, a: 'right' }, { t: 'Estac', u: 'h', w: 42, a: 'right' },
      { t: 'Pouso', u: 'USD', w: 48, a: 'right' }, { t: 'Perm', u: 'USD', w: 50, a: 'right' }, { t: 'Pax', u: 'USD', w: 50, a: 'right' }, { t: 'Outras', u: 'USD', w: 46, a: 'right' },
    ];
    cols.push({ t: 'Total', u: 'USD', w: CW - cols.reduce((s, c) => s + c.w, 0), a: 'right' });
    const drawHead = () => {
      setFill(C.primary); doc.rect(M, y, CW, hh, 'F');
      let cx = M; cols.forEach((c) => {
        const tx = c.a === 'right' ? cx + c.w - 6 : cx + 6;
        setText([203, 213, 225]); doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.text(c.t.toUpperCase(), tx, y + 9, { align: c.a });
        if (c.u) { setText([148, 163, 184]); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.text(c.u, tx, y + 16, { align: c.a }); }
        cx += c.w;
      });
      y += hh;
    };
    drawHead();
    detalhe.forEach((r, idx) => {
      if (y + rh > PH - 46) { y = newPage(); drawHead(); }
      if (idx % 2 === 0) { setFill(C.soft); doc.rect(M, y, CW, rh, 'F'); }
      const vals = [String(r.data || '').slice(5), r.numero_voo, r.aeroporto,
        String(Math.round(Number(r.mtow_t) || 0)), (Number(r.permanencia_h) || 0).toFixed(1).replace('.', ','),
        fmt(r.pouso_usd), fmt(r.permanencia_usd), fmt(r.passageiros_usd), fmt(r.outras_usd), fmt(r.total_usd)];
      let cx = M; cols.forEach((c, ci) => {
        setText(ci === 9 ? C.ink : C.text); doc.setFont('helvetica', ci === 9 ? 'bold' : 'normal'); doc.setFontSize(7.5);
        const tx = c.a === 'right' ? cx + c.w - 6 : cx + 6; doc.text(String(vals[ci] == null ? '' : vals[ci]), tx, y + 10, { align: c.a }); cx += c.w;
      });
      y += rh;
    });
    setText(C.muted); doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); y += 4;
    doc.text('Valores em USD, arredondados. Detalhe completo de cada voo disponível no sistema (Cálculo de Tarifas Aeroportuárias).', M, y);
  }

  // rodape
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Relatório Técnico de Faturação — Sistema DIROPS', M, PH - 24);
    doc.text(`Página ${p}/${total}`, PW - M, PH - 24, { align: 'right' });
  }
  return Buffer.from(doc.output('arraybuffer')).toString('base64');
}

// XLSX (SheetJS) — abre legível no Excel: colunas/tipos corretos, acentos OK,
// sem ambiguidade de separador/locale (o CSV abria tudo numa coluna só).
export function gerarXlsxDetalhe(detalhe) {
  const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const header = ['Data', 'Voo', 'Movimento', 'Aeroporto', 'Companhia', 'Registo', 'Tipo Voo',
    'MTOW (t)', 'Categoria', 'Aterragem', 'Descolagem', 'Estacionamento (h)',
    'Pouso USD', 'Permanência USD', 'Passageiros USD', 'Carga USD', 'Outras USD', 'Impostos USD', 'Total USD', 'Total AOA (Kz)'];
  const rows = detalhe.map((r) => [
    r.data, r.numero_voo, r.movimento, r.aeroporto, r.companhia, r.registo, r.tipo_voo,
    n2(r.mtow_t), r.categoria || '', r.aterragem || '', r.descolagem || '', n2(r.permanencia_h),
    n2(r.pouso_usd), n2(r.permanencia_usd), n2(r.passageiros_usd), n2(r.carga_usd), n2(r.outras_usd), n2(r.impostos_usd), n2(r.total_usd), Math.round(Number(r.total_aoa) || 0),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [12, 10, 10, 10, 11, 10, 12, 8, 10, 16, 16, 15, 12, 15, 15, 10, 11, 12, 12, 15].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalhe Faturação');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
