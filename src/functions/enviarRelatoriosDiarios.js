// Stub: Send daily reports - requires email integration
export default async function enviarRelatoriosDiarios(params) {
  console.warn('[enviarRelatoriosDiarios] Funcao ainda nao implementada como Edge Function. Params:', params);
  return { success: false, message: 'Envio de relatorios diarios nao disponivel. Configure a Edge Function no Supabase.' };
}
