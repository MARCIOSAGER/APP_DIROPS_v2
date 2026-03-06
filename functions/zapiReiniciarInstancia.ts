import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verificar se é admin
        if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
            return Response.json({ error: 'Acesso negado. Apenas administradores podem reiniciar a instância.' }, { status: 403 });
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
        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${encodedToken}/restart`;

        const response = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Client-Token': clientToken
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Z-API Error:', response.status, errorText);
            return Response.json({ 
                success: false,
                error: `Erro ao reiniciar instância: ${response.status}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();

        console.log('Instância Z-API reiniciada com sucesso:', data);

        return Response.json({
            success: true,
            message: 'Instância reiniciada com sucesso!',
            data: data
        });

    } catch (error) {
        console.error('Erro ao reiniciar instância Z-API:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});