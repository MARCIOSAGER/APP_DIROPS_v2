import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { user_id } = await req.json();

    if (!user_id) {
      return Response.json({ error: 'ID do utilizador é obrigatório' }, { status: 400 });
    }

    // Buscar utilizador com service role
    let targetUser;
    try {
      targetUser = await base44.asServiceRole.entities.User.get(user_id);
    } catch (error) {
      console.error('❌ Erro ao buscar utilizador:', error);
      return Response.json({ error: 'Utilizador não encontrado', details: error.message }, { status: 404 });
    }

    if (!targetUser) {
      return Response.json({ error: 'Utilizador não encontrado' }, { status: 404 });
    }

    console.log('✅ Utilizador encontrado:', targetUser.full_name, targetUser.email);

    // Verificar se tem número de WhatsApp configurado
    console.log('📱 Número WhatsApp do utilizador:', targetUser.whatsapp_number);

    if (!targetUser.whatsapp_number) {
      return Response.json({ 
        error: 'Número de WhatsApp não configurado para este utilizador',
        details: 'O utilizador precisa configurar o número de WhatsApp no perfil'
      }, { status: 400 });
    }

    // Verificar se já confirmou opt-in
    if (targetUser.whatsapp_opt_in_status === 'confirmado') {
      return Response.json({ 
        error: 'Utilizador já confirmou o opt-in anteriormente' 
      }, { status: 400 });
    }

    // Buscar configurações de WhatsApp
    console.log('🔍 Buscando configurações de WhatsApp...');
    const configs = await base44.asServiceRole.entities.ConfiguracaoNotificacoes.list();
    const configWhatsapp = configs.find(c => c.numero_whatsapp_oficial);
    const provedorWhatsapp = (configs.length > 0 && configs[0].provedor_whatsapp) || 'twilio';

    console.log('📋 Configurações encontradas:', configs.length);
    console.log('📞 Número oficial WhatsApp:', configWhatsapp?.numero_whatsapp_oficial);
    console.log('📡 Provedor WhatsApp:', provedorWhatsapp);

    if (!configWhatsapp || !configWhatsapp.numero_whatsapp_oficial) {
      return Response.json({ 
        error: 'Número oficial do WhatsApp não configurado nas Configurações de Notificações.',
        details: 'Configure o número oficial na página de Configurações Gerais'
      }, { status: 400 });
    }

    try {
      // Se for Z-API, enviar mensagem de opt-in via Z-API com botões
      if (provedorWhatsapp === 'zapi') {
        console.log('📤 Enviando opt-in via Z-API com botões interativos...');

        // Buscar configuração de opt-in da Z-API
        const configsOptIn = await base44.asServiceRole.entities.ConfiguracaoOptInZAPI.list();
        const configOptIn = configsOptIn.length > 0 ? configsOptIn[0] : null;

        if (!configOptIn || !configOptIn.mensagem_boas_vindas) {
          return Response.json({ 
            error: 'Mensagem de opt-in Z-API não configurada',
            details: 'Configure a mensagem de boas-vindas na página de Configurações Gerais'
          }, { status: 400 });
        }

        const instanceId = Deno.env.get('ID_INSTANCIA_ZAPI');
        const clientToken = Deno.env.get('CLIENT_TOKEN_ZAPI');
        const token = Deno.env.get('TOKEN_ZAPI');

        if (!instanceId || !clientToken || !token) {
          throw new Error('Credenciais Z-API não configuradas');
        }

        // Limpar número (remover whatsapp: e espaços)
        const numeroLimpo = targetUser.whatsapp_number.replace('whatsapp:', '').replace(/\s/g, '');

        console.log('📱 Enviando para:', numeroLimpo);

        const encodedToken = encodeURIComponent(token);
        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/send-button-actions`;

        const bodyPayload = {
          phone: numeroLimpo,
          message: configOptIn.mensagem_boas_vindas,
          buttonActions: [
            {
              id: "opt_in_sim",
              type: "REPLY",
              label: configOptIn.botao_opt_in_label || "✅ SIM"
            },
            {
              id: "opt_in_nao",
              type: "REPLY",
              label: configOptIn.botao_opt_out_label || "❌ NAO"
            }
          ]
        };

        console.log('📋 Payload dos botões:', JSON.stringify(bodyPayload, null, 2));

        const response = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': clientToken
          },
          body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Z-API erro: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Mensagem Z-API com botões enviada:', data.messageId);

        // Atualizar status do utilizador para pendente
        await base44.asServiceRole.entities.User.update(user_id, {
          whatsapp_opt_in_status: 'pendente'
        });

        return Response.json({ 
          sucesso: true,
          mensagem: 'Mensagem de opt-in enviada com sucesso via Z-API',
          message_id: data.messageId,
          destinatario: targetUser.full_name,
          provedor: 'zapi'
        });

      } else {
        // Usar Twilio
        console.log('📤 Preparando envio de mensagem via Twilio (Content Template)...');
        console.log('📱 De:', configWhatsapp.numero_whatsapp_oficial);
        console.log('📱 Para:', targetUser.whatsapp_number);

        if (!configWhatsapp.content_template_sid) {
          return Response.json({ 
            error: 'Content Template SID não configurado nas Configurações de Notificações.',
            details: 'Configure o Content Template SID na página de Configurações Gerais'
          }, { status: 400 });
        }

        const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

        if (!twilioAccountSid || !twilioAuthToken) {
          throw new Error('Credenciais Twilio não configuradas');
        }

        const twilio = await import('npm:twilio');
        const client = twilio.default(twilioAccountSid, twilioAuthToken);

        console.log('✅ Cliente Twilio inicializado');

        const message = await client.messages.create({
          from: configWhatsapp.numero_whatsapp_oficial,
          to: targetUser.whatsapp_number,
          contentSid: configWhatsapp.content_template_sid
        });

        console.log('✅ Mensagem enviada com sucesso! SID:', message.sid);

        // Atualizar status do utilizador para pendente
        await base44.asServiceRole.entities.User.update(user_id, {
          whatsapp_opt_in_status: 'pendente'
        });

        console.log('✅ Mensagem de opt-in enviada:', message.sid);

        return Response.json({ 
          sucesso: true,
          mensagem: 'Mensagem de opt-in enviada com sucesso via Twilio',
          message_sid: message.sid,
          destinatario: targetUser.full_name,
          provedor: 'twilio'
        });
      }

    } catch (error) {
      console.error('❌ Erro ao enviar opt-in:', error);
      console.error('Detalhes do erro:', {
        message: error.message,
        code: error.code,
        moreInfo: error.moreInfo,
        status: error.status
      });

      return Response.json({ 
        error: 'Erro ao enviar mensagem de opt-in',
        details: error.message,
        code: error.code,
        moreInfo: error.moreInfo
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Erro ao processar envio de opt-in:', error);
    return Response.json({ 
      error: 'Erro ao processar solicitação',
      details: error.message 
    }, { status: 500 });
  }
});