import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
            return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
        }

        const instanceId = Deno.env.get('ID_INSTANCIA_ZAPI');
        const clientToken = Deno.env.get('CLIENT_TOKEN_ZAPI');
        const token = Deno.env.get('TOKEN_ZAPI');

        if (!instanceId || !clientToken || !token) {
            return Response.json({ 
                error: 'Credenciais Z-API não configuradas.' 
            }, { status: 500 });
        }

        const encodedToken = encodeURIComponent(token);
        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/status`;

        console.log('🔗 URL da requisição:', zapiUrl);
        console.log('🔑 Client-Token:', clientToken ? `${clientToken.substring(0, 10)}...` : 'NÃO DEFINIDO');

        const response = await fetch(zapiUrl, {
            method: 'GET',
            headers: {
                'Client-Token': clientToken
            }
        });

        const responseText = await response.text();
        console.log('📥 Status da resposta:', response.status);
        console.log('📄 Corpo da resposta:', responseText);

        if (!response.ok) {
            console.error('❌ Z-API Error:', response.status, responseText);
            return Response.json({ 
                success: false,
                error: `Erro ao obter status: ${response.status}`,
                details: responseText,
                url: zapiUrl
            }, { status: response.status });
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('❌ Erro ao fazer parse do JSON:', e);
            data = { raw: responseText };
        }

        return Response.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Erro ao obter status Z-API:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});