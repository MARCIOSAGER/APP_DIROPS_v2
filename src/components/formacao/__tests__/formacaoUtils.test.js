import { describe, it, expect } from 'vitest';
import { podeEditarCurso, nomeResponsavel } from '@/components/formacao/formacaoUtils';

const curso = { id: 'c1', titulo: 'GRF', instrutor_email: 'Ana@sga.co.ao', instrutor_nome: 'Ana', created_by: 'criador@sga.co.ao', instrutores: ['co@sga.co.ao'] };

describe('podeEditarCurso — espelho da política SQL (migração 106)', () => {
  it('admin edita tudo', () => {
    expect(podeEditarCurso({ email: 'x@sga.co.ao', role: 'admin', perfis: [] }, curso)).toBe(true);
    expect(podeEditarCurso({ email: 'x@sga.co.ao', perfis: ['administrador'] }, curso)).toBe(true);
  });
  it('instrutor responsável, co-instrutor e criador editam; outros não', () => {
    expect(podeEditarCurso({ email: 'ana@sga.co.ao', perfis: ['instrutor'] }, curso)).toBe(true);
    expect(podeEditarCurso({ email: 'CO@sga.co.ao', perfis: ['instrutor'] }, curso)).toBe(true);
    expect(podeEditarCurso({ email: 'criador@sga.co.ao', perfis: ['instrutor'] }, curso)).toBe(true);
    expect(podeEditarCurso({ email: 'outro@sga.co.ao', perfis: ['instrutor'] }, curso)).toBe(false);
    expect(podeEditarCurso(null, curso)).toBe(false);
    expect(podeEditarCurso({ email: 'ana@sga.co.ao', perfis: ['instrutor'] }, { id: 'c2' })).toBe(false);
  });
  it('nomeResponsavel prefere o nome, depois email, depois criador', () => {
    expect(nomeResponsavel(curso)).toBe('Ana');
    expect(nomeResponsavel({ instrutor_email: 'a@b' })).toBe('a@b');
    expect(nomeResponsavel({})).toBe('administração');
  });
});
