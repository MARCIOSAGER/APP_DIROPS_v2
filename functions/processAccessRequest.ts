import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
        const base44 = createClientFromRequest(req).asServiceRole;
        const { formData } = await req.json();

        if (!formData || !formData.nome_completo || !formData.email || !formData.perfil_solicitado) {
            return new Response(JSON.stringify({ success: false, error: 'Dados do formulário incompletos.' }), { 
                status: 400, 
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
            });
        }
        
        console.log('Criando solicitação de acesso para:', formData.email);
        const newSolicitacao = await base44.entities.SolicitacaoAcesso.create({
            ...formData,
            status: 'pendente'
        });

        // Email para o solicitante
        const emailConfirmacaoBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1e40af;">DIROPS-SGA - Solicitação Recebida</h2>
                <p>Olá <strong>${formData.nome_completo}</strong>,</p>
                <p>A sua solicitação para aceder ao sistema DIROPS-SGA foi recebida com sucesso.</p>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Detalhes da solicitação:</strong></p>
                    <ul>
                        <li><strong>Perfil solicitado:</strong> ${formData.perfil_solicitado}</li>
                        <li><strong>E-mail:</strong> ${formData.email}</li>
                    </ul>
                </div>
                <p>A nossa equipa irá analisar o seu pedido e receberá uma notificação assim que for aprovado.</p>
                <p>Obrigado,<br><strong>Equipa DIROPS-SGA</strong></p>
            </div>`;
        
        await base44.integrations.Core.SendEmail({
            to: formData.email,
            subject: "DIROPS-SGA: Solicitação de Acesso Recebida",
            body: emailConfirmacaoBody,
            from_name: "DIROPS-SGA"
        });

        // Email para o administrador
        console.log('Buscando e-mail do administrador...');
        const configSistema = await base44.entities.ConfiguracaoSistema.list();
        const emailNotificacao = configSistema.length > 0 ? configSistema[0].email_notificacao_acessos : null;

        if (emailNotificacao) {
            console.log(`Enviando notificação para o admin: ${emailNotificacao}`);
            const emailAdminBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #dc2626;">🚨 Nova Solicitação de Acesso</h2>
                    <p>Uma nova solicitação de acesso foi submetida no sistema DIROPS-SGA:</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                        <p><strong>📋 Detalhes da Solicitação:</strong></p>
                        <ul style="margin: 10px 0;">
                            <li><strong>Nome:</strong> ${formData.nome_completo}</li>
                            <li><strong>Email:</strong> ${formData.email}</li>
                            <li><strong>Perfil Solicitado:</strong> ${formData.perfil_solicitado}</li>
                            <li><strong>Justificativa:</strong> ${formData.justificativa || 'N/A'}</li>
                        </ul>
                    </div>
                    <p><strong>⚠️ Ação Necessária:</strong></p>
                    <p>Por favor, aceda à secção <strong>"Gestão de Acessos"</strong> no sistema DIROPS-SGA para rever e aprovar esta solicitação.</p>
                </div>`;
            
            await base44.integrations.Core.SendEmail({
                to: emailNotificacao,
                subject: `DIROPS-SGA: Nova Solicitação de Acesso (${formData.nome_completo})`,
                body: emailAdminBody,
                from_name: "DIROPS-SGA Notificações"
            });
            console.log('Notificação para admin enviada com sucesso.');
        } else {
            console.warn('E-mail de notificação para admin não configurado em "ConfiguracaoSistema".');
        }
        
        return new Response(JSON.stringify({ success: true, data: newSolicitacao }), { 
            status: 200, 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });

    } catch (error) {
        console.error('Erro na função processAccessRequest:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500, 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
    }
});