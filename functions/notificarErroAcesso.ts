import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { userEmail, userName, errorMessage, errorDetails, pagina } = await req.json();

        // E-mail do administrador (pode ser configurado)
        const adminEmail = 'admin@sga.ao';

        const emailBody = `
            <h2>Erro de Acesso no Sistema DIROPS-SGA</h2>
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-AO')}</p>
            <p><strong>Página:</strong> ${pagina || 'Aguardando Aprovação'}</p>
            <hr>
            <h3>Detalhes do Utilizador:</h3>
            <ul>
                <li><strong>Nome:</strong> ${userName || 'N/A'}</li>
                <li><strong>Email:</strong> ${userEmail || 'N/A'}</li>
            </ul>
            <h3>Detalhes do Erro:</h3>
            <p><strong>Mensagem:</strong> ${errorMessage}</p>
            ${errorDetails ? `<p><strong>Detalhes Técnicos:</strong> ${errorDetails}</p>` : ''}
            <hr>
            <p><small>Esta é uma notificação automática do sistema DIROPS-SGA.</small></p>
        `;

        await base44.asServiceRole.integrations.Core.SendEmail({
            to: adminEmail,
            subject: `⚠️ Erro de Acesso - ${userEmail || 'Utilizador Desconhecido'}`,
            body: emailBody
        });

        return Response.json({ success: true, message: 'Notificação enviada ao administrador' });
    } catch (error) {
        console.error('Erro ao notificar administrador:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});