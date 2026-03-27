import { useQuery } from '@tanstack/react-query';
import { CobrancaServico } from '@/entities/CobrancaServico';

export function useCobrancasServico({ empresaId, query, enabled = true } = {}) {
  return useQuery({
    queryKey: ['cobrancas-servico', empresaId, query],
    queryFn: () => CobrancaServico.filter(query || {}, '-data_servico'),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
