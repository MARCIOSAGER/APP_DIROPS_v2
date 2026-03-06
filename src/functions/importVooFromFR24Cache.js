import { supabase } from '@/lib/supabaseClient';

export async function importVooFromFR24Cache({ cacheVooId, suggestions, userSelections }) {
  if (!cacheVooId) throw new Error('cacheVooId é obrigatório');

  const { data: cacheVoo, error } = await supabase
    .from('cache_voo_f_r24')
    .select('*')
    .eq('id', cacheVooId)
    .single();
  if (error || !cacheVoo) throw new Error('Cache voo não encontrado');

  const fr24Data = cacheVoo.raw_data;
  const dtDescolagem = fr24Data.datetime_takeoff ? new Date(fr24Data.datetime_takeoff) : new Date();
  const dataOperacao = dtDescolagem.toISOString().split('T')[0];

  let tipoMovimento = 'DEP';
  if (cacheVoo.airport_icao === (fr24Data.dest_icao || fr24Data.dest_iata)) {
    tipoMovimento = 'ARR';
  }

  // Check for existing flight
  const { data: existingFlights } = await supabase
    .from('voo')
    .select('id')
    .eq('numero_voo', fr24Data.callsign || fr24Data.flight)
    .eq('data_operacao', dataOperacao)
    .eq('tipo_movimento', tipoMovimento)
    .eq('aeroporto_operacao', cacheVoo.airport_icao)
    .limit(1);

  if (existingFlights?.length > 0) {
    return { success: true, vooId: existingFlights[0].id, message: 'Voo já existe no sistema', duplicado: true };
  }

  // Create new flight
  const horarioPrevisto = fr24Data.datetime_scheduled_takeoff
    ? new Date(fr24Data.datetime_scheduled_takeoff).toISOString().substring(11, 16)
    : null;
  const horarioReal = fr24Data.datetime_takeoff
    ? new Date(fr24Data.datetime_takeoff).toISOString().substring(11, 16)
    : null;

  const origemDestino = tipoMovimento === 'ARR'
    ? (fr24Data.orig_icao || fr24Data.orig_iata || '')
    : (fr24Data.dest_icao || fr24Data.dest_iata || '');

  const { data: voo, error: vooError } = await supabase.from('voo').insert({
    numero_voo: fr24Data.callsign || fr24Data.flight || '',
    data_operacao: dataOperacao,
    tipo_movimento: tipoMovimento,
    aeroporto_operacao: cacheVoo.airport_icao,
    aeroporto_origem_destino: origemDestino,
    companhia_aerea: (fr24Data.callsign || fr24Data.flight || '').substring(0, 3),
    registo_aeronave: fr24Data.registration || '',
    horario_previsto: horarioPrevisto,
    horario_real: horarioReal,
    status: 'Realizado',
    tipo_voo: fr24Data.type || 'Regular',
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
