import { useQuery } from '@tanstack/react-query';
import { Voo } from '@/entities/Voo';

export function useVoos({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['voos', empresaId],
    queryFn: () => {
      const vooFilters = { deleted_at: { $is: null } };
      if (empresaId) vooFilters.empresa_id = empresaId;
      return Voo.filter(vooFilters, '-data_operacao', 1000);
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    enabled: !!empresaId && enabled,
  });
}
