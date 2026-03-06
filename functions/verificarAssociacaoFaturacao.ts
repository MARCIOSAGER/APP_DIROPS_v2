import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { voo_ligado_id } = payload;

    console.log(`\n🔍 Verificando associação de faturação para voo ligado: ${voo_ligado_id}`);

    // Buscar o voo ligado
    const vooLigado = await base44.asServiceRole.entities.VooLigado.get(voo_ligado_id);
    console.log(`\n📋 VooLigado encontrado:`, {
      id: vooLigado.id,
      voo_arr: vooLigado.id_voo_arr,
      voo_dep: vooLigado.id_voo_dep,
      tempo_permanencia: vooLigado.tempo_permanencia_min
    });

    // Buscar os voos ARR e DEP
    const [vooArr, vooDep] = await Promise.all([
      base44.asServiceRole.entities.Voo.get(vooLigado.id_voo_arr).catch(() => null),
      base44.asServiceRole.entities.Voo.get(vooLigado.id_voo_dep).catch(() => null)
    ]);

    console.log(`\n✈️ Voo ARR:`);
    console.log(`   ID: ${vooArr?.id}`);
    console.log(`   Número: ${vooArr?.numero_voo}`);
    console.log(`   Aeroporto: ${vooArr?.aeroporto_operacao}`);
    console.log(`   MTOW: ${vooArr?.registo_aeronave}`);

    console.log(`\n✈️ Voo DEP:`);
    console.log(`   ID: ${vooDep?.id}`);
    console.log(`   Número: ${vooDep?.numero_voo}`);
    console.log(`   Aeroporto: ${vooDep?.aeroporto_operacao}`);
    console.log(`   MTOW: ${vooDep?.registo_aeronave}`);

    // Buscar cálculos de tarifa
    console.log(`\n💰 Procurando CalculoTarifa...`);

    // Procura 1: por voo_ligado_id
    const calculosPorVooLigado = await base44.asServiceRole.entities.CalculoTarifa.filter({
      voo_ligado_id: voo_ligado_id
    });
    console.log(`   Por voo_ligado_id: ${calculosPorVooLigado.length}`);
    
    if (calculosPorVooLigado.length > 0) {
      console.log(`   Detalhes:`);
      calculosPorVooLigado.slice(0, 3).forEach((ct, idx) => {
        console.log(`     [${idx}] voo_id: ${ct.voo_id}, total_tarifa: ${ct.total_tarifa}`);
      });
    }

    // Procura 2: por voo_id = voo_dep
    const calculosPorVooDep = await base44.asServiceRole.entities.CalculoTarifa.filter({
      voo_id: vooDep?.id
    });
    console.log(`   Por voo_id (voo_dep): ${calculosPorVooDep.length}`);
    
    if (calculosPorVooDep.length > 0) {
      console.log(`   Detalhes:`);
      calculosPorVooDep.slice(0, 3).forEach((ct, idx) => {
        console.log(`     [${idx}] voo_ligado_id: ${ct.voo_ligado_id}, total_tarifa: ${ct.total_tarifa}`);
      });
    }

    // Procura 3: por voo_id = voo_arr
    const calculosPorVooArr = await base44.asServiceRole.entities.CalculoTarifa.filter({
      voo_id: vooArr?.id
    });
    console.log(`   Por voo_id (voo_arr): ${calculosPorVooArr.length}`);

    // Resumo
    const totalEncontrado = calculosPorVooLigado.length + calculosPorVooDep.length + calculosPorVooArr.length;
    console.log(`\n📊 RESUMO: ${totalEncontrado} cálculo(s) encontrado(s)`);

    if (totalEncontrado === 0) {
      console.log(`\n⚠️ PROBLEMA DETECTADO: Nenhum CalculoTarifa associado a este VooLigado!`);
      console.log(`   Isto significa que os cálculos de tarifa NUNCA foram criados para este voo ligado.`);
    }

    return Response.json({
      voo_ligado_id,
      calculosPorVooLigado: calculosPorVooLigado.length,
      calculosPorVooDep: calculosPorVooDep.length,
      calculosPorVooArr: calculosPorVooArr.length,
      total: totalEncontrado
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});