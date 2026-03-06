import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem executar esta função' }, { status: 403 });
    }

    console.log(`\n🧹 Iniciando limpeza de CalculoTarifa...`);

    // Primeiro, tentar deletar todos os registos deficientes
    const todosCálculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list('-created_date', 1000);
    const todosCálculos = Array.isArray(todosCálculosRaw) ? todosCálculosRaw : (todosCálculosRaw ? Object.values(todosCálculosRaw) : []);
    
    console.log(`\n📊 Total de CalculoTarifa: ${todosCálculos.length}`);
    
    // Verificar quantos têm dados deficientes
    const deficientes = todosCálculos.filter(ct => !ct.voo_id || !ct.voo_ligado_id || ct.total_tarifa === undefined || ct.total_tarifa === null);
    console.log(`🔴 Registos deficientes: ${deficientes.length}`);
    
    const validos = todosCálculos.filter(ct => ct.voo_id && ct.voo_ligado_id && ct.total_tarifa !== undefined && ct.total_tarifa !== null);
    console.log(`✅ Registos válidos: ${validos.length}`);

    // Apagar os deficientes em lotes
    let deletados = 0;
    if (deficientes.length > 0) {
      console.log(`\n🗑️ Deletando registos deficientes...`);
      
      // Apagar em lotes de 100
      for (let i = 0; i < deficientes.length; i += 100) {
        const lote = deficientes.slice(i, i + 100);
        for (const ct of lote) {
          try {
            await base44.asServiceRole.entities.CalculoTarifa.delete(ct.id);
            deletados++;
          } catch (e) {
            console.error(`Erro ao deletar ${ct.id}: ${e.message}`);
          }
        }
        console.log(`   Progresso: ${Math.min(i + 100, deficientes.length)}/${deficientes.length}`);
      }
    }

    console.log(`\n✅ Limpeza concluída: ${deletados} registos deletados`);

    return Response.json({
      sucesso: true,
      resumo: {
        totalAntes: todosCálculos.length,
        deficientesEncontrados: deficientes.length,
        validosRetidos: validos.length,
        deletados: deletados
      }
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});