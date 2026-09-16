#!/usr/bin/env node
// ============================================================
// Relatorio "Documentos a expirar" (GED - fundacao).
// Lista documentos com data_expiracao definida agrupados em 4 buckets:
//   - Expirados                 (cor cinza escuro)
//   - <30 dias                  (cor vermelho)
//   - 30-90 dias                (cor amarelo)
//   - Sem alerta (>90 dias)     omitido do email (so no on-demand)
//
// Filtro dias_alerta_expiracao: o admin define por doc quantos dias antes
// da expiracao o doc entra no relatorio. Default 30. Sempre entra se ja expirou.
//
// Fonte: PostgREST (tabela documento). Envio: SMTP direto (mesmo padrao dos
// outros relatorios). Destinatarios: TODOS os admins @sga.co.ao (nunca BCC —
// um email individual por pessoa por causa do relay).
//
// Flags: --dry (nao envia, imprime resumo)  --to=a@x (override, so 1 destinatario)
//        --emit=json (retorna {assunto,html} no stdout p/ painel on-demand)
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
let LOGO = null;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }

const PGRST = 'http://127.0.0.1:3000';
const FUNCTIONS = 'http://127.0.0.1:4001';
const APP_URL = 'http://10.1.65.45';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v];
}));
const DRY = !!args.dry;
const EMIT = args.emit === 'json';
const TO_OVERRIDE = args.to ? String(args.to).split(',').map((s) => s.trim()).filter(Boolean) : null;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
const parseDate = (s) => { if (!s) return null; const d = new Date(s); d.setHours(0, 0, 0, 0); return Number.isNaN(d.getTime()) ? null : d; };
const diffDias = (d) => Math.round((d - hoje) / 86400000);

// ---------- consultas ----------
async function buscarDocumentos() {
  const cols = 'id,titulo,categoria,versao,data_publicacao,data_expiracao,dias_alerta_expiracao,aeroporto,status';
  const url = `${PGRST}/documento?data_expiracao=not.is.null&status=eq.ativo&select=${cols}&order=data_expiracao.asc&limit=2000`;
  const r = await fetch(url, { headers: HDR });
  if (!r.ok) throw new Error(`Query documento falhou: HTTP ${r.status} — ${await r.text()}`);
  return await r.json();
}

async function buscarAdmins() {
  if (TO_OVERRIDE) return TO_OVERRIDE;
  // Admins @sga.co.ao. Relay bloqueia externos (gmail etc); ignorar.
  const url = `${PGRST}/users?or=(role.eq.admin,perfis.cs.{administrador})&email=like.*@sga.co.ao&select=email&order=email.asc`;
  const r = await fetch(url, { headers: HDR });
  if (!r.ok) throw new Error(`Query users falhou: HTTP ${r.status} — ${await r.text()}`);
  const j = await r.json();
  return Array.isArray(j) ? j.map((u) => u.email).filter(Boolean) : [];
}

// ---------- classificacao ----------
function classificar(docs) {
  const buckets = { expirados: [], criticos: [], atencao: [] };
  for (const d of docs) {
    const exp = parseDate(d.data_expiracao);
    if (!exp) continue;
    const dias = diffDias(exp);
    const alerta = Number(d.dias_alerta_expiracao) || 30;
    if (dias < 0) {
      buckets.expirados.push({ ...d, dias });
    } else if (dias < 30) {
      buckets.criticos.push({ ...d, dias });
    } else if (dias <= Math.max(alerta, 90)) {
      // entra na secao "atencao" se <=90 dias OU se dentro do alerta configurado
      buckets.atencao.push({ ...d, dias });
    }
  }
  return buckets;
}

// ---------- HTML ----------
function seccaoHtml(titulo, corBg, corText, docs, mostrarDias) {
  if (!docs.length) return '';
  const linhas = docs.map((d) => {
    const url = `${APP_URL}/Documentos?id=${d.id}`;
    const dias = mostrarDias(d.dias);
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0"><a href="${url}" style="color:#0f172a;text-decoration:none">${esc(d.titulo)}</a></td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">${esc(d.categoria || '—')} · v${esc(d.versao || '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">${esc(d.data_expiracao)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:${corText}">${dias}</td>
    </tr>`;
  }).join('\n');
  return `
    <h2 style="font-size:15px;color:${corText};background:${corBg};padding:8px 12px;margin:24px 0 0;border-radius:6px 6px 0 0">${titulo} (${docs.length})</h2>
    <table style="border-collapse:collapse;width:100%;font-family:Segoe UI,Arial,sans-serif;font-size:13px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600;border-bottom:2px solid #e2e8f0">Documento</th>
          <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600;border-bottom:2px solid #e2e8f0">Categoria</th>
          <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600;border-bottom:2px solid #e2e8f0">Data expiração</th>
          <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600;border-bottom:2px solid #e2e8f0">Situação</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function construirHtml(buckets, total) {
  const logo = LOGO ? `<img src="${LOGO}" alt="SGA" style="height:36px;vertical-align:middle;margin-right:12px" />` : '';
  const sec1 = seccaoHtml('⚫ Documentos EXPIRADOS', '#1e293b', '#ffffff', buckets.expirados, (d) => `Expirou há ${-d} dias`);
  const sec2 = seccaoHtml('🔴 Expiram em menos de 30 dias', '#fee2e2', '#991b1b', buckets.criticos, (d) => `${d} dia${d !== 1 ? 's' : ''}`);
  const sec3 = seccaoHtml('🟡 Expiram em 30-90 dias', '#fef3c7', '#92400e', buckets.atencao, (d) => `${d} dias`);
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px;margin:0;color:#0f172a">
  <div style="max-width:800px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 4px 24px rgba(15,23,42,0.06)">
    <div style="display:flex;align-items:center;padding-bottom:16px;border-bottom:2px solid #e2e8f0">
      ${logo}
      <div>
        <h1 style="margin:0;font-size:20px;color:#0f172a">Documentos a expirar</h1>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px">Vigilância automática · ${new Date().toLocaleDateString('pt-PT')}</p>
      </div>
    </div>
    <p style="color:#475569;font-size:14px;line-height:1.5">
      ${total === 0
        ? 'Nenhum documento a expirar ou expirado nesta janela. 🎉'
        : `Total de <strong>${total}</strong> documento${total !== 1 ? 's' : ''} que ${total !== 1 ? 'requerem' : 'requer'} atenção:`}
    </p>
    ${sec1}${sec2}${sec3}
    <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">
      Este relatório é enviado semanalmente aos administradores.<br>
      Configurar frequência ou desativar: <a href="${APP_URL}/RelatoriosAutomaticos" style="color:#0f172a">Relatórios Automáticos</a>.
    </p>
  </div>
</body></html>`;
}

// ---------- envio ----------
async function enviarPara(email, assunto, html) {
  const r = await fetch(`${FUNCTIONS}/functions/send-email`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: email, subject: assunto, html }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`send-email HTTP ${r.status}: ${body}`);
  }
  return await r.json().catch(() => ({}));
}

// ---------- main ----------
(async () => {
  const docs = await buscarDocumentos();
  const buckets = classificar(docs);
  const total = buckets.expirados.length + buckets.criticos.length + buckets.atencao.length;

  const html = construirHtml(buckets, total);
  const totalCriticos = buckets.expirados.length + buckets.criticos.length;
  const assunto = `[DIROPS] Documentos a expirar — ${buckets.expirados.length} expirados, ${buckets.criticos.length} < 30d, ${buckets.atencao.length} 30-90d`;

  if (EMIT) {
    console.log(JSON.stringify({ assunto, html, buckets, total }));
    return;
  }

  const admins = await buscarAdmins();
  console.log(`[docs-a-expirar] total=${total} (expirados=${buckets.expirados.length}, <30d=${buckets.criticos.length}, 30-90d=${buckets.atencao.length}) admins=${admins.length}`);

  if (total === 0 && !TO_OVERRIDE) {
    console.log('[docs-a-expirar] nada a enviar (0 documentos em risco); relatorio omitido');
    return;
  }

  if (DRY) {
    console.log('[docs-a-expirar] DRY — não envia. Destinatários seriam:', admins.join(', '));
    return;
  }

  let ok = 0, fail = 0;
  for (const email of admins) {
    try {
      await enviarPara(email, assunto, html);
      ok++;
      console.log(`[docs-a-expirar] enviado -> ${email}`);
    } catch (e) {
      fail++;
      console.error(`[docs-a-expirar] falhou -> ${email}: ${e.message}`);
    }
  }
  console.log(`[docs-a-expirar] concluido: ${ok} enviados, ${fail} falharam`);
  if (fail > 0 && ok === 0) process.exit(1);
})().catch((e) => {
  console.error('[docs-a-expirar] ERRO:', e.message);
  process.exit(1);
});
