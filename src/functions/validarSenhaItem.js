import { supabase } from '@/lib/supabaseClient';
import { hashPassword } from '@/lib/hashPassword';

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

  // Hash the user input and compare against the stored hash
  const inputHash = await hashPassword(senha);
  const valido = inputHash === item.senha_hash;
  return { valido, message: valido ? 'Senha válida' : 'Senha incorreta' };
}
