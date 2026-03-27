import { useQuery } from '@tanstack/react-query';
import { ProcessoAuditoria } from '@/entities/ProcessoAuditoria';

/**
 * Fetches ProcessoAuditoria (primary), scoped by empresa_id.
 */
export function useProcessosAuditoria({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['processosAuditoria', empresaId],
    queryFn: () => {
      return empresaId
        ? ProcessoAuditoria.filter({ empresa_id: empresaId }, '-data_auditoria')
        : ProcessoAuditoria.list('-data_auditoria');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
