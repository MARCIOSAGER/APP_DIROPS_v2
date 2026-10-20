// Portal de Documentos (GED separado do DIROPS) — perfis, páginas e permissões próprios, no molde da Universidade.
// Os perfis vivem em users.perfis e NÃO dão páginas do DIROPS: quem só os tem entra pelo portal.
export const PORTAL_DOCUMENTOS_BASE = '/documentos';
export const PORTAL_BASE = PORTAL_DOCUMENTOS_BASE;

export const PERFIS_DOCUMENTOS = ['leitor_documentos', 'editor_documentos', 'gestor_documentos', 'admin_documentos'];
export const PERFIL_DOC_LABEL = {
  leitor_documentos: 'Leitor de documentos',
  editor_documentos: 'Editor de documentos',
  gestor_documentos: 'Gestor de documentos',
  admin_documentos: 'Administrador de documentos',
};
export const PERFIS_PORTAL_DOCS = [
  { chave: 'leitor_documentos', label: 'Leitor', descricao: 'Consulta os documentos dos seus aeroportos' },
  { chave: 'editor_documentos', label: 'Editor', descricao: 'Carrega e edita documentos; não aprova' },
  { chave: 'gestor_documentos', label: 'Gestor', descricao: 'Aprova, publica, gere pastas, permissões e links' },
  { chave: 'admin_documentos', label: 'Administrador', descricao: 'Administra o portal e as configurações' },
];
// ── perfis personalizados (migração 179) ──
// O administrador cria perfis próprios (nome, cor, descrição) sobre um NÍVEL BASE — leitor, editor ou gestor — que é
// o que as regras de acesso aos dados conhecem. O nome técnico começa sempre por «doc_». Quando a tabela
// documentos_permissao carrega, as listas acima são actualizadas NO LUGAR: tudo o que já percorre os perfis do portal
// (matriz de páginas, pastas, pedidos de leitura, utilizadores, relatórios) passa a ver os personalizados.
export const PERFIS_BASE_DOCUMENTOS = PERFIS_DOCUMENTOS.slice();
const PERFIS_PORTAL_DOCS_BASE = PERFIS_PORTAL_DOCS.slice();
export const NIVEIS_PERFIL_DOCS = [
  { chave: 'leitor', perfil: 'leitor_documentos', label: 'Leitor', descricao: 'Consulta os documentos dos seus aeroportos' },
  { chave: 'editor', perfil: 'editor_documentos', label: 'Editor', descricao: 'Também carrega e edita documentos; não aprova' },
  { chave: 'gestor', perfil: 'gestor_documentos', label: 'Gestor', descricao: 'Também aprova, publica e gere pastas, links e acessos' },
];
const PERSONALIZADOS = new Map();          // perfil → { perfil, label, cor, descricao, nivel }
export const ehNomePerfilPersonalizado = (p) => /^doc_[a-z0-9_]{2,40}$/.test(String(p || ''));
export function registarPerfisPersonalizados(linhas) {
  PERSONALIZADOS.clear();
  for (const r of Array.isArray(linhas) ? linhas : []) {
    if (r && r.personalizado && ehNomePerfilPersonalizado(r.perfil) && ['leitor', 'editor', 'gestor'].includes(r.nivel)) PERSONALIZADOS.set(r.perfil, r);
  }
  PERFIS_DOCUMENTOS.length = 0;
  PERFIS_DOCUMENTOS.push(...PERFIS_BASE_DOCUMENTOS, ...PERSONALIZADOS.keys());
  for (const k of Object.keys(PERFIL_DOC_LABEL)) if (!PERFIS_BASE_DOCUMENTOS.includes(k)) delete PERFIL_DOC_LABEL[k];
  PERFIS_PORTAL_DOCS.length = 0;
  PERFIS_PORTAL_DOCS.push(...PERFIS_PORTAL_DOCS_BASE);
  for (const p of PERSONALIZADOS.values()) {
    PERFIL_DOC_LABEL[p.perfil] = p.label;
    const nv = NIVEIS_PERFIL_DOCS.find(n => n.chave === p.nivel);
    PERFIS_PORTAL_DOCS.push({ chave: p.perfil, label: p.label, descricao: p.descricao || ('Perfil próprio · nível ' + (nv ? nv.label.toLowerCase() : p.nivel)), cor: p.cor || null, nivel: p.nivel, personalizado: true });
  }
}
export const perfisPersonalizados = () => Array.from(PERSONALIZADOS.values());
export const nivelDoPerfil = (p) => (p === 'admin_documentos' ? 'admin' : NIVEIS_PERFIL_DOCS.find(n => n.perfil === p)?.chave || PERSONALIZADOS.get(p)?.nivel || null);
// Nome técnico a partir do nome visível: «Auditor ANAC» → «doc_auditor_anac».
export const slugPerfilDoc = (nome) => 'doc_' + String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

export const ehPerfilDocumentos = (p) => PERFIS_DOCUMENTOS.includes(p) || ehNomePerfilPersonalizado(p);
export const perfisDocTexto = (perfis) => (Array.isArray(perfis) ? perfis : []).filter(p => PERFIL_DOC_LABEL[p]).map(p => PERFIL_DOC_LABEL[p]).join(', ');

// Conta global: o dono acede a tudo em todas as plataformas (role na base de dados, não perfil do portal).
export const contaGlobal = (user) => user?.role === 'admin' || user?.role === 'superadmin';
const tem = (user, p) => Array.isArray(user?.perfis) && user.perfis.includes(p);

// Níveis do portal, iguais aos da base de dados (migração 136b): admin ⊃ gestor ⊃ editor ⊃ leitor.
export function perfisPortal(user) {
  // personalizados pelo nível base; um nome «doc_…» ainda por carregar conta já como leitor (o servidor decide na mesma)
  const meus = Array.isArray(user?.perfis) ? user.perfis : [];
  const niveis = new Set(meus.map(p => PERSONALIZADOS.get(p)?.nivel || (ehNomePerfilPersonalizado(p) ? 'leitor' : null)).filter(Boolean));
  const admin = contaGlobal(user) || tem(user, 'admin_documentos') || tem(user, 'administrador');
  const gestor = admin || tem(user, 'gestor_documentos') || niveis.has('gestor');
  const editor = gestor || tem(user, 'editor_documentos') || niveis.has('editor');
  const membro = editor || tem(user, 'leitor_documentos') || niveis.has('leitor');
  return { admin, gestor, editor, membro, leitor: membro };
}
export const ehAdminPortal = (user) => perfisPortal(user).admin;
export const ehGestorDocs = (user) => perfisPortal(user).gestor;
export const ehEditorDocs = (user) => perfisPortal(user).editor;

// Páginas do portal (a gestão pode afinar quais cada perfil vê, como na Universidade).
export const PAGINAS_PORTAL = [
  { chave: 'inicio', label: 'Início', descricao: 'Novidades e documentos em vigor recentes' },
  { chave: 'biblioteca', label: 'Biblioteca', descricao: 'Aeroporto, pastas e documentos' },
  { chave: 'pesquisa', label: 'Pesquisa', descricao: 'Procura por texto, tipo, estado e validade' },
  { chave: 'leituras', label: 'As minhas leituras', descricao: 'Documentos por confirmar e já confirmados' },
  { chave: 'aprovacao', label: 'Aprovações', descricao: 'Documentos à espera da minha assinatura' },
  { chave: 'gestao', label: 'Gestão — painel', descricao: 'Visão geral do portal' },
  { chave: 'gestao_documentos', label: 'Gestão — documentos', descricao: 'Carregar, editar, aprovar e publicar' },
  { chave: 'gestao_pastas', label: 'Gestão — pastas', descricao: 'Estrutura de pastas e permissões' },
  { chave: 'gestao_emendas', label: 'Gestão — emendas', descricao: 'Registo de emendas, folhas de controlo e confirmações' },
  { chave: 'gestao_codificacao', label: 'Gestão — codificação', descricao: 'Classes e manuais que o número do documento codifica' },
  { chave: 'gestao_avsec', label: 'Gestão — regime AVSEC', descricao: 'Páginas efectivas, cópias controladas, conferência e credenciados' },
  { chave: 'gestao_conformidade', label: 'Gestão — conformidade', descricao: 'Matriz requisito→parágrafo e impacto na formação' },
  { chave: 'gestao_links', label: 'Gestão — links', descricao: 'Links partilháveis com externos' },
  { chave: 'gestao_acessos', label: 'Gestão — acessos', descricao: 'Pedidos, convites e perfis' },
  { chave: 'gestao_auditoria', label: 'Gestão — auditoria', descricao: 'Quem viu, descarregou e alterou' },
  { chave: 'gestao_relatorios', label: 'Gestão — relatórios', descricao: 'Leitura, validade e cobertura por aeroporto' },
  { chave: 'gestao_configuracoes', label: 'Gestão — configurações', descricao: 'Identidade, emails e retenção' },
];
export const PAGINAS_SEMPRE = ['inicio', 'conta'];
export const PERMISSOES_PADRAO = {
  // 'aprovacao' entra já no leitor de propósito: quem revê ou aprova um documento pode não ter perfil de gestão
  // nenhum — é o caso de um director de aeroporto que só lê. Sem isto, o fluxo ficava invisível a quem tem de o
  // assinar, que é precisamente o momento em que alguém empresta a senha a outra pessoa para destravar a coisa.
  // A página mostra apenas o que espera a assinatura de quem a abre; não dá acesso a documento nenhum por si só.
  leitor_documentos: ['inicio', 'biblioteca', 'pesquisa', 'leituras', 'aprovacao'],
  editor_documentos: ['inicio', 'biblioteca', 'pesquisa', 'leituras', 'aprovacao', 'gestao', 'gestao_documentos'],
  gestor_documentos: PAGINAS_PORTAL.filter(p => p.chave !== 'gestao_configuracoes').map(p => p.chave),
  admin_documentos: PAGINAS_PORTAL.map(p => p.chave),
};

// Conjunto de páginas que o utilizador pode abrir. `permissoes` é a tabela afinada na gestão (perfil → páginas).
export function paginasPermitidas(user, permissoes) {
  const set = new Set(PAGINAS_SEMPRE);
  if (!user) return set;
  if (ehAdminPortal(user)) { PAGINAS_PORTAL.forEach(p => set.add(p.chave)); return set; }
  const perfis = Array.isArray(user.perfis) ? user.perfis.filter(ehPerfilDocumentos) : [];
  for (const perfil of perfis) {
    const lista = permissoes?.[perfil] || PERMISSOES_PADRAO[perfil] || [];
    lista.forEach(p => set.add(p));
  }
  return set;
}
export const podeVerPagina = (user, permissoes, chave) => !chave || paginasPermitidas(user, permissoes).has(chave);

// Estados do documento (migração 135) — a ordem é o percurso de aprovação.
export const ESTADOS_DOCUMENTO = [
  { chave: 'rascunho', label: 'Rascunho', cor: 'bg-slate-100 text-slate-700 border-slate-200' },
  { chave: 'em_revisao', label: 'Em revisão', cor: 'bg-amber-100 text-amber-800 border-amber-200' },
  { chave: 'aprovado', label: 'Aprovado', cor: 'bg-sky-100 text-sky-800 border-sky-200' },
  { chave: 'em_vigor', label: 'Em vigor', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { chave: 'obsoleto', label: 'Obsoleto', cor: 'bg-slate-200 text-slate-600 border-slate-300' },
];
export const ESTADO_LABEL = Object.fromEntries(ESTADOS_DOCUMENTO.map(e => [e.chave, e.label]));
export const ESTADO_COR = Object.fromEntries(ESTADOS_DOCUMENTO.map(e => [e.chave, e.cor]));
// «fonte» é um estado de VERSÃO (o ficheiro-fonte editável, p.ex. o .docx de origem de um PDF em vigor), não de
// documento. Fica DE PROPÓSITO fora de ESTADOS_DOCUMENTO (que alimenta filtros e mudanças de estado do documento),
// mas tem rótulo/cor para o histórico de versões — e, por não ser «aprovado» nem «em_vigor», não conta como
// revisão mais recente, logo não dispara o aviso «versão substituída».
ESTADO_LABEL.fonte = 'Fonte editável';
ESTADO_COR.fonte = 'bg-indigo-100 text-indigo-800 border-indigo-200';
export const estadoPublicado = (e) => (e || 'em_vigor') === 'em_vigor';

// Validade: dias que faltam até expirar (null quando não expira).
export function diasParaExpirar(documento, hoje = new Date()) {
  const d = documento?.expira_em || documento?.data_expiracao;
  if (!d) return null;
  const alvo = new Date(d);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.ceil((alvo - hoje) / 86400000);
}
export function estadoValidade(documento, hoje = new Date()) {
  const dias = diasParaExpirar(documento, hoje);
  if (dias === null) return { chave: 'sem_validade', label: 'Sem validade', cor: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (dias < 0) return { chave: 'expirado', label: 'Expirado', cor: 'bg-red-100 text-red-800 border-red-200', dias };
  if (dias <= 30) return { chave: 'expira_30', label: `Expira em ${dias} dia${dias === 1 ? '' : 's'}`, cor: 'bg-amber-100 text-amber-800 border-amber-200', dias };
  if (dias <= 90) return { chave: 'expira_90', label: `Expira em ${dias} dias`, cor: 'bg-sky-100 text-sky-800 border-sky-200', dias };
  return { chave: 'valido', label: 'Válido', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200', dias };
}

// Navegação segura dentro do portal (evita saltos para fora com ?next=).
export function destinoSeguro(next, fallback = PORTAL_BASE) {
  const v = String(next || '').trim();
  if (!v.startsWith('/') || v.startsWith('//')) return fallback;
  return v.startsWith(PORTAL_BASE) ? v : fallback;
}
export const iniciais = (nomeOuEmail) => {
  const base = String(nomeOuEmail || '').trim();
  if (!base) return '?';
  const nome = base.includes('@') ? base.split('@')[0].replace(/[._-]+/g, ' ') : base;
  const partes = nome.split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '?';
};
export const primeiroNome = (nomeOuEmail) => {
  const base = String(nomeOuEmail || '').trim();
  if (!base) return '';
  const nome = base.includes('@') ? base.split('@')[0].replace(/[._-]+/g, ' ') : base;
  return nome.split(/\s+/)[0].replace(/^./, c => c.toUpperCase());
};
