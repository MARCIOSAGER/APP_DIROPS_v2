import { useQuery } from '@tanstack/react-query';
import { Proforma } from '@/entities/Proforma';

export function useProformas({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['proformas', empresaId],
    queryFn: () => {
      const filters = {};
      if (empresaId) filters.empresa_id = empresaId;
      return Proforma.filter(filters, '-data_emissao');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
