// Hooks de dados da Universidade Corporativa (área do aluno).
// Chaves de query começam pelo nome da tabela para o invalidateEntityQueries
// (createEntity) as apanhar por prefixo após create/update/delete.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Curso } from '@/entities/Curso';
import { Modulo } from '@/entities/Modulo';
import { Aula } from '@/entities/Aula';
import { Matricula } from '@/entities/Matricula';
import { ProgressoAula } from '@/entities/ProgressoAula';
import { Certificado } from '@/entities/Certificado';

const COMMON = { staleTime: 60 * 1000, refetchOnWindowFocus: false };
const porOrdem = (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.titulo || '').localeCompare(String(b.titulo || ''));

// Catálogo: só cursos publicados (RLS já esconde os apagados).
export function useCursosPublicados() {
  return useQuery({
    queryKey: ['curso', 'publicados'],
    queryFn: async () => (await Curso.filter({ publicado: true }, 'ordem')).sort(porOrdem),
    ...COMMON,
  });
}

// Resumo leve de módulos+aulas de TODOS os cursos: contagens, duração e ids das
// aulas em ORDEM DE LEITURA (para "Retomar" saltar para a próxima por fazer).
export function useAulasResumo() {
  return useQuery({
    queryKey: ['aula', 'resumo'],
    queryFn: async () => {
      const [modulos, aulas] = await Promise.all([
        Modulo.list('ordem', null, 'id,curso_id,ordem'),
        Aula.list('ordem', null, 'id,modulo_id,curso_id,tipo,duracao_min,ordem'),
      ]);
      const aulasPorModulo = new Map();
      for (const a of aulas) {
        if (!aulasPorModulo.has(a.modulo_id)) aulasPorModulo.set(a.modulo_id, []);
        aulasPorModulo.get(a.modulo_id).push(a);
      }
      const porCurso = {};
      for (const m of [...modulos].sort(porOrdem)) {
        if (!m.curso_id) continue;
        if (!porCurso[m.curso_id]) porCurso[m.curso_id] = { aulas: 0, minutos: 0, ids: [] };
        for (const a of (aulasPorModulo.get(m.id) || []).sort(porOrdem)) {
          porCurso[m.curso_id].aulas += 1;
          porCurso[m.curso_id].minutos += Number(a.duracao_min) || 0;
          porCurso[m.curso_id].ids.push(a.id);
        }
      }
      return porCurso;
    },
    ...COMMON,
  });
}

// Conteúdo completo de um curso (módulos + aulas), para a página do curso e o leitor.
export function useCursoConteudo(cursoId) {
  return useQuery({
    queryKey: ['curso', cursoId, 'conteudo'],
    queryFn: async () => {
      const [curso, modulos] = await Promise.all([Curso.get(cursoId), Modulo.filter({ curso_id: cursoId }, 'ordem')]);
      const aulas = modulos.length ? await Aula.filter({ modulo_id: modulos.map(m => m.id) }, 'ordem') : [];
      return { curso, modulos, aulas };
    },
    enabled: !!cursoId,
    ...COMMON,
  });
}

// Matrículas do aluno autenticado (RLS: só as suas).
export function useMinhasMatriculas(email) {
  return useQuery({
    queryKey: ['matricula', 'aluno', email],
    queryFn: () => Matricula.filter({ aluno_email: email }, '-updated_date'),
    enabled: !!email,
    ...COMMON,
  });
}

// Progresso (aulas concluídas) de todas as matrículas do aluno.
export function useMeuProgresso(email, matriculaIds = []) {
  const ids = [...matriculaIds].sort();
  return useQuery({
    queryKey: ['progresso_aula', 'aluno', email, ids.join(',')],
    queryFn: () => (ids.length ? ProgressoAula.filter({ matricula_id: ids }) : Promise.resolve([])),
    enabled: !!email,
    ...COMMON,
  });
}

export function useMeusCertificados(email) {
  return useQuery({
    queryKey: ['certificado', 'aluno', email],
    queryFn: () => Certificado.filter({ aluno_email: email }, '-emitido_em'),
    enabled: !!email,
    ...COMMON,
  });
}

// Mutações do aluno: inscrever-se, marcar/desmarcar aula, com recálculo do progresso.
export function useFormacaoMutations(user) {
  const qc = useQueryClient();
  const email = user?.email;

  const refrescar = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matricula'] }),
      qc.invalidateQueries({ queryKey: ['progresso_aula'] }),
    ]);
  }, [qc]);

  const inscrever = useCallback(async (curso) => {
    if (!email) throw new Error('Sessão inválida. Faça login novamente.');
    const row = await Matricula.create({
      curso_id: curso.id,
      aluno_email: email,
      aluno_nome: user?.full_name || email,
      estado: 'ativo',
      progresso_pct: 0,
      origem: curso._origem || 'aluno',
      empresa_id: user?.empresa_id || null,
    });
    await refrescar();
    return row;
  }, [email, user, refrescar]);

  // Recertificação: reabre a matrícula num novo ciclo (RPC no servidor: limpa o progresso, mantém histórico).
  const recertificar = useCallback(async (matricula) => {
    const { supabase } = await import('@/lib/supabaseClient');
    const { data, error } = await supabase.rpc('reabrir_matricula', { p_matricula: matricula.id });
    if (error) throw new Error(error.message || 'Não foi possível reabrir a matrícula.');
    await refrescar();
    return data;
  }, [refrescar]);

  // Recalcula progresso_pct/estado da matrícula a partir do nº de aulas concluídas.
  // Com avaliação obrigatória (quiz que gera certificado), a conclusão só acontece ao aprovar
  // (marcada pelo servidor) — aqui o progresso chega a 100% mas o estado fica "ativo".
  const recalcular = useCallback(async (matricula, concluidas, total, bloquearConclusao = false) => {
    const pct = total > 0 ? Math.min(100, Math.round((concluidas / total) * 100)) : 0;
    const todas = total > 0 && concluidas >= total;
    // Uma matrícula já concluída (ex.: aprovada na avaliação) nunca regride automaticamente.
    const terminou = matricula.estado === 'concluido' ? true : (todas && !bloquearConclusao);
    const changes = {
      progresso_pct: pct,
      estado: terminou ? 'concluido' : 'ativo',
      concluido_em: terminou ? (matricula.concluido_em || new Date().toISOString()) : null,
    };
    await Matricula.update(matricula.id, changes);
    return { ...matricula, ...changes };
  }, []);

  const marcarAula = useCallback(async ({ matricula, aula, progressoAtual, totalAulas, bloquearConclusao = false, segundos = null }) => {
    const jaFeita = progressoAtual.some(p => p.aula_id === aula.id);
    if (!jaFeita) {
      try {
        const seg = Number.isFinite(Number(segundos)) && Number(segundos) > 0 ? Math.min(Math.round(Number(segundos)), 6 * 3600) : null;
        await ProgressoAula.create({ matricula_id: matricula.id, aula_id: aula.id, concluida: true, segundos: seg });
      } catch (e) {
        // 23505 = já existia (duplo clique / outra aba): tratar como sucesso.
        if (!/23505|duplicate/i.test(String(e?.message))) throw e;
      }
    }
    const concluidas = jaFeita ? progressoAtual.length : progressoAtual.length + 1;
    const nova = await recalcular(matricula, concluidas, totalAulas, bloquearConclusao);
    await refrescar();
    return nova;
  }, [recalcular, refrescar]);

  const desmarcarAula = useCallback(async ({ matricula, aula, progressoAtual, totalAulas, bloquearConclusao = false }) => {
    const row = progressoAtual.find(p => p.aula_id === aula.id);
    if (row) await ProgressoAula.delete(row.id);
    const concluidas = Math.max(0, progressoAtual.length - (row ? 1 : 0));
    const nova = await recalcular(matricula, concluidas, totalAulas, bloquearConclusao);
    await refrescar();
    return nova;
  }, [recalcular, refrescar]);

  return { inscrever, marcarAula, desmarcarAula, recertificar, refrescar };
}

// Actividade por aula de uma matrícula (posição do vídeo para retomar, tempo acumulado).
export function useAtividadeAulas(matriculaId) {
  return useQuery({
    queryKey: ['aula_atividade', 'matricula', matriculaId],
    queryFn: async () => { const { AulaAtividade } = await import('@/entities/AulaAtividade'); return AulaAtividade.filter({ matricula_id: matriculaId }); },
    enabled: !!matriculaId,
    staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false,
  });
}

// Sessões presenciais de um curso (aluno) + as inscrições do próprio.
export function useSessoesAluno(cursoId, email) {
  const e = String(email || '').toLowerCase();
  return useQuery({
    queryKey: ['sessao_formacao', 'aluno', cursoId, e],
    enabled: !!cursoId,
    queryFn: async () => {
      const [{ SessaoFormacao }, { SessaoInscricao }] = await Promise.all([import('@/entities/SessaoFormacao'), import('@/entities/SessaoInscricao')]);
      const sessoes = (await SessaoFormacao.filter({ curso_id: cursoId, deleted_at: null }, 'inicio')).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
      const inscricoes = e && sessoes.length ? await SessaoInscricao.filter({ aluno_email: e, sessao_id: sessoes.map(s => s.id) }).catch(() => []) : [];
      return { sessoes, inscricoes };
    },
    staleTime: 60 * 1000, refetchOnWindowFocus: false,
  });
}
// RPCs de inscrição em sessão (o servidor valida vagas, matrícula e lista de espera).
export async function inscreverSessao(sessaoId, modo = null) {
  const { supabase } = await import('@/lib/supabaseClient');
  const { data, error } = await supabase.rpc('inscrever_sessao', { p_sessao: sessaoId, p_modo: modo });
  if (error) throw new Error(error.message || 'Não foi possível inscrever na sessão.');
  return data;
}
// o aluno abriu o link da sessão online (evidência de participação); silencioso em erro
export async function registarEntradaSessao(sessaoId) {
  try { const { supabase } = await import('@/lib/supabaseClient'); const { data } = await supabase.rpc('registar_entrada_sessao', { p_sessao: sessaoId }); return data; } catch { return null; }
}
export async function cancelarInscricaoSessao(inscricaoId) {
  const { supabase } = await import('@/lib/supabaseClient');
  const { data, error } = await supabase.rpc('cancelar_inscricao_sessao', { p_inscricao: inscricaoId });
  if (error) throw new Error(error.message || 'Não foi possível cancelar a inscrição.');
  return data;
}

// Estado SCORM/xAPI de uma aula HTML5 para a matrícula (null se ainda não existe). poll: xAPI (o backend actualiza).
export function useScormEstado(matriculaId, aulaId, { poll = false } = {}) {
  return useQuery({
    queryKey: ['scorm_estado', matriculaId, aulaId],
    queryFn: async () => { const { ScormEstado } = await import('@/entities/ScormEstado'); const rows = await ScormEstado.filter({ matricula_id: matriculaId, aula_id: aulaId }); return rows[0] || null; },
    enabled: !!matriculaId && !!aulaId,
    staleTime: 60 * 1000, refetchOnWindowFocus: false,
    refetchInterval: (q) => (poll && !['completed', 'passed'].includes(q?.state?.data?.estado) ? 15000 : false),
  });
}

// Guarda (upsert) o estado SCORM. Silencioso em erro; devolve a linha guardada ou null.
export async function guardarScormEstado({ linha = null, matriculaId, aulaId, email, snap }) {
  if (!matriculaId || !aulaId || !snap) return null;
  const campos = { norma: snap.norma, estado: snap.estado, nota: snap.nota, sucesso: snap.sucesso, tempo_s: snap.tempo_s, dados: snap.dados || {} };
  if (snap.concluido && !linha?.concluido_em) campos.concluido_em = new Date().toISOString();
  try {
    const { ScormEstado } = await import('@/entities/ScormEstado');
    if (linha?.id) return await ScormEstado.update(linha.id, campos);
    try { return await ScormEstado.create({ matricula_id: matriculaId, aula_id: aulaId, aluno_email: email, ...campos }); }
    catch (e) {
      if (!/23505|duplicate/i.test(String(e?.message))) throw e;
      const rows = await ScormEstado.filter({ matricula_id: matriculaId, aula_id: aulaId });
      return rows[0] ? await ScormEstado.update(rows[0].id, campos) : null;
    }
  } catch { return null; }
}

// Regista actividade (RPC): deltaS segundos activos (0 = só visita) e posição do vídeo. Silencioso em erro.
export async function registarAtividade({ matriculaId, aulaId, deltaS = 0, posicaoS = null }) {
  if (!matriculaId || !aulaId) return null;
  try {
    const { supabase } = await import('@/lib/supabaseClient');
    const { data, error } = await supabase.rpc('registar_atividade', { p_matricula: matriculaId, p_aula: aulaId, p_delta_s: Math.max(0, Math.round(deltaS)), p_posicao_s: posicaoS == null ? null : Math.max(0, Math.round(posicaoS)) });
    if (error) return null;
    return data;
  } catch { return null; }
}

// Trilhas publicadas + cursos de cada uma (o aluno só vê publicadas, por RLS).
export function useTrilhasAluno() {
  return useQuery({
    queryKey: ['trilha', 'aluno'],
    queryFn: async () => {
      const [{ Trilha }, { TrilhaCurso }] = await Promise.all([import('@/entities/Trilha'), import('@/entities/TrilhaCurso')]);
      const [trilhas, trilhaCursos] = await Promise.all([Trilha.list('ordem'), TrilhaCurso.list('ordem')]);
      return { trilhas: trilhas.filter(t => t.publicado && !t.deleted_at).sort(porOrdem), trilhaCursos: trilhaCursos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)) };
    },
    ...COMMON,
  });
}
