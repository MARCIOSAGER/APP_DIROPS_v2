// ============================================================
// Relatório Executivo da Operação — wrapper BROWSER do one-pager.
// Chama rpc_relatorio_operacional (período atual + anterior), busca a logo da
// empresa e renderiza o PDF nativo (core partilhado). Usado pelo botão
// "PDF Executivo" na página de Relatórios de Voos.
// ============================================================
import { createPdfDoc, fetchEmpresaLogo } from '@/lib/pdfTemplate';
import { supabase } from '@/lib/supabaseClient';
import { buildExecutivoPayload, renderExecutivoDoc, periodoAnterior, periodoLabel } from '@/lib/operacionalOnePagerCore';

async function chamarRpc(inicio, fim, aeroporto) {
  const params = { p_inicio: inicio, p_fim: fim };
  if (aeroporto) params.p_aeroporto = aeroporto;
  const { data, error } = await supabase.rpc('rpc_relatorio_operacional', params);
  if (error) throw new Error(error.message || 'Falha ao carregar dados operacionais.');
  return Array.isArray(data) ? (data[0] || {}) : (data || {});
}

// Monta o payload do one-pager (2 chamadas à RPC + logo). Reutilizável.
export async function buildOperacionalPayload({ inicio, fim, aeroporto = '', empresaId, aeroportoLabel = '' }) {
  const prev = periodoAnterior(inicio, fim);
  const [atual, anterior, logoDataUrl] = await Promise.all([
    chamarRpc(inicio, fim, aeroporto || undefined),
    chamarRpc(prev.inicio, prev.fim, aeroporto || undefined),
    fetchEmpresaLogo(empresaId).catch(() => null),
  ]);
  return buildExecutivoPayload(atual, anterior, {
    periodoLabel: periodoLabel(inicio, fim),
    emitido: new Date().toLocaleDateString('pt-AO'),
    aeroportoLabel,
    comparadoCom: prev.label,
    logoDataUrl,
  });
}

async function renderDoc(payload) {
  const doc = await createPdfDoc({ orientation: 'landscape', unit: 'pt' });
  renderExecutivoDoc(doc, payload);
  return doc;
}

// Gera e descarrega o PDF. Devolve o payload (útil p/ testes/UI).
export async function exportOperacionalOnePagerPDF(opts) {
  const payload = await buildOperacionalPayload(opts);
  const doc = await renderDoc(payload);
  doc.save(opts.fileName || `Relatorio_Executivo_Operacao_${opts.fim}.pdf`);
  return payload;
}

// Igual, mas devolve o PDF em base64 puro (para anexar em email a partir do browser).
export async function renderOperacionalOnePagerBase64(opts) {
  const payload = await buildOperacionalPayload(opts);
  const doc = await renderDoc(payload);
  const uri = doc.output('datauristring');
  return uri.substring(uri.indexOf('base64,') + 7);
}
