import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { proforma_id } = await req.json();

    if (!proforma_id) {
      return Response.json({ error: 'proforma_id é obrigatório' }, { status: 400 });
    }

    // Buscar dados
    console.log('📊 Buscando dados para proforma_id:', proforma_id);
    
    const [proformas, calculosTarifa, aeroportos, companhias] = await Promise.all([
      base44.asServiceRole.entities.Proforma.filter({ id: proforma_id }),
      base44.asServiceRole.entities.CalculoTarifa.list(),
      base44.asServiceRole.entities.Aeroporto.list(),
      base44.asServiceRole.entities.CompanhiaAerea.list()
    ]);

    const proforma = proformas[0];

    if (!proforma) {
      console.error('❌ Proforma não encontrada');
      return Response.json({ error: 'Proforma não encontrada' }, { status: 404 });
    }

    console.log('✅ Proforma encontrada:', proforma.numero_proforma);

    const calculo = calculosTarifa.find(c => c.id === proforma.calculo_tarifa_id);
    const aeroporto = aeroportos.find(a => a.id === proforma.aeroporto_id);
    const companhia = companhias.find(c => c.id === proforma.companhia_aerea_id);

    console.log('📊 Dados encontrados:', {
      proforma: !!proforma,
      calculo: !!calculo,
      aeroporto: !!aeroporto,
      companhia: !!companhia,
      companhia_id: proforma.companhia_aerea_id
    });

    if (!calculo) {
      console.error('❌ Cálculo não encontrado para ID:', proforma.calculo_tarifa_id);
      return Response.json({ error: 'Cálculo de tarifa não encontrado' }, { status: 404 });
    }
    if (!aeroporto) {
      console.error('❌ Aeroporto não encontrado para ID:', proforma.aeroporto_id);
      return Response.json({ error: 'Aeroporto não encontrado' }, { status: 404 });
    }
    if (!companhia) {
      console.error('❌ Companhia não encontrada para ID:', proforma.companhia_aerea_id);
      console.log('IDs de companhias disponíveis:', companhias.map(c => c.id));
      return Response.json({ error: 'Companhia aérea não encontrada' }, { status: 404 });
    }

    // Carregar logo
    let logoBase64 = null;
    try {
      const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
      const logoResponse = await fetch(logoUrl, {
        mode: 'cors',
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
      if (logoResponse.ok) {
        const logoBlob = await logoResponse.arrayBuffer();
        const binary = Array.from(new Uint8Array(logoBlob)).map(b => String.fromCharCode(b)).join('');
        logoBase64 = `data:image/png;base64,${btoa(binary)}`;
      }
    } catch (logoError) {
      console.log('Logo não carregado:', logoError);
    }

    // Criar PDF
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = { top: 40, bottom: 40, left: 40, right: 40 };
    const contentWidth = pageWidth - margins.left - margins.right;

    let y = margins.top;

    // Adicionar logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margins.left, y, 80, 25);
      } catch (e) {
        console.log('Erro ao adicionar logo:', e);
      }
    }

    // Título
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('NOTA PROFORMA', pageWidth - margins.right, y + 15, { align: 'right' });

    y += 35;

    // Número da proforma
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(proforma.numero_proforma, pageWidth - margins.right, y, { align: 'right' });

    y += 40;

    // Caixa de informações principais
    doc.setFillColor(248, 250, 252);
    doc.rect(margins.left, y, contentWidth, 80, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margins.left, y, contentWidth, 80);

    y += 20;

    // Emissor e Cliente lado a lado
    const halfWidth = contentWidth / 2;
    
    // EMISSOR
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('EMISSOR:', margins.left + 15, y);
    
    y += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Sociedade Gestora de Aeroportos, S.A.', margins.left + 15, y);
    y += 12;
    doc.text(`Aeroporto: ${aeroporto.nome} (${aeroporto.codigo_icao})`, margins.left + 15, y);
    y += 12;
    doc.text(`${aeroporto.cidade}, ${aeroporto.provincia} - Angola`, margins.left + 15, y);

    // Reset y para cliente
    y -= 39;

    // CLIENTE
    const clienteX = margins.left + halfWidth + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('CLIENTE:', clienteX, y);
    
    y += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(companhia.nome, clienteX, y);
    y += 12;
    doc.text(`Código ICAO: ${companhia.codigo_icao}`, clienteX, y);
    if (companhia.codigo_iata) {
      y += 12;
      doc.text(`Código IATA: ${companhia.codigo_iata}`, clienteX, y);
    }

    y += 50;

    // Caixa de datas e câmbio
    doc.setFillColor(240, 249, 255);
    doc.rect(margins.left, y, contentWidth, 45, 'F');
    doc.setDrawColor(191, 219, 254);
    doc.rect(margins.left, y, contentWidth, 45);

    y += 18;

    const col1X = margins.left + 15;
    const col2X = margins.left + (contentWidth / 3) + 15;
    const col3X = margins.left + (contentWidth * 2 / 3) + 15;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('DATA DE EMISSÃO:', col1X, y);
    doc.text('DATA DE VENCIMENTO:', col2X, y);
    doc.text('TAXA DE CÂMBIO:', col3X, y);

    y += 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(new Date(proforma.data_emissao).toLocaleDateString('pt-AO'), col1X, y);
    doc.text(new Date(proforma.data_vencimento).toLocaleDateString('pt-AO'), col2X, y);
    doc.text(`1 USD = ${proforma.taxa_cambio.toFixed(2)} AOA`, col3X, y);

    y += 40;

    // Título da tabela
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('Discriminação de Tarifas', margins.left, y);

    y += 20;

    // Cabeçalho da tabela
    const descWidth = contentWidth * 0.5;
    const usdWidth = contentWidth * 0.25;
    const aoaWidth = contentWidth * 0.25;

    doc.setFillColor(240, 249, 255);
    doc.rect(margins.left, y, contentWidth, 28, 'F');

    y += 18;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('Descrição', margins.left + 10, y);
    doc.text('Valor (USD)', margins.left + descWidth + 10, y, { align: 'right' });
    doc.text('Valor (AOA)', margins.left + descWidth + usdWidth + 10, y, { align: 'right' });

    y += 15;

    // Buscar detalhes do cálculo
    const detalhes = calculo.detalhes_calculo || {};

    // Linhas da tabela - tarifas base
    const tarifas = [
      ['Tarifa de Pouso', calculo.tarifa_pouso_usd || 0, calculo.tarifa_pouso || 0],
      ['Tarifa de Permanência', calculo.tarifa_permanencia_usd || 0, calculo.tarifa_permanencia || 0],
      ['Tarifas de Passageiros', calculo.tarifa_passageiros_usd || 0, calculo.tarifa_passageiros || 0],
      ['Tarifa de Carga', calculo.tarifa_carga_usd || 0, calculo.tarifa_carga || 0],
      ['Outras Tarifas (Iluminação)', calculo.outras_tarifas_usd || 0, calculo.outras_tarifas || 0]
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    tarifas.forEach((tarifa, index) => {
      const [desc, valorUsd, valorAoa] = tarifa;
      const bgColor = index % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
      
      doc.setFillColor(...bgColor);
      doc.rect(margins.left, y - 12, contentWidth, 22, 'F');

      doc.text(desc, margins.left + 10, y);
      doc.text(valorUsd.toFixed(2), margins.left + descWidth + 10, y, { align: 'right' });
      doc.text(valorAoa.toFixed(2), margins.left + descWidth + usdWidth + 10, y, { align: 'right' });

      y += 22;
    });

    // Subtotal e impostos (se houver)
    if (detalhes.impostos && detalhes.impostos.length > 0) {
      // Subtotal
      const bgColor = [249, 250, 251];
      doc.setFillColor(...bgColor);
      doc.rect(margins.left, y - 12, contentWidth, 22, 'F');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('SUBTOTAL (sem impostos):', margins.left + 10, y);
      doc.text((detalhes.subtotal_sem_impostos_usd || 0).toFixed(2), margins.left + descWidth + 10, y, { align: 'right' });
      doc.text((detalhes.subtotal_sem_impostos_aoa || 0).toFixed(2), margins.left + descWidth + usdWidth + 10, y, { align: 'right' });
      
      y += 22;

      // Impostos
      detalhes.impostos.forEach((imposto, idx) => {
        const bgColor = idx % 2 === 0 ? [254, 242, 242] : [255, 255, 255];
        doc.setFillColor(...bgColor);
        doc.rect(margins.left, y - 12, contentWidth, 22, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(`${imposto.tipo} (${imposto.valor_configurado}%)`, margins.left + 10, y);
        doc.text((imposto.valor_usd || 0).toFixed(2), margins.left + descWidth + 10, y, { align: 'right' });
        doc.text((imposto.valor_aoa || 0).toFixed(2), margins.left + descWidth + usdWidth + 10, y, { align: 'right' });
        
        y += 22;
      });
    }

    // Linha separadora antes do total
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(2);
    doc.line(margins.left, y, pageWidth - margins.right, y);

    y += 20;

    // Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('TOTAL:', margins.left + 10, y);
    doc.text(
      new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(proforma.valor_total_usd),
      margins.left + descWidth + 10,
      y,
      { align: 'right' }
    );
    doc.text(
      new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(proforma.valor_total_aoa),
      margins.left + descWidth + usdWidth + 10,
      y,
      { align: 'right' }
    );

    y += 30;

    // Observações (se houver)
    if (proforma.observacoes) {
      doc.setFillColor(254, 249, 195);
      doc.rect(margins.left, y, contentWidth, 40, 'F');
      doc.setDrawColor(250, 204, 21);
      doc.rect(margins.left, y, contentWidth, 40);

      y += 18;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(113, 63, 18);
      doc.text('Observações:', margins.left + 10, y);
      
      y += 12;
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(proforma.observacoes, contentWidth - 20);
      doc.text(obsLines, margins.left + 10, y);
    }

    // Rodapé
    const footerY = pageHeight - 30;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Sociedade Gestora de Aeroportos, S.A.', margins.left, footerY);
    doc.text(
      `Gerado em: ${new Date().toLocaleDateString('pt-AO')} por ${user.full_name || user.email}`,
      pageWidth - margins.right,
      footerY,
      { align: 'right' }
    );

    // Gerar PDF como base64
    console.log('Gerando PDF...');
    const pdfBase64 = doc.output('dataurlstring');
    console.log('PDF gerado em base64');

    // Converter base64 para blob
    const base64Data = pdfBase64.split(',')[1];
    const binaryData = atob(base64Data);
    const arrayBuffer = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      arrayBuffer[i] = binaryData.charCodeAt(i);
    }
    
    const fileName = `proforma_${proforma.numero_proforma.replace(/\//g, '_')}_${Date.now()}.pdf`;
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const file = new File([blob], fileName, { type: 'application/pdf' });

    console.log('Fazendo upload do PDF...');
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    console.log('Upload concluído:', uploadResult);
    
    const pdfUrl = uploadResult.file_url;

    // Atualizar proforma com URL do PDF
    console.log('Atualizando proforma com URL do PDF...');
    await base44.asServiceRole.entities.Proforma.update(proforma_id, { pdf_url: pdfUrl });

    console.log('✅ PDF gerado e salvo com sucesso');
    return Response.json({
      success: true,
      pdf_url: pdfUrl,
      proforma_numero: proforma.numero_proforma
    });

  } catch (error) {
    console.error('❌ Erro ao gerar PDF da proforma:', error);
    console.error('Stack trace:', error.stack);
    return Response.json({ 
      error: 'Erro ao gerar PDF da proforma', 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});