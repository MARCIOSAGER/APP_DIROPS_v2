import { useQuery } from '@tanstack/react-query';
import { VooLigado } from '@/entities/VooLigado';

const GC_TIME = 1000 * 60 * 15; // 15 min

/**
 * useVoosLigados({ empresaId, enabled })
 *
 * queryKey: ['voos-ligados', empresaId]
 * staleTime: 0 — operational data, user expects immediate refresh
 * gcTime: 15 min
 *
 * Returns { data: VooLigado[], isLoading, error, ... }
 */
export function useVoosLigados({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['voos-ligados', empresaId],
    queryFn: () => {
      const vlFilters = empresaId ? { empresa_id: empresaId } : {};
      return VooLigado.filter(vlFilters, '-created_date');
    },
    staleTime: 0,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    enabled: !!empresaId && enabled,
  });
}
