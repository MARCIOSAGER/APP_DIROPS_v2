import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔄 Iniciando recálculo de tarifas com impostos (v2 - filtro otimizado)...');

    let totalProcessados = 0;
    let totalAtualizados = 0;
    let totalErros = 0;
    let skip = 0;
    const batchSize = 20;
    const errorsDetails = [];
    const delayMs = 300;

    while (true) {
      console.log(`📄 Buscando batch #${skip / batchSize + 1} (skip=${skip}, apenas registos SEM impostos)...`);
      
      // Buscar APENAS registos onde pelo menos um dos campos de impostos é null
      const calculosTarifa = await base44.asServiceRole.entities.CalculoTarifa.filter(
        {
          $or: [
            { total_impostos_usd: null },
            { total_impostos_aoa: null },
            { total_tarifa_com_impostos_usd: null },
            { total_tarifa_com_impostos_aoa: null }
          ]
        },
        undefined,
        batchSize,
        skip
      );
      
      if (!calculosTarifa || calculosTarifa.length === 0) {
        console.log('✅ Todos os cálculos com impostos já foram processados');
        break;
      }

      console.log(`   ✓ Encontrados ${calculosTarifa.length} registos para processar neste batch`);
      const updatesForBatch = [];

      for (const calculo of calculosTarifa) {
        totalProcessados++;

        try {
          const detalhes = calculo.detalhes_calculo || {};

          let totalImpostosUsd = 0;
          if (detalhes.impostos && Array.isArray(detalhes.impostos)) {
            totalImpostosUsd = detalhes.impostos.reduce((sum, imp) => sum + (imp.valor_usd || 0), 0);
          }

          const totalTarifaUsd = calculo.total_tarifa_usd || 0;
          const totalTarifaComImpostosUsd = totalTarifaUsd + totalImpostosUsd;

          const taxa = calculo.taxa_cambio_usd_aoa || 850;
          const totalImpostosAoa = parseFloat((totalImpostosUsd * taxa).toFixed(2));
          const totalTarifaComImpostosAoa = parseFloat((totalTarifaComImpostosUsd * taxa).toFixed(2));

          updatesForBatch.push({
            id: calculo.id,
            total_impostos_usd: totalImpostosUsd,
            total_impostos_aoa: totalImpostosAoa,
            total_tarifa_com_impostos_usd: totalTarifaComImpostosUsd,
            total_tarifa_com_impostos_aoa: totalTarifaComImpostosAoa
          });

          console.log(`   ✓ ${calculo.id}: USD ${totalTarifaUsd.toFixed(2)} + impostos ${totalImpostosUsd.toFixed(2)} = ${totalTarifaComImpostosUsd.toFixed(2)}`);
        } catch (error) {
          console.error(`❌ Erro ao preparar atualização para cálculo ${calculo.id}: ${error.message}`);
          totalErros++;
          errorsDetails.push(`ID ${calculo.id}: ${error.message}`);
        }
      }

      if (updatesForBatch.length > 0) {
        console.log(`⚡ Atualizando ${updatesForBatch.length} registos individualmente...`);
        
        for (const updateData of updatesForBatch) {
          try {
            const { id, ...data } = updateData;
            await base44.asServiceRole.entities.CalculoTarifa.update(id, data);
            totalAtualizados++;

            // Delay entre cada atualização individual
            await new Promise(resolve => setTimeout(resolve, 800));
          } catch (updateError) {
            console.error(`❌ Erro ao atualizar cálculo ${updateData.id}: ${updateError.message}`);
            totalErros++;
            errorsDetails.push(`ID ${updateData.id}: ${updateError.message}`);
          }
        }

        console.log(`✅ Batch #${skip / batchSize + 1} concluído - ${updatesForBatch.length} atualizados`);

        // Delay adicional entre batches
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      skip += batchSize;

      if (totalProcessados % 50 === 0) {
        console.log(`📊 Progresso: ${totalProcessados} processados, ${totalAtualizados} atualizados, ${totalErros} erros`);
      }
    }

    console.log(`\n✅ RECÁLCULO CONCLUÍDO`);
    console.log(`   Total Processados: ${totalProcessados}`);
    console.log(`   Total Atualizados: ${totalAtualizados}`);
    console.log(`   Total Erros: ${totalErros}`);

    return Response.json({
      sucesso: totalErros === 0,
      mensagem: totalErros === 0 ? 'Recálculo de tarifas com impostos concluído' : 'Recálculo concluído com alguns erros',
      resumo: {
        total_processados: totalProcessados,
        total_atualizados: totalAtualizados,
        total_erros: totalErros,
        erros_detalhes: errorsDetails
      }
    });
  } catch (error) {
    console.error('❌ Erro crítico:', error);
    return Response.json({ 
      error: 'Erro ao recalcular tarifas',
      details: error.message 
    }, { status: 500 });
  }
});