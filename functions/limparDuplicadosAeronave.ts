import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🚀 Iniciando limpeza de duplicados RegistoAeronave...');

    // Carregar todos os registos
    let allRecords = [];
    let skip = 0;
    const pageSize = 1000;

    while (true) {
      const batch = await base44.asServiceRole.entities.RegistoAeronave.list('-created_date', pageSize, skip);
      if (!batch || batch.length === 0) break;
      allRecords = allRecords.concat(batch);
      if (batch.length < pageSize) break;
      skip += pageSize;
    }

    console.log(`📊 Total registos carregados: ${allRecords.length}`);

    // Agrupar por matrícula normalizada — manter o mais recente (primeiro, pois ordenamos -created_date)
    const seen = new Map();
    const idsParaEliminar = [];

    for (const record of allRecords) {
      const key = (record.registo || '').trim().toUpperCase().replace(/[-\s]/g, '');
      if (!key) continue;

      if (seen.has(key)) {
        idsParaEliminar.push(record.id);
      } else {
        seen.set(key, record.id);
      }
    }

    console.log(`🗑️ ${idsParaEliminar.length} duplicados encontrados`);

    if (idsParaEliminar.length === 0) {
      return Response.json({ sucesso: true, mensagem: 'Nenhum duplicado encontrado', total_eliminados: 0 });
    }

    // Eliminar em lotes com pausa
    let totalEliminados = 0;
    for (const id of idsParaEliminar) {
      await base44.asServiceRole.entities.RegistoAeronave.delete(id);
      totalEliminados++;
      if (totalEliminados % 5 === 0) {
        console.log(`   Eliminados ${totalEliminados}/${idsParaEliminar.length}...`);
        await new Promise(r => setTimeout(r, 300));
      }
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