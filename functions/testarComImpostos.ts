import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar voos de FNCT do dia 19/01/2026
    const voos = await base44.asServiceRole.entities.Voo.filter({
      aeroporto_operacao: 'FNCT',
      data_operacao: '2026-01-19'
    });

    console.log(`📌 Encontrados ${voos.length} voos`);

    // Buscar VooLigado
    const voosLigados = await base44.asServiceRole.entities.VooLigado.list();
    console.log(`📌 Total VooLigado: ${voosLigados.length}`);

    const vooIds = new Set(voos.map(v => v.id));
    const voosLigadosDoAeroporto = voosLigados.filter(vl => 
      vooIds.has(vl.id_voo_arr) && vooIds.has(vl.id_voo_dep)
    );

    console.log(`📌 VooLigado deste aeroporto/data: ${voosLigadosDoAeroporto.length}`);

    if (voosLigadosDoAeroporto.length === 0) {
      return Response.json({ 
        error: 'Sem voos ligados neste período',
        voos_totais: voos.length
      }, { status: 404 });
    }

    const vooLigado = voosLigadosDoAeroporto[0];
    console.log(`📌 Testando VooLigado: ${vooLigado.id}`);

    // Buscar CalculoTarifa deste voo ligado
    const calculos = await base44.asServiceRole.entities.CalculoTarifa.filter({
      voo_ligado_id: vooLigado.id
    });

    console.log(`📌 CalculoTarifa encontrados: ${calculos?.length || 0}`);

    if (!calculos || calculos.length === 0) {
      return Response.json({ 
        voo_ligado_id: vooLigado.id,
        erro: 'Sem CalculoTarifa',
        info: { id_voo_arr: vooLigado.id_voo_arr, id_voo_dep: vooLigado.id_voo_dep }
      }, { status: 404 });
    }

    const calculo = calculos[0];
    const detalhes = calculo.detalhes_calculo || {};

    return Response.json({
      voo_ligado_id: vooLigado.id,
      total_tarifa_usd: calculo.total_tarifa_usd,
      total_tarifa_aoa: calculo.total_tarifa,
      detalhes: {
        subtotal_sem_impostos_usd: detalhes.subtotal_sem_impostos_usd,
        subtotal_sem_impostos_aoa: detalhes.subtotal_sem_impostos_aoa,
        total_impostos_usd: detalhes.total_impostos_usd,
        total_impostos_aoa: detalhes.total_impostos_aoa,
        impostos_array: detalhes.impostos?.map(i => ({
          tipo: i.tipo,
          valor_usd: i.valor_usd,
          valor_aoa: i.valor_aoa
        })) || []
      },
      componentes: {
        tarifa_pouso: calculo.tarifa_pouso_usd,
        tarifa_permanencia: calculo.tarifa_permanencia_usd,
        tarifa_passageiros: calculo.tarifa_passageiros_usd,
        tarifa_carga: calculo.tarifa_carga_usd,
        outras_tarifas: calculo.outras_tarifas_usd
      },
      verificacao: {
        subtotal_calculado: (detalhes.subtotal_sem_impostos_usd || 0) + (detalhes.total_impostos_usd || 0),
        total_reportado: calculo.total_tarifa_usd,
        match: Math.abs((detalhes.subtotal_sem_impostos_usd || 0) + (detalhes.total_impostos_usd || 0) - (calculo.total_tarifa_usd || 0)) < 0.01
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});