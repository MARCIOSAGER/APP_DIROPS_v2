import { supabase } from '@/lib/supabaseClient';

export async function enviarTicketSuporte({ assunto, categoria, mensagem }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single();

  // Generate ticket number
  const { count } = await supabase.from('ordem_servico').select('id', { count: 'exact', head: true });
  const ticketNum = `TKT-${String((count || 0) + 1).padStart(4, '0')}`;

  const { data: ticket, error } = await supabase.from('ordem_servico').insert({
    titulo: assunto,
    tipo: 'suporte',
    categoria: categoria || 'outro',
    descricao: mensagem,
    status: 'Aberta',
    prioridade: 'Media',
    numero_protocolo: ticketNum,
    solicitante_email: profile?.email || user.email,
    solicitante_nome: profile?.full_name || user.email,
    created_date: new Date().toISOString(),
  }).select().single();

  if (error) throw error;

  // Email notification would go here (requires email service)
  console.warn('[enviarTicketSuporte] Email notification skipped - email service not configured');

  return { sucesso: true, numero_ticket: ticketNum, ticket_id: ticket.id };
}
