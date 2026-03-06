
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import { jsPDF } from 'npm:jspdf@2.5.1';
import 'npm:jspdf-autotable@3.8.2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Função para normalizar texto (remover acentos)
const normalizeText = (text) => {
    if (typeof text !== 'string') return '';
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const base44 = createClientFromRequest(req);
    if (!(await base44.auth.isAuthenticated())) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }});
    }

    const { ordens, aeroportos } = await req.json();
    if (!Array.isArray(ordens) || ordens.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma Ordem de Serviço fornecida.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }});
    }

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // Tentar carregar a logo de forma mais robusta
    let logoAdded = false;
    try {
        const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
        
        const logoResponse = await fetch(logoUrl, {
            method: 'GET',
            headers: {
                'Accept': 'image/png, image/jpeg, image/*',
                'User-Agent': 'Deno/PDF-Generator'
            }
        });
        
        if (logoResponse.ok && logoResponse.status === 200) {
            const logoArrayBuffer = await logoResponse.arrayBuffer();
            
            if (logoArrayBuffer.byteLength > 0) {
                const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoArrayBuffer)));
                
                // Tentar adicionar a imagem
                doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 15, 10, 35, 12);
                logoAdded = true;
            }
        }
    } catch (logoError) {
        console.error('Erro ao carregar logo:', logoError);
    }
    
    // Cabeçalho do Relatório
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235); // Azul DIROPS
    doc.text('DIROPS-SGA', 15, logoAdded ? 35 : 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text(normalizeText('Relatório de Ordens de Serviço'), 15, logoAdded ? 42 : 27);
    
    doc.setFontSize(10);
    doc.text(normalizeText(`Data de Geração: ${new Date().toLocaleDateString('pt-AO')}`), 15, logoAdded ? 47 : 32);
    doc.text(normalizeText(`Total de Ordens: ${ordens.length}`), 15, logoAdded ? 52 : 37);

    // Dados da tabela
    const tableData = ordens.map((os) => {
        const aeroporto = aeroportos.find(a => a && a.id === os.aeroporto_id);
        const dataItem = new Date(os.data_abertura || os.created_date).toLocaleDateString('pt-AO');

        return [
            normalizeText(os.numero_ordem || 'N/A'),
            normalizeText(os.titulo || 'N/A'),
            normalizeText(os.status || 'N/A'),
            normalizeText(os.prioridade || 'N/A'),
            normalizeText(aeroporto?.nome || 'N/A'),
            normalizeText(dataItem)
        ];
    });

    // Gerar a tabela
    doc.autoTable({
        startY: logoAdded ? 60 : 45,
        head: [[
            normalizeText('Protocolo'),
            normalizeText('Título'),
            normalizeText('Status'),
            normalizeText('Prioridade'),
            normalizeText('Aeroporto'),
            normalizeText('Data')
        ]],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: [37, 99, 235],
            textColor: 255,
            fontStyle: 'bold'
        },
        styles: {
            font: 'helvetica',
            fontSize: 9
        }
    });

    // Gerar o PDF final
    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="relatorio_manutencao.pdf"'
      }
    });

  } catch (error) {
    console.error('Erro fatal ao gerar PDF de manutenção:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao gerar o PDF.', details: error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});
