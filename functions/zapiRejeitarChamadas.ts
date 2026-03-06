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

        const { value } = await req.json();

        if (typeof value !== 'boolean') {
            return Response.json({ error: 'Valor booleano é obrigatório' }, { status: 400 });
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
        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/reject-calls`;

        const response = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
                'Client-Token': clientToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Z-API Error:', response.status, errorText);
            return Response.json({ 
                success: false,
                error: `Erro ao configurar rejeição de chamadas: ${response.status}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();

        return Response.json({
            success: true,
            message: value ? 'Rejeição de chamadas ativada!' : 'Rejeição de chamadas desativada!',
            data: data
        });

    } catch (error) {
        console.error('Erro ao configurar rejeição de chamadas Z-API:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});