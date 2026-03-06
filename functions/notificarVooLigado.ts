import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
    
    // Quando chamada por automação de entidade, o ID vem em event.entity_id
    // Quando chamada manualmente, vem como voo_ligado_id
    const voo_ligado_id = payload.event?.entity_id || payload.voo_ligado_id;

    if (!voo_ligado_id) {
      return Response.json({ error: 'ID do voo ligado é obrigatório' }, { status: 400 });
    }

    console.log('📧 Iniciando processo de notificação para voo ligado:', voo_ligado_id);

    // Buscar o voo ligado e dados relacionados
    const vooLigado = await base44.asServiceRole.entities.VooLigado.get(voo_ligado_id);
    
    if (!vooLigado) {
      return Response.json({ error: 'Voo ligado não encontrado' }, { status: 404 });
    }

    // Buscar dados dos voos ARR e DEP
    const [vooArr, vooDep] = await Promise.all([
      base44.asServiceRole.entities.Voo.get(vooLigado.id_voo_arr).catch(() => null),
      base44.asServiceRole.entities.Voo.get(vooLigado.id_voo_dep).catch(() => null)
    ]);

    if (!vooArr || !vooDep) {
      return Response.json({ error: 'Voos ARR/DEP não encontrados' }, { status: 404 });
    }

    // Buscar cálculo de tarifas
    const calculosTarifas = await base44.asServiceRole.entities.CalculoTarifa.filter({
      voo_ligado_id: voo_ligado_id
    });
    const calculoTarifa = calculosTarifas && calculosTarifas.length > 0 ? calculosTarifas[0] : null;

    // Preparar dados para substituição de placeholders
    const dados = {
      numero_voo_arr: vooArr.numero_voo || '',
      numero_voo_dep: vooDep.numero_voo || '',
      aeroporto: vooArr.aeroporto_operacao || '',
      aeroporto_origem: vooArr.aeroporto_origem_destino || '',
      aeroporto_destino: vooDep.aeroporto_origem_destino || '',
      companhia: vooArr.companhia_aerea || '',
      registo: vooArr.registo_aeronave || '',
      tipo_voo: vooArr.tipo_voo || '',
      status: vooArr.status || '',
      data_arr: vooArr.data_operacao || '',
      hora_arr: vooArr.horario_real || vooArr.horario_previsto || '',
      horario_previsto_arr: vooArr.horario_previsto || '',
      horario_real_arr: vooArr.horario_real || '',
      data_dep: vooDep.data_operacao || '',
      hora_dep: vooDep.horario_real || vooDep.horario_previsto || '',
      horario_previsto_dep: vooDep.horario_previsto || '',
      horario_real_dep: vooDep.horario_real || '',
      permanencia_horas: vooLigado.tempo_permanencia_min ? (vooLigado.tempo_permanencia_min / 60).toFixed(1) : '0',
      permanencia_minutos: vooLigado.tempo_permanencia_min || '0',
      passageiros_local_arr: vooArr.passageiros_local || '0',
      passageiros_local_dep: vooDep.passageiros_local || '0',
      passageiros_transito_arr: vooArr.passageiros_transito_transbordo || '0',
      passageiros_transito_dep: vooDep.passageiros_transito_transbordo || '0',
      passageiros_total_arr: vooArr.passageiros_total || '0',
      passageiros_total_dep: vooDep.passageiros_total || '0',
      tripulacao_arr: vooArr.tripulacao || '0',
      tripulacao_dep: vooDep.tripulacao || '0',
      carga_kg_arr: vooArr.carga_kg || '0',
      carga_kg_dep: vooDep.carga_kg || '0',
      mtow_kg: calculoTarifa?.mtow_kg || '0',
      tarifa_pouso_usd: calculoTarifa?.tarifa_pouso_usd?.toFixed(2) || '0.00',
      tarifa_permanencia_usd: calculoTarifa?.tarifa_permanencia_usd?.toFixed(2) || '0.00',
      tarifa_passageiros_usd: calculoTarifa?.tarifa_passageiros_usd?.toFixed(2) || '0.00',
      tarifa_carga_usd: calculoTarifa?.tarifa_carga_usd?.toFixed(2) || '0.00',
      total_usd: calculoTarifa?.total_tarifa_usd?.toFixed(2) || '0.00',
      total_aoa: calculoTarifa?.total_tarifa?.toLocaleString('pt-AO') || '0',
      taxa_cambio: calculoTarifa?.taxa_cambio_usd_aoa || '0',
      created_by: vooLigado.created_by || '',
      created_date: vooLigado.created_date ? new Date(vooLigado.created_date).toLocaleString('pt-PT') : ''
    };

    console.log('📊 Dados preparados para substituição:', dados);

    // Buscar regras ativas para o evento voo_ligado_criado
    const regras = await base44.asServiceRole.entities.RegraNotificacao.filter({
      evento_gatilho: 'voo_ligado_criado',
      ativo: true
    });

    if (!regras || regras.length === 0) {
      console.log('ℹ️ Nenhuma regra de notificação ativa para voo_ligado_criado');
      return Response.json({ 
        mensagem: 'Nenhuma regra de notificação configurada',
        notificacoes_enviadas: 0
      });
    }

    console.log(`📋 ${regras.length} regra(s) de notificação ativa(s) encontrada(s)`);

    // Buscar configurações de WhatsApp
    const configs = await base44.asServiceRole.entities.ConfiguracaoNotificacoes.list();
    const configWhatsapp = configs.find(c => c.numero_whatsapp_oficial);
    const provedorWhatsapp = (configs.length > 0 && configs[0].provedor_whatsapp) || 'twilio';

    let totalNotificacoes = 0;
    const resultados = [];

    // Processar cada regra
    for (const regra of regras) {
      console.log(`🔄 Processando regra: ${regra.nome}`);

      // Buscar destinatários
      const destinatarios = [];

      // Adicionar utilizadores por perfil
      if (regra.destinatarios_perfis && regra.destinatarios_perfis.length > 0) {
        const usuarios = await base44.asServiceRole.entities.User.list();
        
        for (const usuario of usuarios) {
          if (usuario.perfis && usuario.perfis.some(p => regra.destinatarios_perfis.includes(p))) {
            destinatarios.push(usuario);
          }
        }
      }

      // Adicionar utilizadores específicos
      if (regra.destinatarios_usuarios_ids && regra.destinatarios_usuarios_ids.length > 0) {
        for (const userId of regra.destinatarios_usuarios_ids) {
          try {
            const usuario = await base44.asServiceRole.entities.User.get(userId);
            if (usuario && !destinatarios.find(d => d.id === usuario.id)) {
              destinatarios.push(usuario);
            }
          } catch (e) {
            console.error(`Erro ao buscar utilizador ${userId}:`, e.message);
          }
        }
      }

      console.log(`👥 ${destinatarios.length} destinatário(s) encontrado(s) para esta regra`);

      // Verificar se deve enviar para grupo WhatsApp
      if (regra.canal_envio.includes('whatsapp') && regra.grupo_whatsapp_id && regra.mensagem_template_whatsapp) {
        console.log(`📱 Enviando para grupo WhatsApp: ${regra.grupo_whatsapp_id}`);
        
        try {
          // Substituir todos os placeholders no template
          let mensagem = regra.mensagem_template_whatsapp;
          
          Object.keys(dados).forEach(key => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            mensagem = mensagem.replace(regex, dados[key]);
          });

          // Enviar para o grupo via Z-API
          await base44.asServiceRole.functions.invoke('sendWhatsAppMessageToGroupZAPI', {
            groupId: regra.grupo_whatsapp_id,
            body: mensagem
          });

          totalNotificacoes++;
          resultados.push({
            destinatario: `Grupo WhatsApp (${regra.grupo_whatsapp_id})`,
            canal: 'whatsapp',
            status: 'enviado',
            metodo: 'grupo_zapi'
          });
          
          console.log(`✅ WhatsApp enviado para grupo ${regra.grupo_whatsapp_id}`);
        } catch (e) {
          console.error(`❌ Erro ao enviar WhatsApp para grupo:`, e.message);
          resultados.push({
            destinatario: `Grupo WhatsApp (${regra.grupo_whatsapp_id})`,
            canal: 'whatsapp',
            status: 'erro',
            motivo: e.message
          });
        }
      }

      // Enviar notificações individuais via WhatsApp e Email (SEMPRE, mesmo com grupo)
      for (const destinatario of destinatarios) {
        // Enviar WhatsApp se configurado e permitido
        if (regra.canal_envio.includes('whatsapp') && regra.mensagem_template_whatsapp) {
          // Verificar primeiro se tem número de WhatsApp configurado
          if (!destinatario.whatsapp_number) {
            console.log(`⚠️ Utilizador ${destinatario.full_name} não tem número de WhatsApp configurado`);
            resultados.push({
              destinatario: destinatario.full_name,
              canal: 'whatsapp',
              status: 'erro',
              motivo: 'Número de WhatsApp não configurado'
            });
            continue;
          }

          // Enviar notificação via WhatsApp
          if (configWhatsapp && configWhatsapp.numero_whatsapp_oficial) {
            try {
              // Substituir todos os placeholders no template
              let mensagem = regra.mensagem_template_whatsapp;
              
              Object.keys(dados).forEach(key => {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                mensagem = mensagem.replace(regex, dados[key]);
              });

              // Determinar provedor (regra específica ou configuração global)
              const provedorParaUtilizador = (regra.provedor_whatsapp_preferencial && regra.provedor_whatsapp_preferencial.trim() !== '') ? regra.provedor_whatsapp_preferencial : provedorWhatsapp;

              // Se for Z-API, enviar diretamente
              if (provedorParaUtilizador === 'zapi') {
                const numeroLimpo = destinatario.whatsapp_number.replace('whatsapp:', '').replace(/\s/g, '');
                
                const instanceId = Deno.env.get('ID_INSTANCIA_ZAPI');
                const clientToken = Deno.env.get('CLIENT_TOKEN_ZAPI');
                const token = Deno.env.get('TOKEN_ZAPI');

                if (!instanceId || !clientToken || !token) {
                  throw new Error('Credenciais Z-API não configuradas');
                }

                const encodedToken = encodeURIComponent(token);
                const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/send-text`;

                const response = await fetch(zapiUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Client-Token': clientToken
                  },
                  body: JSON.stringify({
                    phone: numeroLimpo,
                    message: mensagem
                  })
                });

                if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(`Z-API erro: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                console.log(`✅ Z-API enviado para ${destinatario.full_name}:`, data.messageId);
              } else {
                // Usar Twilio - Se não tem opt-in confirmado, enviar com template
                const isTemplateRequired = destinatario.whatsapp_opt_in_status !== 'confirmado';
                
                await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
                  from: configWhatsapp.numero_whatsapp_oficial,
                  to: destinatario.whatsapp_number,
                  body: mensagem,
                  contentSid: isTemplateRequired ? true : undefined,
                  optInDate: destinatario.whatsapp_opt_in_date
                });
              }

              totalNotificacoes++;
              resultados.push({
                destinatario: destinatario.full_name,
                canal: 'whatsapp',
                status: 'enviado',
                metodo: provedorParaUtilizador
              });
              
              console.log(`✅ WhatsApp enviado para ${destinatario.full_name}`);
            } catch (e) {
              console.error(`❌ Erro ao enviar WhatsApp para ${destinatario.full_name}:`, e.message);
              resultados.push({
                destinatario: destinatario.full_name,
                canal: 'whatsapp',
                status: 'erro',
                motivo: e.message
              });
            }
          }
        }

          // Enviar Email se configurado
          if (regra.canal_envio.includes('email') && regra.mensagem_template_email_assunto && regra.mensagem_template_email_corpo) {
            try {
              // Substituir placeholders no assunto e corpo do email
              let assunto = regra.mensagem_template_email_assunto;
              let corpo = regra.mensagem_template_email_corpo;
              
              Object.keys(dados).forEach(key => {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                assunto = assunto.replace(regex, dados[key]);
                corpo = corpo.replace(regex, dados[key]);
              });

              await base44.integrations.Core.SendEmail({
                to: destinatario.email,
                subject: assunto,
                body: corpo
              });

              totalNotificacoes++;
              resultados.push({
                destinatario: destinatario.full_name,
                canal: 'email',
                status: 'enviado'
              });
              
              console.log(`✅ Email enviado para ${destinatario.full_name}`);
            } catch (e) {
              console.error(`❌ Erro ao enviar email para ${destinatario.full_name}:`, e.message);
              resultados.push({
                destinatario: destinatario.full_name,
                canal: 'email',
                status: 'erro',
                motivo: e.message
              });
            }
        }
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: `Processo de notificação concluído`,
      notificacoes_enviadas: totalNotificacoes,
      resultados: resultados
    });

  } catch (error) {
    console.error('❌ Erro ao notificar voo ligado:', error);
    return Response.json({ 
      error: 'Erro ao processar notificações',
      details: error.message 
    }, { status: 500 });
  }
});