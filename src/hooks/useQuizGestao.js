// Hooks de dados do quiz (gestão via PostgREST/RLS; o aluno usa quizApi + useQuizzesCurso).
import { useQuery } from '@tanstack/react-query';
import { Quiz } from '@/entities/Quiz';
import { Pergunta } from '@/entities/Pergunta';
import { QuizItem } from '@/entities/QuizItem';
import { Tentativa } from '@/entities/Tentativa';

const COMMON = { staleTime: 30 * 1000, refetchOnWindowFocus: false };

// Quizzes de um curso (o aluno lê os activos por RLS; o gestor todos).
export function useQuizzesCurso(cursoId, { apenasAtivos = false } = {}) {
  return useQuery({
    queryKey: ['quiz', 'curso', cursoId, apenasAtivos ? 'ativos' : 'todos'],
    queryFn: async () => {
      const rows = await Quiz.filter(apenasAtivos ? { curso_id: cursoId, ativo: true } : { curso_id: cursoId }, 'ordem');
      return rows.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.created_date).localeCompare(String(b.created_date)));
    },
    enabled: !!cursoId,
    ...COMMON,
  });
}

export function useQuizItens(quizId) {
  return useQuery({
    queryKey: ['quiz_item', quizId],
    queryFn: async () => (await QuizItem.filter({ quiz_id: quizId }, 'ordem')).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    enabled: !!quizId,
    ...COMMON,
  });
}

// Banco de perguntas visível num curso: as do curso + as globais (curso_id nulo).
export function usePerguntas(cursoId) {
  return useQuery({
    queryKey: ['pergunta', 'banco', cursoId || 'global'],
    queryFn: async () => {
      const [doCurso, globais] = await Promise.all([
        cursoId ? Pergunta.filter({ curso_id: cursoId }, '-created_date') : Promise.resolve([]),
        Pergunta.filter({ curso_id: null }, '-created_date'),
      ]);
      const vistos = new Set();
      return [...doCurso, ...globais].filter(p => (vistos.has(p.id) ? false : (vistos.add(p.id), true)));
    },
    ...COMMON,
  });
}

export function useTentativasQuiz(quizId) {
  return useQuery({
    queryKey: ['tentativa', 'quiz', quizId],
    queryFn: () => Tentativa.filter({ quiz_id: quizId }, '-iniciada_em'),
    enabled: !!quizId,
    ...COMMON,
  });
}
