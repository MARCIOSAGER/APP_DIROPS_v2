import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { differenceInHours, parseISO } from 'npm:date-fns';

/**
 * Função reutilizável para enviar notificações WhatsApp com validação de opt-in
 * Pode ser invocada por qualquer automação (notificarVooLigado, etc.)
 * 
 * Lógica:
 * 1. Se opt-in não está 'confirmado' ou não existe optInDate: envia opt-in
 * 2. Se opt-in confirmado mas > 24h: usa contentSid (template)
 * 3. Se opt-in confirmado e <= 24h: usa body (mensagem livre)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const {
      user_id,
      user_email,
      numero_whatsapp,
      mensagem,
      usar_template,
      numero_whatsapp_oficial
    } = await req.json();

    if ((!user_id && !user_email) || !numero_whatsapp || !numero_whatsapp_oficial) {
      return Response.json({
        sucesso: false,
        erro: 'Parâmetros obrigatórios faltando: (user_id ou user_email), numero_whatsapp, numero_whatsapp_oficial'
      }, { status: 400 });
    }

    // Buscar dados do utilizador
    let usuario;
    if (user_email) {
      const usuarios = await base44.asServiceRole.entities.User.filter({ email: user_email });
      usuario = usuarios && usuarios.length > 0 ? usuarios[0] : null;
    } else {
      usuario = await base44.asServiceRole.entities.User.get(user_id);
    }
    
    if (!usuario) {
      return Response.json({
        sucesso: false,
        erro: 'Utilizador não encontrado'
      }, { status: 404 });
    }

    const optInStatus = usuario.whatsapp_opt_in_status;
    const optInDate = usuario.whatsapp_opt_in_date;

    // ============================================
    // 1. VERIFICAR HORÁRIO PRIMEIRO (comparar com agora)
    // ============================================
    let horasDecorridas = null;
    let janelaExpirada = false;

    if (optInDate) {
      try {
        const optInDateTime = parseISO(optInDate);
        const now = new Date();
        horasDecorridas = differenceInHours(now, optInDateTime);
        janelaExpirada = horasDecorridas >= 24;

        console.log(`📅 Horas desde opt-in: ${horasDecorridas}h | Janela expirada: ${janelaExpirada}`);
      } catch (e) {
        console.warn(`⚠️ Erro ao parsear optInDate: ${e.message}`);
        janelaExpirada = true; // por segurança, assume janela expirada
      }
    } else {
      console.log(`⚠️ Não há data de opt-in registada`);
      janelaExpirada = true; // sem data, considera expirado
    }

    // ============================================
    // 2. VERIFICAR STATUS DE OPT-IN
    // ============================================
    if (optInStatus !== 'confirmado') {
      console.log(`⚠️ Utilizador ${usuario.full_name} (${user_id}) com status '${optInStatus}'. Enviando opt-in...`);
      
      try {
        await base44.asServiceRole.functions.invoke('enviarOptInWhatsApp', {
          user_id: user_id
        });

        return Response.json({
          sucesso: false,
          status: 'opt_in_pendente',
          mensagem: `Opt-in solicitado para ${usuario.full_name}. Notificação será enviada após confirmação.`,
          usuario_id: user_id
        });
      } catch (e) {
        console.error(`❌ Erro ao solicitar opt-in para ${usuario.full_name}:`, e.message);
        return Response.json({
          sucesso: false,
          erro: `Falha ao solicitar opt-in: ${e.message}`
        }, { status: 500 });
      }
    }

    // ============================================
    // 3. STATUS CONFIRMADO - DEFINIR MÉTODO (template vs mensagem livre)
    // ============================================
    console.log(`✅ Utilizador ${usuario.full_name} tem opt-in confirmado.`);

    let deveUsarTemplate = usar_template === true || janelaExpirada;

    if (janelaExpirada) {
      console.log(`⏰ Janela de 24h expirada (${horasDecorridas}h). Usando template de conteúdo.`);
    } else {
      console.log(`⏰ Dentro da janela de 24h (${horasDecorridas}h). Enviando mensagem livre.`);
      deveUsarTemplate = false;
    }

    // ============================================
    // 3. ENVIAR A NOTIFICAÇÃO
    // ============================================
    try {
      const resultado = await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        from: numero_whatsapp_oficial,
        to: numero_whatsapp,
        body: !deveUsarTemplate ? mensagem : undefined,
        contentSid: deveUsarTemplate ? true : undefined,
        optInDate: optInDate
      });

      console.log(`✅ Notificação enviada com sucesso para ${usuario.full_name}`);

      return Response.json({
        sucesso: true,
        usuario: usuario.full_name,
        usuario_id: user_id,
        metodo: deveUsarTemplate ? 'template' : 'mensagem_livre',
        janelaExpirouEUsouTemplate: deveUsarTemplate
      });
    } catch (e) {
      console.error(`❌ Erro ao enviar notificação para ${usuario.full_name}:`, e.message);
      return Response.json({
        sucesso: false,
        erro: `Falha ao enviar notificação: ${e.message}`,
        usuario_id: user_id
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Erro na função enviarNotificacaoWhatsAppComValidacao:', error);
    return Response.json({
      sucesso: false,
      erro: error.message
    }, { status: 500 });
  }
});