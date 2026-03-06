import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('🔧 Iniciando correção de aeroporto_id em CalculoTarifa (lotes)...');

    // 1. Carregar todos os aeroportos
    const aeroportos = await base44.asServiceRole.entities.Aeroporto.list();
    console.log(`📍 ${aeroportos.length} aeroportos carregados`);

    // Criar mapeamento de codigo_icao -> id
    const icaoToIdMap = new Map();
    aeroportos.forEach(aero => {
      icaoToIdMap.set(aero.codigo_icao?.toUpperCase(), aero.id);
    });

    // 2. Carregar CalculoTarifa em lotes
    const TAMANHO_LOTE = 100;
    let pagina = 0;
    let corrigidosTotal = 0;
    let errosTotal = 0;
    let processados = 0;

    let temMais = true;
    while (temMais) {
      const calculos = await base44.asServiceRole.entities.CalculoTarifa.list(undefined, TAMANHO_LOTE, pagina * TAMANHO_LOTE);
      
      if (!calculos || calculos.length === 0) {
        temMais = false;
        break;
      }

      console.log(`\n📦 Processando lote ${pagina + 1} (${calculos.length} registos)...`);

      for (const calculo of calculos) {
        try {
          const aeroportoIdAtual = calculo.aeroporto_id;

          // Verificar se é um código ICAO (não parece um UUID)
          const isICAO = aeroportoIdAtual && !aeroportoIdAtual.includes('-') && aeroportoIdAtual.length <= 4;

          if (isICAO) {
            // Procurar o ID correto
            const icaoUpper = aeroportoIdAtual.toUpperCase();
            const idCorreto = icaoToIdMap.get(icaoUpper);

            if (idCorreto) {
              // Atualizar o CalculoTarifa
              await base44.asServiceRole.entities.CalculoTarifa.update(calculo.id, {
                aeroporto_id: idCorreto
              });

              corrigidosTotal++;
              console.log(`✅ ${calculo.id}: ${aeroportoIdAtual} → ${idCorreto}`);
            } else {
              errosTotal++;
              console.warn(`⚠️ ${calculo.id}: Código ICAO ${aeroportoIdAtual} não encontrado`);
            }
          }

          processados++;
        } catch (itemError) {
          errosTotal++;
          console.error(`❌ Erro ao processar ${calculo.id}:`, itemError.message);
        }
      }

      pagina++;

      // Se menos de TAMANHO_LOTE registos, chegou ao fim
      if (calculos.length < TAMANHO_LOTE) {
        temMais = false;
      }

      // Pequena pausa entre lotes para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n📈 RESUMO DO LOTE:`);
    console.log(`   ✅ Corrigidos neste ciclo: ${corrigidosTotal}`);
    console.log(`   ⚠️ Erros: ${errosTotal}`);
    console.log(`   📊 Total processados: ${processados}`);

    return Response.json({
      sucesso: true,
      resumo: {
        processados,
        corrigidos: corrigidosTotal,
        erros: errosTotal
      }
    });

  } catch (error) {
    console.error('❌ Erro na correção:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});