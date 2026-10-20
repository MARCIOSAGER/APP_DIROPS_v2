import { describe, it, expect, vi } from 'vitest';
import { criarScormRuntime, instalarScormApi, segundosParaTempo12, tempo12ParaSegundos, segundosParaIso8601, iso8601ParaSegundos } from '@/lib/scormApi';

describe('scormApi — tempos', () => {
  it('converte SCORM 1.2 HHHH:MM:SS.SS', () => {
    expect(segundosParaTempo12(3725)).toBe('0001:02:05.00');
    expect(tempo12ParaSegundos('0001:02:05.50')).toBe(3725.5);
    expect(tempo12ParaSegundos('abc')).toBeNull();
  });
  it('converte ISO 8601', () => {
    expect(segundosParaIso8601(3725)).toBe('PT1H2M5S');
    expect(iso8601ParaSegundos('PT1H2M5.5S')).toBe(3725.5);
    expect(iso8601ParaSegundos('P1DT1H')).toBe(90000);
    expect(iso8601ParaSegundos('1:00')).toBeNull();
  });
});

describe('scormApi — SCORM 1.2', () => {
  it('ciclo completo: initialize → set → commit → finish, com conclusão uma só vez', () => {
    const onGuardar = vi.fn(); const onConcluir = vi.fn();
    let t = 1000; const rt = criarScormRuntime({ norma: 'scorm12', aluno: { id: 'ana@sga.co.ao', nome: 'Ana' }, onGuardar, onConcluir, agora: () => t });
    const api = rt.api12;
    expect(api.LMSGetValue('cmi.core.student_name')).toBe('');          // antes de Initialize
    expect(api.LMSGetLastError()).toBe('301');
    expect(api.LMSInitialize('')).toBe('true');
    expect(api.LMSInitialize('')).toBe('false');                        // já inicializado
    expect(api.LMSGetValue('cmi.core.student_name')).toBe('Ana');
    expect(api.LMSGetValue('cmi.core.entry')).toBe('ab-initio');
    expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('not attempted');
    expect(api.LMSSetValue('cmi.core.lesson_status', 'errado')).toBe('false');
    expect(api.LMSGetLastError()).toBe('405');
    expect(api.LMSSetValue('cmi.core.lesson_status', 'incomplete')).toBe('true');
    expect(api.LMSSetValue('cmi.suspend_data', 'p=3')).toBe('true');
    expect(api.LMSSetValue('cmi.core.score.max', '50')).toBe('true');
    expect(api.LMSSetValue('cmi.core.score.raw', '40')).toBe('true');
    expect(api.LMSSetValue('cmi.core.student_id', 'x')).toBe('false');   // só leitura
    expect(api.LMSGetLastError()).toBe('403');
    expect(api.LMSCommit('')).toBe('true');
    expect(onGuardar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'incomplete', nota: 80, concluido: false }), 'commit');
    expect(onConcluir).not.toHaveBeenCalled();
    expect(api.LMSSetValue('cmi.core.lesson_status', 'passed')).toBe('true');
    expect(onConcluir).toHaveBeenCalledTimes(1);
    expect(onConcluir.mock.calls[0][0]).toMatchObject({ estado: 'passed', nota: 80, sucesso: true, concluido: true });
    expect(api.LMSSetValue('cmi.core.session_time', '0000:10:00.00')).toBe('true');
    t = 1000 + 99 * 1000;
    expect(api.LMSFinish('')).toBe('true');
    expect(onGuardar).toHaveBeenLastCalledWith(expect.objectContaining({ tempo_s: 600 }), 'finish'); // session_time reportado ganha ao relógio
    expect(onConcluir).toHaveBeenCalledTimes(1);
    expect(api.LMSFinish('')).toBe('false');
  });
  it('retoma com dados guardados: entry=resume, total_time acumulado e interacções contadas', () => {
    const rt = criarScormRuntime({ norma: 'scorm12', inicial: { estado: 'incomplete', tempo_s: 120, dados: { 'cmi.suspend_data': 'p=3', 'cmi.core.lesson_location': 'slide7' } } });
    const api = rt.api12; api.LMSInitialize('');
    expect(api.LMSGetValue('cmi.core.entry')).toBe('resume');
    expect(api.LMSGetValue('cmi.suspend_data')).toBe('p=3');
    expect(api.LMSGetValue('cmi.core.total_time')).toBe('0000:02:00.00');
    api.LMSSetValue('cmi.interactions.0.id', 'q1'); api.LMSSetValue('cmi.interactions.0.result', 'correct'); api.LMSSetValue('cmi.interactions.1.id', 'q2');
    expect(api.LMSGetValue('cmi.interactions._count')).toBe('2');
    expect(api.LMSGetValue('cmi.interactions.0.result')).toBe('correct');
    expect(api.LMSGetValue('cmi.nao.existe')).toBe(''); expect(api.LMSGetLastError()).toBe('401');
  });
  it('fechar() guarda a sessão medida pelo relógio quando o pacote não chama Finish', () => {
    const onGuardar = vi.fn(); let t = 0;
    const rt = criarScormRuntime({ onGuardar, agora: () => t });
    rt.api12.LMSInitialize(''); t = 45000; rt.fechar();
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ tempo_s: 45 }), 'unload');
  });
});

describe('scormApi — SCORM 2004', () => {
  it('completion/success/score.scaled e conclusão', () => {
    const onConcluir = vi.fn(); const onGuardar = vi.fn();
    const api = criarScormRuntime({ norma: 'scorm2004', aluno: { id: 'a', nome: 'A' }, onConcluir, onGuardar }).api2004;
    expect(api.Terminate('')).toBe('false'); expect(api.GetLastError()).toBe('112');
    expect(api.Initialize('')).toBe('true');
    expect(api.GetValue('cmi.completion_status')).toBe('not attempted');
    expect(api.GetValue('cmi.success_status')).toBe('unknown');
    expect(api.GetValue('cmi.score.scaled')).toBe(''); expect(api.GetLastError()).toBe('403');
    expect(api.SetValue('cmi.score.scaled', '1.5')).toBe('false'); expect(api.GetLastError()).toBe('407');
    expect(api.SetValue('cmi.score.scaled', '0.85')).toBe('true');
    expect(api.SetValue('cmi.completion_status', 'completed')).toBe('true');
    expect(onConcluir).toHaveBeenCalledTimes(1);
    expect(onConcluir.mock.calls[0][0]).toMatchObject({ estado: 'completed', nota: 85 });
    expect(api.SetValue('cmi.success_status', 'failed')).toBe('true');
    expect(api.SetValue('cmi.session_time', 'PT2M')).toBe('true');
    expect(api.Terminate('')).toBe('true');
    expect(onGuardar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'failed', sucesso: false, tempo_s: 120, concluido: false }), 'finish');
    expect(api.GetValue('cmi.location')).toBe(''); expect(api.GetLastError()).toBe('123');
  });
});

describe('instalarScormApi', () => {
  it('expõe API e API_1484_11 na janela e remove ao desmontar', () => {
    const win = {}; const rt = criarScormRuntime();
    const remover = instalarScormApi(win, rt);
    expect(win.API).toBe(rt.api12); expect(win.API_1484_11).toBe(rt.api2004);
    remover();
    expect(win.API).toBeUndefined(); expect(win.API_1484_11).toBeUndefined();
  });
});
