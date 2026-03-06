import twilio from 'npm:twilio';
import { differenceInHours, parseISO } from 'npm:date-fns';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { from, to, contentSid, contentVariables, body, optInDate, provider } = await req.json();

        // Buscar configuração para determinar o provedor
        let selectedProvider = provider;
        if (!selectedProvider) {
            const configs = await base44.asServiceRole.entities.ConfiguracaoNotificacoes.list();
            selectedProvider = (configs.length > 0 && configs[0].provedor_whatsapp) || 'twilio';
        }

        // Se for Z-API, delegar para a função específica
        if (selectedProvider === 'zapi') {
            const zapiResult = await base44.functions.invoke('sendWhatsAppMessageZAPI', {
                to: to,
                body: body
            });
            return Response.json(zapiResult.data);
        }

        // Caso contrário, usar Twilio (código existente)

        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const defaultContentSid = Deno.env.get('Content_template_SID');

        if (!accountSid || !authToken) {
            return Response.json({ error: 'Twilio secrets are not configured.' }, { status: 500 });
        }

        // Determinar se o opt-in expirou (24 horas)
        let useTemplateForced = false;
        if (optInDate) {
            try {
                const optInDateTime = parseISO(optInDate);
                const now = new Date();
                const hoursSinceOptIn = differenceInHours(now, optInDateTime);
                if (hoursSinceOptIn >= 24) {
                    useTemplateForced = true;
                }
            } catch (e) {
                console.warn('Invalid optInDate format:', optInDate);
            }
        }

        let finalContentSid = contentSid === true ? defaultContentSid : (contentSid || null);

        // Se o opt-in expirou, forçar o uso do template padrão
        if (useTemplateForced && !finalContentSid) {
            finalContentSid = defaultContentSid;
        }

        if (!from || !to || (!finalContentSid && !body)) {
            return Response.json({ 
                error: 'Missing required parameters: from, to, and either contentSid or body' 
            }, { status: 400 });
        }

        const client = twilio(accountSid, authToken);

        const messageParams = {
            from: from,
            to: to,
            statusCallback: 'https://dirops.base44.app/api/apps/6870dc26cbf5444a4fbe6aa9/functions/whatsAppStatusCallback'
        };

        if (finalContentSid) {
            messageParams.contentSid = finalContentSid;
            if (contentVariables) {
                messageParams.contentVariables = contentVariables;
            }
        } else {
            messageParams.body = body;
        }

        const message = await client.messages.create(messageParams);

        return Response.json({
            success: true,
            sid: message.sid,
            status: message.status,
            templateForced: useTemplateForced
        });

    } catch (error) {
        console.error('Erro ao enviar mensagem Twilio:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});