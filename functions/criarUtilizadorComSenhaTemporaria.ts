
import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'),
});

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    try {
        // No authorization check for public request flow

        const requestData = await req.json();
        // Remove senha_temporaria from destructuring as it's not applicable for public requests
        const { email, nome_completo, perfil, aeroportos_acesso, empresa_id } = requestData;

        // Adjust required fields for public request
        if (!email || !nome_completo || !perfil) {
            return new Response(JSON.stringify({ success: false, error: 'Nome completo, e-mail e perfil são obrigatórios.' }), { status: 400, headers });
        }

        try {
            // For a public request flow, we primarily create a pending invitation.
            // The previous logic for inviteUser is removed.
            const activationToken = crypto.randomUUID();
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 48); // Token valid for 48 hours

            await base44.entities.ConvitePendente.create({
                email: email,
                nome_completo: nome_completo,
                perfil_aprovado: perfil, // This is the requested profile
                empresa_id: empresa_id || null,
                aeroportos_aprovados: aeroportos_acesso || [],
                activation_token: activationToken,
                token_expiry: tokenExpiry.toISOString(),
                status: 'pendente', // Status is 'pendente' awaiting user activation via email
                // senha_temporaria is removed as user will set their own password
                tipo_criacao: 'solicitacao_publica' // Mark as a public request
            });

            return new Response(JSON.stringify({ 
                success: true, 
                message: 'Sua solicitação de acesso foi enviada com sucesso. Verifique seu e-mail para instruções sobre como ativar sua conta. O link de ativação será enviado em breve.'
                // No credentials returned for public request flow
            }), { status: 200, headers });

        } catch (createError) {
            console.error('Erro ao criar convite pendente:', createError);
            throw createError; // Re-throw to be caught by the outer try-catch
        }

    } catch (error) {
        console.error('Error in public user request flow:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno do servidor.' }), { status: 500, headers });
    }
});
