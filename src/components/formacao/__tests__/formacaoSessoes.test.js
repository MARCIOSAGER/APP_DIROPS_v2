import { describe, it, expect } from 'vitest';
import { ocupacaoSessao, faseSessao, podeInscrever, fmtPeriodoSessao, duracaoSessaoMin, textoConvocatoria, icsSessao, linkAberto, modoDe } from '@/lib/formacaoSessoes';

const sessao = { id: 's1', curso_id: 'c1', titulo: 'Prática no pátio', inicio: '2026-10-12T09:00:00', fim: '2026-10-12T12:30:00', local: 'Hangar 2', aeroporto: 'FNLU', formador_nome: 'João', vagas: 2, estado: 'agendada' };
const inscricoes = [
  { id: 'i1', sessao_id: 's1', aluno_email: 'a@sga.co.ao', estado: 'inscrito' },
  { id: 'i2', sessao_id: 's1', aluno_email: 'b@sga.co.ao', estado: 'presente' },
  { id: 'i3', sessao_id: 's1', aluno_email: 'c@sga.co.ao', estado: 'lista_espera' },
  { id: 'i4', sessao_id: 's1', aluno_email: 'd@sga.co.ao', estado: 'cancelado' },
  { id: 'i5', sessao_id: 's2', aluno_email: 'e@sga.co.ao', estado: 'inscrito' },
];

describe('formacaoSessoes', () => {
  it('ocupação: conta inscritos/presentes/ausentes como vagas ocupadas, lista de espera à parte', () => {
    expect(ocupacaoSessao(sessao, inscricoes)).toMatchObject({ ocupadas: 2, online: 0, inscritos: 2, espera: 1, presentes: 1, vagas: 2, livres: 0, cheia: true });
    expect(ocupacaoSessao({ ...sessao, vagas: null }, inscricoes)).toMatchObject({ vagas: null, livres: null, cheia: false });
  });
  it('híbrida: online não ocupa lugares na sala; presenças separadas por modo', () => {
    const h = { ...sessao, modalidade: 'hibrida', link_online: 'https://teams.microsoft.com/x' };
    const ins = [...inscricoes, { id: 'i6', sessao_id: 's1', aluno_email: 'f@sga.co.ao', estado: 'presente', modo: 'online' }, { id: 'i7', sessao_id: 's1', aluno_email: 'g@sga.co.ao', estado: 'inscrito', modo: 'online' }];
    expect(ocupacaoSessao(h, ins)).toMatchObject({ ocupadas: 2, online: 2, inscritos: 4, presentes: 2, presentesOnline: 1, presentesPresencial: 1, cheia: true });
    expect(modoDe(h, { modo: 'online' })).toBe('online'); expect(modoDe(h, {})).toBe('presencial'); expect(modoDe({ modalidade: 'online' }, {})).toBe('online');
    expect(linkAberto(h, new Date('2026-10-12T08:29:00'))).toBe(false);
    expect(linkAberto(h, new Date('2026-10-12T08:31:00'))).toBe(true);
    expect(linkAberto(sessao, new Date('2026-10-12T10:00:00'))).toBe(false); // presencial sem link
  });
  it('gera convite .ics com REQUEST/CANCEL e ligação online', () => {
    const ics = icsSessao({ sessao: { ...sessao, modalidade: 'online', link_online: 'https://meet.google.com/abc' }, curso: { titulo: 'GRF' } });
    expect(ics).toContain('METHOD:REQUEST'); expect(ics).toContain('UID:sessao-s1@dirops.sga.co.ao'); expect(ics).toContain('URL:https://meet.google.com/abc'); expect(ics).toContain('SUMMARY:[Formação] Prática no pátio');
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(icsSessao({ sessao, curso: {}, cancelar: true })).toContain('METHOD:CANCEL');
    const t = textoConvocatoria({ sessao: { ...sessao, modalidade: 'hibrida', link_online: 'https://meet.google.com/abc', plataforma: 'meet' }, curso: { id: 'c1', titulo: 'GRF' }, nome: 'Ana', modo: 'online' });
    expect(t.subject).toContain('sessão online'); expect(t.html).toContain('Entrar na sessão online'); expect(t.html).toContain('Google Meet');
  });
  it('fase temporal e regra de inscrição', () => {
    expect(faseSessao(sessao, new Date('2026-10-11T10:00:00'))).toBe('futura');
    expect(faseSessao(sessao, new Date('2026-10-12T10:00:00'))).toBe('a_decorrer');
    expect(faseSessao(sessao, new Date('2026-10-13T10:00:00'))).toBe('passada');
    const antes = new Date('2026-10-11T10:00:00');
    expect(podeInscrever(sessao, null, antes)).toBe(true);
    expect(podeInscrever(sessao, { estado: 'cancelado' }, antes)).toBe(true);
    expect(podeInscrever(sessao, { estado: 'inscrito' }, antes)).toBe(false);
    expect(podeInscrever({ ...sessao, estado: 'cancelada' }, null, antes)).toBe(false);
    expect(podeInscrever(sessao, null, new Date('2026-10-13T10:00:00'))).toBe(false);
  });
  it('formata o período e a duração', () => {
    expect(fmtPeriodoSessao(sessao)).toBe('seg 12 out 2026 · 09:00–12:30');
    expect(fmtPeriodoSessao({ inicio: '2026-10-12T09:00:00', fim: '2026-10-13T17:00:00' })).toBe('seg 12 out 2026 09:00 → ter 13 out 2026 17:00');
    expect(duracaoSessaoMin(sessao)).toBe(210);
  });
  it('convocatória escapa HTML e varia por tipo', () => {
    const c = textoConvocatoria({ sessao: { ...sessao, descricao: 'Levar <EPI>' }, curso: { id: 'c1', titulo: 'GRF' }, nome: 'Ana Silva', baseUrl: 'http://x' });
    expect(c.subject).toBe('[Formação] Convocatória — sessão presencial — GRF');
    expect(c.html).toContain('Ana, está convocado(a)');
    expect(c.html).toContain('Levar &lt;EPI&gt;');
    expect(c.html).toContain('http://x/universidade/formacao?curso=c1');
    expect(textoConvocatoria({ sessao, curso: { titulo: 'GRF' }, tipo: 'lembrete' }).subject).toContain('amanhã');
    expect(textoConvocatoria({ sessao, curso: { titulo: 'GRF' }, tipo: 'cancelada' }).html).not.toContain('Ver o curso');
  });
});
