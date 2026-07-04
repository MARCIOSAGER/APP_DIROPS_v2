import { useQuery } from '@tanstack/react-query';
import { Voo } from '@/entities/Voo';

export function useVoos({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['voos', empresaId],
    queryFn: () => {
      const vooFilters = { deleted_at: { $is: null } };
      if (empresaId) vooFilters.empresa_id = empresaId;
      // PostgREST 14.12/Windows has ~1.5ms/row overhead. 1000 keeps load <2s.
      // Heavy aggregates use get_dashboard_stats_full RPC instead.
      return Voo.filter(vooFilters, '-data_operacao', 1000);
    },
    // 90s: as mutações (save/delete) já invalidam a query explicitamente, então
    // não é preciso considerar stale a cada render. Evita refetch de 1000 voos
    // (~2s de PostgREST) ao voltar a Operações/Home ou em re-renders de topo.
    staleTime: 1000 * 90,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    enabled: enabled,
  });
}
