import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/testUtils';

const api = vi.hoisted(() => ({
  estado: vi.fn(),
  iniciar: vi.fn(),
  guardar: vi.fn(async () => ({ ok: true })),
  submeter: vi.fn(),
}));
vi.mock('@/lib/quizApi', () => ({ quizApi: api }));

const { default: QuizPlayer } = await import('@/components/formacao/quiz/QuizPlayer');

const QUIZ = { id: 'q1', titulo: 'Prova — Condução no Lado Ar', descricao: 'Sem consulta.', nota_minima: 70, tentativas_max: 2, tempo_limite_min: 40, modo_sem_consulta: false, rever_apos: true, gera_certificado: true, requer_aulas_concluidas: true, n_perguntas: 3, ativo: true };
const PERGUNTAS = [
  { id: 'p1', tipo: 'escolha_unica', enunciado: 'Velocidade máxima nas plataformas?', pontos: 1, opcoes: [{ id: 'a', texto: '40 km/h' }, { id: 'b', texto: '25 km/h' }] },
  { id: 'p2', tipo: 'lacuna', enunciado: 'Sigla do código de condição da pista: ____', pontos: 1, opcoes: [] },
  { id: 'p3', tipo: 'correspondencia', enunciado: 'Ligue a letra à pronúncia.', pontos: 2, esquerda: [{ id: '1', texto: 'A' }, { id: '2', texto: 'B' }], direita: [{ id: '2', texto: 'BRAVO' }, { id: '1', texto: 'ALFA' }] },
];
const matricula = { id: 'mat1', curso_id: 'c1', estado: 'ativo' };

describe('QuizPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.estado.mockResolvedValue({ quiz: QUIZ, tentativas: [], tentativa_em_curso: null, tentativas_restantes: 2, pode_iniciar: true, motivo: null, aprovado: false, melhor_nota: null, aulas_concluidas: true });
    api.iniciar.mockResolvedValue({ tentativa_id: 't1', numero: 1, prazo: new Date(Date.now() + 40 * 60 * 1000).toISOString(), perguntas: PERGUNTAS, respostas: {}, retomada: false, tempo_limite_min: 40, modo_sem_consulta: false });
    api.submeter.mockResolvedValue({
      nota: 75, pontos: 3, pontos_max: 4, aprovado: true, estado: 'submetida', fora_de_tempo: false, nota_minima: 70, feedback: 'Parabéns!', tentativas_restantes: 1, certificado_numero: 'DO-2026/0007',
      revisao: [
        { pergunta_id: 'p1', tipo: 'escolha_unica', resposta: 'b', respondida: true, correta: true, parcial: false, pontos_obtidos: 1, pontos_max: 1, gabarito: 'b', explicacao: 'Norma de circulação.' },
        { pergunta_id: 'p2', tipo: 'lacuna', resposta: 'RCR', respondida: true, correta: false, parcial: false, pontos_obtidos: 0, pontos_max: 1, gabarito: ['RWYCC'] },
        { pergunta_id: 'p3', tipo: 'correspondencia', resposta: { 1: '1', 2: '2' }, respondida: true, correta: true, parcial: false, pontos_obtidos: 2, pontos_max: 2, gabarito: { 1: '1', 2: '2' } },
      ],
    });
  });

  it('mostra as regras, inicia, responde aos três tipos, submete e mostra o resultado com certificado', async () => {
    renderWithProviders(<QuizPlayer quizId="q1" matricula={matricula} onVoltarCurso={() => {}} onVerCertificados={() => {}} />);
    expect(await screen.findByRole('heading', { name: /Prova — Condução no Lado Ar/ })).toBeInTheDocument();
    expect(screen.getByText(/Nota mínima 70%/)).toBeInTheDocument();
    expect(screen.getByText(/2 de 2 tentativas/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Iniciar avaliação/i }));
    await waitFor(() => expect(api.iniciar).toHaveBeenCalledWith('q1'));
    expect(await screen.findByText('Velocidade máxima nas plataformas?')).toBeInTheDocument();
    expect(screen.getByText(/Pergunta 1 de 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('25 km/h'));
    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    fireEvent.change(await screen.findByLabelText('Resposta'), { target: { value: 'RCR' } });
    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    expect(await screen.findByText('Ligue a letra à pronúncia.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Submeter avaliação/i }));
    expect(await screen.findByText(/1 pergunta sem resposta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Submeter$/ }));
    await waitFor(() => expect(api.submeter).toHaveBeenCalledTimes(1));
    expect(api.submeter.mock.calls[0][1]).toEqual({ p1: 'b', p2: 'RCR' });

    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
    expect(screen.getByText('DO-2026/0007')).toBeInTheDocument();
    expect(screen.getByText('Parabéns!')).toBeInTheDocument();
    // revisão: a lacuna errada mostra a resposta correcta e a explicação da 1.ª aparece
    expect(screen.getByText('RWYCC')).toBeInTheDocument();
    expect(screen.getByText('Norma de circulação.')).toBeInTheDocument();
  });

  it('retoma uma tentativa em curso e bloqueia o início quando há motivo', async () => {
    api.estado.mockResolvedValueOnce({ quiz: QUIZ, tentativas: [], tentativa_em_curso: { id: 't9', numero: 1, prazo: new Date(Date.now() + 600000).toISOString(), perguntas: PERGUNTAS, respostas: { p1: 'a' } }, tentativas_restantes: 1, pode_iniciar: true, motivo: null, aprovado: false, melhor_nota: null, aulas_concluidas: true });
    const { unmount } = renderWithProviders(<QuizPlayer quizId="q1" matricula={matricula} onVoltarCurso={() => {}} />);
    expect(await screen.findByText('Velocidade máxima nas plataformas?')).toBeInTheDocument();
    expect(screen.getByLabelText('40 km/h')).toBeChecked();
    expect(api.iniciar).not.toHaveBeenCalled();
    unmount();

    api.estado.mockResolvedValueOnce({ quiz: QUIZ, tentativas: [{ id: 'a', numero: 1, estado: 'submetida', nota: 40, aprovado: false, submetida_em: '2026-09-29T10:00:00Z' }, { id: 'b', numero: 2, estado: 'submetida', nota: 55, aprovado: false, submetida_em: '2026-09-29T11:00:00Z' }], tentativa_em_curso: null, tentativas_restantes: 0, pode_iniciar: false, motivo: 'Não tem mais tentativas disponíveis.', aprovado: false, melhor_nota: 55, aulas_concluidas: true });
    renderWithProviders(<QuizPlayer quizId="q1" matricula={matricula} onVoltarCurso={() => {}} />);
    expect(await screen.findByText('Não tem mais tentativas disponíveis.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nova tentativa/i })).toBeDisabled();
    expect(screen.getAllByText('Reprovado').length).toBe(2);
  });

  it('responde a ponto na imagem, rótulos e resposta aberta; resultado fica a aguardar correcção', async () => {
    const PERG5 = [
      { id: 'h1', tipo: 'hotspot', enunciado: 'Clique na placa de estacionamento.', pontos: 1, imagem_url: '/img/placa.png', opcoes: [] },
      { id: 'r1', tipo: 'rotulos', enunciado: 'Identifique as áreas.', pontos: 2, imagem_url: '/img/aero.png', zonas: [{ id: 'zA', x: 0, y: 0, w: 20, h: 20 }, { id: 'zB', x: 50, y: 50, w: 20, h: 20 }], rotulos: [{ id: 'l1', texto: 'Placa' }, { id: 'l2', texto: 'Pista' }] },
      { id: 'a1', tipo: 'aberta', enunciado: 'Explique os 4 pilares do SGSO.', pontos: 4, max_chars: 300 },
    ];
    api.iniciar.mockResolvedValueOnce({ tentativa_id: 't5', numero: 1, prazo: null, perguntas: PERG5, respostas: {}, retomada: false, tempo_limite_min: null, modo_sem_consulta: false });
    api.submeter.mockResolvedValueOnce({
      nota: 42.9, pontos: 3, pontos_max: 7, aprovado: null, estado: 'submetida', fora_de_tempo: false, pendente: true, pendentes: 1, nota_max_possivel: 100, nota_minima: 70, feedback: null, tentativas_restantes: 1, certificado_numero: null,
      revisao: [
        { pergunta_id: 'h1', tipo: 'hotspot', resposta: { x: 30, y: 40 }, respondida: true, correta: true, parcial: false, pontos_obtidos: 1, pontos_max: 1, gabarito: [{ x: 20, y: 30, w: 20, h: 20 }] },
        { pergunta_id: 'r1', tipo: 'rotulos', resposta: { zA: 'l1', zB: 'l2' }, respondida: true, correta: true, parcial: false, pontos_obtidos: 2, pontos_max: 2, gabarito: { zA: 'Placa', zB: 'Pista' } },
        { pergunta_id: 'a1', tipo: 'aberta', resposta: 'Política, risco, garantia e promoção.', respondida: true, correta: false, parcial: false, pontos_obtidos: 0, pontos_max: 4, pendente: true, gabarito: null },
      ],
    });
    renderWithProviders(<QuizPlayer quizId="q1" matricula={matricula} onVoltarCurso={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Iniciar avaliação/i }));
    expect(await screen.findByText('Clique na placa de estacionamento.')).toBeInTheDocument();
    const img = screen.getByRole('button', { name: /Imagem: clique no ponto certo/i });
    img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    fireEvent.click(img, { clientX: 60, clientY: 40 });
    expect(await screen.findByText('Ponto marcado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    expect(await screen.findByText('Identifique as áreas.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    const ta = await screen.findByLabelText('Resposta');
    fireEvent.change(ta, { target: { value: 'Política, risco, garantia e promoção.' } });
    expect(screen.getByText('37/300')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Submeter avaliação/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Submeter$/ }));
    await waitFor(() => expect(api.submeter).toHaveBeenCalledTimes(1));
    const enviadas = api.submeter.mock.calls[0][1];
    expect(enviadas.h1).toEqual({ x: 30, y: 40 });
    expect(enviadas.a1).toBe('Política, risco, garantia e promoção.');

    expect(await screen.findByText('Aguarda correcção')).toBeInTheDocument();
    expect(screen.getByText('provisória')).toBeInTheDocument();
    expect(screen.getByText(/até 100% após correcção/)).toBeInTheDocument();
    expect(screen.queryByText('Reprovado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tentar novamente/i })).not.toBeInTheDocument();
    expect(screen.getByText('Pontos por atribuir')).toBeInTheDocument();
  });
});
