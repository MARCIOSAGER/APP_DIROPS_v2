import { describe, it, expect } from 'vitest';

// Pure filter function — extracted from voosArrDisponíveis useMemo logic
// This function will be created/exported in FormVoo.jsx as part of Task 2
import { filterVoosArr } from '../FormVoo';

// Helper: build a minimal ARR voo object
const makeArrVoo = (overrides = {}) => ({
  id: overrides.id || 'arr-1',
  tipo_movimento: 'ARR',
  status: 'Ativo',
  data_operacao: overrides.data_operacao || '2026-01-10',
  horario_real: overrides.horario_real || '08:00',
  horario_previsto: overrides.horario_previsto || null,
  registo_aeronave: overrides.registo_aeronave || 'D2-TST',
  empresa_id: overrides.empresa_id || 'empresa-1',
});

const baseDepFormData = {
  tipo_movimento: 'DEP',
  data_operacao: '2026-01-10',
  horario_real: '10:00',
  horario_previsto: null,
  registo_aeronave: 'D2-TST',
};

describe('filterVoosArr — registration filter', () => {
  it('returns only ARR voos with matching registration when registo_aeronave is set', () => {
    const voos = [
      makeArrVoo({ id: 'arr-match', registo_aeronave: 'D2-TST' }),
      makeArrVoo({ id: 'arr-other', registo_aeronave: 'D2-OTH' }),
    ];
    const result = filterVoosArr(voos, baseDepFormData, [], null);
    expect(result.map(v => v.id)).toContain('arr-match');
    expect(result.map(v => v.id)).not.toContain('arr-other');
  });

  it('returns all date-eligible ARR voos when registo_aeronave is empty', () => {
    const formDataNoReg = { ...baseDepFormData, registo_aeronave: '' };
    const voos = [
      makeArrVoo({ id: 'arr-1', registo_aeronave: 'D2-TST' }),
      makeArrVoo({ id: 'arr-2', registo_aeronave: 'D2-OTH' }),
    ];
    const result = filterVoosArr(voos, formDataNoReg, [], null);
    expect(result.map(v => v.id)).toContain('arr-1');
    expect(result.map(v => v.id)).toContain('arr-2');
  });

  it('excludes ARR voos with date after DEP date (date filter regression guard)', () => {
    const formData = { ...baseDepFormData, data_operacao: '2026-01-10' };
    const voos = [
      makeArrVoo({ id: 'arr-before', data_operacao: '2026-01-09', registo_aeronave: 'D2-TST' }),
      makeArrVoo({ id: 'arr-after', data_operacao: '2026-01-11', registo_aeronave: 'D2-TST' }),
    ];
    const result = filterVoosArr(voos, formData, [], null);
    expect(result.map(v => v.id)).toContain('arr-before');
    expect(result.map(v => v.id)).not.toContain('arr-after');
  });
});
