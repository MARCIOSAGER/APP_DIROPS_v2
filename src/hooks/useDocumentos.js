import { useQuery } from '@tanstack/react-query';
import { Documento } from '@/entities/Documento';

export function useDocumentos({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['documentos', empresaId],
    queryFn: () => {
      return empresaId
        ? Documento.filter({ empresa_id: empresaId }, '-data_publicacao')
        : Documento.list('-data_publicacao');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
