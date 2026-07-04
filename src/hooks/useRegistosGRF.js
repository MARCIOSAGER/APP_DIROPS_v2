import { useQuery } from '@tanstack/react-query';
import { RegistoGRF } from '@/entities/RegistoGRF';

export function useRegistosGRF({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['registos-grf', empresaId],
    // Teto elevado (era 100): 100 leituras/dia-aeroporto-pista era facilmente
    // ultrapassado, cortando a lista e o export silenciosamente.
    queryFn: () => RegistoGRF.list('-mes', 5000),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
