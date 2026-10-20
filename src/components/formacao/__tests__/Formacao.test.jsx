import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders, mockUser } from '@/test/testUtils';

// ── Dados em memória (hoisted: os factories do vi.mock correm antes dos imports) ──
const db = vi.hoisted(() => {
  const curso = { id: 'c1', titulo: 'Curso Teste SGSO', descricao: 'Descrição do curso', categoria: 'Safety', nivel: 'iniciante', carga_horaria: 2, publicado: true, ordem: 1 };
  const modulos = [{ id: 'm1', curso_id: 'c1', titulo: 'Módulo Um', ordem: 1 }];
  const aulas = [
    { id: 'a1', modulo_id: 'm1', curso_id: 'c1', titulo: 'Aula Um', tipo: 'texto', conteudo_texto: '<h2>Olá</h2><p>Texto da aula.</p>', ordem: 1, duracao_min: 5 },
    { id: 'a2', modulo_id: 'm1', curso_id: 'c1', titulo: 'Aula Dois', tipo: 'link', conteudo_url: 'https://example.com/recurso', ordem: 2, duracao_min: 10 },
  ];
  return { curso, modulos, aulas, matriculas: [], progresso: [] };
});

vi.mock('@/entities/Curso', () => ({
  Curso: { filter: vi.fn(async () => [db.curso]), list: vi.fn(async () => [db.curso]), get: vi.fn(async () => db.curso) },
}));
vi.mock('@/entities/Modulo', () => ({ Modulo: { filter: vi.fn(async () => db.modulos), list: vi.fn(async () => db.modulos) } }));
vi.mock('@/entities/Aula', () => ({ Aula: { filter: vi.fn(async () => db.aulas), list: vi.fn(async () => db.aulas) } }));
vi.mock('@/entities/Matricula', () => ({
  Matricula: {
    filter: vi.fn(async () => [...db.matriculas]),
    create: vi.fn(async (row) => { const m = { id: 'mat1', created_date: new Date().toISOString(), updated_date: new Date().toISOString(), ...row }; db.matriculas.push(m); return m; }),
    update: vi.fn(async (id, changes) => { const m = db.matriculas.find(x => x.id === id); Object.assign(m, changes, { updated_date: new Date().toISOString() }); return m; }),
  },
}));
vi.mock('@/entities/SessaoFormacao', () => ({ SessaoFormacao: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/entities/SessaoInscricao', () => ({ SessaoInscricao: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/entities/AulaComentario', () => ({ AulaComentario: { filter: vi.fn(async () => []), create: vi.fn(async (r) => ({ id: 'c1', ...r })), update: vi.fn(async () => ({})) } }));
vi.mock('@/entities/PontosFormacao', () => ({ PontosFormacao: { filter: vi.fn(async () => [{ id: 'p1', pontos: 10, tipo: 'aula', descricao: 'Aula concluída' }]) } }));
vi.mock('@/entities/AlunoDistintivo', () => ({ AlunoDistintivo: { filter: vi.fn(async () => []) } }));
vi.mock('@/entities/Distintivo', () => ({ Distintivo: { list: vi.fn(async () => [{ codigo: 'primeiro_passo', nome: 'Primeiro passo', descricao: 'x', icone: 'footprints', pontos: 5, ordem: 1 }]) } }));
vi.mock('@/entities/CursoVersao', () => ({ CursoVersao: { filter: vi.fn(async () => []) } }));
vi.mock('@/entities/ScormEstado', () => ({ ScormEstado: { filter: vi.fn(async () => []) } }));
vi.mock('@/entities/AulaAtividade', () => ({ AulaAtividade: { filter: vi.fn(async () => [{ id: 'at1', matricula_id: 'mat1', aula_id: 'a1', posicao_s: 42, tempo_s: 300 }]) } }));
vi.mock('@/entities/ProgressoAula', () => ({
  ProgressoAula: {
    filter: vi.fn(async () => [...db.progresso]),
    create: vi.fn(async (row) => { const p = { id: 'p' + (db.progresso.length + 1), ...row }; db.progresso.push(p); return p; }),
    delete: vi.fn(async (id) => { const i = db.progresso.findIndex(p => p.id === id); if (i >= 0) db.progresso.splice(i, 1); }),
  },
}));
vi.mock('@/entities/Certificado', () => ({ Certificado: { filter: vi.fn(async () => []) } }));
vi.mock('@/entities/Quiz', () => ({ Quiz: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/entities/Trilha', () => ({ Trilha: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/entities/TrilhaCurso', () => ({ TrilhaCurso: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn(async () => ({ data: { base_url: 'https://dirops.example' } })) } } }));

const { default: Formacao } = await import('@/pages/Formacao');
const { Matricula } = await import('@/entities/Matricula');
const { ProgressoAula } = await import('@/entities/ProgressoAula');

function renderPage(url = '/Formacao') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[url]}>
      <Formacao />
    </MemoryRouter>,
  );
}

describe('Universidade Corporativa — área do aluno', () => {
  beforeEach(() => {
    db.matriculas.length = 0;
    db.progresso.length = 0;
    vi.clearAllMocks();
  });

  it('mostra o catálogo com o curso publicado e permite inscrever-se', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Universidade Corporativa/i })).toBeInTheDocument();
    expect(await screen.findByText('Curso Teste SGSO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inscrever-se' }));
    await waitFor(() => expect(Matricula.create).toHaveBeenCalledTimes(1));
    expect(Matricula.create.mock.calls[0][0]).toMatchObject({ curso_id: 'c1', aluno_email: mockUser.email, estado: 'ativo' });

    // Abre a página do curso depois da inscrição
    expect(await screen.findByText('Conteúdo do curso')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Começar o curso/i })).toBeInTheDocument();
  });

  it('abre o leitor, conclui a aula e avança para a próxima', async () => {
    db.matriculas.push({ id: 'mat1', curso_id: 'c1', aluno_email: mockUser.email, estado: 'ativo', progresso_pct: 0, created_date: '2026-09-29T10:00:00Z', updated_date: '2026-09-29T10:00:00Z' });
    renderPage('/Formacao?curso=c1&aula=a1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Aula Um' })).toBeInTheDocument();
    expect(screen.getByText('Texto da aula.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Concluir e avançar/i }));
    await waitFor(() => expect(ProgressoAula.create).toHaveBeenCalledTimes(1));
    expect(ProgressoAula.create.mock.calls[0][0]).toMatchObject({ matricula_id: 'mat1', aula_id: 'a1' });
    await waitFor(() => expect(Matricula.update).toHaveBeenCalledWith('mat1', expect.objectContaining({ progresso_pct: 50, estado: 'ativo' })));

    // Avançou para a aula 2 (ligação externa)
    expect(await screen.findByRole('heading', { level: 1, name: 'Aula Dois' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir ligação/i })).toHaveAttribute('href', 'https://example.com/recurso');

    // Índice lateral marca a aula 1 como concluída
    const nav = screen.getByRole('navigation', { name: /Aulas do curso/i });
    expect(within(nav).getByLabelText('Concluída')).toBeInTheDocument();
  });

  it('conclui o curso na última aula e mostra o banner de conclusão', async () => {
    db.matriculas.push({ id: 'mat1', curso_id: 'c1', aluno_email: mockUser.email, estado: 'ativo', progresso_pct: 50, created_date: '2026-09-29T10:00:00Z', updated_date: '2026-09-29T10:00:00Z' });
    db.progresso.push({ id: 'p1', matricula_id: 'mat1', aula_id: 'a1' });
    renderPage('/Formacao?curso=c1&aula=a2');

    expect(await screen.findByRole('heading', { level: 1, name: 'Aula Dois' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Concluir aula/i }));
    await waitFor(() => expect(Matricula.update).toHaveBeenCalledWith('mat1', expect.objectContaining({ progresso_pct: 100, estado: 'concluido' })));
    expect(await screen.findByText(/Curso concluído/i)).toBeInTheDocument();
  });

  it('separador Os meus cursos mostra estado vazio quando não há matrículas', async () => {
    renderPage('/Formacao?tab=meus');
    expect(await screen.findByText(/Ainda não está inscrito em nenhum curso/i)).toBeInTheDocument();
  });
});
