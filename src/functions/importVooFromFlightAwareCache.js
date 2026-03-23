import { supabase } from '@/lib/supabaseClient';

/**
 * Ensure a companhia_aerea record exists for the given codes.
 * Returns the ICAO code used (3 letters).
 */
async function ensureCompanhiaAerea(icaoCode, iataCode) {
  if (!icaoCode && !iataCode) return '';
  const code = icaoCode || iataCode;

  // Try ICAO first, then IATA
  const { data: existing } = await supabase
    .from('companhia_aerea')
    .select('codigo_icao')
    .or(`codigo_icao.eq.${code},codigo_iata.eq.${code}`)
    .limit(1);

  if (existing?.length > 0) return existing[0].codigo_icao || code;

  // Auto-create with available info
  const newRecord = {
    codigo_icao: icaoCode || iataCode,
    codigo_iata: iataCode || '',
    nome: icaoCode || iataCode, // Placeholder name — user can edit later
    status: 'Ativa',
    created_date: new Date().toISOString(),
  };

  const { error } = await supabase.from('companhia_aerea').insert(newRecord);
  if (error) console.warn('Auto-create companhia_aerea failed:', error.message);

  return newRecord.codigo_icao;
}

/**
 * Ensure a registo_aeronave record exists for the given registration.
 * Looks up modelo_aeronave by ICAO type code (e.g. B738, A333).
 * Links to companhia_aerea if found.
 */
async function ensureRegistoAeronave(registration, aircraftType, airlineIcao, empresaId) {
  if (!registration) return;

  const regNorm = registration.replace(/-/g, '').toUpperCase();

  // Check if already exists
  const { data: existing } = await supabase
    .from('registo_aeronave')
    .select('id')
    .eq('registo_normalizado', regNorm)
    .limit(1);

  if (existing?.length > 0) return;

  // Look up modelo_aeronave by ICAO code
  let modeloId = null;
  let mtow = null;
  if (aircraftType) {
    const { data: modelo } = await supabase
      .from('modelo_aeronave')
      .select('id, mtow_kg')
      .eq('codigo_icao', aircraftType)
      .limit(1);
    if (modelo?.length > 0) {
      modeloId = modelo[0].id;
      mtow = modelo[0].mtow_kg;
    }
  }

  // Look up companhia_aerea
  let companhiaId = null;
  if (airlineIcao) {
    const { data: comp } = await supabase
      .from('companhia_aerea')
      .select('id')
      .eq('codigo_icao', airlineIcao)
      .limit(1);
    if (comp?.length > 0) companhiaId = comp[0].id;
  }

  const newRecord = {
    registo: registration,
    registo_normalizado: regNorm,
    id_modelo_aeronave: modeloId,
    id_companhia_aerea: companhiaId,
    mtow_kg: mtow,
    empresa_id: empresaId || null,
    created_date: new Date().toISOString(),
  };

  const { error } = await supabase.from('registo_aeronave').insert(newRecord);
  if (error) console.warn('Auto-create registo_aeronave failed:', error.message);
}

export async function importVooFromFlightAwareCache({ cacheVooId, suggestions, userSelections, empresaId }) {
  if (!cacheVooId) throw new Error('cacheVooId é obrigatório');

  const { data: cacheVoo, error } = await supabase
    .from('cache_voo_f_r24')
    .select('*')
    .eq('id', cacheVooId)
    .single();
  if (error || !cacheVoo) throw new Error('Cache voo não encontrado');

  const flightData = cacheVoo.raw_data;

  // Determine movement type
  let tipoMovimento = 'DEP';
  if (flightData.movement_type) {
    tipoMovimento = flightData.movement_type;
  } else if (cacheVoo.airport_icao === (flightData.dest_icao || flightData.dest_icao_actual || flightData.dest_iata)) {
    tipoMovimento = 'ARR';
  }

  // Date from relevant timestamp
  const dtRelevante = tipoMovimento === 'ARR'
    ? (flightData.datetime_landed || flightData.datetime_scheduled_landed || flightData.datetime_takeoff)
    : (flightData.datetime_takeoff || flightData.datetime_scheduled_takeoff || flightData.datetime_landed);
  const dataOperacao = dtRelevante
    ? new Date(dtRelevante).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const numeroVoo = flightData.flight || flightData.callsign || '';

  // Check for existing flight (duplicate detection)
  const { data: existingFlights } = await supabase
    .from('voo')
    .select('id')
    .eq('numero_voo', numeroVoo)
    .eq('data_operacao', dataOperacao)
    .eq('tipo_movimento', tipoMovimento)
    .eq('aeroporto_operacao', cacheVoo.airport_icao)
    .limit(1);

  if (existingFlights?.length > 0) {
    return { success: true, vooId: existingFlights[0].id, message: 'Voo já existe no sistema', duplicado: true };
  }

  // === Auto-create related records ===

  // Airline ICAO code (3 letters)
  const airlineIcao = flightData.operating_as
    || flightData.operator_iata
    || (flightData.callsign || flightData.flight || '').substring(0, 3);
  const companhiaAerea = await ensureCompanhiaAerea(
    airlineIcao.substring(0, 3),
    flightData.operator_iata || ''
  );

  // Aircraft registration
  if (flightData.reg) {
    await ensureRegistoAeronave(
      flightData.reg,
      flightData.type, // ICAO aircraft type code (e.g. B738)
      companhiaAerea,
      empresaId
    );
  }

  // === Time mapping ===
  const scheduledField = tipoMovimento === 'ARR' ? 'datetime_scheduled_landed' : 'datetime_scheduled_takeoff';
  const actualField = tipoMovimento === 'ARR' ? 'datetime_landed' : 'datetime_takeoff';
  const estimatedField = tipoMovimento === 'ARR' ? 'datetime_estimated_landed' : 'datetime_estimated_takeoff';

  const horarioReal = flightData[actualField]
    ? new Date(flightData[actualField]).toISOString().substring(11, 16)
    : (flightData[estimatedField]
      ? new Date(flightData[estimatedField]).toISOString().substring(11, 16)
      : null);

  const horarioPrevisto = flightData[scheduledField]
    ? new Date(flightData[scheduledField]).toISOString().substring(11, 16)
    : horarioReal;

  // Origin/destination
  const origemDestino = tipoMovimento === 'ARR'
    ? (flightData.orig_icao || flightData.orig_iata || '')
    : (flightData.dest_icao_actual || flightData.dest_icao || flightData.dest_iata || '');

  // Flight status
  let statusVoo = 'Realizado';
  if (flightData.cancelled) statusVoo = 'Cancelado';
  else if (flightData.diverted) statusVoo = 'Desviado';
  else if (flightData.flight_ended) statusVoo = 'Realizado';
  else if (flightData.status?.toLowerCase().includes('en route')) statusVoo = 'Em Voo';
  else if (flightData.status?.toLowerCase().includes('scheduled')) statusVoo = 'Agendado';

  // Flight type
  let tipoVoo = 'Regular';
  if (flightData.flight_type === 'General_Aviation' || flightData.category === 'General_Aviation') {
    tipoVoo = 'Aviação Geral';
  }

  // === Build observacoes with extra FlightAware data ===
  const obsLines = [];
  if (flightData.gate_destination) obsLines.push(`Gate: ${flightData.gate_destination}`);
  if (flightData.gate_origin) obsLines.push(`Gate Origem: ${flightData.gate_origin}`);
  if (flightData.terminal_destination) obsLines.push(`Terminal: ${flightData.terminal_destination}`);
  if (flightData.terminal_origin) obsLines.push(`Terminal Origem: ${flightData.terminal_origin}`);
  if (flightData.runway_landed) obsLines.push(`Pista Aterragem: ${flightData.runway_landed}`);
  if (flightData.runway_takeoff) obsLines.push(`Pista Descolagem: ${flightData.runway_takeoff}`);
  if (flightData.baggage_claim) obsLines.push(`Bagagem: ${flightData.baggage_claim}`);
  if (flightData.codeshares_iata?.length > 0) obsLines.push(`Codeshares: ${flightData.codeshares_iata.join(', ')}`);
  if (flightData.actual_distance) obsLines.push(`Distância: ${flightData.actual_distance} km`);
  if (flightData.departure_delay && flightData.departure_delay !== 0) {
    const delayMin = Math.round(flightData.departure_delay / 60);
    obsLines.push(`Atraso partida: ${delayMin > 0 ? '+' : ''}${delayMin} min`);
  }
  if (flightData.arrival_delay && flightData.arrival_delay !== 0) {
    const delayMin = Math.round(flightData.arrival_delay / 60);
    obsLines.push(`Atraso chegada: ${delayMin > 0 ? '+' : ''}${delayMin} min`);
  }
  const observacoes = obsLines.length > 0 ? obsLines.join(' | ') : null;

  // Gate/stand position mapping
  const posicaoStand = tipoMovimento === 'ARR'
    ? (flightData.gate_destination || '')
    : (flightData.gate_origin || '');

  // === Insert voo ===
  const { data: voo, error: vooError } = await supabase.from('voo').insert({
    numero_voo: numeroVoo,
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
    observacoes,
    posicao_stand: posicaoStand || null,
    origem_dados: 'FlightAware',
    empresa_id: empresaId || null,
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
