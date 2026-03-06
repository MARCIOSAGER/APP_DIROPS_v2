import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Função chamada pela whatsAppStatusCallback quando opt-in é confirmado
 * Processa e envia mensagens pendentes para o utilizador
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id } = await req.json();

    if (!user_id) {
      return Response.json({
        sucesso: false,
        erro: 'user_id é obrigatório'
      }, { status: 400 });
    }

    console.log(`📤 Procurando mensagens pendentes para user_id: ${user_id}`);

    // Buscar mensagens pendentes deste utilizador
    const mensagensRaw = await base44.asServiceRole.entities.MensagemWhatsAppPendente.filter({
      user_id: user_id,
      status: 'pendente'
    }).catch(() => []);

    const mensagens = Array.isArray(mensagensRaw) ? mensagensRaw : (mensagensRaw ? Object.values(mensagensRaw) : []);

    if (!mensagens || mensagens.length === 0) {
      console.log(`ℹ️ Nenhuma mensagem pendente encontrada para ${user_id}`);
      return Response.json({
        sucesso: true,
        mensagens_processadas: 0,
        mensagem: 'Nenhuma mensagem pendente'
      });
    }

    console.log(`📋 ${mensagens.length} mensagem(ns) pendente(s) encontrada(s)`);

    // Buscar configuração de WhatsApp
    const configs = await base44.asServiceRole.entities.ConfiguracaoNotificacoes.list().catch(() => []);
    const configWhatsapp = (configs || []).find(c => c.numero_whatsapp_oficial);

    if (!configWhatsapp) {
      console.log(`❌ Configuração de WhatsApp não encontrada`);
      return Response.json({
        sucesso: false,
        erro: 'Configuração de WhatsApp não disponível'
      }, { status: 500 });
    }

    let processadas = 0;
    let falhas = [];

    for (const msg of mensagens) {
      try {
        console.log(`📨 Enviando mensagem pendente: ${msg.id}`);

        // Validar que a mensagem ainda não expirou
        const dataExpiracao = new Date(msg.data_expiracao);
        const agora = new Date();

        if (agora > dataExpiracao) {
          console.log(`⏰ Mensagem ${msg.id} expirada. Marcando como expirada...`);
          await base44.asServiceRole.entities.MensagemWhatsAppPendente.update(msg.id, {
            status: 'expirada',
            motivo_falha: 'Mensagem expirou antes de poder ser enviada (48h)'
          });
          continue;
        }

        // Enviar a mensagem
        await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
          from: configWhatsapp.numero_whatsapp_oficial,
          to: msg.numero_whatsapp,
          body: msg.conteudo
        });

        // Marcar como enviada
        await base44.asServiceRole.entities.MensagemWhatsAppPendente.update(msg.id, {
          status: 'enviada'
        });

        console.log(`✅ Mensagem ${msg.id} enviada com sucesso`);
        processadas++;

      } catch (e) {
        console.error(`❌ Erro ao enviar mensagem ${msg.id}: ${e.message}`);
        
        // Incrementar tentativas
        const proximaTentativaEm = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos depois
        
        try {
          await base44.asServiceRole.entities.MensagemWhatsAppPendente.update(msg.id, {
            numero_tentativas: (msg.numero_tentativas || 0) + 1,
            proxima_tentativa_em: proximaTentativaEm.toISOString()
          });
        } catch (updateErr) {
          console.error(`Erro ao atualizar tentativas: ${updateErr.message}`);
        }

        falhas.push({
          mensagem_id: msg.id,
          motivo: e.message
        });
      }
    }

    console.log(`✅ Processamento concluído: ${processadas} enviadas, ${falhas.length} erros`);

    return Response.json({
      sucesso: true,
      mensagens_processadas: processadas,
      mensagens_com_erro: falhas.length,
      detalhes_erros: falhas
    });

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    return Response.json({
      sucesso: false,
      erro: error.message
    }, { status: 500 });
  }
});