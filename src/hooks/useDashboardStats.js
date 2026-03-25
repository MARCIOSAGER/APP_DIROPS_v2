import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/functions/getDashboardStats';

const STATS_STALE_TIME = 1000 * 60 * 5; // 5 min — stats don't need instant refresh
const GC_TIME = 1000 * 60 * 15; // 15 min

/**
 * useDashboardStats({ empresaId, aeroporto, periodo })
 *
 * queryKey: ['dashboard', empresaId, aeroporto, periodo]
 * staleTime: 5 min
 * gcTime: 15 min
 *
 * Returns the full getDashboardStats response object so callers can access:
 *   - result.data.data — current period stats
 *   - result.data.previousData — previous period stats
 *
 * Enabled when empresaId is set OR when aeroporto === 'todos' (superadmin all-airports view).
 */
export function useDashboardStats({ empresaId, aeroporto, periodo } = {}) {
  return useQuery({
    queryKey: ['dashboard', empresaId, aeroporto, periodo],
    queryFn: () => getDashboardStats({ aeroporto, periodo, empresaId }),
    staleTime: STATS_STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    enabled: !!empresaId || aeroporto === 'todos',
  });
}
