import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { tipo, filtros } = await req.json();

    if (!tipo || !['buscar_voos', 'historico_cache'].includes(tipo)) {
      return Response.json({ error: 'Tipo de exportação inválido' }, { status: 400 });
    }

    let dados = [];
    let nomeArquivo = '';

    if (tipo === 'historico_cache') {
      // Exportar dados do histórico de cache
      const cacheVoos = await base44.asServiceRole.entities.CacheVooFR24.list('-data_expiracao', 1000);
      
      // Aplicar filtros
      let voosFiltratos = cacheVoos || [];
      
      if (filtros?.status && filtros.status !== 'todos') {
        voosFiltratos = voosFiltratos.filter(v => v.status === filtros.status);
      }
      
      if (filtros?.busca) {
        const termo = filtros.busca.toLowerCase();
        voosFiltratos = voosFiltratos.filter(v => 
          v.numero_voo?.toLowerCase().includes(termo) ||
          v.fr24_id?.toLowerCase().includes(termo)
        );
      }
      
      if (filtros?.aeroporto) {
        voosFiltratos = voosFiltratos.filter(v => v.airport_icao === filtros.aeroporto);
      }
      
      if (filtros?.dataInicio) {
        voosFiltratos = voosFiltratos.filter(v => v.data_voo >= filtros.dataInicio);
      }
      
      if (filtros?.dataFim) {
        voosFiltratos = voosFiltratos.filter(v => v.data_voo <= filtros.dataFim);
      }

      // Formatar dados para XLSX
      dados = voosFiltratos.map(voo => {
        const rawData = voo.raw_data || {};
        const dataVoo = voo.data_voo ? new Date(voo.data_voo).toLocaleDateString('pt-PT') : '-';
        
        const formatDateTime = (dt) => {
          if (!dt) return '-';
          const date = new Date(dt);
          return `${date.toLocaleDateString('pt-PT')} ${date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
        };

        return {
          'Data Voo': dataVoo,
          'Flight/Callsign': rawData.flight || voo.numero_voo || '-',
          'Callsign': rawData.callsign || '-',
          'Operating As': rawData.operating_as || '-',
          'Tipo': rawData.type || '-',
          'Registo': rawData.reg || '-',
          'Origem ICAO': rawData.orig_icao || '-',
          'Origem IATA': rawData.orig_iata || '-',
          'RWY Decolagem': rawData.runway_takeoff || '-',
          'Data/Hora Decolagem': formatDateTime(rawData.datetime_takeoff),
          'Destino ICAO': rawData.dest_icao || '-',
          'Destino IATA': rawData.dest_iata || '-',
          'Destino Real ICAO': rawData.dest_icao_actual || '-',
          'Destino Real IATA': rawData.dest_iata_actual || '-',
          'RWY Aterragem': rawData.runway_landed || '-',
          'Data/Hora Aterragem': formatDateTime(rawData.datetime_landed),
          'Tempo de Voo (min)': rawData.flight_time ? Math.round(rawData.flight_time / 60) : '-',
          'Distância Real (km)': rawData.actual_distance ? Math.round(rawData.actual_distance) : '-',
          'Distância Círculo (km)': rawData.circle_distance ? Math.round(rawData.circle_distance) : '-',
          'Categoria': rawData.category || '-',
          'Voo Finalizado': rawData.flight_ended ? 'Sim' : 'Não',
          'Status': voo.status || '-',
          'FR24 ID': voo.fr24_id || '-',
          'Aeroporto ICAO': voo.airport_icao || '-',
          'Data Expiração': voo.data_expiracao ? new Date(voo.data_expiracao).toLocaleDateString('pt-PT') : '-'
        };
      });

      nomeArquivo = `historico_cache_fr24_${new Date().toISOString().split('T')[0]}.xlsx`;

    } else if (tipo === 'buscar_voos') {
      // Exportar dados da busca de voos
      const voosFiltrados = filtros?.voos || [];

      dados = voosFiltrados.map(voo => {
        const formatDateTime = (dt) => {
          if (!dt) return '-';
          const date = new Date(dt);
          return `${date.toLocaleDateString('pt-PT')} ${date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
        };

        return {
          'Flight': voo.flight || '-',
          'Callsign': voo.callsign || '-',
          'Operating As': voo.operating_as || '-',
          'Tipo Aeronave': voo.type || '-',
          'Registo': voo.reg || '-',
          'Origem ICAO': voo.orig_icao || '-',
          'Origem IATA': voo.orig_iata || '-',
          'RWY Decolagem': voo.runway_takeoff || '-',
          'Data/Hora Decolagem': formatDateTime(voo.datetime_takeoff),
          'Destino ICAO': voo.dest_icao || '-',
          'Destino IATA': voo.dest_iata || '-',
          'Destino Real ICAO': voo.dest_icao_actual || '-',
          'Destino Real IATA': voo.dest_iata_actual || '-',
          'RWY Aterragem': voo.runway_landed || '-',
          'Data/Hora Aterragem': formatDateTime(voo.datetime_landed),
          'Tempo de Voo (min)': voo.flight_time ? Math.round(voo.flight_time / 60) : '-',
          'Distância Real (km)': voo.actual_distance ? Math.round(voo.actual_distance) : '-',
          'Distância Círculo (km)': voo.circle_distance ? Math.round(voo.circle_distance) : '-',
          'Categoria': voo.category || '-',
          'Voo Finalizado': voo.flight_ended ? 'Sim' : 'Não',
          'FR24 ID': voo.fr24_id || '-'
        };
      });

      nomeArquivo = `buscar_voos_fr24_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    if (dados.length === 0) {
      return Response.json({ error: 'Nenhum dado disponível para exportação' }, { status: 400 });
    }

    // Criar workbook e worksheet
    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados FR24');

    // Ajustar largura das colunas automaticamente
    const colWidths = Object.keys(dados[0]).map(key => {
      const maxLength = Math.max(
        key.length,
        ...dados.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
    worksheet['!cols'] = colWidths;

    // Gerar buffer do arquivo XLSX
    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(xlsxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`
      }
    });

  } catch (error) {
    console.error('❌ Erro ao exportar para XLSX:', error);
    return Response.json(
      { error: 'Erro ao exportar dados', details: error.message },
      { status: 500 }
    );
  }
});