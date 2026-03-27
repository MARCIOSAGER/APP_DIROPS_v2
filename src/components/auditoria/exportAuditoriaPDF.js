import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { createPdfDoc, addHeader, addFooter, addSectionTitle, addKeyValuePairs, checkPageBreak, loadImageAsBase64, PDF } from '@/lib/pdfTemplate';
import { RespostaAuditoria } from '@/entities/RespostaAuditoria';
import { TipoAuditoria } from '@/entities/TipoAuditoria';
import { ItemAuditoria } from '@/entities/ItemAuditoria';
import { getEmpresaLogoByUser } from '@/components/lib/userUtils';

const CATEGORIAS_CONFIG = {
  seguranca_operacional: { label: 'Seguranca Operacional' },
  seguranca_avsec: { label: 'Seguranca AVSEC' },
  resposta_emergencia: { label: 'Resposta a Emergencia' },
  infraestrutura: { label: 'Infraestrutura' },
  operacoes: { label: 'Operacoes' }
};

/**
 * Export an auditoria processo to PDF.
 * Pure utility function - no React state dependencies.
 */
export async function exportAuditoriaPDF({ processo, aeroportos, currentUser, empresas }) {
  let logoBase64 = null;

  try {
    const logoUrl = getEmpresaLogoByUser(currentUser, empresas);
    logoBase64 = await loadImageAsBase64(logoUrl);
  } catch (logoError) {
    console.debug('Logo nao carregado:', logoError);
  }

  const [respostasData, tipoData] = await Promise.all([
    RespostaAuditoria.filter({ processo_auditoria_id: processo.id }),
    TipoAuditoria.filter({ id: processo.tipo_auditoria_id })
  ]);

  const tipo = tipoData[0];
  const aeroporto = aeroportos.find((a) => a.codigo_icao === processo.aeroporto_id);

  const itensData = await ItemAuditoria.filter({ tipo_auditoria_id: processo.tipo_auditoria_id });

  const doc = await createPdfDoc({ orientation: 'portrait' });

  const m = PDF.margin;
  const pageWidth = PDF.page.portrait.w;
  const contentWidth = pageWidth - m.left - m.right;

  const headerOpts = {
    title: 'Relatorio de Auditoria Interna',
    logoBase64,
    date: new Date().toLocaleDateString('pt-AO'),
    meta: [
      `${tipo?.nome || 'N/A'} | ${aeroporto?.codigo_icao || 'N/A'}`,
      `Auditor: ${processo.auditor_responsavel || 'N/A'}`
    ]
  };

  let yPosition = addHeader(doc, headerOpts);

  // --- Informacoes da Auditoria ---
  yPosition = checkPageBreak(doc, yPosition, 30, headerOpts);
  yPosition = addSectionTitle(doc, yPosition, 'Informacoes da Auditoria');

  yPosition = addKeyValuePairs(doc, yPosition, [
    { label: 'Aeroporto', value: aeroporto?.nome || 'N/A' },
    { label: 'Data', value: processo.data_auditoria ? format(new Date(processo.data_auditoria), 'dd/MM/yyyy', { locale: pt }) : 'N/A' },
    { label: 'Tipo', value: tipo?.nome || 'N/A' },
    { label: 'Auditor', value: processo.auditor_responsavel || 'N/A' },
    { label: 'Categoria', value: CATEGORIAS_CONFIG[tipo?.categoria]?.label || 'N/A' },
    { label: 'Status', value: processo.status || 'N/A' },
  ], { twoColumns: true });

  yPosition += 4;

  // --- Resumo Executivo ---
  yPosition = checkPageBreak(doc, yPosition, 35, headerOpts);
  yPosition = addSectionTitle(doc, yPosition, 'Resumo Executivo');

  yPosition = addKeyValuePairs(doc, yPosition, [
    { label: 'Total de Itens', value: String(processo.total_itens || 0) },
    { label: 'Conformes', value: String(processo.itens_conformes || 0) },
    { label: 'Nao Conformes', value: String(processo.itens_nao_conformes || 0) },
    { label: 'Conformidade', value: `${(processo.percentual_conformidade || 0).toFixed(1)}%` },
  ], { twoColumns: true });

  yPosition += 4;

  // --- Nao Conformidades ---
  const naoConformidades = respostasData.filter((r) => r.situacao_encontrada === 'NC');
  if (naoConformidades.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 25, headerOpts);
    yPosition = addSectionTitle(doc, yPosition, 'Nao Conformidades Identificadas');

    const addTextWithPageBreak = (text, x, y, maxWidth, lineHeight = 5) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      let currentY = y;
      for (let i = 0; i < lines.length; i++) {
        currentY = checkPageBreak(doc, currentY, lineHeight, headerOpts);
        doc.text(lines[i], x, currentY);
        currentY += lineHeight;
      }
      return currentY;
    };

    for (let index = 0; index < naoConformidades.length; index++) {
      const nc = naoConformidades[index];
      const item = itensData.find((i) => i.id === nc.item_auditoria_id);

      yPosition = checkPageBreak(doc, yPosition, 40, headerOpts);

      doc.setFontSize(PDF.font.subtitle);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF.colors.danger);

      const itemTitle = `${index + 1}. Item ${item?.numero || 'N/A'}: ${item?.item || 'N/A'}`;
      yPosition = addTextWithPageBreak(itemTitle, m.left, yPosition, contentWidth, 6);
      yPosition += 3;

      doc.setTextColor(...PDF.colors.dark);

      doc.setFontSize(PDF.font.body);
      doc.setFont('helvetica', 'normal');
      yPosition = checkPageBreak(doc, yPosition, 7, headerOpts);
      doc.text(`Referencia: ${item?.referencia_norma || 'N/A'}`, m.left, yPosition);
      yPosition += 8;

      if (item?.exemplo_situacao) {
        yPosition = checkPageBreak(doc, yPosition, 15, headerOpts);
        doc.setFontSize(PDF.font.body);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF.colors.muted);
        doc.text('Orientacoes:', m.left, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...PDF.colors.muted);
        yPosition = addTextWithPageBreak(item.exemplo_situacao, m.left + 5, yPosition, contentWidth - 10, 5);
        yPosition += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF.colors.dark);
      }

      if (nc.observacao) {
        yPosition = checkPageBreak(doc, yPosition, 15, headerOpts);
        doc.setFontSize(PDF.font.body);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF.colors.dark);
        doc.text('Observacao:', m.left, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'normal');
        yPosition = addTextWithPageBreak(nc.observacao, m.left + 5, yPosition, contentWidth - 10, 5);
        yPosition += 6;
      }

      if (nc.acao_corretiva_recomendada) {
        yPosition = checkPageBreak(doc, yPosition, 15, headerOpts);
        doc.setFontSize(PDF.font.body);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF.colors.dark);
        doc.text('Acao Corretiva Recomendada:', m.left, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'normal');
        yPosition = addTextWithPageBreak(nc.acao_corretiva_recomendada, m.left + 5, yPosition, contentWidth - 10, 5);
        yPosition += 6;
      }

      if (nc.evidencias && nc.evidencias.length > 0) {
        yPosition = checkPageBreak(doc, yPosition, 12, headerOpts);
        doc.setFontSize(PDF.font.body);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF.colors.dark);
        doc.text('Evidencias:', m.left, yPosition);
        yPosition += 6;

        for (let evidIndex = 0; evidIndex < nc.evidencias.length; evidIndex++) {
          const evidencia = nc.evidencias[evidIndex];

          try {
            if (evidencia.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              yPosition = checkPageBreak(doc, yPosition, 55, headerOpts);

              try {
                const imgDataUrl = await loadImageAsBase64(evidencia);
                const imgWidth = 60;
                const imgHeight = 45;

                doc.addImage(imgDataUrl, 'PNG', m.left + 5, yPosition, imgWidth, imgHeight);
                doc.setFontSize(PDF.font.small);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...PDF.colors.muted);
                doc.text(`Evidencia ${evidIndex + 1}`, m.left + 5, yPosition + imgHeight + 4);
                yPosition += 52;
              } catch (imgError) {
                console.error('Error loading image for PDF:', imgError);
                yPosition = checkPageBreak(doc, yPosition, 6, headerOpts);
                doc.setFontSize(PDF.font.body);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...PDF.colors.dark);
                doc.text(`Evidencia ${evidIndex + 1}: [Imagem anexada - ${evidencia.substring(evidencia.lastIndexOf('/') + 1)}]`, m.left + 5, yPosition);
                yPosition += 6;
              }
            } else {
              yPosition = checkPageBreak(doc, yPosition, 6, headerOpts);
              doc.setFontSize(PDF.font.body);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(...PDF.colors.dark);
              doc.text(`Evidencia ${evidIndex + 1}: ${evidencia.substring(evidencia.lastIndexOf('/') + 1)}`, m.left + 5, yPosition);
              yPosition += 6;
            }
          } catch (error) {
            console.error(`Error processing evidence ${evidIndex + 1}:`, error);
            yPosition = checkPageBreak(doc, yPosition, 6, headerOpts);
            doc.setFontSize(PDF.font.body);
            doc.setTextColor(...PDF.colors.dark);
            doc.text(`Evidencia ${evidIndex + 1}: [Arquivo anexado]`, m.left + 5, yPosition);
            yPosition += 6;
          }
        }
        yPosition += 3;
      }

      yPosition += 10;
    }
  }

  addFooter(doc, { generatedBy: processo.auditor_responsavel || undefined });

  doc.save(`relatorio_auditoria_${processo.auditor_responsavel?.replace(/\s/g, '_') || 'auditoria'}_${new Date().toISOString().split('T')[0]}.pdf`);
}
