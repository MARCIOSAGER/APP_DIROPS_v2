import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { differenceInHours, parseISO } from 'npm:date-fns';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Receber dados do Twilio (form-encoded)
    let data = {};
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      data = await req.json();
    } else {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
    }

    console.log('📱 Webhook Twilio recebido:', {
      from: data.From,
      to: data.To,
      body: data.Body,
      messageType: data.MessageType,
      timestamp: new Date().toISOString()
    });

    // Salvar mensagem recebida no banco de dados
    const mediaUrls = [];
    const numMedia = parseInt(data.NumMedia || '0');
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = data[`MediaUrl${i}`];
      if (mediaUrl) mediaUrls.push(mediaUrl);
    }

    console.log('💾 Salvando mensagem na BD...');
    const mensagemData = {
      from: data.From || data.from || '',
      to: data.To || data.to || '',
      body: data.Body || data.body || '',
      message_sid: data.MessageSid || data.message_sid || '',
      num_media: data.NumMedia || data.num_media || '0',
      media_urls: mediaUrls,
      tipo: 'recebida',
      processada: false
    };
    
    console.log('📝 Dados a salvar:', mensagemData);
    
    if (!mensagemData.from || !mensagemData.to) {
      console.error('❌ Campos from/to vazios:', mensagemData);
      return Response.json({ error: 'Missing from or to' }, { status: 400 });
    }
    
    await base44.asServiceRole.entities.MensagemWhatsApp.create(mensagemData);
    
    // Identificar o utilizador pelo número de WhatsApp
    const userMessage = (data.Body || '').toLowerCase().trim();
    console.log('🔍 Analisando mensagem:', userMessage);
    
    // Buscar utilizador pelo número de WhatsApp
    const usuarios = await base44.asServiceRole.entities.User.filter({
      whatsapp_number: data.From
    });
    
    if (usuarios && usuarios.length > 0) {
      const usuario = usuarios[0];
      
      // Verificar se é uma resposta de opt-in
      const respOpcaoSim = userMessage.includes('sim') || userMessage.includes('confirmo') || 
                           userMessage.includes('aceito') || userMessage.includes('yes') || 
                           userMessage.includes('ok');
      
      console.log(`🔍 DEBUG OPT-IN:`);
      console.log(`   respOpcaoSim: ${respOpcaoSim}`);
      console.log(`   whatsapp_opt_in_status: ${usuario.whatsapp_opt_in_status}`);
      console.log(`   whatsapp_opt_in_date RAW: ${usuario.whatsapp_opt_in_date}`);
      
      // Verificar se a janela de 24h expirou
      let janelaExpirada = false;
      let horasDecorridas = 0;
      if (usuario.whatsapp_opt_in_date) {
        try {
          const optInDateTime = parseISO(usuario.whatsapp_opt_in_date);
          const now = new Date();
          horasDecorridas = differenceInHours(now, optInDateTime);
          janelaExpirada = horasDecorridas >= 24;
          console.log(`   optInDateTime: ${optInDateTime.toISOString()}`);
          console.log(`   now: ${now.toISOString()}`);
          console.log(`   horasDecorridas: ${horasDecorridas}h`);
          console.log(`   janelaExpirada: ${janelaExpirada}`);
        } catch (e) {
          console.warn(`⚠️ Erro ao parsear optInDate: ${e.message}`);
        }
      } else {
        console.log(`   ⚠️ whatsapp_opt_in_date é null/undefined`);
      }
      
      if (respOpcaoSim) {

        console.log('✅ Confirmação de opt-in detectada para:', usuario.full_name);

        // Atualizar status e data do opt-in (sempre renovar a data quando recebe "sim")
        const nowISO = new Date().toISOString();
        console.log(`⏰ Timestamp ISO a guardar: ${nowISO}`);

        const updateResult = await base44.asServiceRole.entities.User.update(usuario.id, {
          whatsapp_opt_in_status: 'confirmado',
          whatsapp_opt_in_date: nowISO
        });

        console.log(`✅ Utilizador ${usuario.email} atualizado:`, {
          novo_status: 'confirmado',
          nova_data: nowISO,
          update_result: updateResult
        });

        // Verificar o registo após atualização
        const userVerificacao = await base44.asServiceRole.entities.User.get(usuario.id);
        console.log(`✓ Verificação pós-atualização:`, {
          whatsapp_opt_in_status: userVerificacao.whatsapp_opt_in_status,
          whatsapp_opt_in_date: userVerificacao.whatsapp_opt_in_date
        });
        
        // Enviar mensagem de confirmação
        try {
          const twilio = await import('npm:twilio');
          const client = twilio.default(Deno.env.get('TWILIO_ACCOUNT_SID'), Deno.env.get('TWILIO_AUTH_TOKEN'));
          
          await client.messages.create({
            from: data.To,
            to: data.From,
            body: `✅ Obrigado, ${usuario.full_name}!\n\nO seu consentimento foi registado. A partir de agora, você receberá notificações automáticas sobre voos ligados e outras informações importantes do sistema DIROPS-SGA.`
          });
          
          console.log('✅ Mensagem de confirmação de opt-in enviada');
        } catch (sendError) {
          console.error('❌ Erro ao enviar confirmação:', sendError.message || sendError);
        }
        
      } else if (usuario.whatsapp_opt_in_status === 'pendente' && 
                 (userMessage.includes('não') || userMessage.includes('nao') || 
                  userMessage.includes('recuso') || userMessage.includes('no'))) {
        
        console.log('❌ Rejeição de opt-in detectada para:', usuario.full_name);
        
        // Atualizar status do opt-in
        await base44.asServiceRole.entities.User.update(usuario.id, {
          whatsapp_opt_in_status: 'rejeitado',
          whatsapp_opt_in_date: new Date().toISOString()
        });
        
        // Enviar mensagem de confirmação da rejeição
        try {
          const twilio = await import('npm:twilio');
          const client = twilio.default(Deno.env.get('TWILIO_ACCOUNT_SID'), Deno.env.get('TWILIO_AUTH_TOKEN'));
          
          await client.messages.create({
            from: data.To,
            to: data.From,
            body: `Compreendido. Você não receberá notificações via WhatsApp do sistema DIROPS-SGA.`
          });
          
          console.log('✅ Mensagem de rejeição enviada');
        } catch (sendError) {
          console.error('❌ Erro ao enviar rejeição:', sendError.message || sendError);
        }
      } else {
        console.log('ℹ️ Mensagem recebida de utilizador já confirmado ou mensagem genérica');
      }
    } else {
      console.log('⚠️ Utilizador não encontrado para o número:', data.From);
    }
    
    // Marcar mensagem como processada
    const mensagens = await base44.asServiceRole.entities.MensagemWhatsApp.filter({
      message_sid: data.MessageSid
    });
    if (mensagens && mensagens.length > 0) {
      await base44.asServiceRole.entities.MensagemWhatsApp.update(mensagens[0].id, {
        processada: true
      });
    }
    
    // Responder ao Twilio (200 OK)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      }
    );
  } catch (error) {
    console.error('❌ Erro ao receber mensagem WhatsApp:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});