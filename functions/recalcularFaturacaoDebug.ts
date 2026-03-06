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

    console.log(`\n🔄 RECALCULAR FATURAÇÃO`);
    console.log(`📅 Período: ${dataInicio} a ${dataFim}`);
    console.log(`🏢 Aeroporto: ${aeroporto_icao}`);

    // 1. CARREGAR DADOS
    console.log(`\n⏳ Carregando dados...`);
    const [voos, voosLigados, tarifas, aeroportos, companhias, modelos, registos, impostos] = await Promise.all([
      base44.entities.Voo.filter({
        data_operacao: { $gte: dataInicio, $lte: dataFim }
      }).catch(() => []),
      base44.entities.VooLigado.list().catch(() => []),
      base44.entities.TarifaPouso.list().catch(() => []),
      base44.entities.Aeroporto.list().catch(() => []),
      base44.entities.CompanhiaAerea.list().catch(() => []),
      base44.entities.ModeloAeronave.list().catch(() => []),
      base44.entities.RegistoAeronave.list().catch(() => []),
      base44.entities.Imposto.filter({ativo: true}).catch(() => [])
    ]);

    console.log(`✅ Carregados: ${voos.length} voos, ${voosLigados.length} ligados, ${tarifas.length} tarifas`);

    // 2. FILTRAR VOOS DO AEROPORTO E PERÍODO
    const voosAero = voos.filter(v => v.aeroporto_operacao === aeroporto_icao);
    console.log(`\n📊 Voos do aeroporto: ${voosAero.length}`);

    const voosDEP = voosAero.filter(v => v.tipo_movimento === 'DEP');
    const voosDEPIds = new Set(voosDEP.map(v => v.id));

    // 3. FILTRAR VOOS LIGADOS COM DEP NO PERÍODO
    const voosLigadosNoPeriodo = voosLigados.filter(vl => voosDEPIds.has(vl.id_voo_dep));
    console.log(`🔗 Voos ligados no período: ${voosLigadosNoPeriodo.length}`);

    // 4. MAPEAR DADOS PARA ACESSO RÁPIDO
    const voosMap = new Map(voos.map(v => [v.id, v]));
    const aeroportosMap = new Map(aeroportos.map(a => [a.codigo_icao, a]));
    const companhiasMap = new Map(companhias.map(c => [c.codigo_icao, c]));
    const modelosMap = new Map(modelos.map(m => [m.codigo_iata, m]));
    const registosMap = new Map(registos.map(r => [r.registo, r]));

    // 5. PROCESSAR CADA VOO LIGADO
    let calculosCriados = 0;
    let erros = 0;

    for (const vooLigado of voosLigadosNoPeriodo) {
      try {
        const vooArr = voosMap.get(vooLigado.id_voo_arr);
        const vooDep = voosMap.get(vooLigado.id_voo_dep);

        if (!vooDep) {
          console.log(`❌ Voo DEP não encontrado: ${vooLigado.id_voo_dep}`);
          erros++;
          continue;
        }

        const registo = registosMap.get(vooDep.registo_aeronave);
        if (!registo) {
          console.log(`❌ Registo não encontrado: ${vooDep.registo_aeronave}`);
          erros++;
          continue;
        }

        const modelo = modelosMap.get(registo.id_modelo_aeronave);
        const mtow = modelo?.mtow_kg || registo.mtow_kg || 0;

        // Taxa de câmbio fixa (usar a atual)
        const taxaCambio = 890; // AOA por USD (aproximado)

        // Buscar tarifa de pouso (simplificado)
        const tarifa = tarifas.find(t => t.aeroporto_id === aeroporto_icao);
        const tarifaPouso = tarifa?.valor_base_usd || 150;

        // Calcular tempo de permanência
        const tempoMinutos = vooLigado.tempo_permanencia_min || 0;
        const tempoHoras = tempoMinutos / 60;

        // Tarifa simples por MTOW
        const fatorMTOW = Math.ceil(mtow / 5000); // Fator simplificado
        const tarifaPousoPorVoo = tarifaPouso * fatorMTOW;
        const tarifaPermanencia = 50 * tempoHoras;

        const totalTarifaUSD = tarifaPousoPorVoo + tarifaPermanencia;
        const totalTarifa = totalTarifaUSD * taxaCambio;

        // Calcular impostos
        const totalImpostosUSD = totalTarifaUSD * 0.1; // 10% simplificado
        const totalImpostosAOA = totalImpostosUSD * taxaCambio;

        const totalComImpostosUSD = totalTarifaUSD + totalImpostosUSD;
        const totalComImpostosAOA = totalTarifa + totalImpostosAOA;

        // Criar CalculoTarifa
        const calculo = {
          voo_id: vooDep.id,
          voo_ligado_id: vooLigado.id,
          aeroporto_id: aeroporto_icao,
          data_calculo: new Date().toISOString(),
          tipo_tarifa: 'Tarifas de Voo Ligado',
          mtow_kg: mtow,
          taxa_cambio_usd_aoa: taxaCambio,
          tarifa_pouso_usd: tarifaPousoPorVoo,
          tarifa_pouso: tarifaPousoPorVoo * taxaCambio,
          tarifa_permanencia_usd: tarifaPermanencia,
          tarifa_permanencia: tarifaPermanencia * taxaCambio,
          tarifa_passageiros_usd: 0,
          tarifa_passageiros: 0,
          tarifa_carga_usd: 0,
          tarifa_carga: 0,
          outras_tarifas_usd: 0,
          outras_tarifas: 0,
          total_tarifa_usd: totalTarifaUSD,
          total_tarifa: totalTarifa,
          total_impostos_usd: totalImpostosUSD,
          total_impostos_aoa: totalImpostosAOA,
          total_tarifa_com_impostos_usd: totalComImpostosUSD,
          total_tarifa_com_impostos_aoa: totalComImpostosAOA,
          periodo_noturno: false,
          tempo_permanencia_horas: tempoHoras,
          detalhes_calculo: {
            voo_arr: vooArr?.numero_voo,
            voo_dep: vooDep.numero_voo,
            registo: vooDep.registo_aeronave,
            mtow,
            tempo_permanencia_min: tempoMinutos
          }
        };

        await base44.entities.CalculoTarifa.create(calculo);
        calculosCriados++;

        console.log(`✅ CalculoTarifa criado: ${vooDep.numero_voo} → $${totalComImpostosUSD.toFixed(2)} USD`);
      } catch (e) {
        console.error(`❌ Erro ao processar voo ligado ${vooLigado.id}: ${e.message}`);
        erros++;
      }
    }

    console.log(`\n✅ RESULTADO FINAL:`);
    console.log(`   Cálculos criados: ${calculosCriados}`);
    console.log(`   Erros: ${erros}`);

    return Response.json({
      dataInicio,
      dataFim,
      aeroporto_icao,
      voosTotal: voosAero.length,
      voosDEP: voosDEP.length,
      voosLigadosNoPeriodo: voosLigadosNoPeriodo.length,
      calculosCriados,
      erros
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});