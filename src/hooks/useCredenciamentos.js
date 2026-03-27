import { useQuery } from '@tanstack/react-query';
import { Credenciamento } from '@/entities/Credenciamento';

export function useCredenciamentos({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['credenciamentos', empresaId],
    queryFn: () => {
      return empresaId
        ? Credenciamento.filter({ empresa_solicitante_id: empresaId }, '-data_solicitacao')
        : Credenciamento.list('-data_solicitacao');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
