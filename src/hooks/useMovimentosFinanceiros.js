import { useQuery } from '@tanstack/react-query';
import { MovimentoFinanceiro } from '@/entities/MovimentoFinanceiro';

export function useMovimentosFinanceiros({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['movimentos-financeiros', empresaId],
    queryFn: () => {
      const query = {};
      if (empresaId) query.empresa_id = empresaId;
      return MovimentoFinanceiro.filter(query, '-data');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
