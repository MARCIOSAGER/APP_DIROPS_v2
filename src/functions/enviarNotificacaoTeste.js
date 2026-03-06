// Stub: Send test notification - requires email/WhatsApp integration
export default async function enviarNotificacaoTeste(params) {
  console.warn('[enviarNotificacaoTeste] Funcao ainda nao implementada como Edge Function. Params:', params);
  return { success: false, message: 'Envio de notificacao de teste nao disponivel. Configure a Edge Function no Supabase.' };
}
