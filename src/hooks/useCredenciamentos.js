import { useQuery } from '@tanstack/react-query';
import { Credenciamento } from '@/entities/Credenciamento';

/**
 * Fetches Credenciamento (primary).
 * - gestor_empresa: filter by empresa_solicitante_id
 * - internal: paginated list
 */
export function useCredenciamentos({ empresaId, isGestorEmpresa = false, page = 1, pageSize = 50, enabled = true } = {}) {
  return useQuery({
    queryKey: ['credenciamentos', empresaId, isGestorEmpresa, page, pageSize],
    queryFn: async () => {
      if (isGestorEmpresa && empresaId) {
        const data = await Credenciamento.filter({ empresa_solicitante_id: empresaId }, '-data_solicitacao');
        return { data: data || [], totalPages: 1, total: (data || []).length, page: 1 };
      }
      // Internal user: paginated
      return Credenciamento.paginate({ orderBy: '-data_solicitacao', page, pageSize });
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
