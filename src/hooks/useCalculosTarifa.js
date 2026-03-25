import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

const GC_TIME = 1000 * 60 * 15; // 15 min
const PAGE = 500;

/**
 * fetchCalculoMap(empresaId)
 *
 * Paginated fetch of calculo_tarifa rows for a given empresa.
 * Returns a flat array of all rows (handles > 500 rows via pagination).
 */
export async function fetchCalculoMap(empresaId) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('calculo_tarifa')
      .select('voo_id,voo_ligado_id,total_tarifa_usd,total_tarifa,tipo_tarifa,taxa_cambio_usd_aoa')
      .eq('empresa_id', empresaId)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Calculo map error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * useCalculosTarifa({ empresaId, enabled })
 *
 * queryKey: ['calculos-tarifa', empresaId]
 * staleTime: 0 — operational data, user expects immediate refresh
 * gcTime: 15 min
 *
 * Returns { data: CalcRow[], isLoading, error, ... }
 */
export function useCalculosTarifa({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['calculos-tarifa', empresaId],
    queryFn: () => fetchCalculoMap(empresaId),
    staleTime: 0,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    enabled: !!empresaId && enabled,
  });
}
