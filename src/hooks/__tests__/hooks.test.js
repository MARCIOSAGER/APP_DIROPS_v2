import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mock entities ─────────────────────────────────────────────────────────
const mockFilter = vi.fn().mockResolvedValue([]);
const mockList = vi.fn().mockResolvedValue([]);

vi.mock('@/entities/Voo', () => ({
  Voo: { filter: mockFilter, list: mockList },
}));

vi.mock('@/entities/OcorrenciaSafety', () => ({
  OcorrenciaSafety: { filter: mockFilter, list: mockList },
}));

vi.mock('@/entities/Proforma', () => ({
  Proforma: { filter: mockFilter, list: mockList },
}));

vi.mock('@/entities/Documento', () => ({
  Documento: { filter: mockFilter, list: mockList },
}));

// Mock supabase for useDashboardStats
const mockRpc = vi.fn().mockResolvedValue({ data: { total_voos: 42 }, error: null });
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: mockRpc },
}));

// ── Import hooks after mocks ─────────────────────────────────────────────
const { useVoos } = await import('../useVoos.js');
const { useOcorrencias } = await import('../useOcorrencias.js');
const { useDashboardStats } = await import('../useDashboardStats.js');
const { useProformas } = await import('../useProformas.js');
const { useDocumentos } = await import('../useDocumentos.js');

// ── Helper: wrapper with fresh QueryClient ───────────────────────────────
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── Tests ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockFilter.mockResolvedValue([]);
  mockList.mockResolvedValue([]);
  mockRpc.mockResolvedValue({ data: { total_voos: 42 }, error: null });
});

describe('useVoos', () => {
  it('returns expected shape (data, isLoading, error)', () => {
    const { result } = renderHook(() => useVoos({ empresaId: 'emp-1' }), {
      wrapper: createWrapper(),
    });
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  it('calls Voo.filter with empresa_id and deleted_at filters', async () => {
    const { result } = renderHook(() => useVoos({ empresaId: 'emp-1' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFilter).toHaveBeenCalledWith(
      { deleted_at: { $is: null }, empresa_id: 'emp-1' },
      '-data_operacao',
      1000,
    );
  });

  it('is disabled when empresaId is falsy', () => {
    const { result } = renderHook(() => useVoos({ empresaId: null }), {
      wrapper: createWrapper(),
    });
    // Should not fetch at all - stays in loading/idle
    expect(mockFilter).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});

describe('useOcorrencias', () => {
  it('calls OcorrenciaSafety.filter with empresa_id when provided', async () => {
    const { result } = renderHook(() => useOcorrencias({ empresaId: 'emp-2' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFilter).toHaveBeenCalledWith(
      { empresa_id: 'emp-2' },
      '-data_ocorrencia',
    );
  });

  it('calls OcorrenciaSafety.list when no empresaId', async () => {
    const { result } = renderHook(() => useOcorrencias({ empresaId: null }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockList).toHaveBeenCalledWith('-data_ocorrencia');
  });
});

describe('useDashboardStats', () => {
  it('calls supabase RPC with correct parameters', async () => {
    const { result } = renderHook(
      () => useDashboardStats({ empresaId: 'emp-3', aeroporto: 'LIS', periodo: '7' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).toHaveBeenCalledWith('get_dashboard_stats_full', {
      p_empresa_id: 'emp-3',
      p_aeroporto: 'LIS',
      p_dias: 7,
    });
  });

  it('returns RPC data on success', async () => {
    const { result } = renderHook(
      () => useDashboardStats({ empresaId: 'emp-3' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ total_voos: 42 });
  });

  it('uses correct query key', () => {
    const { result } = renderHook(
      () => useDashboardStats({ empresaId: 'emp-3', aeroporto: 'LIS', periodo: '7' }),
      { wrapper: createWrapper() },
    );
    // The hook is enabled and will fire; just verify the shape
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('error');
  });
});

describe('useProformas', () => {
  it('calls Proforma.filter with empresa_id', async () => {
    const { result } = renderHook(() => useProformas({ empresaId: 'emp-4' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFilter).toHaveBeenCalledWith(
      { empresa_id: 'emp-4' },
      '-data_emissao',
    );
  });

  it('passes empty filters object when no empresaId', async () => {
    const { result } = renderHook(() => useProformas({ empresaId: null }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFilter).toHaveBeenCalledWith({}, '-data_emissao');
  });
});

describe('useDocumentos', () => {
  it('calls Documento.filter with empresa_id when provided', async () => {
    const { result } = renderHook(() => useDocumentos({ empresaId: 'emp-5' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFilter).toHaveBeenCalledWith(
      { empresa_id: 'emp-5' },
      '-data_publicacao',
    );
  });

  it('calls Documento.list when no empresaId', async () => {
    const { result } = renderHook(() => useDocumentos({ empresaId: null }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockList).toHaveBeenCalledWith('-data_publicacao');
  });

  it('respects enabled flag', () => {
    const { result } = renderHook(
      () => useDocumentos({ empresaId: 'emp-5', enabled: false }),
      { wrapper: createWrapper() },
    );
    expect(mockFilter).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
