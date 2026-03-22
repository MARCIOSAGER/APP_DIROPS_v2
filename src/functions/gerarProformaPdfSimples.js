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

  const isConsolidada = proforma.tipo === 'consolidada';

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

  // For consolidated proformas, fetch items with their calculos and voos
  let consolidatedItems = [];
  let allAeroportos = [];
  if (isConsolidada) {
    const { data: items } = await supabase
      .from('proforma_item')
      .select('*')
      .eq('proforma_id', proforma_id);

    if (items && items.length > 0) {
      const calculoIds = items.map(i => i.calculo_tarifa_id).filter(Boolean);
      const vooIds = items.map(i => i.voo_id).filter(Boolean);
      const vooLigadoIds = items.map(i => i.voo_ligado_id).filter(Boolean);

      const [calcRes, voosRes, vlRes, aerosRes] = await Promise.all([
        calculoIds.length > 0
          ? supabase.from('calculo_tarifa').select('*').in('id', calculoIds)
          : { data: [] },
        vooIds.length > 0
          ? supabase.from('voo').select('*').in('id', vooIds)
          : { data: [] },
        vooLigadoIds.length > 0
          ? supabase.from('voo_ligado').select('*').in('id', vooLigadoIds)
          : { data: [] },
        supabase.from('aeroporto').select('*'),
      ]);

      const calculosMap = new Map((calcRes.data || []).map(c => [c.id, c]));
      const voosMap = new Map((voosRes.data || []).map(v => [v.id, v]));
      const vlMap = new Map((vlRes.data || []).map(vl => [vl.id, vl]));
      allAeroportos = aerosRes.data || [];

      const arrVooIds = (vlRes.data || []).map(vl => vl.id_voo_arr).filter(Boolean);
      const depVooIds = (vlRes.data || []).map(vl => vl.id_voo_dep).filter(Boolean);
      const allLinkedVooIds = [...new Set([...arrVooIds, ...depVooIds])].filter(id => !voosMap.has(id));
      if (allLinkedVooIds.length > 0) {
        const { data: extraVoos } = await supabase.from('voo').select('*').in('id', allLinkedVooIds);
        (extraVoos || []).forEach(v => voosMap.set(v.id, v));
      }

      consolidatedItems = items.map(item => {
        const itemCalculo = calculosMap.get(item.calculo_tarifa_id);
        const itemVoo = voosMap.get(item.voo_id);
        const itemVL = vlMap.get(item.voo_ligado_id);
        const depVoo = itemVL ? voosMap.get(itemVL.id_voo_dep) : null;
        const arrVoo = itemVL ? voosMap.get(itemVL.id_voo_arr) : null;
        const itemAero = itemCalculo?.aeroporto_id
          ? allAeroportos.find(a => a.id === itemCalculo.aeroporto_id)
          : null;

        return {
          ...item,
          calculo: itemCalculo,
          voo: depVoo || itemVoo,
          vooArr: arrVoo,
          vooDep: depVoo,
          vooLigado: itemVL,
          aeroporto: itemAero,
        };
      });
    }
  }

  // Fetch empresa logo
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
  const fmtNum = (value, decimals = 2) => {
    if (!value && value !== 0) return '';
    return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  };
  const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  // ─── Consolidated Landscape PDF ───
  if (isConsolidada && consolidatedItems.length > 0) {
    return generateConsolidatedLandscape({
      proforma, companhia, aeroporto, consolidatedItems,
      logoBase64, formatCurrency, formatUSD, fmtNum, fmtDate,
    });
  }

  // ─── Individual Portrait PDF (unchanged) ───
  const doc = await createPdfDoc();

  const headerOpts = {
    title: 'Nota Proforma',
    subtitle: `N.º ${proforma.numero_proforma || proforma.id?.slice(0, 8)}`,
    date: proforma.data_emissao || proforma.created_date?.split('T')[0] || '',
    logoBase64,
  };

  let y = addHeader(doc, headerOpts);

  // Info box
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

  if (calculo) {
    const detalhes = calculo.detalhes_calculo || {};
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, y, 'Discriminação de Tarifas');

    const tarifaRows = [];
    if (calculo.tarifa_pouso_usd > 0) {
      tarifaRows.push(['Taxa de Aterragem', formatUSD(calculo.tarifa_pouso_usd), formatCurrency(calculo.tarifa_pouso)]);
    }
    if (calculo.tarifa_permanencia_usd > 0) {
      tarifaRows.push(['Tarifa de Estacionamento', formatUSD(calculo.tarifa_permanencia_usd), formatCurrency(calculo.tarifa_permanencia)]);
    }
    if (calculo.tarifa_passageiros_usd > 0) {
      tarifaRows.push(['Taxa de Embarque', formatUSD(calculo.tarifa_passageiros_usd), formatCurrency(calculo.tarifa_passageiros)]);
    }
    if (calculo.tarifa_carga_usd > 0) {
      tarifaRows.push(['Tarifa de Carga', formatUSD(calculo.tarifa_carga_usd), formatCurrency(calculo.tarifa_carga)]);
    }
    if (calculo.outras_tarifas_usd > 0) {
      tarifaRows.push(['Iluminação', formatUSD(calculo.outras_tarifas_usd), formatCurrency(calculo.outras_tarifas)]);
    }

    if (calculo.tarifa_recursos_usd > 0) {
      const recursos = detalhes.recursos;
      if (recursos?.itens?.length > 0) {
        recursos.itens.forEach(r => {
          tarifaRows.push([r.tipo, formatUSD(r.valor_usd), formatCurrency(r.valor_usd * (calculo.taxa_cambio_usd_aoa || proforma.taxa_cambio || 850))]);
        });
      } else {
        tarifaRows.push(['Recursos de Solo', formatUSD(calculo.tarifa_recursos_usd), formatCurrency(calculo.tarifa_recursos)]);
      }
    }

    // Serviços aeroportuários
    if (calculo.tarifa_servicos_usd > 0) {
      const servicos = detalhes.servicos;
      if (servicos?.itens?.length > 0) {
        servicos.itens.forEach(s => {
          const label = `${s.tipo} (${s.quantidade} ${s.unidade})`;
          tarifaRows.push([label, formatUSD(s.valor_usd), formatCurrency(s.valor_usd * (calculo.taxa_cambio_usd_aoa || proforma.taxa_cambio || 850))]);
        });
      } else {
        tarifaRows.push(['Serviços Aeroportuários', formatUSD(calculo.tarifa_servicos_usd), formatCurrency(calculo.tarifa_servicos)]);
      }
    }

    if (detalhes.impostos && detalhes.impostos.length > 0) {
      detalhes.impostos.forEach((imposto) => {
        tarifaRows.push([`Imposto - ${imposto.tipo}`, formatUSD(imposto.valor_usd), formatCurrency(imposto.valor_aoa)]);
      });
    }

    if (tarifaRows.length > 0) {
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
    y = checkPageBreak(doc, y, 20);
    y = addSectionTitle(doc, y, 'Valores');
    y = addKeyValuePairs(doc, y, [
      { label: 'Total (USD)', value: formatUSD(proforma.valor_total_usd) },
      { label: 'Total (AOA)', value: formatCurrency(proforma.valor_total_aoa) },
    ], { twoColumns: true });
  }

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

  addFooter(doc, { generatedBy: proforma.emitida_por || 'Sistema' });

  return await uploadAndReturn(doc, proforma, proforma_id);
}


// ─── Consolidated Landscape Generator ───────────────────────────────

async function generateConsolidatedLandscape({
  proforma, companhia, aeroporto, consolidatedItems,
  logoBase64, formatCurrency, formatUSD, fmtNum, fmtDate,
}) {
  const doc = await createPdfDoc({ orientation: 'landscape' });
  const cambio = proforma.taxa_cambio || 850;

  const headerOpts = {
    title: 'Nota Proforma Consolidada',
    subtitle: `N.º ${proforma.numero_proforma || proforma.id?.slice(0, 8)}`,
    date: proforma.data_emissao || proforma.created_date?.split('T')[0] || '',
    logoBase64,
  };

  let y = addHeader(doc, headerOpts);

  // Compact info line
  const infoItems = [
    { label: 'Companhia', value: companhia?.nome || '-' },
  ];
  if (proforma.periodo_inicio || proforma.periodo_fim) {
    infoItems.push({ label: 'Período', value: `${proforma.periodo_inicio || '...'} a ${proforma.periodo_fim || '...'}` });
  }
  if (aeroporto) {
    infoItems.push({ label: 'Aeroporto', value: aeroporto?.nome ? `${aeroporto.nome} (${aeroporto.codigo_icao})` : aeroporto?.codigo_icao || '-' });
  }
  infoItems.push({ label: 'Voos', value: `${consolidatedItems.length}` });
  y = addInfoBox(doc, y, infoItems);

  // ─── Scan items to determine dynamic columns ───

  // 1) Outras Tarifas: iluminação, check-in, CUPPSS, etc. (from detalhes_calculo)
  const outrasTarifaTypes = new Map(); // key -> label
  consolidatedItems.forEach(item => {
    const det = item.calculo?.detalhes_calculo || {};
    // Iluminação is stored separately
    if (det.iluminacao?.valor > 0) {
      outrasTarifaTypes.set('iluminacao', 'Ilumin.');
    }
    // Other tariff types from detalhes_calculo.outras[]
    (det.outras || []).forEach(o => {
      if ((o.valor || 0) > 0 && o.tipo) {
        outrasTarifaTypes.set(o.tipo, getOutraTarifaShortLabel(o.tipo));
      }
    });
  });

  // Sort: iluminação first, then checkin, cuppss, others alphabetically
  const outrasTarifaOrder = ['iluminacao', 'checkin', 'cuppss', 'embarque', 'transito_direto', 'transito_transbordo'];
  const sortedOutrasTarifaKeys = [...outrasTarifaTypes.keys()].sort((a, b) => {
    const ia = outrasTarifaOrder.indexOf(a);
    const ib = outrasTarifaOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // 2) Recursos de Solo: PCA, GPU, PBB only (combustível é estatístico, checkin migrou p/ outras tarifas)
  const resourceTypes = new Map();
  consolidatedItems.forEach(item => {
    const recursos = item.calculo?.detalhes_calculo?.recursos?.itens || [];
    recursos.forEach(r => {
      const key = normalizeResourceKey(r.tipo);
      if (key !== 'combustivel' && key !== 'checkin') {
        resourceTypes.set(key, r.tipo);
      }
    });
  });

  const resourceOrder = ['pca', 'gpu', 'pbb'];
  const sortedResourceKeys = [...resourceTypes.keys()].sort((a, b) => {
    const ia = resourceOrder.indexOf(a);
    const ib = resourceOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // ─── Build columns ───
  // Available width: 297 - 10 - 10 = 277mm (landscape A4 with slim margins)
  const m = { left: 10, right: 10 };
  const tableWidth = 297 - m.left - m.right;

  // Fixed columns
  const fixedCols = [
    { label: 'Registo', width: 15 },
    { label: 'PMD(t)', width: 13, align: 'right' },
    { label: 'Tipo', width: 10 },
    { label: 'Voo (A/D)', width: 18 },
    { label: 'Aterragem', width: 22 },
    { label: 'Descolagem', width: 22 },
    { label: 'TX Aterr.', width: 15, align: 'right' },
    { label: 'Estac.', width: 14, align: 'right' },
    { label: 'Taxa Emb.', width: 15, align: 'right' },
  ];

  // Dynamic "outras tarifas" columns (1 col each — just value)
  const outrasTarifaCols = sortedOutrasTarifaKeys.map(key => ({
    label: outrasTarifaTypes.get(key),
    width: 14,
    align: 'right',
  }));

  // Dynamic resource columns (2 cols per resource: duration + value)
  const resourceCols = [];
  sortedResourceKeys.forEach(key => {
    const label = getResourceShortLabel(key);
    resourceCols.push({ label: `${label}(h)`, width: 11, align: 'right' });
    resourceCols.push({ label: `${label}($)`, width: 14, align: 'right' });
  });

  // Determine IVA percentage from first item that has it
  let ivaPercent = '';
  for (const item of consolidatedItems) {
    const impostos = item.calculo?.detalhes_calculo?.impostos;
    if (impostos?.length > 0 && impostos[0].valor_configurado) {
      ivaPercent = ` ${impostos[0].valor_configurado}%`;
      break;
    }
  }

  // Final columns
  const finalCols = [
    { label: `IVA${ivaPercent}`, width: 14, align: 'right' },
    { label: 'TOTAL', width: 18, align: 'right' },
  ];

  const allCols = [...fixedCols, ...outrasTarifaCols, ...resourceCols, ...finalCols];

  // Scale columns to fit tableWidth
  const totalDefinedWidth = allCols.reduce((s, c) => s + c.width, 0);
  if (totalDefinedWidth !== tableWidth) {
    const scale = tableWidth / totalDefinedWidth;
    allCols.forEach(col => { col.width = col.width * scale; });
  }

  // ─── Build rows ───
  const totals = {
    pouso: 0, estac: 0, passag: 0, iva: 0, total: 0,
  };
  const outrasTarifaTotals = {};
  sortedOutrasTarifaKeys.forEach(key => { outrasTarifaTotals[key] = 0; });
  const resourceTotals = {};
  sortedResourceKeys.forEach(key => {
    resourceTotals[`${key}_h`] = 0;
    resourceTotals[`${key}_v`] = 0;
  });

  const rows = consolidatedItems.map(item => {
    const c = item.calculo;
    const det = c?.detalhes_calculo || {};
    const arrVoo = item.vooArr;
    const depVoo = item.vooDep || item.voo;

    // Registo (matrícula)
    const registo = arrVoo?.registo_aeronave || depVoo?.registo_aeronave || '-';

    // MTOW
    const mtowKg = det.pouso?.mtowKg || c?.mtow_kg || arrVoo?.peso_maximo_descolagem || 0;
    const mtowT = mtowKg > 0 ? (mtowKg / 1000) : 0;

    // Tipo de voo (DOM/INT)
    const tipoRaw = det.passageiros?.tipoVoo || arrVoo?.tipo_voo || depVoo?.tipo_voo || '';
    const tipo = tipoRaw.toLowerCase().includes('dom') ? 'DOM'
      : tipoRaw.toLowerCase().includes('int') ? 'INT'
      : tipoRaw ? tipoRaw.substring(0, 3).toUpperCase() : '';

    // Voo ARR/DEP consolidated
    const arrNum = arrVoo?.numero_voo || '';
    const depNum = depVoo?.numero_voo || '';
    const vooStr = arrNum && depNum && arrNum !== depNum
      ? `${arrNum}/${depNum}`
      : arrNum || depNum || '-';

    // ARR date+time
    const arrDate = arrVoo?.data_operacao || '';
    const arrTime = arrVoo?.horario_real || arrVoo?.horario_previsto || '';
    const arrStr = arrDate ? `${fmtDate(arrDate)} ${arrTime}` : '';

    // DEP date+time
    const depDate = depVoo?.data_operacao || '';
    const depTime = depVoo?.horario_real || depVoo?.horario_previsto || '';
    const depStr = depDate ? `${fmtDate(depDate)} ${depTime}` : '';

    // Fixed tariff values
    const pouso = c?.tarifa_pouso_usd || 0;
    const estac = c?.tarifa_permanencia_usd || 0;
    const passag = c?.tarifa_passageiros_usd || 0;

    // Outras tarifas per type
    const outrasTarifaMap = {};
    // Iluminação from its own field
    if (det.iluminacao?.valor > 0) {
      outrasTarifaMap['iluminacao'] = det.iluminacao.valor;
    }
    // Other types from detalhes_calculo.outras[]
    (det.outras || []).forEach(o => {
      if ((o.valor || 0) > 0 && o.tipo) {
        outrasTarifaMap[o.tipo] = (outrasTarifaMap[o.tipo] || 0) + o.valor;
      }
    });

    // IVA
    let iva = 0;
    if (det.impostos) {
      det.impostos.forEach(imp => { iva += imp.valor_usd || 0; });
    }

    const totalVal = c?.total_tarifa_usd || item.valor_usd || 0;

    // Accumulate totals
    totals.pouso += pouso;
    totals.estac += estac;
    totals.passag += passag;
    totals.iva += iva;
    totals.total += totalVal;

    // Resource values (PCA, GPU, PBB only)
    const recursos = det.recursos?.itens || [];
    const resourceMap = {};
    recursos.forEach(r => {
      const key = normalizeResourceKey(r.tipo);
      if (key !== 'combustivel' && key !== 'checkin') {
        resourceMap[key] = { h: r.tempo_horas || 0, v: r.valor_usd || 0 };
      }
    });

    // Build row array
    const row = [
      registo,
      mtowT > 0 ? fmtNum(mtowT, 1) : '',
      tipo,
      vooStr,
      arrStr,
      depStr,
      pouso > 0 ? fmtNum(pouso) : '',
      estac > 0 ? fmtNum(estac) : '',
      passag > 0 ? fmtNum(passag) : '',
    ];

    // Outras tarifas columns (value only)
    sortedOutrasTarifaKeys.forEach(key => {
      const val = outrasTarifaMap[key] || 0;
      row.push(val > 0 ? fmtNum(val) : '');
      outrasTarifaTotals[key] += val;
    });

    // Resource columns (h + $)
    sortedResourceKeys.forEach(key => {
      const r = resourceMap[key];
      const hVal = r?.h || 0;
      const vVal = r?.v || 0;
      row.push(hVal > 0 ? fmtNum(hVal, 2) : '');
      row.push(vVal > 0 ? fmtNum(vVal) : '');
      resourceTotals[`${key}_h`] += hVal;
      resourceTotals[`${key}_v`] += vVal;
    });

    // IVA + Total
    row.push(iva > 0 ? fmtNum(iva) : '');
    row.push(fmtNum(totalVal));

    return row;
  });

  // ─── Totals row ───
  const totalRow = [
    'TOTAIS', '', '', '', '', '',
    fmtNum(totals.pouso),
    fmtNum(totals.estac),
    fmtNum(totals.passag),
  ];
  sortedOutrasTarifaKeys.forEach(key => {
    totalRow.push(fmtNum(outrasTarifaTotals[key]));
  });
  sortedResourceKeys.forEach(key => {
    totalRow.push('');
    totalRow.push(fmtNum(resourceTotals[`${key}_v`]));
  });
  totalRow.push(fmtNum(totals.iva));
  totalRow.push(fmtNum(totals.total));

  rows.push(totalRow);

  // ─── Draw table ───
  y = addSectionTitle(doc, y, 'Discriminação por Voo (valores em USD)');

  // Use custom table drawing with smaller font for landscape
  y = addTable(doc, y, {
    columns: allCols,
    rows,
    rowHeight: 5,
    fontSize: 6,
    headerOpts,
  });

  // ─── Summary box at bottom ───
  y = checkPageBreak(doc, y, 25);
  y += 2;

  const subtotalUsd = totals.total - totals.iva;
  const summaryItems = [
    { label: 'Subtotal (sem impostos)', value: `${formatUSD(subtotalUsd)}  =  ${formatCurrency(subtotalUsd * cambio)}` },
    { label: 'Impostos (IVA)', value: `${formatUSD(totals.iva)}  =  ${formatCurrency(totals.iva * cambio)}` },
    { label: 'TOTAL', value: `${formatUSD(totals.total)}  =  ${formatCurrency(totals.total * cambio)}` },
  ];
  y = addKeyValuePairs(doc, y, summaryItems, { labelWidth: 50 });

  // Observations
  if (proforma.observacoes) {
    y = checkPageBreak(doc, y, 15);
    doc.setFontSize(PDF.font.small);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF.colors.dark);
    const pageWidth = doc.internal.pageSize.getWidth();
    const obsLines = doc.splitTextToSize(proforma.observacoes, pageWidth - 20);
    doc.text(obsLines, 10, y);
  }

  addFooter(doc, { generatedBy: proforma.emitida_por || 'Sistema' });

  return await uploadAndReturn(doc, proforma, proforma_id);
}


// ─── Helpers ─────────────────────────────────────────────────────────

function normalizeResourceKey(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('pca') || t.includes('condicionado')) return 'pca';
  if (t.includes('gpu') || t.includes('ground power')) return 'gpu';
  if (t.includes('pbb') || t.includes('ponte')) return 'pbb';
  if (t.includes('combust')) return 'combustivel';
  if (t.includes('check')) return 'checkin';
  return t.replace(/[^a-z0-9]/g, '_').slice(0, 15);
}

function getResourceShortLabel(key) {
  const labels = { pca: 'PCA', gpu: 'GPU', pbb: 'PBB' };
  return labels[key] || key.toUpperCase().slice(0, 5);
}

function getOutraTarifaShortLabel(key) {
  const labels = {
    iluminacao: 'Ilumin.',
    checkin: 'ChkIn',
    cuppss: 'CUPPSS',
    embarque: 'Embarq.',
    transito_direto: 'Trans.D',
    transito_transbordo: 'Trans.T',
    seguranca: 'Segur.',
    assistencia_especial: 'Ass.Esp',
    fast_track: 'FastTrk',
    assistencia_bagagem: 'Ass.Bag',
    brs: 'BRS',
  };
  return labels[key] || key.slice(0, 7);
}

// ─── Extrato de Facturação (client-side PDF, no DB record) ─────────

export async function gerarRelatorioFaturacaoPdf({
  calculos, companhia, aeroporto, periodo_inicio, periodo_fim,
  voos, voosLigados, proformasMap,
  groupedByCompanhia, // optional: array of { nome, calculos: rawCalcArray[] } for "Todas as Companhias"
}) {
  const { fetchEmpresaLogo } = await import('@/lib/pdfTemplate');

  // Build consolidated items from the raw calculos + voos + voosLigados
  const voosMap = new Map(voos.map(v => [v.id, v]));
  const vlMap = new Map(voosLigados.map(vl => [vl.id, vl]));

  // Fetch all aeroportos for display
  const { data: allAeroportos } = await supabase.from('aeroporto').select('*');

  const consolidatedItems = calculos.map(calc => {
    const itemVoo = voosMap.get(calc.voo_id);
    const itemVL = vlMap.get(calc.voo_ligado_id);
    const depVoo = itemVL ? voosMap.get(itemVL.id_voo_dep) : null;
    const arrVoo = itemVL ? voosMap.get(itemVL.id_voo_arr) : null;
    const itemAero = calc.aeroporto_id
      ? (allAeroportos || []).find(a => a.id === calc.aeroporto_id || a.codigo_icao === calc.aeroporto_id)
      : null;

    return {
      calculo_tarifa_id: calc.id,
      voo_id: calc.voo_id,
      voo_ligado_id: calc.voo_ligado_id,
      valor_usd: calc.total_tarifa_usd || 0,
      valor_aoa: calc.total_tarifa || 0,
      calculo: calc,
      voo: depVoo || itemVoo,
      vooArr: arrVoo,
      vooDep: depVoo,
      vooLigado: itemVL,
      aeroporto: itemAero,
      // Proforma number (if exists)
      numero_proforma: proformasMap?.get(calc.id) || null,
    };
  });

  // Fetch empresa logo
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
  const fmtNum = (value, decimals = 2) => {
    if (!value && value !== 0) return '';
    return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  };
  const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  // Average exchange rate
  const cambioSum = calculos.reduce((s, c) => s + (c.taxa_cambio_usd_aoa || 0), 0);
  const cambio = calculos.length > 0 ? Math.round(cambioSum / calculos.length) : 850;

  // Synthetic proforma object for generateConsolidatedLandscape
  const syntheticProforma = {
    numero_proforma: null,
    tipo: 'consolidada',
    taxa_cambio: cambio,
    periodo_inicio,
    periodo_fim,
    data_emissao: new Date().toISOString().split('T')[0],
    observacoes: null,
  };

  // Build groups for grouped mode (Todas as Companhias)
  let groupsParam = undefined;
  if (groupedByCompanhia && groupedByCompanhia.length > 0) {
    groupsParam = groupedByCompanhia.map(g => {
      const groupItems = g.calculos.map(calc => {
        const itemVoo = voosMap.get(calc.voo_id);
        const itemVL = vlMap.get(calc.voo_ligado_id);
        const depVoo = itemVL ? voosMap.get(itemVL.id_voo_dep) : null;
        const arrVoo = itemVL ? voosMap.get(itemVL.id_voo_arr) : null;
        const itemAero = calc.aeroporto_id
          ? (allAeroportos || []).find(a => a.id === calc.aeroporto_id || a.codigo_icao === calc.aeroporto_id)
          : null;
        return {
          calculo_tarifa_id: calc.id,
          voo_id: calc.voo_id,
          voo_ligado_id: calc.voo_ligado_id,
          valor_usd: calc.total_tarifa_usd || 0,
          valor_aoa: calc.total_tarifa || 0,
          calculo: calc,
          voo: depVoo || itemVoo,
          vooArr: arrVoo,
          vooDep: depVoo,
          vooLigado: itemVL,
          aeroporto: itemAero,
          numero_proforma: proformasMap?.get(calc.id) || null,
        };
      });
      return { nome: g.nome, calculos: groupItems };
    });
  }

  // Generate landscape PDF using the existing generator
  const result = await generateExtratoLandscape({
    proforma: syntheticProforma,
    companhia,
    aeroporto,
    consolidatedItems,
    logoBase64,
    formatCurrency,
    formatUSD,
    fmtNum,
    fmtDate,
    groups: groupsParam,
  });

  const doc = result._doc;
  const compNome = groupedByCompanhia ? 'TODAS' : (companhia?.codigo_icao || 'COMP');
  const dataStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `Extrato_Facturacao_${compNome}_${periodo_inicio || ''}_${periodo_fim || ''}_${dataStr}.pdf`;

  // If returnBase64 requested, return the PDF as base64 + filename (for email)
  if (arguments[0]?.returnBase64) {
    const base64 = doc.output('datauristring').split(',')[1];
    return { base64, filename };
  }

  // Direct download (no upload, no DB record)
  doc.save(filename);
}

// ─── Extrato Landscape Generator (based on consolidated, with N.º PF column) ───

async function generateExtratoLandscape({
  proforma, companhia, aeroporto, consolidatedItems,
  logoBase64, formatCurrency, formatUSD, fmtNum, fmtDate,
  groups, // optional: array of { nome, calculos: consolidatedItems[] } for grouped mode
}) {
  const { createPdfDoc, addHeader, addFooter, addTable, addKeyValuePairs, addSectionTitle, addInfoBox, checkPageBreak, PDF } = await import('@/lib/pdfTemplate');

  const doc = await createPdfDoc({ orientation: 'landscape' });
  const cambio = proforma.taxa_cambio || 850;

  // Short date helper (YYYY-MM-DD → DD/MM/YYYY)
  const fmtDateFull = (d) => {
    if (!d) return '...';
    const p = d.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
  };

  const headerOpts = {
    title: 'Extrato de Facturação',
    subtitle: proforma.numero_proforma
      ? `N.º ${proforma.numero_proforma}`
      : '',
    date: '', // no date at top
    logoBase64,
  };

  let y = addHeader(doc, headerOpts);

  // Compact info line
  const infoItems = [
    { label: 'Companhia', value: groups ? 'Todas as Companhias' : (companhia?.nome || '-') },
  ];
  if (proforma.periodo_inicio || proforma.periodo_fim) {
    infoItems.push({ label: 'Período', value: `${fmtDateFull(proforma.periodo_inicio)} a ${fmtDateFull(proforma.periodo_fim)}` });
  }
  if (aeroporto) {
    infoItems.push({ label: 'Aeroporto', value: aeroporto?.nome ? `${aeroporto.nome} (${aeroporto.codigo_icao})` : aeroporto?.codigo_icao || '-' });
  }
  const totalVoos = groups ? groups.reduce((s, g) => s + g.calculos.length, 0) : consolidatedItems.length;
  infoItems.push({ label: 'Voos', value: `${totalVoos}` });
  if (groups) {
    infoItems.push({ label: 'Companhias', value: `${groups.length}` });
  }
  y = addInfoBox(doc, y, infoItems);

  // ─── Scan items to determine dynamic columns (same logic as consolidated) ───
  // In grouped mode, scan all items across all groups
  const allItemsForScan = groups
    ? groups.flatMap(g => g.calculos)
    : consolidatedItems;

  const outrasTarifaTypes = new Map();
  allItemsForScan.forEach(item => {
    const det = item.calculo?.detalhes_calculo || {};
    if (det.iluminacao?.valor > 0) outrasTarifaTypes.set('iluminacao', 'Ilumin.');
    (det.outras || []).forEach(o => {
      if ((o.valor || 0) > 0 && o.tipo) outrasTarifaTypes.set(o.tipo, getOutraTarifaShortLabel(o.tipo));
    });
  });

  const outrasTarifaOrder = ['iluminacao', 'checkin', 'cuppss', 'embarque', 'transito_direto', 'transito_transbordo'];
  const sortedOutrasTarifaKeys = [...outrasTarifaTypes.keys()].sort((a, b) => {
    const ia = outrasTarifaOrder.indexOf(a);
    const ib = outrasTarifaOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const resourceTypes = new Map();
  allItemsForScan.forEach(item => {
    const recursos = item.calculo?.detalhes_calculo?.recursos?.itens || [];
    recursos.forEach(r => {
      const key = normalizeResourceKey(r.tipo);
      if (key !== 'combustivel' && key !== 'checkin') resourceTypes.set(key, r.tipo);
    });
  });

  const resourceOrder = ['pca', 'gpu', 'pbb'];
  const sortedResourceKeys = [...resourceTypes.keys()].sort((a, b) => {
    const ia = resourceOrder.indexOf(a);
    const ib = resourceOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // ─── Build columns ───
  const m = { left: 2, right: 2 };
  const tableWidth = 297 - m.left - m.right;

  const fixedCols = [
    { label: 'Nº', width: 8, align: 'center' },
    { label: 'Registo', width: 16 },
    { label: 'PMD(t)', width: 13, align: 'right' },
    { label: 'Tipo', width: 10 },
    { label: 'Voo (A/D)', width: 22 },
    { label: 'Aterragem', width: 22 },
    { label: 'Descolagem', width: 22 },
    { label: 'TX Aterr.', width: 14, align: 'right' },
    { label: 'Estac.(h)', width: 11, align: 'right' },
    { label: 'Estac.($)', width: 13, align: 'right' },
    { label: 'Emb.(pax)', width: 11, align: 'right' },
    { label: 'Emb.($)', width: 13, align: 'right' },
  ];

  const outrasTarifaCols = sortedOutrasTarifaKeys.map(key => ({
    label: outrasTarifaTypes.get(key),
    width: 14,
    align: 'right',
  }));

  const resourceCols = [];
  sortedResourceKeys.forEach(key => {
    const label = getResourceShortLabel(key);
    resourceCols.push({ label: `${label}(h)`, width: 11, align: 'right' });
    resourceCols.push({ label: `${label}($)`, width: 14, align: 'right' });
  });

  let ivaPercent = '';
  for (const item of allItemsForScan) {
    const impostos = item.calculo?.detalhes_calculo?.impostos;
    if (impostos?.length > 0 && impostos[0].valor_configurado) {
      ivaPercent = ` ${impostos[0].valor_configurado}%`;
      break;
    }
  }

  const finalCols = [
    { label: `IVA${ivaPercent}`, width: 14, align: 'right' },
    { label: 'TOTAL', width: 18, align: 'right' },
  ];

  const allCols = [...fixedCols, ...outrasTarifaCols, ...resourceCols, ...finalCols];

  const totalDefinedWidth = allCols.reduce((s, c) => s + c.width, 0);
  if (totalDefinedWidth !== tableWidth) {
    const scale = tableWidth / totalDefinedWidth;
    allCols.forEach(col => { col.width = col.width * scale; });
  }

  // ─── Helper: build rows + totals from a list of items ───
  function buildRowsWithTotals(items, totalLabel = 'TOTAIS') {
    const t = { pouso: 0, estac_h: 0, estac: 0, passag_pax: 0, passag: 0, iva: 0, total: 0 };
    const oTotals = {};
    sortedOutrasTarifaKeys.forEach(key => { oTotals[key] = 0; });
    const rTotals = {};
    sortedResourceKeys.forEach(key => {
      rTotals[`${key}_h`] = 0;
      rTotals[`${key}_v`] = 0;
    });

    const rows = items.map((item, index) => {
      const c = item.calculo;
      const det = c?.detalhes_calculo || {};
      const arrVoo = item.vooArr;
      const depVoo = item.vooDep || item.voo;

      const registo = arrVoo?.registo_aeronave || depVoo?.registo_aeronave || '-';
      const mtowKg = det.pouso?.mtowKg || c?.mtow_kg || arrVoo?.peso_maximo_descolagem || 0;
      const mtowT = mtowKg > 0 ? (mtowKg / 1000) : 0;

      const tipoRaw = det.passageiros?.tipoVoo || arrVoo?.tipo_voo || depVoo?.tipo_voo || '';
      const tipo = tipoRaw.toLowerCase().includes('dom') ? 'DOM'
        : tipoRaw.toLowerCase().includes('int') ? 'INT'
        : tipoRaw ? tipoRaw.substring(0, 3).toUpperCase() : '';

      const arrNum = arrVoo?.numero_voo || '';
      const depNum = depVoo?.numero_voo || '';
      const vooStr = arrNum && depNum && arrNum !== depNum
        ? `${arrNum}/${depNum}`
        : arrNum || depNum || '-';

      const arrDate = arrVoo?.data_operacao || '';
      const arrTime = arrVoo?.horario_real || arrVoo?.horario_previsto || '';
      const arrStr = arrDate ? `${fmtDate(arrDate)} ${arrTime}` : '';

      const depDate = depVoo?.data_operacao || '';
      const depTime = depVoo?.horario_real || depVoo?.horario_previsto || '';
      const depStr = depDate ? `${fmtDate(depDate)} ${depTime}` : '';

      const pouso = c?.tarifa_pouso_usd || 0;
      const estacHoras = c?.tempo_permanencia_horas || det.permanencia?.tempoEstacionamento || 0;
      const estacVal = c?.tarifa_permanencia_usd || 0;
      const passagPax = det.passageiros?.totalPassageirosCobranca || det.passageiros?.passageirosDep || 0;
      const passag = c?.tarifa_passageiros_usd || 0;

      const outrasTarifaMap = {};
      if (det.iluminacao?.valor > 0) outrasTarifaMap['iluminacao'] = det.iluminacao.valor;
      (det.outras || []).forEach(o => {
        if ((o.valor || 0) > 0 && o.tipo) outrasTarifaMap[o.tipo] = (outrasTarifaMap[o.tipo] || 0) + o.valor;
      });

      let iva = 0;
      if (det.impostos) det.impostos.forEach(imp => { iva += imp.valor_usd || 0; });

      const totalVal = c?.total_tarifa_usd || item.valor_usd || 0;

      t.pouso += pouso;
      t.estac_h += estacHoras;
      t.estac += estacVal;
      t.passag_pax += passagPax;
      t.passag += passag;
      t.iva += iva;
      t.total += totalVal;

      const recursos = det.recursos?.itens || [];
      const resourceMap = {};
      recursos.forEach(r => {
        const key = normalizeResourceKey(r.tipo);
        if (key !== 'combustivel' && key !== 'checkin') {
          resourceMap[key] = { h: r.tempo_horas || 0, v: r.valor_usd || 0 };
        }
      });

      const row = [
        String(index + 1),
        registo,
        mtowT > 0 ? fmtNum(mtowT, 1) : '',
        tipo,
        vooStr,
        arrStr,
        depStr,
      ];

      row.push(pouso > 0 ? fmtNum(pouso) : '');
      row.push(estacHoras > 0 ? fmtNum(estacHoras, 1) : '');
      row.push(estacVal > 0 ? fmtNum(estacVal) : '');
      row.push(passagPax > 0 ? fmtNum(passagPax, 0) : '');
      row.push(passag > 0 ? fmtNum(passag) : '');

      sortedOutrasTarifaKeys.forEach(key => {
        const val = outrasTarifaMap[key] || 0;
        row.push(val > 0 ? fmtNum(val) : '');
        oTotals[key] += val;
      });

      sortedResourceKeys.forEach(key => {
        const r = resourceMap[key];
        const hVal = r?.h || 0;
        const vVal = r?.v || 0;
        row.push(hVal > 0 ? fmtNum(hVal, 2) : '');
        row.push(vVal > 0 ? fmtNum(vVal) : '');
        rTotals[`${key}_h`] += hVal;
        rTotals[`${key}_v`] += vVal;
      });

      row.push(iva > 0 ? fmtNum(iva) : '');
      row.push(fmtNum(totalVal));

      return row;
    });

    // Totals row: label in Registo column (index 1) for visibility, rest empty until numeric cols
    const totalRow = ['', totalLabel, '', '', '', '', ''];
    totalRow.push(fmtNum(t.pouso));        // TX Aterr
    totalRow.push(fmtNum(t.estac_h, 1));   // Estac(h)
    totalRow.push(fmtNum(t.estac));        // Estac($)
    totalRow.push(fmtNum(t.passag_pax, 0)); // Emb(pax)
    totalRow.push(fmtNum(t.passag));       // Emb($)
    sortedOutrasTarifaKeys.forEach(key => {
      totalRow.push(fmtNum(oTotals[key]));
    });
    sortedResourceKeys.forEach(key => {
      totalRow.push('');
      totalRow.push(fmtNum(rTotals[`${key}_v`]));
    });
    totalRow.push(fmtNum(t.iva));
    totalRow.push(fmtNum(t.total));
    rows.push(totalRow);

    return { rows, totals: t, outrasTarifaTotals: oTotals, resourceTotals: rTotals };
  }

  // ─── Render table(s) ───
  if (groups && groups.length > 0) {
    // Grouped mode: first pre-compute all group totals for the summary page
    const grandTotals = { pouso: 0, estac_h: 0, estac: 0, passag_pax: 0, passag: 0, iva: 0, total: 0 };
    const grandOutrasTarifaTotals = {};
    sortedOutrasTarifaKeys.forEach(key => { grandOutrasTarifaTotals[key] = 0; });
    const grandResourceTotals = {};
    sortedResourceKeys.forEach(key => {
      grandResourceTotals[`${key}_h`] = 0;
      grandResourceTotals[`${key}_v`] = 0;
    });

    // Pre-build all groups to collect totals
    const perGroupData = groups.map(group => {
      const { rows, totals: gTotals, outrasTarifaTotals: gOT, resourceTotals: gRT } = buildRowsWithTotals(group.calculos, 'SUBTOTAL');
      grandTotals.pouso += gTotals.pouso;
      grandTotals.estac_h += gTotals.estac_h;
      grandTotals.estac += gTotals.estac;
      grandTotals.passag_pax += gTotals.passag_pax;
      grandTotals.passag += gTotals.passag;
      grandTotals.iva += gTotals.iva;
      grandTotals.total += gTotals.total;
      sortedOutrasTarifaKeys.forEach(key => { grandOutrasTarifaTotals[key] += gOT[key]; });
      sortedResourceKeys.forEach(key => {
        grandResourceTotals[`${key}_h`] += gRT[`${key}_h`];
        grandResourceTotals[`${key}_v`] += gRT[`${key}_v`];
      });
      return { nome: group.nome, count: group.calculos.length, rows, totals: gTotals, outrasTarifaTotals: gOT, resourceTotals: gRT };
    });

    // ─── TOTAL GERAL summary page (FIRST, before per-companhia detail tables) ───
    y = addSectionTitle(doc, y, 'TOTAL GERAL — Todas as Companhias (valores em USD)');

    // Simplified summary columns
    const summaryCols = [
      { label: 'Companhia', width: 60 },
      { label: 'Voos', width: 15, align: 'right' },
      { label: 'TX Aterr.', width: 18, align: 'right' },
      { label: 'Estac.', width: 18, align: 'right' },
      { label: 'Emb.', width: 18, align: 'right' },
      { label: 'Outras', width: 18, align: 'right' },
      { label: 'Recursos', width: 18, align: 'right' },
      { label: `IVA${ivaPercent}`, width: 18, align: 'right' },
      { label: 'TOTAL', width: 22, align: 'right' },
    ];

    // Scale summary columns to fit tableWidth
    const summaryTotalWidth = summaryCols.reduce((s, c) => s + c.width, 0);
    if (summaryTotalWidth !== tableWidth) {
      const sScale = tableWidth / summaryTotalWidth;
      summaryCols.forEach(col => { col.width = col.width * sScale; });
    }

    // Build summary rows: one per companhia
    const summaryRows = perGroupData.map(pg => {
      const outrasTotal = sortedOutrasTarifaKeys.reduce((s, key) => s + (pg.outrasTarifaTotals[key] || 0), 0);
      const recursosTotal = sortedResourceKeys.reduce((s, key) => s + (pg.resourceTotals[`${key}_v`] || 0), 0);
      return [
        pg.nome,
        String(pg.count),
        fmtNum(pg.totals.pouso),
        fmtNum(pg.totals.estac),
        fmtNum(pg.totals.passag),
        outrasTotal > 0 ? fmtNum(outrasTotal) : '',
        recursosTotal > 0 ? fmtNum(recursosTotal) : '',
        fmtNum(pg.totals.iva),
        fmtNum(pg.totals.total),
      ];
    });

    // Grand total row
    const outrasGrandTotal = sortedOutrasTarifaKeys.reduce((s, key) => s + (grandOutrasTarifaTotals[key] || 0), 0);
    const recursosGrandTotal = sortedResourceKeys.reduce((s, key) => s + (grandResourceTotals[`${key}_v`] || 0), 0);
    summaryRows.push([
      'TOTAL GERAL',
      String(totalVoos),
      fmtNum(grandTotals.pouso),
      fmtNum(grandTotals.estac),
      fmtNum(grandTotals.passag),
      outrasGrandTotal > 0 ? fmtNum(outrasGrandTotal) : '',
      recursosGrandTotal > 0 ? fmtNum(recursosGrandTotal) : '',
      fmtNum(grandTotals.iva),
      fmtNum(grandTotals.total),
    ]);

    y = addTable(doc, y, {
      columns: summaryCols,
      rows: summaryRows,
      rowHeight: 6,
      fontSize: 7,
      headerOpts,
    });

    // ─── Per-companhia detail tables (each on new page) ───
    for (let gi = 0; gi < perGroupData.length; gi++) {
      const pgd = perGroupData[gi];
      doc.addPage();
      y = addHeader(doc, headerOpts);

      y = addSectionTitle(doc, y, `${pgd.nome} — Discriminação por Voo (valores em USD)`);

      y = addTable(doc, y, {
        columns: allCols,
        rows: pgd.rows,
        rowHeight: 5,
        fontSize: 6,
        headerOpts,
      });
    }
  } else {
    // Single mode (original behavior)
    const { rows } = buildRowsWithTotals(consolidatedItems);

    y = addSectionTitle(doc, y, 'Discriminação por Voo (valores em USD)');
    y = addTable(doc, y, {
      columns: allCols,
      rows,
      rowHeight: 5,
      fontSize: 6,
      headerOpts,
    });
  }

  addFooter(doc, { generatedBy: 'Sistema' });

  return { _doc: doc };
}


async function uploadAndReturn(doc, proforma, proforma_id) {
  const pdfArrayBuffer = doc.output('arraybuffer');
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

  await supabase
    .from('proforma')
    .update({ pdf_url })
    .eq('id', proforma_id);

  return { data: { pdf_url }, proforma };
}
