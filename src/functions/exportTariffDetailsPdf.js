import { supabase } from '@/lib/supabaseClient';
import { createPdfDoc, addHeader, addFooter, addSectionTitle, addKeyValuePairs, addInfoBox, checkPageBreak, PDF } from '@/lib/pdfTemplate';

export async function exportTariffDetailsPdf({ calculoId }) {
  if (!calculoId) throw new Error('ID do cálculo é obrigatório');

  // Fetch calculo
  const { data: calculo, error: calcError } = await supabase
    .from('calculo_tarifa')
    .select('*')
    .eq('id', calculoId)
    .single();
  if (calcError || !calculo) throw new Error('Cálculo não encontrado');

  // Fetch related data
  const [vooRes, aeroportosRes, companhiasRes] = await Promise.all([
    supabase.from('voo').select('*').eq('id', calculo.voo_id).single(),
    supabase.from('aeroporto').select('*'),
    supabase.from('companhia_aerea').select('*'),
  ]);

  const voo = vooRes.data;
  if (!voo) throw new Error('Voo não encontrado');

  const aeroporto = (aeroportosRes.data || []).find(a => a.id === calculo.aeroporto_id);
  const companhia = (companhiasRes.data || []).find(c => c.codigo_icao === voo.companhia_aerea);

  // Get current user for footer
  const { data: { user } } = await supabase.auth.getUser();
  let userName = user?.email || 'Sistema';
  if (user) {
    const { data: profile } = await supabase.from('users').select('full_name').eq('auth_id', user.id).single();
    if (profile?.full_name) userName = profile.full_name;
  }

  const detalhes = calculo.detalhes_calculo || {};

  // Formatting helpers
  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    return `${formatted} Kz`;
  };
  const formatUSD = (value) => `$${new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;
  const formatToneladas = (value) => `${Math.round(value || 0)}t`;

  // Create PDF
  const doc = await createPdfDoc();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  let yPos = addHeader(doc, { title: 'Cálculo de Tarifas Aeroportuárias' });

  // Flight info box
  let vooArrData = null;
  if (voo.voo_ligado_id) {
    const { data: vooLigado } = await supabase.from('voo_ligado').select('*').eq('id', voo.voo_ligado_id).single();
    if (vooLigado) {
      const { data: vArr } = await supabase.from('voo').select('*').eq('id', vooLigado.id_voo_arr).single();
      vooArrData = vArr;
    }
  }

  const infoItems = [];
  if (vooArrData) {
    infoItems.push({ label: 'Voo ARR', value: `${vooArrData.numero_voo || 'N/A'} — ${vooArrData.data_operacao || 'N/A'}` });
  }
  infoItems.push({ label: 'Voo DEP', value: `${voo.numero_voo || 'N/A'} — ${voo.data_operacao || 'N/A'}` });
  infoItems.push({ label: 'Aeroporto', value: aeroporto?.nome ? `${aeroporto.nome} - ${aeroporto.codigo_icao}` : 'N/A' });
  infoItems.push({ label: 'Companhia', value: `${voo.companhia_aerea ? `${voo.companhia_aerea} - ${companhia?.nome || 'N/A'}` : companhia?.nome || 'N/A'} | Registo: ${voo.registo_aeronave || 'N/A'}` });

  yPos = addInfoBox(doc, yPos, infoItems);

  // Helper to add a section with page break check
  const addTariffSection = (title, data) => {
    yPos = checkPageBreak(doc, yPos, 30);
    yPos = addSectionTitle(doc, yPos, title);
    const items = Object.entries(data).map(([label, value]) => {
      let valueStr = value != null ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : 'N/A';
      return { label, value: valueStr };
    });
    yPos = addKeyValuePairs(doc, yPos, items, { twoColumns: true });
  };

  // Informações Gerais
  addTariffSection('Informações Gerais', {
    'Companhia': voo.companhia_aerea || 'N/A',
    'Matrícula': voo.registo_aeronave || 'N/A',
    'Tipo Voo': voo.tipo_voo || 'Regular',
    'Operação': detalhes.pouso?.tipoVoo || 'N/A',
    'MTOW': `${new Intl.NumberFormat('pt-PT').format(calculo.mtow_kg || 0)} kg`,
    'Categoria': detalhes.pouso?.categoria_aeroporto || aeroporto?.categoria || 'N/A',
    'Estacionamento': detalhes.permanencia ? `${detalhes.permanencia.tempoPermanencia || '0h'}` : '0h',
    'Câmbio': `1 USD = ${calculo.taxa_cambio_usd_aoa || 850} AOA`,
  });

  // Tarifa de Pouso
  if (detalhes.pouso && !detalhes.pouso.erro) {
    const tarifaAplicada = detalhes.pouso.tarifaAplicada ? detalhes.pouso.tarifaAplicada.toFixed(2) : '0';
    addTariffSection('Tarifa de Pouso', {
      'Tipo': detalhes.pouso.tipoVoo || 'N/A',
      'MTOW': formatToneladas(detalhes.pouso.mtowTonnes),
      'Tarifa': formatUSD(parseFloat(tarifaAplicada)) + '/t',
      'Operações': detalhes.pouso.operacoes || '1',
      'USD': formatUSD(calculo.tarifa_pouso_usd),
      'AOA': formatCurrency(calculo.tarifa_pouso),
    });
  }

  // Tarifa de Permanência
  if (detalhes.permanencia && (calculo.tarifa_permanencia_usd || 0) > 0) {
    const horasCobradas = detalhes.permanencia.horasCobradas != null ? String(detalhes.permanencia.horasCobradas) : '0';
    addTariffSection('Tarifa de Estacionamento', {
      'Tempo': detalhes.permanencia.tempoPermanencia || '0h',
      'H. Cobradas': horasCobradas + 'h',
      'USD': formatUSD(calculo.tarifa_permanencia_usd),
      'AOA': formatCurrency(calculo.tarifa_permanencia),
    });
  }

  // Tarifas de Passageiros
  if (detalhes.passageiros && !detalhes.passageiros.erro) {
    addTariffSection('Tarifas de Passageiros', {
      'Tarifa/Pax': formatUSD(detalhes.passageiros.tarifaPorPassageiro),
      'Pax DEP': String(detalhes.passageiros.passageirosDep || 0),
      'Cobrado': String(detalhes.passageiros.totalPassageirosCobranca || 0) + ' pax',
      'USD': formatUSD(calculo.tarifa_passageiros_usd),
      'AOA': formatCurrency(calculo.tarifa_passageiros),
    });
  }

  // Tarifa de Carga
  if (detalhes.carga && (calculo.tarifa_carga_usd || 0) > 0) {
    addTariffSection('Tarifa de Carga', {
      'Carga DEP': `${new Intl.NumberFormat('pt-PT').format(detalhes.carga.cargaDep || 0)} kg`,
      'Tarifa/Ton': formatUSD(detalhes.carga.tarifaPorTon) + '/t',
      'USD': formatUSD(calculo.tarifa_carga_usd),
      'AOA': formatCurrency(calculo.tarifa_carga),
    });
  }

  // Impostos
  if (detalhes.impostos && detalhes.impostos.length > 0) {
    detalhes.impostos.forEach((imposto) => {
      addTariffSection(`Imposto - ${imposto.tipo}`, {
        'Tipo': imposto.tipo,
        'Percentagem': `${imposto.valor_configurado}%`,
        'Fórmula': imposto.formula || 'N/A',
        'USD': formatUSD(imposto.valor_usd),
        'AOA': formatCurrency(imposto.valor_aoa),
      });

      if (imposto.descricao) {
        doc.setFontSize(PDF.font.caption);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...PDF.colors.muted);
        const descLines = doc.splitTextToSize(`Descrição: ${imposto.descricao}`, pageWidth - 40);
        doc.text(descLines, PDF.margin.left + 3, yPos);
        yPos += descLines.length * 3 + 2;
        doc.setTextColor(...PDF.colors.dark);
      }
    });
  }

  // Iluminação
  if (detalhes.iluminacao && !detalhes.iluminacao.isento && (calculo.outras_tarifas_usd || 0) > 0) {
    addTariffSection('Iluminação', {
      'Período': '18:00-06:00',
      'Tarifa': formatUSD(detalhes.iluminacao.valorFixo || detalhes.iluminacao.tarifaPorOperacao || 0),
      'USD': formatUSD(detalhes.iluminacao.valor || 0),
      'AOA': formatCurrency(calculo.outras_tarifas || 0),
    });
  }

  // Final separator
  yPos = checkPageBreak(doc, yPos, 30);
  yPos += 2;
  doc.setDrawColor(...PDF.colors.separator);
  doc.setLineWidth(0.3);
  doc.line(PDF.margin.left, yPos, pageWidth - PDF.margin.right, yPos);
  yPos += 5;

  // Totals
  if (detalhes.subtotal_sem_impostos_usd) {
    doc.setFontSize(PDF.font.small);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF.colors.muted);
    doc.text('SUBTOTAL:', PDF.margin.left, yPos);
    doc.text(`${formatUSD(detalhes.subtotal_sem_impostos_usd || 0)} = ${formatCurrency(detalhes.subtotal_sem_impostos_aoa || 0)}`, pageWidth - PDF.margin.right, yPos, { align: 'right' });
    yPos += 5;
  }

  if (detalhes.total_impostos_usd && detalhes.total_impostos_usd > 0) {
    doc.setFontSize(PDF.font.small);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF.colors.danger);
    doc.text('IMPOSTOS:', PDF.margin.left, yPos);
    doc.text(`${formatUSD(detalhes.total_impostos_usd || 0)} = ${formatCurrency(detalhes.total_impostos_aoa || 0)}`, pageWidth - PDF.margin.right, yPos, { align: 'right' });
    yPos += 6;
  }

  doc.setFontSize(PDF.font.subtitle + 1);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF.colors.success);
  doc.text('TOTAL:', PDF.margin.left, yPos);
  doc.text(`${formatUSD(calculo.total_tarifa_usd || 0)} = ${formatCurrency(calculo.total_tarifa || 0)}`, pageWidth - PDF.margin.right, yPos, { align: 'right' });
  yPos += 4;

  doc.setFontSize(PDF.font.tiny);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...PDF.colors.muted);
  doc.text(`Taxa: 1 USD = ${new Intl.NumberFormat('pt-PT').format(calculo.taxa_cambio_usd_aoa || 850)} AOA`, pageWidth - PDF.margin.right, yPos, { align: 'right' });

  // Footer
  addFooter(doc, { generatedBy: userName });

  // Output PDF
  const pdfBytes = doc.output('arraybuffer');
  return { data: pdfBytes };
}
