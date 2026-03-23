import { supabase } from '@/lib/supabaseClient';

export async function importVooFromFR24Cache({ cacheVooId, suggestions, userSelections }) {
  if (!cacheVooId) throw new Error('cacheVooId é obrigatório');

  const { data: cacheVoo, error } = await supabase
    .from('cache_voo_f_r24')
    .select('*')
    .eq('id', cacheVooId)
    .single();
  if (error || !cacheVoo) throw new Error('Cache voo não encontrado');

  const flightData = cacheVoo.raw_data;

  // Determine movement type based on airport match
  let tipoMovimento = 'DEP';
  if (flightData.movement_type) {
    tipoMovimento = flightData.movement_type; // 'ARR' or 'DEP' from normalizer
  } else if (cacheVoo.airport_icao === (flightData.dest_icao || flightData.dest_icao_actual || flightData.dest_iata)) {
    tipoMovimento = 'ARR';
  }

  // Use correct datetime based on movement type for data_operacao
  // ARR: use landing time; DEP: use takeoff time
  const dtRelevante = tipoMovimento === 'ARR'
    ? (flightData.datetime_landed || flightData.datetime_takeoff)
    : (flightData.datetime_takeoff || flightData.datetime_landed);
  const dataOperacao = dtRelevante
    ? new Date(dtRelevante).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  // Check for existing flight
  const { data: existingFlights } = await supabase
    .from('voo')
    .select('id')
    .eq('numero_voo', flightData.flight || flightData.callsign)
    .eq('data_operacao', dataOperacao)
    .eq('tipo_movimento', tipoMovimento)
    .eq('aeroporto_operacao', cacheVoo.airport_icao)
    .limit(1);

  if (existingFlights?.length > 0) {
    return { success: true, vooId: existingFlights[0].id, message: 'Voo já existe no sistema', duplicado: true };
  }

  // Correct times based on movement type:
  // DEP: horario_previsto = STD (scheduled_takeoff), horario_real = ATD (takeoff)
  // ARR: horario_previsto = STA (scheduled_landed), horario_real = ATA (landed)
  const scheduledField = tipoMovimento === 'ARR' ? 'datetime_scheduled_landed' : 'datetime_scheduled_takeoff';
  const actualField = tipoMovimento === 'ARR' ? 'datetime_landed' : 'datetime_takeoff';

  const horarioReal = flightData[actualField]
    ? new Date(flightData[actualField]).toISOString().substring(11, 16)
    : null;
  // If scheduled time exists use it, otherwise repeat the actual time
  const horarioPrevisto = flightData[scheduledField]
    ? new Date(flightData[scheduledField]).toISOString().substring(11, 16)
    : horarioReal;

  const origemDestino = tipoMovimento === 'ARR'
    ? (flightData.orig_icao || flightData.orig_iata || '')
    : (flightData.dest_icao_actual || flightData.dest_icao || flightData.dest_iata || '');

  // Determine flight status
  let statusVoo = 'Realizado';
  if (flightData.cancelled) statusVoo = 'Cancelado';
  else if (flightData.diverted) statusVoo = 'Desviado';
  else if (flightData.flight_ended) statusVoo = 'Realizado';
  else if (flightData.status?.toLowerCase().includes('en route')) statusVoo = 'Em Voo';
  else if (flightData.status?.toLowerCase().includes('scheduled')) statusVoo = 'Agendado';

  // Determine tipo_voo from FlightAware's type field
  let tipoVoo = 'Regular';
  if (flightData.flight_type === 'General_Aviation' || flightData.category === 'General_Aviation') {
    tipoVoo = 'Aviação Geral';
  }

  // Derive companhia_aerea: prefer operator_icao (3-letter ICAO) from FlightAware
  const companhiaAerea = flightData.operating_as
    || flightData.operator_iata
    || (flightData.callsign || flightData.flight || '').substring(0, 3);

  const { data: voo, error: vooError } = await supabase.from('voo').insert({
    numero_voo: flightData.flight || flightData.callsign || '',
    data_operacao: dataOperacao,
    tipo_movimento: tipoMovimento,
    aeroporto_operacao: cacheVoo.airport_icao,
    aeroporto_origem_destino: origemDestino,
    companhia_aerea: companhiaAerea.substring(0, 3),
    registo_aeronave: flightData.reg || '',
    horario_previsto: horarioPrevisto,
    horario_real: horarioReal,
    status: statusVoo,
    tipo_voo: tipoVoo,
    passageiros_total: 0,
    carga_kg: 0,
    created_date: new Date().toISOString(),
  }).select().single();

  if (vooError) throw vooError;

  // Update cache status
  await supabase.from('cache_voo_f_r24').update({
    status: 'importado',
    updated_date: new Date().toISOString(),
  }).eq('id', cacheVooId);

  return { success: true, vooId: voo.id, message: 'Voo importado com sucesso' };
}
