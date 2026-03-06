import { createClient } from 'npm:@base44/sdk@0.1.0';
import { jsPDF } from 'npm:jspdf@2.5.1';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'), 
});

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);

        const voos = await base44.entities.Voo.list('-data_operacao');

        const doc = new jsPDF('landscape');
        const today = new Date().toLocaleDateString('pt-AO');

        // Adicionar logo
        try {
            const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
            const logoResponse = await fetch(logoUrl);
            if (logoResponse.ok) {
                const logoBlob = await logoResponse.blob();
                const arrayBuffer = await logoBlob.arrayBuffer();
                const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                doc.addImage(`data:image/png;base64,${base64Image}`, 'PNG', 14, 10, 30, 15);
            }
        } catch (logoError) {
            console.log('Logo não adicionado:', logoError);
        }

        // Título
        doc.setFontSize(18);
        doc.text(`Relatório de Voos - ${today}`, 50, 20);

        // Criar tabela manualmente
        const startY = 35;
        let currentY = startY;

        // Cabeçalhos
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        const headers = ['Data', 'Tipo', 'Voo', 'Companhia', 'Matrícula', 'Origem/Destino', 'Previsto', 'Real', 'Status'];
        const colWidths = [20, 15, 20, 25, 25, 30, 20, 20, 25];
        let currentX = 14;

        headers.forEach((header, index) => {
            doc.text(header, currentX, currentY);
            currentX += colWidths[index];
        });

        currentY += 8;
        doc.line(14, currentY - 3, 280, currentY - 3);

        // Dados
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);

        voos.slice(0, 30).forEach((voo) => {
            if (currentY > 190) {
                doc.addPage('landscape');
                currentY = 20;
            }

            currentX = 14;
            const rowData = [
                voo.data_operacao || '',
                voo.tipo_movimento || '',
                voo.numero_voo || '',
                voo.companhia_aerea || '',
                voo.registo_aeronave || '',
                voo.aeroporto_origem_destino || '',
                voo.horario_previsto || '',
                voo.horario_real || '',
                voo.status || ''
            ];

            rowData.forEach((data, index) => {
                doc.text(String(data).substring(0, 15), currentX, currentY);
                currentX += colWidths[index];
            });

            currentY += 6;
        });

        // Rodapé
        doc.setFontSize(8);
        doc.text(`Total de ${voos.length} voos • Gerado em ${new Date().toLocaleString('pt-AO')}`, 14, currentY + 10);

        const pdfBytes = doc.output('arraybuffer');

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="relatorio_voos_${today.replace(/\//g, '-')}.pdf"`
            }
        });
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});