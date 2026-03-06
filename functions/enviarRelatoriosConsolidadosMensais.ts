import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const periodo = 'mensal';
    
    console.log(`🌍 Iniciando envio de relatórios consolidados ${periodo}...`);

    const hoje = new Date();
    let dataInicio, dataFim;

    const mesAnterior = new Date(hoje);
    mesAnterior.setMonth(hoje.getMonth() - 1);
    mesAnterior.setDate(1);
    dataInicio = mesAnterior.toISOString().split('T')[0];
    const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    dataFim = ultimoDiaMesAnterior.toISOString().split('T')[0];

    console.log(`📅 Período: ${dataInicio} a ${dataFim}`);

    // Buscar todos os aeroportos
    const aeroportos = await base44.entities.Aeroporto.list();
    const aeroportosAngola = aeroportos.filter(a => 
      ['FNCA', 'FNUB', 'FNCT', 'FNSO', 'FNSA', 'FNMO', 'FNHU', 'FNLU', 'FNKU', 'FNUE', 'FNME', 'FNDU', 'FNGI', 'FNMA', 'FNUG', 'FNBC'].includes(a.codigo_icao)
    );

    console.log(`🏢 ${aeroportosAngola.length} aeroportos a processar`);

    let totalVoosGeral = 0;
    let totalPassageirosGeral = 0;
    let totalCargaGeral = 0;
    let totalFaturacaoUSDGeral = 0;
    let totalFaturacaoAOAGeral = 0;
    let totalImpostosUSDGeral = 0;
    let totalImpostosAOAGeral = 0;
    const detalhesAeroportos = [];

    for (const aeroporto of aeroportosAngola) {
      const query = {
        aeroporto_operacao: aeroporto.codigo_icao,
        data_operacao: { $gte: dataInicio, $lte: dataFim }
      };

      const voos = await base44.entities.Voo.filter(query);
      
      if (voos.length === 0) continue;

      let totalPassageiros = 0;
      let totalCarga = 0;

      voos.forEach(v => {
        totalPassageiros += (v.passageiros_local || 0) + 
                            (v.passageiros_transito_transbordo || 0) + 
                            (v.passageiros_transito_direto || 0);
        totalCarga += (v.carga_kg || 0);
      });

      const voosLigados = await base44.entities.VooLigado.list().catch(() => []);
      const vooIds = new Set(voos.map(v => v.id));
      const voosLigadosDoAeroporto = (voosLigados || []).filter(vl => 
        vooIds.has(vl.id_voo_arr) && vooIds.has(vl.id_voo_dep)
      );

      const voosLigadosIds = new Set(voosLigadosDoAeroporto.map(vl => vl.id));
      const calculosTarifaRaw = await base44.entities.CalculoTarifa.filter({
        $or: [
          { voo_id: { $in: Array.from(vooIds) } },
          { voo_ligado_id: { $in: Array.from(voosLigadosIds) } }
        ]
      }).catch(() => []);

      const calculosTarifa = Array.isArray(calculosTarifaRaw) ? calculosTarifaRaw : [];

      let totalFaturacaoUSD = 0;
      let totalFaturacaoAOA = 0;
      let totalImpostosUSD = 0;
      let totalImpostosAOA = 0;

      voosLigadosDoAeroporto.forEach((vl) => {
        const calculo = calculosTarifa.find(ct => ct.voo_ligado_id === vl.id);
        if (calculo) {
          totalFaturacaoAOA += calculo.total_tarifa_com_impostos_aoa || calculo.total_tarifa || 0;
          totalFaturacaoUSD += calculo.total_tarifa_com_impostos_usd || calculo.total_tarifa_usd || 0;
          totalImpostosAOA += calculo.total_impostos_aoa || 0;
          totalImpostosUSD += calculo.total_impostos_usd || 0;
        }
      });

      totalVoosGeral += voos.length;
      totalPassageirosGeral += totalPassageiros;
      totalCargaGeral += totalCarga;
      totalFaturacaoUSDGeral += totalFaturacaoUSD;
      totalFaturacaoAOAGeral += totalFaturacaoAOA;
      totalImpostosUSDGeral += totalImpostosUSD;
      totalImpostosAOAGeral += totalImpostosAOA;

      detalhesAeroportos.push({
        codigo_icao: aeroporto.codigo_icao,
        nome: aeroporto.nome,
        total_voos: voos.length,
        total_passageiros: totalPassageiros,
        total_carga: totalCarga,
        total_faturacao_usd: Number(totalFaturacaoUSD).toFixed(2),
        total_faturacao_aoa: totalFaturacaoAOA
      });
    }

    if (detalhesAeroportos.length === 0) {
      return Response.json({ 
        sucesso: true,
        mensagem: 'Nenhum voo no período',
        notificacoes_enviadas: 0
      });
    }

    const dataInicioParsed = new Date(dataInicio + 'T00:00:00');
    const mesAno = dataInicioParsed.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());

    // Versão resumida para WhatsApp - ordenar por total de voos
    const aeroportosOrdenados = [...detalhesAeroportos].sort((a, b) => b.total_voos - a.total_voos);
    let aeroportosTexto = '';

    aeroportosOrdenados.forEach((aero, index) => {
      aeroportosTexto += `\n*#${index + 1} ${aero.codigo_icao}*\n`;
      aeroportosTexto += `✈️ ${aero.total_voos} voos | 💰 $${aero.total_faturacao_usd}\n`;
    });

    const hoje = new Date();
    // Versão completa para email (todos os detalhes)
    let aeroportosTextoCompleto = '';
    detalhesAeroportos.forEach((aero, index) => {
      aeroportosTextoCompleto += `\n*#${index + 1} ${aero.codigo_icao}* - ${aero.nome}\n`;
      aeroportosTextoCompleto += `✈️ Voos: ${aero.total_voos}\n`;
      aeroportosTextoCompleto += `👥 Passageiros: ${aero.total_passageiros.toLocaleString('pt-AO')}\n`;
      aeroportosTextoCompleto += `📦 Carga: ${aero.total_carga.toLocaleString('pt-AO')} kg\n`;
      aeroportosTextoCompleto += `💰 Faturação: $${aero.total_faturacao_usd} (${aero.total_faturacao_aoa})\n`;
    });

    const dados = {
      mes_ano: mesAno,
      periodo: periodo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      data_inicio_formatada: dataInicioParsed.toLocaleDateString('pt-PT'),
      data_fim_formatada: dataInicioParsed.toLocaleDateString('pt-PT'),
      data_relatorio: hoje.toISOString().split('T')[0],
      total_aeroportos: detalhesAeroportos.length.toString(),
      total_voos_geral: totalVoosGeral.toString(),
      total_voos_arr_geral: totalVoosGeral.toString(),
      total_voos_dep_geral: totalVoosGeral.toString(),
      total_passageiros_geral: totalPassageirosGeral.toLocaleString('pt-AO'),
      total_carga_kg_geral: totalCargaGeral.toLocaleString('pt-AO'),
      total_faturacao_usd_geral: totalFaturacaoUSDGeral.toFixed(2),
      total_faturacao_aoa_geral: Math.round(totalFaturacaoAOAGeral).toLocaleString('pt-AO'),
      total_impostos_usd_geral: totalImpostosUSDGeral.toFixed(2),
      total_impostos_aoa_geral: Math.round(totalImpostosAOAGeral).toLocaleString('pt-AO'),
      subtotal_sem_impostos_usd_geral: (totalFaturacaoUSDGeral - totalImpostosUSDGeral).toFixed(2),
      subtotal_sem_impostos_aoa_geral: Math.round(totalFaturacaoAOAGeral - totalImpostosAOAGeral).toLocaleString('pt-AO'),
      detalhes_aeroportos_texto: aeroportosTextoCompleto,
      detalhes_aeroportos_texto_whatsapp: aeroportosTexto
    };

    const [regras, configs] = await Promise.all([
      base44.entities.RegraNotificacao.filter({
        evento_gatilho: 'relatorio_operacional_consolidado_mensal',
        ativo: true
      }).catch(() => []),
      base44.entities.ConfiguracaoNotificacoes.list().catch(() => [])
    ]);

    const configWhatsapp = (configs || []).find(c => c.numero_whatsapp_oficial);
    let notificacoesEnviadas = 0;
    const resultados = [];

    for (const regra of regras || []) {
      const usersNaRegra = [];

      if (regra.destinatarios_perfis && regra.destinatarios_perfis.length > 0) {
        const usuarios = await base44.entities.User.list();
        for (const usuario of usuarios) {
          if (usuario.perfis && usuario.perfis.some(p => regra.destinatarios_perfis.includes(p))) {
            usersNaRegra.push(usuario);
          }
        }
      }

      if (regra.destinatarios_usuarios_ids && regra.destinatarios_usuarios_ids.length > 0) {
        for (const userId of regra.destinatarios_usuarios_ids) {
          try {
            const usuario = await base44.entities.User.get(userId);
            if (usuario && !usersNaRegra.find(u => u.id === usuario.id)) {
              usersNaRegra.push(usuario);
            }
          } catch (e) {
            console.warn(`Aviso: Utilizador ${userId} não encontrado`);
          }
        }
      }

      for (const usuario of usersNaRegra) {
        let canaisEnviados = [];

        if (regra.canal_envio.includes('email') && regra.mensagem_template_email_assunto) {
          try {
            let assunto = regra.mensagem_template_email_assunto;
            let corpo = regra.mensagem_template_email_corpo;

            Object.keys(dados).forEach(key => {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              assunto = assunto.replace(regex, String(dados[key]));
              corpo = corpo.replace(regex, String(dados[key]));
            });

            await base44.integrations.Core.SendEmail({
              to: usuario.email,
              subject: assunto,
              body: corpo
            });
            canaisEnviados.push('email');
          } catch (e) {
            console.error(`Erro email para ${usuario.email}: ${e.message}`);
            resultados.push({ destinatario: usuario.full_name, canal: 'email', status: 'erro', motivo: e.message });
          }
        }

        if (regra.canal_envio.includes('whatsapp') && regra.mensagem_template_whatsapp && configWhatsapp && usuario.whatsapp_number && usuario.whatsapp_opt_in_status === 'confirmado') {
          try {
            let mensagem = regra.mensagem_template_whatsapp;
            Object.keys(dados).forEach(key => {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              mensagem = mensagem.replace(regex, String(dados[key]));
            });

            // Validar limite de 1600 caracteres
            const LIMITE_WHATSAPP = 1600;
            if (mensagem.length > LIMITE_WHATSAPP) {
              console.warn(`⚠️ Mensagem WhatsApp excede ${LIMITE_WHATSAPP} caracteres (${mensagem.length}). Truncando...`);
              mensagem = mensagem.substring(0, LIMITE_WHATSAPP - 3) + '...';
            }

            await base44.functions.invoke('sendWhatsAppMessage', {
              from: configWhatsapp.numero_whatsapp_oficial,
              to: usuario.whatsapp_number,
              body: mensagem
            });
            canaisEnviados.push('whatsapp');
          } catch (e) {
            console.error(`Erro WhatsApp para ${usuario.whatsapp_number}: ${e.message}`);
            resultados.push({ destinatario: usuario.full_name, canal: 'whatsapp', status: 'erro', motivo: e.message });
          }
        }

        if (canaisEnviados.length > 0) {
          notificacoesEnviadas++;
          resultados.push({ destinatario: usuario.full_name, canais: canaisEnviados, status: 'enviado' });
        }
      }
    }

    console.log(`✅ ${notificacoesEnviadas} notificações enviadas`);
    
    return Response.json({
      sucesso: true,
      mensagem: `Relatórios consolidados ${periodo} enviados - ${notificacoesEnviadas} notificação(ões)`,
      notificacoes_enviadas: notificacoesEnviadas,
      resultados
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ 
      error: 'Erro ao enviar relatórios',
      details: error.message 
    }, { status: 500 });
  }
});