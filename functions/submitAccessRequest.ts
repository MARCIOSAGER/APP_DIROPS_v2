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
        const requestData = await req.json();
        const { nome_completo, email, perfil_solicitado, empresa_solicitante_id, aeroportos_solicitados, justificativa } = requestData;

        if (!nome_completo || !email || !perfil_solicitado || !justificativa) {
            return new Response(JSON.stringify({ success: false, error: 'Dados obrigatórios em falta.' }), { status: 400, headers });
        }

        const solicitacao = await base44.entities.SolicitacaoAcesso.create({
            nome_completo,
            email,
            perfil_solicitado,
            empresa_solicitante_id: empresa_solicitante_id || null,
            aeroportos_solicitados: aeroportos_solicitados || [],
            justificativa,
            status: 'pendente'
        });

        // --- Início das correções de e-mail ---

        // 1. E-mail de confirmação para o solicitante (sem alterações)
        const emailConfirmacao = `...`; // Corpo do e-mail (sem alterações)
        await base44.integrations.Core.SendEmail({
            to: email,
            subject: 'DIROPS-SGA - Solicitação de Acesso Recebida',
            body: emailConfirmacao,
            from_name: 'DIROPS-SGA'
        });

        // 2. E-mail de notificação para o administrador (corrigido)
        const configs = await base44.entities.ConfiguracaoSistema.list();
        const adminEmail = configs.length > 0 ? configs[0].email_notificacao_acessos : null;

        if (adminEmail) {
            const emailAdmin = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #dc2626;">🚨 Nova Solicitação de Acesso</h2>
                    <p>Uma nova solicitação de acesso foi submetida no sistema DIROPS-SGA:</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                        <p><strong>Nome:</strong> ${nome_completo}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Perfil Solicitado:</strong> ${perfil_solicitado}</p>
                        <p><strong>Justificativa:</strong> ${justificativa}</p>
                    </div>
                    <p><strong>Ação Necessária:</strong> Aceda à secção "Gestão de Acessos" para rever.</p>
                </div>
            `;

            await base44.integrations.Core.SendEmail({
                to: adminEmail,
                subject: `DIROPS-SGA - Nova Solicitação de Acesso: ${nome_completo}`,
                body: emailAdmin,
                from_name: 'DIROPS-SGA Notificações'
            });
        }
        // --- Fim das correções de e-mail ---

        return new Response(JSON.stringify({ success: true, solicitacao_id: solicitacao.id }), { status: 200, headers });

    } catch (error) {
        console.error('Error in submitAccessRequest:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno do servidor.' }), { status: 500, headers });
    }
});