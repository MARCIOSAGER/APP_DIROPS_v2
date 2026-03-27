import { useQuery } from '@tanstack/react-query';
import { Reclamacao } from '@/entities/Reclamacao';

export function useReclamacoes({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['reclamacoes', empresaId],
    queryFn: () => {
      const query = {};
      if (empresaId) query.empresa_id = empresaId;
      const hasFilters = Object.keys(query).length > 0;
      return hasFilters
        ? Reclamacao.filter(query, '-data_recebimento')
        : Reclamacao.list('-data_recebimento');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
