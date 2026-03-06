import { supabase } from '@/lib/supabaseClient';

export async function removerDuplicacoesTipoKPI({ ids_para_remover }) {
  if (!ids_para_remover?.length) throw new Error('Forneça IDs para remover');
  for (const id of ids_para_remover) {
    const { data } = await supabase.from('medicao_k_p_i').select('id').eq('tipo_kpi_id', id).limit(1);
    if (data?.length) throw new Error(`Tipo KPI ${id} tem medições associadas`);
  }
  for (const id of ids_para_remover) {
    const { error } = await supabase.from('tipo_k_p_i').delete().eq('id', id);
    if (error) throw error;
  }
  return { sucesso: true, quantidade_removida: ids_para_remover.length };
}
