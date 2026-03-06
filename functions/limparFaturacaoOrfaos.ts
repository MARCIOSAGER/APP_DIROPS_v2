import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log(`🗑️ Iniciando limpeza de registos órfãos em CalculoTarifa...`);

    // Query para encontrar registos órfãos (sem voo_id e sem voo_ligado_id)
    const query = {
      $and: [
        { $or: [{ voo_id: null }, { voo_id: { $exists: false } }] },
        { $or: [{ voo_ligado_id: null }, { voo_ligado_id: { $exists: false } }] }
      ]
    };

    console.log(`🔍 Buscando registos órfãos com query...`);
    
    // Buscar em chunks para evitar timeout
    let totalDeletado = 0;
    let iteracao = 0;
    const tamanhoChunk = 1000;
    
    let hasMais = true;
    
    while (hasMais) {
      iteracao++;
      console.log(`\n📦 Iteração ${iteracao}: Buscando próximos ${tamanhoChunk} registos...`);
      
      try {
        const registosRaw = await base44.asServiceRole.entities.CalculoTarifa.filter(query, '-created_date', tamanhoChunk);
        const registos = Array.isArray(registosRaw) ? registosRaw : (registosRaw ? Object.values(registosRaw) : []);
        
        if (!registos || registos.length === 0) {
          console.log(`✅ Nenhum registo encontrado nesta iteração. Limpeza concluída!`);
          hasMais = false;
          break;
        }

        console.log(`   Encontrados: ${registos.length} registos`);

        // Deletar cada registo
        for (const registo of registos) {
          try {
            await base44.asServiceRole.entities.CalculoTarifa.delete(registo.id);
            totalDeletado++;
            
            if (totalDeletado % 100 === 0) {
              console.log(`   ⏳ Progresso: ${totalDeletado} deletados...`);
            }
          } catch (e) {
            console.error(`   ❌ Erro ao deletar ${registo.id}: ${e.message}`);
          }
        }

        // Se encontrou menos registos que o chunk, não há mais
        if (registos.length < tamanhoChunk) {
          console.log(`   ℹ️ Última iteração concluída (encontrados ${registos.length} < ${tamanhoChunk})`);
          hasMais = false;
        }
      } catch (e) {
        console.error(`❌ Erro na iteração ${iteracao}:`, e.message);
        // Continuar com a próxima iteração mesmo em caso de erro
        hasMais = false;
      }
    }

    console.log(`\n✅ LIMPEZA CONCLUÍDA!`);
    console.log(`Total de registos órfãos deletados: ${totalDeletado}`);

    return Response.json({
      sucesso: true,
      totalDeletado: totalDeletado,
      mensagem: `${totalDeletado} registos órfãos foram removidos com sucesso da base de dados.`
    });

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    return Response.json({ 
      error: 'Erro ao limpar faturação',
      details: error.message 
    }, { status: 500 });
  }
});