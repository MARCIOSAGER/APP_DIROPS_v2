import { supabase } from '@/lib/supabaseClient';
import { createPdfDoc, addHeader, addFooter, addTable, addKeyValuePairs, addSectionTitle, addInfoBox, checkPageBreak, fetchEmpresaLogo, PDF } from '@/lib/pdfTemplate';

export default async function gerarProformaPdfSimples({ proforma_id }) {
  if (!proforma_id) throw new Error('proforma_id e obrigatorio');

  // Fetch proforma data
  const { data: proforma, error: pError } = await supabase
    .from('proforma')
    .select('*')
    .eq('id', proforma_id)
    .single();
  if (pError) throw pError;

  // Fetch related data in parallel
  const [vooRes, aeroportoRes, companhiaRes, calculoRes] = await Promise.all([
    proforma.voo_id
      ? supabase.from('voo').select('*').eq('id', proforma.voo_id).single()
      : { data: null },
    proforma.aeroporto_id
      ? supabase.from('aeroporto').select('*').eq('id', proforma.aeroporto_id).single()
      : { data: null },
    proforma.companhia_aerea_id
      ? supabase.from('companhia_aerea').select('*').eq('id', proforma.companhia_aerea_id).single()
      : { data: null },
    proforma.calculo_tarifa_id
      ? supabase.from('calculo_tarifa').select('*').eq('id', proforma.calculo_tarifa_id).single()
      : { data: null },
  ]);

  const voo = vooRes.data;
  const aeroporto = aeroportoRes.data;
  const companhia = companhiaRes.data;
  const calculo = calculoRes.data;

  // Fetch empresa logo from current user's empresa
  const { data: { user: authUser } } = await supabase.auth.getUser();
  let userEmpresaId = null;
  if (authUser) {
    const { data: userProfile } = await supabase.from('users').select('empresa_id').eq('auth_id', authUser.id).single();
    userEmpresaId = userProfile?.empresa_id;
  }
  const logoBase64 = await fetchEmpresaLogo(userEmpresaId);

  // Formatting helpers
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0) + ' Kz';
  };
  const formatUSD = (value) => `$${new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;

  // Generate PDF
  const doc = await createPdfDoc();

  const headerOpts = {
    title: 'Nota Proforma',
    subtitle: `N.º ${proforma.numero_proforma || proforma.id?.slice(0, 8)}`,
    date: proforma.data_emissao || proforma.created_date?.split('T')[0] || '',
    logoBase64,
  };

  let y = addHeader(doc, headerOpts);

  // Info box with key details
  const infoItems = [
    { label: 'Companhia', value: companhia?.nome || '-' },
    { label: 'Aeroporto', value: aeroporto?.nome ? `${aeroporto.nome} (${aeroporto.codigo_icao})` : aeroporto?.codigo_icao || '-' },
  ];
  if (voo) {
    infoItems.push({ label: 'Voo', value: `${voo.numero_voo || '-'} — ${voo.data_operacao || ''}` });
    infoItems.push({ label: 'Matrícula', value: voo.registo_aeronave || '-' });
  }

  y = addInfoBox(doc, y, infoItems);

  // Proforma details
  y = addSectionTitle(doc, y, 'Detalhes da Proforma');
  const detailItems = [
    { label: 'N.º Proforma', value: proforma.numero_proforma || '-' },
    { label: 'Data Emissão', value: proforma.data_emissao || '-' },
    { label: 'Data Vencimento', value: proforma.data_vencimento || '-' },
    { label: 'Status', value: proforma.status || '-' },
    { label: 'Câmbio', value: proforma.taxa_cambio ? `1 USD = ${proforma.taxa_cambio} AOA` : '-' },
  ];
  if (proforma.emitida_por) {
    detailItems.push({ label: 'Emitida por', value: proforma.emitida_por });
  }
  y = addKeyValuePairs(doc, y, detailItems, { twoColumns: true });

  // Tariff breakdown from calculo if available
  if (calculo) {
    const detalhes = calculo.detalhes_calculo || {};
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, y, 'Discriminação de Tarifas');

    const tarifaRows = [];
    if (calculo.tarifa_pouso_usd > 0) {
      tarifaRows.push(['Tarifa de Pouso', formatUSD(calculo.tarifa_pouso_usd), formatCurrency(calculo.tarifa_pouso)]);
    }
    if (calculo.tarifa_permanencia_usd > 0) {
      tarifaRows.push(['Tarifa de Estacionamento', formatUSD(calculo.tarifa_permanencia_usd), formatCurrency(calculo.tarifa_permanencia)]);
    }
    if (calculo.tarifa_passageiros_usd > 0) {
      tarifaRows.push(['Tarifa de Passageiros', formatUSD(calculo.tarifa_passageiros_usd), formatCurrency(calculo.tarifa_passageiros)]);
    }
    if (calculo.tarifa_carga_usd > 0) {
      tarifaRows.push(['Tarifa de Carga', formatUSD(calculo.tarifa_carga_usd), formatCurrency(calculo.tarifa_carga)]);
    }
    if (calculo.outras_tarifas_usd > 0) {
      tarifaRows.push(['Iluminação', formatUSD(calculo.outras_tarifas_usd), formatCurrency(calculo.outras_tarifas)]);
    }

    // Impostos
    if (detalhes.impostos && detalhes.impostos.length > 0) {
      detalhes.impostos.forEach((imposto) => {
        tarifaRows.push([`Imposto - ${imposto.tipo}`, formatUSD(imposto.valor_usd), formatCurrency(imposto.valor_aoa)]);
      });
    }

    if (tarifaRows.length > 0) {
      // Add total row
      tarifaRows.push(['TOTAL', formatUSD(calculo.total_tarifa_usd || proforma.valor_total_usd), formatCurrency(calculo.total_tarifa || proforma.valor_total_aoa)]);

      y = addTable(doc, y, {
        columns: [
          { label: 'Descrição', width: 80 },
          { label: 'Valor (USD)', width: 45, align: 'right' },
          { label: 'Valor (AOA)', width: 55, align: 'right' },
        ],
        rows: tarifaRows,
      });
    }
  } else {
    // Fallback: show totals only
    y = checkPageBreak(doc, y, 20);
    y = addSectionTitle(doc, y, 'Valores');
    y = addKeyValuePairs(doc, y, [
      { label: 'Total (USD)', value: formatUSD(proforma.valor_total_usd) },
      { label: 'Total (AOA)', value: formatCurrency(proforma.valor_total_aoa) },
    ], { twoColumns: true });
  }

  // Observations
  if (proforma.observacoes) {
    y = checkPageBreak(doc, y, 20);
    y = addSectionTitle(doc, y, 'Observações');
    doc.setFontSize(PDF.font.small);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF.colors.dark);
    const pageWidth = doc.internal.pageSize.getWidth();
    const obsLines = doc.splitTextToSize(proforma.observacoes, pageWidth - PDF.margin.left - PDF.margin.right);
    doc.text(obsLines, PDF.margin.left, y);
    y += obsLines.length * 4 + 4;
  }

  // Footer
  addFooter(doc, { generatedBy: proforma.emitida_por || 'Sistema' });

  // Generate PDF bytes
  const pdfArrayBuffer = doc.output('arraybuffer');

  // Upload to Supabase Storage
  const fileName = `proformas/${proforma.numero_proforma || proforma_id}.pdf`;
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(fileName, pdfBlob, { upsert: true, contentType: 'application/pdf' });

  if (uploadError) {
    console.error('Erro ao fazer upload do PDF:', uploadError);
    throw new Error('Falha no upload do PDF');
  }

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(fileName);

  const pdf_url = urlData.publicUrl;

  // Update proforma with PDF URL
  await supabase
    .from('proforma')
    .update({ pdf_url })
    .eq('id', proforma_id);

  return { data: { pdf_url }, proforma };
}
