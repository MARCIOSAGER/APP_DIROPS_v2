import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    console.log('🚀 Iniciando geração de PDF da proforma');
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { proforma_id } = body;

    if (!proforma_id) {
      return Response.json({ error: 'proforma_id é obrigatório' }, { status: 400 });
    }

    console.log('📋 Buscando proforma:', proforma_id);

    // Buscar proforma diretamente
    const proforma = await base44.asServiceRole.entities.Proforma.get(proforma_id);
    if (!proforma) {
      console.error('❌ Proforma não encontrada');
      return Response.json({ error: 'Proforma não encontrada' }, { status: 404 });
    }

    console.log('✅ Proforma encontrada:', {
      numero: proforma.numero_proforma,
      calculo_id: proforma.calculo_tarifa_id,
      aeroporto_id: proforma.aeroporto_id,
      companhia_id: proforma.companhia_aerea_id
    });

    // Buscar dados relacionados em paralelo usando os IDs da proforma
    console.log('📋 Buscando dados relacionados...');
    const [calculo, aeroporto, companhia, todosImpostos] = await Promise.all([
      base44.asServiceRole.entities.CalculoTarifa.get(proforma.calculo_tarifa_id),
      base44.asServiceRole.entities.Aeroporto.get(proforma.aeroporto_id),
      base44.asServiceRole.entities.CompanhiaAerea.get(proforma.companhia_aerea_id),
      base44.asServiceRole.entities.Imposto.list()
    ]);

    if (!calculo) {
      console.error('❌ Cálculo não encontrado para ID:', proforma.calculo_tarifa_id);
      return Response.json({ error: `Cálculo ${proforma.calculo_tarifa_id} não encontrado` }, { status: 404 });
    }
    if (!aeroporto) {
      console.error('❌ Aeroporto não encontrado para ID:', proforma.aeroporto_id);
      return Response.json({ error: `Aeroporto ${proforma.aeroporto_id} não encontrado` }, { status: 404 });
    }
    if (!companhia) {
      console.error('❌ Companhia não encontrada para ID:', proforma.companhia_aerea_id);
      return Response.json({ error: `Companhia ${proforma.companhia_aerea_id} não encontrada` }, { status: 404 });
    }

    // Filtrar impostos ativos para o aeroporto ou globais
    const impostosAtivos = todosImpostos.filter(imp => 
      imp.status === 'ativo' && 
      (!imp.aeroporto_id || imp.aeroporto_id === proforma.aeroporto_id)
    );

    console.log('✅ Dados carregados com sucesso');
    console.log('📄 Criando PDF...');

    // Criar PDF
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;

    // Logo SGA (topo esquerdo)
    try {
      const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        const logoArrayBuffer = await logoBlob.arrayBuffer();
        const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoArrayBuffer)));
        doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 40, y, 120, 40);
      }
    } catch (logoError) {
      console.warn('⚠️ Não foi possível carregar o logo:', logoError);
    }

    // Título
    y += 20;
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 70, 150);
    doc.text('NOTA PROFORMA', pageWidth / 2, y, { align: 'center' });
    y += 25;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(proforma.numero_proforma, pageWidth / 2, y, { align: 'center' });
    y += 50;

    // Informações do emissor
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('EMISSOR:', 40, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Sociedade Gestora de Aeroportos, S.A.', 40, y);
    y += 15;
    doc.text(`Aeroporto ${aeroporto.nome} - ${aeroporto.cidade} (${aeroporto.codigo_icao})`, 40, y);
    y += 15;
    doc.text(`${aeroporto.cidade}, Angola`, 40, y);
    y += 30;

    // Informações do cliente
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CLIENTE:', 40, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(companhia.nome, 40, y);
    y += 15;
    doc.text(`Código ICAO: ${companhia.codigo_icao}`, 40, y);
    if (companhia.codigo_iata) {
      y += 15;
      doc.text(`Código IATA: ${companhia.codigo_iata}`, 40, y);
    }
    y += 30;

    // Informações do Voo
    const vooDoCalculo = await base44.asServiceRole.entities.Voo.get(calculo.voo_id);
    if (vooDoCalculo) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('DETALHES DO VOO:', 40, y);
      y += 18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Número do Voo: ${vooDoCalculo.numero_voo}`, 40, y);
      y += 15;
      doc.text(`Data de Operação: ${new Date(vooDoCalculo.data_operacao).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 40, y);
      y += 15;
      doc.text(`Tipo de Voo: ${vooDoCalculo.tipo_voo || 'N/A'}`, 40, y);
      y += 15;
      doc.text(`Matrícula: ${vooDoCalculo.registo_aeronave}`, 40, y);

      if (calculo.voo_ligado_id) {
        const vooLigado = await base44.asServiceRole.entities.VooLigado.get(calculo.voo_ligado_id);
        if (vooLigado) {
          const vooArr = await base44.asServiceRole.entities.Voo.get(vooLigado.id_voo_arr);
          const vooDep = await base44.asServiceRole.entities.Voo.get(vooLigado.id_voo_dep);
          if (vooArr && vooDep) {
            y += 15;
            doc.text(`Rota: ${vooArr.aeroporto_origem_destino} → ${vooArr.aeroporto_operacao} → ${vooDep.aeroporto_origem_destino}`, 40, y);
            y += 15;
            doc.text(`Estacionamento: ${(vooLigado.tempo_permanencia_min / 60).toFixed(2)} horas`, 40, y);
          }
        }
      }
      y += 30;
    }

    // Datas e câmbio
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date(proforma.data_emissao).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 40, y);
    y += 15;
    doc.text(`Data de Vencimento: ${new Date(proforma.data_vencimento).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 40, y);
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text(`Taxa de Câmbio: 1 USD = ${proforma.taxa_cambio.toFixed(2)} AOA`, 40, y);
    y += 30;

    // Tabela de tarifas com detalhes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('DISCRIMINAÇÃO DE TARIFAS', 40, y);
    y += 20;

    const detalhes = calculo.detalhes_calculo || {};

    // Tarifa de Pouso
    if (detalhes.pouso) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 70, 150);
      doc.text('Tarifa de Pouso', 40, y);
      doc.setTextColor(0, 0, 0);
      y += 15;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Tipo de Voo: ${detalhes.pouso.tipoVoo}`, 45, y);
      doc.text(`Faixa de Peso: ${detalhes.pouso.faixa_min_ton || '-'} - ${detalhes.pouso.faixa_max_ton || '-'} toneladas`, 280, y);
      y += 12;
      doc.text(`Tarifa Aplicada: $${detalhes.pouso.tarifaAplicada}/tonelada`, 45, y);
      doc.text(`MTOW (Toneladas): ${detalhes.pouso.mtowTonnes}t`, 280, y);
      y += 12;
      doc.text(`Operações: ${detalhes.pouso.operacoes}`, 45, y);
      y += 12;
      doc.setTextColor(50, 120, 50);
      doc.setFontSize(8);
      doc.text(`Fórmula: ${detalhes.pouso.formula}`, 45, y);
      doc.setTextColor(0, 0, 0);
      y += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Valor USD: $${detalhes.pouso.valor.toFixed(2)}`, 45, y);
      doc.text(`Valor AOA: ${(detalhes.pouso.valor * proforma.taxa_cambio).toFixed(2)} Kz`, 280, y);
      y += 20;
    }

    // Tarifa de Permanência
    if (detalhes.permanencia) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 70, 150);
      doc.text('Tarifa de Permanência', 40, y);
      doc.setTextColor(0, 0, 0);
      y += 15;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Tipo: ${detalhes.permanencia.tipo}`, 45, y);
      doc.text(`Tempo: ${detalhes.permanencia.tempoPermanencia}`, 280, y);
      y += 12;
      if (detalhes.permanencia.formula) {
        doc.setTextColor(50, 120, 50);
        doc.setFontSize(8);
        doc.text(`Fórmula: ${detalhes.permanencia.formula}`, 45, y);
        doc.setTextColor(0, 0, 0);
        y += 12;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Valor USD: $${detalhes.permanencia.valor.toFixed(2)}`, 45, y);
      doc.text(`Valor AOA: ${(detalhes.permanencia.valor * proforma.taxa_cambio).toFixed(2)} Kz`, 280, y);
      y += 20;
    }

    // Tarifas de Passageiros
    if (detalhes.passageiros) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 70, 150);
      doc.text('Tarifas de Passageiros', 40, y);
      doc.setTextColor(0, 0, 0);
      y += 15;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Tipo de Voo: ${detalhes.passageiros.tipoVoo}`, 45, y);
      doc.text(`Descrição: ${detalhes.passageiros.descricao_tarifa}`, 280, y);
      y += 12;
      doc.text(`Passageiros ARR: ${detalhes.passageiros.passageirosArr}`, 45, y);
      doc.text(`Passageiros DEP: ${detalhes.passageiros.passageirosDep}`, 200, y);
      doc.text(`Total Cobrado: ${detalhes.passageiros.totalPassageirosCobranca} pax`, 350, y);
      y += 12;
      doc.text(`Tarifa por Pax: $${detalhes.passageiros.tarifaPorPassageiro}`, 45, y);
      doc.text(`Trânsito Direto (Isento): ${detalhes.passageiros.transitoDireto}`, 200, y);
      y += 12;
      doc.text(`Trânsito c/ Transbordo (Isento): ${detalhes.passageiros.transitoTransbordo}`, 45, y);
      y += 12;
      doc.setTextColor(50, 120, 50);
      doc.setFontSize(8);
      doc.text(`Fórmula: ${detalhes.passageiros.formula}`, 45, y);
      doc.setTextColor(0, 0, 0);
      y += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Valor USD: $${detalhes.passageiros.valor.toFixed(2)}`, 45, y);
      doc.text(`Valor AOA: ${(detalhes.passageiros.valor * proforma.taxa_cambio).toFixed(2)} Kz`, 280, y);
      y += 20;
    }

    // Tarifa de Carga
    if (detalhes.carga && detalhes.carga.valor > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 70, 150);
      doc.text('Tarifa de Carga', 40, y);
      doc.setTextColor(0, 0, 0);
      y += 15;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Tipo de Voo: ${detalhes.carga.tipoVoo}`, 45, y);
      y += 12;
      doc.text(`Carga ARR: ${detalhes.carga.cargaArr} kg`, 45, y);
      doc.text(`Carga DEP: ${detalhes.carga.cargaDep} kg`, 200, y);
      doc.text(`Total Cobrado: ${detalhes.carga.totalCargaKg} kg`, 350, y);
      y += 12;
      if (detalhes.carga.formula) {
        doc.setTextColor(50, 120, 50);
        doc.setFontSize(8);
        doc.text(`Fórmula: ${detalhes.carga.formula}`, 45, y);
        doc.setTextColor(0, 0, 0);
        y += 12;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Valor USD: $${detalhes.carga.valor.toFixed(2)}`, 45, y);
      doc.text(`Valor AOA: ${(detalhes.carga.valor * proforma.taxa_cambio).toFixed(2)} Kz`, 280, y);
      y += 20;
    }

    // Linha de separação
    y += 5;
    doc.setDrawColor(180, 180, 180);
    doc.line(40, y, 540, y);
    y += 15;

    // Subtotal (sem impostos)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const subtotalUSD = detalhes.subtotal_sem_impostos_usd || calculo.total_tarifa_usd || 0;
    const subtotalAOA = detalhes.subtotal_sem_impostos_aoa || calculo.total_tarifa || 0;
    doc.text('SUBTOTAL (sem impostos):', 40, y);
    doc.text(`$${subtotalUSD.toFixed(2)}`, 340, y, { align: 'right' });
    doc.text(`${subtotalAOA.toFixed(2)} Kz`, 520, y, { align: 'right' });
    y += 25;

    // Impostos com detalhes
    if (detalhes.impostos && detalhes.impostos.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 70, 150);
      doc.text('IMPOSTOS:', 40, y);
      doc.setTextColor(0, 0, 0);
      y += 15;

      detalhes.impostos.forEach((imposto) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Tipo: ${imposto.tipo}`, 45, y);
        doc.text(`Percentagem: ${imposto.valor_configurado}%`, 280, y);
        y += 12;
        doc.setTextColor(50, 120, 50);
        doc.setFontSize(8);
        doc.text(`Fórmula: ${imposto.formula}`, 45, y);
        doc.setTextColor(0, 0, 0);
        y += 12;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Valor USD: $${imposto.valor_usd.toFixed(2)}`, 45, y);
        doc.text(`Valor AOA: ${imposto.valor_aoa.toFixed(2)} Kz`, 280, y);
        y += 18;
      });

      y += 5;
      doc.setDrawColor(180, 180, 180);
      doc.line(40, y, 540, y);
      y += 15;

      const totalImpostosUSD = detalhes.total_impostos_usd || 0;
      const totalImpostosAOA = detalhes.total_impostos_aoa || 0;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('TOTAL IMPOSTOS:', 40, y);
      doc.text(`$${totalImpostosUSD.toFixed(2)}`, 340, y, { align: 'right' });
      doc.text(`${totalImpostosAOA.toFixed(2)} Kz`, 520, y, { align: 'right' });
      y += 25;
    }

    // Linha de separação final (mais grossa)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.5);
    doc.line(40, y, 540, y);
    doc.setLineWidth(1);
    y += 20;

    // Total Geral (destacado)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 100, 0);
    doc.text('TOTAL GERAL:', 40, y);
    doc.text(proforma.valor_total_usd.toFixed(2), 340, y, { align: 'right' });
    doc.text(proforma.valor_total_aoa.toFixed(2), 520, y, { align: 'right' });
    y += 35;

    // Observações
    if (proforma.observacoes) {
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Observações:', 40, y);
      y += 15;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(proforma.observacoes, 500);
      doc.text(lines, 40, y);
    }

    console.log('📤 Gerando output do PDF...');

    // Gerar PDF como string
    const pdfOutput = doc.output('datauristring');
    const base64String = pdfOutput.split(',')[1];
    
    console.log('📦 Convertendo para blob...');

    // Decodificar base64
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `proforma_${proforma.numero_proforma.replace(/\//g, '_')}_${Date.now()}.pdf`;
    const file = new File([bytes.buffer], fileName, { type: 'application/pdf' });

    console.log('☁️ Fazendo upload para o storage...');

    // Upload do arquivo
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    
    if (!uploadResult || !uploadResult.file_url) {
      throw new Error('Falha no upload do PDF');
    }

    const pdfUrl = uploadResult.file_url;
    console.log('✅ PDF enviado:', pdfUrl);

    // Atualizar a proforma com a URL do PDF
    await base44.asServiceRole.entities.Proforma.update(proforma_id, { 
      pdf_url: pdfUrl 
    });

    console.log('✅ Proforma atualizada com sucesso');

    return Response.json({
      success: true,
      pdf_url: pdfUrl,
      proforma_numero: proforma.numero_proforma
    });

  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: 'Erro ao gerar PDF',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});