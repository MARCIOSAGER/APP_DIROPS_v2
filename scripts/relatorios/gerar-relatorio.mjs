#!/usr/bin/env node
// ============================================================
// Gerador de Relatorios Operacionais (DIROPS) — substitui o Power BI.
// Busca metricas via RPC (rpc_relatorio_operacional), monta um email HTML
// branded (+ PDF anexo, ver pdf.mjs) e envia INDIVIDUALMENTE pelo endpoint
// send-notification-email (relay SGA bloqueia BCC/massa; ver memoria).
//
// Uso:
//   node scripts/relatorios/gerar-relatorio.mjs --tipo=diario   [--data=YYYY-MM-DD]
//   node scripts/relatorios/gerar-relatorio.mjs --tipo=semanal  [--data=YYYY-MM-DD]
//   node scripts/relatorios/gerar-relatorio.mjs --tipo=mensal   [--data=YYYY-MM-DD]
// Flags:
//   --dry            nao envia; grava o HTML em scratchpad e imprime resumo
//   --to=a@x,b@y     sobrescreve destinatarios (senao usa DEST_PADRAO)
//   --no-pdf         nao anexa PDF
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gerarPdf } from './pdf.mjs';
import { gerarTecnicoPdf, gerarXlsxDetalhe, MAX_TABELA } from './tecnico.mjs';
import { buildKpisHtml, gerarKpisPdf } from './kpis.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PGRST = 'http://127.0.0.1:3000';
const FUNCTIONS = 'http://127.0.0.1:4001';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };

// Destinatarios padrao (todos @sga.co.ao — externos sao rejeitados pelo relay).
const DEST_PADRAO = ['oaeroportos@sga.co.ao'];

// ---------- args ----------
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const TIPO = args.tipo || 'diario';
const DRY = !!args.dry;
const SEM_PDF = !!args['no-pdf'];
// Filtro opcional por aeroporto (código ICAO, ex.: FNLU) — usado pelo painel on-demand.
const AERO = args.aeroporto ? String(args.aeroporto).trim() : null;
// Modo on-demand: em vez de enviar/gravar, escreve {html, assunto, anexos} em JSON no stdout.
// Os logs [relatorio] passam para stderr para não corromper o JSON.
const EMIT = args.emit === 'json';
if (EMIT) { const _e = console.error.bind(console); console.log = (...a) => _e(...a); }

// ---------- datas ----------
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dataExtenso = (isoStr) => { const [y,m,dd] = isoStr.split('-').map(Number); return `${String(dd).padStart(2,'0')} de ${MESES[m-1]} de ${y}`; };

function periodo(tipo, dataArg) {
  const hoje = new Date();
  let ref;
  if (dataArg) { const [y,m,d] = String(dataArg).split('-').map(Number); ref = new Date(y, m-1, d); }
  else if (tipo === 'mensal') { ref = new Date(hoje.getFullYear(), hoje.getMonth(), 0); } // ultimo dia do mes anterior
  else { ref = new Date(hoje); ref.setDate(ref.getDate() - 1); } // ontem

  if (tipo === 'diario')  return { inicio: iso(ref), fim: iso(ref) };
  if (tipo === 'semanal') { const ini = new Date(ref); ini.setDate(ini.getDate() - 6); return { inicio: iso(ini), fim: iso(ref) }; }
  if (tipo === 'mensal')  { const ini = new Date(ref.getFullYear(), ref.getMonth(), 1); const fim = new Date(ref.getFullYear(), ref.getMonth()+1, 0); return { inicio: iso(ini), fim: iso(fim) }; }
  throw new Error('tipo invalido: ' + tipo);
}

const TITULOS = { diario: 'Relatório Diário de Voos', semanal: 'Relatório Semanal de Voos', mensal: 'Relatório Mensal de Voos' };
function subtitulo(tipo, per) {
  // Um só dia → uma data; período (início ≠ fim) → intervalo, independente do tipo.
  if (per.inicio === per.fim) return dataExtenso(per.inicio);
  if (tipo === 'mensal') { const [y,m] = per.inicio.split('-').map(Number); return `${MESES[m-1][0].toUpperCase()+MESES[m-1].slice(1)} de ${y}`; }
  return `${dataExtenso(per.inicio)} a ${dataExtenso(per.fim)}`;
}

// ---------- format ----------
const fmt = (n) => { n = Math.round(Number(n)||0); const s = Math.abs(n).toString(); const p = []; for (let i=s.length;i>0;i-=3) p.unshift(s.slice(Math.max(0,i-3),i)); return (n<0?'-':'')+p.join('.'); };
const kz = (n) => fmt(n) + ' Kz';
const usd = (n) => 'US$ ' + fmt(n);
const pct = (n) => (n==null ? '—' : String(n).replace('.', ',') + '%');
const esc = (s) => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Componentes da faturação (rótulos + array ordenado, sem zeros).
const COMP_LABELS = {
  passageiros_usd: 'Passageiros', permanencia_usd: 'Permanência (estacionamento)',
  pouso_usd: 'Aterragem / Descolagem', carga_usd: 'Carga',
  servicos_usd: 'Serviços', recursos_usd: 'Recursos', outras_usd: 'Outras (segurança, iluminação, CUPPSS…)',
  impostos_usd: 'Impostos',
};
const componentesArr = (c) => !c ? [] : Object.entries(COMP_LABELS)
  .map(([k, label]) => ({ label, usd: Number(c[k]) || 0 })).filter((x) => x.usd > 0).sort((a, b) => b.usd - a.usd);

// ---------- HTML (email-safe: tabelas + estilos inline) ----------
function card(label, valor, sub, cor = '#2563eb') {
  return `<td width="33%" valign="top" style="padding:6px;">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${cor};border-radius:10px;padding:14px 16px;">
      <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">${esc(label)}</div>
      <div style="color:${cor};font-size:24px;font-weight:700;margin-top:4px;">${valor}</div>
      ${sub ? `<div style="color:#94a3b8;font-size:12px;margin-top:2px;">${sub}</div>` : ''}
    </div></td>`;
}
// Barras da faturação por componente (proporcional ao USD).
function barrasComponentes(comp) {
  const total = comp.reduce((s, x) => s + x.usd, 0) || 1;
  const max = Math.max(...comp.map((x) => x.usd), 1);
  return `<table width="100%" cellpadding="0" cellspacing="0">` + comp.map((x) => {
    const w = Math.round(100 * x.usd / max);
    const p = (100 * x.usd / total).toFixed(1).replace('.', ',');
    return `<tr>
      <td style="padding:4px 8px 4px 0;font-size:12px;color:#334155;white-space:nowrap;">${esc(x.label)}</td>
      <td style="padding:4px 0;width:100%;"><div style="background:#2563eb;height:14px;width:${w}%;border-radius:3px;min-width:2px;"></div></td>
      <td style="padding:4px 0 4px 10px;font-size:12px;color:#0f172a;font-weight:600;text-align:right;white-space:nowrap;">${usd(x.usd)} · ${p}%</td>
    </tr>`;
  }).join('') + `</table>`;
}
function barras(itens, campo, cor) {
  const max = Math.max(1, ...itens.map((i) => Number(i[campo])||0));
  return itens.map((i) => {
    const v = Number(i[campo])||0; const w = Math.round(100*v/max);
    const nome = esc(i.tipo_voo || i.companhia || i.aeroporto || '');
    return `<tr>
      <td style="padding:3px 8px 3px 0;font-size:12px;color:#334155;white-space:nowrap;">${nome}</td>
      <td style="padding:3px 0;width:100%;"><div style="background:${cor};height:14px;width:${w}%;border-radius:3px;min-width:2px;"></div></td>
      <td style="padding:3px 0 3px 8px;font-size:12px;color:#0f172a;font-weight:600;text-align:right;">${fmt(v)}</td>
    </tr>`;
  }).join('');
}
function tabelaAeroportos(rows) {
  const th = (t, a='left') => `<th align="${a}" style="padding:8px 10px;background:#1e3a5f;color:#cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">${t}</th>`;
  const td = (t, a='left', b=false) => `<td align="${a}" style="padding:7px 10px;border-bottom:1px solid #eef2f7;font-size:13px;color:#334155;${b?'font-weight:600;':''}">${t}</td>`;
  const body = rows.map((r, idx) => `<tr style="background:${idx%2?'#ffffff':'#f8fafc'};">
    ${td(esc(r.aeroporto), 'left', true)}${td(fmt(r.voos),'right')}${td(fmt(r.arr),'right')}${td(fmt(r.dep),'right')}${td(fmt(r.passageiros),'right')}${td(fmt(r.carga_kg),'right')}${td(usd(r.faturacao_usd),'right')}
  </tr>`).join('');
  const t = rows.reduce((a, r) => ({ voos: a.voos + Number(r.voos||0), arr: a.arr + Number(r.arr||0), dep: a.dep + Number(r.dep||0), pax: a.pax + Number(r.passageiros||0), carga: a.carga + Number(r.carga_kg||0), fat: a.fat + Number(r.faturacao_usd||0) }), { voos:0, arr:0, dep:0, pax:0, carga:0, fat:0 });
  const totalRow = `<tr style="background:#eaf0f8;">${td('TOTAL','left',true)}${td(fmt(t.voos),'right',true)}${td(fmt(t.arr),'right',true)}${td(fmt(t.dep),'right',true)}${td(fmt(t.pax),'right',true)}${td(fmt(t.carga),'right',true)}${td(usd(t.fat),'right',true)}</tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <tr>${th('Aeroporto')}${th('Voos','right')}${th('ARR','right')}${th('DEP','right')}${th('Pax','right')}${th('Carga (kg)','right')}${th('Faturação (USD)','right')}</tr>
    ${body}${totalRow}</table>`;
}
function tabelaComponentes(comp) {
  const total = comp.reduce((s, x) => s + x.usd, 0) || 1;
  const th = (t, a='left') => `<th align="${a}" style="padding:8px 10px;background:#1e3a5f;color:#cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">${t}</th>`;
  const td = (t, a='left', b=false) => `<td align="${a}" style="padding:7px 10px;border-bottom:1px solid #eef2f7;font-size:13px;color:#334155;${b?'font-weight:600;':''}">${t}</td>`;
  const body = comp.map((x, i) => `<tr style="background:${i%2?'#ffffff':'#f8fafc'};">
    ${td(esc(x.label),'left',true)}${td(usd(x.usd),'right')}${td((100*x.usd/total).toFixed(1).replace('.',',')+'%','right')}</tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <tr>${th('Componente')}${th('Valor (USD)','right')}${th('% do total','right')}</tr>${body}</table>`;
}
function seccao(titulo, conteudo) {
  return `<div style="margin-top:26px;">
    <div style="font-size:15px;font-weight:700;color:#1e3a5f;border-left:4px solid #2563eb;padding-left:10px;margin-bottom:12px;">${esc(titulo)}</div>
    ${conteudo}</div>`;
}

function buildHtml(tipo, per, d) {
  const k = d.kpis || {};
  const aeroportos = d.por_aeroporto || [];
  const tipos = d.por_tipo_voo || [];
  const cias = (d.por_companhia || []).slice(0, 8);
  const comp = componentesArr(d.faturacao_componentes);
  const titulo = TITULOS[tipo] || 'Relatório de Voos';
  const sub = subtitulo(tipo, per);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;background:#eef2f7;font-family:Segoe UI,Arial,sans-serif;">
<div style="max-width:680px;margin:0 auto;padding:20px;">
  <div style="background:#fff;border-radius:12px 12px 0 0;padding:22px 34px;border:1px solid #e2e8f0;border-bottom:3px solid #1e3a5f;">
    <table width="100%"><tr>
      <td valign="middle"><img src="cid:sgalogo" alt="SGA — Sociedade Gestora de Aeroportos" height="42" style="display:block;border:0;"></td>
      <td align="right" valign="middle" style="color:#64748b;font-size:12px;">${esc(titulo)}<br><span style="color:#1e3a5f;font-size:16px;font-weight:700;">${esc(sub)}</span></td>
    </tr></table>
  </div>
  <div style="background:#fff;padding:26px 34px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">

    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${card('Total de Voos', fmt(k.total_voos), `${fmt(k.arr)} chegadas · ${fmt(k.dep)} partidas`, '#2563eb')}
      ${card('Passageiros', fmt(k.passageiros), 'total transportado', '#0891b2')}
      ${card('Carga', fmt(k.carga_kg) + ' <span style="font-size:13px;font-weight:400;">kg</span>', 'total movimentada', '#d97706')}
    </tr><tr>
      ${card('Faturação', usd(k.faturacao_usd), 'tarifas do período (USD)', '#10b981')}
      ${card('Pontualidade', pct(k.pontualidade_pct), `${fmt(k.voos_pontuais)}/${fmt(k.voos_avaliados_pont)} voos (≤15 min)`, '#7c3aed')}
      ${card('Movimentos', fmt(k.arr) + ' / ' + fmt(k.dep), 'ARR / DEP', '#4f46e5')}
    </tr></table>

    ${comp.length ? seccao('Faturação por Componente', barrasComponentes(comp)) : ''}
    ${aeroportos.length ? seccao('Por Aeroporto', tabelaAeroportos(aeroportos)) : ''}
    ${tipos.length ? seccao('Por Tipo de Voo', `<table width="100%" cellpadding="0" cellspacing="0">${barras(tipos,'voos','#2563eb')}</table>`) : ''}
    ${cias.length ? seccao('Companhias com mais movimentos', `<table width="100%" cellpadding="0" cellspacing="0">${barras(cias,'voos','#0ea5e9')}</table>`) : ''}

  </div>
  <div style="text-align:center;padding:16px;color:#94a3b8;font-size:11px;">
    Relatório gerado automaticamente pelo Sistema DIROPS · ${esc(dataExtenso(iso(new Date())))}<br>
    Fonte: base de dados operacional DIROPS (substitui os relatórios Power BI)
  </div>
</div></body></html>`;
}

// ---------- fetch RPC ----------
async function buscarDados(per) {
  const r = await fetch(`${PGRST}/rpc/rpc_relatorio_operacional`, {
    method: 'POST', headers: HDR, body: JSON.stringify({ p_inicio: per.inicio, p_fim: per.fim, ...(AERO ? { p_aeroporto: AERO } : {}) }),
  });
  if (!r.ok) throw new Error(`RPC falhou: HTTP ${r.status} — ${await r.text()}`);
  const j = await r.json();
  return Array.isArray(j) ? j[0] : j;
}

// Destinatários configurados por tipo (tabela relatorio_destinatario, gerida na página "Relatórios").
async function buscarDestinatarios(tipo) {
  try {
    const r = await fetch(`${PGRST}/relatorio_destinatario?select=email&ativo=eq.true&tipo_relatorio=eq.${encodeURIComponent(tipo)}`, { headers: HDR });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? [...new Set(j.map((x) => (x.email || '').trim()).filter(Boolean))] : [];
  } catch { return []; }
}

// Detalhe por voo (relatorio tecnico) — array de voos faturados.
async function buscarDetalhe(per) {
  const r = await fetch(`${PGRST}/rpc/rpc_relatorio_tecnico_detalhe`, {
    method: 'POST', headers: HDR, body: JSON.stringify({ p_inicio: per.inicio, p_fim: per.fim, ...(AERO ? { p_aeroporto: AERO } : {}) }),
  });
  if (!r.ok) throw new Error(`RPC detalhe falhou: HTTP ${r.status} — ${await r.text()}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

// Dados do Mapa de KPIs (rpc_relatorio_kpis).
async function buscarKpis(per) {
  const r = await fetch(`${PGRST}/rpc/rpc_relatorio_kpis`, {
    method: 'POST', headers: HDR, body: JSON.stringify({ p_inicio: per.inicio, p_fim: per.fim, ...(AERO ? { p_aeroporto: AERO } : {}) }),
  });
  if (!r.ok) throw new Error(`RPC kpis falhou: HTTP ${r.status} — ${await r.text()}`);
  const j = await r.json();
  return Array.isArray(j) ? (j[0] || {}) : j;
}

// ---------- envio (INDIVIDUAL via send-email; suporta anexo; pacing anti-spam) ----------
// Retentativa com backoff em falhas TRANSITÓRIAS (timeout de SMTP, blip de rede,
// 5xx). NÃO retenta 422 (externo bloqueado pelo relay = permanente). Antes: 1
// tentativa só → um timeout pontual do relay deixava um destinatário de fora.
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
      if (r.ok && j.success) return { ok: true, tries: i };
      if (r.status === 422) return { ok: false, blocked: true };
      lastErr = j.error || `HTTP ${r.status}`;
    } catch (e) { lastErr = e.message || String(e); }
    if (i < attempts) await new Promise((res) => setTimeout(res, 4000 * i)); // backoff 4s, 8s
  }
  return { ok: false, error: lastErr };
}

async function enviar(recipients, subject, html, anexos) {
  const sent = [], failed = [], blocked = [];
  for (const to of recipients) {
    const res = await sendOne(to, subject, html, anexos);
    if (res.ok) sent.push(to);
    else if (res.blocked) blocked.push(to);
    else failed.push({ to, error: res.error });
    await new Promise((res) => setTimeout(res, 600)); // pacing p/ relay SGA
  }
  return { sent, failed, blocked };
}

// ---------- main ----------
(async () => {
  const isKpis = TIPO === 'kpis';
  const subPeriodo = args.periodo === 'mensal' ? 'mensal' : 'semanal';
  // Período personalizado (--inicio/--fim) tem prioridade sobre o período automático.
  const per = (args.inicio && args.fim)
    ? { inicio: String(args.inicio), fim: String(args.fim) }
    : periodo(isKpis ? subPeriodo : TIPO, args.data);
  const prefixo = args.prefixo ? String(args.prefixo) : '';
  const recipientTipo = isKpis ? 'kpis' : TIPO;
  console.log(`[relatorio] tipo=${TIPO}${isKpis ? '/' + subPeriodo : ''} periodo=${per.inicio}..${per.fim}`);

  const helpers = { fmt, kz, usd, pct, subtitulo, TITULOS, componentesArr };
  let html, assunto, anexos = [];

  if (isKpis) {
    const sub = subtitulo(subPeriodo, per);
    const dados = await buscarKpis(per);
    console.log(`[relatorio] KPIs agregados=${(dados.medicoes || []).length}`);
    html = buildKpisHtml(per, dados, sub);
    assunto = `${prefixo}Mapa de Monitoramento de KPIs — ${sub}`;
    if (!SEM_PDF) {
      try {
        const pdf = await gerarKpisPdf(per, dados, sub);
        anexos.push({ filename: `Mapa_KPIs_${per.fim}.pdf`, content: pdf, encoding: 'base64', contentType: 'application/pdf' });
        console.log(`[relatorio] PDF KPIs (${Math.round(pdf.length * 0.75 / 1024)} KB)`);
      } catch (e) { console.warn('[relatorio] PDF KPIs falhou:', e.message); }
    }
  } else {
    const dados = await buscarDados(per);
    const k = dados.kpis || {};
    console.log(`[relatorio] voos=${k.total_voos} pax=${k.passageiros} carga=${k.carga_kg}kg fat=${usd(k.faturacao_usd)} pont=${pct(k.pontualidade_pct)}`);
    html = buildHtml(TIPO, per, dados);
    assunto = `${prefixo}${TITULOS[TIPO]} — ${subtitulo(TIPO, per)}`;
    if (!SEM_PDF) {
      try {
        const pdfOp = await gerarPdf(TIPO, per, dados, helpers);
        anexos.push({ filename: `${TITULOS[TIPO].replace(/ /g,'_')}_${per.fim}.pdf`, content: pdfOp, encoding: 'base64', contentType: 'application/pdf' });
        console.log(`[relatorio] PDF operacional (${Math.round(pdfOp.length*0.75/1024)} KB)`);
      } catch (e) { console.warn('[relatorio] PDF operacional falhou:', e.message); }
      try {
        const detalhe = await buscarDetalhe(per);
        const pdfTec = await gerarTecnicoPdf(TIPO, per, dados, detalhe, helpers);
        anexos.push({ filename: `Relatorio_Tecnico_Faturacao_${per.fim}.pdf`, content: pdfTec, encoding: 'base64', contentType: 'application/pdf' });
        console.log(`[relatorio] PDF tecnico (${Math.round(pdfTec.length*0.75/1024)} KB, ${detalhe.length} voos faturados)`);
        if (detalhe.length) {
          const xlsxB64 = gerarXlsxDetalhe(detalhe);
          anexos.push({ filename: `Detalhe_Faturacao_${per.fim}.xlsx`, content: xlsxB64, encoding: 'base64', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          console.log(`[relatorio] XLSX detalhe anexado (${detalhe.length} voos)`);
        }
      } catch (e) { console.warn('[relatorio] tecnico/CSV falhou:', e.message); }
    }
  }

  if (EMIT) {
    // Modo on-demand: devolve tudo (HTML + anexos base64) por stdout para o endpoint/painel.
    process.stdout.write(JSON.stringify({ tipo: TIPO, periodo: per, aeroporto: AERO, assunto, html, anexos }));
    return;
  }

  if (DRY) {
    const dir = 'C:\\Users\\dirops\\AppData\\Local\\Temp\\2\\claude\\c--dirops-APP-DIROPS-v2\\600b7b28-2a53-4192-b3ee-1dabc7526a39\\scratchpad';
    const out = path.join(dir, `relatorio_${TIPO}_${per.fim}.html`);
    fs.writeFileSync(out, html, 'utf8');
    console.log('[relatorio] DRY — HTML salvo em:', out);
    for (const a of anexos) {
      const p = path.join(dir, a.filename);
      fs.writeFileSync(p, Buffer.from(a.content, 'base64'));
      console.log('[relatorio] DRY — anexo salvo em:', p);
    }
    return;
  }

  let to;
  if (args.to) to = String(args.to).split(',').map((s) => s.trim()).filter(Boolean);
  else {
    to = await buscarDestinatarios(recipientTipo);
    if (!to.length) { to = DEST_PADRAO; console.log('[relatorio] sem destinatários configurados — usando padrão'); }
  }
  console.log('[relatorio] enviando para:', to.join(', '));
  const res = await enviar(to, assunto, html, anexos);
  console.log(`[relatorio] resultado: enviados=${res.sent.length} falhas=${res.failed.length} bloqueados=${res.blocked.length}`);
  if (res.failed.length) console.log('[relatorio] falhas:', JSON.stringify(res.failed));
  if (res.blocked.length) console.log('[relatorio] bloqueados (externos):', res.blocked.join(', '));
})().catch((e) => { console.error('[relatorio] ERRO:', e.message); process.exit(1); });
