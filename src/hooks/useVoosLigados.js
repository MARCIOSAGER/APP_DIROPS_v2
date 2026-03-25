import { useQuery } from '@tanstack/react-query';
import { VooLigado } from '@/entities/VooLigado';

export function useVoosLigados({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['voos-ligados', empresaId],
    queryFn: () => {
      const vlFilters = empresaId ? { empresa_id: empresaId } : {};
      return VooLigado.filter(vlFilters, '-created_date');
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    enabled: !!empresaId && enabled,
  });
}
