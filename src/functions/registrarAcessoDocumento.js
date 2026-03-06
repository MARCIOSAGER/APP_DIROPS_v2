import { supabase } from '@/lib/supabaseClient';

export async function registrarAcessoDocumento({ documento_id, tipo_acesso }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autorizado');

  const { data: profile } = await supabase
    .from('users')
    .select('email,full_name')
    .eq('auth_id', user.id)
    .single();

  const { error } = await supabase.from('log_acesso_documento').insert({
    documento_id,
    usuario_email: profile?.email || user.email,
    usuario_nome: profile?.full_name || user.email,
    tipo_acesso,
    ip_address: 'client',
    data_hora_acesso: new Date().toISOString(),
    created_date: new Date().toISOString(),
  });

  if (error) throw error;
  return { success: true, message: 'Acesso registrado' };
}
