import { supabase } from '@/lib/supabaseClient';

/**
 * Log auth events to log_auditoria table
 * Uses direct supabase insert to avoid circular dependencies
 */
export async function logAuthEvent(acao, email, detalhes = '') {
  try {
    await supabase.from('log_auditoria').insert({
      usuario_email: email || 'desconhecido',
      entidade: 'auth',
      acao,
      modulo: 'Autenticação',
      detalhes,
      user_agent: navigator.userAgent,
      created_date: new Date().toISOString(),
    });
  } catch (err) {
    // Silent fail — audit logging should never break the app
    console.warn('[AuditLog] Failed to log:', err.message);
  }
}
