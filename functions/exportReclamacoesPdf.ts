
import { createClient } from 'npm:@base44/sdk@0.1.0';
import { jsPDF } from 'npm:jspdf@2.5.1';
import 'npm:jspdf-autotable';

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

        const body = await req.json();
        const { reclamacoes = [], aeroportos = [] } = body;

        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        // --- OTIMIZAÇÃO: Carregar a imagem da logo APENAS UMA VEZ ---
        let logoBase64 = null;
        try {
            const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
            const logoResponse = await fetch(logoUrl);
            if (logoResponse.ok) {
                const logoBuffer = await logoResponse.arrayBuffer();
                const uint8Array = new Uint8Array(logoBuffer);
                let binaryString = '';
                for (let i = 0; i < uint8Array.length; i++) {
                    binaryString += String.fromCharCode(uint8Array[i]);
                }
                logoBase64 = `data:image/png;base64,${btoa(binaryString)}`;
            }
        } catch (logoError) {
            console.warn('Logo não pôde ser adicionado:', logoError.message);
        }

        // --- FUNÇÕES AUXILIARES (MODIFICADAS PARA NÃO FAZER FETCH) ---
        const addPageHeader = (docInstance, logoData) => {
            if (logoData) {
                docInstance.addImage(logoData, 'PNG', 15, 10, 40, 15);
            }
            
            docInstance.setFontSize(20);
            docInstance.setFont('helvetica', 'bold');
            docInstance.setTextColor(37, 99, 235);
            docInstance.text('DIROPS-SGA', 70, 20);
            
            docInstance.setFontSize(16);
            docInstance.setFont('helvetica', 'normal');
            docInstance.setTextColor(0, 0, 0);
            docInstance.text('Relatório de Reclamações', 70, 30);
        };

        const addPageFooter = (docInstance, pageNumber, totalPages) => {
            docInstance.setFontSize(8);
            docInstance.setTextColor(100, 116, 139);
            const footerText = `Página ${pageNumber} de ${totalPages}`;
            docInstance.text(footerText, docInstance.internal.pageSize.getWidth() / 2, 290, { align: 'center' });
        };
        
        // --- PÁGINA DE RESUMO ---
        addPageHeader(doc, logoBase64);
        
        doc.autoTable({
            startY: 50,
            body: [
                ['Data de Geração:', new Date().toLocaleDateString('pt-AO')],
                ['Total de Reclamações:', reclamacoes.length.toString()],
                ['Concluídas:', reclamacoes.filter(r => r.status === 'concluida').length.toString()],
                ['Abertas:', reclamacoes.filter(r => !['concluida', 'rejeitada'].includes(r.status)).length.toString()],
            ],
            theme: 'grid',
            styles: { fillColor: [239, 246, 255], textColor: [51, 65, 85], fontStyle: 'bold' },
            columnStyles: { 0: { fontStyle: 'bold' } }
        });

        // --- TABELA PRINCIPAL DE RECLAMAÇÕES ---
        const tableData = reclamacoes.map(rec => {
            const aeroporto = aeroportos.find(a => a.codigo_icao === rec.aeroporto_id);
            return [
                rec.protocolo_numero,
                rec.titulo,
                (rec.status || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                (rec.prioridade || '').toUpperCase(),
                aeroporto ? aeroporto.nome : 'N/A',
                new Date(rec.data_recebimento).toLocaleDateString('pt-AO')
            ];
        });

        doc.autoTable({
            startY: doc.autoTable.previous.finalY + 10,
            head: [['Protocolo', 'Título', 'Status', 'Prioridade', 'Aeroporto', 'Data']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
            didDrawPage: (data) => {
                // Adiciona cabeçalho em todas as páginas, exceto a primeira, que já foi adicionada
                if (data.pageNumber > 1) {
                    addPageHeader(doc, logoBase64);
                }
            }
        });

        // --- ATUALIZAR RODAPÉS DE TODAS AS PÁGINAS GERADAS ---
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            addPageFooter(doc, i, totalPages);
        }

        const pdfBytes = doc.output('arraybuffer');

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename=relatorio_reclamacoes.pdf'
            }
        });
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error.stack);
        return new Response(JSON.stringify({ 
            error: 'Erro ao gerar PDF',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
