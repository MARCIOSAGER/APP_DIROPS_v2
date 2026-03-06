
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
        // This endpoint is now repurposed for public requests with email notification.
        // It expects 'nome' (name), 'email', 'assunto' (subject), and 'mensagem' (message).
        const { nome, email, assunto, mensagem } = await req.json();

        if (!nome || !email || !assunto || !mensagem) {
            return new Response(JSON.stringify({ success: false, error: 'Nome, e-mail, assunto e mensagem são obrigatórios para a solicitação.' }), { status: 400, headers });
        }

        // Store the public request in a new entity type, e.g., 'SolicitacaoPublica'
        // Assuming 'SolicitacaoPublica' is a valid entity type in Base44.
        const newRequest = await base44.entities.SolicitacaoPublica.create({
            nome,
            email,
            assunto,
            mensagem,
            data_solicitacao: new Date().toISOString(), // Add a timestamp for the request
            status: 'pendente' // Initial status of the request
        });

        // Simulate email notification.
        // In a real Base44 setup, if there's an email service integrated with the SDK,
        // it would be called here (e.g., base44.email.send).
        // For this example, we'll log the intention to send an email.
        console.log(`Nova Solicitação Pública Recebida:
            ID: ${newRequest.id}
            Nome: ${nome}
            E-mail: ${email}
            Assunto: ${assunto}
            Mensagem: ${mensagem}
            Status: ${newRequest.status}
            Uma notificação por e-mail seria enviada para administradores.`);

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Sua solicitação foi recebida com sucesso. Entraremos em contato em breve.',
            requestId: newRequest.id
        }), { status: 200, headers });

    } catch (error) {
        console.error('Erro ao processar solicitação pública:', error);
        // Differentiate error messages if parsing fails or Base44 operation fails
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
             return new Response(JSON.stringify({ success: false, error: 'Corpo da requisição JSON inválido.' }), { status: 400, headers });
        }
        return new Response(JSON.stringify({ success: false, error: 'Erro interno do servidor ao processar sua solicitação.' }), { status: 500, headers });
    }
});
