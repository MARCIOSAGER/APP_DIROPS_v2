import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders, mockUser } from '@/test/testUtils';

const db = vi.hoisted(() => {
  const cursos = [
    { id: 'c1', titulo: 'Curso Publicado', categoria: 'Safety', nivel: 'iniciante', carga_horaria: 2, publicado: true, ordem: 1, certificado_config: null },
    { id: 'c2', titulo: 'Curso Rascunho', categoria: 'Operações', publicado: false, ordem: 2 },
  ];
  const modulos = [{ id: 'm1', curso_id: 'c1', titulo: 'Módulo Um', ordem: 1 }];
  const aulas = [{ id: 'a1', modulo_id: 'm1', curso_id: 'c1', titulo: 'Aula Um', tipo: 'texto', conteudo_texto: '<p>x</p>', ordem: 1, duracao_min: 30 }];
  const matriculas = [{ id: 'mat1', curso_id: 'c1', aluno_email: 'aluno@sga.co.ao', aluno_nome: 'Aluno Teste', estado: 'concluido', progresso_pct: 100, concluido_em: '2026-09-29T10:00:00Z', created_date: '2026-09-20T10:00:00Z' }];
  const externas = [{ id: 'x1', aluno_email: 'aluno@sga.co.ao', aluno_nome: 'Aluno Teste', titulo: 'Mercadorias Perigosas (IATA)', entidade: 'IATA', tipo: 'externa', curso_id: null, data_realizacao: '2026-05-10', valido_ate: '2028-05-10', resultado: 'aprovado' }];
  return { cursos, modulos, aulas, matriculas, progresso: [{ id: 'p1', matricula_id: 'mat1', aula_id: 'a1', concluida_em: '2026-09-25T10:00:00Z', segundos: 900 }], certificados: [], assinantes: [{ id: 's1', nome: 'Director', cargo: 'Dir. Operações', curso_id: null, ordem: 1, ativo: true }], externas };
});

vi.mock('@/entities/Curso', () => ({
  Curso: {
    list: vi.fn(async () => db.cursos), filter: vi.fn(async () => db.cursos.filter(c => c.publicado)),
    get: vi.fn(async (id) => db.cursos.find(c => c.id === id)),
    update: vi.fn(async (id, ch) => { const c = db.cursos.find(x => x.id === id); Object.assign(c, ch); return c; }),
    create: vi.fn(async (row) => { const c = { id: 'c3', ...row }; db.cursos.push(c); return c; }),
  },
}));
vi.mock('@/entities/Modulo', () => ({ Modulo: { list: vi.fn(async () => db.modulos), filter: vi.fn(async (f) => db.modulos.filter(m => m.curso_id === f.curso_id)), update: vi.fn(), create: vi.fn(), delete: vi.fn() } }));
vi.mock('@/entities/Aula', () => ({ Aula: { list: vi.fn(async () => db.aulas), filter: vi.fn(async () => db.aulas), update: vi.fn(), create: vi.fn(), delete: vi.fn() } }));
vi.mock('@/entities/Matricula', () => ({
  Matricula: {
    list: vi.fn(async () => db.matriculas), filter: vi.fn(async (f) => db.matriculas.filter(m => (!f?.curso_id || m.curso_id === f.curso_id) && (!f?.aluno_email || m.aluno_email === f.aluno_email))),
    update: vi.fn(async (id, ch) => ({ id, ...ch })), bulkCreate: vi.fn(async (rows) => rows), delete: vi.fn(),
  },
}));
vi.mock('@/entities/ProgressoAula', () => ({ ProgressoAula: { filter: vi.fn(async () => db.progresso) } }));
vi.mock('@/entities/Certificado', () => ({
  Certificado: {
    list: vi.fn(async () => db.certificados), filter: vi.fn(async () => db.certificados),
    create: vi.fn(async (row) => { const c = { id: 'cert1', numero: 'DO-2026/0001', codigo: '7F3A2C', token: 'abc', ...row }; db.certificados.push(c); return c; }),
    update: vi.fn(),
  },
}));
vi.mock('@/entities/CertificadoAssinante', () => ({ CertificadoAssinante: { list: vi.fn(async () => db.assinantes), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock('@/entities/Quiz', () => ({ Quiz: { filter: vi.fn(async () => []), list: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock('@/entities/Pergunta', () => ({ Pergunta: { filter: vi.fn(async () => []), list: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), delete: vi.fn(), bulkCreate: vi.fn() } }));
vi.mock('@/entities/QuizItem', () => ({ QuizItem: { filter: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), delete: vi.fn(), bulkCreate: vi.fn() } }));
vi.mock('@/entities/Tentativa', () => ({ Tentativa: { list: vi.fn(async () => []), filter: vi.fn(async () => [{ id: 't1', quiz_id: 'q1', matricula_id: 'mat1', numero: 1, estado: 'submetida', nota: 85, aprovado: true, correcao_pendente: false, iniciada_em: '2026-09-28T10:00:00Z', submetida_em: '2026-09-28T10:20:00Z', tempo_gasto_s: 1200, ciclo: 1 }]) } }));
vi.mock('@/entities/FormacaoExterna', () => ({ FormacaoExterna: { filter: vi.fn(async () => db.externas), create: vi.fn(async (row) => { const x = { id: 'x2', ...row }; db.externas.push(x); return x; }), update: vi.fn() } }));
vi.mock('@/entities/NotificacaoFormacao', () => ({ NotificacaoFormacao: { filter: vi.fn(async () => [{ id: 'n1', tipo: 'inscricao', destinatario: 'aluno@sga.co.ao', curso_id: 'c1', entregue: true, enviada_em: '2026-09-20T10:00:00Z', detalhe: {} }]), create: vi.fn(async (row) => ({ id: 'n2', ...row })) } }));
vi.mock('@/entities/LicencaConducao', () => ({ LicencaConducao: { filter: vi.fn(async (f) => (f.aluno_email ? [{ id: 'l1', numero_licenca: '0001/26', aeroporto: 'FNLU', data_treinamento: '2026-09-29', data_validade: '2027-09-29', resultado: 'Aprovado', status: 'Ativa', certificado_id: 'cert1' }] : [])) } }));
vi.mock('@/entities/SessaoFormacao', () => ({ SessaoFormacao: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/entities/SessaoInscricao', () => ({ SessaoInscricao: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/entities/AulaComentario', () => ({ AulaComentario: { filter: vi.fn(async () => []), create: vi.fn(async (r) => ({ id: 'c1', ...r })), update: vi.fn(async () => ({})) } }));
vi.mock('@/entities/PontosFormacao', () => ({ PontosFormacao: { filter: vi.fn(async () => [{ id: 'p1', pontos: 10, tipo: 'aula', descricao: 'Aula concluída' }]) } }));
vi.mock('@/entities/AlunoDistintivo', () => ({ AlunoDistintivo: { filter: vi.fn(async () => []) } }));
vi.mock('@/entities/Distintivo', () => ({ Distintivo: { list: vi.fn(async () => [{ codigo: 'primeiro_passo', nome: 'Primeiro passo', descricao: 'x', icone: 'footprints', pontos: 5, ordem: 1 }]) } }));
vi.mock('@/entities/CursoVersao', () => ({ CursoVersao: { filter: vi.fn(async () => []) } }));
vi.mock('@/entities/ScormEstado', () => ({ ScormEstado: { filter: vi.fn(async () => []) } }));
vi.mock('@/entities/AulaAtividade', () => ({ AulaAtividade: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/functions/sendEmailDirect', () => ({ sendEmailDirect: vi.fn(async () => ({ ok: true })) }));
vi.mock('@/entities/Trilha', () => ({ Trilha: { filter: vi.fn(async () => []), list: vi.fn(async () => []), create: vi.fn(), update: vi.fn() } }));
vi.mock('@/entities/TrilhaCurso', () => ({ TrilhaCurso: { filter: vi.fn(async () => []), list: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock('@/entities/RelatorioDestinatario', () => ({ RelatorioDestinatario: { filter: vi.fn(async () => []), list: vi.fn(async () => []) } }));
vi.mock('@/entities/RegraPermissao', () => ({ RegraPermissao: { list: vi.fn(async () => [{ perfil: 'operacoes', label: 'Operações' }]) } }));
vi.mock('@/entities/User', () => ({ User: { update: vi.fn(async (id, ch) => ({ id, ...ch })), filter: vi.fn(async (f) => {
  const todos = [{ id: 'u1', email: 'outro@sga.co.ao', full_name: 'Outro Utilizador', status: 'ativo', perfis: ['operacoes', 'formando'] }, { id: 'u2', email: 'aluno@sga.co.ao', full_name: 'Aluno Teste', status: 'ativo', perfis: ['safety', 'formando'], aeroportos_acesso: ['FNLU'] }];
  return f?.email ? todos.filter(u => u.email === f.email) : todos;
}) } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn(async () => ({ data: { base_url: 'https://dirops.example' } })) } } }));
vi.mock('@/api/integrations', () => ({ UploadFile: vi.fn(async () => ({ file_url: '/storage/x.png' })) }));

const { default: GestaoFormacao } = await import('@/pages/GestaoFormacao');
const { Certificado } = await import('@/entities/Certificado');
const { Curso } = await import('@/entities/Curso');
const { Matricula } = await import('@/entities/Matricula');
const { NotificacaoFormacao } = await import('@/entities/NotificacaoFormacao');
const { sendEmailDirect } = await import('@/functions/sendEmailDirect');

function renderPage(url = '/GestaoFormacao') {
  return renderWithProviders(<MemoryRouter initialEntries={[url]}><GestaoFormacao /></MemoryRouter>);
}

describe('Gestão de Formação', () => {
  beforeEach(() => { db.certificados.length = 0; vi.clearAllMocks(); });

  it('Visão geral (separador inicial) mostra conformidade, vencimentos e pendências por curso', async () => {
    db.cursos[0].obrigatorio_todos = true;
    try {
      renderPage();
      expect(await screen.findByText('Conformidade por perfil')).toBeInTheDocument();
      // 2 colaboradores activos: aluno@ concluiu (válido), outro@ em falta → 50% de conformidade
      expect((await screen.findAllByText('50%')).length).toBeGreaterThan(0);
      expect(screen.getByText('0 – 30 dias')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Inscrever$/ })).toBeInTheDocument();
    } finally { db.cursos[0].obrigatorio_todos = false; }
  });

  it('lista cursos (publicados e rascunhos) com estatísticas e abre o editor', async () => {
    renderPage('/GestaoFormacao?tab=cursos');
    expect(await screen.findByRole('heading', { name: /Gestão de Formação/i })).toBeInTheDocument();
    expect(await screen.findByText('Curso Publicado')).toBeInTheDocument();
    expect(screen.getByText('Curso Rascunho')).toBeInTheDocument();
    expect(await screen.findByText(/1 mód\. · 1 aulas/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Conteúdo/i })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Curso Publicado' })).toBeInTheDocument();
    expect(await screen.findByText('Módulo Um')).toBeInTheDocument();
    expect(screen.getByText('Aula Um')).toBeInTheDocument();
  });

  it('separador Alunos mostra a matrícula concluída e emite o certificado', async () => {
    renderPage('/GestaoFormacao?curso=c1&ctab=alunos');
    expect(await screen.findByText('Aluno Teste')).toBeInTheDocument();
    const emitir = await screen.findByRole('button', { name: /Emitir/i });
    fireEvent.click(emitir);
    await waitFor(() => expect(Certificado.create).toHaveBeenCalledTimes(1));
    const payload = Certificado.create.mock.calls[0][0];
    expect(payload).toMatchObject({ matricula_id: 'mat1', curso_id: 'c1', aluno_nome: 'Aluno Teste', curso_titulo: 'Curso Publicado', carga_horaria: 2 });
    expect(payload.plano_aula).toEqual([{ tema: 'Módulo Um', horas: 0.5 }]);
    expect(payload.assinantes).toEqual([{ nome: 'Director', cargo: 'Dir. Operações', assinatura_url: null }]);
  });

  it('separador Certificado renderiza o editor de layout e guarda a configuração', async () => {
    renderPage('/GestaoFormacao?curso=c1&ctab=certificado');
    expect(await screen.findByText('Layout e textos da frente')).toBeInTheDocument();
    expect(await screen.findByText(/No certificado \(máx\. 4\): Director/)).toBeInTheDocument();
    // Há dois "Nome do aluno": o elemento arrastável (aria-label) e o selector do painel.
    const nome = screen.getAllByRole('button', { name: 'Nome do aluno' }).find(el => el.getAttribute('aria-label') === 'Nome do aluno');
    fireEvent.keyDown(nome, { key: 'ArrowDown' });

    // Caixa de texto livre: criar, escrever (com placeholder) e ver no canvas
    fireEvent.click(screen.getByRole('button', { name: /Adicionar caixa de texto/i }));
    const caixaTexto = await screen.findByLabelText(/Texto da caixa/i);
    fireEvent.change(caixaTexto, { target: { value: 'Formando: {nome}' } });
    expect(await screen.findByText('Formando: Maria João Silva')).toBeInTheDocument();

    const guardar = screen.getAllByRole('button', { name: /^Guardar$/ })[0];
    expect(guardar).not.toBeDisabled();
    fireEvent.click(guardar);
    await waitFor(() => expect(Curso.update).toHaveBeenCalledWith('c1', expect.objectContaining({
      certificado_config: expect.objectContaining({
        layout: { frente: { nome: { x: 50, y: 48.5 }, extras: [expect.objectContaining({ texto: 'Formando: {nome}', x: 50, y: 30 })] } },
      }),
    })));
  });

  it('separador Alunos lista os colaboradores com pendências e abre a ficha com cursos, aulas, avaliações, externas e licenças', async () => {
    renderPage('/GestaoFormacao?tab=alunos');
    expect(await screen.findByText('Outro Utilizador')).toBeInTheDocument();
    // "Curso Publicado" não é obrigatório → sem pendências; o botão de inscrever em falta fica desactivado
    expect(screen.getByRole('button', { name: /Inscrever em falta/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Abrir ficha de Aluno Teste/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Aluno Teste' })).toBeInTheDocument();
    expect(screen.getByText('aluno@sga.co.ao')).toBeInTheDocument();
    expect(await screen.findByText('Curso Publicado')).toBeInTheDocument();
    expect(screen.getByTitle('Concluído (sem validade definida)')).toBeInTheDocument();
    // detalhe das aulas com tempo registado
    fireEvent.click(screen.getByRole('button', { name: /Ver aulas/i }));
    expect(await screen.findByText('Aula Um')).toBeInTheDocument();
    // tempo registado aparece no total do curso e na linha da aula
    expect(screen.getAllByText(/15 min/).length).toBeGreaterThanOrEqual(2);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Avaliações/i }));
    expect(await screen.findByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Aprovado')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Formação externa/i }));
    expect(await screen.findByText('Mercadorias Perigosas (IATA)')).toBeInTheDocument();
    expect(screen.getByText('0001/26')).toBeInTheDocument();
    expect(screen.getByText('Curso da Universidade')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Histórico/i }));
    expect(await screen.findByText(/Inscrição · Curso Publicado/)).toBeInTheDocument();
  });

  it('ficha: regista formação externa ligada a um curso', async () => {
    renderPage('/GestaoFormacao?aluno=aluno%40sga.co.ao');
    expect(await screen.findByRole('heading', { level: 1, name: 'Aluno Teste' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Formação externa/i })[0]);
    fireEvent.change(await screen.findByLabelText(/Título/), { target: { value: 'Condução Airside (ANAC)' } });
    fireEvent.change(screen.getByLabelText(/Data de realização/), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: /^Registar$/ }));
    const { FormacaoExterna } = await import('@/entities/FormacaoExterna');
    await waitFor(() => expect(FormacaoExterna.create).toHaveBeenCalledTimes(1));
    expect(FormacaoExterna.create.mock.calls[0][0]).toMatchObject({ aluno_email: 'aluno@sga.co.ao', titulo: 'Condução Airside (ANAC)', data_realizacao: '2026-08-01', resultado: 'aprovado', created_by: mockUser.email });
  });

  it('separador Alunos do curso: lembrete manual envia email individual e regista a notificação', async () => {
    db.matriculas.push({ id: 'mat2', curso_id: 'c1', aluno_email: 'outro@sga.co.ao', aluno_nome: 'Outro Utilizador', estado: 'ativo', progresso_pct: 40, created_date: '2026-09-22T10:00:00Z' });
    try {
      renderPage('/GestaoFormacao?curso=c1&ctab=alunos');
      expect(await screen.findByText('Outro Utilizador')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Lembrar \(1\)$/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Lembrete$/ }));
      expect(await screen.findByRole('heading', { name: 'Enviar lembrete' })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Mensagem adicional/), { target: { value: 'Conclua até dia 15.' } });
      fireEvent.click(screen.getByRole('button', { name: /^Enviar$/ }));
      await waitFor(() => expect(sendEmailDirect).toHaveBeenCalledTimes(1));
      const mail = sendEmailDirect.mock.calls[0][0];
      expect(mail.to).toBe('outro@sga.co.ao');
      expect(mail.subject).toMatch(/Lembrete — Curso Publicado/);
      expect(mail.html).toContain('40% feito');
      expect(mail.html).toContain('Conclua até dia 15.');
      await waitFor(() => expect(NotificacaoFormacao.create).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'lembrete_manual', destinatario: 'outro@sga.co.ao', matricula_id: 'mat2', entregue: true })));
    } finally { db.matriculas.pop(); }
  });

  it('matriz: inscreve em massa os obrigatórios em falta', async () => {
    db.cursos[0].obrigatorio_todos = true;
    try {
      renderPage('/GestaoFormacao?tab=matriz');
      const btn = await screen.findByRole('button', { name: /Inscrever em falta \(1\)/ });
      fireEvent.click(btn);
      expect(await screen.findByRole('heading', { name: /Inscrever formação obrigatória em falta/ })).toBeInTheDocument();
      expect(screen.getByLabelText('Outro Utilizador — Curso Publicado')).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: /^Inscrever \(1\)$/ }));
      await waitFor(() => expect(Matricula.bulkCreate).toHaveBeenCalledTimes(1));
      expect(Matricula.bulkCreate.mock.calls[0][0]).toEqual([expect.objectContaining({ curso_id: 'c1', aluno_email: 'outro@sga.co.ao', origem: 'obrigatorio', estado: 'ativo' })]);
    } finally { db.cursos[0].obrigatorio_todos = false; }
  });

  it('separador Instrutores (admin): lista habilitados e dá o perfil a um utilizador', async () => {
    renderPage('/GestaoFormacao?tab=instrutores');
    expect(await screen.findByText(/Ainda não há instrutores/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar instrutor/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Tornar Outro Utilizador instrutor/i }));
    const { User } = await import('@/entities/User');
    await waitFor(() => expect(User.update).toHaveBeenCalledWith('u1', { perfis: ['operacoes', 'formando', 'instrutor'] }));
  });

  it('novo curso abre o formulário e cria com os dados', async () => {
    renderPage('/GestaoFormacao?tab=cursos');
    fireEvent.click(await screen.findByRole('button', { name: /Novo curso/i }));
    const titulo = await screen.findByLabelText(/Título/);
    fireEvent.change(titulo, { target: { value: 'Curso Novo' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar curso/i }));
    await waitFor(() => expect(Curso.create).toHaveBeenCalledTimes(1));
    expect(Curso.create.mock.calls[0][0]).toMatchObject({ titulo: 'Curso Novo', publicado: false, created_by: mockUser.email });
  });
});
