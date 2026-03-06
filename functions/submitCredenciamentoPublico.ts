import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }
    
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    try {
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers });
        }

        const base44 = createClientFromRequest(req);
        const formData = await req.json();

        // Gerar número de protocolo
        const now = new Date();
        const year = now.getFullYear();
        const randomPart = Math.floor(100000 + Math.random() * 900000);
        const protocoloNumero = `CR-${year}-${randomPart}`;
        
        const credenciamentoData = {
            ...formData,
            protocolo_numero: protocoloNumero,
            data_solicitacao: new Date().toISOString(),
            status: 'pendente',
        };

        const newRecord = await base44.asServiceRole.entities.Credenciamento.create(credenciamentoData);

        // Enviar e-mail de confirmação
        if (formData.email_notificacao) {
            // Obter nomes em vez de IDs
            const empresa = await base44.asServiceRole.entities.Empresa.get(formData.empresa_solicitante_id);
            const aeroporto = await base44.asServiceRole.entities.Aeroporto.get(formData.aeroporto_id);

            const emailSubject = `Confirmação de Solicitação de Credenciamento - Protocolo ${protocoloNumero}`;
            const emailBody = `
                <p>Prezado(a) ${empresa.responsavel_nome || 'Responsável'},</p>
                <p>A sua solicitação de credenciamento foi recebida com sucesso.</p>
                <ul>
                    <li><strong>Protocolo:</strong> ${protocoloNumero}</li>
                    <li><strong>Empresa:</strong> ${empresa.nome}</li>
                    <li><strong>Aeroporto:</strong> ${aeroporto.nome}</li>
                    <li><strong>Tipo:</strong> ${formData.tipo_credencial}</li>
                </ul>
                <p>Pode acompanhar o estado da sua solicitação no Portal da Empresa.</p>
                <p>Com os melhores cumprimentos,<br>DIROPS-SGA</p>
            `;
            
            await base44.asServiceRole.integrations.invoke('Core.SendEmail', {
                to: formData.email_notificacao,
                subject: emailSubject,
                body: emailBody,
                from_name: 'DIROPS-SGA'
            });
        }

        return new Response(JSON.stringify({ success: true, protocolo: protocoloNumero }), { status: 201, headers });
    } catch (error) {
        console.error("Erro ao submeter credenciamento:", error);
        return new Response(JSON.stringify({ success: false, error: 'Erro interno do servidor', details: error.message }), { status: 500, headers });
    }
});