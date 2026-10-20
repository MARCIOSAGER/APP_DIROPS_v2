// ============================================================
// Geração do Relatório Executivo (one-pager) da Operação no Node (headless).
// Reutiliza o MESMO core de renderização do browser (jsPDF puro) — garante que
// o PDF anexado aos emails automáticos é idêntico ao do botão "PDF Executivo".
// Recebe os dados já agregados da RPC (atual + período anterior) e devolve o
// PDF como base64, pronto para anexar.
// ============================================================
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildExecutivoPayload, renderExecutivoDoc, periodoLabel } from '../../src/lib/operacionalOnePagerCore.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
let LOGO = null;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }

// per={inicio,fim}; atual/anterior=saída de rpc_relatorio_operacional; meta={comparadoCom, aeroportoLabel, emitido?}
export async function gerarExecutivoPdf(per, atual, anterior, meta = {}) {
  const hoje = new Date();
  const emitido = meta.emitido || `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
  const payload = buildExecutivoPayload(atual || {}, anterior || {}, {
    periodoLabel: periodoLabel(per.inicio, per.fim),
    emitido,
    comparadoCom: meta.comparadoCom || 'vs período anterior',
    aeroportoLabel: meta.aeroportoLabel || '',
    logoDataUrl: LOGO,
  });
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  renderExecutivoDoc(doc, payload);
  return Buffer.from(doc.output('arraybuffer')).toString('base64');
}
