#!/usr/bin/env node
// ============================================================
// Relatório Diário — Pronto Pagamento (Facturação Tráfego PP)
// Só status PP (pagos). Período por DATA DE PAGAMENTO.
//   Sem args (dispatcher): dia anterior; SEGUNDA cobre sex→dom; sáb/dom não envia.
//   --inicio=YYYY-MM-DD --fim=YYYY-MM-DD : período manual
//   --dia=DD/MM/AAAA --out=docs/x.pdf     : amostra (salva PDF, não envia)
// Reaproveita o gerador de PDF do frontend (src/components/lib/relatorioPP.js).
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gerarPdfPP, htmlRelatorioPP } from '../../src/components/lib/relatorioPP.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PGRST = 'http://127.0.0.1:3000';
const FUNCTIONS = 'http://127.0.0.1:4001';
const SRK = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SRK, apikey: SRK, 'Content-Type': 'application/json' };
const TIPO_DEST = 'pronto_pagamento';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const log = (m) => console.log(`[relatorio-pp ${new Date().toISOString()}] ${m}`);

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtBR = (isoStr) => isoStr.split('-').reverse().join('/');

// Logo SGA (dataURL + proporção do PNG) para o cabeçalho.
function loadLogo() {
  try {
    const buf = fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png'));
    const ratio = (buf.readUInt32BE(20) ? buf.readUInt32BE(16) / buf.readUInt32BE(20) : 2.4);
    return { dataUrl: 'data:image/png;base64,' + buf.toString('base64'), ratio };
  } catch { return null; }
}

// Período: dispatcher (dia anterior; seg=sex→dom; fim de semana não envia) ou manual.
function periodo() {
  if (args.dia) { const d = args.dia; return { inicioBR: d, fimBR: d, likeDia: d, label: `Pagamentos de ${d}` }; }
  if (args.inicio && args.fim) return { inicio: args.inicio, fim: args.fim, label: args.inicio === args.fim ? `Pagamentos de ${fmtBR(args.inicio)}` : `Pagamentos de ${fmtBR(args.inicio)} a ${fmtBR(args.fim)}` };
  const now = new Date();
  const dow = now.getDay(); // 0=Dom..6=Sáb
  if (dow === 6 || dow === 0) return null; // fim de semana: rola para segunda
  const back = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  let ini, fim;
  if (dow === 1) { ini = back(3); fim = back(1); } // segunda: sex→dom
  else { ini = back(1); fim = back(1); }           // ter–sex: dia anterior
  return { inicio: iso(ini), fim: iso(fim), label: iso(ini) === iso(fim) ? `Pagamentos de ${fmtBR(iso(ini))}` : `Pagamentos de ${fmtBR(iso(ini))} a ${fmtBR(iso(fim))}` };
}

async function fetchPP(per) {
  let q = `${PGRST}/facturacao_trafego_pp?status=eq.PP&select=*&limit=50000`;
  if (per.likeDia) q += `&data_movimento=like.${encodeURIComponent(per.likeDia)}*`;
  else q += `&data_movimento_d=gte.${per.inicio}&data_movimento_d=lte.${per.fim}`;
  const r = await fetch(q, { headers: HDR });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

// Consolidado = TODOS os anos (para YoY); o mensal filtra o ano dentro da lib.
async function fetchConsolidado() {
  const r = await fetch(`${PGRST}/facturacao_trafego_pp?status=eq.PP&data_movimento_d=not.is.null&select=valor_linha,valor_linha_akz,data_movimento_d&limit=60000`, { headers: HDR });
  if (!r.ok) return [];
  return r.json();
}

async function buscarDestinatarios() {
  const r = await fetch(`${PGRST}/relatorio_destinatario?select=email&ativo=eq.true&tipo_relatorio=eq.${TIPO_DEST}`, { headers: HDR });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? [...new Set(j.map(x => (x.email || '').trim()).filter(Boolean))] : [];
}

const kz = (n) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(Number(n) || 0) + ' Kz';
const usd = (n) => 'USD ' + new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(Number(n) || 0);

function buildHtml(agg, label) {
  const linhas = agg.porServico.map(s => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eef2f7">${s.descricao}</td><td align="right" style="padding:6px 8px;border-bottom:1px solid #eef2f7">${s.qtd}</td><td align="right" style="padding:6px 8px;border-bottom:1px solid #eef2f7">${kz(s.akz)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:640px">
    <h2 style="color:#1e3a5f;margin:0 0 4px">Relatório Diário — Pronto Pagamento</h2>
    <p style="color:#64748b;margin:0 0 16px">${label}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
      <tr>
        <td style="background:#ecfdf5;border-radius:8px;padding:12px"><div style="font-size:11px;color:#059669;font-weight:bold">TOTAL (AKZ)</div><div style="font-size:18px;font-weight:bold;color:#047857">${kz(agg.akzT)}</div></td>
        <td width="10"></td>
        <td style="background:#eff6ff;border-radius:8px;padding:12px"><div style="font-size:11px;color:#2563eb;font-weight:bold">TOTAL (USD)</div><div style="font-size:18px;font-weight:bold;color:#1d4ed8">${usd(agg.usdT)}</div></td>
        <td width="10"></td>
        <td style="background:#faf5ff;border-radius:8px;padding:12px"><div style="font-size:11px;color:#7c3aed;font-weight:bold">MOVIMENTOS</div><div style="font-size:18px;font-weight:bold;color:#6d28d9">${agg.nMov}</div></td>
      </tr>
    </table>
    <h3 style="color:#1e3a5f;font-size:14px;margin:0 0 8px">Resumo por Serviço</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;font-size:13px">
      <tr style="background:#1e3a5f;color:#fff"><td style="padding:8px">Serviço</td><td align="right" style="padding:8px">Qtd</td><td align="right" style="padding:8px">AKZ</td></tr>
      ${linhas}
      <tr style="background:#eef2f7;font-weight:bold"><td style="padding:8px">TOTAL</td><td align="right" style="padding:8px">—</td><td align="right" style="padding:8px">${kz(agg.akzT)}</td></tr>
    </table>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px">Detalhe completo (por cliente e por movimento) no PDF anexo. Só inclui movimentos pagos (PP), pela data de pagamento.</p>
  </div>`;
}

async function enviar(recipients, subject, html, anexos) {
  const sent = [], failed = [], blocked = [];
  for (const to of recipients) {
    try {
      const payload = { to, subject, html, attachments: anexos };
      const r = await fetch(`${FUNCTIONS}/functions/send-email`, { method: 'POST', headers: HDR, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) sent.push(to);
      else if (r.status === 422) blocked.push(to);
      else failed.push({ to, error: j.error || `HTTP ${r.status}` });
    } catch (e) { failed.push({ to, error: e.message }); }
    await new Promise(res => setTimeout(res, 600)); // pacing relay SGA
  }
  return { sent, failed, blocked };
}

(async () => {
  const per = periodo();
  if (!per) { log('fim de semana — sem envio (rola para segunda)'); return; }
  log(`período: ${per.label}`);
  const rows = await fetchPP(per);
  const ano = per.fim ? per.fim.slice(0, 4) : (per.likeDia ? per.likeDia.split('/')[2] : String(new Date().getFullYear()));
  const consolidadoRows = await fetchConsolidado();
  log(`linhas PP período: ${rows.length} · consolidado(anos): ${consolidadoRows.length}`);
  const logo = loadLogo();
  const doc = gerarPdfPP(rows, { periodo: per.label, logo: logo?.dataUrl, logoRatio: logo?.ratio, consolidadoRows, anoConsolidado: ano });
  const pdfB64 = Buffer.from(doc.output('arraybuffer')).toString('base64');

  if (args.out) {
    const outPath = path.isAbsolute(args.out) ? args.out : path.join(__dir, '..', '..', args.out);
    fs.writeFileSync(outPath, Buffer.from(pdfB64, 'base64'));
    log(`PDF salvo: ${outPath}`); return;
  }

  const recipients = await buscarDestinatarios();
  if (!recipients.length) { log('sem destinatários ativos — nada enviado'); return; }
  const html = htmlRelatorioPP(rows, { periodo: per.label, consolidadoRows, anoConsolidado: ano });
  const anexos = [{ filename: `Pronto_Pagamento_${per.fim || per.likeDia}.pdf`, content: pdfB64, encoding: 'base64', contentType: 'application/pdf' }];
  const res = await enviar(recipients, `Relatório Pronto Pagamento — ${per.label}`, html, anexos);
  log(`enviados=${res.sent.length} bloqueados=${res.blocked.length} falhas=${res.failed.length}`);
  if (res.failed.length) log('falhas: ' + JSON.stringify(res.failed));
})().catch(e => { log('FATAL: ' + e.message); process.exit(1); });
