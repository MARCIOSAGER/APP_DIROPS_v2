import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('🚀 Iniciando limpeza global de duplicados CalculoTarifa...');

    // Buscar todos os registos ordenados por data (mais recente primeiro)
    // Fazemos em batches de 1000 até acabar
    let allRecords = [];
    let skip = 0;
    const pageSize = 1000;

    while (true) {
      const batch = await base44.asServiceRole.entities.CalculoTarifa.list('-created_date', pageSize, skip);
      if (!batch || batch.length === 0) break;
      allRecords = allRecords.concat(batch);
      if (batch.length < pageSize) break;
      skip += pageSize;
    }

    console.log(`📊 Total de registos carregados: ${allRecords.length}`);

    // Agrupar por voo_id — manter o primeiro (mais recente, pois ordenamos -created_date)
    const seen = new Set();
    const idsParaEliminar = [];

    for (const record of allRecords) {
      const vooId = record.voo_id;
      if (!vooId) continue;

      if (seen.has(vooId)) {
        idsParaEliminar.push(record.id);
      } else {
        seen.add(vooId);
      }
    }

    console.log(`🗑️ ${idsParaEliminar.length} duplicados encontrados para eliminar`);

    if (idsParaEliminar.length === 0) {
      return Response.json({ sucesso: true, mensagem: 'Nenhum duplicado encontrado', total_eliminados: 0 });
    }

    // Eliminar apenas os primeiros 60 para não exceder timeout/rate limit
    // Eliminar 1 por vez com pausa de 500ms para evitar rate limit
    const loteAtual = idsParaEliminar.slice(0, 40);
    let totalEliminados = 0;
    for (const id of loteAtual) {
      await base44.asServiceRole.entities.CalculoTarifa.delete(id);
      totalEliminados++;
      if (totalEliminados % 5 === 0) console.log(`   Eliminados ${totalEliminados}/${loteAtual.length}...`);
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`✅ Concluído: ${totalEliminados} duplicados eliminados`);

    return Response.json({
      sucesso: true,
      total_registos: allRecords.length,
      total_unicos: seen.size,
      total_eliminados: totalEliminados
    });

  } catch (error) {
    console.error('❌ Erro: ' + error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});