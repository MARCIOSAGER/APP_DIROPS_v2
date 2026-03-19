// Dashboard stats computed server-side via Edge Function
// Replaces the old client-side fetchAllRows approach (which generated 50+ requests)

export async function getDashboardStats({ aeroporto, periodo, empresaId }) {
  const { supabase } = await import('@/lib/supabaseClient');

  const { data, error } = await supabase.functions.invoke('get-dashboard-stats', {
    body: { aeroporto, periodo, empresaId },
  });

  if (error) throw error;
  return data;
}
