import { supabase } from '@/lib/supabaseClient';

export async function validateAndSuggestFlightAwareCrossCheck({ cacheVooId }) {
  if (!cacheVooId) throw new Error('cacheVooId é obrigatório');

  const { data: cacheVoo, error } = await supabase
    .from('cache_voo_f_r24')
    .select('*')
    .eq('id', cacheVooId)
    .single();
  if (error || !cacheVoo) throw new Error('Cache voo não encontrado');

  const fr24Data = cacheVoo.raw_data || {};

  // Look up existing airports
  const icaoCodes = [fr24Data.orig_icao, fr24Data.dest_icao, cacheVoo.airport_icao].filter(Boolean);
  const { data: aeroportos } = await supabase.from('aeroporto').select('*').in('codigo_icao', icaoCodes);

  // Look up airline
  const airlineCode = (fr24Data.callsign || fr24Data.flight || '').substring(0, 3);
  const { data: companhias } = await supabase.from('companhia_aerea').select('*').eq('codigo_icao', airlineCode);

  // Look up aircraft
  const { data: aeronaves } = await supabase.from('registo_aeronave').select('*').eq('matricula', fr24Data.registration || '');

  return {
    success: true,
    suggestions: {
      aeroportos: aeroportos || [],
      companhia: companhias?.[0] || null,
      aeronave: aeronaves?.[0] || null,
      airlineCode,
      registration: fr24Data.registration,
    },
    cacheVoo,
  };
}
