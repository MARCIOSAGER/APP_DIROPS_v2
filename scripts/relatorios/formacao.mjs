#!/usr/bin/env node
// ============================================================
// Relatório "Formação — matriz e alertas" (Universidade Corporativa).
// Matriz colaborador × curso (estados: em falta, expirado, a expirar, atrasado,
// em curso, válido, concluído) + listas de alertas. Email HTML branded com a
// matriz completa em Excel anexo. Envio INDIVIDUAL (relay SGA bloqueia BCC).
//
// Destinatários: relatorio_destinatario (tipo_relatorio='formacao'); se não
// houver, os administradores @sga.co.ao.
// Flags: --dry (grava HTML/XLSX no scratchpad, não envia)  --to=a@x,b@y
//        --emit=json ({assunto, html} no stdout p/ painel on-demand)
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { matrizFormacao, alertasFormacao, ESTADOS, DIAS_AVISO_EXPIRACAO } from '../../src/lib/formacaoEstado.js';
import { indicadoresFormacao } from '../../src/lib/formacaoIndicadores.js';

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
const EMIT = args.emit === 'json';
const TO_OVERRIDE = args.to ? String(args.to).split(',').map((s) => s.trim()).filter(Boolean) : null;
if (EMIT) { const _e = console.error.bind(console); console.log = (...a) => _e(...a); }
const log = (m) => console.log(`[formacao] ${m}`);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtD = (iso) => { if (!iso) return '—'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT'); };

async function q(pathQ) {
  const r = await fetch(`${PGRST}${pathQ}`, { headers: HDR });
  if (!r.ok) throw new Error(`PostgREST ${pathQ.split('?')[0]} HTTP ${r.status} — ${await r.text()}`);
  return r.json();
}
async function carregar() {
  const [users, cursos, matriculas, trilhas, trilhaCursos, externas] = await Promise.all([
    q('/users?status=eq.ativo&select=id,email,full_name,perfis&order=full_name.asc&limit=5000').then(async (us) => { const f = await q('/universidade_formando?select=email,aeroporto&limit=5000').catch(() => []); const m = new Map(f.map(x => [String(x.email).toLowerCase(), x.aeroporto])); return us.filter(u => (u.perfis || []).some(p => ['formando', 'instrutor', 'admin_universidade'].includes(p))).map(u => { const a = m.get(String(u.email).toLowerCase()); return { ...u, aeroportos_acesso: a ? [a] : [] }; }); }),
    q('/curso?deleted_at=is.null&publicado=eq.true&select=id,titulo,categoria,ordem,validade_meses,obrigatorio_todos,obrigatorio_perfis,prazo_dias,tipo_formacao,curso_base_id&order=ordem.asc&limit=1000'),
    q('/matricula?select=id,curso_id,aluno_email,aluno_nome,estado,progresso_pct,concluido_em,valido_ate,created_date,reaberta_em,ciclo,certificado_num&limit=50000'),
    q('/trilha?deleted_at=is.null&select=id,titulo,publicado,obrigatorio_todos,obrigatorio_perfis&limit=1000'),
    q('/trilha_curso?select=trilha_id,curso_id,obrigatorio&limit=10000'),
    q('/formacao_externa?deleted_at=is.null&resultado=eq.aprovado&select=id,aluno_email,curso_id,titulo,data_realizacao,valido_ate,resultado&limit=50000').catch(() => []),
  ]);
  return { users: users.filter(u => u.email), cursos, matriculas, trilhas, trilhaCursos, externas };
}
async function destinatarios() {
  if (TO_OVERRIDE) return TO_OVERRIDE;
  const d = await q('/relatorio_destinatario?tipo_relatorio=eq.formacao&ativo=eq.true&select=email');
  let lista = d.map(x => String(x.email || '').trim().toLowerCase()).filter(e => /@sga\.co\.ao$/.test(e));
  if (!lista.length) {
    const admins = await q('/users?or=(role.eq.admin,perfis.cs.{administrador})&email=like.*@sga.co.ao&select=email');
    lista = admins.map(x => String(x.email).toLowerCase());
  }
  return [...new Set(lista)];
}

// ---------- HTML ----------
const COR = { red: '#dc2626', amber: '#d97706', blue: '#2563eb', emerald: '#059669', slate: '#64748b' };
function chip(estado) { const e = ESTADOS[estado] || ESTADOS.nao_inscrito; return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;background:${COR[e.cor]}">${esc(e.label)}</span>`; }
function tabelaAlertas(titulo, cor, itens, colExtra, maxLinhas = 40) {
  if (!itens.length) return '';
  const linhas = itens.slice(0, maxLinhas).map(i => `<tr>
    <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px">${esc(i.user.full_name || i.user.email)}<div style="color:#94a3b8;font-size:11px">${esc(i.user.email)}</div></td>
    <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px">${esc(i.curso.titulo)}</td>
    <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;white-space:nowrap">${colExtra(i)}</td></tr>`).join('');
  const mais = itens.length > maxLinhas ? `<p style="color:#64748b;font-size:12px;margin:6px 0 0">… e mais ${itens.length - maxLinhas} (ver Excel anexo)</p>` : '';
  return `<h2 style="font-size:15px;margin:24px 0 8px;color:${cor}">${esc(titulo)} <span style="color:#94a3b8;font-weight:400">(${itens.length})</span></h2>
  <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc"><th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b">Colaborador</th><th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b">Curso</th><th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b">Detalhe</th></tr></thead><tbody>${linhas}</tbody></table>${mais}`;
}
const fmtP = (p) => (p == null ? '—' : `${p}%`);
const corP = (p) => (p == null ? COR.slate : p >= 90 ? COR.emerald : p >= 70 ? COR.amber : COR.red);
const th = (h) => `<th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b">${esc(h)}</th>`;
const td = (v, extra = '') => `<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;${extra}">${v}</td>`;
function blocoConformidade(ind) {
  if (!ind || !ind.porPerfil.length || !ind.conformidade.devidos) return '';
  const linhas = (lista) => lista.map(p => `<tr>${td(esc(p.chave))}${td(p.pessoas, 'text-align:center')}${td(p.devidos, 'text-align:center')}${td(p.validos, 'text-align:center')}${td(p.emFalta, 'text-align:center')}${td(p.expirados, 'text-align:center')}${td(`<strong style="color:${corP(p.pct)}">${fmtP(p.pct)}</strong>`, 'text-align:center')}</tr>`).join('');
  const tabela = (titulo, lista) => `<h2 style="font-size:15px;margin:24px 0 8px;color:#0f172a">${titulo} <span style="color:#94a3b8;font-weight:400">(obrigatórios válidos ÷ devidos)</span></h2>
  <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc">${['Grupo', 'Pessoas', 'Devidos', 'Válidos', 'Em falta', 'Expirados', 'Conformidade'].map(th).join('')}</tr></thead><tbody>${linhas(lista)}</tbody></table>`;
  return tabela('Conformidade por perfil', ind.porPerfil) + (ind.porAeroporto.length > 1 ? tabela('Conformidade por aeroporto', ind.porAeroporto) : '');
}
function blocoVencimentos(ind) {
  if (!ind) return '';
  const itens = [...ind.vencimentos.d60.map(i => ({ ...i, janela: '31–60 d' })), ...ind.vencimentos.d90.map(i => ({ ...i, janela: '61–90 d' }))];
  if (!itens.length) return '';
  return `<h2 style="font-size:15px;margin:24px 0 8px;color:${COR.slate}">Vencimentos a 31–90 dias <span style="color:#94a3b8;font-weight:400">(${itens.length})</span></h2>
  <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc">${['Janela', 'Colaborador', 'Curso', 'Válido até', 'Dias'].map(th).join('')}</tr></thead><tbody>
  ${itens.slice(0, 60).map(i => `<tr>${td(i.janela)}${td(`${esc(i.user.full_name || i.user.email)}<div style="color:#94a3b8;font-size:11px">${esc(i.user.email)}</div>`)}${td(esc(i.curso.titulo))}${td(fmtD(i.validoAte), 'white-space:nowrap')}${td(i.dias, 'text-align:center')}</tr>`).join('')}</tbody></table>${itens.length > 60 ? `<p style="color:#64748b;font-size:12px;margin:6px 0 0">… e mais ${itens.length - 60} (ver Excel anexo)</p>` : ''}`;
}
function construirHtml(matriz, alertas, semAlertas, ind) {
  const t = matriz.totais;
  // Indicadores lado a lado em tabela: os clientes de email (Outlook) ignoram display:flex e empilhavam os cartões na vertical.
  const kpi = (l, v, cor) => `<td style="background:#f8fafc;border-radius:10px;padding:12px 14px;vertical-align:top"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">${l}</div><div style="font-size:24px;font-weight:700;color:${cor}">${v}</div></td>`;
  const cursosObrig = matriz.porCurso.filter(c => c.obrigatorioPara > 0);
  const porCurso = cursosObrig.length ? `<h2 style="font-size:15px;margin:24px 0 8px;color:#0f172a">Cursos obrigatórios — cobertura</h2>
    <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc">${['Curso', 'Obrigatório p/', 'Em falta', 'Expirado', 'A expirar', 'Em curso', 'Válido/Concluído'].map(h => `<th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b">${h}</th>`).join('')}</tr></thead><tbody>
    ${cursosObrig.map(c => `<tr>${[c.curso.titulo, c.obrigatorioPara, c.contagens.em_falta || 0, c.contagens.expirado || 0, c.contagens.a_expirar || 0, (c.contagens.em_curso || 0) + (c.contagens.atrasado || 0), (c.contagens.valido || 0) + (c.contagens.concluido || 0)].map((v, i) => `<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;${i ? 'text-align:center' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  const logo = LOGO ? `<img src="${LOGO}" alt="SGA" style="height:40px;margin-right:16px">` : '';
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:860px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 24px rgba(15,23,42,.06)">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-bottom:2px solid #e2e8f0"><tr><td style="width:1%;padding:0 0 16px">${logo}</td><td style="padding:0 0 16px"><h1 style="margin:0;font-size:20px">Formação — matriz e alertas</h1><p style="margin:4px 0 0;color:#64748b;font-size:13px">Universidade Corporativa · ${new Date().toLocaleDateString('pt-PT')}</p></td></tr></table>
    <table role="presentation" cellpadding="0" cellspacing="8" style="width:100%;margin:12px 0;border-collapse:separate"><tr>
      ${ind && ind.conformidade.devidos ? kpi('Conformidade', fmtP(ind.conformidade.pct), corP(ind.conformidade.pct)) : ''}${kpi('Colaboradores', matriz.linhas.length, '#0f172a')}${kpi('Em falta', t.em_falta || 0, COR.red)}${kpi('Expirados', t.expirado || 0, COR.red)}${kpi('A expirar', t.a_expirar || 0, COR.amber)}${kpi('Em curso', (t.em_curso || 0) + (t.atrasado || 0), COR.blue)}${kpi('Válidos', (t.valido || 0) + (t.concluido || 0), COR.emerald)}
    </tr></table>
    ${semAlertas ? '<p style="color:#475569;font-size:14px">Sem pendências: nenhuma formação obrigatória em falta, expirada ou a expirar. 🎉</p>' : ''}
    ${tabelaAlertas('Formação obrigatória em falta', COR.red, alertas.em_falta, () => chip('em_falta'))}
    ${tabelaAlertas('Certificações expiradas', COR.red, alertas.expirado, i => `${chip('expirado')} desde ${fmtD(i.validoAte)}`)}
    ${tabelaAlertas(`A expirar nos próximos ${DIAS_AVISO_EXPIRACAO} dias`, COR.amber, alertas.a_expirar, i => `${chip('a_expirar')} em ${i.dias} d (${fmtD(i.validoAte)})`)}
    ${tabelaAlertas('Em curso com prazo ultrapassado', COR.amber, alertas.atrasado, i => `${chip('atrasado')} ${Math.abs(i.dias)} d de atraso · ${Math.round(Number(i.matricula?.progresso_pct) || 0)}%`)}
    ${blocoVencimentos(ind)}
    ${blocoConformidade(ind)}
    ${porCurso}
    <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">A matriz completa (colaborador × curso) segue em anexo (Excel). Gerir cursos, obrigatoriedade e validade: <a href="${APP_URL}/universidade/gestao/cursos" style="color:#0f172a">Cursos e conteúdos</a>.</p>
  </div></body></html>`;
}

// ---------- Excel ----------
function construirXlsx(matriz, alertas, ind) {
  const wb = XLSX.utils.book_new();
  if (ind && ind.conformidade.devidos) {
    const conf = [['Conformidade global', fmtP(ind.conformidade.pct), ind.conformidade.validos, ind.conformidade.devidos], [], ['Perfil', 'Pessoas', 'Devidos', 'Válidos', 'Em falta', 'Expirados', 'Conformidade']];
    for (const p of ind.porPerfil) conf.push([p.chave, p.pessoas, p.devidos, p.validos, p.emFalta, p.expirados, fmtP(p.pct)]);
    conf.push([], ['Aeroporto', 'Pessoas', 'Devidos', 'Válidos', 'Em falta', 'Expirados', 'Conformidade']);
    for (const p of ind.porAeroporto) conf.push([p.chave, p.pessoas, p.devidos, p.validos, p.emFalta, p.expirados, fmtP(p.pct)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(conf), 'Conformidade');
    const venc = [['Janela', 'Colaborador', 'Email', 'Curso', 'Válido até', 'Dias', 'Origem']];
    for (const [k, rot] of [['expirados', 'Expirado'], ['d30', '0-30 d'], ['d60', '31-60 d'], ['d90', '61-90 d']]) for (const i of ind.vencimentos[k]) venc.push([rot, i.user.full_name || '', i.user.email, i.curso.titulo, fmtD(i.validoAte), i.dias, i.origem === 'externa' ? 'Formação externa' : 'Curso']);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(venc), 'Vencimentos 90d');
  }
  const cab = ['Colaborador', 'Email', 'Perfis', 'Pendências', ...matriz.porCurso.map(c => c.curso.titulo)];
  const linhas = matriz.linhas.map(l => [l.user.full_name || '', l.user.email, (l.user.perfis || []).join(', '), l.pendencias,
    ...l.celulas.map(c => { const e = ESTADOS[c.estado]?.label || c.estado; return c.validoAte ? `${e} (até ${fmtD(c.validoAte)})` : (c.matricula && c.estado === 'em_curso' ? `${e} ${Math.round(Number(c.matricula.progresso_pct) || 0)}%` : e); })]);
  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  ws['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, ...matriz.porCurso.map(() => ({ wch: 26 }))];
  XLSX.utils.book_append_sheet(wb, ws, 'Matriz');
  const al = [['Tipo', 'Colaborador', 'Email', 'Curso', 'Dias', 'Válido até', 'Progresso']];
  for (const [tipo, itens] of Object.entries(alertas)) for (const i of itens) al.push([ESTADOS[tipo]?.label || tipo, i.user.full_name || '', i.user.email, i.curso.titulo, i.dias ?? '', fmtD(i.validoAte), i.matricula ? Math.round(Number(i.matricula.progresso_pct) || 0) + '%' : '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(al), 'Alertas');
  const cob = [['Curso', 'Obrigatório para', 'Em falta', 'Expirado', 'A expirar', 'Atrasado', 'Em curso', 'Válido', 'Concluído', 'Não inscrito']];
  for (const c of matriz.porCurso) cob.push([c.curso.titulo, c.obrigatorioPara, ...['em_falta', 'expirado', 'a_expirar', 'atrasado', 'em_curso', 'valido', 'concluido', 'nao_inscrito'].map(k => c.contagens[k] || 0)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cob), 'Por curso');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// Remetente da Universidade (Configurações › Email): nome e «responder para»; sem configuração, o nome por omissão.
async function remetenteUniversidade() {
  try { const c = (await q('/universidade_config?id=eq.geral&select=email_remetente_nome,email_resposta'))[0] || {}; return { from_name: String(c.email_remetente_nome || 'Universidade Corporativa · SGA').slice(0, 80), ...(c.email_resposta ? { reply_to: c.email_resposta } : {}) }; }
  catch { return { from_name: 'Universidade Corporativa · SGA' }; }
}
const REMETENTE = await remetenteUniversidade();
async function enviar(email, assunto, html, xlsx) {
  const r = await fetch(`${FUNCTIONS}/functions/send-email`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: email, subject: assunto, html, ...REMETENTE, attachments: [{ filename: `Matriz_Formacao_${new Date().toISOString().slice(0, 10)}.xlsx`, content: xlsx.toString('base64'), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }] }),
  });
  if (!r.ok) throw new Error(`send-email HTTP ${r.status}: ${await r.text().catch(() => '')}`);
}

(async () => {
  const dados = await carregar();
  const matriz = matrizFormacao(dados);
  const alertas = alertasFormacao(matriz);
  const nAlertas = Object.values(alertas).reduce((s, a) => s + a.length, 0);
  const aeroportosSGA = await q('/universidade_aeroporto?ativo=eq.true&select=codigo,nome&order=ordem.asc').then(l => l.map(a => ({ codigo_icao: a.codigo, nome: a.nome }))).catch(() => null);
  const ind = indicadoresFormacao({ matriz, cursos: dados.cursos, matriculas: dados.matriculas, externas: dados.externas, aeroportos: aeroportosSGA });
  const html = construirHtml(matriz, alertas, nAlertas === 0, ind);
  const assunto = `[Universidade] Formação — ${alertas.em_falta.length} em falta, ${alertas.expirado.length} expiradas, ${alertas.a_expirar.length} a expirar`;
  log(`colaboradores=${matriz.linhas.length} cursos=${dados.cursos.length} alertas=${nAlertas}`);
  if (EMIT) { process.stdout.write(JSON.stringify({ assunto, html, totais: matriz.totais })); return; }
  const xlsx = construirXlsx(matriz, alertas, ind);
  if (DRY) {
    const out = path.join(process.env.TEMP || '.', 'formacao-relatorio.html');
    fs.writeFileSync(out, html); fs.writeFileSync(out.replace('.html', '.xlsx'), xlsx);
    log(`DRY: HTML e XLSX gravados em ${out}`); return;
  }
  const dests = await destinatarios();
  let ok = 0;
  for (const e of dests) { try { await enviar(e, assunto, html, xlsx); ok++; log(`enviado a ${e}`); } catch (err) { log(`FALHA ${e}: ${err.message}`); } }
  log(`fim — ${ok}/${dests.length} enviados`);
})().catch((e) => { console.error('[formacao] ERRO fatal:', e.message); process.exit(1); });
