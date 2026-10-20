// Exportação das listas da gestão do Portal de Documentos — CSV (Excel PT abre com «;»), Excel (.xlsx) e PDF com o
// logótipo SGA, cabeçalho em todas as páginas e rodapé com quem gerou. Fonte única: Relatórios, Codificação e as
// outras páginas de gestão usam estas funções e o botão <Exportar>.
import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { createPdfDoc, addHeader, addFooter, addTable, addSectionTitle, checkPageBreak, loadImageAsBase64, PDF } from '@/lib/pdfTemplate';
import { exportarExcel, nomeFicheiro } from '@/lib/formacaoExport';

export { exportarExcel, nomeFicheiro };

const csvCampo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function descarregarCsv(base, cabecalho, linhas) {
  const csv = '﻿' + [cabecalho, ...linhas].map(l => l.map(csvCampo).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nomeFicheiro(base)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// seccoes: [{ titulo?, sub?, colunas: [{label,width}], linhas: [[...]], vazio? }]
export async function pdfDocumentos({ base, titulo, subtitulo, meta = [], seccoes = [], paisagem = true, geradoPor }) {
  const doc = await createPdfDoc({ orientation: paisagem ? 'landscape' : 'portrait' });
  let logo = null;
  try { logo = await loadImageAsBase64('/logo-sga.png'); } catch { /* sem logótipo em vez de outro qualquer */ }
  let y = addHeader(doc, { title: titulo, subtitle: subtitulo, logoBase64: logo, date: new Date().toLocaleDateString('pt-PT'), meta });
  for (const s of seccoes) {
    y = checkPageBreak(doc, y, 24);
    if (s.titulo) y = addSectionTitle(doc, y, s.titulo);
    if (s.sub) {
      y = checkPageBreak(doc, y, 14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PDF.colors.primary);
      doc.text(s.sub, PDF.margin.left, y + 3); doc.setFont('helvetica', 'normal'); y += 6;
    }
    if (!s.linhas?.length) {
      doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.muted);
      doc.text(s.vazio || 'Sem registos.', PDF.margin.left, y + 4); y += 10;
    } else {
      y = addTable(doc, y, { columns: s.colunas, rows: s.linhas.map(l => l.map(v => (v == null ? '' : String(v)))) }) + 6;
    }
  }
  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: 'Portal de Documentos — SGA' });
  doc.save(`${nomeFicheiro(base)}.pdf`);
}

export function Exportar({ onCsv, onExcel, onPdf, desactivado }) {
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState(null);
  const correr = async (tipo, fn) => {
    if (!fn) return;
    setOcupado(tipo);
    try { await fn(); }
    catch (e) { toast({ title: 'Não foi possível exportar', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {onCsv && <Button variant="outline" size="sm" disabled={desactivado || !!ocupado} onClick={() => correr('csv', onCsv)}>{ocupado === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}CSV</Button>}
      {onExcel && <Button variant="outline" size="sm" disabled={desactivado || !!ocupado} onClick={() => correr('xlsx', onExcel)}>{ocupado === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}Excel</Button>}
      {onPdf && <Button variant="outline" size="sm" disabled={desactivado || !!ocupado} onClick={() => correr('pdf', onPdf)}>{ocupado === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}PDF</Button>}
    </div>
  );
}
