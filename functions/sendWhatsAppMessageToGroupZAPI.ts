import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Envia mensagem para um grupo de WhatsApp via Z-API
 * 
 * Parâmetros:
 * - groupId: ID do grupo de WhatsApp
 * - body: Conteúdo da mensagem
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { groupId, body } = await req.json();

        if (!groupId || !body) {
            return Response.json({ 
                error: 'Parâmetros obrigatórios faltando: groupId e body são necessários.' 
            }, { status: 400 });
        }

        const instanceId = Deno.env.get('ID_INSTANCIA_ZAPI');
        const clientToken = Deno.env.get('CLIENT_TOKEN_ZAPI');
        const token = Deno.env.get('TOKEN_ZAPI');

        if (!instanceId || !clientToken || !token) {
            return Response.json({ 
                error: 'Credenciais Z-API não configuradas (ID_INSTANCIA_ZAPI, CLIENT_TOKEN_ZAPI ou TOKEN_ZAPI).' 
            }, { status: 500 });
        }

        const encodedToken = encodeURIComponent(token);
        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/send-messages`;

        const payload = {
            phone: groupId,
            message: body
        };

        console.log('Enviando para Z-API:', zapiUrl);
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Client-Token': 'F02bab2d247574aeb95413c2152fb17ebS'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log('Z-API Response Status:', response.status);
        console.log('Z-API Response Body:', responseText);

        if (!response.ok) {
            console.error('Z-API Error (Group):', response.status, responseText);
            return Response.json({ 
                success: false,
                error: `Z-API retornou status ${response.status}.`,
                details: responseText
            }, { status: response.status });
        }

        const data = JSON.parse(responseText);

        console.log('Mensagem enviada para grupo Z-API:', data);

        return Response.json({
            success: true,
            message: 'Mensagem enviada com sucesso para o grupo via Z-API!',
            data: data
        });

    } catch (error) {
        console.error('Erro ao enviar mensagem para grupo Z-API:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});