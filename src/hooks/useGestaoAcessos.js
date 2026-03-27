import { useQuery } from '@tanstack/react-query';
import { SolicitacaoAcesso } from '@/entities/SolicitacaoAcesso';
import { User as UserEntity } from '@/entities/User';

/**
 * Fetches SolicitacaoAcesso (primary) + Users, scoped by empresa_id.
 * Returns { solicitacoes, users } inside data.
 */
export function useGestaoAcessos({ empresaId, currentUser, enabled = true } = {}) {
  return useQuery({
    queryKey: ['gestaoAcessos', empresaId, currentUser?.empresa_id],
    queryFn: async () => {
      const solicitacaoPromise = empresaId
        ? SolicitacaoAcesso.filter({ empresa_solicitante_id: empresaId }, '-created_date')
        : SolicitacaoAcesso.list('-created_date');

      const empId = empresaId || currentUser?.empresa_id;
      const [solicitacoesData, usersData] = await Promise.all([
        solicitacaoPromise,
        empId ? UserEntity.filter({ empresa_id: empId }) : UserEntity.list(),
      ]);

      let validUsers = (usersData || []).filter(u => u && u.id && u.email);
      const filteredSolicitacoes = solicitacoesData || [];

      // Filter users by empresa when CompanyView is active
      if (empresaId) {
        const solicitacaoUserIds = new Set(filteredSolicitacoes.map(s => s.user_id).filter(Boolean));
        const solicitacaoEmails = new Set(filteredSolicitacoes.map(s => s.email?.toLowerCase()).filter(Boolean));
        validUsers = validUsers.filter(u =>
          u.empresa_id === empresaId ||
          solicitacaoUserIds.has(u.id) ||
          solicitacaoEmails.has(u.email?.toLowerCase())
        );
      }

      return { solicitacoes: filteredSolicitacoes, users: validUsers };
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
