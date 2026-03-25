import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export function useDashboardStats({ empresaId, aeroporto = 'todos', periodo = '30' } = {}) {
  return useQuery({
    queryKey: ['dashboard', empresaId, aeroporto, periodo],
    queryFn: async () => {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('get_dashboard_stats_full', {
        p_empresa_id: empresaId || null,
        p_aeroporto: aeroporto || 'todos',
        p_dias: parseInt(periodo) || 30,
      });
      if (rpcError) throw rpcError;
      return rpcResult;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    enabled: true,
  });
}
