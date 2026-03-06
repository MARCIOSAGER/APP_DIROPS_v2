import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { differenceInHours, parseISO } from 'npm:date-fns';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const periodo = 'diario';
    
    console.log(`🌍 Iniciando envio de relatórios consolidados ${periodo}...`);

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const dataInicio = ontem.toISOString().split('T')[0];
    const dataFim = dataInicio;

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

      voosLigadosDoAeroporto.forEach((vl) => {
        const calculo = calculosTarifa.find(ct => ct.voo_ligado_id === vl.id);
        if (calculo) {
          totalFaturacaoAOA += calculo.total_tarifa_com_impostos_aoa || calculo.total_tarifa || 0;
          totalFaturacaoUSD += calculo.total_tarifa_com_impostos_usd || calculo.total_tarifa_usd || 0;
        }
      });

      totalVoosGeral += voos.length;
      totalPassageirosGeral += totalPassageiros;
      totalCargaGeral += totalCarga;
      totalFaturacaoUSDGeral += totalFaturacaoUSD;
      totalFaturacaoAOAGeral += totalFaturacaoAOA;

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

    // Ordenar aeroportos por número de voos
    detalhesAeroportos.sort((a, b) => b.total_voos - a.total_voos);

    const dataInicioParsed = new Date(dataInicio + 'T00:00:00');
    const dataFormatada = dataInicioParsed.toLocaleDateString('pt-PT');

    // Versão completa para email
    let aeroportosTexto = '';
    detalhesAeroportos.forEach((aero, index) => {
      aeroportosTexto += `\n*#${index + 1} ${aero.codigo_icao}* - ${aero.nome}\n`;
      aeroportosTexto += `✈️ Voos: ${aero.total_voos}\n`;
      aeroportosTexto += `👥 Passageiros: ${aero.total_passageiros.toLocaleString('pt-AO')}\n`;
      aeroportosTexto += `💰 Faturação: $${aero.total_faturacao_usd}\n`;
    });

    // Versão resumida para WhatsApp - top 10
    const maxAeroportosWhatsapp = 10;
    let aeroportosTextoWhatsapp = '';
    const aeroportosMostrados = detalhesAeroportos.slice(0, maxAeroportosWhatsapp);
    
    aeroportosMostrados.forEach((aero, index) => {
      aeroportosTextoWhatsapp += `\n*#${index + 1} ${aero.codigo_icao}*\n`;
      aeroportosTextoWhatsapp += `✈️ ${aero.total_voos} voos | 💰 $${aero.total_faturacao_usd}\n`;
    });

    if (detalhesAeroportos.length > maxAeroportosWhatsapp) {
      aeroportosTextoWhatsapp += `\n... e mais ${detalhesAeroportos.length - maxAeroportosWhatsapp} aeroportos.\n`;
      aeroportosTextoWhatsapp += `Verifique o seu email para o relatório completo!`;
    }

    const dados = {
      data_inicio_formatada: dataFormatada,
      data_fim_formatada: dataFormatada,
      data_relatorio: dataFormatada,
      periodo: periodo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      total_aeroportos: detalhesAeroportos.length.toString(),
      total_voos_geral: totalVoosGeral.toString(),
      total_voos_arr_geral: totalVoosGeral.toString(),
      total_voos_dep_geral: totalVoosGeral.toString(),
      total_passageiros_geral: totalPassageirosGeral.toLocaleString('pt-AO'),
      total_carga_kg_geral: totalCargaGeral.toLocaleString('pt-AO'),
      total_faturacao_usd_geral: totalFaturacaoUSDGeral.toFixed(2),
      total_faturacao_aoa_geral: Math.round(totalFaturacaoAOAGeral).toLocaleString('pt-AO'),
      total_impostos_usd_geral: '0.00',
      total_impostos_aoa_geral: '0',
      subtotal_sem_impostos_usd_geral: totalFaturacaoUSDGeral.toFixed(2),
      subtotal_sem_impostos_aoa_geral: Math.round(totalFaturacaoAOAGeral).toLocaleString('pt-AO'),
      detalhes_aeroportos_texto: aeroportosTexto,
      detalhes_aeroportos_texto_whatsapp: aeroportosTextoWhatsapp
    };

    const [regras, configs] = await Promise.all([
      base44.entities.RegraNotificacao.filter({
        evento_gatilho: 'relatorio_operacional_consolidado_diario',
        ativo: true
      }).catch(() => []),
      base44.entities.ConfiguracaoNotificacoes.list().catch(() => [])
    ]);

    console.log(`🔍 Regras encontradas: ${(regras || []).length}`);
    regras?.forEach((r, i) => {
      const regraDados = r.data || r;
      console.log(`   [${i}] ${regraDados.nome} - Canais: ${regraDados.canal_envio?.join(', ')} - Perfis: ${regraDados.destinatarios_perfis?.join(', ')}`);
    });

    const configWhatsapp = (configs || []).find(c => c.numero_whatsapp_oficial);
    const provedorWhatsapp = (configs.length > 0 && configs[0].provedor_whatsapp) || 'twilio';
    console.log(`📱 Configuração WhatsApp: ${configWhatsapp ? '✅ Encontrada (' + configWhatsapp.numero_whatsapp_oficial + ')' : '❌ NÃO ENCONTRADA'}`);
    console.log(`📡 Provedor WhatsApp: ${provedorWhatsapp.toUpperCase()}`);
    
    let notificacoesEnviadas = 0;

    // Processar grupos WhatsApp primeiro (Z-API)
    for (const regra of regras || []) {
      const regraDados = regra.data || regra;
      if (regraDados.grupo_whatsapp_id && regraDados.canal_envio && regraDados.canal_envio.includes('whatsapp')) {
        try {
          console.log(`\n📡 Enviando para grupo WhatsApp: ${regraDados.grupo_whatsapp_id}`);
          
          let mensagem = regraDados.mensagem_template_whatsapp || '';
          
          if (!mensagem || mensagem.trim() === '') {
            mensagem = `📊 *Relatório Operacional Consolidado (${periodo})*\n\nPeríodo: {{data_inicio_formatada}} a {{data_fim_formatada}}\n\n{{detalhes_aeroportos_texto_whatsapp}}`;
          }
          
          // Substituir placeholders
          Object.keys(dados).forEach(key => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            mensagem = mensagem.replace(regex, String(dados[key]));
          });

          console.log(`📝 Tamanho da mensagem: ${mensagem.length} caracteres`);

          // Delay maior para evitar rate limit (2 segundos entre envios)
          if (notificacoesEnviadas > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          await base44.asServiceRole.functions.invoke('sendWhatsAppMessageToGroupZAPI', {
            groupId: regraDados.grupo_whatsapp_id,
            body: mensagem
          });

          notificacoesEnviadas++;
          console.log(`✅ Mensagem enviada para grupo com sucesso`);
        } catch (e) {
          console.error(`❌ Erro ao enviar para grupo: ${e.message}`);
          // Não falhar toda a função se um grupo falhar
        }
      }
    }

    // Processar envios individuais
    for (const regra of regras || []) {
      const regraDados = regra.data || regra;
      console.log(`\n⚙️ Processando regra: ${regraDados.nome}`);
      const usersNaRegra = [];

      if (regraDados.destinatarios_perfis && regraDados.destinatarios_perfis.length > 0) {
        const usuarios = await base44.entities.User.list();
        console.log(`   📋 Total de utilizadores no sistema: ${usuarios.length}`);
        
        for (const usuario of usuarios) {
          if (usuario.perfis && usuario.perfis.some(p => regraDados.destinatarios_perfis.includes(p))) {
            console.log(`   ✅ Utilizador ${usuario.email} tem perfil(s): ${usuario.perfis?.join(', ')}`);
            usersNaRegra.push(usuario);
          }
        }
      }

      if (regraDados.destinatarios_usuarios_ids && regraDados.destinatarios_usuarios_ids.length > 0) {
        const usuariosEspecificos = await base44.entities.User.filter({ id: { $in: regraDados.destinatarios_usuarios_ids } });
        usuariosEspecificos?.forEach(usuEsp => {
          if (!usersNaRegra.some(u => u.id === usuEsp.id)) {
            console.log(`   ✅ Utilizador específico ${usuEsp.email} adicionado`);
            usersNaRegra.push(usuEsp);
          }
        });
      }

      console.log(`   👥 Total de utilizadores para esta regra: ${usersNaRegra.length}`);

      for (const usuario of usersNaRegra) {
        console.log(`   📧 Processando ${usuario.email}`);
        let canaisEnviadosComSucesso = [];
        let erros = [];

        if (regraDados.canal_envio.includes('email')) {
          if (!regraDados.mensagem_template_email_assunto) {
            console.log(`      ⚠️ EMAIL: Template de assunto vazio`);
          } else if (!regraDados.mensagem_template_email_corpo) {
            console.log(`      ⚠️ EMAIL: Template de corpo vazio`);
          } else {
            try {
              let assunto = regraDados.mensagem_template_email_assunto;
              let corpo = regraDados.mensagem_template_email_corpo;
              
              Object.keys(dados).forEach(key => {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                assunto = assunto.replace(regex, String(dados[key]));
                corpo = corpo.replace(regex, String(dados[key]));
              });

              // Delay para evitar rate limit no email (1 segundo)
              if (notificacoesEnviadas > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }

              console.log(`      📤 Enviando email para ${usuario.email}`);
              await base44.integrations.Core.SendEmail({
                to: usuario.email,
                subject: assunto,
                body: corpo
              });
              console.log(`      ✅ Email enviado com sucesso`);
              canaisEnviadosComSucesso.push('email');
              notificacoesEnviadas++;
            } catch (e) {
              console.log(`      ❌ Erro ao enviar email: ${e.message}`);
              erros.push({ canal: 'email', motivo: e.message });
              // Não falhar se for erro de créditos - apenas registrar
              if (e.message?.includes('credit')) {
                console.warn(`      ⚠️ Limite de créditos atingido - parando envios`);
                break;
              }
            }
          }
        }

        if (regraDados.canal_envio.includes('whatsapp')) {
           if (!regraDados.mensagem_template_whatsapp) {
             console.log(`      ⚠️ WHATSAPP: Template vazio`);
           } else if (!configWhatsapp) {
             console.log(`      ⚠️ WHATSAPP: Configuração de WhatsApp não encontrada`);
           } else if (!usuario.whatsapp_number) {
             console.log(`      ⚠️ WHATSAPP: Número de WhatsApp não registado para ${usuario.email}`);
           } else {
             try {
               let mensagem = regraDados.mensagem_template_whatsapp;

               // Substituir placeholders
               Object.keys(dados).forEach(key => {
                 const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                 mensagem = mensagem.replace(regex, String(dados[key]));
               });

               // Validar limite de 1600 caracteres
               const LIMITE_WHATSAPP = 1600;
               if (mensagem.length > LIMITE_WHATSAPP) {
                 console.warn(`      ⚠️ Mensagem WhatsApp excede ${LIMITE_WHATSAPP} caracteres (${mensagem.length}). Truncando...`);
                 mensagem = mensagem.substring(0, LIMITE_WHATSAPP - 3) + '...';
               }

               // Delay maior para evitar rate limit (2 segundos entre mensagens)
               if (notificacoesEnviadas > 0) {
                 await new Promise(resolve => setTimeout(resolve, 2000));
               }

               // Determinar o provedor para este utilizador (pode ter preferência na regra)
               const provedorParaUtilizador = regraDados.provedor_whatsapp_preferencial || provedorWhatsapp;

               // Se for Z-API, enviar diretamente (sem verificação de opt-in ou 24h)
               if (provedorParaUtilizador === 'zapi') {
                 console.log(`      📤 Enviando WhatsApp via Z-API para ${usuario.whatsapp_number}`);
                 
                 // Limpar formato whatsapp: do número
                 const numeroLimpo = usuario.whatsapp_number.replace('whatsapp:', '');
                 
                 await base44.functions.invoke('sendWhatsAppMessageZAPI', {
                   to: numeroLimpo,
                   body: mensagem
                 });
               } else {
                 // Se for Twilio, verificar opt-in e regra de 24h
                 if (usuario.whatsapp_opt_in_status !== 'confirmado') {
                   console.log(`      ⚠️ TWILIO: Opt-in não confirmado. Enviando opt-in...`);
                   await base44.asServiceRole.entities.MensagemWhatsAppPendente.create({
                     user_id: usuario.id,
                     numero_whatsapp: usuario.whatsapp_number,
                     tipo_mensagem: 'relatorio_consolidado',
                     conteudo: mensagem,
                     motivo_pendencia: 'sem_opt_in',
                     status: 'pendente',
                     data_criacao: new Date().toISOString(),
                     data_expiracao: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                   });

                   await base44.asServiceRole.functions.invoke('enviarOptInWhatsApp', {
                     user_id: usuario.id
                   });
                   console.log(`      ✅ Opt-in enviado e mensagem adicionada à fila`);
                   continue;
                 }

                 // Verificar se a janela de 24h expirou (apenas Twilio)
                 let deveUsarTemplate = false;
                 if (usuario.whatsapp_opt_in_date) {
                   try {
                     const optInDateTime = parseISO(usuario.whatsapp_opt_in_date);
                     const now = new Date();
                     const horasDecorridas = differenceInHours(now, optInDateTime);
                     deveUsarTemplate = horasDecorridas >= 24;
                     console.log(`      ⏰ Horas desde opt-in: ${horasDecorridas}h | Usar template: ${deveUsarTemplate}`);
                   } catch (e) {
                     console.warn(`      ⚠️ Erro ao parsear opt-in date`);
                   }
                 }

                 console.log(`      📤 Enviando WhatsApp via Twilio para ${usuario.whatsapp_number} (${deveUsarTemplate ? 'template' : 'mensagem livre'})`);

                 const messageParams = {
                   from: configWhatsapp.numero_whatsapp_oficial,
                   to: usuario.whatsapp_number,
                   body: mensagem
                 };

                 if (deveUsarTemplate) {
                   messageParams.contentSid = true;
                   messageParams.optInDate = usuario.whatsapp_opt_in_date;
                 }

                 await base44.functions.invoke('sendWhatsAppMessage', messageParams);
               }

               console.log(`      ✅ WhatsApp enviado com sucesso`);
               canaisEnviadosComSucesso.push('whatsapp');
               notificacoesEnviadas++;
               } catch (e) {
               console.log(`      ❌ Erro ao enviar WhatsApp: ${e.message}`);
               erros.push({ canal: 'whatsapp', motivo: e.message });
               // Não falhar se for rate limit - apenas registrar
               if (e.message?.includes('rate limit') || e.message?.includes('Too many')) {
                 console.warn(`      ⚠️ Rate limit atingido - parando envios WhatsApp`);
                 break;
               }
               }
           }
        }

        if (canaisEnviadosComSucesso.length > 0) {
          console.log(`      🎉 Notificação enviada via: ${canaisEnviadosComSucesso.join(', ')}`);
        } else if (erros.length === 0) {
          console.log(`      ⚠️ Nenhum canal configurado corretamente para envio`);
        }
      }
    }

    console.log(`✅ ${notificacoesEnviadas} notificações enviadas`);
    
    return Response.json({
      sucesso: true,
      mensagem: `Relatórios consolidados ${periodo} enviados`,
      notificacoes_enviadas: notificacoesEnviadas
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ 
      error: 'Erro ao enviar relatórios',
      details: error.message 
    }, { status: 500 });
  }
});