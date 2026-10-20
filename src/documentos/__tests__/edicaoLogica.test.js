import { describe, it, expect } from 'vitest';
import {
  estadoReserva, reservaActiva, reservadaPorMim, reservadaPorOutro, accoesReserva, modoLibertar,
  bloqueioCarregamento, quemReservou, proximaVersao, planoVersoesRascunho, rotuloFonte,
} from '@/documentos/edicaoLogica';

const agora = new Date('2026-10-20T12:00:00Z');
const activa = { reservado_por: 'ana@sga.co.ao', reservado_nome: 'Ana Silva', reservado_em: '2026-10-18T09:00:00Z', expira_em: '2026-10-25T09:00:00Z' };
const expirada = { ...activa, expira_em: '2026-10-19T09:00:00Z' };

describe('estadoReserva', () => {
  it('livre quando não há reserva', () => {
    expect(estadoReserva(null, agora)).toBe('livre');
    expect(estadoReserva({}, agora)).toBe('livre');
  });
  it('activa antes de expirar, expirada depois', () => {
    expect(estadoReserva(activa, agora)).toBe('activa');
    expect(estadoReserva(expirada, agora)).toBe('expirada');
    expect(reservaActiva(expirada, agora)).toBe(false);
  });
  it('expira exactamente no instante conta como expirada', () => {
    expect(estadoReserva({ ...activa, expira_em: agora.toISOString() }, agora)).toBe('expirada');
  });
  it('data de expiração ilegível conta como activa (protege o trabalho)', () => {
    expect(estadoReserva({ ...activa, expira_em: 'lixo' }, agora)).toBe('activa');
  });
});

describe('dono da reserva', () => {
  it('compara o email sem maiúsculas nem espaços', () => {
    expect(reservadaPorMim(activa, ' ANA@sga.co.ao ')).toBe(true);
    expect(reservadaPorMim(activa, 'rui@sga.co.ao')).toBe(false);
  });
  it('reservada por outro só se activa', () => {
    expect(reservadaPorOutro(activa, 'rui@sga.co.ao', agora)).toBe(true);
    expect(reservadaPorOutro(expirada, 'rui@sga.co.ao', agora)).toBe(false);
    expect(reservadaPorOutro(activa, 'ana@sga.co.ao', agora)).toBe(false);
  });
  it('nome a mostrar', () => {
    expect(quemReservou(activa)).toBe('Ana Silva');
    expect(quemReservou({ reservado_por: 'x@y' })).toBe('x@y');
  });
});

describe('accoesReserva / modoLibertar', () => {
  it('documento livre: editor pode reservar, ninguém liberta', () => {
    const a = accoesReserva({ reserva: null, email: 'rui@sga.co.ao', podeEditar: true, agora });
    expect(a).toMatchObject({ estado: 'livre', reservar: true, renovar: false, libertar: false, forcar: false });
    expect(accoesReserva({ reserva: null, email: 'rui@sga.co.ao', podeEditar: false, agora }).reservar).toBe(false);
  });
  it('quem reservou renova e liberta; não força', () => {
    const a = accoesReserva({ reserva: activa, email: 'ana@sga.co.ao', podeEditar: true, agora });
    expect(a).toMatchObject({ minha: true, reservar: false, renovar: true, libertar: true, forcar: false });
    expect(modoLibertar({ reserva: activa, email: 'ana@sga.co.ao', podeEditar: true, agora })).toBe('libertar');
  });
  it('outro editor não liberta nem força uma reserva activa', () => {
    const a = accoesReserva({ reserva: activa, email: 'rui@sga.co.ao', podeEditar: true, gestor: false, agora });
    expect(a).toMatchObject({ reservar: false, libertar: false, forcar: false });
    expect(modoLibertar({ reserva: activa, email: 'rui@sga.co.ao', podeEditar: true, agora })).toBeNull();
  });
  it('gestor pode forçar a reserva activa de outra pessoa', () => {
    const a = accoesReserva({ reserva: activa, email: 'gestor@sga.co.ao', podeEditar: true, gestor: true, agora });
    expect(a).toMatchObject({ libertar: false, forcar: true });
    expect(modoLibertar({ reserva: activa, email: 'gestor@sga.co.ao', podeEditar: true, gestor: true, agora })).toBe('forcar');
  });
  it('reserva expirada: qualquer editor a pode retomar ou limpar', () => {
    const a = accoesReserva({ reserva: expirada, email: 'rui@sga.co.ao', podeEditar: true, agora });
    expect(a).toMatchObject({ estado: 'expirada', reservar: true, libertar: true, forcar: false });
  });
  it('leitor sem edição não tem acções', () => {
    const a = accoesReserva({ reserva: activa, email: 'leitor@sga.co.ao', podeEditar: false, agora });
    expect(a).toMatchObject({ reservar: false, renovar: false, libertar: false, forcar: false });
  });
});

describe('bloqueioCarregamento', () => {
  it('bloqueia com mensagem clara quando reservado por outro', () => {
    const m = bloqueioCarregamento(activa, 'rui@sga.co.ao', { agora, fmt: () => '18/10/2026' });
    expect(m).toMatch(/reservado para edição por Ana Silva desde 18\/10\/2026/);
  });
  it('não bloqueia o dono, nem com reserva expirada, nem sem reserva', () => {
    expect(bloqueioCarregamento(activa, 'ana@sga.co.ao', { agora })).toBeNull();
    expect(bloqueioCarregamento(expirada, 'rui@sga.co.ao', { agora })).toBeNull();
    expect(bloqueioCarregamento(null, 'rui@sga.co.ao', { agora })).toBeNull();
  });
});

describe('revisões em rascunho', () => {
  it('próxima versão = máximo + 1 (inclui fontes e versao_atual)', () => {
    expect(proximaVersao([{ versao: 8 }, { versao: 9 }], 8)).toBe(10);
    expect(proximaVersao([], 0)).toBe(1);
    expect(proximaVersao([], 3)).toBe(4);
  });
  it('PDF + fonte: revisão N em rascunho e fonte N+1 com estado «fonte»', () => {
    const plano = planoVersoesRascunho({
      ficheiros: [{ nome: 'manual.docx', papel: 'fonte' }, { nome: 'manual.pdf', papel: 'pdf' }],
      rotulo: 'Revisão 04/26', nota: 'Cap. 3', proxima: 10,
    });
    expect(plano).toHaveLength(2);
    expect(plano[0]).toMatchObject({ versao: 10, estado: 'rascunho', rotulo: 'Revisão 04/26', nota: 'Cap. 3' });
    expect(plano[0].ficheiro.nome).toBe('manual.pdf');
    expect(plano[1]).toMatchObject({ versao: 11, estado: 'fonte', rotulo: 'Fonte editável (.docx) — Revisão 04/26' });
  });
  it('só fonte: o .docx é a própria revisão em rascunho', () => {
    const plano = planoVersoesRascunho({ ficheiros: [{ nome: 'm.docx', papel: 'fonte' }], proxima: 3 });
    expect(plano).toEqual([expect.objectContaining({ versao: 3, estado: 'rascunho', rotulo: '3' })]);
  });
  it('recusa entradas inválidas', () => {
    expect(() => planoVersoesRascunho({ ficheiros: [] })).toThrow(/pelo menos um ficheiro/);
    expect(() => planoVersoesRascunho({ ficheiros: [{ nome: 'a.docx', papel: 'pdf' }] })).toThrow(/PDF/);
    expect(() => planoVersoesRascunho({ ficheiros: [{ nome: 'a.pdf', papel: 'fonte' }] })).toThrow(/editável/);
    expect(() => planoVersoesRascunho({ ficheiros: [{ nome: 'a.pdf', papel: 'pdf' }, { nome: 'b.pdf', papel: 'pdf' }] })).toThrow(/um PDF/);
    expect(() => planoVersoesRascunho({ ficheiros: [{ nome: 'a.pdf', papel: 'outro' }] })).toThrow(/desconhecido/);
  });
  it('rótulo da fonte segue o padrão da ficha (reconhecido por /^fonte edit/i)', () => {
    expect(rotuloFonte('Rev. B', 'x.xlsx')).toBe('Fonte editável (.xlsx) — Rev. B');
    expect(/^\s*fonte\s*edit/i.test(rotuloFonte('', 'x.docx'))).toBe(true);
  });
});
