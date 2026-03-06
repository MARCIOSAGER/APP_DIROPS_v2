import { supabase } from '@/lib/supabaseClient';
import { jsPDF } from 'jspdf';

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

  // Create PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 16;
  const lineHeight = 3;
  const sectionSpacing = 1.5;

  // Formatting helpers
  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    return `${formatted} Kz`;
  };
  const formatUSD = (value) => `$${new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;
  const formatToneladas = (value) => `${Math.round(value || 0)}t`;

  // Title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Cálculo de Tarifas Aeroportuárias', pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;

  // Flight info box
  let vooArrData = null;
  if (voo.voo_ligado_id) {
    const { data: vooLigado } = await supabase.from('voo_ligado').select('*').eq('id', voo.voo_ligado_id).single();
    if (vooLigado) {
      const { data: vArr } = await supabase.from('voo').select('*').eq('id', vooLigado.id_voo_arr).single();
      vooArrData = vArr;
    }
  }

  const boxHeight = vooArrData ? 16 : 11;
  doc.setFillColor(219, 234, 254);
  doc.rect(15, yPos - 2, pageWidth - 30, boxHeight, 'F');
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.3);
  doc.rect(15, yPos - 2, pageWidth - 30, boxHeight);

  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  let boxY = yPos + 1;

  if (vooArrData) {
    doc.setFont('helvetica', 'bold');
    doc.text('Voo ARR:', 18, boxY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${vooArrData.numero_voo || 'N/A'}`, 36, boxY);
    doc.setFont('helvetica', 'bold');
    doc.text('Data:', 105, boxY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${vooArrData.data_operacao || 'N/A'}`, 118, boxY);
    boxY += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Voo DEP:', 18, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${voo.numero_voo || 'N/A'}`, 36, boxY);
  doc.setFont('helvetica', 'bold');
  doc.text('Data:', 105, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${voo.data_operacao || 'N/A'}`, 118, boxY);
  boxY += 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Aeroporto:', 18, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${aeroporto?.nome ? `${aeroporto.nome} - ${aeroporto.codigo_icao}` : 'N/A'}`, 36, boxY);
  boxY += 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Companhia:', 18, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${voo.companhia_aerea ? `${voo.companhia_aerea} - ${companhia?.nome || 'N/A'}` : companhia?.nome || 'N/A'}`, 36, boxY);
  doc.setFont('helvetica', 'bold');
  doc.text('Registo:', 105, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${voo.registo_aeronave || 'N/A'}`, 121, boxY);

  yPos += boxHeight + 2;
  doc.setTextColor(0, 0, 0);

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += sectionSpacing - 1;

  // Section helper
  const addSection = (title, data) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 74, 153);
    doc.text(String(title), 15, yPos);
    yPos += lineHeight + 0.5;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const entries = Object.entries(data);
    const col1X = 18, col2X = 46, col3X = 108, col4X = 136;

    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      const keyStr = key != null ? String(key) : 'Campo';
      let valueStr = value != null ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : 'N/A';
      if (valueStr.length > 26) valueStr = valueStr.substring(0, 23) + '...';

      if (i % 2 === 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(keyStr + ':', col1X, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(valueStr, col2X, yPos);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.text(keyStr + ':', col3X, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(valueStr, col4X, yPos);
        yPos += lineHeight;
      }
    }

    if (entries.length % 2 !== 0) yPos += lineHeight;
    yPos += sectionSpacing;
  };

  // Informações Gerais
  addSection('Informações Gerais', {
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
    addSection('Tarifa de Pouso', {
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
    addSection('Tarifa de Estacionamento', {
      'Tempo': detalhes.permanencia.tempoPermanencia || '0h',
      'H. Cobradas': horasCobradas + 'h',
      'USD': formatUSD(calculo.tarifa_permanencia_usd),
      'AOA': formatCurrency(calculo.tarifa_permanencia),
    });
  }

  // Tarifas de Passageiros
  if (detalhes.passageiros && !detalhes.passageiros.erro) {
    addSection('Tarifas de Passageiros', {
      'Tarifa/Pax': formatUSD(detalhes.passageiros.tarifaPorPassageiro),
      'Pax DEP': String(detalhes.passageiros.passageirosDep || 0),
      'Cobrado': String(detalhes.passageiros.totalPassageirosCobranca || 0) + ' pax',
      'USD': formatUSD(calculo.tarifa_passageiros_usd),
      'AOA': formatCurrency(calculo.tarifa_passageiros),
    });
  }

  // Tarifa de Carga
  if (detalhes.carga && (calculo.tarifa_carga_usd || 0) > 0) {
    addSection('Tarifa de Carga', {
      'Carga DEP': `${new Intl.NumberFormat('pt-PT').format(detalhes.carga.cargaDep || 0)} kg`,
      'Tarifa/Ton': formatUSD(detalhes.carga.tarifaPorTon) + '/t',
      'USD': formatUSD(calculo.tarifa_carga_usd),
      'AOA': formatCurrency(calculo.tarifa_carga),
    });
  }

  // Impostos
  if (detalhes.impostos && detalhes.impostos.length > 0) {
    detalhes.impostos.forEach((imposto) => {
      addSection(`Imposto - ${imposto.tipo}`, {
        'Tipo': imposto.tipo,
        'Percentagem': `${imposto.valor_configurado}%`,
        'Fórmula': imposto.formula || 'N/A',
        'USD': formatUSD(imposto.valor_usd),
        'AOA': formatCurrency(imposto.valor_aoa),
      });

      if (imposto.descricao) {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        const descLines = doc.splitTextToSize(`Descrição: ${imposto.descricao}`, pageWidth - 40);
        doc.text(descLines, 18, yPos);
        yPos += descLines.length * 2.5 + 1;
        doc.setTextColor(0, 0, 0);
      }
    });
  }

  // Iluminação
  if (detalhes.iluminacao && !detalhes.iluminacao.isento && (calculo.outras_tarifas_usd || 0) > 0) {
    addSection('Iluminação', {
      'Período': '18:00-06:00',
      'Tarifa': formatUSD(detalhes.iluminacao.valorFixo || detalhes.iluminacao.tarifaPorOperacao || 0),
      'USD': formatUSD(detalhes.iluminacao.valor || 0),
      'AOA': formatCurrency(calculo.outras_tarifas || 0),
    });
  }

  // Final separator
  yPos += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 2;

  // Totals
  yPos += 1.5;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 3;

  if (detalhes.subtotal_sem_impostos_usd) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SUBTOTAL:', 15, yPos);
    doc.text(`${formatUSD(detalhes.subtotal_sem_impostos_usd || 0)} = ${formatCurrency(detalhes.subtotal_sem_impostos_aoa || 0)}`, pageWidth - 15, yPos, { align: 'right' });
    yPos += 4;
  }

  if (detalhes.total_impostos_usd && detalhes.total_impostos_usd > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('IMPOSTOS:', 15, yPos);
    doc.text(`${formatUSD(detalhes.total_impostos_usd || 0)} = ${formatCurrency(detalhes.total_impostos_aoa || 0)}`, pageWidth - 15, yPos, { align: 'right' });
    yPos += 5;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 128, 0);
  doc.text('TOTAL:', 15, yPos);
  doc.text(`${formatUSD(calculo.total_tarifa_usd || 0)} = ${formatCurrency(calculo.total_tarifa || 0)}`, pageWidth - 15, yPos, { align: 'right' });
  yPos += 3;

  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text(`Taxa: 1 USD = ${new Intl.NumberFormat('pt-PT').format(calculo.taxa_cambio_usd_aoa || 850)} AOA`, pageWidth - 15, yPos, { align: 'right' });

  // Footer
  yPos += 3;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);

  const dataGeracao = new Date().toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  doc.text(`Gerado: ${dataGeracao} | Por: ${userName}`, 15, yPos);

  // Output PDF
  const pdfBytes = doc.output('arraybuffer');
  return { data: pdfBytes };
}
