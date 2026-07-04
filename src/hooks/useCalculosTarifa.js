import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export async function fetchCalculoMap(empresaId, maxRecords = 5000) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (from < maxRecords) {
    const upper = Math.min(from + PAGE - 1, maxRecords - 1);
    let q = supabase
      .from('calculo_tarifa')
      .select('voo_id,voo_ligado_id,total_tarifa_usd,total_tarifa,tipo_tarifa,taxa_cambio_usd_aoa')
      .order('data_calculo', { ascending: false })
      .range(from, upper);
    if (empresaId) q = q.eq('empresa_id', empresaId);
    const { data, error } = await q;
    if (error) { console.error('Calculo map error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export function useCalculosTarifa({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['calculos-tarifa', empresaId],
    queryFn: () => fetchCalculoMap(empresaId),
    staleTime: 0,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    enabled: enabled,
  });
}
