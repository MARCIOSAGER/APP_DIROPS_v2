import { useQuery } from '@tanstack/react-query';
import { RegistoGRF } from '@/entities/RegistoGRF';

export function useRegistosGRF({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['registos-grf', empresaId],
    queryFn: () => RegistoGRF.list('-mes', 100),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
