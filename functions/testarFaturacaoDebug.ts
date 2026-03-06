import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try {
      const clonedReq = req.clone();
      payload = await clonedReq.json();
    } catch (e) {
      console.log('⚠️ Sem payload JSON');
    }

    const { dataInicio, dataFim, aeroporto_icao } = payload;

    if (!dataInicio || !dataFim || !aeroporto_icao) {
      return Response.json({ 
        error: 'Parâmetros obrigatórios: dataInicio, dataFim, aeroporto_icao' 
      }, { status: 400 });
    }

    console.log(`\n🔍 TESTE DE FATURAÇÃO`);
    console.log(`📅 Período: ${dataInicio} a ${dataFim}`);
    console.log(`🏢 Aeroporto: ${aeroporto_icao}`);

    // 1. CARREGAR DADOS
    console.log(`\n⏳ Carregando dados...`);
    const [voos, voosLigados, calculosTarifaRaw] = await Promise.all([
      base44.entities.Voo.filter({
        data_operacao: { $gte: dataInicio, $lte: dataFim }
      }).catch(() => []),
      base44.entities.VooLigado.list().catch(() => []),
      base44.entities.CalculoTarifa.filter({}).catch(() => [])
    ]);

    // Validar tipo de calculosTarifa
    const calculosTarifa = Array.isArray(calculosTarifaRaw) ? calculosTarifaRaw : [];
    console.log(`✅ Carregados: ${voos.length} voos, ${voosLigados.length} ligados, ${calculosTarifa.length} cálculos`);

    // 2. FILTRAR VOOS DO AEROPORTO
    const voosAero = voos.filter(v => v.aeroporto_operacao === aeroporto_icao);
    console.log(`\n📊 Voos do aeroporto ${aeroporto_icao}: ${voosAero.length}`);
    voosAero.forEach(v => {
      console.log(`   - ${v.numero_voo} (${v.tipo_movimento}) em ${v.data_operacao}`);
    });

    // 3. FILTRAR VOOS DEP DO PERÍODO
    const voosDEP = voosAero.filter(v => v.tipo_movimento === 'DEP');
    console.log(`\n✈️ Voos DEP no período: ${voosDEP.length}`);
    voosDEP.forEach(v => console.log(`   - ${v.numero_voo} em ${v.data_operacao}`));

    const voosDEPIds = new Set(voosDEP.map(v => v.id));

    // 4. ENCONTRAR VOOS LIGADOS DESSES DEP
    const voosLigadosNoPeriodo = voosLigados.filter(vl => voosDEPIds.has(vl.id_voo_dep));
    console.log(`\n🔗 Voos ligados com DEP no período: ${voosLigadosNoPeriodo.length}`);
    voosLigadosNoPeriodo.forEach(vl => {
      console.log(`   - VooLigado ${vl.id} (ARR: ${vl.id_voo_arr}, DEP: ${vl.id_voo_dep})`);
    });

    // 5. ENCONTRAR CÁLCULOS DESSES VOOS LIGADOS
    console.log(`\n💰 Procurando CalculoTarifa...`);
    let totalFaturacao = 0;
    let totalFaturaçãoUSD = 0;
    const calculosEncontrados = [];

    voosLigadosNoPeriodo.forEach(vl => {
      const calculo = calculosTarifa.find(ct => 
        ct.voo_ligado_id === vl.id && 
        ct.aeroporto_id === aeroporto_icao
      );

      if (calculo) {
        const valorAOA = calculo.total_tarifa_com_impostos_aoa || calculo.total_tarifa || 0;
        const valorUSD = calculo.total_tarifa_com_impostos_usd || calculo.total_tarifa_usd || 0;
        
        console.log(`   ✅ CalculoTarifa ${calculo.id}:`);
        console.log(`      - total_tarifa: ${calculo.total_tarifa} AOA`);
        console.log(`      - total_tarifa_usd: ${calculo.total_tarifa_usd} USD`);
        console.log(`      - total_tarifa_com_impostos_aoa: ${calculo.total_tarifa_com_impostos_aoa} AOA`);
        console.log(`      - total_tarifa_com_impostos_usd: ${calculo.total_tarifa_com_impostos_usd} USD`);

        totalFaturacao += valorAOA;
        totalFaturaçãoUSD += valorUSD;
        calculosEncontrados.push(calculo);
      } else {
        console.log(`   ❌ Nenhum CalculoTarifa encontrado para VooLigado ${vl.id}`);
        console.log(`      Procurando por: voo_ligado_id=${vl.id} E aeroporto_id=${aeroporto_icao}`);
        
        // Debug: mostrar todos os cálculos desse voo_ligado
        const calculosdoVL = calculosTarifa.filter(ct => ct.voo_ligado_id === vl.id);
        if (calculosdoVL.length > 0) {
          console.log(`      Cálculos encontrados para este VooLigado:`);
          calculosdoVL.forEach(ct => {
            console.log(`         - aeroporto_id: ${ct.aeroporto_id}, total: ${ct.total_tarifa} AOA`);
          });
        }
      }
    });

    console.log(`\n✅ RESULTADO FINAL:`);
    console.log(`   Total em AOA: ${totalFaturacao.toFixed(2)}`);
    console.log(`   Total em USD: ${totalFaturaçãoUSD.toFixed(2)}`);
    console.log(`   Cálculos contabilizados: ${calculosEncontrados.length}`);

    return Response.json({
      dataInicio,
      dataFim,
      aeroporto_icao,
      voosTotal: voosAero.length,
      voosDEP: voosDEP.length,
      voosLigadosNoPeriodo: voosLigadosNoPeriodo.length,
      totalFaturacao: totalFaturacao.toFixed(2),
      totalFaturaçãoUSD: totalFaturaçãoUSD.toFixed(2),
      calculosEncontrados: calculosEncontrados.length,
      detalhes: calculosEncontrados.map(c => ({
        id: c.id,
        voo_ligado_id: c.voo_ligado_id,
        aeroporto_id: c.aeroporto_id,
        total_tarifa: c.total_tarifa,
        total_tarifa_usd: c.total_tarifa_usd
      }))
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});