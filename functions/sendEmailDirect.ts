import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

// Cabeçalhos CORS para permitir a comunicação entre o frontend e o backend
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', // Permite qualquer origem
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // Permite os métodos POST e OPTIONS
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Permite os cabeçalhos necessários
};

Deno.serve(async (req) => {
    // Responde ao "preflight request" do navegador para verificar as permissões CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204, // "No Content"
            headers: CORS_HEADERS,
        });
    }

    try {
        const base44 = createClientFromRequest(req);
        
        // A autenticação do utilizador continua a ser verificada
        if (!(await base44.auth.isAuthenticated())) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const { to, subject, body, from_name } = await req.json();

        // Tenta enviar o e-mail usando o "service role"
        await base44.asServiceRole.integrations.Core.SendEmail({
            to,
            subject,
            body,
            from_name: from_name || 'DIROPS-SGA'
        });

        // Retorna sucesso com os cabeçalhos CORS
        return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in sendEmailDirect:', error);
        
        let errorMessage = 'Falha ao enviar e-mail';
        // Se o erro for sobre "utilizadores fora da aplicação", personalizamos a mensagem
        if (error.message && error.message.includes('users outside the app')) {
            errorMessage = 'O destinatário não é um utilizador registado na aplicação.';
        }

        // Retorna o erro com os cabeçalhos CORS
        return new Response(JSON.stringify({ 
            error: errorMessage, 
            details: error.message 
        }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
});