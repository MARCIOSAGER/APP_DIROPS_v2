import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try {
      const clonedReq = req.clone();
      payload = await clonedReq.json();
    } catch (e) {
      console.log('⚠️ Sem payload JSON');
    }

    const { periodo, aeroporto_icao } = payload;

    if (!periodo || !aeroporto_icao) {
      return Response.json({ 
        error: 'Parâmetros obrigatórios: periodo, aeroporto_icao' 
      }, { status: 400 });
    }

    console.log(`\n🔍 DEBUG PLACEHOLDERS`);
    console.log(`📅 Período: ${periodo}`);
    console.log(`🏢 Aeroporto: ${aeroporto_icao}`);

    // 1. Carregar regras de notificação
    const todasRegras = await base44.entities.RegraNotificacao.filter({ ativo: true }).catch(() => []);
    console.log(`\n📋 Total de regras ativas: ${todasRegras.length}`);

    // 2. Encontrar regra para este período
    const eventoGatilho = `relatorio_operacional_${periodo}`;
    const regrasAplicaveis = todasRegras.filter(regra => {
      if (regra.evento_gatilho !== eventoGatilho) return false;
      const aeroportoRegra = regra.aeroporto_icao_relatorio || '';
      return aeroportoRegra === '' || aeroportoRegra === aeroporto_icao;
    });

    console.log(`\n🎯 Regras aplicáveis para "${eventoGatilho}": ${regrasAplicaveis.length}`);

    const resultado = {
      evento_gatilho: eventoGatilho,
      regras_encontradas: regrasAplicaveis.length,
      regras: []
    };

    for (const regra of regrasAplicaveis) {
      console.log(`\n📌 Regra: "${regra.nome}"`);
      console.log(`   Canais: ${regra.canal_envio?.join(', ') || 'nenhum'}`);
      
      // Verificar template WhatsApp
      if (regra.canal_envio?.includes('whatsapp')) {
        if (!regra.mensagem_template_whatsapp) {
          console.log(`   ❌ Template WhatsApp: NÃO CONFIGURADO`);
        } else {
          const template = regra.mensagem_template_whatsapp;
          console.log(`   ✅ Template WhatsApp (${template.length} chars):`);
          
          // Encontrar todos os placeholders
          const placeholderRegex = /\{\{([^}]+)\}\}/g;
          const placeholders = [];
          let match;
          while ((match = placeholderRegex.exec(template)) !== null) {
            placeholders.push(match[1]);
          }

          console.log(`   📍 Placeholders encontrados: ${placeholders.length}`);
          placeholders.forEach(ph => console.log(`      - {{${ph}}}`));

          resultado.regras.push({
            nome: regra.nome,
            canal: 'whatsapp',
            template_length: template.length,
            placeholders_found: placeholders,
            template_preview: template.substring(0, 200)
          });
        }
      }

      // Verificar template Email
      if (regra.canal_envio?.includes('email')) {
        if (!regra.mensagem_template_email_assunto || !regra.mensagem_template_email_corpo) {
          console.log(`   ❌ Template Email: NÃO CONFIGURADO`);
        } else {
          const assunto = regra.mensagem_template_email_assunto;
          const corpo = regra.mensagem_template_email_corpo;
          console.log(`   ✅ Template Email:`);
          console.log(`      Assunto (${assunto.length} chars): ${assunto.substring(0, 100)}`);
          console.log(`      Corpo (${corpo.length} chars)`);
          
          // Encontrar todos os placeholders
          const placeholderRegex = /\{\{([^}]+)\}\}/g;
          const placeholders = [];
          let match;
          while ((match = placeholderRegex.exec(corpo)) !== null) {
            placeholders.push(match[1]);
          }

          console.log(`      📍 Placeholders encontrados: ${placeholders.length}`);
          placeholders.forEach(ph => console.log(`         - {{${ph}}}`));

          resultado.regras.push({
            nome: regra.nome,
            canal: 'email',
            assunto_length: assunto.length,
            corpo_length: corpo.length,
            placeholders_found: placeholders
          });
        }
      }
    }

    // 3. Verificar quais placeholders estão disponíveis
    console.log(`\n📦 Placeholders DISPONÍVEIS NO SISTEMA:`);
    const placeholdersDisponiveis = [
      'semana_inicio', 'semana_fim', 'data_inicio', 'data_fim', 
      'aeroporto_icao', 'aeroporto_nome',
      'aeroporto_nome', 'total_voos', 'voos_arr', 'voos_dep',
      'total_passageiros', 'total_carga_kg',
      'tempo_medio_permanencia', 'tempo_medio_estacionamento',
      'total_tarifa_usd', 'total_tarifa', 'total_impostos_usd', 'total_impostos_aoa',
      'subtotal_sem_impostos_usd', 'subtotal_sem_impostos_aoa',
      'taxa_cambio_usd_aoa', 'periodo_noturno', 'created_date', 'created_by',
      'tarifa_pouso_aoa', 'tarifa_permanencia_aoa', 'tarifa_passageiros_aoa',
      'tarifa_carga_aoa', 'outras_tarifas_aoa',
      'tarifa_pouso_usd', 'tarifa_permanencia_usd', 'tarifa_passageiros_usd',
      'tarifa_carga_usd', 'outras_tarifas_usd'
    ];
    
    console.log(`Do Sistema: ${placeholdersDisponiveis.length} placeholders`);
    placeholdersDisponiveis.forEach(ph => console.log(`   - {{${ph}}}`));

    // 4. Verificar placeholders globais
    const placeholders = await base44.entities.Placeholder.filter({ ativo: true }).catch(() => []);
    console.log(`\n🌐 Placeholders GLOBAIS: ${placeholders.length}`);
    placeholders.forEach(ph => console.log(`   - {{${ph.nome}}}`));

    return Response.json({
      sucesso: true,
      periodo,
      aeroporto_icao,
      regras_encontradas: regrasAplicaveis.length,
      placeholders_sistema: placeholdersDisponiveis.length,
      placeholders_globais: placeholders.length,
      detalhes: resultado
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});