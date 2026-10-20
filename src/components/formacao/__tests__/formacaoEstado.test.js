import { describe, it, expect } from 'vitest';
import { estadoFormacao, matrizFormacao, validadeExterna, somarMeses } from '@/lib/formacaoEstado';

const hoje = new Date('2026-09-29T12:00:00Z');
const curso = { id: 'c1', titulo: 'Condução no Lado Ar', validade_meses: 12, obrigatorio_todos: true };
const user = { id: 'u1', email: 'ana@sga.co.ao', perfis: ['operacoes'] };
const ext = { id: 'x1', aluno_email: 'ana@sga.co.ao', curso_id: 'c1', titulo: 'Condução (ANAC)', resultado: 'aprovado', data_realizacao: '2026-03-01', valido_ate: null };

describe('formacaoEstado — formação externa', () => {
  it('calcula a validade da externa a partir do curso quando não vem preenchida', () => {
    expect(validadeExterna(curso, ext)).toBe(somarMeses('2026-03-01', 12));
    expect(validadeExterna(curso, { ...ext, valido_ate: '2027-01-15' })).toBe('2027-01-15');
    expect(validadeExterna(curso, { ...ext, resultado: 'reprovado' })).toBeUndefined();
    expect(validadeExterna(curso, { ...ext, deleted_at: '2026-09-01' })).toBeUndefined();
  });

  it('externa aprovada conta como válida mesmo sem matrícula (e marca a origem)', () => {
    const r = estadoFormacao(curso, null, { obrigatorio: true, hoje, externas: [ext] });
    expect(r).toMatchObject({ estado: 'valido', origem: 'externa' });
    expect(r.externa.id).toBe('x1');
  });

  it('externa expirada dá "expirado"; com matrícula activa por cima dá "em curso"', () => {
    const velha = { ...ext, data_realizacao: '2025-01-01' };
    expect(estadoFormacao(curso, null, { obrigatorio: true, hoje, externas: [velha] }).estado).toBe('expirado');
    expect(estadoFormacao(curso, { estado: 'ativo', created_date: '2026-09-01' }, { obrigatorio: true, hoje, externas: [velha] }).estado).toBe('em_curso');
  });

  it('prefere a conclusão com validade mais longa entre matrícula e externa', () => {
    const m = { estado: 'concluido', valido_ate: '2026-10-10T00:00:00Z' }; // a expirar em 11 dias
    const r = estadoFormacao(curso, m, { hoje, externas: [ext] }); // externa válida até 2027-03
    expect(r).toMatchObject({ estado: 'valido', origem: 'externa' });
    const r2 = estadoFormacao(curso, { estado: 'concluido', valido_ate: '2027-09-01T00:00:00Z' }, { hoje, externas: [ext] });
    expect(r2).toMatchObject({ estado: 'valido', origem: 'matricula' });
  });

  it('externa só conta para o curso a que está ligada; a matriz soma as externas por colaborador', () => {
    const outro = { id: 'c2', titulo: 'GRF', obrigatorio_todos: true };
    const m = matrizFormacao({ users: [user], cursos: [curso, outro], matriculas: [], externas: [ext, { ...ext, id: 'x2', curso_id: null, titulo: 'Primeiros socorros' }], hoje });
    expect(m.linhas[0].celulas[0].estado).toBe('valido');
    expect(m.linhas[0].celulas[1].estado).toBe('em_falta');
    expect(m.linhas[0].externas).toBe(2);
    expect(m.linhas[0].pendencias).toBe(1);
    expect(m.totais).toEqual({ valido: 1, em_falta: 1 });
  });

  it('refrescamento concluído renova o curso base; refrescamento em curso mostra "em curso"; não é coluna da matriz', () => {
    const refr = { id: 'r1', titulo: 'Condução — refrescamento', tipo_formacao: 'refrescamento', curso_base_id: 'c1', validade_meses: 12 };
    const baseExpirada = { id: 'm1', curso_id: 'c1', aluno_email: 'ana@sga.co.ao', estado: 'concluido', valido_ate: '2026-01-01T00:00:00Z' };
    const refConcluido = { id: 'm2', curso_id: 'r1', aluno_email: 'ana@sga.co.ao', estado: 'concluido', valido_ate: '2027-06-01T00:00:00Z' };
    const r = estadoFormacao(curso, baseExpirada, { hoje, refrescamentos: [refConcluido] });
    expect(r).toMatchObject({ estado: 'valido', origem: 'refrescamento' });
    expect(r.refrescamento.id).toBe('m2');
    const r2 = estadoFormacao(curso, baseExpirada, { hoje, refrescamentos: [{ ...refConcluido, estado: 'ativo', created_date: '2026-09-20' }] });
    expect(r2).toMatchObject({ estado: 'em_curso', origem: 'refrescamento' });
    const m = matrizFormacao({ users: [user], cursos: [curso, refr], matriculas: [baseExpirada, refConcluido], hoje });
    expect(m.porCurso.map(p => p.curso.id)).toEqual(['c1']);
    expect(m.linhas[0].celulas).toHaveLength(1);
    expect(m.linhas[0].celulas[0]).toMatchObject({ estado: 'valido', origem: 'refrescamento' });
  });

  it('sem matrícula nem externa: em falta quando obrigatório, senão não inscrito', () => {
    expect(estadoFormacao(curso, null, { obrigatorio: true, hoje }).estado).toBe('em_falta');
    expect(estadoFormacao(curso, null, { obrigatorio: false, hoje }).estado).toBe('nao_inscrito');
  });
});
