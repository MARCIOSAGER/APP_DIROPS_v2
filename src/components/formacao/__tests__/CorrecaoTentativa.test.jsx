import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/testUtils';

const api = vi.hoisted(() => ({ correcao: vi.fn(), corrigir: vi.fn() }));
vi.mock('@/lib/quizApi', () => ({ quizApi: api }));

const { default: CorrecaoTentativa } = await import('@/components/formacao/quiz/CorrecaoTentativa');

const DETALHE = {
  tentativa: { id: 't1', numero: 1, nota: 30, aprovado: null, correcao_pendente: true },
  aluno_nome: 'Ana Silva', aluno_email: 'ana@sga.co.ao', nota_minima: 70, correcoes: {}, pendentes: 1, nota_max_possivel: 100,
  perguntas: [
    { id: 'p1', tipo: 'vf', enunciado: 'A pista é área de manobras.', pontos: 3, opcoes: [{ id: 'v', texto: 'Verdadeiro', correta: true }, { id: 'f', texto: 'Falso' }] },
    { id: 'a1', tipo: 'aberta', enunciado: 'Explique os 4 pilares do SGSO.', pontos: 7, opcoes: [{ max_chars: 500, rubrica: '1 ponto por pilar + 3 pela ligação entre eles' }] },
  ],
  revisao: [
    { pergunta_id: 'p1', tipo: 'vf', resposta: 'v', respondida: true, correta: true, parcial: false, pontos_obtidos: 3, pontos_max: 3, gabarito: 'v' },
    { pergunta_id: 'a1', tipo: 'aberta', resposta: 'Política, risco, garantia e promoção.', respondida: true, correta: false, parcial: false, pontos_obtidos: 0, pontos_max: 7, pendente: true, gabarito: '1 ponto por pilar + 3 pela ligação entre eles' },
  ],
};

describe('CorrecaoTentativa', () => {
  beforeEach(() => { vi.clearAllMocks(); api.correcao.mockResolvedValue(DETALHE); });

  it('mostra a resposta aberta com os critérios, valida os pontos e envia a correcção', async () => {
    const onClose = vi.fn();
    api.corrigir.mockResolvedValue({ nota: 100, aprovado: true, pendente: false, pendentes: 0, certificado_numero: 'DO-2026/0042' });
    renderWithProviders(<CorrecaoTentativa tentativaId="t1" isOpen onClose={onClose} />);
    expect(await screen.findByText(/Ana Silva · tentativa 1/)).toBeInTheDocument();
    expect(screen.getByText('Política, risco, garantia e promoção.')).toBeInTheDocument();
    expect(screen.getByText(/1 ponto por pilar/)).toBeInTheDocument();
    expect(screen.getByText('1 sem pontos atribuídos')).toBeInTheDocument();

    const pontos = screen.getByLabelText(/Pontos \(0–7\)/);
    fireEvent.change(pontos, { target: { value: '9' } });
    expect(screen.getByText('Os pontos têm de estar entre 0 e 7.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar correcção/i })).toBeDisabled();

    fireEvent.change(pontos, { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/Comentário ao aluno/), { target: { value: 'Excelente.' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar correcção/i }));
    await waitFor(() => expect(api.corrigir).toHaveBeenCalledWith('t1', { a1: { pontos: 7, comentario: 'Excelente.' } }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('sem respostas abertas não permite guardar', async () => {
    api.correcao.mockResolvedValueOnce({ ...DETALHE, pendentes: 0, perguntas: [DETALHE.perguntas[0]], revisao: [DETALHE.revisao[0]] });
    renderWithProviders(<CorrecaoTentativa tentativaId="t1" isOpen onClose={() => {}} />);
    expect(await screen.findByText('Esta tentativa não tem respostas abertas para corrigir.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar correcção/i })).toBeDisabled();
  });
});
