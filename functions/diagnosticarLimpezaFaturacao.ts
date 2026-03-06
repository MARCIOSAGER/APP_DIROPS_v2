import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log(`🔍 Iniciando diagnóstico de dados sujos em CalculoTarifa...`);

    // Buscar todos os CalculoTarifa
    const todosCálculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list();
    const todosCálculos = Array.isArray(todosCálculosRaw) ? todosCálculosRaw : (todosCálculosRaw ? Object.values(todosCálculosRaw) : []);

    console.log(`Total de CalculoTarifa: ${todosCálculos.length}`);

    // Critérios de "sujeira"
    const registosSujos = {
      sem_voo_id: [],
      sem_total_tarifa: [],
      tarifa_zero: [],
      sem_voo_ligado_e_sem_voo_id: [],
      dados_incompletos: []
    };

    todosCálculos.forEach(ct => {
      const problemas = [];

      // Critério 1: Sem voo_id
      if (!ct.voo_id) {
        registosSujos.sem_voo_id.push(ct.id);
        problemas.push('sem_voo_id');
      }

      // Critério 2: Sem total_tarifa
      if (!ct.total_tarifa && ct.total_tarifa !== 0) {
        registosSujos.sem_total_tarifa.push(ct.id);
        problemas.push('sem_total_tarifa');
      }

      // Critério 3: Tarifa é zero
      if (ct.total_tarifa === 0) {
        registosSujos.tarifa_zero.push(ct.id);
        problemas.push('tarifa_zero');
      }

      // Critério 4: Sem voo_ligado_id E sem voo_id (órfão)
      if (!ct.voo_ligado_id && !ct.voo_id) {
        registosSujos.sem_voo_ligado_e_sem_voo_id.push(ct.id);
        problemas.push('órfão');
      }

      // Critério 5: Dados incompletos (faltam campos essenciais)
      if (!ct.mtow_kg || !ct.taxa_cambio_usd_aoa || !ct.aeroporto_id) {
        registosSujos.dados_incompletos.push(ct.id);
        problemas.push('dados_incompletos');
      }
    });

    const totalSujo = new Set([
      ...registosSujos.sem_voo_id,
      ...registosSujos.sem_total_tarifa,
      ...registosSujos.tarifa_zero,
      ...registosSujos.sem_voo_ligado_e_sem_voo_id,
      ...registosSujos.dados_incompletos
    ]).size;

    console.log(`\n📊 DIAGNÓSTICO COMPLETO:`);
    console.log(`Total de registos "sujos": ${totalSujo} de ${todosCálculos.length} (${((totalSujo/todosCálculos.length)*100).toFixed(1)}%)`);
    console.log(`\nDetalhamento:`);
    console.log(`  • Sem voo_id: ${registosSujos.sem_voo_id.length}`);
    console.log(`  • Sem total_tarifa: ${registosSujos.sem_total_tarifa.length}`);
    console.log(`  • Tarifa zero: ${registosSujos.tarifa_zero.length}`);
    console.log(`  • Órfãos (sem voo_ligado_id e sem voo_id): ${registosSujos.sem_voo_ligado_e_sem_voo_id.length}`);
    console.log(`  • Dados incompletos: ${registosSujos.dados_incompletos.length}`);

    return Response.json({
      sucesso: true,
      total_calculos: todosCálculos.length,
      total_sujo: totalSujo,
      percentual_sujo: ((totalSujo/todosCálculos.length)*100).toFixed(1),
      detalhes: registosSujos,
      recomendacao: totalSujo > 0 
        ? `Executar limparFaturacaoSeletiva para remover ${totalSujo} registos sujos`
        : 'Base de dados está limpa!'
    });

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    return Response.json({ 
      error: 'Erro ao diagnosticar',
      details: error.message 
    }, { status: 500 });
  }
});