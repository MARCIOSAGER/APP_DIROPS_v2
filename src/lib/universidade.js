// Lógica pura do portal da Universidade Corporativa (/universidade): caminhos, validações,
// vocabulário do registo de auditoria e utilitários de apresentação. Sem React, sem rede — testável.

export const PORTAL_BASE = '/universidade';
export const DOMINIOS_INTERNOS = ['sga.co.ao'];

// true quando a página actual está dentro do portal (os componentes da formação são partilhados com o DIROPS)
export function noPortal(pathname) {
  const p = pathname != null ? pathname : (typeof window !== 'undefined' ? window.location.pathname : '');
  return String(p || '').startsWith(PORTAL_BASE);
}
// URL da página de formação certa para o contexto (portal ou DIROPS), com query opcional ("?curso=…")
export function urlFormacao(query = '', pathname) {
  return (noPortal(pathname) ? `${PORTAL_BASE}/formacao` : '/Formacao') + (query || '');
}
export const urlCursoPortal = (cursoId, extra = '') => `${PORTAL_BASE}/formacao?curso=${encodeURIComponent(cursoId)}${extra}`;

export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
export const dominioDe = (e) => String(e || '').trim().toLowerCase().split('@')[1] || '';

// "sga.co.ao, @outra.ao\nterceira.com" | ['a','b'] → ['sga.co.ao','outra.ao','terceira.com']
export function normalizarDominios(entrada) {
  const partes = Array.isArray(entrada) ? entrada : String(entrada || '').split(/[,;\s\n]+/);
  const out = [];
  for (const p of partes) {
    const d = String(p || '').trim().toLowerCase().replace(/^@/, '').replace(/\/+$/, '');
    if (d && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !out.includes(d)) out.push(d);
  }
  return out;
}
// lista vazia = qualquer domínio; subdomínios contam (x.sga.co.ao ∈ sga.co.ao)
export function dominioPermitido(email, dominios) {
  const lista = normalizarDominios(dominios);
  if (!lista.length) return true;
  const d = dominioDe(email);
  return lista.some(x => d === x || d.endsWith('.' + x));
}
export const emailInterno = (e) => !!dominioDe(e) && dominioPermitido(e, DOMINIOS_INTERNOS);

// Listas de emails escritas à mão ("a@x; b@y, c@z"): normaliza (minúsculas, sem repetidos, só válidos) e aponta os inválidos.
const partirEmails = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/)).map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
export function listaEmails(v) { return [...new Set(partirEmails(v).filter(emailValido))]; }
export function emailsInvalidos(v) { return partirEmails(v).filter(e => !emailValido(e)); }
// "mailto:" com um ou vários destinatários (o esquema mailto separa por vírgula)
export function mailtoDe(v) { const l = listaEmails(v); return l.length ? `mailto:${l.join(',')}` : 'mailto:'; }

export function validarSenha(pw) {
  const p = String(pw || '');
  const erros = [];
  if (p.length < 8) erros.push('pelo menos 8 caracteres');
  if (!/[A-Z]/.test(p)) erros.push('uma letra maiúscula');
  if (!/[0-9]/.test(p)) erros.push('um número');
  return { ok: erros.length === 0, erros, mensagem: erros.length ? `A senha precisa de ${erros.join(', ')}.` : '' };
}

// Validação do formulário de pedido de acesso (espelha as regras do backend para feedback imediato).
export function validarPedido({ nome, email, motivo } = {}, cfg = {}) {
  const erros = {};
  if (!String(nome || '').trim() || String(nome || '').trim().length < 3) erros.nome = 'Indique o seu nome completo.';
  if (!emailValido(email)) erros.email = 'Indique um email válido.';
  else if (!dominioPermitido(email, cfg.dominios_permitidos)) erros.email = `Só são aceites pedidos com email de: ${normalizarDominios(cfg.dominios_permitidos).map(d => '@' + d).join(', ')}.`;
  if (String(motivo || '').length > 1000) erros.motivo = 'Máximo 1000 caracteres.';
  return { ok: Object.keys(erros).length === 0, erros };
}

// Vocabulário do registo de auditoria (vista universidade_auditoria + log_auditoria do portal).
export const CATEGORIAS_AUDITORIA = {
  sistema: 'Sessões e acessos', matricula: 'Matrículas', certificado: 'Certificados', avaliacao: 'Avaliações', sessao: 'Sessões de formação',
  curso: 'Cursos', email: 'Emails', comentario: 'Comentários', gamificacao: 'Gamificação',
};
export const ACOES_AUDITORIA = {
  login: { label: 'Início de sessão', cor: 'slate', icone: 'LogIn' },
  login_falha: { label: 'Falha de login', cor: 'red', icone: 'ShieldAlert' },
  logout: { label: 'Fim de sessão', cor: 'slate', icone: 'LogOut' },
  pedido_acesso: { label: 'Pedido de acesso', cor: 'amber', icone: 'UserPlus' },
  acesso_aprovado: { label: 'Acesso aprovado', cor: 'emerald', icone: 'UserCheck' },
  acesso_rejeitado: { label: 'Acesso rejeitado', cor: 'red', icone: 'UserX' },
  convite_enviado: { label: 'Convite enviado', cor: 'blue', icone: 'Mail' },
  convite_reenviado: { label: 'Convite reenviado', cor: 'blue', icone: 'Mail' },
  convite_cancelado: { label: 'Convite cancelado', cor: 'slate', icone: 'MailX' },
  convite_aceite: { label: 'Convite aceite', cor: 'emerald', icone: 'KeyRound' },
  acesso_revogado: { label: 'Acesso revogado', cor: 'red', icone: 'Ban' },
  acesso_reativado: { label: 'Acesso reactivado', cor: 'emerald', icone: 'UserCheck' },
  perfis_alterados: { label: 'Perfis alterados', cor: 'violet', icone: 'UserCog' },
  permissoes_alteradas: { label: 'Permissões de páginas alteradas', cor: 'violet', icone: 'ShieldCheck' },
  perfil_criado: { label: 'Perfil próprio criado', cor: 'violet', icone: 'ShieldCheck' },
  perfil_alterado: { label: 'Perfil próprio alterado', cor: 'violet', icone: 'ShieldCheck' },
  perfil_apagado: { label: 'Perfil próprio apagado', cor: 'red', icone: 'ShieldCheck' },
  utilizador_editado: { label: 'Utilizador editado', cor: 'violet', icone: 'Pencil' },
  utilizador_excluido: { label: 'Utilizador excluído', cor: 'red', icone: 'Trash2' },
  config_alterada: { label: 'Configuração alterada', cor: 'violet', icone: 'Settings' },
  email_teste: { label: 'Email de teste', cor: 'blue', icone: 'Send' },
  aviso_criado: { label: 'Aviso criado', cor: 'violet', icone: 'Megaphone' },
  aviso_alterado: { label: 'Aviso alterado', cor: 'violet', icone: 'Megaphone' },
  aviso_removido: { label: 'Aviso removido', cor: 'slate', icone: 'Megaphone' },
  aviso_enviado: { label: 'Aviso enviado por email', cor: 'blue', icone: 'Mail' },
  conta_clonada: { label: 'Conta importada', cor: 'blue', icone: 'Copy' },
  matricula_criada: { label: 'Inscrição em curso', cor: 'blue', icone: 'BookOpen' },
  curso_concluido: { label: 'Curso concluído', cor: 'emerald', icone: 'CheckCircle2' },
  matricula_reaberta: { label: 'Recertificação', cor: 'amber', icone: 'RotateCcw' },
  certificado_emitido: { label: 'Certificado emitido', cor: 'emerald', icone: 'Award' },
  certificado_revogado: { label: 'Certificado revogado', cor: 'red', icone: 'Award' },
  avaliacao_submetida: { label: 'Avaliação submetida', cor: 'cyan', icone: 'ClipboardCheck' },
  sessao_inscricao: { label: 'Inscrição em sessão', cor: 'blue', icone: 'CalendarDays' },
  sessao_presenca: { label: 'Presença em sessão', cor: 'emerald', icone: 'CalendarCheck' },
  curso_versao: { label: 'Nova versão de curso', cor: 'violet', icone: 'GitBranch' },
  curso_criado: { label: 'Curso criado', cor: 'violet', icone: 'BookPlus' },
  email_formacao: { label: 'Email de formação', cor: 'blue', icone: 'Mail' },
  comentario: { label: 'Comentário', cor: 'slate', icone: 'MessageSquare' },
  distintivo: { label: 'Distintivo', cor: 'amber', icone: 'Medal' },
  excluir: { label: 'Registo excluído', cor: 'red', icone: 'Trash2' },
};
const capitalizar = (s) => { const t = String(s || '').replace(/[_-]+/g, ' ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : '—'; };
export function descreverAcao(acao) {
  return ACOES_AUDITORIA[acao] || { label: capitalizar(acao), cor: 'slate', icone: 'Activity' };
}
export const CORES_BADGE = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200',
  cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200',
};

// Filtro em memória do registo (texto livre, categoria, acção, intervalo de datas ISO "YYYY-MM-DD").
export function filtrarAuditoria(linhas, { texto = '', categoria = '', acao = '', de = '', ate = '', soIntegridade = false } = {}) {
  const q = String(texto || '').trim().toLowerCase();
  const tDe = de ? new Date(`${de}T00:00:00`).getTime() : null;
  const tAte = ate ? new Date(`${ate}T23:59:59.999`).getTime() : null;
  return (linhas || []).filter(l => {
    if (categoria && l.categoria !== categoria) return false;
    if (acao && l.acao !== acao) return false;
    if (soIntegridade && !(l.acao === 'avaliacao_submetida' && Number(l.dados?.eventos) > 0)) return false;
    const t = l.quando ? new Date(l.quando).getTime() : null;
    if (tDe != null && (t == null || t < tDe)) return false;
    if (tAte != null && (t == null || t > tAte)) return false;
    if (q) {
      const alvo = [l.actor_email, l.actor_nome, l.alvo, l.detalhe, descreverAcao(l.acao).label, l.ip].map(v => String(v || '').toLowerCase()).join(' ');
      if (!alvo.includes(q)) return false;
    }
    return true;
  });
}

// Agrupa linhas (já ordenadas por data desc) por dia: [{ dia: 'YYYY-MM-DD', label, itens }]
export function agruparPorDia(linhas, hoje = new Date()) {
  const grupos = new Map();
  const h = chaveDia(hoje); const ontem = chaveDia(new Date(hoje.getTime() - 86400000));
  for (const l of linhas || []) {
    const k = l.quando ? chaveDia(new Date(l.quando)) : 'sem-data';
    if (!grupos.has(k)) grupos.set(k, { dia: k, label: k === h ? 'Hoje' : k === ontem ? 'Ontem' : labelDia(k), itens: [] });
    grupos.get(k).itens.push(l);
  }
  return [...grupos.values()];
}
function chaveDia(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const DIAS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
function labelDia(k) {
  if (k === 'sem-data') return 'Sem data';
  const d = new Date(`${k}T12:00:00`);
  if (Number.isNaN(d.getTime())) return k;
  return `${DIAS_PT[d.getDay()]}, ${d.toLocaleDateString('pt-PT')}`;
}

// CSV para Excel em português (separador ";", BOM UTF-8, aspas escapadas).
export function csvDe(linhas, colunas) {
  const esc = (v) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cab = colunas.map(c => esc(c.label)).join(';');
  const corpo = (linhas || []).map(l => colunas.map(c => esc(typeof c.valor === 'function' ? c.valor(l) : l[c.chave])).join(';'));
  return '﻿' + [cab, ...corpo].join('\r\n');
}

export function saudacao(d = new Date()) {
  const h = d.getHours();
  if (h < 6) return 'Boa noite';
  if (h < 13) return 'Bom dia';
  if (h < 20) return 'Boa tarde';
  return 'Boa noite';
}
export function primeiroNome(nomeOuEmail) {
  const s = String(nomeOuEmail || '').trim();
  if (!s) return '';
  if (s.includes('@') && !s.includes(' ')) return s.split('@')[0];
  return s.split(/\s+/)[0];
}
export function iniciais(nomeOuEmail) {
  const s = String(nomeOuEmail || '').trim();
  if (!s) return '?';
  const base = s.includes('@') && !s.includes(' ') ? s.split('@')[0].replace(/[._-]+/g, ' ') : s;
  const partes = base.split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '?';
}

// Estado de um convite para listagens.
export function estadoConvite(c, agora = new Date()) {
  if (!c) return { chave: 'desconhecido', label: '—', cor: 'slate' };
  if (c.aceite_em) return { chave: 'aceite', label: 'Aceite', cor: 'emerald' };
  if (c.cancelado_em) return { chave: 'cancelado', label: 'Cancelado', cor: 'slate' };
  if (c.expira_em && new Date(c.expira_em).getTime() < agora.getTime()) return { chave: 'expirado', label: 'Expirado', cor: 'red' };
  if (c.enviado === false) return { chave: 'nao_enviado', label: 'Por entregar', cor: 'amber' };
  return { chave: 'pendente', label: 'Enviado', cor: 'blue' };
}
export const ESTADO_PEDIDO = {
  pendente: { label: 'Pendente', cor: 'amber' }, aprovado: { label: 'Aprovado', cor: 'emerald' }, rejeitado: { label: 'Rejeitado', cor: 'red' }, cancelado: { label: 'Cancelado', cor: 'slate' },
};

// Resumo para o painel de gestão.
export function resumoAcessos({ pedidos = [], convites = [], utilizadores = [] } = {}, agora = new Date()) {
  const pendentes = pedidos.filter(p => p.estado === 'pendente').length;
  const porAceitar = convites.filter(c => estadoConvite(c, agora).chave === 'pendente' || estadoConvite(c, agora).chave === 'nao_enviado').length;
  const ativos = utilizadores.filter(u => u.status === 'ativo').length;
  const formandos = utilizadores.filter(u => u.status === 'ativo' && Array.isArray(u.perfis) && u.perfis.includes('formando')).length;
  const semLogin30d = utilizadores.filter(u => u.status === 'ativo' && (!u.ultimo_login || (agora.getTime() - new Date(u.ultimo_login).getTime()) > 30 * 86400000)).length;
  return { pendentes, porAceitar, ativos, formandos, semLogin30d };
}

// Perfis de acesso do portal × páginas. "formando" é a base de todos os utilizadores activos (quem só tem perfis do DIROPS
// conta como formando no portal); "instrutor" acrescenta a gestão; "administrador" vê tudo (não configurável).
export const PAGINAS_PORTAL = [
  { chave: 'formacao', label: 'Cursos e a minha formação', grupo: 'Formando', descricao: 'Catálogo, cursos, aulas, avaliações, trilhas e certificados' },
  { chave: 'sessoes', label: 'Sessões', grupo: 'Formando', descricao: 'Agenda e inscrição em sessões presenciais e online' },
  { chave: 'ranking', label: 'Ranking e conquistas', grupo: 'Formando', descricao: 'Pontos, níveis, distintivos e top da empresa' },
  { chave: 'ajuda', label: 'Ajuda e suporte', grupo: 'Formando', descricao: 'FAQ, estado dos serviços e pedidos de apoio' },
  { chave: 'gestao', label: 'Painel de gestão', grupo: 'Gestão', descricao: 'Indicadores, perguntas sem resposta, últimos eventos' },
  { chave: 'gestao_cursos', label: 'Cursos e conteúdos', grupo: 'Gestão', descricao: 'Gestão de Formação completa (cursos, alunos, matriz, trilhas, banco de perguntas…)' },
  { chave: 'gestao_acessos', label: 'Acessos', grupo: 'Gestão', descricao: 'Pedidos, convites, utilizadores e perfis' },
  { chave: 'gestao_auditoria', label: 'Auditoria', grupo: 'Gestão', descricao: 'Registo de auditoria e exportações' },
  { chave: 'gestao_relatorios', label: 'Relatórios', grupo: 'Gestão', descricao: 'Conformidade, actividade, horas, certificados, sessões' },
  { chave: 'gestao_suporte', label: 'Suporte (tickets)', grupo: 'Gestão', descricao: 'Responder aos pedidos de apoio dos formandos' },
  { chave: 'gestao_avisos', label: 'Avisos', grupo: 'Gestão', descricao: 'Avisos da página inicial e envio por email' },
  { chave: 'gestao_configuracoes', label: 'Configurações', grupo: 'Gestão', descricao: 'Identidade, regras de acesso e envio de email' },
];
export const PAGINAS_SEMPRE = ['inicio', 'conta'];
export const PERMISSOES_PADRAO = {
  formando: ['formacao', 'sessoes', 'ranking', 'ajuda'],
  instrutor: ['formacao', 'sessoes', 'ranking', 'ajuda', 'gestao', 'gestao_cursos', 'gestao_acessos', 'gestao_auditoria', 'gestao_relatorios', 'gestao_suporte', 'gestao_avisos'],
  administrador: PAGINAS_PORTAL.map(p => p.chave),
};
// Perfis que só existem na Universidade (geridos em Acessos › Perfis); os restantes são perfis de função do DIROPS.
// Estas listas são actualizadas NO LUGAR quando os perfis próprios carregam (registarPerfisPersonalizadosUc): tudo o
// que já as percorre (filtros, matriz de formação, trilhas, obrigatoriedade, exportações) passa a ver os perfis próprios.
export const PERFIS_UNIVERSIDADE = ['formando', 'instrutor', 'admin_universidade'];
export const PERFIL_UC_LABEL = { formando: 'Formando', instrutor: 'Instrutor', admin_universidade: 'Administrador da Universidade' };
// Só os perfis da Universidade, com rótulo (para listas, exportações e emails); os perfis de função do DIROPS nunca aparecem no portal.
export const perfisUcTexto = (perfis) => (Array.isArray(perfis) ? perfis : []).filter(p => PERFIL_UC_LABEL[p]).map(p => PERFIL_UC_LABEL[p]).join(', ');
export const PERFIS_PORTAL = [{ chave: 'formando', label: 'Formando', descricao: 'Base de todos os utilizadores activos' }, { chave: 'instrutor', label: 'Instrutor', descricao: 'Formando + gestão' }, { chave: 'administrador', label: 'Administrador da Universidade', descricao: 'Tudo (não configurável)' }];

// ── perfis próprios (migração 188) ──
// O administrador cria perfis (nome, cor, descrição, páginas) sobre um NÍVEL BASE — formando ou instrutor — que é o
// que a base de dados e o servidor conhecem: quem tem o perfil tem exactamente os poderes do nível base nos dados.
// O nome técnico começa sempre por «uc_». Administração não é nível base (para isso dá-se admin_universidade).
export const PERFIS_BASE_UNIVERSIDADE = PERFIS_UNIVERSIDADE.slice();
const PERFIL_UC_LABEL_BASE = { ...PERFIL_UC_LABEL };
const PERFIS_PORTAL_BASE = PERFIS_PORTAL.slice();
export const NIVEIS_PERFIL_UC = [
  { chave: 'formando', perfil: 'formando', label: 'Formando', descricao: 'Aluno: cursos, sessões, ranking e certificados. Sem gestão.' },
  { chave: 'instrutor', perfil: 'instrutor', label: 'Instrutor', descricao: 'Também gere a formação: cria cursos e edita os seus, alunos, sessões, convites, avisos e relatórios.' },
];
export const CORES_PERFIL_UC = ['#7c3aed', '#1d4ed8', '#0f766e', '#b45309', '#be123c', '#15803d', '#0369a1', '#475569'];
const PERSONALIZADOS_UC = new Map();      // perfil → { perfil, label, cor, descricao, nivel }
export const ehNomePerfilUc = (p) => /^uc_[a-z0-9_]{2,40}$/.test(String(p || ''));
export const ehCorPerfilUc = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
export function registarPerfisPersonalizadosUc(linhas) {
  PERSONALIZADOS_UC.clear();
  for (const r of Array.isArray(linhas) ? linhas : []) {
    if (r && r.personalizado && ehNomePerfilUc(r.perfil) && ['formando', 'instrutor'].includes(r.nivel) && String(r.label || '').trim()) {
      PERSONALIZADOS_UC.set(r.perfil, { perfil: r.perfil, label: String(r.label).trim(), cor: ehCorPerfilUc(r.cor) ? r.cor : null, descricao: r.descricao || null, nivel: r.nivel });
    }
  }
  PERFIS_UNIVERSIDADE.length = 0;
  PERFIS_UNIVERSIDADE.push(...PERFIS_BASE_UNIVERSIDADE, ...PERSONALIZADOS_UC.keys());
  for (const k of Object.keys(PERFIL_UC_LABEL)) if (!(k in PERFIL_UC_LABEL_BASE)) delete PERFIL_UC_LABEL[k];
  const proprios = [];
  for (const p of PERSONALIZADOS_UC.values()) {
    PERFIL_UC_LABEL[p.perfil] = p.label;
    const nv = NIVEIS_PERFIL_UC.find(n => n.chave === p.nivel);
    proprios.push({ chave: p.perfil, label: p.label, descricao: p.descricao || ('Perfil próprio · nível ' + (nv ? nv.label.toLowerCase() : p.nivel)), cor: p.cor, nivel: p.nivel, personalizado: true });
  }
  // colunas da matriz: formando, instrutor, perfis próprios, administrador (sempre o último)
  PERFIS_PORTAL.length = 0;
  PERFIS_PORTAL.push(...PERFIS_PORTAL_BASE.filter(p => p.chave !== 'administrador'), ...proprios, ...PERFIS_PORTAL_BASE.filter(p => p.chave === 'administrador'));
}
export const perfisPersonalizadosUc = () => Array.from(PERSONALIZADOS_UC.values());
// Nível de um perfil da Universidade: 'formando' | 'instrutor' | 'admin' | null (desconhecido ou de outro portal).
export const nivelDoPerfilUc = (p) => (p === 'admin_universidade' || p === 'administrador' ? 'admin' : p === 'formando' || p === 'instrutor' ? p : PERSONALIZADOS_UC.get(p)?.nivel || null);
// Nome técnico a partir do nome visível: «Coordenação FNLU» → «uc_coordenacao_fnlu».
export const slugPerfilUc = (nome) => 'uc_' + String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/, '');
// Perfil da Universidade (base ou próprio). Um nome «uc_…» ainda por carregar conta já como da Universidade.
export const ehPerfilUniversidade = (p) => PERFIS_UNIVERSIDADE.includes(p) || ehNomePerfilUc(p);
// Páginas por omissão de uma coluna da matriz: as suas, ou as do nível base (perfis próprios).
export const paginasPadraoUc = (chave) => PERMISSOES_PADRAO[chave] || PERMISSOES_PADRAO[nivelDoPerfilUc(chave)] || [];
// Perfis a gravar num convite/aprovação: sem perfil próprio, «formando» vai sempre (como antes); com um perfil próprio,
// «formando» só se for pedido (assim o perfil próprio pode limitar as páginas). Nunca devolve uma lista vazia.
export function perfisEscolhidosUc({ formando = true, instrutor = false, proprio = '' } = {}) {
  const p = ehNomePerfilUc(proprio) ? proprio : '';
  const out = [...(!p || formando ? ['formando'] : []), ...(instrutor ? ['instrutor'] : []), ...(p ? [p] : [])];
  return out.length ? out : ['formando'];
}
// Quantas pessoas têm um perfil (para avisar antes de o apagar).
export const contarComPerfil = (utilizadores, perfil) => (Array.isArray(utilizadores) ? utilizadores : []).filter(u => Array.isArray(u?.perfis) && u.perfis.includes(perfil)).length;

// Conta global: role 'admin'/'superadmin' guardado na base de dados (não o role derivado dos perfis). Acesso total ao
// DIROPS e à Universidade; os seus perfis e o seu acesso não se alteram no portal.
export const contaGlobal = (user) => user?.role === 'admin' || user?.role === 'superadmin';
export const ehAdminPortal = (user) => perfisPortal(user).admin;
export function perfisPortal(user) {
  const p = Array.isArray(user?.perfis) ? user.perfis : [];
  const proprios = p.filter(x => PERSONALIZADOS_UC.has(x));
  // Administrador do portal = perfil próprio «admin_universidade» ou conta global (role admin/superadmin na base de dados,
  // hoje só o dono); o «administrador» do DIROPS, por si, não administra a Universidade.
  // Instrutor = perfil «instrutor» ou um perfil próprio de nível instrutor (igual a pode_gerir_formacao() na base de dados).
  return {
    admin: p.includes('admin_universidade') || contaGlobal(user),
    instrutor: p.includes('instrutor') || proprios.some(x => PERSONALIZADOS_UC.get(x).nivel === 'instrutor'),
    formando: true,
    proprios,
  };
}
export const ehInstrutorUc = (user) => perfisPortal(user).instrutor;
// Pode gerir a formação (Gestão de Formação): igual a pode_gerir_formacao() na base de dados — administrador do DIROPS
// (role admin/superadmin ou perfil «administrador»), administrador da Universidade, instrutor ou perfil próprio de nível instrutor.
export const podeGerirFormacaoUc = (user) => {
  if (!user) return false;
  const p = Array.isArray(user.perfis) ? user.perfis : [];
  return contaGlobal(user) || p.includes('administrador') || p.includes('admin_universidade') || ehInstrutorUc(user);
};
// Conjunto de chaves de página que o utilizador pode abrir, dado o mapa perfil → páginas (predefinições se faltar).
// A coluna «Formando» vale para todos, EXCEPTO para quem só tem perfis próprios da Universidade (sem formando nem
// instrutor): esses vêem só as páginas dos seus perfis — é assim que um perfil próprio pode ter menos páginas.
export function paginasPermitidas(user, permissoes) {
  const r = perfisPortal(user);
  const set = new Set(PAGINAS_SEMPRE);
  if (r.admin) { PAGINAS_PORTAL.forEach(p => set.add(p.chave)); return set; }
  const meus = Array.isArray(user?.perfis) ? user.perfis : [];
  const soProprios = r.proprios.length > 0 && !meus.includes('formando') && !meus.includes('instrutor');
  const colunas = [...(soProprios ? [] : ['formando']), ...(meus.includes('instrutor') ? ['instrutor'] : []), ...r.proprios];
  for (const perfil of colunas) {
    const lista = Array.isArray(permissoes?.[perfil]) ? permissoes[perfil] : paginasPadraoUc(perfil);
    // as páginas de gestão nunca valem num perfil de nível formando (a base de dados também não lhe daria os dados)
    const gestaoOk = perfil === 'instrutor' || nivelDoPerfilUc(perfil) === 'instrutor';
    for (const k of lista) if (gestaoOk || !String(k).startsWith('gestao')) set.add(k);
  }
  return set;
}
export const podeVerPagina = (user, permissoes, chave) => !chave || paginasPermitidas(user, permissoes).has(chave);

// Tamanho do texto do portal (preferência guardada no navegador) — multiplica a escala automática pelo ecrã.
export const TAMANHOS_TEXTO = [{ value: 'pequeno', label: 'Pequeno', escala: 0.92 }, { value: 'normal', label: 'Normal (automático pelo ecrã)', escala: 1 }, { value: 'grande', label: 'Grande', escala: 1.12 }];
const CHAVE_TEXTO = 'uc:texto';
export function preferenciaTexto() { try { const v = localStorage.getItem(CHAVE_TEXTO); return TAMANHOS_TEXTO.some(t => t.value === v) ? v : 'normal'; } catch { return 'normal'; } }
export function aplicarEscalaPortal(valor = preferenciaTexto()) {
  if (typeof document === 'undefined') return;
  const t = TAMANHOS_TEXTO.find(x => x.value === valor) || TAMANHOS_TEXTO[1];
  document.documentElement.classList.add('portal-uc-html');
  document.documentElement.style.setProperty('--uc-escala', String(t.escala));
}
export function guardarPreferenciaTexto(valor) { try { localStorage.setItem(CHAVE_TEXTO, valor); } catch { /* */ } aplicarEscalaPortal(valor); }
export function retirarEscalaPortal() { if (typeof document === 'undefined') return; document.documentElement.classList.remove('portal-uc-html'); document.documentElement.style.removeProperty('--uc-escala'); }

// Valida o destino "next" após login (só caminhos dentro do portal, sem host externo).
export function destinoSeguro(next, fallback = PORTAL_BASE) {
  const n = String(next || '');
  if (!n.startsWith(PORTAL_BASE) || n.startsWith('//') || /[\s<>"']/.test(n)) return fallback;
  return n;
}
