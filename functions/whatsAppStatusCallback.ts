import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
        console.log('🔔 ===== WEBHOOK CHAMADO =====');
        console.log('📍 URL:', req.url);
        console.log('📍 Método:', req.method);
        console.log('📍 Headers:', Object.fromEntries(req.headers.entries()));

        try {
          const base44 = createClientFromRequest(req);
    
    // Receber dados do Twilio sobre status da mensagem
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

        console.log('📊 DADOS COMPLETOS DO CALLBACK:', JSON.stringify(data, null, 2));
        console.log('📊 Status de mensagem WhatsApp:', {
          messageSid: data.MessageSid,
          messageStatus: data.MessageStatus,
          to: data.To,
          from: data.From,
          body: data.Body,
          timestamp: new Date().toISOString()
        });

    // Status possíveis: queued, sending, sent, delivered, read, failed, undelivered
    
    // Se mensagem foi recebida (resposta do utilizador ao opt-in)
    if (data.MessageStatus === 'received' && data.Body) {
      console.log('📥 Mensagem recebida do utilizador - processando opt-in');

      try {
        // Buscar utilizador pelo número de WhatsApp
        const numeroWhatsappRaw = data.From?.replace('whatsapp:', '') || '';

        // Tentar encontrar por diferentes formatos do número
        let usuarios = [];

        // Formato 1: whatsapp:+244XXXXXXXXX
        usuarios = await base44.asServiceRole.entities.User.filter({
          whatsapp_number: `whatsapp:${numeroWhatsappRaw}`
        }).catch(() => []);

        // Formato 2: +244XXXXXXXXX
        if (!usuarios || usuarios.length === 0) {
          usuarios = await base44.asServiceRole.entities.User.filter({
            whatsapp_number: numeroWhatsappRaw
          }).catch(() => []);
        }

        // Formato 3: 244XXXXXXXXX (sem +)
        if (!usuarios || usuarios.length === 0) {
          const numeroSemMais = numeroWhatsappRaw.replace('+', '');
          usuarios = await base44.asServiceRole.entities.User.filter({
            whatsapp_number: numeroSemMais
          }).catch(() => []);
        }

        console.log(`🔍 Procurando utilizador com número: ${numeroWhatsappRaw} | Encontrados: ${usuarios?.length || 0}`);

        if (usuarios && usuarios.length > 0) {
          const usuario = usuarios[0];
          console.log(`👤 Utilizador encontrado: ${usuario.email}`);

          // Verificar se a resposta contém "sim" ou similar
                const respostaConfirma = ['sim', 'yes', 'ok', 'confirmo', 'aceito'].some(palavra => 
                  data.Body?.toLowerCase().includes(palavra)
                );

                if (respostaConfirma) {
                  console.log(`✅ Resposta positiva recebida de ${usuario.email}: "${data.Body}"`);

                  // Atualizar opt-in
                  await base44.asServiceRole.entities.User.update(usuario.id, {
                    whatsapp_opt_in_status: 'confirmado',
                    whatsapp_opt_in_date: new Date().toISOString()
                  });
                  console.log(`✅ Campo whatsapp_opt_in_date atualizado para ${usuario.email}`);
                } else {
                  console.log(`⚠️ Resposta não confirmou opt-in: "${data.Body}"`);
                }

          // Processar mensagens pendentes
          console.log(`📤 Invocando processamento de mensagens pendentes...`);
          await base44.asServiceRole.functions.invoke('procesarMensagensWhatsAppPendentes', {
            user_id: usuario.id
          });
        }
      } catch (e) {
        console.error(`❌ Erro ao processar opt-in confirmado: ${e.message}`);
      }
    }
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao processar status callback:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});