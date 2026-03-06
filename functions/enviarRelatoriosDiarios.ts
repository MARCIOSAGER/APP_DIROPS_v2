import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const AEROPORTOS = ['FNCA', 'FNUB', 'FNCT', 'FNSO', 'FNSA', 'FNMO', 'FNHU', 'FNLU', 'FNKU', 'FNUE', 'FNME', 'FNDU', 'FNGI', 'FNMA', 'FNUG', 'FNBC'];

Deno.serve(async (req) => {
  try {
    let payload = {};
    try {
      const clonedReq = req.clone();
      payload = await clonedReq.json();
    } catch {
      payload = {};
    }
    
    const base44 = createClientFromRequest(req);
    const { aeroporto_icao } = payload;
    
    const aeroportosParaProcessar = aeroporto_icao ? [aeroporto_icao] : AEROPORTOS;
    
    console.log('📊 ========== RELATÓRIOS DIÁRIOS ==========');
    console.log(`📅 Iniciando envio de relatórios diários para ${aeroportosParaProcessar.length} aeroporto(s)`);

    const resultados = [];
    let sucessos = 0;
    let erros = 0;

    // Processar em lotes de 2 aeroportos em paralelo para evitar timeout
    const BATCH_SIZE = 2;
    
    for (let i = 0; i < aeroportosParaProcessar.length; i += BATCH_SIZE) {
      const batch = aeroportosParaProcessar.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.join(', ')}`);
      
      const batchPromises = batch.map(async (aeroporto) => {
        try {
          console.log(`  → ${aeroporto}...`);
          
          const resultado = await base44.functions.invoke('gerarRelatorioOperacional', {
            periodo: 'diario',
            aeroporto_icao: aeroporto
          });

          console.log(`  ✅ ${aeroporto} concluído`);
          
          return {
            aeroporto,
            status: 'sucesso',
            data: resultado.data || resultado
          };
          
        } catch (error) {
          console.error(`  ❌ Erro em ${aeroporto}:`, error.message);
          
          let errorMsg = error.message;
          if (error.response?.data?.error) {
            errorMsg = error.response.data.error;
            if (error.response.data.details) {
              errorMsg += ` - ${error.response.data.details}`;
            }
          }
          
          return {
            aeroporto,
            status: 'erro',
            erro: errorMsg
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        resultados.push(result);
        if (result.status === 'sucesso') {
          sucessos++;
        } else {
          erros++;
        }
      });
      
      // Delay entre lotes para evitar sobrecarga
      if (i + BATCH_SIZE < aeroportosParaProcessar.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n📊 ========== RESUMO ==========');
    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Erros: ${erros}`);
    console.log('================================\n');

    return Response.json({
      sucesso: true,
      tipo: 'diario',
      total_aeroportos: aeroportosParaProcessar.length,
      sucessos,
      erros,
      resultados,
      mensagem: `Relatório diário gerado para ${aeroportosParaProcessar.length} aeroporto(s)`
    });

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    return Response.json({ 
      error: 'Erro ao enviar relatórios diários',
      details: error.message 
    }, { status: 500 });
  }
});