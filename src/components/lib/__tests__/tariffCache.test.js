import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tariffCache } from '../tariffCache';

beforeEach(() => {
  tariffCache.clear();
});

// ── Basic cache operations ────────────────────────────────────────────
describe('TariffCache - set/get/clear', () => {
  it('stores and retrieves a value', () => {
    tariffCache.set('test-key', { data: 42 });
    expect(tariffCache.get('test-key')).toEqual({ data: 42 });
  });

  it('returns null for missing key', () => {
    expect(tariffCache.get('nonexistent')).toBeNull();
  });

  it('clear removes all entries', () => {
    tariffCache.set('a', 1);
    tariffCache.set('b', 2);
    tariffCache.clear();
    expect(tariffCache.get('a')).toBeNull();
    expect(tariffCache.get('b')).toBeNull();
  });
});

// ── TTL expiration ────────────────────────────────────────────────────
describe('TariffCache - TTL expiration', () => {
  it('returns null for expired entries', () => {
    tariffCache.set('expire-me', 'value');

    // Manually expire by setting timestamp in the past
    const entry = tariffCache.cache.get('expire-me');
    entry.timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago

    expect(tariffCache.get('expire-me')).toBeNull();
  });

  it('returns value for non-expired entries', () => {
    tariffCache.set('fresh', 'value');
    expect(tariffCache.get('fresh')).toBe('value');
  });
});

// ── generateKey ───────────────────────────────────────────────────────
describe('TariffCache - generateKey', () => {
  it('generates consistent lowercase keys', () => {
    const key = tariffCache.generateKey('index', 'POUSO', '10');
    expect(key).toBe('index:pouso:10');
  });
});

// ── buildTarifaPousoIndex ─────────────────────────────────────────────
describe('TariffCache - buildTarifaPousoIndex (note: method name is "buildTarifaPosusoIndex")', () => {
  const tarifas = [
    { status: 'ativa', categoria_aeroporto: 'A', faixa_min: 0, faixa_max: 5000, tarifa_domestica: 5, tarifa_internacional: 10 },
    { status: 'ativa', categoria_aeroporto: 'A', faixa_min: 5001, faixa_max: 20000, tarifa_domestica: 8, tarifa_internacional: 15 },
    { status: 'ativa', categoria_aeroporto: 'B', faixa_min: 0, faixa_max: 5000, tarifa_domestica: 3, tarifa_internacional: 6 },
    { status: 'inativa', categoria_aeroporto: 'A', faixa_min: 0, faixa_max: 5000, tarifa_domestica: 1, tarifa_internacional: 2 },
  ];

  it('groups active tarifas by category', () => {
    const index = tariffCache.buildTarifaPosusoIndex(tarifas);
    expect(index['A']).toHaveLength(2);
    expect(index['B']).toHaveLength(1);
  });

  it('excludes inactive tarifas', () => {
    const index = tariffCache.buildTarifaPosusoIndex(tarifas);
    const allActive = Object.values(index).flat();
    expect(allActive.every(t => t.status === 'ativa')).toBe(true);
  });

  it('caches the index on second call', () => {
    const index1 = tariffCache.buildTarifaPosusoIndex(tarifas);
    const index2 = tariffCache.buildTarifaPosusoIndex(tarifas);
    expect(index1).toBe(index2); // same reference = cached
  });
});

// ── buildTarifaPermanenciaIndex ───────────────────────────────────────
describe('TariffCache - buildTarifaPermanenciaIndex', () => {
  const tarifas = [
    { status: 'ativa', categoria_aeroporto: 'A', tarifa_usd_por_tonelada_hora: 0.5 },
    { status: 'ativa', categoria_aeroporto: 'B', tarifa_usd_por_tonelada_hora: 0.3 },
    { status: 'inativa', categoria_aeroporto: 'C', tarifa_usd_por_tonelada_hora: 0.1 },
  ];

  it('maps one tarifa per category', () => {
    const index = tariffCache.buildTarifaPermanenciaIndex(tarifas);
    expect(index['A'].tarifa_usd_por_tonelada_hora).toBe(0.5);
    expect(index['B'].tarifa_usd_por_tonelada_hora).toBe(0.3);
  });

  it('excludes inactive', () => {
    const index = tariffCache.buildTarifaPermanenciaIndex(tarifas);
    expect(index['C']).toBeUndefined();
  });
});

// ── buildOutrasTarifasIndex ───────────────────────────────────────────
describe('TariffCache - buildOutrasTarifasIndex', () => {
  const tarifas = [
    { status: 'ativa', tipo: 'embarque', categoria_aeroporto: 'A', valor: 10, tipo_operacao: 'ambos' },
    { status: 'ativa', tipo: 'carga', categoria_aeroporto: 'A', valor: 5, tipo_operacao: 'internacional' },
    { status: 'inativa', tipo: 'embarque', categoria_aeroporto: 'A', valor: 99, tipo_operacao: 'ambos' },
  ];

  it('groups by tipo:categoria key', () => {
    const index = tariffCache.buildOutrasTarifasIndex(tarifas);
    expect(index['embarque:A']).toHaveLength(1);
    expect(index['carga:A']).toHaveLength(1);
  });

  it('excludes inactive', () => {
    const index = tariffCache.buildOutrasTarifasIndex(tarifas);
    expect(index['embarque:A'][0].valor).toBe(10); // not 99
  });
});
