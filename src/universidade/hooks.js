// Dados do portal da Universidade: configuração, avisos, resumo do aluno, sessões, ranking, acessos, auditoria, tickets.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useCursosPublicados, useAulasResumo, useMinhasMatriculas, useMeuProgresso, useMeusCertificados, useTrilhasAluno } from '@/hooks/useFormacao';
import { cursoObrigatorioPara, estadoFormacao, ESTADOS, refrescamentosDe } from '@/lib/formacaoEstado';
import { univAcesso } from './api';
import { registarPerfisPersonalizadosUc, ehNomePerfilUc, ehCorPerfilUc, NIVEIS_PERFIL_UC, PERFIS_BASE_UNIVERSIDADE } from '@/lib/universidade';

const COMUM = { staleTime: 60 * 1000, refetchOnWindowFocus: false, retry: 1 };

export const CONFIG_PADRAO = {
  id: 'geral',
  nome_portal: 'Universidade Corporativa',
  slogan: 'Formação ao seu ritmo: cursos, procedimentos e certificados da SGA.',
  mensagem_login: '',
  texto_boas_vindas: '',
  guia_curso_id: null,
  registo_aberto: true,
  dominios_permitidos: ['sga.co.ao'],
  aprovacao_automatica_internos: false,
  validade_convite_dias: 7,
  email_remetente_nome: 'Universidade Corporativa · SGA',
  email_resposta: '',
  emails_notificar_acessos: '',
  email_suporte: '',
  rodape_email: 'Universidade Corporativa · SGA — Sociedade Gestora de Aeroportos',
  enviar_convites: true,
  enviar_aprovacoes: true,
  enviar_lembretes: true,
  enviar_certificados: true,
  enviar_sessoes: true,
  enviar_comentarios: true,
  imagem_inicio_url: null,
  imagem_inicio_credito: null,
  imagem_entrada_url: null,
  imagem_entrada_credito: null,
};
const comDefaults = (row) => ({ ...CONFIG_PADRAO, ...Object.fromEntries(Object.entries(row || {}).filter(([, v]) => v !== null && v !== undefined)) });

// Configuração completa (utilizador autenticado).
export function useConfigPortal() {
  return useQuery({
    queryKey: ['universidade_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('universidade_config').select('*').eq('id', 'geral').maybeSingle();
      if (error) throw error;
      return comDefaults(data);
    },
    ...COMUM, staleTime: 5 * 60 * 1000,
  });
}
// Subconjunto público (página de login, sem sessão).
export function useConfigPublica() {
  return useQuery({
    queryKey: ['universidade_config', 'publica'],
    queryFn: async () => {
      const { data, error } = await supabase.from('universidade_config_publica').select('*').maybeSingle();
      if (error) throw error;
      return comDefaults(data);
    },
    ...COMUM, staleTime: 5 * 60 * 1000,
  });
}
// Registo simples na auditoria do portal (best-effort, nunca bloqueia).
export async function auditarPortal(actor, { acao, entidade, id, detalhes, dados }) {
  try {
    await supabase.from('log_auditoria').insert({ usuario_email: actor?.email || 'desconhecido', usuario_nome: actor?.full_name || null, entidade, acao, modulo: 'Universidade', id_registro: id != null ? String(id) : null, detalhes: detalhes || null, dados_alterados: dados || null, user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null, created_date: new Date().toISOString() });
  } catch { /* */ }
}
// Editar dados básicos de um utilizador (administradores; RLS de users) com auditoria.
// Aeroportos da Universidade (lista própria) e perfil do formando (aeroporto, departamento, função) — tabelas universidade_*.
export function useAeroportosUc() {
  return useQuery({ queryKey: ['universidade_aeroporto'], queryFn: async () => { const { data } = await supabase.from('universidade_aeroporto').select('codigo,nome,ordem').eq('ativo', true).order('ordem'); return data || []; }, staleTime: 10 * 60 * 1000, retry: 0 });
}
export function useFormandoUc(email) {
  return useQuery({ queryKey: ['universidade_formando', String(email || '').toLowerCase()], queryFn: async () => { const { data } = await supabase.from('universidade_formando').select('email,aeroporto,departamento,funcao,empresa,chefia').eq('email', String(email || '').toLowerCase()).maybeSingle(); return data || null; }, enabled: !!email, staleTime: 60 * 1000, retry: 0 });
}
export async function guardarFormandoUc(email, { aeroporto, departamento, funcao, empresa, chefia } = {}) {
  const row = { email: String(email || '').toLowerCase(), aeroporto: aeroporto || null, departamento: String(departamento || '').trim() || null, funcao: String(funcao || '').trim() || null, updated_date: new Date().toISOString() };
  if (empresa !== undefined) row.empresa = String(empresa || '').trim() || null;
  if (chefia !== undefined) row.chefia = String(chefia || '').trim() || null;
  const { error } = await supabase.from('universidade_formando').upsert(row, { onConflict: 'email' });
  if (error) throw new Error(error.message);
  return row;
}
export async function editarUtilizadorPortal(u, { full_name, telefone, aeroporto, departamento, funcao }, actor) {
  const { User } = await import('@/entities/User');
  const patch = { full_name: String(full_name || '').trim() || u.full_name, telefone: String(telefone || '').trim() || null };
  await User.update(u.id, patch);
  if (aeroporto !== undefined || departamento !== undefined || funcao !== undefined) await guardarFormandoUc(u.email, { aeroporto, departamento, funcao });
  await auditarPortal(actor, { acao: 'utilizador_editado', entidade: 'users', id: u.id, detalhes: `Dados de ${u.email} editados`, dados: { antes: { full_name: u.full_name, telefone: u.telefone || null }, depois: patch } });
  return patch;
}
// Excluir a conta de acesso e o perfil (administradores) — via admin-user do backend, que remove no GoTrue e em users.
export async function excluirUtilizadorPortal(u, actor) {
  try {
    return await univAcesso('excluir', { user_id: u.id }); // o backend decide (conta da Universidade vs. DIROPS) e regista na auditoria
  } catch (e) {
    const semAccao = e?.status === 404 || (e?.status === 400 && /desconhecida/i.test(e.message || ''));
    if (!semAccao) throw e;
    // backend anterior ao patch 17: remover via admin-user (conta de acesso + perfil)
    const { data, error } = await supabase.functions.invoke('admin-user', { body: { action: 'delete', user_id: u.auth_id, email: u.email } });
    if (error || data?.error) throw new Error(error?.message || data?.error || 'Não foi possível excluir.');
    await auditarPortal(actor, { acao: 'utilizador_excluido', entidade: 'users', id: u.id, detalhes: `Conta de ${u.email} (${u.full_name || '—'}) excluída`, dados: { email: u.email, perfis: u.perfis || [] } });
    return { ok: true };
  }
}
// Perfis × páginas do portal (tabela universidade_permissao; predefinições se faltar). Só administradores gravam.
export function usePermissoesPortal() {
  return useQuery({
    queryKey: ['universidade_permissao'],
    queryFn: async () => {
      // '*' funciona antes e depois da migração 188 (perfis próprios: label, cor, descricao, nivel, personalizado)
      const { data, error } = await supabase.from('universidade_permissao').select('*');
      if (error) throw error;
      registarPerfisPersonalizadosUc(data || []);
      const mapa = {};
      for (const r of data || []) mapa[r.perfil] = Array.isArray(r.paginas) ? r.paginas : [];
      return mapa;
    },
    ...COMUM, staleTime: 5 * 60 * 1000,
  });
}
export async function guardarPermissoesPortal(perfil, paginas, actor) {
  const { error } = await supabase.from('universidade_permissao').upsert({ perfil, paginas, updated_by: actor?.email || null }, { onConflict: 'perfil' });
  if (error) throw new Error(error.message || 'Não foi possível guardar.');
}
// Criar ou alterar um perfil próprio (migração 188). O nome técnico (uc_…) não muda depois de criado; ao alterar,
// `paginas` fica undefined e as páginas mantêm-se (mudam-se na matriz).
export async function guardarPerfilPersonalizadoUc({ perfil, label, cor, descricao, nivel, paginas }, actor) {
  if (!ehNomePerfilUc(perfil)) throw new Error('Nome técnico inválido (tem de começar por «uc_» e ter só letras minúsculas, números e _).');
  if (!String(label || '').trim()) throw new Error('Indique o nome do perfil.');
  if (!NIVEIS_PERFIL_UC.some(n => n.chave === nivel)) throw new Error('Escolha o nível base (formando ou instrutor).');
  const linha = {
    perfil, label: String(label).trim().slice(0, 60), cor: ehCorPerfilUc(cor) ? cor : null, descricao: String(descricao || '').trim().slice(0, 200) || null, nivel,
    personalizado: true, updated_by: actor?.email || null, updated_date: new Date().toISOString(),
  };
  if (Array.isArray(paginas)) linha.paginas = paginas;
  const { data, error } = Array.isArray(paginas)
    ? await supabase.from('universidade_permissao').insert(linha).select('perfil')
    : await supabase.from('universidade_permissao').update(linha).eq('perfil', perfil).eq('personalizado', true).select('perfil');
  if (error) {
    if (/column|schema cache|PGRST204/i.test(error.message || '')) throw new Error('A base de dados ainda não tem os perfis próprios (migração 188 por aplicar).');
    if (error.code === '23505') throw new Error('Já existe um perfil com este nome técnico.');
    throw new Error(error.message || 'Não foi possível guardar o perfil.');
  }
  if (!Array.isArray(data) || !data.length) throw new Error('O perfil não foi gravado (só administradores da Universidade gerem perfis).');
}
// Apagar um perfil próprio. A base de dados retira-o a quem o tinha (quem fica sem perfil da Universidade fica formando).
export async function apagarPerfilPersonalizadoUc(perfil) {
  if (!ehNomePerfilUc(perfil)) throw new Error('Só se apagam perfis próprios.');
  const { data, error } = await supabase.from('universidade_permissao').delete().eq('perfil', perfil).eq('personalizado', true).select('perfil');
  if (error) throw new Error(error.message || 'Não foi possível apagar o perfil.');
  if (!Array.isArray(data) || !data.length) throw new Error('O perfil não foi apagado (só administradores da Universidade gerem perfis).');
}
// Catálogo público (títulos dos cursos publicados) — página de entrada, sem sessão.
export function useCursosPublicos() {
  return useQuery({
    queryKey: ['universidade_cursos_publicos'],
    queryFn: async () => { const { data, error } = await supabase.from('universidade_cursos_publicos').select('*'); if (error) throw error; return data || []; },
    ...COMUM, staleTime: 5 * 60 * 1000,
  });
}
export async function guardarConfigPortal(patch) {
  const { data, error } = await supabase.from('universidade_config').update(patch).eq('id', 'geral').select().maybeSingle();
  if (error) throw new Error(error.message || 'Não foi possível guardar.');
  return comDefaults(data);
}

// Avisos: o aluno recebe pela RLS só os publicados e válidos; o gestor recebe todos (filtra em memória quando `gestao` = false).
export function useAvisos({ gestao = false } = {}) {
  return useQuery({
    queryKey: ['universidade_aviso', gestao ? 'gestao' : 'publicos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('universidade_aviso').select('*').is('deleted_at', null).order('destaque', { ascending: false }).order('publicado_em', { ascending: false }).limit(200);
      if (error) throw error;
      const agora = Date.now();
      return (data || []).filter(a => gestao || (a.publicado && new Date(a.publicado_em).getTime() <= agora && (!a.expira_em || new Date(a.expira_em).getTime() > agora)));
    },
    ...COMUM,
  });
}

// Resumo do aluno (mesmas regras da página de formação): cursos, matrículas, progresso, certificados, pendências obrigatórias, "continuar".
export function useResumoAluno(user) {
  const email = user?.email;
  const cursosQ = useCursosPublicados();
  const resumoQ = useAulasResumo();
  const matriculasQ = useMinhasMatriculas(email);
  const matriculas = matriculasQ.data || [];
  const matriculaIds = useMemo(() => matriculas.map(m => m.id), [matriculas]);
  const progressoQ = useMeuProgresso(email, matriculaIds);
  const certificadosQ = useMeusCertificados(email);
  const trilhasQ = useTrilhasAluno();
  const cursos = cursosQ.data || [];
  const resumo = resumoQ.data || {};
  const progresso = progressoQ.data || [];
  const certificados = certificadosQ.data || [];
  const trilhas = trilhasQ.data?.trilhas || [];
  const trilhaCursos = trilhasQ.data?.trilhaCursos || [];
  const cursosById = useMemo(() => Object.fromEntries(cursos.map(c => [c.id, c])), [cursos]);
  const matriculaPorCurso = useMemo(() => Object.fromEntries(matriculas.map(m => [m.curso_id, m])), [matriculas]);
  const infoCurso = useMemo(() => {
    const out = {};
    for (const c of cursos) {
      const obrigatorio = cursoObrigatorioPara(c, user, { trilhas, trilhaCursos });
      const refrescamentos = refrescamentosDe(c.id, cursos).map(r => matriculaPorCurso[r.id]).filter(Boolean);
      out[c.id] = { obrigatorio, ...estadoFormacao(c, matriculaPorCurso[c.id], { obrigatorio, refrescamentos }) };
    }
    return out;
  }, [cursos, user, trilhas, trilhaCursos, matriculaPorCurso]);
  const pendenciasObrig = useMemo(() => cursos
    .filter(c => ['em_falta', 'expirado', 'a_expirar', 'atrasado'].includes(infoCurso[c.id]?.estado) && (infoCurso[c.id]?.obrigatorio || matriculaPorCurso[c.id]))
    .sort((a, b) => (ESTADOS[infoCurso[a.id].estado].ordem - ESTADOS[infoCurso[b.id].estado].ordem)), [cursos, infoCurso, matriculaPorCurso]);
  const emCurso = useMemo(() => matriculas.filter(m => m.estado === 'ativo' && cursosById[m.curso_id]), [matriculas, cursosById]);
  const concluidos = useMemo(() => matriculas.filter(m => m.estado === 'concluido' && cursosById[m.curso_id]), [matriculas, cursosById]);
  const certsValidos = useMemo(() => certificados.filter(c => !c.revogado_em).sort((a, b) => String(b.emitido_em || '').localeCompare(String(a.emitido_em || ''))), [certificados]);
  const continuar = useMemo(() => {
    const m = [...emCurso].sort((a, b) => String(b.updated_date || '').localeCompare(String(a.updated_date || '')))[0];
    if (!m) return null;
    const curso = cursosById[m.curso_id];
    const ids = resumo[m.curso_id]?.ids || [];
    const feitas = new Set(progresso.filter(p => p.matricula_id === m.id).map(p => p.aula_id));
    const proximaId = ids.find(id => !feitas.has(id)) || null;
    const nFeitas = ids.filter(id => feitas.has(id)).length;
    return { matricula: m, curso, proximaId, nFeitas, total: ids.length };
  }, [emCurso, cursosById, resumo, progresso]);
  const novos = useMemo(() => [...cursos].sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || ''))).slice(0, 6), [cursos]);
  return {
    cursos, cursosById, resumo, matriculas, matriculaPorCurso, progresso, certificados, certsValidos, trilhas, infoCurso, pendenciasObrig, emCurso, concluidos, continuar, novos,
    carregando: cursosQ.isLoading || matriculasQ.isLoading, erro: cursosQ.error || matriculasQ.error,
  };
}

// Sessões (presenciais/online/híbridas) futuras e recentes de todos os cursos + inscrições do aluno.
export function useSessoesPortal(email) {
  const e = String(email || '').toLowerCase();
  return useQuery({
    queryKey: ['sessao_formacao', 'portal', e],
    queryFn: async () => {
      const [{ SessaoFormacao }, { SessaoInscricao }] = await Promise.all([import('@/entities/SessaoFormacao'), import('@/entities/SessaoInscricao')]);
      const desde = new Date(Date.now() - 60 * 86400000).toISOString();
      const sessoes = (await SessaoFormacao.filter({ deleted_at: null, inicio: { $gte: desde } }, 'inicio').catch(() => [])).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
      const inscricoes = e ? await SessaoInscricao.filter({ aluno_email: e }).catch(() => []) : [];
      return { sessoes, inscricoes };
    },
    ...COMUM,
  });
}

export function useRankingPortal(limite = 20) {
  return useQuery({
    queryKey: ['ranking_formacao', limite],
    queryFn: async () => { const { data, error } = await supabase.rpc('ranking_formacao', { p_limite: limite }); if (error) throw error; return Array.isArray(data) ? data : []; },
    ...COMUM,
  });
}

// Gestão de acessos (pedidos, convites, utilizadores) — via backend, com service role (evita as restrições de RLS da tabela users).
export function useAcessos(enabled = true) {
  return useQuery({
    queryKey: ['universidade_acessos'],
    queryFn: async () => {
      try { return await univAcesso('listar'); } catch (e) {
        if (e?.status !== 404) throw e;
        // serviço de acessos ainda não activo: lista limitada (sem último login) directamente da base de dados (RLS)
        const { User } = await import('@/entities/User');
        const [utilizadores, pedidos, convites] = await Promise.all([
          User.list('full_name', null, 'id,auth_id,email,full_name,perfis,status,telefone,empresa_id,role,created_date').catch(() => []),
          supabase.from('universidade_pedido_acesso').select('*').order('created_date', { ascending: false }).limit(500).then(r => r.data || []),
          supabase.from('universidade_convite').select('id,email,nome,telefone,perfis,pedido_id,auth_id,criado_por,expira_em,enviado,enviado_em,motivo_nao_enviado,reenvios,aceite_em,cancelado_em,cancelado_por,created_date').order('created_date', { ascending: false }).limit(500).then(r => r.data || []),
        ]);
        return { utilizadores, pedidos, convites, degradado: true };
      }
    },
    enabled, ...COMUM, staleTime: 30 * 1000,
  });
}
// Perfis da Universidade de um utilizador (só administradores; RLS da tabela users): mantém os outros perfis e regista na auditoria.
export async function guardarPerfisUniversidade(u, { formando, instrutor, admin = false, personalizados = [] }, actor) {
  // O backend (acção «perfis», patch 18; perfis próprios no patch 34) altera só os perfis da Universidade, valida e regista na auditoria.
  const proprios = [...new Set((Array.isArray(personalizados) ? personalizados : []).filter(ehNomePerfilUc))];
  try {
    const r = await univAcesso('perfis', { user_id: u.id, formando: !!formando, instrutor: !!instrutor, admin: !!admin, personalizados: proprios });
    const gravados = Array.isArray(r?.perfis) ? r.perfis : [];
    const emFalta = proprios.filter(p => !gravados.includes(p));
    if (emFalta.length) throw new Error('O servidor ainda não conhece os perfis próprios (patch 34 por aplicar ou perfil apagado entretanto): ' + emFalta.join(', ') + '. Os restantes perfis foram gravados.');
    return gravados;
  } catch (e) {
    const semAccao = e?.status === 404 || (e?.status === 400 && /desconhecida/i.test(e.message || ''));
    if (!semAccao) throw e;
  }
  // backend anterior ao patch 18: gravar directamente (a RLS de users só o permite a administradores do DIROPS)
  const { User } = await import('@/entities/User');
  const daUc = (p) => PERFIS_BASE_UNIVERSIDADE.includes(p) || ehNomePerfilUc(p);
  const outros = (Array.isArray(u.perfis) ? u.perfis : []).filter(p => !daUc(p));
  const perfis = [...outros, ...(formando ? ['formando'] : []), ...(instrutor ? ['instrutor'] : []), ...(admin ? ['admin_universidade'] : []), ...proprios];
  await User.update(u.id, { perfis });
  await auditarPortal(actor, { acao: 'perfis_alterados', entidade: 'users', id: u.id, detalhes: `Perfis da Universidade de ${u.email}: ${perfis.filter(daUc).join(', ') || 'nenhum'}`, dados: { email: u.email, antes: u.perfis || [], depois: perfis } });
  return perfis;
}
export function useEstadoAcessos(enabled = true) {
  return useQuery({ queryKey: ['universidade_acessos', 'estado'], queryFn: () => univAcesso('estado'), enabled, ...COMUM, staleTime: 5 * 60 * 1000, retry: 0 });
}

// Registo unificado de auditoria (vista security_invoker: cada utilizador só vê o que a RLS lhe permite).
export function useAuditoriaUniversidade({ de, ate, limite = 1000 } = {}) {
  return useQuery({
    queryKey: ['universidade_auditoria', de, ate, limite],
    queryFn: async () => {
      let q = supabase.from('universidade_auditoria').select('*').order('quando', { ascending: false }).limit(limite);
      if (de) q = q.gte('quando', `${de}T00:00:00`);
      if (ate) q = q.lte('quando', `${ate}T23:59:59.999`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    ...COMUM,
  });
}

// Tickets de suporte: os do próprio (RLS) ou, para gestores, os da categoria "universidade" (admins podem ver todos).
export function useTicketsUniversidade({ todos = false } = {}) {
  return useQuery({
    queryKey: ['ticket_suporte', 'universidade', todos],
    queryFn: async () => {
      let q = supabase.from('ticket_suporte').select('*').order('created_date', { ascending: false }).limit(300);
      if (!todos) q = q.eq('categoria', 'universidade');
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    ...COMUM, staleTime: 30 * 1000,
  });
}
export function useMeusTickets(email) {
  const e = String(email || '').toLowerCase();
  return useQuery({
    queryKey: ['ticket_suporte', 'meus', e],
    enabled: !!e,
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_suporte').select('*').ilike('solicitante_email', e).order('created_date', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    ...COMUM, staleTime: 30 * 1000,
  });
}

// Perguntas de formandos sem resposta de instrutor (para o painel de gestão): comentários de topo, não apagados,
// sem nenhuma resposta marcada como instrutor. Inclui título da aula para ligar directamente.
export function usePerguntasSemResposta(limite = 8) {
  return useQuery({
    queryKey: ['aula_comentario', 'sem_resposta', limite],
    queryFn: async () => {
      const [{ AulaComentario }, { Aula }] = await Promise.all([import('@/entities/AulaComentario'), import('@/entities/Aula')]);
      const todos = await AulaComentario.filter({ deleted_at: null }, '-created_date', 400).catch(() => []);
      const respondidos = new Set(todos.filter(c => c.parent_id && c.instrutor).map(c => c.parent_id));
      const abertas = todos.filter(c => !c.parent_id && !c.instrutor && !respondidos.has(c.id));
      const ids = [...new Set(abertas.map(c => c.aula_id).filter(Boolean))].slice(0, 200);
      const aulas = ids.length ? await Aula.filter({ id: ids }, null, null, null, 'id,titulo,curso_id').catch(() => []) : [];
      const porAula = new Map(aulas.map(a => [a.id, a]));
      return { total: abertas.length, itens: abertas.slice(0, limite).map(c => ({ ...c, aula: porAula.get(c.aula_id) || null })) };
    },
    ...COMUM,
  });
}
