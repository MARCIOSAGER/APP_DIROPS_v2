// Dashboard stats computed server-side via PostgreSQL RPC
// Uses get_dashboard_stats_full RPC — all aggregations done server-side, no row limits

export async function getDashboardStats({ aeroporto, periodo, empresaId }) {
  const { supabase } = await import('@/lib/supabaseClient');

  const { data, error } = await supabase.rpc('get_dashboard_stats_full', {
    p_empresa_id: empresaId || null,
    p_aeroporto: aeroporto || 'todos',
    p_dias: parseInt(periodo) || 30,
  });

  if (error) throw error;
  return data;
}
