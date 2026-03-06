import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { aeroporto_icao } = payload;

    console.log(`\n🔍 =====  DEBUG FATURAÇÃO COMPLETO =====`);

    // 1. Verificar CalculoTarifa no geral
    const todosCálculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list();
    const todosCálculos = Array.isArray(todosCálculosRaw) ? todosCálculosRaw : (todosCálculosRaw ? Object.values(todosCálculosRaw) : []);
    console.log(`\n1️⃣ TOTAL de CalculoTarifa na BD: ${todosCálculos.length}`);
    
    if (todosCálculos.length > 0) {
      console.log(`   Primeiros 3:`);
      todosCálculos.slice(0, 3).forEach((ct, idx) => {
        console.log(`   [${idx}] voo_id: ${ct.voo_id?.substring(0, 8)}..., voo_ligado_id: ${ct.voo_ligado_id?.substring(0, 8)}..., tarifa: ${ct.total_tarifa}`);
      });
    }

    // 2. Verificar VooLigado no geral
    const todosVoosLigadosRaw = await base44.asServiceRole.entities.VooLigado.list();
    const todosVoosLigados = Array.isArray(todosVoosLigadosRaw) ? todosVoosLigadosRaw : (todosVoosLigadosRaw ? Object.values(todosVoosLigadosRaw) : []);
    console.log(`\n2️⃣ TOTAL de VooLigado na BD: ${todosVoosLigados.length}`);
    
    if (todosVoosLigados.length > 0) {
      console.log(`   Primeiros 3:`);
      todosVoosLigados.slice(0, 3).forEach((vl, idx) => {
        console.log(`   [${idx}] id: ${vl.id?.substring(0, 8)}..., voo_arr: ${vl.id_voo_arr?.substring(0, 8)}..., voo_dep: ${vl.id_voo_dep?.substring(0, 8)}...`);
      });
    }

    // 3. Verificar Voo no geral
    console.log(`\n3️⃣ TOTAL de Voo na BD: Pulando (lento)...`);

    // 4. Filtrar por aeroporto específico
    if (aeroporto_icao) {
      console.log(`\n4️⃣ Filtrando por aeroporto: ${aeroporto_icao}`);
      
      const voosDoAeroportoRaw = await base44.asServiceRole.entities.Voo.filter({
        aeroporto_operacao: aeroporto_icao
      });
      const voosDoAeroporto = Array.isArray(voosDoAeroportoRaw) ? voosDoAeroportoRaw : (voosDoAeroportoRaw ? Object.values(voosDoAeroportoRaw) : []);
      console.log(`   Voos neste aeroporto: ${voosDoAeroporto.length}`);
      
      if (voosDoAeroporto.length > 0) {
        const vooIds = new Set(voosDoAeroporto.map(v => v.id));
        const voosLigadosAqui = todosVoosLigados.filter(vl => 
          vooIds.has(vl.id_voo_arr) && vooIds.has(vl.id_voo_dep)
        );
        console.log(`   Voos ligados neste aeroporto: ${voosLigadosAqui.length}`);

        // Verificar se há CalculoTarifa para estes voos ligados
        const calculosPorVooId = todosVoosLigados.filter(vl => {
          return todosCálculos.find(ct => ct.voo_id === vl.id_voo_dep);
        });

        const calculosPorVooLigadoId = todosVoosLigados.filter(vl => {
          return todosCálculos.find(ct => ct.voo_ligado_id === vl.id);
        });

        console.log(`\n5️⃣ Cálculos encontrados:`);
        console.log(`   Por voo_id (voo_dep): ${calculosPorVooId.length} voos ligados`);
        console.log(`   Por voo_ligado_id: ${calculosPorVooLigadoId.length} voos ligados`);

        // Tentar entender a estrutura: mostrar um VooLigado e verificar se há cálculo pra ele
        if (voosLigadosAqui.length > 0) {
          const vl = voosLigadosAqui[0];
          console.log(`\n6️⃣ Analisando VooLigado exemplo: ${vl.id?.substring(0, 8)}...`);
          console.log(`   voo_arr: ${vl.id_voo_arr?.substring(0, 8)}...`);
          console.log(`   voo_dep: ${vl.id_voo_dep?.substring(0, 8)}...`);

          // Procurar cálculo associado
          const calculosPorId = todosCálculos.filter(ct => 
            ct.voo_id === vl.id_voo_dep || ct.voo_id === vl.id_voo_arr || 
            ct.voo_ligado_id === vl.id
          );
          console.log(`   Cálculos associados: ${calculosPorId.length}`);
          
          if (calculosPorId.length > 0) {
            calculosPorId.forEach((ct, idx) => {
              console.log(`     [${idx}] voo_id: ${ct.voo_id?.substring(0, 8)}..., voo_ligado_id: ${ct.voo_ligado_id?.substring(0, 8)}..., tarifa: ${ct.total_tarifa}`);
            });
          }

          // Procurar se há cálculos com os voos específicos
          console.log(`\n7️⃣ Cálculos contendo este voo_dep (${vl.id_voo_dep?.substring(0, 8)}...):`);
          const calcsPorDep = todosCálculos.filter(ct => ct.voo_id === vl.id_voo_dep);
          console.log(`   Encontrados: ${calcsPorDep.length}`);

          console.log(`\n8️⃣ Cálculos contendo este voo_arr (${vl.id_voo_arr?.substring(0, 8)}...):`);
          const calcsPorArr = todosCálculos.filter(ct => ct.voo_id === vl.id_voo_arr);
          console.log(`   Encontrados: ${calcsPorArr.length}`);
        }
      }
    }

    // 9. Verificar quando foram criados os dados
    if (todosCálculos.length > 0) {
      console.log(`\n9️⃣ Datas dos cálculos:`);
      const datas = todosVoosLigados.map(vl => new Date(vl.created_date).toISOString().split('T')[0]);
      const datasUnicas = [...new Set(datas)];
      console.log(`   Voos ligados criados em: ${datasUnicas.join(', ')}`);
    }

    return Response.json({
      debug: {
        totalCalculosTarifa: todosCálculos.length,
        totalVoosLigados: todosVoosLigados.length,
        totalVoos: todoVoos.length
      }
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});