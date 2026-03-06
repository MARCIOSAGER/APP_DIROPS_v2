import { createClient } from 'npm:@base44/sdk@0.7.0';
import { format } from 'npm:date-fns@3.6.0';

// Esta função deve ser agendada para correr diariamente (ex: via cron job na plataforma).
Deno.serve(async (_req) => {
    console.log("Iniciando verificação de prazos para itens de PAC...");
    const base44 = createClient({ serviceRole: true });
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normaliza para o início do dia em UTC

    try {
        // 1. Encontrar todos os itens de PAC que não estão concluídos e cujo prazo já passou.
        const { data: itensVencidos, error: itensError } = await base44.entities.ItemPAC.filter({
            status: { $ne: 'concluida' },
            prazo_implementacao: { $lt: today.toISOString() }
        });

        if (itensError) {
            throw new Error(`Erro ao buscar itens PAC: ${itensError.message}`);
        }

        if (!itensVencidos || itensVencidos.length === 0) {
            console.log("Nenhum item vencido encontrado. Fim da verificação.");
            return new Response(JSON.stringify({ message: "Nenhum item vencido para atualizar." }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        console.log(`Encontrados ${itensVencidos.length} itens vencidos para processar.`);
        const pacsParaAtualizar = new Set();
        
        // 2. Atualizar o status de cada item vencido para 'vencida'.
        for (const item of itensVencidos) {
            if (item.status !== 'vencida') {
                await base44.entities.ItemPAC.update(item.id, { status: 'vencida' });
                pacsParaAtualizar.add(item.pac_id);
                console.log(`Item PAC ${item.id} marcado como 'vencida'.`);
            }
        }

        // 3. Atualizar o status dos PACs pais para 'vencido'.
        for (const pacId of pacsParaAtualizar) {
            await base44.entities.PlanoAcaoCorretiva.update(pacId, { status: 'vencido' });
            console.log(`Status do PAC ${pacId} atualizado para 'vencido'.`);
        }
        
        return new Response(JSON.stringify({ message: `Processados ${itensVencidos.length} itens vencidos.` }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error) {
        console.error("Erro na rotina de verificação de prazos:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});