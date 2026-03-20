import { supabase } from '@/lib/supabaseClient';
import { createPdfDoc, addHeader, addFooter, addSectionTitle, addKeyValuePairs, addInfoBox, addTable, checkPageBreak, fetchEmpresaLogo, PDF } from '@/lib/pdfTemplate';

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

  // Get current user for footer and logo
  const { data: { user } } = await supabase.auth.getUser();
  let userName = user?.email || 'Sistema';
  let userEmpresaId = null;
  if (user) {
    const { data: profile } = await supabase.from('users').select('full_name, empresa_id').eq('auth_id', user.id).single();
    if (profile?.full_name) userName = profile.full_name;
    userEmpresaId = profile?.empresa_id;
  }

  // Fetch empresa logo from user's empresa
  const logoBase64 = await fetchEmpresaLogo(userEmpresaId);

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
  let yPos = addHeader(doc, { title: 'Cálculo de Tarifas Aeroportuárias', logoBase64 });

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
    'Companhia Aérea': companhia?.nome ? `${voo.companhia_aerea} - ${companhia.nome}` : (voo.companhia_aerea || 'N/A'),
    'Tipo de Operação': detalhes.pouso?.tipoVoo || 'N/A',
    'Tipo de Voo': voo.tipo_voo || 'Regular',
    'Rota Completa': detalhes.pouso ? (() => {
      const origem = vooArrData?.aeroporto_origem_destino || '';
      const op = aeroporto?.codigo_icao || '';
      const dest = voo.aeroporto_origem_destino || '';
      return [origem, op, dest].filter(Boolean).join(' - FNBJ - ') || 'N/A';
    })() : 'N/A',
    'Matrícula': voo.registo_aeronave || 'N/A',
    'MTOW': `${new Intl.NumberFormat('pt-PT').format(calculo.mtow_kg || 0)} kg`,
    'Aterragem': vooArrData ? `${vooArrData.data_operacao || ''}, ${vooArrData.horario_real || vooArrData.horario_previsto || ''}`.trim().replace(/,$/, '') : 'N/A',
    'Descolagem': `${voo.data_operacao || ''}, ${voo.horario_real || voo.horario_previsto || ''}`.trim().replace(/,$/, ''),
    'Estacionamento': detalhes.permanencia?.tempoPermanencia || '0h',
    'Categoria do Aeroporto': detalhes.pouso?.categoria_aeroporto || aeroporto?.categoria || 'N/A',
    'Taxa de Câmbio': `1 USD = ${calculo.taxa_cambio_usd_aoa || 850} AOA`,
    'Data do Cálculo': calculo.data_calculo ? new Date(calculo.data_calculo).toLocaleString('pt-AO') : 'N/A',
  });

  // Tarifa de Aterragem e Descolagem
  if (detalhes.pouso && !detalhes.pouso.erro) {
    addTariffSection('Tarifa de Aterragem e Descolagem', {
      'Tipo de Voo': detalhes.pouso.tipoVoo || 'N/A',
      'MTOW (Toneladas)': formatToneladas(detalhes.pouso.mtowTonnes),
      'Escalão de Peso': detalhes.pouso.faixa_min_ton != null ? `${detalhes.pouso.faixa_min_ton} - ${detalhes.pouso.faixa_max_ton} toneladas` : 'N/A',
      'Operações': detalhes.pouso.operacoes || '1 (DEP apenas)',
      'Valor USD': formatUSD(calculo.tarifa_pouso_usd),
      'Valor AOA': formatCurrency(calculo.tarifa_pouso),
    });
    // Tabela de escalões cumulativos
    if (detalhes.pouso.escaloes && detalhes.pouso.escaloes.length > 0) {
      yPos = checkPageBreak(doc, yPos, 10 + detalhes.pouso.escaloes.length * 6 + 16);
      doc.setFontSize(PDF.font.caption);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF.colors.muted);
      doc.text('CÁLCULO POR ESCALÃO (CUMULATIVO)', PDF.margin.left, yPos);
      yPos += 4;
      const bracketRows = detalhes.pouso.escaloes.map(e => [
        e.faixa || 'N/A',
        `$${(e.tarifa || 0).toFixed(2)}`,
        `${e.peso_no_escalao || 0}t`,
        `$${(e.valor || 0).toFixed(2)}`,
      ]);
      bracketRows.push(['Total', '', '', formatUSD(calculo.tarifa_pouso_usd)]);
      yPos = addTable(doc, yPos, {
        columns: [
          { header: 'Escalão', width: 35 },
          { header: 'Taxa (USD/ton)', width: 35 },
          { header: 'Peso no Escalão', width: 35 },
          { header: 'Subtotal USD', width: 35 },
        ],
        rows: bracketRows,
        rowHeight: 6,
        fontSize: PDF.font.small,
      });
      yPos += 4;
    }
  }

  // Tarifa de Estacionamento
  if (detalhes.permanencia && (calculo.tarifa_permanencia_usd || 0) > 0) {
    const horasCobradas = detalhes.permanencia.horasCobradas != null ? String(detalhes.permanencia.horasCobradas) : '0';
    addTariffSection('Tarifa de Estacionamento', {
      'Tipo': detalhes.permanencia.tipo || 'N/A',
      'Tarifa Base USD': detalhes.permanencia.tarifaBase ? formatUSD(detalhes.permanencia.tarifaBase) + '/tonelada/hora' : 'N/A',
      'MTOW (Toneladas)': detalhes.permanencia.mtowTonnes ? formatToneladas(detalhes.permanencia.mtowTonnes) : 'N/A',
      'Tempo Estacionamento': detalhes.permanencia.tempoPermanencia || '0h',
      'Horas Isentas': `${detalhes.permanencia.horasIsentas || 0}h`,
      'Horas Cobradas': horasCobradas + 'h',
      'Valor USD': formatUSD(calculo.tarifa_permanencia_usd),
      'Valor AOA': formatCurrency(calculo.tarifa_permanencia),
    });
  }

  // Tarifas de Passageiros
  if (detalhes.passageiros && !detalhes.passageiros.erro && (calculo.tarifa_passageiros_usd || 0) > 0) {
    addTariffSection('Tarifas de Passageiros', {
      'Tipo de Voo': detalhes.passageiros.tipoVoo || 'N/A',
      'Descrição': detalhes.passageiros.descricao_tarifa || 'Tarifa de Embarque',
      'Tarifa por Pax': formatUSD(detalhes.passageiros.tarifaPorPassageiro),
      'Passageiros ARR': String(detalhes.passageiros.passageirosArr || 0),
      'Passageiros DEP': String(detalhes.passageiros.passageirosDep || 0),
      'Total Cobrado': String(detalhes.passageiros.totalPassageirosCobranca || 0) + ' pax',
      'Trânsito Direto (Isento)': String(detalhes.passageiros.transitoDireto || 0),
      'Trânsito c/ Transbordo (Isento)': String(detalhes.passageiros.transitoTransbordo || 0),
      'Valor USD': formatUSD(calculo.tarifa_passageiros_usd),
      'Valor AOA': formatCurrency(calculo.tarifa_passageiros),
      ...(detalhes.passageiros.observacao ? { 'Observação': detalhes.passageiros.observacao } : {}),
    });
  }

  // Tarifa de Carga
  if (detalhes.carga && (calculo.tarifa_carga_usd || 0) > 0) {
    addTariffSection('Tarifa de Carga', {
      'Tipo de Voo': detalhes.carga.tipoVoo || 'N/A',
      'Carga DEP': `${new Intl.NumberFormat('pt-PT').format(detalhes.carga.cargaDep || 0)} kg`,
      'Tarifa/Ton': formatUSD(detalhes.carga.tarifaPorTon) + '/t',
      'Valor USD': formatUSD(calculo.tarifa_carga_usd),
      'Valor AOA': formatCurrency(calculo.tarifa_carga),
    });
  }

  // Outras Tarifas (Iluminação, Segurança, Trânsito, CUPPSS)
  if (detalhes.iluminacao && !detalhes.iluminacao.isento && detalhes.iluminacao.valor > 0) {
    addTariffSection('Iluminação (Período Noturno)', {
      'Descrição': detalhes.iluminacao.descricao_tarifa || 'Iluminação',
      'Período': detalhes.iluminacao.periodo || '18:00-06:00',
      'ARR Noturno': detalhes.iluminacao.arrNoturno ? 'Sim' : 'Não',
      'DEP Noturno': detalhes.iluminacao.depNoturno ? 'Sim' : 'Não',
      'Operações Noturnas': String(detalhes.iluminacao.operacoesNoturnas || 0),
      'Tarifa por Operação': formatUSD(detalhes.iluminacao.tarifaPorOperacao || 0),
      'Valor USD': formatUSD(detalhes.iluminacao.valor || 0),
    });
  }

  if (Array.isArray(detalhes.outras)) {
    const labelMap = {
      seguranca: 'Tarifa de Segurança',
      transito_transbordo: 'Trânsito com Transbordo',
      transito_direto: 'Trânsito Direto',
      cuppss: 'CUPPSS / CUSS',
    };
    detalhes.outras.forEach((outra) => {
      if (!outra.valor || outra.erro) return;
      const titulo = labelMap[outra.tipo] || outra.descricao || outra.tipo || 'Outra Tarifa';
      const data = {
        'Descrição': outra.descricao || titulo,
        'Valor USD': formatUSD(outra.valor),
      };
      if (outra.passageiros != null) data['Passageiros'] = String(outra.passageiros);
      if (outra.tarifaPorPassageiro != null) data['Tarifa/Pax'] = formatUSD(outra.tarifaPorPassageiro);
      addTariffSection(titulo, data);
    });
  }

  // Impostos
  if (detalhes.impostos && detalhes.impostos.length > 0) {
    detalhes.impostos.forEach((imposto) => {
      addTariffSection(`Imposto - ${imposto.tipo}`, {
        'Tipo': imposto.tipo,
        'Percentagem': `${imposto.valor_configurado}%`,
        'Fórmula': imposto.formula || 'N/A',
        'Valor USD': formatUSD(imposto.valor_usd),
        'Valor AOA': formatCurrency(imposto.valor_aoa),
      });
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
    doc.text('SUBTOTAL (sem impostos):', PDF.margin.left, yPos);
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
