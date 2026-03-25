import { useQuery } from '@tanstack/react-query';
import { Voo } from '@/entities/Voo';

const GC_TIME = 1000 * 60 * 15; // 15 min

/**
 * useVoos({ empresaId, enabled })
 *
 * queryKey: ['voos', empresaId]
 * staleTime: 0 — operational data, user expects immediate refresh
 * gcTime: 15 min
 *
 * Returns { data: Voo[], isLoading, error, ... }
 */
export function useVoos({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['voos', empresaId],
    queryFn: () => {
      const vooFilters = { deleted_at: { $is: null } };
      if (empresaId) vooFilters.empresa_id = empresaId;
      return Voo.filter(vooFilters, '-data_operacao', 1000);
    },
    staleTime: 0,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    enabled: !!empresaId && enabled,
  });
}
