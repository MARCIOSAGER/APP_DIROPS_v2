import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fatura_id } = await req.json();

        if (!fatura_id) {
            return Response.json({ error: 'fatura_id é obrigatório' }, { status: 400 });
        }

        // Buscar dados da fatura usando service role
        const fatura = await base44.asServiceRole.entities.Fatura.get(fatura_id);
        const calculo = await base44.asServiceRole.entities.CalculoTarifa.get(fatura.calculo_tarifa_id);
        const aeroporto = await base44.asServiceRole.entities.Aeroporto.get(fatura.aeroporto_id);
        const companhia = await base44.asServiceRole.entities.CompanhiaAerea.get(fatura.companhia_aerea_id);
        
        // Buscar voo
        const voo = await base44.asServiceRole.entities.Voo.get(calculo.voo_id);
        
        // Buscar voo ligado para obter informações completas
        const voosLigados = await base44.asServiceRole.entities.VooLigado.list();
        const vooLigado = voosLigados.find(vl => vl.id_voo_dep === voo.id);
        
        let vooArr = null;
        if (vooLigado) {
            vooArr = await base44.asServiceRole.entities.Voo.get(vooLigado.id_voo_arr);
        }

        const detalhes = calculo.detalhes_calculo || {};

        // Criar PDF
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margins = { top: 40, bottom: 40, left: 40, right: 40 };

        // Logo
        try {
            const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
            const logoResponse = await fetch(logoUrl);
            if (logoResponse.ok) {
                const logoBlob = await logoResponse.arrayBuffer();
                const base64Image = btoa(String.fromCharCode(...new Uint8Array(logoBlob)));
                doc.addImage(`data:image/png;base64,${base64Image}`, 'PNG', margins.left, 30, 80, 22);
            }
        } catch (logoError) {
            console.log('Logo não adicionado:', logoError);
        }

        // Título da Fatura
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(52, 58, 64);
        doc.text('FATURA', pageWidth - margins.right, 45, { align: 'right' });

        // Número da Fatura
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(fatura.numero_fatura, pageWidth - margins.right, 60, { align: 'right' });

        let y = 100;

        // Informações do Emissor (Aeroporto)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('EMISSOR:', margins.left, y);
        y += 15;

        doc.setFont('helvetica', 'normal');
        doc.text('Sociedade Gestora de Aeroportos, S.A.', margins.left, y);
        y += 12;
        doc.text(`Aeroporto: ${aeroporto.nome} (${aeroporto.codigo_icao})`, margins.left, y);
        y += 12;
        doc.text(`${aeroporto.cidade}, ${aeroporto.provincia} - Angola`, margins.left, y);
        
        // Informações do Cliente (Companhia Aérea)
        y = 100;
        const clienteX = pageWidth / 2 + 20;
        
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTE:', clienteX, y);
        y += 15;

        doc.setFont('helvetica', 'normal');
        doc.text(companhia.nome, clienteX, y);
        y += 12;
        doc.text(`Código ICAO: ${companhia.codigo_icao}`, clienteX, y);
        if (companhia.codigo_iata) {
            y += 12;
            doc.text(`Código IATA: ${companhia.codigo_iata}`, clienteX, y);
        }

        y = 180;

        // Informações da Fatura
        doc.setFillColor(240, 248, 255);
        doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 50, 'F');
        
        y += 15;
        const colWidth = (pageWidth - margins.left - margins.right) / 3;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text('DATA DE EMISSÃO:', margins.left + 10, y);
        doc.text('DATA DE VENCIMENTO:', margins.left + colWidth + 10, y);
        doc.text('TAXA DE CÂMBIO:', margins.left + (colWidth * 2) + 10, y);
        
        y += 15;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(new Date(fatura.data_emissao).toLocaleDateString('pt-AO'), margins.left + 10, y);
        doc.text(new Date(fatura.data_vencimento).toLocaleDateString('pt-AO'), margins.left + colWidth + 10, y);
        doc.text(`1 USD = ${fatura.taxa_cambio} AOA`, margins.left + (colWidth * 2) + 10, y);

        y += 40;

        // Detalhes do Voo
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(46, 125, 191);
        doc.text('Detalhes do Voo', margins.left, y);
        y += 20;

        const numeroVooArr = vooArr?.numero_voo || detalhes.voo_arr_numero_voo || 'N/A';
        const numeroVooDep = voo?.numero_voo || detalhes.voo_dep_numero_voo || 'N/A';
        const rotaCompleta = `${vooArr?.aeroporto_origem_destino || detalhes.aeroporto_origem || 'N/A'}-${aeroporto.codigo_icao}-${voo?.aeroporto_origem_destino || detalhes.aeroporto_destino || 'N/A'}`;

        const detalhesVoo = [
            ['Voo:', `${numeroVooArr}/${numeroVooDep}`],
            ['Rota:', rotaCompleta],
            ['Matrícula:', voo?.registo_aeronave || detalhes.registo_aeronave || 'N/A'],
            ['MTOW:', calculo.mtow_kg ? `${new Intl.NumberFormat('pt-AO').format(calculo.mtow_kg)} kg` : 'N/A'],
            ['Data Operação:', voo?.data_operacao ? new Date(voo.data_operacao).toLocaleDateString('pt-AO') : 'N/A'],
        ];

        doc.setFontSize(10);
        detalhesVoo.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text(label, margins.left, y);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(40, 40, 40);
            doc.text(String(value), margins.left + 120, y);
            y += 16;
        });

        y += 20;

        // Tabela de Tarifas
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(46, 125, 191);
        doc.text('Discriminação de Tarifas', margins.left, y);
        y += 20;

        // Cabeçalho da tabela
        doc.setFillColor(240, 248, 255);
        doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 25, 'F');
        
        y += 17;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('Descrição', margins.left + 10, y);
        doc.text('Valor (USD)', pageWidth - margins.right - 120, y, { align: 'right' });
        doc.text('Valor (AOA)', pageWidth - margins.right - 10, y, { align: 'right' });

        y += 15;

        // Linhas da tabela
        const tarifasItens = [
            { descricao: 'Tarifa de Pouso', usd: calculo.tarifa_pouso_usd || 0, aoa: calculo.tarifa_pouso || 0 },
            { descricao: 'Tarifa de Permanência', usd: calculo.tarifa_permanencia_usd || 0, aoa: calculo.tarifa_permanencia || 0 },
            { descricao: 'Tarifas de Passageiros', usd: calculo.tarifa_passageiros_usd || 0, aoa: calculo.tarifa_passageiros || 0 },
            { descricao: 'Tarifa de Carga', usd: calculo.tarifa_carga_usd || 0, aoa: calculo.tarifa_carga || 0 },
            { descricao: 'Outras Tarifas (Iluminação)', usd: calculo.outras_tarifas_usd || 0, aoa: calculo.outras_tarifas || 0 },
        ];

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        tarifasItens.forEach((item, index) => {
            const bgColor = index % 2 === 0 ? [255, 255, 255] : [250, 250, 250];
            doc.setFillColor(...bgColor);
            doc.rect(margins.left, y - 12, pageWidth - margins.left - margins.right, 20, 'F');

            doc.setTextColor(40, 40, 40);
            doc.text(item.descricao, margins.left + 10, y);
            doc.text(new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(item.usd), pageWidth - margins.right - 120, y, { align: 'right' });
            doc.text(new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(item.aoa), pageWidth - margins.right - 10, y, { align: 'right' });
            y += 20;
        });

        // Total
        y += 10;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        doc.line(margins.left, y, pageWidth - margins.right, y);
        y += 20;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 139, 34);
        doc.text('TOTAL:', margins.left + 10, y);
        doc.text(
            new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'USD' }).format(fatura.valor_total_usd),
            pageWidth - margins.right - 120,
            y,
            { align: 'right' }
        );
        doc.text(
            new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(fatura.valor_total_aoa),
            pageWidth - margins.right - 10,
            y,
            { align: 'right' }
        );

        // Observações
        if (fatura.observacoes) {
            y += 30;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text('Observações:', margins.left, y);
            y += 15;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            
            const lines = doc.splitTextToSize(fatura.observacoes, pageWidth - margins.left - margins.right);
            lines.forEach(line => {
                doc.text(line, margins.left, y);
                y += 12;
            });
        }

        // Rodapé
        const footerY = doc.internal.pageSize.getHeight() - 30;
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('Sociedade Gestora de Aeroportos, S.A.', margins.left, footerY);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-AO')} por ${user.full_name || user.email}`, pageWidth - margins.right, footerY, { align: 'right' });

        // Gerar PDF como buffer
        const pdfBuffer = doc.output('arraybuffer');

        // Upload do PDF para storage
        const fileName = `fatura_${fatura.numero_fatura}_${Date.now()}.pdf`;
        const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
        const file = new File([blob], fileName, { type: 'application/pdf' });

        // Upload usando SDK
        const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        const pdfUrl = uploadResult.file_url;

        // Atualizar fatura com URL do PDF
        await base44.asServiceRole.entities.Fatura.update(fatura_id, { pdf_url: pdfUrl });

        return Response.json({
            success: true,
            pdf_url: pdfUrl,
            fatura_numero: fatura.numero_fatura
        });

    } catch (error) {
        console.error('Erro ao gerar PDF da fatura:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});