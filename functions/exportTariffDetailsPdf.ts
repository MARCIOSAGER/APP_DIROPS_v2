import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.text();
    let calculoId;
    
    try {
      const jsonBody = JSON.parse(body);
      calculoId = jsonBody.calculoId;
    } catch (e) {
      console.error('Erro ao fazer parse do body:', e);
      return Response.json({ error: 'Formato de requisição inválido' }, { status: 400 });
    }

    if (!calculoId) {
      return Response.json({ error: 'ID do cálculo é obrigatório' }, { status: 400 });
    }

    console.log('📊 Buscando cálculo ID:', calculoId);
    
    // Buscar dados do cálculo
    const calculos = await base44.entities.CalculoTarifa.filter({ id: calculoId });
    if (!calculos || calculos.length === 0) {
      console.error('❌ Cálculo não encontrado:', calculoId);
      return Response.json({ error: 'Cálculo não encontrado' }, { status: 404 });
    }
    const calculo = calculos[0];
    console.log('✅ Cálculo encontrado:', calculo.id);

    // Buscar dados relacionados
    console.log('📊 Buscando dados relacionados...');
    const [voos, aeroportos, companhias] = await Promise.all([
      base44.entities.Voo.filter({ id: calculo.voo_id }),
      base44.entities.Aeroporto.list(),
      base44.entities.CompanhiaAerea.list()
    ]);

    const voo = voos[0];
    if (!voo) {
      console.error('❌ Voo não encontrado:', calculo.voo_id);
      return Response.json({ error: 'Voo não encontrado' }, { status: 404 });
    }
    console.log('✅ Voo encontrado:', voo.numero_voo);

    const aeroporto = aeroportos.find(a => a.id === calculo.aeroporto_id);
    const companhia = companhias.find(c => c.codigo_icao === voo.companhia_aerea);

    const detalhes = calculo.detalhes_calculo || {};
    console.log('✅ Dados carregados, gerando PDF...');
    console.log('📊 Estrutura do cálculo:', {
      id: calculo.id,
      voo_id: calculo.voo_id,
      tem_detalhes: !!detalhes,
      tem_pouso: !!detalhes.pouso,
      tem_permanencia: !!detalhes.permanencia,
      tem_passageiros: !!detalhes.passageiros,
      tem_carga: !!detalhes.carga,
      tarifa_pouso_usd: calculo.tarifa_pouso_usd,
      tarifa_permanencia_usd: calculo.tarifa_permanencia_usd,
      total_tarifa_usd: calculo.total_tarifa_usd,
      taxa_cambio: calculo.taxa_cambio_usd_aoa
    });

    // Criar PDF
    let doc;
    try {
      console.log('🔄 Inicializando jsPDF...');
      doc = new jsPDF();
      console.log('✅ jsPDF inicializado com sucesso');
      console.log('📏 Dimensões da página:', doc.internal.pageSize.getWidth(), 'x', doc.internal.pageSize.getHeight());
    } catch (pdfError) {
      console.error('❌ CRÍTICO - Erro ao criar jsPDF:', pdfError);
      console.error('Stack:', pdfError.stack);
      throw new Error('Erro ao inicializar gerador de PDF: ' + pdfError.message);
    }
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 16;
    const lineHeight = 3;
    const sectionSpacing = 1.5;

    // Adicionar logo (pular se falhar)
    try {
      const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        const logoArrayBuffer = await logoBlob.arrayBuffer();
        const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoArrayBuffer)));
        doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 15, yPos - 5, 40, 15);
      }
    } catch (e) {
      console.log('Logo não adicionado:', e.message);
    }

    // Título
    try {
      console.log('📝 Adicionando título...');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Cálculo de Tarifas Aeroportuárias', pageWidth / 2, yPos, { align: 'center' });
      yPos += 7;
      console.log('✅ Título adicionado');
    } catch (titleError) {
      console.error('❌ Erro ao adicionar título:', titleError);
      throw new Error('Erro ao adicionar título: ' + titleError.message);
    }

    // Informações dos Voos ARR e DEP - Box estilo modal
    try {
      // Buscar voo ARR se houver voo ligado
      let vooArrData = null;
      if (voo.voo_ligado_id) {
        const voosLigados = await base44.entities.VooLigado.filter({ id: voo.voo_ligado_id });
        if (voosLigados.length > 0) {
          const vooLigado = voosLigados[0];
          const voosArr = await base44.entities.Voo.filter({ id: vooLigado.id_voo_arr });
          vooArrData = voosArr[0];
        }
      }

      // Desenhar box azul de fundo - mais compacto
      const boxHeight = vooArrData ? 16 : 11;
      doc.setFillColor(219, 234, 254);
      doc.rect(15, yPos - 2, pageWidth - 30, boxHeight, 'F');
      
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.3);
      doc.rect(15, yPos - 2, pageWidth - 30, boxHeight);

      doc.setFontSize(8);
      doc.setTextColor(30, 58, 138);

      let boxY = yPos + 1;
      
      if (vooArrData) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Voo ARR:`, 18, boxY);
        doc.setFont('helvetica', 'normal');
        doc.text(`${vooArrData.numero_voo || 'N/A'}`, 36, boxY);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Data:`, 105, boxY);
        doc.setFont('helvetica', 'normal');
        doc.text(`${vooArrData.data_operacao || 'N/A'}`, 118, boxY);
        boxY += 4;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`Voo DEP:`, 18, boxY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${voo.numero_voo || 'N/A'}`, 36, boxY);
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Data:`, 105, boxY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${voo.data_operacao || 'N/A'}`, 118, boxY);
      boxY += 4;

      doc.setFont('helvetica', 'bold');
      doc.text(`Aeroporto:`, 18, boxY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${aeroporto?.nome ? `${aeroporto.nome} - ${aeroporto.codigo_icao}` : 'N/A'}`, 36, boxY);
      boxY += 4;

      doc.setFont('helvetica', 'bold');
      doc.text(`Companhia:`, 18, boxY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${voo.companhia_aerea ? `${voo.companhia_aerea} - ${companhia?.nome || 'N/A'}` : companhia?.nome || 'N/A'}`, 36, boxY);
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Registo:`, 105, boxY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${voo.registo_aeronave || 'N/A'}`, 121, boxY);

      yPos += boxHeight + 2;
      doc.setTextColor(0, 0, 0); // Reset para preto
      console.log('✅ Informações dos voos adicionadas');
    } catch (infoError) {
      console.error('❌ Erro ao adicionar informações dos voos:', infoError);
      throw new Error('Erro ao adicionar informações dos voos: ' + infoError.message);
    }

    // Linha separadora
    try {
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += sectionSpacing - 1;
    } catch (lineError) {
      console.error('❌ Erro ao desenhar linha:', lineError);
      // Não crítico, continuar
    }

    // Funções auxiliares de formatação
    const formatCurrency = (value) => {
      const formatted = new Intl.NumberFormat('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value || 0);
      return `${formatted} Kz`;
    };

    const formatUSD = (value) => {
      return `$${new Intl.NumberFormat('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value || 0)}`;
    };

    const formatToneladas = (value) => {
      return `${Math.round(value || 0)}t`;
    };

    // Função auxiliar para adicionar seção com layout de 4 colunas (2 pares label-valor por linha)
    const addSection = (title, data, includeDescription = false) => {
      try {
        console.log(`📊 Adicionando seção: ${title}`);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 74, 153);
        doc.text(String(title), 15, yPos);
        yPos += lineHeight + 0.5;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const entries = Object.entries(data);
        // 4 colunas: label1, valor1, label2, valor2
        const col1X = 18;
        const col2X = 46;
        const col3X = 108;
        const col4X = 136;

        for (let i = 0; i < entries.length; i++) {
          const [key, value] = entries[i];

          try {
            const keyStr = key != null ? String(key) : 'Campo';
            let valueStr = 'N/A';

            if (value != null) {
              if (typeof value === 'object') {
                valueStr = JSON.stringify(value);
              } else {
                valueStr = String(value);
              }
            }

            const maxLength = 26;
            if (valueStr.length > maxLength) {
              valueStr = valueStr.substring(0, maxLength - 3) + '...';
            }

            if (i % 2 === 0) {
              doc.setFont('helvetica', 'bold');
              doc.text(keyStr + ':', col1X, yPos);
              doc.setFont('helvetica', 'normal');
              doc.text(valueStr, col2X, yPos);
            } else {
              doc.setFont('helvetica', 'bold');
              doc.text(keyStr + ':', col3X, yPos);
              doc.setFont('helvetica', 'normal');
              doc.text(valueStr, col4X, yPos);
              yPos += lineHeight;
            }
          } catch (itemError) {
            console.error(`❌ Erro ao adicionar item ${key}:`, itemError);
          }
        }

        if (entries.length % 2 !== 0) {
          yPos += lineHeight;
        }

        yPos += sectionSpacing;
        console.log(`✅ Seção ${title} adicionada`);
      } catch (sectionError) {
        console.error(`❌ Erro ao adicionar seção ${title}:`, sectionError);
        throw new Error(`Erro na seção ${title}: ${sectionError.message}`);
      }
    };

    // Informações Gerais - mais compacto
    try {
      const infoGerais = {
        'Companhia': voo.companhia_aerea || 'N/A',
        'Matrícula': voo.registo_aeronave || 'N/A',
        'Tipo Voo': voo.tipo_voo || 'Regular',
        'Operação': detalhes.pouso?.tipoVoo || 'N/A',
        'MTOW': `${new Intl.NumberFormat('pt-PT').format(calculo.mtow_kg || 0)} kg`,
        'Categoria': detalhes.pouso?.categoria_aeroporto || aeroporto?.categoria || 'N/A',
        'Estacionamento': detalhes.permanencia ? `${detalhes.permanencia.tempoPermanencia || '0h'}` : '0h',
        'Câmbio': `1 USD = ${calculo.taxa_cambio_usd_aoa || 850} AOA`
      };
      addSection('Informações Gerais', infoGerais);
      console.log('✅ Informações gerais adicionadas');
    } catch (geralError) {
      console.error('❌ Erro ao adicionar informações gerais:', geralError);
      throw new Error('Erro ao adicionar informações gerais: ' + geralError.message);
    }

    // Tarifa de Pouso - mais compacto
    try {
      console.log('📊 Processando tarifa de pouso...');
      if (detalhes.pouso && !detalhes.pouso.erro) {
        const tarifaAplicada = detalhes.pouso.tarifaAplicada ? detalhes.pouso.tarifaAplicada.toFixed(2) : '0';
        const pousoData = {
        'Tipo': detalhes.pouso.tipoVoo || 'N/A',
        'MTOW': formatToneladas(detalhes.pouso.mtowTonnes),
        'Tarifa': formatUSD(parseFloat(tarifaAplicada)) + '/t',
        'Operações': detalhes.pouso.operacoes || '1',
        'USD': formatUSD(calculo.tarifa_pouso_usd),
        'AOA': formatCurrency(calculo.tarifa_pouso)
        };
      addSection('Tarifa de Pouso', pousoData);
      console.log('✅ Tarifa de pouso adicionada');
      }
    } catch (pousoError) {
      console.error('❌ Erro na tarifa de pouso:', pousoError);
      throw new Error('Erro na tarifa de pouso: ' + pousoError.message);
    }

    // Tarifa de Permanência - mais compacto
    try {
      console.log('📊 Processando tarifa de permanência...');
      if (detalhes.permanencia && (calculo.tarifa_permanencia_usd || 0) > 0) {
        const horasCobradas = detalhes.permanencia.horasCobradas != null ? String(detalhes.permanencia.horasCobradas) : '0';
        const permData = {
        'Tempo': detalhes.permanencia.tempoPermanencia || '0h',
        'H. Cobradas': horasCobradas + 'h',
        'USD': formatUSD(calculo.tarifa_permanencia_usd),
        'AOA': formatCurrency(calculo.tarifa_permanencia)
        };
      addSection('Tarifa de Estacionamento', permData);
      console.log('✅ Tarifa de permanência adicionada');
      }
    } catch (permError) {
      console.error('❌ Erro na tarifa de permanência:', permError);
      throw new Error('Erro na tarifa de permanência: ' + permError.message);
    }

    // Tarifas de Passageiros - mais compacto
    try {
      console.log('📊 Processando tarifa de passageiros...');
      if (detalhes.passageiros && !detalhes.passageiros.erro) {
        const passData = {
        'Tarifa/Pax': formatUSD(detalhes.passageiros.tarifaPorPassageiro),
        'Pax DEP': String(detalhes.passageiros.passageirosDep || 0),
        'Cobrado': String(detalhes.passageiros.totalPassageirosCobranca || 0) + ' pax',
        'USD': formatUSD(calculo.tarifa_passageiros_usd),
        'AOA': formatCurrency(calculo.tarifa_passageiros)
        };
        addSection('Tarifas de Passageiros', passData);
        console.log('✅ Tarifa de passageiros adicionada');
      }
    } catch (passError) {
      console.error('❌ Erro na tarifa de passageiros:', passError);
      throw new Error('Erro na tarifa de passageiros: ' + passError.message);
    }

    // Tarifa de Carga - mais compacto
    try {
      console.log('📊 Processando tarifa de carga...');
      if (detalhes.carga && (calculo.tarifa_carga_usd || 0) > 0) {
        const cargaData = {
        'Carga DEP': `${new Intl.NumberFormat('pt-PT').format(detalhes.carga.cargaDep || 0)} kg`,
        'Tarifa/Ton': formatUSD(detalhes.carga.tarifaPorTon) + '/t',
        'USD': formatUSD(calculo.tarifa_carga_usd),
        'AOA': formatCurrency(calculo.tarifa_carga)
        };
        addSection('Tarifa de Carga', cargaData);
        console.log('✅ Tarifa de carga adicionada');
      }
    } catch (cargaError) {
      console.error('❌ Erro na tarifa de carga:', cargaError);
      throw new Error('Erro na tarifa de carga: ' + cargaError.message);
    }

    // Impostos
    try {
      console.log('📊 Processando impostos...');
      if (detalhes.impostos && detalhes.impostos.length > 0) {
        detalhes.impostos.forEach((imposto, index) => {
          const impostoData = {
            'Tipo': imposto.tipo,
            'Percentagem': `${imposto.valor_configurado}%`,
            'Fórmula': imposto.formula || 'N/A',
            'USD': formatUSD(imposto.valor_usd),
            'AOA': formatCurrency(imposto.valor_aoa)
          };
          addSection(`Imposto - ${imposto.tipo}`, impostoData);

          // Adicionar descrição se existir
          if (imposto.descricao) {
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            const descLines = doc.splitTextToSize(`Descrição: ${imposto.descricao}`, pageWidth - 40);
            doc.text(descLines, 18, yPos);
            yPos += descLines.length * 2.5 + 1;
            doc.setTextColor(0, 0, 0);
          }
        });
        console.log('✅ Impostos adicionados');
      }
    } catch (impostosError) {
      console.error('❌ Erro em impostos:', impostosError);
      throw new Error('Erro em impostos: ' + impostosError.message);
    }

    // Tarifa de Iluminação - mais compacto
    try {
      console.log('📊 Processando tarifa de iluminação...');
      if (detalhes.iluminacao && !detalhes.iluminacao.isento && (calculo.outras_tarifas_usd || 0) > 0) {
      const ilumData = {
        'Período': '18:00-06:00',
        'Tarifa': formatUSD(detalhes.iluminacao.valorFixo || detalhes.iluminacao.tarifaPorOperacao || 0),
        'USD': formatUSD(detalhes.iluminacao.valor || 0),
        'AOA': formatCurrency(calculo.outras_tarifas || 0)
      };

        addSection('Iluminação', ilumData);
        console.log('✅ Tarifa de iluminação adicionada');
      }
    } catch (ilumError) {
      console.error('❌ Erro na tarifa de iluminação:', ilumError);
      throw new Error('Erro na tarifa de iluminação: ' + ilumError.message);
    }





    // Linha separadora final
    try {
      yPos += 2;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 2;
    } catch (lineError) {
      console.error('❌ Erro ao desenhar linha final:', lineError);
    }

    // Totais - mais compacto
    try {
      console.log('📊 Adicionando totais...');

      yPos += 1.5;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 3;

      // Subtotal sem impostos
      if (detalhes.subtotal_sem_impostos_usd) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('SUBTOTAL:', 15, yPos);
        doc.text(`${formatUSD(detalhes.subtotal_sem_impostos_usd || 0)} = ${formatCurrency(detalhes.subtotal_sem_impostos_aoa || 0)}`, pageWidth - 15, yPos, { align: 'right' });
        yPos += 4;
      }

      // Total de impostos
      if (detalhes.total_impostos_usd && detalhes.total_impostos_usd > 0) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text('IMPOSTOS:', 15, yPos);
        doc.text(`${formatUSD(detalhes.total_impostos_usd || 0)} = ${formatCurrency(detalhes.total_impostos_aoa || 0)}`, pageWidth - 15, yPos, { align: 'right' });
        yPos += 5;
      }

      // Total final
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 128, 0);
      doc.text('TOTAL:', 15, yPos);
      doc.text(`${formatUSD(calculo.total_tarifa_usd || 0)} = ${formatCurrency(calculo.total_tarifa || 0)}`, pageWidth - 15, yPos, { align: 'right' });
      yPos += 3;

      // Nota de câmbio
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`Taxa: 1 USD = ${new Intl.NumberFormat('pt-PT').format(calculo.taxa_cambio_usd_aoa || 850)} AOA`, pageWidth - 15, yPos, { align: 'right' });
      console.log('✅ Totais adicionados');
    } catch (totaisError) {
      console.error('❌ Erro ao adicionar totais:', totaisError);
      throw new Error('Erro ao adicionar totais: ' + totaisError.message);
    }

    // Rodapé com data de geração
    try {
      console.log('📊 Adicionando rodapé...');
      yPos += 3;
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);

      const dataGeracao = new Date().toLocaleString('pt-PT', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });

      const nomeUsuario = user.full_name || user.email;

      doc.text(`Gerado: ${dataGeracao} | Por: ${nomeUsuario}`, 15, yPos);
      console.log('✅ Rodapé adicionado');
    } catch (rodapeError) {
      console.error('❌ Erro ao adicionar rodapé:', rodapeError);
      throw new Error('Erro ao adicionar rodapé: ' + rodapeError.message);
    }

    // Gerar PDF
    console.log('📄 Gerando PDF...');
    console.log('📊 Estado final do documento:', {
      numberOfPages: doc.internal.getNumberOfPages(),
      currentPage: doc.internal.getCurrentPageInfo(),
      yPosFinal: yPos
    });

    let pdfBytes;
    try {
      pdfBytes = doc.output('arraybuffer');
      console.log('✅ PDF gerado com sucesso, tamanho:', pdfBytes.byteLength, 'bytes');
    } catch (outputError) {
      console.error('❌ ERRO ao gerar arraybuffer do PDF:', outputError);
      console.error('Stack:', outputError.stack);
      console.error('Número de páginas:', doc.internal.getNumberOfPages());
      throw new Error('Erro ao gerar PDF arraybuffer: ' + outputError.message);
    }

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=calculo_tarifas_${voo.numero_voo}_${new Date().toISOString().split('T')[0]}.pdf`,
        'Content-Length': pdfBytes.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('❌ ERRO CRÍTICO ao gerar PDF:', error);
    console.error('Stack completo:', error.stack);
    console.error('Tipo de erro:', error.constructor.name);
    console.error('Mensagem:', error.message);
    return Response.json({ 
      error: error.message || 'Erro ao gerar PDF de tarifas',
      details: error.stack,
      errorType: error.constructor.name
    }, { status: 500 });
  }
});