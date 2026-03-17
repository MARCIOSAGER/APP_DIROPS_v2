import { describe, it, expect, beforeEach } from 'vitest';
import { tariffCache } from '../tariffCache';
import {
  calculateTarifaPouso,
  calculateTarifaPermanencia,
  calculateTarifaPassageiros,
  calculateTarifaCarga,
  calculateOutrasTarifas,
  calculateTaxes,
  convertCurrency,
} from '../tariffCalculators';

beforeEach(() => {
  tariffCache.clear();
});

// ── Shared fixtures ───────────────────────────────────────────────────
const tarifasPouso = [
  { status: 'ativa', categoria_aeroporto: 'A', faixa_min: 0, faixa_max: 5000, tarifa_domestica: 5, tarifa_internacional: 10 },
  { status: 'ativa', categoria_aeroporto: 'A', faixa_min: 5001, faixa_max: 50000, tarifa_domestica: 8, tarifa_internacional: 15 },
];

const tarifasPermanencia = [
  { status: 'ativa', categoria_aeroporto: 'A', tarifa_usd_por_tonelada_hora: 0.5 },
];

const outrasTarifas = [
  { status: 'ativa', tipo: 'embarque', categoria_aeroporto: 'A', valor: 12, tipo_operacao: 'ambos' },
  { status: 'ativa', tipo: 'carga', categoria_aeroporto: 'A', valor: 20, tipo_operacao: 'ambos' },
  { status: 'ativa', tipo: 'iluminacao', categoria_aeroporto: 'A', valor: 50, tipo_operacao: 'ambos' },
  { status: 'ativa', tipo: 'seguranca', categoria_aeroporto: 'A', valor: 30, tipo_operacao: 'ambos' },
  { status: 'ativa', tipo: 'transito_transbordo', categoria_aeroporto: 'A', valor: 6, tipo_operacao: 'ambos' },
  { status: 'ativa', tipo: 'transito_direto', categoria_aeroporto: 'A', valor: 3, tipo_operacao: 'ambos' },
];

// ── calculateTarifaPouso ──────────────────────────────────────────────
describe('calculateTarifaPouso', () => {
  it('calculates domestic landing tariff correctly', () => {
    // 3000 kg = 3 tonnes, domestic tariff = 5 USD/tonne
    const result = calculateTarifaPouso(3000, 3, 'A', tarifasPouso, false);
    expect(result.usd).toBe(15); // 5 * 3
    expect(result.config).toBeTruthy();
  });

  it('calculates international landing tariff correctly', () => {
    const result = calculateTarifaPouso(3000, 3, 'A', tarifasPouso, true);
    expect(result.usd).toBe(30); // 10 * 3
  });

  it('selects correct weight range', () => {
    const result = calculateTarifaPouso(10000, 10, 'A', tarifasPouso, false);
    expect(result.usd).toBe(80); // 8 * 10
  });

  it('returns zero for unknown category', () => {
    const result = calculateTarifaPouso(3000, 3, 'Z', tarifasPouso, false);
    expect(result.usd).toBe(0);
    expect(result.config).toBeNull();
  });

  it('returns zero when mtow is outside all ranges', () => {
    const result = calculateTarifaPouso(999999, 1000, 'A', tarifasPouso, false);
    expect(result.usd).toBe(0);
  });
});

// ── calculateTarifaPermanencia ────────────────────────────────────────
describe('calculateTarifaPermanencia', () => {
  it('returns zero for aircraft in hangar', () => {
    const result = calculateTarifaPermanencia(10, 5, 'A', tarifasPermanencia, true);
    expect(result.usd).toBe(0);
    expect(result.type).toBe('hangar');
  });

  it('returns zero for stays <= 2 hours (exempt)', () => {
    const result = calculateTarifaPermanencia(1.5, 5, 'A', tarifasPermanencia, false);
    expect(result.usd).toBe(0);
    expect(result.type).toBe('exempt_short');
  });

  it('calculates base rate for 2-6 hours', () => {
    // 4 hours total: 2 exempt + 2 billed at base rate
    // 0.5 * 5 tonnes * 2 hours = 5.0
    const result = calculateTarifaPermanencia(4, 5, 'A', tarifasPermanencia, false);
    expect(result.usd).toBe(5);
    expect(result.details.type).toBe('base');
  });

  it('applies surcharge for stays > 6 hours', () => {
    // 8 hours: 2 exempt, 4 at base, 2 at 1.5x
    // base: 0.5 * 5 * 4 = 10
    // surcharge: 0.5 * 1.5 * 5 * 2 = 7.5
    // total: 17.5
    const result = calculateTarifaPermanencia(8, 5, 'A', tarifasPermanencia, false);
    expect(result.usd).toBe(17.5);
    expect(result.details.type).toBe('sobretaxa');
  });

  it('returns zero with error for unknown category', () => {
    const result = calculateTarifaPermanencia(5, 5, 'Z', tarifasPermanencia, false);
    expect(result.usd).toBe(0);
    expect(result.error).toBeTruthy();
  });
});

// ── calculateTarifaPassageiros ────────────────────────────────────────
describe('calculateTarifaPassageiros', () => {
  const vooDep = { passageiros_local: 100, tipo_voo: 'Regular' };
  const vooArr = {};

  it('calculates passenger tariff correctly', () => {
    const result = calculateTarifaPassageiros(vooDep, vooArr, 'A', outrasTarifas, 'ambos', 'Regular');
    expect(result.usd).toBe(1200); // 12 * 100
    expect(result.passageiros).toBe(100);
  });

  it('returns exempt for zero passengers', () => {
    const result = calculateTarifaPassageiros(
      { passageiros_local: 0, tipo_voo: 'Regular' }, vooArr, 'A', outrasTarifas, 'ambos', 'Regular'
    );
    expect(result.usd).toBe(0);
    expect(result.isExempt).toBe(true);
  });

  it('returns exempt for cargo flights', () => {
    const result = calculateTarifaPassageiros(
      { passageiros_local: 50, tipo_voo: 'Carga' }, vooArr, 'A', outrasTarifas, 'ambos', 'Regular'
    );
    expect(result.usd).toBe(0);
    expect(result.isExempt).toBe(true);
    expect(result.reason).toBe('Tipo de voo isento');
  });

  it('returns exempt for military flights', () => {
    const result = calculateTarifaPassageiros(
      { passageiros_local: 50, tipo_voo: 'Militar' }, vooArr, 'A', outrasTarifas, 'ambos', 'Regular'
    );
    expect(result.isExempt).toBe(true);
  });

  it('returns error when tariff not found', () => {
    const result = calculateTarifaPassageiros(vooDep, vooArr, 'Z', outrasTarifas, 'ambos', 'Regular');
    expect(result.usd).toBe(0);
    expect(result.error).toBeTruthy();
  });
});

// ── calculateTarifaCarga ──────────────────────────────────────────────
describe('calculateTarifaCarga', () => {
  it('calculates cargo tariff correctly', () => {
    const vooDep = { carga_kg: 5000 };
    const result = calculateTarifaCarga(vooDep, {}, 'A', outrasTarifas, 'ambos');
    expect(result.usd).toBe(100); // 5 tonnes * 20
    expect(result.carga_ton).toBe(5);
  });

  it('returns exempt for zero cargo', () => {
    const result = calculateTarifaCarga({ carga_kg: 0 }, {}, 'A', outrasTarifas, 'ambos');
    expect(result.usd).toBe(0);
    expect(result.isExempt).toBe(true);
  });

  it('returns exempt for missing cargo field', () => {
    const result = calculateTarifaCarga({}, {}, 'A', outrasTarifas, 'ambos');
    expect(result.usd).toBe(0);
    expect(result.isExempt).toBe(true);
  });
});

// ── calculateOutrasTarifas ────────────────────────────────────────────
describe('calculateOutrasTarifas', () => {
  it('includes security tariff always', () => {
    const result = calculateOutrasTarifas(
      {}, 'A', outrasTarifas, 'ambos', false, false, {}, {}
    );
    expect(result.detalhes.some(d => d.tipo === 'seguranca')).toBe(true);
    expect(result.usd).toBe(30);
  });

  it('includes illumination for night operations', () => {
    const result = calculateOutrasTarifas(
      {}, 'A', outrasTarifas, 'ambos', true, false, {}, {}
    );
    expect(result.detalhes.some(d => d.tipo === 'iluminacao')).toBe(true);
    expect(result.usd).toBe(80); // 50 + 30
  });

  it('includes illumination when extra lighting required', () => {
    const result = calculateOutrasTarifas(
      {}, 'A', outrasTarifas, 'ambos', false, true, {}, {}
    );
    expect(result.detalhes.some(d => d.tipo === 'iluminacao')).toBe(true);
  });

  it('calculates transit passenger tariffs', () => {
    const vooDep = { passageiros_transito_transbordo: 10, passageiros_transito_direto: 5 };
    const result = calculateOutrasTarifas(
      {}, 'A', outrasTarifas, 'ambos', false, false, vooDep, {}
    );
    expect(result.detalhes.some(d => d.tipo === 'transito_transbordo')).toBe(true);
    expect(result.detalhes.some(d => d.tipo === 'transito_direto')).toBe(true);
    // 30 (seguranca) + 60 (10*6 transito_transbordo) + 15 (5*3 transito_direto)
    expect(result.usd).toBe(105);
  });

  it('returns zero for unknown category', () => {
    const result = calculateOutrasTarifas(
      {}, 'Z', outrasTarifas, 'ambos', false, false, {}, {}
    );
    expect(result.usd).toBe(0);
  });
});

// ── calculateTaxes ────────────────────────────────────────────────────
describe('calculateTaxes', () => {
  const impostos = [
    {
      status: 'ativo',
      tipo: 'IVA',
      valor: '14',
      data_inicio_vigencia: '2020-01-01',
      data_fim_vigencia: null,
      aeroporto_id: null,
    },
    {
      status: 'ativo',
      tipo: 'TSA',
      valor: '5',
      data_inicio_vigencia: '2020-01-01',
      data_fim_vigencia: '2025-12-31',
      aeroporto_id: null,
    },
  ];
  const vooDep = { data_operacao: '2024-06-15' };
  const aeroporto = { id: 'a1' };

  it('calculates percentage-based taxes', () => {
    const result = calculateTaxes(impostos, 1000, 900, vooDep, aeroporto);
    // IVA: 14% of 1000 = 140 USD, 126000 AOA
    // TSA: 5% of 1000 = 50 USD, 45000 AOA
    expect(result.usd).toBe(190);
    expect(result.aoa).toBe(171000);
    expect(result.detalhes).toHaveLength(2);
  });

  it('skips inactive taxes', () => {
    const withInactive = [...impostos, { status: 'inativo', tipo: 'EXTRA', valor: '10', data_inicio_vigencia: '2020-01-01' }];
    const result = calculateTaxes(withInactive, 1000, 1, vooDep, aeroporto);
    expect(result.detalhes).toHaveLength(2);
  });

  it('skips taxes outside validity period', () => {
    const vooFuturo = { data_operacao: '2026-06-01' };
    const result = calculateTaxes(impostos, 1000, 1, vooFuturo, aeroporto);
    // TSA expired end of 2025, only IVA applies
    expect(result.detalhes).toHaveLength(1);
    expect(result.detalhes[0].tipo).toBe('IVA');
  });

  it('skips taxes for different airport', () => {
    const aeroportoSpecific = [
      { ...impostos[0], aeroporto_id: 'a2' },
    ];
    const result = calculateTaxes(aeroportoSpecific, 1000, 1, vooDep, aeroporto);
    expect(result.detalhes).toHaveLength(0);
  });

  it('returns zero for empty impostos', () => {
    const result = calculateTaxes([], 1000, 1, vooDep, aeroporto);
    expect(result.usd).toBe(0);
    expect(result.detalhes).toHaveLength(0);
  });

  it('returns zero for null impostos', () => {
    const result = calculateTaxes(null, 1000, 1, vooDep, aeroporto);
    expect(result.usd).toBe(0);
  });
});

// ── convertCurrency ───────────────────────────────────────────────────
describe('convertCurrency', () => {
  it('converts correctly', () => {
    expect(convertCurrency(100, 900)).toBe(90000);
  });

  it('handles zero', () => {
    expect(convertCurrency(0, 900)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    // 10.1 * 3 = 30.299999... → toFixed(2) = "30.30" → 30.3
    expect(convertCurrency(10.1, 3)).toBe(30.3);
  });

  it('handles fractional exchange rate', () => {
    expect(convertCurrency(100, 0.85)).toBe(85);
  });
});
