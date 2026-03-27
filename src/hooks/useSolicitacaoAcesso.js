import { useQuery } from '@tanstack/react-query';
import { SolicitacaoAcesso } from '@/entities/SolicitacaoAcesso';

export function useSolicitacaoAcesso({ userId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['solicitacao_acesso', userId],
    queryFn: async () => {
      const solicitacoes = await SolicitacaoAcesso.filter({
        user_id: userId,
        status: 'pendente'
      }, '-created_date', 1);

      return solicitacoes && solicitacoes.length > 0 ? solicitacoes[0] : null;
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: enabled && !!userId,
    retry: 2,
    retryDelay: (attemptIndex) => (attemptIndex + 1) * 2000,
  });
}
