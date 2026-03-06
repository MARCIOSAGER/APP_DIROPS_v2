import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const AEROPORTOS = ['FNGA', 'FNUB', 'FNCT', 'FNSD', 'FNSA', 'FNMO', 'FNHU', 'FNLU', 'FNUE', 'FNME', 'FNDU', 'FNGI', 'FNMA', 'FNUG', 'FNBC'];

Deno.serve(async (req) => {
  try {
    // Extrair payload ANTES de criar o client (req.json só pode ser lido uma vez)
    let payload = {};
    try {
      const clonedReq = req.clone();
      payload = await clonedReq.json();
    } catch {
      payload = {};
    }
    
    const base44 = createClientFromRequest(req);
    const { aeroporto_icao } = payload;
    
    // Se foi passado um aeroporto específico, usar apenas esse
    const aeroportosParaProcessar = aeroporto_icao ? [aeroporto_icao] : AEROPORTOS;
    
    console.log('📊 ========== RELATÓRIOS SEMANAIS ==========');
    console.log(`📅 Iniciando envio de relatórios semanais para ${aeroportosParaProcessar.length} aeroporto(s)`);

    const resultados = [];
    let sucessos = 0;
    let erros = 0;

    for (const aeroporto of aeroportosParaProcessar) {
      try {
        console.log(`\n🔄 Processando ${aeroporto}...`);
        
        const resultado = await base44.functions.invoke('gerarRelatorioOperacional', {
          periodo: 'semanal',
          aeroporto_icao: aeroporto
        });

        resultados.push({
          aeroporto,
          status: 'sucesso',
          data: resultado.data || resultado
        });
        
        sucessos++;
        console.log(`✅ ${aeroporto} concluído`);
        
        // Pequeno delay entre aeroportos
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Erro em ${aeroporto}:`, error.message);
        console.error(`Stack:`, error.stack);
        
        // Se o erro contém response.data (axios), extrair a mensagem
        let errorMsg = error.message;
        if (error.response?.data?.error) {
          errorMsg = error.response.data.error;
          if (error.response.data.details) {
            errorMsg += ` - ${error.response.data.details}`;
          }
        }
        
        resultados.push({
          aeroporto,
          status: 'erro',
          erro: errorMsg
        });
        erros++;
      }
    }

    console.log('\n📊 ========== RESUMO ==========');
    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Erros: ${erros}`);
    console.log('================================\n');

    return Response.json({
      sucesso: true,
      tipo: 'semanal',
      total_aeroportos: aeroportosParaProcessar.length,
      sucessos,
      erros,
      resultados,
      mensagem: `Relatório semanal gerado para ${aeroportosParaProcessar.length} aeroporto(s)`
    });

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    return Response.json({ 
      error: 'Erro ao enviar relatórios semanais',
      details: error.message 
    }, { status: 500 });
  }
});