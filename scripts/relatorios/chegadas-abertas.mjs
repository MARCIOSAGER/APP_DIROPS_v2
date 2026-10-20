#!/usr/bin/env node
// ============================================================
// Relatorio "Chegadas sem Partida" (backlog de voos por rever).
// Lista as CHEGADAS (ARR) que NAO tem partida registada/vinculada — agrupadas
// por aeroporto — para as equipas reverem: lancar a partida em falta e vincular,
// ou remover se for duplicado. Complementa o aviso do formulario (que so pega no
// proximo movimento do aviao): aqui aparece TUDO que esta em aberto.
//
// Fonte: RPC get_voos_sem_link (SECURITY DEFINER). Envio: send-email (individual;
// relay SGA bloqueia BCC/massa). Destinatarios: relatorio_destinatario tipo
// 'chegadas_abertas' (senao oaeroportos@sga.co.ao). Chamado pelo dispatcher.
//
// Flags: --dry (nao envia, imprime resumo)  --to=a@x,b@y (override)
//        --emit=json (escreve {assunto,html} no stdout, p/ painel on-demand)
// ============================================================
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';

const __dir = path.dirname(fileURLToPath(import.meta.url));
let LOGO = null;
const LOGO_RATIO = 512 / 207; // proporcao real da logo SGA (mesma do pdf.mjs)
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }

const PGRST = 'http://127.0.0.1:3000';
const FUNCTIONS = 'http://127.0.0.1:4001';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const DEST_PADRAO = ['oaeroportos@sga.co.ao'];
const MAX_LINHAS_AERO = 30; // teto por aeroporto no email (resto: ver aba "Voos Sem Link" ou o on-demand)

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v];
}));
const DRY = !!args.dry;
const EMIT = args.emit === 'json';
// Filtros opcionais (on-demand): periodo (data_operacao) + aeroporto. Sem eles = backlog total.
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const INICIO = isDate(args.inicio) ? args.inicio : null;
const FIM = isDate(args.fim) ? args.fim : null;
const AERO = args.aeroporto && /^[A-Za-z0-9]{2,8}$/.test(String(args.aeroporto)) ? String(args.aeroporto).trim().toUpperCase() : null;

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const hoje = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dataExtenso = (isoStr) => { const [y,m,dd] = isoStr.split('-').map(Number); return `${String(dd).padStart(2,'0')} de ${MESES[(m-1+12)%12]||'?'} de ${y}`; };
const esc = (s) => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmt = (n) => { n = Math.round(Number(n)||0); const s = Math.abs(n).toString(); const p = []; for (let i=s.length;i>0;i-=3) p.unshift(s.slice(Math.max(0,i-3),i)); return (n<0?'-':'')+p.join('.'); };
const diasAberto = (isoStr) => { const t = Date.parse(isoStr + 'T00:00:00'); return Number.isFinite(t) ? Math.max(0, Math.round((hoje - t) / 86400000)) : '—'; };
// Mostra so o NOME (parte antes do @) — sem o email completo (evita filtro anti-spam do relay).
const nomeCriador = (email) => { const s = String(email || '').trim(); return s ? (s.split('@')[0] || s) : '—'; };

// ---------- dados ----------
async function getEmpresaId() {
  // Ha varias empresas no sistema (ATO, AirTwo...); os voos sao da SGA. Achar a
  // SGA pelo nome; fallback = id conhecido/estavel (mesmo das migracoes 065-072).
  try {
    const r = await fetch(`${PGRST}/empresa?select=id,nome`, { headers: HDR });
    const j = await r.json();
    if (Array.isArray(j)) {
      const sga = j.find((e) => /SGA|Sociedade Gestora/i.test(e.nome || ''));
      if (sga?.id) return sga.id;
    }
  } catch { /* ignore */ }
  return '128bc692-3fae-4825-9c55-40565dbedcfb';
}
async function buscarChegadasAbertas() {
  // Query direta na tabela voo (mesmo filtro do get_voos_sem_link: voo_ligado_id
  // IS NULL, apos a sincronizacao da migr 068) — assim trazemos tambem created_by.
  const empId = await getEmpresaId();
  const cols = 'tipo_movimento,numero_voo,registo_aeronave,companhia_aerea,aeroporto_operacao,aeroporto_origem_destino,data_operacao,horario_previsto,horario_real,passageiros_total,carga_kg,created_by,status';
  let url = `${PGRST}/voo?tipo_movimento=in.(ARR,DEP)&deleted_at=is.null&voo_ligado_id=is.null&empresa_id=eq.${empId}&select=${cols}&order=data_operacao.asc&limit=8000`;
  if (INICIO) url += `&data_operacao=gte.${INICIO}`;
  if (FIM) url += `&data_operacao=lte.${FIM}`;
  if (AERO) url += `&aeroporto_operacao=eq.${AERO}`;
  const r = await fetch(url, { headers: HDR });
  if (!r.ok) throw new Error(`Query voo falhou: HTTP ${r.status} — ${await r.text()}`);
  const j = await r.json();
  return (Array.isArray(j) ? j : []).filter((v) => String(v.status || '') !== 'Cancelado');
}
async function buscarDestinatarios() {
  try {
    const r = await fetch(`${PGRST}/relatorio_destinatario?select=email&ativo=eq.true&tipo_relatorio=eq.chegadas_abertas`, { headers: HDR });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? [...new Set(j.map((x) => (x.email || '').trim()).filter(Boolean))] : [];
  } catch { return []; }
}
// Destinatarios do relatorio POR AEROPORTO (cada aeroporto recebe so o seu).
// Fonte: relatorio_destinatario tipo=chegadas_abertas + aeroporto=<ICAO> (migr 075/076).
async function buscarDestinatariosPorAero(aero) {
  try {
    const r = await fetch(`${PGRST}/relatorio_destinatario?select=email&ativo=eq.true&tipo_relatorio=eq.chegadas_abertas&aeroporto=eq.${encodeURIComponent(aero)}`, { headers: HDR });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? [...new Set(j.map((x) => (x.email || '').trim()).filter(Boolean))] : [];
  } catch { return []; }
}
// Destinatarios GLOBAIS (aeroporto IS NULL) — recebem o CONSOLIDADO de todos os aeroportos (ex.: oaeroportos).
async function buscarDestinatariosGlobais() {
  try {
    const r = await fetch(`${PGRST}/relatorio_destinatario?select=email&ativo=eq.true&tipo_relatorio=eq.chegadas_abertas&aeroporto=is.null`, { headers: HDR });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? [...new Set(j.map((x) => (x.email || '').trim()).filter(Boolean))] : [];
  } catch { return []; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- HTML (email-safe: tabelas + estilos inline) ----------
const th = (t, al = 'left') => `<th style="padding:6px 8px;text-align:${al};background:#0f2f5f;color:#fff;font-size:12px;font-weight:600;white-space:nowrap">${t}</th>`;
const td = (t, al = 'left', b = false) => `<td style="padding:5px 8px;text-align:${al};border-bottom:1px solid #eef2f7;font-size:12px${b?';font-weight:700':''}">${t}</td>`;

function tabelaAero(rows) {
  const linhas = rows.slice(0, MAX_LINHAS_AERO).map((v) => {
    const hora = v.horario_real || v.horario_previsto || '—';
    const d = diasAberto(v.data_operacao);
    const corDias = d === '—' ? '#64748b' : (d > 30 ? '#b91c1c' : d > 7 ? '#d97706' : '#0f172a');
    const tipoLabel = v.tipo_movimento === 'DEP'
      ? '<span style="color:#2563eb;font-weight:700">Partida</span>'
      : '<span style="color:#059669;font-weight:700">Chegada</span>';
    return `<tr><td style="padding:5px 8px;border-bottom:1px solid #eef2f7;font-size:12px">${tipoLabel}</td>${td(esc(v.data_operacao))}${td(esc(v.numero_voo),'left',true)}${td(esc(v.aeroporto_origem_destino||'—'))}${td(esc(hora))}${td(esc(v.registo_aeronave))}${td(esc(v.companhia_aerea))}${td(fmt(v.passageiros_total),'right')}${td(fmt(v.carga_kg),'right')}${td(esc(nomeCriador(v.created_by)))}<td style="padding:5px 8px;text-align:right;border-bottom:1px solid #eef2f7;font-size:12px;font-weight:700;color:${corDias}">${d}</td></tr>`;
  }).join('');
  const extra = rows.length > MAX_LINHAS_AERO
    ? `<tr><td colspan="11" style="padding:8px;font-size:12px;color:#64748b;background:#f8fafc">… e mais <strong>${rows.length - MAX_LINHAS_AERO}</strong> voos (ver aba <em>Voos Sem Link</em>, filtro por aeroporto).</td></tr>` : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:6px 0 4px">
    <tr>${th('Tipo')}${th('Data')}${th('Voo')}${th('Origem/Destino')}${th('Hora')}${th('Matrícula')}${th('Companhia')}${th('Pax','right')}${th('Carga (kg)','right')}${th('Criado por')}${th('Dias em aberto','right')}</tr>
    ${linhas}${extra}</table>`;
}

function buildHtml(arrs) {
  const porAero = new Map();
  for (const v of arrs) {
    const a = v.aeroporto_operacao || '(sem aeroporto)';
    if (!porAero.has(a)) porAero.set(a, []);
    porAero.get(a).push(v);
  }
  const grupos = [...porAero.entries()]
    .map(([aero, rows]) => {
      const sorted = rows.sort((x, y) => String(x.data_operacao).localeCompare(String(y.data_operacao)));
      return { aero, rows: sorted, arr: sorted.filter((v) => v.tipo_movimento !== 'DEP').length, dep: sorted.filter((v) => v.tipo_movimento === 'DEP').length };
    })
    .sort((a, b) => b.rows.length - a.rows.length);

  const totArr = arrs.filter((v) => v.tipo_movimento !== 'DEP').length;
  const totDep = arrs.filter((v) => v.tipo_movimento === 'DEP').length;

  const resumo = grupos.map((g) => `<tr>${td(esc(g.aero),'left',true)}${td(fmt(g.arr),'right')}${td(fmt(g.dep),'right')}${td(esc(g.rows[0]?.data_operacao||'—'))}</tr>`).join('');
  const seccoes = grupos.map((g) => `
    <div style="margin:18px 0 6px"><span style="display:inline-block;background:#0f2f5f;color:#fff;padding:4px 12px;border-radius:6px;font-size:14px;font-weight:700">${esc(g.aero)}</span>
    <span style="color:#64748b;font-size:13px;margin-left:8px">${fmt(g.arr)} chegada(s) s/ partida · ${fmt(g.dep)} partida(s) s/ chegada</span></div>
    ${tabelaAero(g.rows)}`).join('');

  const perLabel = (INICIO || FIM || AERO)
    ? `Período: ${INICIO || 'início'} a ${FIM || 'hoje'}${AERO ? ` · Aeroporto: ${AERO}` : ''}`
    : `Backlog completo · ${dataExtenso(iso(hoje))}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;background:#eef2f7;font-family:Segoe UI,Arial,sans-serif;">
<div style="max-width:920px;margin:0 auto;padding:20px;">
  <div style="background:#fff;border-radius:12px 12px 0 0;padding:22px 34px;border:1px solid #e2e8f0;border-bottom:3px solid #1e3a5f;">
    <table width="100%"><tr>
      <td valign="middle"><img src="cid:sgalogo" alt="SGA — Sociedade Gestora de Aeroportos" height="42" style="display:block;border:0;"></td>
      <td align="right" valign="middle" style="color:#64748b;font-size:12px;">Voos sem Par (sem vínculo)<br><span style="color:#1e3a5f;font-size:16px;font-weight:700;">${fmt(arrs.length)} a rever</span></td>
    </tr></table>
  </div>
  <div style="background:#fff;padding:26px 34px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;color:#0f172a;">
    <div style="font-size:12px;color:#64748b;margin:0 0 12px;">${esc(perLabel)}</div>
    <p style="font-size:13px;color:#334155;margin:0 0 14px;line-height:1.5">
      Voos <strong>sem par (sem vínculo)</strong>: <strong style="color:#059669">chegadas sem partida</strong> (o avião chegou mas a partida não foi lançada) e <strong style="color:#2563eb">partidas sem chegada</strong>.
      Total: <strong>${fmt(totArr)}</strong> chegadas + <strong>${fmt(totDep)}</strong> partidas. Revejam por aeroporto: <strong>lancem o voo em falta e vinculem</strong> o par, ou <strong>removam</strong> se for duplicado.
      Priorizem as de mais <strong>dias em aberto</strong> (a vermelho).
    </p>
    <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 4px">Resumo por aeroporto</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:6px">
      <tr>${th('Aeroporto')}${th('Chegadas s/ partida','right')}${th('Partidas s/ chegada','right')}${th('Mais antiga')}</tr>${resumo}</table>
    ${seccoes}
    <p style="color:#94a3b8;font-size:12px;margin-top:20px;border-top:1px solid #eef2f7;padding-top:10px">
      Gerado automaticamente pelo Sistema DIROPS-SGA. Ação em <em>Operações → Voos Sem Link</em> (filtro por aeroporto). Máx. ${MAX_LINHAS_AERO} linhas por aeroporto.</p>
  </div>
</div></body></html>`;
}

// ---------- PDF (paisagem, tabela COMPLETA por aeroporto — sem o teto do email) ----------
const PC = {
  primary: [15, 47, 95], green: [5, 150, 105], blue: [37, 99, 235],
  ink: [15, 23, 42], text: [51, 65, 85], muted: [100, 116, 139],
  line: [238, 242, 247], soft: [248, 250, 252], red: [185, 28, 28], amber: [217, 119, 6],
};
function gerarPdfChegadas(arrs) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape', compress: true });
  const PW = doc.internal.pageSize.getWidth();   // ~842
  const PH = doc.internal.pageSize.getHeight();  // ~595
  const M = 32, CW = PW - 2 * M;
  let y = 0;
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  // Fontes padrao do jsPDF sao Latin-1: em-dash (—) e outros >0xFF viram tofu. Sanear.
  const sane = (s) => String(s == null ? '' : s).replace(/—/g, '-').replace(/[^\x00-\xFF]/g, '?');

  // agrupar por aeroporto (igual ao email)
  const porAero = new Map();
  for (const v of arrs) { const a = v.aeroporto_operacao || '(sem aeroporto)'; if (!porAero.has(a)) porAero.set(a, []); porAero.get(a).push(v); }
  const grupos = [...porAero.entries()].map(([aero, rows]) => {
    const sorted = rows.sort((x, z) => String(x.data_operacao).localeCompare(String(z.data_operacao)));
    return { aero, rows: sorted, arr: sorted.filter((v) => v.tipo_movimento !== 'DEP').length, dep: sorted.filter((v) => v.tipo_movimento === 'DEP').length };
  }).sort((a, b) => b.rows.length - a.rows.length);
  const totArr = arrs.filter((v) => v.tipo_movimento !== 'DEP').length;
  const totDep = arrs.filter((v) => v.tipo_movimento === 'DEP').length;
  const perLabel = (INICIO || FIM || AERO)
    ? `Período: ${INICIO || 'início'} a ${FIM || 'hoje'}${AERO ? ` · Aeroporto: ${AERO}` : ''}`
    : `Backlog completo · ${dataExtenso(iso(hoje))}`;

  function header() {
    const topY = 26, logoH = 30, logoW = logoH * LOGO_RATIO;
    if (LOGO) { try { doc.addImage(LOGO, 'PNG', M, topY, logoW, logoH); } catch { doc.setFont('helvetica','bold'); doc.setFontSize(20); setText(PC.primary); doc.text('SGA', M, topY + 22); } }
    else { doc.setFont('helvetica','bold'); doc.setFontSize(20); setText(PC.primary); doc.text('SGA', M, topY + 22); }
    setText(PC.muted); doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text('Voos sem Par (sem vínculo)', PW - M, topY + 10, { align: 'right' });
    setText(PC.primary); doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text(`${fmt(arrs.length)} a rever`, PW - M, topY + 28, { align: 'right' });
    const lineY = topY + logoH + 10;
    setDraw(PC.primary); doc.setLineWidth(2); doc.line(M, lineY, PW - M, lineY);
    y = lineY + 20;
  }
  function newPage() { doc.addPage(); header(); }
  header();

  setText(PC.muted); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(sane(perLabel), M, y);
  doc.text(`${fmt(totArr)} chegadas s/ partida · ${fmt(totDep)} partidas s/ chegada`, PW - M, y, { align: 'right' });
  y += 20;

  // ---------- Página de abertura: intro + Resumo por aeroporto ----------
  setText(PC.text); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  const intro = doc.splitTextToSize(
    'Voos sem par (sem vínculo): chegadas sem partida registada (o avião chegou mas a partida não foi lançada) e partidas sem chegada. '
    + 'Revejam por aeroporto: lancem o voo em falta e vinculem o par, ou removam se for duplicado. Priorizem os de mais dias em aberto.', CW);
  doc.text(intro.map(sane), M, y); y += intro.length * 12 + 10;

  setText(PC.primary); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('Resumo por aeroporto', M, y); y += 16;

  const sCols = [
    { t: 'Aeroporto', w: 130, a: 'left' }, { t: 'Chegadas s/ partida', w: 150, a: 'right' },
    { t: 'Partidas s/ chegada', w: 150, a: 'right' }, { t: 'Mais antiga', w: 110, a: 'left' },
  ];
  const sW = sCols.reduce((s, c) => s + c.w, 0), srh = 17;
  const drawResumoHeader = () => {
    setFill(PC.primary); doc.rect(M, y, sW, srh, 'F');
    setText([203, 213, 225]); doc.setFont('helvetica','bold'); doc.setFontSize(8);
    let sx = M;
    sCols.forEach((c) => { const tx = c.a === 'right' ? sx + c.w - 6 : sx + 6; doc.text(c.t.toUpperCase(), tx, y + 11, { align: c.a }); sx += c.w; });
    y += srh;
  };
  drawResumoHeader();
  grupos.forEach((g, idx) => {
    if (y + srh > PH - 30) { newPage(); drawResumoHeader(); }
    if (idx % 2 === 0) { setFill(PC.soft); doc.rect(M, y, sW, srh, 'F'); }
    const svals = [g.aero, fmt(g.arr), fmt(g.dep), g.rows[0]?.data_operacao || '-'];
    let cx = M;
    sCols.forEach((c, ci) => {
      setText(ci === 0 ? PC.ink : PC.text); doc.setFont('helvetica', ci === 0 ? 'bold' : 'normal'); doc.setFontSize(8.5);
      const tx = c.a === 'right' ? cx + c.w - 6 : cx + 6;
      doc.text(sane(svals[ci]), tx, y + 11, { align: c.a }); cx += c.w;
    });
    setDraw(PC.line); doc.setLineWidth(0.5); doc.line(M, y + srh, M + sW, y + srh);
    y += srh;
  });
  if (y + srh > PH - 30) { newPage(); }
  setFill([234, 240, 248]); doc.rect(M, y, sW, srh, 'F');
  const tvals = ['TOTAL', fmt(totArr), fmt(totDep), ''];
  let cxt = M;
  sCols.forEach((c, ci) => { setText(PC.primary); doc.setFont('helvetica','bold'); doc.setFontSize(8.5); const tx = c.a === 'right' ? cxt + c.w - 6 : cxt + 6; doc.text(String(tvals[ci]), tx, y + 11, { align: c.a }); cxt += c.w; });
  y += srh + 20;

  // ---------- Detalhe por aeroporto ----------
  if (y + 40 > PH - 30) newPage();
  setText(PC.primary); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('Detalhe por aeroporto', M, y); y += 18;

  const cols = [
    { t: 'Tipo', w: 56, a: 'left' }, { t: 'Data', w: 62, a: 'left' }, { t: 'Voo', w: 58, a: 'left' },
    { t: 'Origem/Destino', w: 84, a: 'left' }, { t: 'Hora', w: 44, a: 'left' }, { t: 'Matrícula', w: 64, a: 'left' },
    { t: 'Companhia', w: 0, a: 'left' }, { t: 'Pax', w: 40, a: 'right' }, { t: 'Carga', w: 54, a: 'right' },
    { t: 'Criado por', w: 96, a: 'left' }, { t: 'Dias', w: 42, a: 'right' },
  ];
  const fixed = cols.reduce((s, c) => s + c.w, 0);
  cols.find((c) => c.t === 'Companhia').w = CW - fixed; // flex ocupa o resto
  const rh = 16;
  const drawColHeader = () => {
    setFill(PC.primary); doc.rect(M, y, CW, rh, 'F');
    setText([203, 213, 225]); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    let cx = M;
    cols.forEach((c) => { const tx = c.a === 'right' ? cx + c.w - 6 : cx + 6; doc.text(c.t.toUpperCase(), tx, y + 11, { align: c.a }); cx += c.w; });
    y += rh;
  };

  for (const g of grupos) {
    if (y + 22 + rh * 2 > PH - 30) newPage();
    setFill(PC.primary); doc.roundedRect(M, y, CW, 18, 4, 4, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica','bold'); doc.setFontSize(9.5);
    doc.text(sane(g.aero), M + 8, y + 12);
    setText([203, 213, 225]); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text(`${fmt(g.arr)} chegada(s) s/ partida · ${fmt(g.dep)} partida(s) s/ chegada`, M + CW - 8, y + 12, { align: 'right' });
    y += 18 + 4;
    drawColHeader();
    g.rows.forEach((v, idx) => {
      if (y + rh > PH - 30) { newPage(); drawColHeader(); }
      if (idx % 2 === 0) { setFill(PC.soft); doc.rect(M, y, CW, rh, 'F'); }
      const hora = v.horario_real || v.horario_previsto || '—';
      const d = diasAberto(v.data_operacao);
      const isDep = v.tipo_movimento === 'DEP';
      const vals = [isDep ? 'Partida' : 'Chegada', v.data_operacao || '—', v.numero_voo || '—', v.aeroporto_origem_destino || '—', hora, v.registo_aeronave || '—', v.companhia_aerea || '—', fmt(v.passageiros_total), fmt(v.carga_kg), nomeCriador(v.created_by), String(d)];
      let cx = M;
      cols.forEach((c, ci) => {
        if (ci === 0) { setText(isDep ? PC.blue : PC.green); doc.setFont('helvetica','bold'); }
        else if (ci === cols.length - 1) { setText(d === '—' ? PC.muted : (d > 30 ? PC.red : d > 7 ? PC.amber : PC.ink)); doc.setFont('helvetica','bold'); }
        else { setText(ci === 2 ? PC.ink : PC.text); doc.setFont('helvetica', ci === 2 ? 'bold' : 'normal'); }
        doc.setFontSize(8);
        const tx = c.a === 'right' ? cx + c.w - 6 : cx + 6;
        doc.text(sane(vals[ci]).slice(0, Math.floor(c.w / 4.2)), tx, y + 11, { align: c.a });
        cx += c.w;
      });
      setDraw(PC.line); doc.setLineWidth(0.5); doc.line(M, y + rh, M + CW, y + rh);
      y += rh;
    });
    y += 14;
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    setText(PC.muted); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text('Gerado pelo Sistema DIROPS-SGA · Ação em Operações → Voos Sem Link', M, PH - 16);
    doc.text(`Página ${p}/${total}`, PW - M, PH - 16, { align: 'right' });
  }
  return Buffer.from(doc.output('arraybuffer')).toString('base64');
}

// ---------- envio (individual, com retry; relay SGA) ----------
async function sendOne(to, subject, html, anexos, attempts = 3) {
  let lastErr = '';
  for (let i = 1; i <= attempts; i++) {
    try {
      const payload = { to, subject, html };
      if (anexos && anexos.length) payload.attachments = anexos;
      const r = await fetch(`${FUNCTIONS}/functions/send-email`, {
        method: 'POST', headers: HDR, body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) return { ok: true };
      if (r.status === 422) return { ok: false, blocked: true };
      lastErr = j.error || `HTTP ${r.status}`;
    } catch (e) { lastErr = e.message || String(e); }
    if (i < attempts) await new Promise((res) => setTimeout(res, 4000 * i));
  }
  return { ok: false, error: lastErr };
}

// Monta o(s) anexo(s) PDF para um conjunto de voos (best-effort; nunca lanca).
function pdfAnexo(rows, sufixo) {
  const out = [];
  if (rows.length) {
    try {
      const pdf = gerarPdfChegadas(rows);
      out.push({ filename: `Voos_sem_Par_${sufixo}_${iso(hoje)}.pdf`, content: pdf, encoding: 'base64', contentType: 'application/pdf' });
    } catch (e) { console.error('[chegadas-abertas] PDF falhou:', e?.message || e); }
  }
  return out;
}
function agruparPorAero(rows) {
  const m = new Map();
  for (const v of rows) { const a = v.aeroporto_operacao || '(sem aeroporto)'; if (!m.has(a)) m.set(a, []); m.get(a).push(v); }
  return m;
}

// ---------- main ----------
(async () => {
  const arrs = await buscarChegadasAbertas();

  // === ON-DEMAND (EMIT): UM relatorio (respeita --aeroporto/--inicio/--fim) para o painel ===
  if (EMIT) {
    const assunto = `DIROPS — Voos sem par${AERO ? ` · ${AERO}` : ''} (${fmt(arrs.length)} a rever) — ${iso(hoje)}`;
    process.stdout.write(JSON.stringify({ assunto, html: buildHtml(arrs), anexos: pdfAnexo(arrs, AERO || 'todos'), periodo: { inicio: INICIO, fim: FIM }, aeroporto: AERO }));
    return;
  }

  // === DRY: pre-visualizacao — por aeroporto, com os destinatarios configurados ===
  if (DRY) {
    const porAero = agruparPorAero(arrs);
    console.log(`[chegadas-abertas] (DRY) total=${arrs.length} · aeroportos=${porAero.size}`);
    for (const [aero, rows] of [...porAero.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const dests = await buscarDestinatariosPorAero(aero);
      console.log(`  ${String(aero).padEnd(8)} ${String(rows.length).padStart(4)} voos -> ${dests.length ? dests.join(', ') : '(SEM DESTINATARIO CONFIGURADO)'}`);
    }
    for (const a of pdfAnexo(arrs, 'todos')) {
      const p = path.join(os.tmpdir(), a.filename);
      fs.writeFileSync(p, Buffer.from(a.content, 'base64'));
      console.log('  PDF (todos):', p, `(${Math.round(a.content.length * 0.75 / 1024)} KB)`);
    }
    return;
  }

  if (!arrs.length) { console.log('[chegadas-abertas] nada em aberto — nao envia'); return; }

  // === MANUAL (--to): UM relatorio (respeita --aeroporto) para destinatarios explicitos ===
  if (args.to) {
    const dests = String(args.to).split(',').map((s) => s.trim()).filter(Boolean);
    const assunto = `DIROPS — Voos sem par${AERO ? ` · ${AERO}` : ''} (${fmt(arrs.length)} a rever) — ${iso(hoje)}`;
    const html = buildHtml(arrs), anexos = pdfAnexo(arrs, AERO || 'todos');
    const sent = [], failed = [];
    for (const to of dests) {
      const res = await sendOne(to, assunto, html, anexos);
      if (res.ok) sent.push(to); else failed.push(`${to}:${res.error || (res.blocked ? 'bloqueado' : '?')}`);
      await sleep(600);
    }
    console.log(`[chegadas-abertas] (manual) enviados=${sent.length} (${sent.join(', ')}) falhas=${failed.length} ${failed.join(' | ')}`);
    return;
  }

  // === AUTOMATICO: cada aeroporto recebe SO o seu + CONSOLIDADO aos globais (oaeroportos) ===
  const porAero = agruparPorAero(arrs);
  const enviados = [], semDest = [], falhas = [];
  for (const [aero, rows] of porAero) {
    const dests = await buscarDestinatariosPorAero(aero);
    if (!dests.length) { semDest.push(`${aero}(${rows.length})`); continue; }
    const assunto = `DIROPS — Voos sem par · ${aero} (${fmt(rows.length)} a rever) — ${iso(hoje)}`;
    const html = buildHtml(rows), anexos = pdfAnexo(rows, aero);
    for (const to of dests) {
      const res = await sendOne(to, assunto, html, anexos);
      if (res.ok) enviados.push(`${aero}->${to}`); else falhas.push(`${aero}->${to}:${res.error || (res.blocked ? 'bloqueado' : '?')}`);
      await sleep(600);
    }
  }
  // Consolidado (todos os aeroportos) para os destinatarios globais (aeroporto NULL, ex.: oaeroportos)
  const globais = await buscarDestinatariosGlobais();
  if (globais.length) {
    const assunto = `DIROPS — Voos sem par · TODOS os aeroportos (${fmt(arrs.length)} a rever) — ${iso(hoje)}`;
    const html = buildHtml(arrs), anexos = pdfAnexo(arrs, 'todos');
    for (const to of globais) {
      const res = await sendOne(to, assunto, html, anexos);
      if (res.ok) enviados.push(`TODOS->${to}`); else falhas.push(`TODOS->${to}:${res.error || (res.blocked ? 'bloqueado' : '?')}`);
      await sleep(600);
    }
  }
  console.log(`[chegadas-abertas] enviados=${enviados.length} [${enviados.join(', ')}]`);
  if (semDest.length) console.log(`[chegadas-abertas] SEM destinatario configurado (${semDest.length}): ${semDest.join(', ')}`);
  if (falhas.length) console.log(`[chegadas-abertas] falhas (${falhas.length}): ${falhas.join(' | ')}`);
})().catch((e) => { console.error('[chegadas-abertas] ERRO:', e?.message || e); process.exit(1); });
