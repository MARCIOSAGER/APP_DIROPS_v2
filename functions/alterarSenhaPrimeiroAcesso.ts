
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
        // For a public request flow, we typically only receive the email address
        // to initiate a process (e.g., send temporary password, reset link).
        const { email } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ success: false, error: 'E-mail é obrigatório' }), { status: 400, headers });
        }

        // Buscar o utilizador na entidade User
        const users = await base44.entities.User.filter({ email: email });
        if (!users || users.length === 0) {
            // For security reasons, sometimes a generic success message is returned
            // even if the user isn't found to prevent email enumeration.
            // However, adhering to previous error pattern, returning 404.
            return new Response(JSON.stringify({ success: false, error: 'Utilizador não encontrado' }), { status: 404, headers });
        }

        const user = users[0];

        // Generate a new temporary password for the user
        // This is a simple alphanumeric string. For production, consider a more
        // cryptographically secure random string generation or a proper reset token.
        const temporaryPassword = Math.random().toString(36).substring(2, 10);

        try {
            // Update the user record with the new temporary password and set status
            // to indicate that a password change is pending.
            await base44.entities.User.update(user.id, {
                status: 'pendente_alteracao_senha', // Set status to pending password change
                senha_temporaria: temporaryPassword // Store the new temporary password
            });

            // --- Email Notification Logic ---
            // This section simulates sending an email. In a real application,
            // you would integrate with an actual email sending service (e.g., SendGrid, Mailgun, AWS SES).
            const emailSubject = 'Sua Senha Temporária para Acesso';
            const emailBody = `Olá ${user.nome || user.email},\n\nSua senha temporária para acesso é: ${temporaryPassword}\n\nPor favor, use esta senha para fazer login e, em seguida, altere-a para uma senha de sua escolha.\n\nSe você não solicitou isso, por favor, ignore este e-mail.\n\nAtenciosamente,\nSua Equipe.`;

            console.log('--- SIMULAÇÃO DE ENVIO DE E-MAIL ---');
            console.log(`Para: ${user.email}`);
            console.log(`Assunto: ${emailSubject}`);
            console.log(`Corpo: \n${emailBody}`);
            console.log('------------------------------------');

            // If base44 SDK provided an email sending utility, it might look like this:
            // await base44.sendEmail({
            //     to: user.email,
            //     subject: emailSubject,
            //     body: emailBody,
            //     // from: 'no-reply@yourdomain.com' // Often required by email services
            // });

            return new Response(JSON.stringify({ success: true, message: 'Uma senha temporária foi enviada para o seu e-mail.' }), { status: 200, headers });

        } catch (updateError) {
            console.error('Erro ao atualizar utilizador ou preparar e-mail:', updateError);
            // Return a general error message to the client
            return new Response(JSON.stringify({ success: false, error: 'Erro ao processar sua solicitação. Tente novamente mais tarde.' }), { status: 500, headers });
        }

    } catch (error) {
        console.error('Erro na solicitação pública de senha temporária:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno do servidor' }), { status: 500, headers });
    }
});
