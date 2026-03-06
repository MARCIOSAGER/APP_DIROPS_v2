// Client-side dashboard stats computation (replaces Supabase Edge Function)
export async function getDashboardStats({ aeroporto, periodo }) {
  // Import here to avoid circular deps
  const { supabase } = await import('@/lib/supabaseClient');

  const diasPeriodo = parseInt(periodo) || 30;
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasPeriodo);
  const dataInicioStr = dataInicio.toISOString().split('T')[0];

  const hoje = new Date().toISOString().split('T')[0];

  // Fetch data in parallel
  let voosQuery = supabase.from('voo').select('*').gte('data_operacao', dataInicioStr);
  let voosLigadosQuery = supabase.from('voo_ligado').select('*');
  let calculosQuery = supabase.from('calculo_tarifa').select('voo_id,voo_ligado_id,total_tarifa,total_tarifa_usd');
  let ocorrenciasQuery = supabase.from('ocorrencia_safety').select('id,status');
  let inspecoesQuery = supabase.from('inspecao').select('id,status');

  const [voosRes, voosLigadosRes, calculosRes, ocorrenciasRes, inspecoesRes] = await Promise.all([
    voosQuery, voosLigadosQuery, calculosQuery, ocorrenciasQuery, inspecoesQuery
  ]);

  const voos = voosRes.data || [];
  const voosLigados = voosLigadosRes.data || [];
  const calculos = calculosRes.data || [];
  const ocorrencias = ocorrenciasRes.data || [];
  const inspecoes = inspecoesRes.data || [];

  // Filter by aeroporto if specified
  const voosFiltrados = aeroporto && aeroporto !== 'todos'
    ? voos.filter(v => v.aeroporto_operacao === aeroporto)
    : voos;

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

  // Safety & inspections
  const ocorrenciasAbertas = ocorrencias.filter(o => o.status && o.status !== 'Fechada' && o.status !== 'Resolvida').length;
  const inspecoesPendentes = inspecoes.filter(i => i.status === 'Pendente' || i.status === 'Agendada').length;

  // Passengers
  const passageirosPeriodo = voosFiltrados.reduce((sum, v) => sum + (v.passageiros_total || 0), 0);

  // Linked flights
  const vooIds = new Set(voosFiltrados.map(v => v.id));
  const voosLigadosFiltrados = voosLigados.filter(vl => vooIds.has(vl.id_voo_arr) || vooIds.has(vl.id_voo_dep));
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
