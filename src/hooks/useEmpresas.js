import { useQuery } from '@tanstack/react-query';
import { Empresa } from '@/entities/Empresa';

export function useEmpresas({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['empresas'],
    queryFn: () => Empresa.list(),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
