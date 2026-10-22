// Hooks de dados da Gestão de Formação (instrutor/admin).
// Chaves começam pelo nome da tabela (invalidação por prefixo no createEntity).
import { ehPerfilUniversidade, nivelDoPerfilUc } from '@/lib/universidade';
import { supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Curso } from '@/entities/Curso';
import { Modulo } from '@/entities/Modulo';
import { Aula } from '@/entities/Aula';
import { Matricula } from '@/entities/Matricula';
import { ProgressoAula } from '@/entities/ProgressoAula';
import { Certificado } from '@/entities/Certificado';
import { CertificadoAssinante } from '@/entities/CertificadoAssinante';
import { Trilha } from '@/entities/Trilha';
import { TrilhaCurso } from '@/entities/TrilhaCurso';
import { User } from '@/entities/User';
import { Tentativa } from '@/entities/Tentativa';
import { Quiz } from '@/entities/Quiz';
import { FormacaoExterna } from '@/entities/FormacaoExterna';
import { NotificacaoFormacao } from '@/entities/NotificacaoFormacao';
import { LicencaConducao } from '@/entities/LicencaConducao';

// A população da formação é quem tem perfil da Universidade (formando, instrutor, administrador), não todos os utilizadores do DIROPS.
const soUniversidade = (us) => (Array.isArray(us) ? us : []).filter(u => (u.perfis || []).some(ehPerfilUniversidade));
// Aeroportos da Universidade (lista própria, gerida no portal) e perfil do formando (aeroporto/departamento/função).
export async function listarAeroportosUc() { const { data, error } = await supabase.from('universidade_aeroporto').select('codigo,nome,ordem').eq('ativo', true).order('ordem'); if (error) throw error; return data || []; }
export function useAeroportosUc() { return useQuery({ queryKey: ['universidade_aeroporto'], queryFn: () => listarAeroportosUc().catch(() => []), staleTime: 10 * 60 * 1000 }); }
export async function anexarPerfilUc(users) {
  let perfis = [];
  try { const { data } = await supabase.from('universidade_formando').select('email,aeroporto,departamento,funcao').limit(5000); perfis = data || []; } catch { perfis = []; }
  const m = new Map(perfis.map(p => [String(p.email || '').toLowerCase(), p]));
  return (Array.isArray(users) ? users : []).map(u => { const p = m.get(String(u.email || '').toLowerCase()); return { ...u, aeroportos_acesso: p?.aeroporto ? [p.aeroporto] : [], aeroporto_uc: p?.aeroporto || null, departamento_uc: p?.departamento || null, funcao_uc: p?.funcao || null }; });
}

const COMMON = { staleTime: 30 * 1000, refetchOnWindowFocus: false };
const porOrdem = (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.titulo || '').localeCompare(String(b.titulo || ''));

// Todos os cursos (rascunhos incluídos; RLS esconde os apagados).
export function useTodosCursos() {
  return useQuery({
    queryKey: ['curso', 'todos'],
    queryFn: async () => (await Curso.list('ordem')).sort(porOrdem),
    ...COMMON,
  });
}

// Contagens por curso: módulos/aulas + inscritos/concluídos (gestor vê todas as matrículas).
export function useEstatisticasCursos() {
  return useQuery({
    queryKey: ['matricula', 'estatisticas'],
    queryFn: async () => {
      const [modulos, aulas, matriculas] = await Promise.all([
        Modulo.list('ordem', null, 'id,curso_id'),
        Aula.list('ordem', null, 'id,modulo_id,curso_id'),
        Matricula.list(null, null, 'id,curso_id,estado,progresso_pct'),
      ]);
      const cursoDoModulo = new Map(modulos.map(m => [m.id, m.curso_id]));
      const st = {};
      const g = (id) => (st[id] ||= { modulos: 0, aulas: 0, inscritos: 0, concluidos: 0 });
      modulos.forEach(m => { if (m.curso_id) g(m.curso_id).modulos += 1; });
      aulas.forEach(a => { const c = a.curso_id || cursoDoModulo.get(a.modulo_id); if (c) g(c).aulas += 1; });
      matriculas.forEach(m => { const s = g(m.curso_id); s.inscritos += 1; if (m.estado === 'concluido') s.concluidos += 1; });
      return st;
    },
    ...COMMON,
  });
}

// Matrículas de um curso + progresso de cada uma.
export function useMatriculasCurso(cursoId) {
  return useQuery({
    queryKey: ['matricula', 'curso', cursoId],
    queryFn: async () => {
      const matriculas = await Matricula.filter({ curso_id: cursoId }, '-created_date');
      const progresso = matriculas.length ? await ProgressoAula.filter({ matricula_id: matriculas.map(m => m.id) }) : [];
      const porMatricula = {};
      progresso.forEach(p => { (porMatricula[p.matricula_id] ||= []).push(p); });
      return { matriculas, progresso: porMatricula };
    },
    enabled: !!cursoId,
    ...COMMON,
  });
}

// Assinantes (globais + específicos de curso).
export function useAssinantes() {
  return useQuery({
    queryKey: ['certificado_assinante', 'todos'],
    queryFn: async () => (await CertificadoAssinante.list('ordem')).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    ...COMMON,
  });
}

// Todos os certificados emitidos (gestor).
export function useTodosCertificados() {
  return useQuery({
    queryKey: ['certificado', 'todos'],
    queryFn: () => Certificado.list('-emitido_em'),
    ...COMMON,
  });
}

// Dados da matriz de formação: colaboradores activos × cursos publicados × matrículas × trilhas.
export function useDadosMatriz() {
  return useQuery({
    queryKey: ['matricula', 'matriz'],
    queryFn: async () => {
      const [users, cursos, matriculas, trilhas, trilhaCursos, externas] = await Promise.all([
        User.filter({ status: 'ativo' }, 'full_name', null, null, 'id,email,full_name,perfis').then(soUniversidade).then(anexarPerfilUc).catch(() => []),
        Curso.filter({ publicado: true }, 'ordem'),
        Matricula.list(null, null, 'id,curso_id,aluno_email,aluno_nome,estado,progresso_pct,concluido_em,valido_ate,created_date,reaberta_em,ciclo,certificado_num,origem'),
        Trilha.list('ordem').catch(() => []),
        TrilhaCurso.list('ordem').catch(() => []),
        FormacaoExterna.filter({ deleted_at: null, resultado: 'aprovado' }, null, null, null, 'id,aluno_email,curso_id,titulo,data_realizacao,valido_ate,resultado').catch(() => []),
      ]);
      return { users: users.filter(u => u.email), cursos: cursos.sort(porOrdem), matriculas, trilhas, trilhaCursos, externas };
    },
    ...COMMON,
  });
}

// Trilhas (gestor vê todas; aluno só publicadas, por RLS) + cursos de cada trilha.
export function useTrilhas() {
  return useQuery({
    queryKey: ['trilha', 'todas'],
    queryFn: async () => {
      const [trilhas, trilhaCursos] = await Promise.all([Trilha.list('ordem'), TrilhaCurso.list('ordem')]);
      return { trilhas: trilhas.sort(porOrdem), trilhaCursos: trilhaCursos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)) };
    },
    ...COMMON,
  });
}

// Utilizadores activos para inscrever (pode vir vazio se o RLS não deixar o instrutor ler users).
export function useUtilizadoresAtivos() {
  return useQuery({
    queryKey: ['users', 'ativos-formacao'],
    queryFn: async () => {
      try {
        const rows = await User.filter({ status: 'ativo' }, 'full_name', null, null, 'id,email,full_name,status');
        return rows.filter(u => u.email);
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Utilizadores activos com perfis (para escolher instrutores); só admins conseguem ler perfis de todos.
export function useUtilizadoresComPerfis() {
  return useQuery({
    queryKey: ['users', 'com-perfis'],
    queryFn: async () => {
      try { return (await User.filter({ status: 'ativo' }, 'full_name', null, null, 'id,email,full_name,perfis,status').then(soUniversidade).then(anexarPerfilUc)).filter(u => u.email); }
      catch { return []; }
    },
    staleTime: 60 * 1000, refetchOnWindowFocus: false,
  });
}
// instrutor = perfil «instrutor» ou perfil próprio de nível instrutor (migração 188: tem os mesmos poderes nos dados)
export const ehInstrutor = (u) => Array.isArray(u?.perfis) && (u.perfis.includes('instrutor') || u.perfis.some(p => nivelDoPerfilUc(p) === 'instrutor'));

// Sessões presenciais de um curso + inscrições (gestor).
export function useSessoesCurso(cursoId) {
  return useQuery({
    queryKey: ['sessao_formacao', 'curso', cursoId],
    enabled: !!cursoId,
    queryFn: async () => {
      const [{ SessaoFormacao }, { SessaoInscricao }] = await Promise.all([import('@/entities/SessaoFormacao'), import('@/entities/SessaoInscricao')]);
      const sessoes = (await SessaoFormacao.filter({ curso_id: cursoId, deleted_at: null }, 'inicio')).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
      const inscricoes = sessoes.length ? await SessaoInscricao.filter({ sessao_id: sessoes.map(s => s.id) }, 'created_date').catch(() => []) : [];
      return { sessoes, inscricoes };
    },
    ...COMMON,
  });
}

// Todas as sessões agendadas (visão geral / agenda do gestor).
export function useSessoesTodas() {
  return useQuery({
    queryKey: ['sessao_formacao', 'todas'],
    queryFn: async () => {
      const [{ SessaoFormacao }, { SessaoInscricao }] = await Promise.all([import('@/entities/SessaoFormacao'), import('@/entities/SessaoInscricao')]);
      const sessoes = await SessaoFormacao.filter({ deleted_at: null }, 'inicio').catch(() => []);
      const inscricoes = sessoes.length ? await SessaoInscricao.filter({ sessao_id: sessoes.map(s => s.id) }, null, null, null, 'id,sessao_id,aluno_email,estado').catch(() => []) : [];
      return { sessoes, inscricoes };
    },
    ...COMMON,
  });
}

// Analítica de um curso: aulas, matrículas, progresso, actividade por aula, tentativas, utilizadores e aeroportos SGA.
export function useAnaliticaCurso(cursoId) {
  return useQuery({
    queryKey: ['matricula', 'analitica', cursoId],
    enabled: !!cursoId,
    queryFn: async () => {
      const { AulaAtividade } = await import('@/entities/AulaAtividade');
      const [modulos, matriculas, quizzes, users, aeroportos] = await Promise.all([
        Modulo.filter({ curso_id: cursoId }, 'ordem'),
        Matricula.filter({ curso_id: cursoId }),
        Quiz.filter({ curso_id: cursoId }).catch(() => []),
        User.filter({ status: 'ativo' }, null, null, null, 'id,email,full_name,perfis').then(soUniversidade).then(anexarPerfilUc).catch(() => []),
        listarAeroportosUc().then(l => l.map(a => ({ codigo_icao: a.codigo, nome: a.nome, isSGA: true }))).catch(() => []),
      ]);
      const aulas = modulos.length ? await Aula.filter({ modulo_id: modulos.map(m => m.id) }, 'ordem') : [];
      const ids = matriculas.map(m => m.id);
      const [progresso, atividades, tentativas] = await Promise.all([
        ids.length ? ProgressoAula.filter({ matricula_id: ids }).catch(() => []) : [],
        ids.length ? AulaAtividade.filter({ matricula_id: ids }).catch(() => []) : [],
        quizzes.length ? Tentativa.filter({ quiz_id: quizzes.map(q => q.id) }, '-iniciada_em').catch(() => []) : [],
      ]);
      return { modulos, aulas, matriculas, progresso, atividades, tentativas, quizzes, users, aeroportosSGA: aeroportos.filter(a => a.isSGA === true) };
    },
    ...COMMON,
  });
}

// Toda a actividade por aula (gestor) — horas de estudo na visão geral.
export function useAtividadeTodas() {
  return useQuery({
    queryKey: ['aula_atividade', 'todas'],
    queryFn: async () => { const { AulaAtividade } = await import('@/entities/AulaAtividade'); return AulaAtividade.list(null, 50000, 'matricula_id,aula_id,aluno_email,tempo_s,ultima_em').catch(() => []); },
    ...COMMON,
  });
}

// Todas as tentativas submetidas (gestor) e todos os quizzes — para a visão geral.
export function useTentativasTodas() {
  return useQuery({
    queryKey: ['tentativa', 'todas'],
    queryFn: () => Tentativa.list('-iniciada_em', 20000, 'id,quiz_id,matricula_id,aluno_email,estado,nota,aprovado,correcao_pendente,iniciada_em,submetida_em,ciclo').catch(() => []),
    ...COMMON,
  });
}
export function useQuizzesTodos() {
  return useQuery({
    queryKey: ['quiz', 'todos'],
    queryFn: () => Quiz.list(null, null, 'id,curso_id,titulo,nota_minima,ativo').catch(() => []),
    ...COMMON,
  });
}

// Ficha completa de um colaborador: matrículas + progresso por aula, tentativas, certificados,
// formação externa, licenças de condução (Safety) e notificações enviadas.
export function useFichaAluno(email) {
  const e = String(email || '').toLowerCase();
  return useQuery({
    queryKey: ['matricula', 'ficha', e],
    enabled: !!e,
    queryFn: async () => {
      const [users, matriculas, tentativas, certificados, externas, notificacoes, licEmail, quizzes, aulas] = await Promise.all([
        User.filter({ email: e }, null, null, null, 'id,email,full_name,perfis,aeroportos_acesso,status').catch(() => []),
        Matricula.filter({ aluno_email: e }, '-created_date'),
        Tentativa.filter({ aluno_email: e }, '-iniciada_em', null, null, 'id,quiz_id,matricula_id,numero,estado,nota,aprovado,correcao_pendente,iniciada_em,submetida_em,tempo_gasto_s,ciclo').catch(() => []),
        Certificado.filter({ aluno_email: e }, '-emitido_em').catch(() => []),
        FormacaoExterna.filter({ aluno_email: e, deleted_at: null }, '-data_realizacao').catch(() => []),
        NotificacaoFormacao.filter({ destinatario: e }, '-enviada_em', 200).catch(() => []),
        LicencaConducao.filter({ aluno_email: e }, '-created_date').catch(() => []),
        Quiz.list(null, null, 'id,curso_id,titulo,nota_minima').catch(() => []),
        Aula.list('ordem', null, 'id,curso_id,modulo_id,titulo,ordem,duracao_min').catch(() => []),
      ]);
      const progresso = matriculas.length ? await ProgressoAula.filter({ matricula_id: matriculas.map(m => m.id) }).catch(() => []) : [];
      const aluno = users[0] || null;
      // licenças legadas (registadas à mão no Safety, sem email): por nome
      let licNome = [];
      if (aluno?.full_name) licNome = await LicencaConducao.filter({ nome_condutor: aluno.full_name }, '-created_date').catch(() => []);
      const vistos = new Set();
      const licencas = [...licEmail, ...licNome].filter(l => (vistos.has(l.id) ? false : (vistos.add(l.id), true)));
      return { aluno, matriculas, progresso, tentativas, certificados, externas, notificacoes, licencas, quizzes, aulas };
    },
    ...COMMON,
  });
}
