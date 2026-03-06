// Stub: WhatsApp Opt-In - requires Edge Function with WhatsApp API integration
export default async function enviarOptInWhatsApp(params) {
  console.warn('[enviarOptInWhatsApp] Funcao ainda nao implementada como Edge Function. Params:', params);
  return { success: false, message: 'Funcao de WhatsApp Opt-In nao disponivel. Configure a Edge Function no Supabase.' };
}
