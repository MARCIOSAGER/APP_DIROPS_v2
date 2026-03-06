// Stub: Send WhatsApp message via Z-API - requires Edge Function
export default async function sendWhatsAppMessageZAPI(params) {
  console.warn('[sendWhatsAppMessageZAPI] Funcao ainda nao implementada como Edge Function. Params:', params);
  return { success: false, message: 'Envio de WhatsApp via Z-API nao disponivel. Configure a Edge Function no Supabase.' };
}
