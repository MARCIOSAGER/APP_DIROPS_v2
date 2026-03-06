import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let payload = {};
    try {
      payload = await req.clone().json();
    } catch (e) {}

    const batchSize = parseInt(payload.batchSize) || 50;
    const skip = parseInt(payload.skip) || 0;

    console.log(`🔍 Buscando CalculoTarifa (skip=${skip}, limit=${batchSize})...`);

    // Buscar um lote de registos
    const todos = await base44.asServiceRole.entities.CalculoTarifa.list(
      'created_date',
      batchSize,
      skip
    );

    if (!todos || todos.length === 0) {
      return Response.json({
        sucesso: true,
        mensagem: 'Nenhum registo encontrado neste batch',
        processados: 0,
        eliminados: 0,
        proximo_skip: null
      });
    }

    console.log(`📊 ${todos.length} registos neste batch`);

    // Agrupar por voo_id
    const porVooId = {};
    for (const c of todos) {
      const vid = c.voo_id;
      if (!vid) continue;
      if (!porVooId[vid]) porVooId[vid] = [];
      porVooId[vid].push(c);
    }

    // Para cada voo_id com duplicados, precisamos buscar TODOS os registos desse voo_id
    let totalEliminados = 0;
    const vooIdsComDuplicados = Object.entries(porVooId)
      .filter(([, arr]) => arr.length > 1)
      .map(([vid]) => vid);

    console.log(`🔴 ${vooIdsComDuplicados.length} voo_ids com duplicados neste batch`);

    for (const vooId of vooIdsComDuplicados) {
      // Buscar TODOS os registos deste voo_id
      const todosDoVoo = await base44.asServiceRole.entities.CalculoTarifa.filter(
        { voo_id: vooId },
        '-created_date',
        100
      );

      if (!todosDoVoo || todosDoVoo.length <= 1) continue;

      // Manter apenas o mais recente (índice 0 pois ordenamos -created_date)
      const [maisRecente, ...duplicados] = todosDoVoo;
      console.log(`   voo_id ${vooId}: ${todosDoVoo.length} registos → mantendo ${maisRecente.id.substring(0,8)}, eliminando ${duplicados.length}`);

      for (const dup of duplicados) {
        await base44.asServiceRole.entities.CalculoTarifa.delete(dup.id);
        totalEliminados++;
        await new Promise(r => setTimeout(r, 200));
      }
    }

    const proximoSkip = todos.length === batchSize ? skip + batchSize : null;

    console.log(`✅ Batch concluído: ${todos.length} processados, ${totalEliminados} eliminados`);
    console.log(`   Próximo skip: ${proximoSkip ?? 'FIM'}`);

    return Response.json({
      sucesso: true,
      mensagem: `Batch processado com sucesso`,
      processados: todos.length,
      voo_ids_com_duplicados: vooIdsComDuplicados.length,
      eliminados: totalEliminados,
      proximo_skip: proximoSkip
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});