import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { to, body } = await req.json();

        if (!to || !body) {
            return Response.json({ 
                error: 'Parâmetros obrigatórios faltando: to e body são necessários.' 
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

        // Normalizar número de telefone (remover espaços, hífens, etc)
        const phoneNumber = to.replace(/[\s\-\(\)]/g, '');

        const encodedToken = encodeURIComponent(token);
        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/send-text`;

        const response = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Client-Token': 'F02bab2d247574aeb95413c2152fb17ebS'
            },
            body: JSON.stringify({
                phone: phoneNumber,
                message: body
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Z-API Error:', response.status, errorText);
            return Response.json({ 
                success: false,
                error: `Z-API retornou status ${response.status}.`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();

        console.log('Mensagem Z-API enviada com sucesso:', data);

        return Response.json({
            success: true,
            message: 'Mensagem enviada com sucesso via Z-API!',
            data: data
        });

    } catch (error) {
        console.error('Erro ao enviar mensagem Z-API:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});