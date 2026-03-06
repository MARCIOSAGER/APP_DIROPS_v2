import { supabase } from '@/lib/supabaseClient';

export async function submitCredenciamentoPublico(params) {
  const { empresa_solicitante_id, aeroporto_id, tipo_credencial, email_notificacao } = params;

  // Generate protocol number
  const year = new Date().getFullYear();
  const randomNum = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  const protocolo = `CR-${year}-${randomNum}`;

  const { data, error } = await supabase.from('credenciamento').insert({
    ...params,
    numero_protocolo: protocolo,
    status: 'Pendente',
    created_date: new Date().toISOString(),
  }).select().single();

  if (error) throw error;

  // Email notification would go here
  console.warn('[submitCredenciamentoPublico] Email notification skipped - email service not configured');

  return { success: true, protocolo };
}
