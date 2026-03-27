import { useQuery } from '@tanstack/react-query';
import { MedicaoKPI } from '@/entities/MedicaoKPI';

/**
 * Fetches MedicaoKPI (primary), scoped by empresa_id.
 */
export function useMedicoesKPI({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['medicoesKPI', empresaId],
    queryFn: () => {
      return empresaId
        ? MedicaoKPI.filter({ empresa_id: empresaId }, '-data_medicao')
        : MedicaoKPI.list('-data_medicao');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
