import { supabase } from '@/lib/supabaseClient';
import { createPdfDoc, addHeader, addFooter, addTable, addKeyValuePairs, PDF } from '@/lib/pdfTemplate';

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
  if (proforma.companhia_aerea_id) {
    const { data } = await supabase.from('companhia_aerea').select('*').eq('id', proforma.companhia_aerea_id).single();
    companhia = data;
  }

  // Generate PDF
  const doc = await createPdfDoc();

  const headerOpts = {
    title: 'Proforma',
    subtitle: `N.º ${proforma.numero_proforma || proforma.id?.slice(0, 8)}`,
    date: proforma.data_emissao || proforma.created_date?.split('T')[0] || '',
  };

  let y = addHeader(doc, headerOpts);

  // Info section
  const infoItems = [
    { label: 'Aeroporto', value: aeroporto?.nome || aeroporto?.codigo_icao || '-' },
    { label: 'Companhia', value: companhia?.nome || proforma.companhia_nome || '-' },
  ];
  if (voo) {
    infoItems.push({ label: 'Voo', value: voo.numero_voo || '-' });
    infoItems.push({ label: 'Matrícula', value: voo.matricula_aeronave || '-' });
  }
  infoItems.push({ label: 'Status', value: proforma.status || '-' });

  y = addKeyValuePairs(doc, y, infoItems, { twoColumns: true });
  y += 4;

  // Values table
  if (proforma.itens && Array.isArray(proforma.itens) && proforma.itens.length > 0) {
    const columns = [
      { label: 'Descrição', width: 120 },
      { label: 'Valor (AOA)', width: 60, align: 'right' },
    ];
    const rows = proforma.itens.map(item => [
      item.descricao || item.tipo || '-',
      (item.valor || 0).toLocaleString('pt-AO'),
    ]);
    // Add total row
    rows.push([
      'TOTAL',
      `${(proforma.valor_total || 0).toLocaleString('pt-AO')} AOA`,
    ]);

    y = addTable(doc, y, { columns, rows, headerOpts });
  }

  // Footer
  addFooter(doc);

  // Return as array buffer
  const pdfArrayBuffer = doc.output('arraybuffer');
  return { data: pdfArrayBuffer, proforma };
}
