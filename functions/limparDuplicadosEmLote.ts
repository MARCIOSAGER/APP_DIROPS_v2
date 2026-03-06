import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Esta função processa duplicados de CalculoTarifa em lotes.
// Usa uma ConfiguracaoSistema para guardar o progresso (skip atual).
// É chamada pela automação a cada 5 minutos.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('🚀 Iniciando limpeza de duplicados em lote...');

    // Ler o skip atual do progresso guardado
    let skipAtual = 0;
    let totalEliminadoTotal = 0;
    let concluido = false;

    try {
      const config = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ chave: 'limpar_duplicados_skip' }, undefined, 1);
      if (config && config.length > 0) {
        const val = parseInt(config[0].valor);
        if (!isNaN(val)) {
          skipAtual = val;
          totalEliminadoTotal = parseInt(config[0].descricao || '0') || 0;
        }
        // Verificar se já foi marcado como concluído
        if (config[0].notas === 'concluido') {
          return Response.json({ sucesso: true, mensagem: 'Limpeza já concluída', concluido: true });
        }
      }
    } catch (e) {
      console.log('ℹ️ Sem config de progresso, começando do início');
    }

    console.log(`📌 Continuando do skip=${skipAtual} (eliminados até agora: ${totalEliminadoTotal})`);

    const batchSize = 100;

    // Buscar lote
    const todos = await base44.asServiceRole.entities.CalculoTarifa.list(
      'created_date',
      batchSize,
      skipAtual
    );

    if (!todos || todos.length === 0) {
      console.log('✅ LIMPEZA CONCLUÍDA! Não há mais registos a processar.');
      concluido = true;
      
      // Marcar como concluído
      await salvarProgresso(base44, skipAtual, totalEliminadoTotal, 'concluido');

      return Response.json({
        sucesso: true,
        mensagem: 'Limpeza de duplicados concluída!',
        total_eliminados: totalEliminadoTotal,
        concluido: true
      });
    }

    console.log(`📊 ${todos.length} registos neste batch (skip=${skipAtual})`);

    // Agrupar por voo_id para encontrar duplicados neste batch
    const porVooId = {};
    for (const c of todos) {
      const vid = c.voo_id;
      if (!vid) continue;
      if (!porVooId[vid]) porVooId[vid] = [];
      porVooId[vid].push(c);
    }

    const vooIdsComDuplicados = Object.entries(porVooId)
      .filter(([, arr]) => arr.length > 1)
      .map(([vid]) => vid);

    console.log(`🔴 ${vooIdsComDuplicados.length} voo_ids com potenciais duplicados neste batch`);

    let eliminadosBatch = 0;

    for (const vooId of vooIdsComDuplicados) {
      const todosDoVoo = await base44.asServiceRole.entities.CalculoTarifa.filter(
        { voo_id: vooId },
        '-created_date',
        200
      );

      if (!todosDoVoo || todosDoVoo.length <= 1) continue;

      const [, ...duplicados] = todosDoVoo;
      console.log(`   voo_id ${vooId}: ${todosDoVoo.length} registos → eliminando ${duplicados.length} duplicados`);

      for (const dup of duplicados) {
        await base44.asServiceRole.entities.CalculoTarifa.delete(dup.id);
        eliminadosBatch++;
        await new Promise(r => setTimeout(r, 150));
      }
    }

    totalEliminadoTotal += eliminadosBatch;
    const proximoSkip = skipAtual + todos.length;

    console.log(`✅ Batch concluído: ${eliminadosBatch} eliminados | Total até agora: ${totalEliminadoTotal} | Próximo skip: ${proximoSkip}`);

    // Guardar progresso
    await salvarProgresso(base44, proximoSkip, totalEliminadoTotal, 'em_progresso');

    return Response.json({
      sucesso: true,
      mensagem: `Batch processado`,
      batch_processados: todos.length,
      batch_eliminados: eliminadosBatch,
      total_eliminados: totalEliminadoTotal,
      proximo_skip: proximoSkip,
      concluido: false
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function salvarProgresso(base44, skip, totalEliminados, estado) {
  try {
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ chave: 'limpar_duplicados_skip' }, undefined, 1);
    const data = {
      chave: 'limpar_duplicados_skip',
      valor: String(skip),
      descricao: String(totalEliminados),
      notas: estado
    };
    if (configs && configs.length > 0) {
      await base44.asServiceRole.entities.ConfiguracaoSistema.update(configs[0].id, data);
    } else {
      await base44.asServiceRole.entities.ConfiguracaoSistema.create(data);
    }
  } catch (e) {
    console.log('⚠️ Não foi possível guardar progresso:', e.message);
  }
}