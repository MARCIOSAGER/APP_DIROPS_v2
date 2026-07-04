import { supabase } from '@/lib/supabaseClient';

/**
 * Gera um relatório operacional sob demanda usando o MESMO motor dos relatórios
 * automáticos (endpoint /functions/gerar-relatorio no dirops-functions).
 *
 * @param {Object} p
 * @param {'diario'|'semanal'|'mensal'|'kpis'} p.tipo
 * @param {string} [p.inicio]  data ISO YYYY-MM-DD
 * @param {string} [p.fim]     data ISO YYYY-MM-DD
 * @param {string} [p.aeroporto] código ICAO (ex.: 'FNLU') ou vazio = todos
 * @param {'emit'|'email'} [p.action='emit']  emit = devolve {html, anexos}; email = envia
 * @param {string[]} [p.to]    destinatários (só @sga.co.ao) — para action 'email'
 * @returns {Promise<Object>} action 'emit': { tipo, periodo, aeroporto, assunto, html, anexos }
 */
export async function gerarRelatorio(params) {
  const { data, error } = await supabase.functions.invoke('gerar-relatorio', { body: params });
  if (error) {
    // Tenta extrair a mensagem do corpo da resposta do servidor.
    let msg = error.message || 'Falha ao gerar o relatório';
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

export default gerarRelatorio;
