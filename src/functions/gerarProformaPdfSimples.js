import { supabase } from '@/lib/supabaseClient';
import jsPDF from 'jspdf';

export default async function gerarProformaPdfSimples({ proforma_id }) {
  if (!proforma_id) throw new Error('proforma_id e obrigatorio');

  // Fetch proforma data
  const { data: proforma, error: pError } = await supabase
    .from('proforma')
    .select('*')
    .eq('id', proforma_id)
    .single();
  if (pError) throw pError;

  // Fetch related data
  let voo = null, aeroporto = null, companhia = null;
  if (proforma.voo_id) {
    const { data } = await supabase.from('voo').select('*').eq('id', proforma.voo_id).single();
    voo = data;
  }
  if (proforma.aeroporto_id) {
    const { data } = await supabase.from('aeroporto').select('*').eq('id', proforma.aeroporto_id).single();
    aeroporto = data;
  }
  if (proforma.companhia_id) {
    const { data } = await supabase.from('companhia_aerea').select('*').eq('id', proforma.companhia_id).single();
    companhia = data;
  }

  // Generate PDF
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PROFORMA', 105, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N: ${proforma.numero_proforma || proforma.id?.slice(0, 8)}`, 105, y, { align: 'center' });
  y += 15;

  // Info section
  doc.setFontSize(11);
  const addLine = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '-'), margin + 60, y);
    y += 7;
  };

  addLine('Data', proforma.data_emissao || proforma.created_date?.split('T')[0] || '-');
  addLine('Aeroporto', aeroporto?.nome || aeroporto?.codigo_icao || '-');
  addLine('Companhia', companhia?.nome || proforma.companhia_nome || '-');
  if (voo) {
    addLine('Voo', voo.numero_voo || '-');
    addLine('Matricula', voo.matricula_aeronave || '-');
  }
  addLine('Status', proforma.status || '-');

  y += 5;
  doc.setDrawColor(200);
  doc.line(margin, y, 190, y);
  y += 10;

  // Values
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Valores', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  if (proforma.itens && Array.isArray(proforma.itens)) {
    proforma.itens.forEach((item) => {
      doc.text(`${item.descricao || item.tipo || '-'}`, margin, y);
      doc.text(`${(item.valor || 0).toLocaleString('pt-AO')} AOA`, 160, y, { align: 'right' });
      y += 6;
    });
  }

  addLine('Valor Total', `${(proforma.valor_total || 0).toLocaleString('pt-AO')} AOA`);

  // Footer
  y = 270;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Documento gerado pelo DIROPS-SGA', 105, y, { align: 'center' });

  // Return as array buffer
  const pdfArrayBuffer = doc.output('arraybuffer');
  return { data: pdfArrayBuffer, proforma };
}
