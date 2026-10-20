// ============================================================
// Portal de Documentos — peças comuns aos avisos por email.
//   Usado por documentos-notificacoes.mjs (aviso individual), documentos-emendas.mjs (prazo de confirmação das
//   emendas) e documentos-resumo-aeroporto.mjs (resumo ao director de cada aeroporto).
//
// DUAS LEIS DO RELAY DA SGA, que já nos morderam e estão aqui num sítio só:
//   1) só entrega a @sga.co.ao — tudo o resto é recusado;
//   2) trata BCC e envio em massa como spam (550).
// Daí: UM email por pessoa, com o destinatário em To, nunca em BCC, nunca uma lista. Quem não é entregável fica
// registado com entregue = false, para não se confundir «não confirmou» com «nunca foi avisado».
//
// ANTI-DUPLICADO: tabela documento_aviso_enviado (migração 165), chave única por aviso. O despachante passa de
// 15 em 15 minutos; sem isto o mesmo lembrete saía quatro vezes por hora. Enquanto a migração não estiver
// aplicada, `registoPronto()` devolve false e os guiões NÃO enviam nada — falhar sem enviar é o lado seguro.
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

export const PGRST = 'http://127.0.0.1:3000';
export const FUNCTIONS = 'http://127.0.0.1:4001';
export const PORTAL_URL = 'http://10.1.65.45/documentos';
export const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
export const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };

export const flags = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v];
}));
export const DRY = !!flags.dry;
// --so=a@sga.co.ao limita os destinatários (ensaio). --exemplo só funciona com --dry: ver documentos-emendas.mjs.
export const SO = (flags.so || flags.to) ? String(flags.so || flags.to).trim().toLowerCase() : null;
export const EXEMPLO = !!flags.exemplo && DRY;
// milissegundos entre envios reais (--pausa=0 desliga); em --dry não há envio e não há pausa
export const PAUSA = DRY ? 0 : (flags.pausa !== undefined ? Math.max(Number(flags.pausa) || 0, 0) : 1500);

export const SGA = /@sga\.co\.ao$/i;
export const entregavel = (e) => SGA.test(String(e || '').trim());

let LOGO = null;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }

// ---------- datas ----------
export const HOJE = new Date(); HOJE.setHours(0, 0, 0, 0);
const pad = (n) => String(n).padStart(2, '0');
export const HOJE_ISO = `${HOJE.getFullYear()}-${pad(HOJE.getMonth() + 1)}-${pad(HOJE.getDate())}`;
export const dia = (s) => { if (!s) return null; const d = new Date(s); if (Number.isNaN(d.getTime())) return null; d.setHours(0, 0, 0, 0); return d; };
export const diasAte = (s) => { const d = dia(s); return d === null ? null : Math.round((d - HOJE) / 86400000); };
export const dataPt = (s) => { const d = dia(s); return d ? d.toLocaleDateString('pt-PT') : '—'; };
export const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

// ---------- PostgREST (só leitura; a escrita é o registo de avisos) ----------
export async function q(caminho) {
  const r = await fetch(PGRST + caminho, { headers: HDR });
  if (!r.ok) throw new Error(`${caminho.split('?')[0]} HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}
// como q(), mas devolve null em vez de rebentar quando a tabela/vista ainda não existe (migração por aplicar)
export async function qOpcional(caminho) {
  try { const r = await fetch(PGRST + caminho, { headers: HDR }); return r.ok ? await r.json() : null; } catch { return null; }
}

// ---------- configuração do portal ----------
let CFG = null;
export async function config() {
  if (CFG) return CFG;
  const c = (await qOpcional('/documentos_config?id=eq.geral&select=*'))?.[0] || {};
  CFG = {
    nome_portal: c.nome_portal || 'Documentos SGA',
    rodape_email: c.rodape_email || '',
    remetente: {
      from_name: String(c.email_remetente_nome || c.nome_portal || 'Documentos SGA').slice(0, 80),
      ...(c.email_resposta ? { reply_to: c.email_resposta } : {}),
    },
  };
  return CFG;
}

// ---------- registo anti-duplicado ----------
// As chaves já usadas são lidas UMA vez e ficam em memória: uma pergunta por aviso seriam centenas de idas ao
// PostgREST a cada passagem do despachante. A garantia dura continua a ser o índice único da coluna `chave` —
// se duas execuções se cruzarem, a segunda recebe 409 e não envia duas vezes.
const LIMITE_CHAVES = 200000;
let PRONTO = null;
let CHAVES = null;
export async function registoPronto() {
  if (PRONTO !== null) return PRONTO;
  const r = await qOpcional(`/documento_aviso_enviado?select=chave&limit=${LIMITE_CHAVES}`);
  PRONTO = r !== null;
  CHAVES = new Set((r || []).map(x => x.chave));
  if (r && r.length >= LIMITE_CHAVES) console.log(`[docs-avisos] AVISO: o registo de avisos passou ${LIMITE_CHAVES} linhas — podar as antigas, senão o anti-duplicado deixa de ver as mais recentes`);
  return PRONTO;
}
export async function jaEnviado(chave) {
  if (CHAVES === null) await registoPronto();
  return CHAVES.has(chave);
}
async function registar(linha) {
  const r = await fetch(`${PGRST}/documento_aviso_enviado`, {
    method: 'POST', headers: { ...HDR, Prefer: 'return=minimal' }, body: JSON.stringify(linha),
  });
  // 409 = outra passagem do despachante chegou primeiro à mesma chave; é o anti-duplicado a funcionar.
  if (!r.ok && r.status !== 409) throw new Error(`registo do aviso HTTP ${r.status}: ${await r.text().catch(() => '')}`);
  if (CHAVES) CHAVES.add(linha.chave);
  return r.status !== 409;
}

// --html=<pasta>, só com --dry: grava o email em ficheiro em vez de o enviar, para se poder ver no browser
// exactamente o que a pessoa receberia. Não envia nada e não grava nada na base.
function guardarPreVisualizacao(chave, assunto, html) {
  if (!flags.html) return;
  try {
    const pasta = String(flags.html);
    fs.mkdirSync(pasta, { recursive: true });
    const nome = chave.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 120) + '.html';
    fs.writeFileSync(path.join(pasta, nome), `<!-- Assunto: ${assunto} -->\n${html}`, 'utf8');
  } catch (e) { console.log(`[docs-avisos] aviso: não guardei a pré-visualização (${e.message})`); }
}

// ---------- envio ----------
// Devolve um dos estados: repetido | dry | enviado | nao_entregavel | erro.
// Em --dry NUNCA chama o servidor de email e NUNCA grava nada.
export async function avisar({ tipo, chave, para, assunto, html, documento_id = null, emenda_id = null, aeroporto_id = null, prazo_em = null, detalhe = null }) {
  if (SO && String(para).toLowerCase() !== SO) return 'fora_do_so';
  if (await jaEnviado(chave)) return 'repetido';
  if (DRY) { guardarPreVisualizacao(chave, assunto, html); if (CHAVES) CHAVES.add(chave); return 'dry'; }
  const cfg = await config();
  const base = { tipo, chave, destinatario: String(para).toLowerCase(), assunto, documento_id, emenda_id, aeroporto_id, prazo_em, detalhe };
  if (!entregavel(para)) { await registar({ ...base, entregue: false }); return 'nao_entregavel'; }
  try {
    const r = await fetch(`${FUNCTIONS}/functions/send-email`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: para, subject: assunto, html, ...cfg.remetente }),   // To:, um por pessoa. Nunca bcc.
    });
    if (!r.ok) throw new Error(`send-email HTTP ${r.status}: ${await r.text().catch(() => '')}`);
  } catch (e) {
    await registar({ ...base, entregue: false, detalhe: { ...(detalhe || {}), erro: e.message } }).catch(() => {});
    return 'erro';
  }
  await registar({ ...base, entregue: true });
  // Pausa entre envios reais: o relay da SGA trata rajadas como spam. Um aviso de cada vez, com um intervalo
  // curto, chega a todos sem parecer envio em massa. --pausa=0 desliga.
  if (PAUSA > 0) await new Promise(r => setTimeout(r, PAUSA));
  return 'enviado';
}

// ---------- aspecto do email ----------
// Sóbrio de propósito: logo SGA, o que é, o que a pessoa tem de fazer, até quando, e um botão para o portal.
export function layout({ titulo, intro, corpo, nomePortal = 'Documentos SGA', rodape = '', botao = 'Abrir o portal', url = PORTAL_URL }) {
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:720px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:12px;padding:24px">
      ${LOGO ? `<img src="${LOGO}" alt="SGA" style="height:40px;margin-bottom:12px">` : ''}
      <div style="font-size:12px;color:#64748b;letter-spacing:.04em;text-transform:uppercase">${esc(nomePortal)}</div>
      <h1 style="margin:4px 0 10px;font-size:20px;line-height:1.3">${esc(titulo)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155">${intro}</p>
      ${corpo}
      <p style="margin:26px 0 0"><a href="${url}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px">${esc(botao)}</a></p>
      <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">Mensagem automática do Portal de Documentos da SGA. ${esc(rodape)}</p>
    </div>
  </div></body></html>`;
}

// caixa de «o que tem de fazer» — é a única parte que as pessoas têm de ler sempre
export const acao = (texto) => `<div style="margin:0 0 18px;padding:12px 14px;background:#fffbeb;border-left:4px solid #d97706;border-radius:6px;font-size:14px;line-height:1.6;color:#422006">${texto}</div>`;

export function tabela(colunas, linhas) {
  if (!linhas.length) return '';
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 6px"><thead><tr style="background:#f8fafc">
    ${colunas.map(c => `<th style="text-align:left;padding:8px 10px;font-size:12px;color:#475569;font-weight:600">${esc(c)}</th>`).join('')}
  </tr></thead><tbody>${linhas.map(cs => `<tr>${cs.map(v => `<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function seccao({ titulo, cor = '#0f172a', intro, colunas, linhas, mais = 0 }) {
  if (!linhas.length) return '';
  return `<h2 style="margin:24px 0 4px;font-size:16px;color:${cor}">${esc(titulo)}</h2>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b">${esc(intro)}</p>
    ${tabela(colunas, linhas)}
    ${mais > 0 ? `<p style="margin:2px 0 0;font-size:12px;color:#94a3b8">e mais ${mais} no portal.</p>` : ''}`;
}

export const ligaDoc = (d) => `<a href="${PORTAL_URL}/documento/${d.id}" style="color:#0f172a"><strong>${esc(d.titulo)}</strong></a>${d.numero ? `<br><span style="font-size:12px;color:#64748b">${esc(d.numero)}</span>` : ''}`;

// ============================================================
// Emendas de demonstração — SÓ com --dry --exemplo. Nada é gravado, nada é enviado: servem para mostrar quem
// receberia o quê enquanto não houver emendas reais distribuídas no portal. Assentam em documentos reais, para
// que os detentores e o director que aparecem na lista sejam os verdadeiros.
// ============================================================
export function emendasDeExemplo(ctx) {
  const docs = ctx.docs.filter(d => (d.estado || 'em_vigor') === 'em_vigor' && ctx.aeroportoDoDoc(d)).slice(0, 2);
  const base = (d, numero, distribuidaHaDias) => {
    const desde = new Date(HOJE.getTime() - distribuidaHaDias * 86400000);
    const prazo = new Date(desde.getTime() + 30 * 86400000);
    return {
      emenda_id: `exemplo-${numero}`, documento_id: d.id, numero, tipo: 'emenda', modo: 'paginas', estado: 'distribuida',
      resumo: 'EXEMPLO — alteração do capítulo 4 (plano de emergência).', paginas_afectadas: '4-1 a 4-12',
      folha_controlo: numero, versao_resultante: null,
      documento_titulo: d.titulo, documento_numero: d.numero, exige_leitura: d.exige_leitura, leitura_perfis: d.leitura_perfis,
      aeroporto_id: ctx.aeroportoDoDoc(d),
      distribuida_em: desde.toISOString().slice(0, 10), prazo_dias: 30,
      prazo_em: prazo.toISOString().slice(0, 10),
      dias_restantes: Math.round((prazo - HOJE) / 86400000),
      confirmacoes: 0, exemplo: true,
    };
  };
  const lista = [];
  if (docs[0]) lista.push(base(docs[0], 901, 23));  // faltam 7 dias          -> lembrete ao detentor
  if (docs[1]) lista.push(base(docs[1], 902, 35));  // prazo passou há 5 dias  -> fim do prazo + escalonamento
  return lista;
}

// ============================================================
// Contexto: a fotografia do portal de que os dois guiões precisam, lida uma vez.
// ============================================================
export async function carregarContexto() {
  const [cfg, aeroportos, responsaveis, membros, users, docs, pastas, tipos, leituras, versoes, confirmacoes] = await Promise.all([
    config(),
    q('/documentos_aeroporto?select=id,codigo_icao,nome,cidade,ativo,ordem&order=ordem'),
    q('/documentos_aeroporto_responsavel?select=email,nome,cargo,aeroporto_id,principal'),
    q('/documentos_acesso_aeroporto?select=email,aeroporto_id'),
    q('/users?select=email,full_name,perfis,status,role&limit=5000'),
    q('/documento?voo_ligado_id=is.null&deleted_at=is.null&select=id,titulo,numero,estado,tipo_id,pasta_id,aeroporto_id,responsavel_email,em_vigor_desde,publicacao_em,expira_em,data_expiracao,vigor_agendado_em,versao,versao_atual,updated_date,exige_leitura,leitura_perfis&limit=10000'),
    q('/pasta?deleted_at=is.null&select=id,nome,aeroporto_id'),
    q('/documento_tipo?select=id,nome,codigo'),
    q('/documento_leitura?select=documento_id,email'),
    q('/documento_versao?select=documento_id,versao,rotulo,estado,vigor_desde,vigor_ate&limit=20000'),
    q('/documento_emenda_confirmacao?select=emenda_id,email,nome,confirmado_em'),
  ]);

  // Emendas com o prazo já calculado. A vista chega com a migração 165; até lá faz-se a mesma conta aqui, para o
  // guião poder ser ensaiado antes de a migração ser aplicada.
  let emendas = await qOpcional('/documento_emenda_prazo?select=*');
  if (emendas === null) {
    const cruas = await q('/documento_emenda?estado=eq.distribuida&select=id,documento_id,numero,tipo,modo,estado,resumo,paginas_afectadas,folha_controlo,versao_resultante,distribuida_em,data_insercao,prazo_confirmacao,created_date');
    const porId = new Map(docs.map(d => [d.id, d]));
    emendas = cruas.filter(e => porId.has(e.documento_id)).map((e) => {
      const d = porId.get(e.documento_id);
      const desde = dia(e.distribuida_em || e.data_insercao || e.created_date);
      const prazoDias = Math.max(Number(e.prazo_confirmacao) || 30, 1);
      const prazo = desde ? new Date(desde.getTime() + prazoDias * 86400000) : null;
      return {
        emenda_id: e.id, documento_id: e.documento_id, numero: e.numero, tipo: e.tipo, modo: e.modo, estado: e.estado,
        resumo: e.resumo, paginas_afectadas: e.paginas_afectadas, folha_controlo: e.folha_controlo,
        versao_resultante: e.versao_resultante, documento_titulo: d.titulo, documento_numero: d.numero,
        exige_leitura: d.exige_leitura, leitura_perfis: d.leitura_perfis,
        aeroporto_id: d.aeroporto_id || pastas.find(p => p.id === d.pasta_id)?.aeroporto_id || null,
        distribuida_em: desde ? desde.toISOString().slice(0, 10) : null,
        prazo_dias: prazoDias,
        prazo_em: prazo ? prazo.toISOString().slice(0, 10) : null,
        dias_restantes: prazo ? Math.round((prazo - HOJE) / 86400000) : null,
        confirmacoes: confirmacoes.filter(c => c.emenda_id === e.id).length,
      };
    });
  }

  // Cópias controladas (migração 158): quando existem, SÃO a lista de detentores — é o registo nominal que a lei
  // quer. Sem elas, vale quem tem acesso ao aeroporto do documento.
  const copias = (await qOpcional('/documento_copia_controlada?estado=eq.activa&select=documento_id,detentor_email,detentor_nome')) || [];

  const aeroDe = new Map(aeroportos.map(a => [a.id, a]));
  const pastaDe = new Map(pastas.map(p => [p.id, p]));
  const tipoDe = new Map(tipos.map(t => [t.id, t]));
  const userDe = new Map(users.map(u => [String(u.email || '').toLowerCase(), u]));
  const lido = new Set(leituras.map(l => `${l.documento_id}|${String(l.email).toLowerCase()}`));
  const confirmado = new Set(confirmacoes.map(c => `${c.emenda_id}|${String(c.email).toLowerCase()}`));

  const aeroportoDoDoc = (d) => d.aeroporto_id || pastaDe.get(d.pasta_id)?.aeroporto_id || null;
  const icao = (id) => aeroDe.get(id)?.codigo_icao || '—';

  // quem tem acesso a cada aeroporto (membros + o próprio responsável)
  const porAeroporto = new Map();
  for (const m of [...membros, ...responsaveis]) {
    const e = String(m.email || '').toLowerCase(); if (!e) continue;
    if (!porAeroporto.has(m.aeroporto_id)) porAeroporto.set(m.aeroporto_id, new Set());
    porAeroporto.get(m.aeroporto_id).add(e);
  }
  // Sem nome completo no registo, vale o endereço inteiro e não o pedaço antes do @: quem lê a lista é um
  // director que vai ter de contactar a pessoa, e para isso precisa do endereço.
  const nomeDe = (email) => {
    const e = String(email || '').toLowerCase();
    return userDe.get(e)?.full_name || responsaveis.find(r => String(r.email).toLowerCase() === e)?.nome || e;
  };
  const perfisDe = (email) => userDe.get(String(email || '').toLowerCase())?.perfis || [];

  // DETENTORES de um documento: quem tem de confirmar que inseriu a emenda.
  //   1.º as cópias controladas, quando existem (registo nominal, migração 158);
  //   2.º na sua falta, quem tem acesso ao aeroporto do documento — restrito aos perfis indicados em
  //       leitura_perfis, se o documento os indicar (migração 141).
  const detentores = (doc) => {
    const nominais = copias.filter(c => c.documento_id === doc.id);
    if (nominais.length) {
      return [...new Map(nominais.map(c => [String(c.detentor_email).toLowerCase(), { email: String(c.detentor_email).toLowerCase(), nome: c.detentor_nome || nomeDe(c.detentor_email), nominal: true }])).values()];
    }
    const aero = aeroportoDoDoc(doc);
    const lista = [...(porAeroporto.get(aero) || new Set())];
    const perfisPedidos = Array.isArray(doc.leitura_perfis) ? doc.leitura_perfis : [];
    return lista
      .filter(e => (userDe.get(e)?.status ?? 'ativo') === 'ativo')
      .filter(e => !perfisPedidos.length || perfisDe(e).some(p => perfisPedidos.includes(p)))
      .map(e => ({ email: e, nome: nomeDe(e), nominal: false }));
  };

  // expiração: expira_em é date; data_expiracao é a coluna antiga, em texto
  const expiraEm = (d) => d.expira_em || d.data_expiracao || null;

  // Documentos «sem par de revisão»: a linha do tempo das revisões não responde por hoje. Ou o documento está em
  // vigor e nenhuma revisão o acompanha, ou havia uma revisão com data marcada que já passou e não entrou. É a
  // pergunta que a inspecção faz («que revisão estava em vigor no dia X?») a ficar sem resposta.
  const porDoc = new Map();
  for (const v of versoes) { if (!porDoc.has(v.documento_id)) porDoc.set(v.documento_id, []); porDoc.get(v.documento_id).push(v); }
  const semParDeRevisao = (d) => {
    if ((d.estado || 'em_vigor') !== 'em_vigor') return null;
    const vs = porDoc.get(d.id) || [];
    if (!vs.length) return 'nenhuma revisão registada';
    if (!vs.some(v => v.estado === 'em_vigor')) return 'nenhuma revisão marcada como em vigor';
    const atrasada = vs.find(v => v.estado === 'aprovado' && v.vigor_desde && diasAte(v.vigor_desde) < 0);
    if (atrasada) return `revisão ${atrasada.rotulo || atrasada.versao} tinha data marcada para ${dataPt(atrasada.vigor_desde)} e não entrou em vigor`;
    return null;
  };

  const duplicados = (await qOpcional('/documento_duplicado?select=sha256,documento_id,titulo,numero,par_id,par_titulo,par_numero,aeroporto_id,par_aeroporto_id,decisao_id')) || [];

  return {
    cfg, aeroportos, responsaveis, membros, users, docs, pastas, tipos, leituras, versoes, confirmacoes,
    emendas, copias, duplicados,
    aeroDe, pastaDe, tipoDe, userDe, lido, confirmado, porAeroporto,
    aeroportoDoDoc, icao, nomeDe, perfisDe, detentores, expiraEm, semParDeRevisao,
  };
}
