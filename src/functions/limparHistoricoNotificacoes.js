import { supabase } from '@/lib/supabaseClient';

// Clean notification history - runs client-side with Supabase
export default async function limparHistoricoNotificacoes(params) {
  try {
    const { error } = await supabase
      .from('historico_notificacao')
      .delete()
      .not('id', 'is', null);

    if (error) throw error;
    return { success: true, message: 'Historico de notificacoes limpo com sucesso.' };
  } catch (err) {
    console.error('[limparHistoricoNotificacoes] Erro:', err);
    return { success: false, message: 'Erro ao limpar historico: ' + err.message };
  }
}
