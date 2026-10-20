import { describe, it, expect } from 'vitest';
import { analiticaCurso, sequenciaAulas, fmtSegundos } from '@/lib/formacaoAnalitica';

const hoje = new Date('2026-09-29T12:00:00Z');
const modulos = [{ id: 'm1', ordem: 1 }, { id: 'm2', ordem: 2 }];
const aulas = [{ id: 'a1', modulo_id: 'm1', ordem: 1, titulo: 'A1', duracao_min: 10 }, { id: 'a2', modulo_id: 'm1', ordem: 2, titulo: 'A2', duracao_min: 10 }, { id: 'a3', modulo_id: 'm2', ordem: 1, titulo: 'A3', duracao_min: 20 }];
const matriculas = [
  { id: 'x1', aluno_email: 'ana@sga.co.ao', estado: 'concluido', progresso_pct: 100, created_date: '2026-09-01T00:00:00Z', concluido_em: '2026-09-11T00:00:00Z' },
  { id: 'x2', aluno_email: 'bruno@sga.co.ao', estado: 'ativo', progresso_pct: 33, created_date: '2026-09-10T00:00:00Z' },
  { id: 'x3', aluno_email: 'carla@sga.co.ao', estado: 'ativo', progresso_pct: 0, created_date: '2026-09-20T00:00:00Z' },
];
const progresso = [{ matricula_id: 'x1', aula_id: 'a1' }, { matricula_id: 'x1', aula_id: 'a2' }, { matricula_id: 'x1', aula_id: 'a3' }, { matricula_id: 'x2', aula_id: 'a1' }];
const atividades = [{ matricula_id: 'x1', aula_id: 'a1', tempo_s: 600, visitas: 1, ultima_em: '2026-09-05T10:00:00Z' }, { matricula_id: 'x2', aula_id: 'a1', tempo_s: 120, visitas: 3, posicao_s: 40, ultima_em: '2026-09-12T10:00:00Z' }, { matricula_id: 'x1', aula_id: 'a3', tempo_s: 1200, visitas: 2, ultima_em: '2026-09-10T10:00:00Z' }];
const tentativas = [
  { quiz_id: 'q1', aluno_email: 'ana@sga.co.ao', estado: 'submetida', nota: 80, aprovado: true, submetida_em: '2026-08-15T10:00:00Z', perguntas: [{ id: 'p1', enunciado: 'P1', tipo: 'vf' }, { id: 'p2', enunciado: 'P2', tipo: 'escolha_unica' }], respostas: [{ pergunta_id: 'p1', correta: true, respondida: true }, { pergunta_id: 'p2', correta: false, respondida: false }] },
  { quiz_id: 'q1', aluno_email: 'bruno@sga.co.ao', estado: 'submetida', nota: 50, aprovado: false, submetida_em: '2026-09-15T10:00:00Z', perguntas: [], respostas: [{ pergunta_id: 'p1', correta: false, respondida: true }, { pergunta_id: 'p2', correta: true, respondida: true }] },
  { quiz_id: 'q1', aluno_email: 'bruno@sga.co.ao', estado: 'em_curso', respostas: {} },
];
const users = [{ email: 'ana@sga.co.ao', aeroportos_acesso: ['FNLU'] }, { email: 'bruno@sga.co.ao', aeroportos_acesso: ['FNLU', 'XXXX'] }, { email: 'carla@sga.co.ao', aeroportos_acesso: [] }];

describe('formacaoAnalitica', () => {
  it('ordena as aulas por módulo e ordem', () => {
    expect(sequenciaAulas(modulos, aulas).map(a => a.id)).toEqual(['a1', 'a2', 'a3']);
  });
  it('resumo, funil por aula e abandono', () => {
    const an = analiticaCurso({ modulos, aulas, matriculas, progresso, atividades, tentativas, users, hoje });
    expect(an.resumo).toMatchObject({ inscritos: 3, concluidos: 1, emCurso: 2, naoComecaram: 1, taxaConclusao: 33.3, diasMedioConclusao: 10, duracaoPrevistaS: 2400 });
    expect(an.resumo.tempoMedioTotalS).toBe(Math.round((1800 + 120) / 2));
    expect(an.porAula[0]).toMatchObject({ concluida: 2, pctConcluida: 66.7, tempoMedioS: 360, visitasMedia: 2, abandonos: 1 }); // Bruno parou depois da A1
    expect(an.porAula[2]).toMatchObject({ concluida: 1, tempoMedioS: 1200, abandonos: 0 });
  });
  it('dificuldade das perguntas com tendência mensal', () => {
    const an = analiticaCurso({ modulos, aulas, matriculas, progresso, atividades, tentativas, users, hoje });
    const p1 = an.porPergunta.find(p => p.pergunta_id === 'p1');
    expect(p1).toMatchObject({ enunciado: 'P1', n: 2, certas: 1, pct: 50, tendencia: -100 });
    const p2 = an.porPergunta.find(p => p.pergunta_id === 'p2');
    expect(p2).toMatchObject({ n: 2, certas: 1, sem: 1, pct: 50, tendencia: 100 });
    expect(an.porPergunta[0].pct).toBeLessThanOrEqual(an.porPergunta[1].pct);
  });
  it('por aeroporto (só SGA quando fornecido) e por mês', () => {
    const an = analiticaCurso({ modulos, aulas, matriculas, progresso, atividades, tentativas, users, aeroportos: [{ codigo_icao: 'FNLU', nome: 'Luanda' }], hoje });
    expect(an.porAeroporto).toHaveLength(1);
    expect(an.porAeroporto[0]).toMatchObject({ chave: 'FNLU · Luanda', inscritos: 2, concluidos: 1, taxaConclusao: 50, tentativas: 2, aprovacaoPct: 50, notaMedia: 65 });
    const set = an.porMes.find(m => m.mes === '2026-09');
    expect(set).toMatchObject({ inscricoes: 3, conclusoes: 1, tentativas: 1 });
    expect(set.horas).toBeCloseTo((600 + 120 + 1200) / 3600, 1);
    const semFiltro = analiticaCurso({ modulos, aulas, matriculas, progresso, atividades, tentativas, users, hoje });
    expect(semFiltro.porAeroporto.map(g => g.chave).sort()).toEqual(['(sem aeroporto)', 'FNLU', 'XXXX']);
  });
  it('formata segundos', () => {
    expect(fmtSegundos(0)).toBe('—'); expect(fmtSegundos(45)).toBe('45 s'); expect(fmtSegundos(600)).toBe('10 min'); expect(fmtSegundos(5400)).toBe('1 h 30 min');
  });
});
