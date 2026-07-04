import { useQuery } from '@tanstack/react-query';
import { OrdemServico } from '@/entities/OrdemServico';
import { SolicitacaoServico } from '@/entities/SolicitacaoServico';

export function useOrdensServico({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['ordens-servico', empresaId],
    queryFn: async () => {
      const empFilters = empresaId ? { empresa_id: empresaId } : {};
      const [ordensData, ssData] = await Promise.all([
        empresaId ? OrdemServico.filter(empFilters, '-data_abertura') : OrdemServico.list('-data_abertura'),
        empresaId ? SolicitacaoServico.filter(empFilters, '-created_date') : SolicitacaoServico.list('-created_date'),
      ]);
      // Tickets de suporte agora vivem em ticket_suporte (tabela dedicada);
      // excluir tipo='suporte' para não poluir a lista de Manutenção.
      return { ordensData: (ordensData || []).filter(o => o.tipo !== 'suporte'), ssData };
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
