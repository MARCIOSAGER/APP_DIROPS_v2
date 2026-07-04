import { useQuery } from '@tanstack/react-query';
import { VooLigado } from '@/entities/VooLigado';

export function useVoosLigados({ empresaId, enabled = true, limit = 2000 } = {}) {
  return useQuery({
    queryKey: ['voos-ligados', empresaId, limit],
    queryFn: () => {
      const vlFilters = empresaId ? { empresa_id: empresaId } : {};
      // Most recent 2000 by default — covers operational window without paging 15 times.
      return VooLigado.filter(vlFilters, '-created_date', limit);
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    enabled: enabled,
  });
}
