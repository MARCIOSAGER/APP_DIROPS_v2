// Traduz mensagens de erro do GoTrue/Supabase (inglês) para português. Partilhado pelo login do DIROPS e pelo portal da Universidade.
export function traduzErroAuth(msg) {
  if (!msg) return 'Ocorreu um erro. Tente novamente.';
  const m = String(msg).toLowerCase();
  if (m.includes('signups not allowed') || m.includes('signup is disabled') || m.includes('signup disabled')) return 'O auto-cadastro está desativado nesta instância. Contacte o administrador para criar o seu acesso.';
  if (m.includes('invalid login credentials')) return 'Email ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este email já está registado.';
  if (m.includes('email not confirmed')) return 'Email ainda não confirmado. Verifique a sua caixa de entrada.';
  if (m.includes('user is banned') || m.includes('banned')) return 'Este acesso foi suspenso. Contacte o administrador.';
  if (m.includes('password should be at least') || m.includes('password is too short')) return 'A senha é demasiado curta (mínimo 8 caracteres).';
  if (m.includes('rate limit') || m.includes('too many requests')) return 'Demasiadas tentativas. Aguarde um momento e tente novamente.';
  if (m.includes('user not found')) return 'Utilizador não encontrado.';
  if (m.includes('relay') || m.includes('non-accepted domain') || m.includes('550')) return 'O servidor de email só aceita endereços internos (@sga.co.ao).';
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('fetch failed')) return 'Falha de ligação ao servidor. Verifique a rede e tente novamente.';
  return msg; // fallback: mostra a original
}
