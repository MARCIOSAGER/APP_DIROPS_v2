import { useQuery } from '@tanstack/react-query';
import { OcorrenciaSafety } from '@/entities/OcorrenciaSafety';

export function useOcorrencias({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['ocorrencias', empresaId],
    queryFn: () => {
      return empresaId
        ? OcorrenciaSafety.filter({ empresa_id: empresaId }, '-data_ocorrencia')
        : OcorrenciaSafety.list('-data_ocorrencia');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
