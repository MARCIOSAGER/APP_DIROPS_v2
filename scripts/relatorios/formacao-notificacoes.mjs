#!/usr/bin/env node
// ============================================================
// Notificações diárias da Universidade Corporativa aos COLABORADORES (individuais):
//   inscricao      — inscrito por um gestor/trilha (matrícula criada nas últimas 48 h, origem != aluno)
//   certificado    — certificado emitido nas últimas 48 h
//   lembrete       — em curso e sem progresso há 7 e 21 dias após inscrição/reabertura
//   a_expirar_30 / a_expirar_7 — certificação a expirar
//   expirado       — validade terminada (uma vez por ciclo)
//   em_falta       — curso obrigatório sem inscrição (1.ª vez e depois a cada 30 dias)
// Anti-duplicado: tabela notificacao_formacao (chave única). Só entrega a @sga.co.ao
// (o relay rejeita externos); os outros ficam registados como não entregues.
// Flags: --dry (não envia nem regista)  --so=<email> (só esse colaborador)
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matrizFormacao, diasAte, DIAS_LEMBRETE } from '../../src/lib/formacaoEstado.js';
import { textoConvocatoria } from '../../src/lib/formacaoSessoes.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PGRST = 'http://127.0.0.1:3000';
const FUNCTIONS = 'http://127.0.0.1:4001';
const APP_URL = 'http://10.1.65.45';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
let LOGO = null;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
const DRY = !!args.dry;
const SO = args.so ? String(args.so).toLowerCase() : null;
const log = (m) => console.log(`[formacao-notif] ${m}`);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtD = (iso) => { if (!iso) return '—'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT'); };
const hoje = new Date();
const mesChave = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const h48 = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

async function q(p) { const r = await fetch(`${PGRST}${p}`, { headers: HDR }); if (!r.ok) throw new Error(`PostgREST ${p.split('?')[0]} HTTP ${r.status} — ${await r.text()}`); return r.json(); }

function layout(titulo, corpo) {
  const logo = LOGO ? `<img src="${LOGO}" alt="SGA" style="height:36px;margin-right:14px">` : '';
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 4px 24px rgba(15,23,42,.06)">
    <div style="display:flex;align-items:center;padding-bottom:14px;border-bottom:2px solid #e2e8f0">${logo}<div><div style="font-weight:700;font-size:15px">Universidade Corporativa</div><div style="color:#64748b;font-size:12px">SGA · Sociedade Gestora de Aeroportos</div></div></div>
    <h1 style="font-size:18px;margin:20px 0 10px">${esc(titulo)}</h1>
    ${corpo}
    <p style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px">Mensagem automática da Universidade Corporativa. Aceda em <a href="${APP_URL}/universidade" style="color:#0f172a">${APP_URL}/universidade</a>.</p>
  </div></body></html>`;
}
const botao = (texto, url) => `<p style="margin:18px 0"><a href="${url}" style="display:inline-block;background:#004A99;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">${esc(texto)}</a></p>`;
const p = (t) => `<p style="color:#334155;font-size:14px;line-height:1.6;margin:8px 0">${t}</p>`;

function mensagem(tipo, ctx) {
  const { user, curso, matricula, dias, validoAte, cert } = ctx;
  const nome = esc((user.full_name || user.email).split(' ')[0]);
  const urlCurso = `${APP_URL}/universidade/formacao?curso=${curso.id}`;
  switch (tipo) {
    case 'inscricao': return { assunto: `[Formação] Foi inscrito no curso "${curso.titulo}"`, html: layout(`Olá ${nome}, tem um novo curso`, p(`Foi inscrito(a) no curso <strong>${esc(curso.titulo)}</strong>.${curso.prazo_dias ? ` Tem <strong>${curso.prazo_dias} dias</strong> para o concluir.` : ''}`) + botao('Começar o curso', urlCurso)) };
    case 'certificado': return { assunto: `[Formação] Certificado emitido — ${curso.titulo}`, html: layout('Parabéns, certificado emitido', p(`Concluiu o curso <strong>${esc(curso.titulo)}</strong>. O seu certificado <strong>${esc(cert?.numero || '')}</strong> está disponível para descarregar${validoAte ? ` e é válido até <strong>${fmtD(validoAte)}</strong>` : ''}.`) + botao('Ver o certificado', `${APP_URL}/universidade/formacao?tab=certificados`)) };
    case 'lembrete': return { assunto: `[Formação] Lembrete: "${curso.titulo}" por concluir`, html: layout(`${nome}, o curso continua à sua espera`, p(`Está inscrito(a) em <strong>${esc(curso.titulo)}</strong> e ainda não o concluiu (${Math.round(Number(matricula?.progresso_pct) || 0)}% feito).${curso.prazo_dias && dias != null ? (dias >= 0 ? ` Faltam <strong>${dias} dias</strong> para o prazo.` : ` O prazo terminou há <strong>${Math.abs(dias)} dias</strong>.`) : ''}`) + botao('Continuar o curso', urlCurso)) };
    case 'a_expirar_30': case 'a_expirar_7': return { assunto: `[Formação] A sua certificação em "${curso.titulo}" expira em ${dias} dias`, html: layout('Certificação a expirar', p(`A sua certificação em <strong>${esc(curso.titulo)}</strong> é válida até <strong>${fmtD(validoAte)}</strong> (${dias} dias). Faça a recertificação a tempo para manter a habilitação.`) + botao('Recertificar agora', urlCurso)) };
    case 'expirado': return { assunto: `[Formação] Certificação expirada — ${curso.titulo}`, html: layout('Certificação expirada', p(`A sua certificação em <strong>${esc(curso.titulo)}</strong> expirou em <strong>${fmtD(validoAte)}</strong>. Volte a fazer o curso e a avaliação para a renovar.`) + botao('Recertificar', urlCurso)) };
    case 'em_falta': return { assunto: `[Formação] Formação obrigatória em falta — ${curso.titulo}`, html: layout('Formação obrigatória', p(`O curso <strong>${esc(curso.titulo)}</strong> é obrigatório para a sua função e ainda não está inscrito(a).`) + botao('Inscrever-me', urlCurso)) };
    case 'sessao_lembrete': { const t = textoConvocatoria({ sessao: ctx.sessao, curso, nome: user.full_name || user.email, tipo: 'lembrete', baseUrl: APP_URL, modo: ctx.modo }); return { assunto: t.subject, html: t.html }; }
    default: return null;
  }
}

async function jaEnviada(chave) { const r = await q(`/notificacao_formacao?chave=eq.${encodeURIComponent(chave)}&select=id`); return r.length > 0; }
async function registar(row) {
  const r = await fetch(`${PGRST}/notificacao_formacao`, { method: 'POST', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  if (!r.ok && r.status !== 409) log(`aviso: registo falhou (${r.status})`);
}
// Remetente da Universidade (Configurações › Email): nome e «responder para»; sem configuração, o nome por omissão.
async function remetenteUniversidade() {
  try { const c = (await q('/universidade_config?id=eq.geral&select=email_remetente_nome,email_resposta'))[0] || {}; return { from_name: String(c.email_remetente_nome || 'Universidade Corporativa · SGA').slice(0, 80), ...(c.email_resposta ? { reply_to: c.email_resposta } : {}) }; }
  catch { return { from_name: 'Universidade Corporativa · SGA' }; }
}
const REMETENTE = await remetenteUniversidade();
async function enviarEmail(to, assunto, html) {
  const r = await fetch(`${FUNCTIONS}/functions/send-email`, { method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject: assunto, html, ...REMETENTE }) });
  if (!r.ok) throw new Error(`send-email HTTP ${r.status}: ${await r.text().catch(() => '')}`);
}

(async () => {
  const [users, cursos, matriculas, trilhas, trilhaCursos, certs, externas] = await Promise.all([
    q('/users?status=eq.ativo&select=id,email,full_name,perfis&limit=5000'),
    q('/curso?deleted_at=is.null&publicado=eq.true&select=id,titulo,validade_meses,obrigatorio_todos,obrigatorio_perfis,prazo_dias,tipo_formacao,curso_base_id&limit=1000'),
    q('/matricula?select=id,curso_id,aluno_email,estado,progresso_pct,concluido_em,valido_ate,created_date,reaberta_em,ciclo,origem,updated_date&limit=50000'),
    q('/trilha?deleted_at=is.null&select=id,publicado,obrigatorio_todos,obrigatorio_perfis&limit=1000'),
    q('/trilha_curso?select=trilha_id,curso_id,obrigatorio&limit=10000'),
    q(`/certificado?revogado_em=is.null&emitido_em=gte.${encodeURIComponent(h48)}&select=id,numero,curso_id,matricula_id,aluno_email,valido_ate,emitido_em`),
    q('/formacao_externa?deleted_at=is.null&resultado=eq.aprovado&select=id,aluno_email,curso_id,titulo,data_realizacao,valido_ate,resultado&limit=50000').catch(() => []),
  ]);
  const listaUsers = users.filter(u => u.email && (!SO || u.email.toLowerCase() === SO));
  const matriz = matrizFormacao({ users: listaUsers, cursos, matriculas, trilhas, trilhaCursos, externas, hoje });
  const fila = []; // { tipo, chave, user, curso, matricula, dias, validoAte, cert }
  for (const l of matriz.linhas) {
    const u = l.user;
    for (const cel of l.celulas) {
      const c = cel.curso, m = cel.matricula;
      if (cel.estado === 'em_falta') fila.push({ tipo: 'em_falta', chave: `em_falta:${u.email.toLowerCase()}:${c.id}:${mesChave}`, user: u, curso: c });
      if (!m) continue;
      const ciclo = m.ciclo || 1;
      if (m.estado === 'ativo' && m.origem && m.origem !== 'aluno' && (m.reaberta_em || m.created_date) >= h48) fila.push({ tipo: 'inscricao', chave: `inscricao:${m.id}:${ciclo}`, user: u, curso: c, matricula: m });
      if (m.estado === 'ativo') {
        const inicio = new Date(m.reaberta_em || m.created_date); const decorridos = -diasAte(inicio, hoje);
        for (const d of DIAS_LEMBRETE) if (decorridos >= d && Number(m.progresso_pct) < 100) fila.push({ tipo: 'lembrete', chave: `lembrete${d}:${m.id}:${ciclo}`, user: u, curso: c, matricula: m, dias: cel.dias });
      }
      if (cel.estado === 'a_expirar' && cel.dias != null) {
        if (cel.dias <= 30) fila.push({ tipo: 'a_expirar_30', chave: `a_expirar_30:${m.id}:${ciclo}`, user: u, curso: c, matricula: m, dias: cel.dias, validoAte: cel.validoAte });
        if (cel.dias <= 7) fila.push({ tipo: 'a_expirar_7', chave: `a_expirar_7:${m.id}:${ciclo}`, user: u, curso: c, matricula: m, dias: cel.dias, validoAte: cel.validoAte });
      }
      if (cel.estado === 'expirado') fila.push({ tipo: 'expirado', chave: `expirado:${m.id}:${ciclo}`, user: u, curso: c, matricula: m, dias: cel.dias, validoAte: cel.validoAte });
    }
  }
  for (const cert of certs) {
    const u = listaUsers.find(x => x.email.toLowerCase() === String(cert.aluno_email || '').toLowerCase());
    const c = cursos.find(x => x.id === cert.curso_id);
    if (u && c) fila.push({ tipo: 'certificado', chave: `certificado:${cert.id}`, user: u, curso: c, cert, validoAte: cert.valido_ate });
  }
  // sessões presenciais: lembrete na véspera (início nas próximas 24–48 h) a quem está inscrito
  const h24 = new Date(Date.now() + 24 * 3600 * 1000).toISOString(), h48f = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const sessoes = await q(`/sessao_formacao?deleted_at=is.null&estado=eq.agendada&inicio=gte.${encodeURIComponent(h24)}&inicio=lte.${encodeURIComponent(h48f)}&select=id,curso_id,titulo,descricao,inicio,fim,local,aeroporto,formador_nome,modalidade,plataforma,link_online`).catch(() => []);
  if (sessoes.length) {
    const insc = await q(`/sessao_inscricao?estado=eq.inscrito&sessao_id=in.(${sessoes.map(s => s.id).join(',')})&select=id,sessao_id,matricula_id,aluno_email,aluno_nome,modo`).catch(() => []);
    for (const i of insc) {
      const s = sessoes.find(x => x.id === i.sessao_id); const c = cursos.find(x => x.id === s?.curso_id); if (!s || !c) continue;
      const email = String(i.aluno_email || '').toLowerCase(); if (SO && email !== SO) continue;
      const u = listaUsers.find(x => x.email.toLowerCase() === email) || { email, full_name: i.aluno_nome || email };
      fila.push({ tipo: 'sessao_lembrete', chave: `sessao_lembrete:${i.id}`, user: u, curso: c, sessao: s, modo: i.modo || null, matricula: i.matricula_id ? { id: i.matricula_id } : null });
    }
  }
  log(`candidatas=${fila.length}`);
  let enviadas = 0, saltadas = 0, naoEntregaveis = 0;
  for (const item of fila) {
    if (await jaEnviada(item.chave)) { saltadas++; continue; }
    const msg = mensagem(item.tipo, item);
    if (!msg) continue;
    const entregavel = /@sga\.co\.ao$/i.test(item.user.email);
    if (DRY) { log(`DRY ${item.tipo} -> ${item.user.email} (${entregavel ? 'entregável' : 'NÃO entregável'}): ${msg.assunto}`); continue; }
    let entregue = false;
    if (entregavel) { try { await enviarEmail(item.user.email, msg.assunto, msg.html); entregue = true; enviadas++; } catch (e) { log(`FALHA ${item.user.email}: ${e.message}`); continue; } }
    else naoEntregaveis++;
    await registar({ tipo: item.tipo, chave: item.chave, destinatario: item.user.email.toLowerCase(), curso_id: item.curso.id, matricula_id: item.matricula?.id || null, certificado_id: item.cert?.id || null, entregue, detalhe: { assunto: msg.assunto, dias: item.dias ?? null } });
  }
  log(`fim — enviadas=${enviadas} já_enviadas=${saltadas} não_entregáveis=${naoEntregaveis}`);
})().catch((e) => { console.error('[formacao-notif] ERRO fatal:', e.message); process.exit(1); });
