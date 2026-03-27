import { useQuery } from '@tanstack/react-query';
import { Inspecao } from '@/entities/Inspecao';

export function useInspecoes({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['inspecoes', empresaId],
    queryFn: () => {
      return empresaId
        ? Inspecao.filter({ empresa_id: empresaId }, '-data_inspecao')
        : Inspecao.list('-data_inspecao');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
