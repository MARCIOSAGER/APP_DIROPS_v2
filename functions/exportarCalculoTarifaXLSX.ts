import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    let payload = {};
    try {
      const clonedReq = req.clone();
      payload = await clonedReq.json();
    } catch (e) {
      console.log('⚠️ Sem payload JSON');
    }

    const base44 = createClientFromRequest(req);
    const { aeroporto } = payload;

    console.log('📦 aeroporto:', `"${aeroporto}"`);

    let calculos = [];
    let voos = [];
    let aeroportos = [];

    function normalizeResponse(raw) {
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch (e) {
          return [];
        }
      }
      return Array.isArray(raw) ? raw : (raw?.data || []);
    }

    try {
      // Carregar Aeroportos
      console.log('📥 Carregando Aeroportos...');
      const aeroportosRaw = await base44.asServiceRole.entities.Aeroporto.list();
      aeroportos = normalizeResponse(aeroportosRaw);
      console.log(`✅ Aeroporto: ${aeroportos.length} registros`);

      // Buscar ID do aeroporto
      let aeroportoIdFiltro = null;
      
      if (aeroporto && aeroporto !== 'todos') {
        const aeroportoBusca = String(aeroporto).trim().toUpperCase();
        const aeroportoEncontrado = aeroportos.find(a => 
          String(a.codigo_icao || '').trim().toUpperCase() === aeroportoBusca
        );
        
        if (aeroportoEncontrado) {
          aeroportoIdFiltro = aeroportoEncontrado.id;
          console.log('✅ Aeroporto ENCONTRADO! ID:', aeroportoIdFiltro);
        }
      }

      // Carregar CalculoTarifa - TESTAR VÁRIAS SINTAXES DE FILTRO
      console.log('📥 Testando diferentes sintaxes de filtro...');
      
      let calculosRaw = null;
      let metodoUsado = '';

      if (aeroportoIdFiltro) {
        // Sintaxe 1: filter como objeto
        try {
          console.log('  Tentando: { filter: { aeroporto_id: ID } }');
          calculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list({
            filter: { aeroporto_id: aeroportoIdFiltro }
          });
          const temp = normalizeResponse(calculosRaw);
          if (temp.length > 0) {
            metodoUsado = 'filter object';
            console.log(`  ✅ Funcionou! ${temp.length} registros`);
          } else {
            console.log('  ❌ Retornou 0');
          }
        } catch (e) {
          console.log('  ❌ Erro:', e.message);
        }

        // Sintaxe 2: where
        if (!metodoUsado) {
          try {
            console.log('  Tentando: { where: { aeroporto_id: ID } }');
            calculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list({
              where: { aeroporto_id: aeroportoIdFiltro }
            });
            const temp = normalizeResponse(calculosRaw);
            if (temp.length > 0) {
              metodoUsado = 'where';
              console.log(`  ✅ Funcionou! ${temp.length} registros`);
            } else {
              console.log('  ❌ Retornou 0');
            }
          } catch (e) {
            console.log('  ❌ Erro:', e.message);
          }
        }

        // Sintaxe 3: query string
        if (!metodoUsado) {
          try {
            console.log('  Tentando: { query: "aeroporto_id=ID" }');
            calculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list({
              query: `aeroporto_id=${aeroportoIdFiltro}`
            });
            const temp = normalizeResponse(calculosRaw);
            if (temp.length > 0) {
              metodoUsado = 'query string';
              console.log(`  ✅ Funcionou! ${temp.length} registros`);
            } else {
              console.log('  ❌ Retornou 0');
            }
          } catch (e) {
            console.log('  ❌ Erro:', e.message);
          }
        }

        // Sintaxe 4: filters array
        if (!metodoUsado) {
          try {
            console.log('  Tentando: { filters: [{ field: "aeroporto_id", value: ID }] }');
            calculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list({
              filters: [{ field: 'aeroporto_id', value: aeroportoIdFiltro }]
            });
            const temp = normalizeResponse(calculosRaw);
            if (temp.length > 0) {
              metodoUsado = 'filters array';
              console.log(`  ✅ Funcionou! ${temp.length} registros`);
            } else {
              console.log('  ❌ Retornou 0');
            }
          } catch (e) {
            console.log('  ❌ Erro:', e.message);
          }
        }

        // Sintaxe 5: aeroporto_id direto
        if (!metodoUsado) {
          try {
            console.log('  Tentando: { aeroporto_id: ID }');
            calculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list({
              aeroporto_id: aeroportoIdFiltro
            });
            const temp = normalizeResponse(calculosRaw);
            if (temp.length > 0) {
              metodoUsado = 'direct param';
              console.log(`  ✅ Funcionou! ${temp.length} registros`);
            } else {
              console.log('  ❌ Retornou 0');
            }
          } catch (e) {
            console.log('  ❌ Erro:', e.message);
          }
        }
      }

      // Se nenhum filtro funcionou, carregar amostra
      if (!metodoUsado) {
        console.log('⚠️ Nenhum filtro funcionou, carregando amostra...');
        calculosRaw = await base44.asServiceRole.entities.CalculoTarifa.list({ limit: 500 });
      }

      let todosCalculos = normalizeResponse(calculosRaw);
      console.log(`📊 Dados carregados: ${todosCalculos.length} registros`);

      // Filtro manual se necessário
      if (aeroportoIdFiltro && !metodoUsado && todosCalculos.length > 0) {
        console.log('🔧 Aplicando filtro manual...');
        calculos = todosCalculos.filter(ct => 
          String(ct.aeroporto_id) === String(aeroportoIdFiltro)
        );
        console.log(`✅ Após filtro manual: ${calculos.length} registros`);
      } else {
        calculos = todosCalculos;
      }

      // Carregar voos
      console.log('📥 Carregando Voos...');
      const voosRaw = await base44.asServiceRole.entities.Voo.list();
      voos = normalizeResponse(voosRaw);
      console.log(`✅ Voo: ${voos.length} registros`);

    } catch (e) {
      console.error('❌ Erro geral:', e.message);
      calculos = [];
    }

    // Criar mapas
    const voosMap = new Map(voos.map(v => [v.id, v]));
    const aeroportosMap = new Map(aeroportos.map(a => [a.id, a]));

    // Transformar dados
    const dados = calculos.map(ct => ({
      'Voo': voosMap.get(ct.voo_id)?.numero_voo || ct.voo_id,
      'Aeroporto': aeroportosMap.get(ct.aeroporto_id)?.codigo_icao || ct.aeroporto_id,
      'Data Cálculo': ct.data_calculo?.split('T')[0],
      'Tipo Tarifa': ct.tipo_tarifa,
      'MTOW (kg)': ct.mtow_kg,
      'Taxa Câmbio': ct.taxa_cambio_usd_aoa,
      'Pouso USD': ct.tarifa_pouso_usd != null ? Number(ct.tarifa_pouso_usd).toFixed(2) : null,
      'Pouso AOA': ct.tarifa_pouso != null ? Number(ct.tarifa_pouso).toFixed(2) : null,
      'Permanência USD': ct.tarifa_permanencia_usd != null ? Number(ct.tarifa_permanencia_usd).toFixed(2) : null,
      'Permanência AOA': ct.tarifa_permanencia != null ? Number(ct.tarifa_permanencia).toFixed(2) : null,
      'Passageiros USD': ct.tarifa_passageiros_usd != null ? Number(ct.tarifa_passageiros_usd).toFixed(2) : null,
      'Passageiros AOA': ct.tarifa_passageiros != null ? Number(ct.tarifa_passageiros).toFixed(2) : null,
      'Carga USD': ct.tarifa_carga_usd != null ? Number(ct.tarifa_carga_usd).toFixed(2) : null,
      'Carga AOA': ct.tarifa_carga != null ? Number(ct.tarifa_carga).toFixed(2) : null,
      'Outras Tarifas USD': ct.outras_tarifas_usd != null ? Number(ct.outras_tarifas_usd).toFixed(2) : null,
      'Outras Tarifas AOA': ct.outras_tarifas != null ? Number(ct.outras_tarifas).toFixed(2) : null,
      'Total USD': ct.total_tarifa_usd != null ? Number(ct.total_tarifa_usd).toFixed(2) : null,
      'Total AOA': ct.total_tarifa != null ? Number(ct.total_tarifa).toFixed(2) : null,
      'Impostos USD': ct.total_impostos_usd != null ? Number(ct.total_impostos_usd).toFixed(2) : null,
      'Impostos AOA': ct.total_impostos_aoa != null ? Number(ct.total_impostos_aoa).toFixed(2) : null,
      'Total c/ Impostos USD': ct.total_tarifa_com_impostos_usd != null ? Number(ct.total_tarifa_com_impostos_usd).toFixed(2) : null,
      'Total c/ Impostos AOA': ct.total_tarifa_com_impostos_aoa != null ? Number(ct.total_tarifa_com_impostos_aoa).toFixed(2) : null,
      'Período Noturno': ct.periodo_noturno ? 'Sim' : 'Não',
      'Tempo Permanência (h)': ct.tempo_permanencia_horas
    }));

    console.log(`✅ ${dados.length} registros no XLSX`);

    // Gerar XLSX
    const xlsx = await import('npm:xlsx@0.18.5');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(dados);
    
    ws['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }
    ];
    
    xlsx.utils.book_append_sheet(wb, ws, 'CalculoTarifa');

    const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
    const buffer = new Uint8Array(wbout);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="CalculoTarifa_${aeroporto || 'todos'}_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});