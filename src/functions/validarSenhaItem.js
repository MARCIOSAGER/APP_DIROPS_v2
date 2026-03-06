import { supabase } from '@/lib/supabaseClient';

export async function validarSenhaItem({ item_id, tipo, senha }) {
  if (!item_id || !tipo || !senha) {
    return { valido: false, message: 'Parâmetros inválidos' };
  }

  const table = tipo === 'pasta' ? 'pasta' : 'documento';
  const { data: item, error } = await supabase
    .from(table)
    .select('senha_hash')
    .eq('id', item_id)
    .single();

  if (error || !item) return { valido: false, message: 'Item não encontrado' };
  if (!item.senha_hash) return { valido: true, message: 'Item não protegido por senha' };

  // bcrypt not available client-side - simple comparison fallback
  // TODO: migrate to Supabase Edge Function with bcrypt for production
  const valido = item.senha_hash === senha;
  return { valido, message: valido ? 'Senha válida' : 'Senha incorreta' };
}
