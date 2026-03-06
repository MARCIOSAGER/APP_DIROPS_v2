import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas admins' }, { status: 403 });
    }

    console.log(`\n🔧 RECALCULANDO FATURAÇÃO...`);

    // 1. Carregar todos os voos ligados
    const voosLigadosRaw = await base44.asServiceRole.entities.VooLigado.list();
    const voosLigados = Array.isArray(voosLigadosRaw) ? voosLigadosRaw : (voosLigadosRaw ? Object.values(voosLigadosRaw) : []);
    console.log(`\n1. VooLigados carregados: ${voosLigados.length}`);

    // 2. Para cada VooLigado, calcular tarifa
    let criados = 0;
    let erros = 0;

    for (let idx = 0; idx < Math.min(voosLigados.length, 100); idx++) {
      const vl = voosLigados[idx];
      
      try {
        // Buscar voos ARR e DEP
        const [vooArr, vooDep] = await Promise.all([
          base44.asServiceRole.entities.Voo.get(vl.id_voo_arr).catch(() => null),
          base44.asServiceRole.entities.Voo.get(vl.id_voo_dep).catch(() => null)
        ]);

        if (!vooArr || !vooDep) {
          console.log(`   [${idx}] Voos não encontrados para ${vl.id.substring(0, 8)}...`);
          erros++;
          continue;
        }

        // Buscar aeroporto
        const aeroData = await base44.asServiceRole.entities.Aeroporto.filter({
          codigo_icao: vooDep.aeroporto_operacao
        }).catch(() => []);
        
        const aero = Array.isArray(aeroData) ? aeroData[0] : null;
        if (!aero) {
          console.log(`   [${idx}] Aeroporto não encontrado`);
          erros++;
          continue;
        }

        // Calcular tarifas (simplified - usar valores estimados)
        const mtowKg = 75000; // Default MTOW
        const tarifaPouso = 450;
        const tarifaPermanencia = vl.tempo_permanencia_min ? (vl.tempo_permanencia_min / 60) * 50 : 0;
        const tarifaPassageiros = (vooDep.passageiros_total || 0) * 5;
        const tarifaCarga = (vooDep.carga_kg || 0) * 0.15;

        const totalUSD = tarifaPouso + tarifaPermanencia + tarifaPassageiros + tarifaCarga;
        const totalAOA = totalUSD * 850;

        // Verificar se já existe um CalculoTarifa para este voo (upsert)
        const existentes = await base44.asServiceRole.entities.CalculoTarifa.filter({ voo_id: vooDep.id }, undefined, 1);
        const dadosCalculo = {
          voo_id: vooDep.id,
          voo_ligado_id: vl.id,
          aeroporto_id: aero.id,
          data_calculo: new Date().toISOString(),
          tipo_tarifa: 'Tarifas de Voo Ligado',
          mtow_kg: mtowKg,
          taxa_cambio_usd_aoa: 850,
          tarifa_pouso_usd: tarifaPouso,
          tarifa_pouso: tarifaPouso * 850,
          tarifa_permanencia_usd: tarifaPermanencia,
          tarifa_permanencia: tarifaPermanencia * 850,
          tarifa_passageiros_usd: tarifaPassageiros,
          tarifa_passageiros: tarifaPassageiros * 850,
          tarifa_carga_usd: tarifaCarga,
          tarifa_carga: tarifaCarga * 850,
          outras_tarifas_usd: 0,
          outras_tarifas: 0,
          total_tarifa_usd: totalUSD,
          total_tarifa: totalAOA,
          tempo_permanencia_horas: (vl.tempo_permanencia_min || 0) / 60
        };

        // Upsert: atualizar se já existe, criar se não
        if (existentes && existentes.length > 0) {
          await base44.asServiceRole.entities.CalculoTarifa.update(existentes[0].id, dadosCalculo);
        } else {
          await base44.asServiceRole.entities.CalculoTarifa.create(dadosCalculo);
        }

        criados++;
        if ((idx + 1) % 20 === 0) {
          console.log(`   Progresso: ${idx + 1}/${Math.min(voosLigados.length, 100)}`);
        }

      } catch (e) {
        console.error(`   [${idx}] Erro: ${e.message}`);
        erros++;
      }
    }

    console.log(`\n✅ RESUMO:`);
    console.log(`   Processados: ${Math.min(voosLigados.length, 100)}`);
    console.log(`   Criados: ${criados}`);
    console.log(`   Erros: ${erros}`);

    return Response.json({
      sucesso: true,
      processados: Math.min(voosLigados.length, 100),
      criados,
      erros
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});