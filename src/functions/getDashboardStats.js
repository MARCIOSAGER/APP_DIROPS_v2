// Client-side dashboard stats computation (replaces Supabase Edge Function)

const PAGE_SIZE = 1000;

async function fetchAllRows(queryBuilder) {
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryBuilder.range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error('[getDashboardStats] Query error:', error);
      throw error;
    }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allData;
}

export async function getDashboardStats({ aeroporto, periodo, empresaId }) {
  const { supabase } = await import('@/lib/supabaseClient');

  const diasPeriodo = parseInt(periodo) || 30;
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasPeriodo);
  const dataInicioStr = dataInicio.toISOString().split('T')[0];

  const hoje = new Date().toISOString().split('T')[0];

  // If empresaId is set, get the empresa's aeroportos to filter voos by ICAO
  // This is more reliable than voo.empresa_id which may not be set on all records
  let empresaIcaos = null;
  if (empresaId) {
    const { data: aeroportos, error: aeroErr } = await supabase
      .from('aeroporto')
      .select('codigo_icao')
      .eq('empresa_id', empresaId);
    if (aeroErr) {
      console.error('[getDashboardStats] Error fetching aeroportos:', aeroErr);
    } else {
      empresaIcaos = new Set((aeroportos || []).map(a => a.codigo_icao));
    }
  }

  // Fetch data with pagination
  const [voos, voosLigados, calculos, ocorrencias, inspecoes] = await Promise.all([
    fetchAllRows(supabase.from('voo').select('*').gte('data_operacao', dataInicioStr)),
    fetchAllRows(supabase.from('voo_ligado').select('*')),
    fetchAllRows(supabase.from('calculo_tarifa').select('voo_id,voo_ligado_id,total_tarifa,total_tarifa_usd')),
    fetchAllRows(supabase.from('ocorrencia_safety').select('id,status,aeroporto,empresa_id')),
    fetchAllRows(supabase.from('inspecao').select('id,status,aeroporto_id,empresa_id')),
  ]);

  // Filter voos by empresa (via aeroporto ICAO relationship)
  let voosFiltrados = voos;
  if (empresaIcaos) {
    voosFiltrados = voos.filter(v => empresaIcaos.has(v.aeroporto_operacao));
  }

  // Then filter by selected aeroporto dropdown
  if (aeroporto && aeroporto !== 'todos') {
    voosFiltrados = voosFiltrados.filter(v => v.aeroporto_operacao === aeroporto);
  }

  // Basic stats
  const totalVoos = voosFiltrados.length;

  const voosHoje = voosFiltrados.filter(v => v.data_operacao === hoje);
  const chegadasHoje = voosHoje.filter(v => v.tipo_movimento === 'ARR').length;
  const partidasHoje = voosHoje.filter(v => v.tipo_movimento === 'DEP').length;

  // Punctuality
  const voosComHorarios = voosFiltrados.filter(v => v.horario_previsto && v.horario_real && v.status === 'Realizado');
  let pontuais = 0;
  voosComHorarios.forEach(v => {
    const [ph, pm] = v.horario_previsto.split(':').map(Number);
    const [rh, rm] = v.horario_real.split(':').map(Number);
    const diffMin = Math.abs((rh * 60 + rm) - (ph * 60 + pm));
    if (diffMin <= 15) pontuais++;
  });
  const taxaPontualidade = voosComHorarios.length > 0 ? (pontuais / voosComHorarios.length) * 100 : 0;

  // Safety & inspections - filter by empresa
  let ocorrenciasFiltradas = ocorrencias;
  let inspecoesFiltradas = inspecoes;
  if (empresaId) {
    // Filter by empresa_id if set, OR by aeroporto ICAO if empresa_id is missing
    ocorrenciasFiltradas = ocorrencias.filter(o =>
      o.empresa_id === empresaId || (empresaIcaos && empresaIcaos.has(o.aeroporto))
    );
    // For inspecoes, get aeroporto IDs for the empresa
    const { data: aeroFull } = await supabase
      .from('aeroporto')
      .select('id')
      .eq('empresa_id', empresaId);
    const empresaAeroIds = new Set((aeroFull || []).map(a => a.id));
    inspecoesFiltradas = inspecoes.filter(i =>
      i.empresa_id === empresaId || empresaAeroIds.has(i.aeroporto_id)
    );
  }
  const ocorrenciasAbertas = ocorrenciasFiltradas.filter(o => o.status && o.status !== 'Fechada' && o.status !== 'Resolvida').length;
  const inspecoesPendentes = inspecoesFiltradas.filter(i => i.status === 'Pendente' || i.status === 'Agendada').length;

  // Passengers
  const passageirosPeriodo = voosFiltrados.reduce((sum, v) => sum + (v.passageiros_total || 0), 0);

  // Linked flights
  const vooIds = new Set(voosFiltrados.map(v => v.id));
  const voosLigadosFiltrados = empresaId
    ? voosLigados.filter(vl => vl.empresa_id === empresaId || vooIds.has(vl.id_voo_arr) || vooIds.has(vl.id_voo_dep))
    : voosLigados.filter(vl => vooIds.has(vl.id_voo_arr) || vooIds.has(vl.id_voo_dep));
  const voosComLink = new Set();
  voosLigadosFiltrados.forEach(vl => {
    voosComLink.add(vl.id_voo_arr);
    voosComLink.add(vl.id_voo_dep);
  });
  const voosUnicosLigados = voosComLink.size;
  const voosSemLink = totalVoos - voosUnicosLigados;

  // Average stay time
  const temposValidos = voosLigadosFiltrados.filter(vl => vl.tempo_permanencia_min > 0);
  const tempoMedioPermanencia = temposValidos.length > 0
    ? temposValidos.reduce((sum, vl) => sum + vl.tempo_permanencia_min, 0) / temposValidos.length / 60
    : 0;

  // Tariffs
  const calculosComVoo = calculos.filter(c => vooIds.has(c.voo_id));
  const totalTarifas = calculosComVoo.reduce((sum, c) => sum + (c.total_tarifa || 0), 0);
  const vooIdsComCalculo = new Set(calculosComVoo.map(c => c.voo_id));
  const voosSemCalculo = voosFiltrados.filter(v => !vooIdsComCalculo.has(v.id)).length;
  const voosIsentos = calculosComVoo.filter(c => (c.total_tarifa || 0) === 0).length;

  // Top 10 airports
  const statsPorAeroporto = {};
  voosFiltrados.forEach(v => {
    const icao = v.aeroporto_operacao;
    if (!icao) return;
    if (!statsPorAeroporto[icao]) {
      statsPorAeroporto[icao] = {
        codigo_icao: icao, codigo: icao, totalMovimentos: 0,
        movimentosArr: 0, movimentosDep: 0,
        passageiros: 0, passageirosArr: 0, passageirosDep: 0,
        carga: 0, cargaArr: 0, cargaDep: 0,
      };
    }
    const s = statsPorAeroporto[icao];
    s.totalMovimentos++;
    if (v.tipo_movimento === 'ARR') {
      s.movimentosArr++;
      s.passageirosArr += v.passageiros_total || 0;
      s.cargaArr += v.carga_kg || 0;
    } else {
      s.movimentosDep++;
      s.passageirosDep += v.passageiros_total || 0;
      s.cargaDep += v.carga_kg || 0;
    }
    s.passageiros += v.passageiros_total || 0;
    s.carga += v.carga_kg || 0;
  });
  const top10Aeroportos = Object.values(statsPorAeroporto)
    .sort((a, b) => b.totalMovimentos - a.totalMovimentos)
    .slice(0, 10);

  return {
    data: {
      totalVoos,
      chegadasHoje,
      partidasHoje,
      taxaPontualidade,
      ocorrenciasAbertas,
      inspecoesPendentes,
      passageirosPeriodo,
      voosUnicosLigados,
      voosSemLink,
      voosLigados: voosLigadosFiltrados.length,
      tempoMedioPermanencia,
      totalTarifas,
      voosSemCalculo,
      voosIsentos,
      top10Aeroportos,
    },
  };
}
