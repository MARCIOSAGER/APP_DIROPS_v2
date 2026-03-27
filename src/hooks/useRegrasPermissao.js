import { useQuery } from '@tanstack/react-query';
import { RegraPermissao } from '@/entities/RegraPermissao';

export function useRegrasPermissao({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['regras-permissao'],
    queryFn: () => RegraPermissao.list(),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
