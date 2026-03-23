import { supabase } from '@/lib/supabaseClient';

/**
 * Compare cached FlightAware flights with the voo table to find:
 * - matched: FlightAware flights that match existing voo records
 * - missing_in_ato: FlightAware flights with no corresponding voo record
 * - reg_mismatch: FlightAware flights that match by flight number but have different aircraft registration
 *
 * Match criteria: numero_voo + data_operacao + tipo_movimento
 *
 * @param {Object} params
 * @param {string} [params.airportIcao] - Filter cache by airport ICAO
 * @param {string} [params.startDate] - Filter cache by start date (YYYY-MM-DD)
 * @param {string} [params.endDate] - Filter cache by end date (YYYY-MM-DD)
 * @param {string} [params.empresaId] - Filter voo by empresa_id
 * @returns {{ success: boolean, matched: Array, missing_in_ato: Array, reg_mismatch: Array, stats: Object }}
 */
export async function compareFlightAwareWithVoos({ airportIcao, startDate, endDate, empresaId } = {}) {
  // 1. Fetch cached FlightAware flights
  let cacheQuery = supabase
    .from('cache_voo_f_r24')
    .select('*')
    .eq('status', 'pendente');

  if (airportIcao) {
    cacheQuery = cacheQuery.eq('airport_icao', airportIcao);
  }
  if (startDate) {
    cacheQuery = cacheQuery.gte('data_voo', startDate);
  }
  if (endDate) {
    cacheQuery = cacheQuery.lte('data_voo', endDate);
  }

  cacheQuery = cacheQuery.order('data_voo', { ascending: true });

  const { data: cacheFlights, error: cacheError } = await cacheQuery;
  if (cacheError) {
    return { success: false, error: `Error fetching cache: ${cacheError.message}` };
  }

  if (!cacheFlights || cacheFlights.length === 0) {
    return {
      success: true,
      matched: [],
      missing_in_ato: [],
      reg_mismatch: [],
      stats: { totalCache: 0, totalVoos: 0 },
    };
  }

  // 2. Determine date range from cache data
  const dates = cacheFlights
    .map(f => f.data_voo)
    .filter(Boolean)
    .sort();

  const minDate = dates[0] || startDate;
  const maxDate = dates[dates.length - 1] || endDate;

  // 3. Fetch voo records for the same date range
  let vooQuery = supabase
    .from('voo')
    .select('id, numero_voo, data_operacao, tipo_movimento, registo_aeronave, aeroporto_operacao, status, companhia_aerea, horario_previsto, horario_real')
    .gte('data_operacao', minDate)
    .lte('data_operacao', maxDate)
    .is('deleted_at', null);

  if (airportIcao) {
    vooQuery = vooQuery.eq('aeroporto_operacao', airportIcao);
  }
  if (empresaId) {
    vooQuery = vooQuery.eq('empresa_id', empresaId);
  }

  const { data: voos, error: vooError } = await vooQuery;
  if (vooError) {
    return { success: false, error: `Error fetching voos: ${vooError.message}` };
  }

  // 4. Build lookup index for voo records
  // Key: normalizedFlightNumber|date|movementType
  const vooIndex = new Map();
  for (const voo of (voos || [])) {
    const key = buildVooKey(
      voo.numero_voo,
      voo.data_operacao,
      voo.tipo_movimento
    );
    if (!vooIndex.has(key)) {
      vooIndex.set(key, []);
    }
    vooIndex.get(key).push(voo);
  }

  // 5. Compare each cached flight
  const matched = [];
  const missing_in_ato = [];
  const reg_mismatch = [];

  for (const cacheFlight of cacheFlights) {
    const rawData = cacheFlight.raw_data || {};
    const flightNumber = rawData.callsign || rawData.flight || cacheFlight.numero_voo || '';
    const dataVoo = cacheFlight.data_voo;
    const fr24Reg = normalizeReg(rawData.reg || '');

    // Determine movement type from FlightAware data
    const movementType = deriveMovementType(rawData, cacheFlight.airport_icao);

    // Look up in voo index
    const key = buildVooKey(flightNumber, dataVoo, movementType);
    const matchedVoos = vooIndex.get(key);

    if (matchedVoos && matchedVoos.length > 0) {
      const voo = matchedVoos[0]; // Take first match
      const vooReg = normalizeReg(voo.registo_aeronave || '');

      if (fr24Reg && vooReg && fr24Reg !== vooReg) {
        // Flight exists but registration differs
        reg_mismatch.push({
          cache_id: cacheFlight.id,
          fr24_id: cacheFlight.fr24_id,
          voo_id: voo.id,
          numero_voo: flightNumber,
          data_operacao: dataVoo,
          tipo_movimento: movementType,
          fr24_reg: fr24Reg,
          voo_reg: vooReg,
          fr24_data: rawData,
          voo_data: voo,
        });
      } else {
        // Full match
        matched.push({
          cache_id: cacheFlight.id,
          fr24_id: cacheFlight.fr24_id,
          voo_id: voo.id,
          numero_voo: flightNumber,
          data_operacao: dataVoo,
          tipo_movimento: movementType,
          fr24_reg: fr24Reg,
          voo_reg: vooReg,
        });
      }
    } else {
      // No match found in ATO system
      missing_in_ato.push({
        cache_id: cacheFlight.id,
        fr24_id: cacheFlight.fr24_id,
        numero_voo: flightNumber,
        data_operacao: dataVoo,
        tipo_movimento: movementType,
        reg: fr24Reg,
        orig_icao: rawData.orig_icao || '',
        dest_icao: rawData.dest_icao || '',
        datetime_takeoff: rawData.datetime_takeoff || null,
        datetime_landed: rawData.datetime_landed || null,
        fr24_data: rawData,
      });
    }
  }

  return {
    success: true,
    matched,
    missing_in_ato,
    reg_mismatch,
    stats: {
      totalCache: cacheFlights.length,
      totalVoos: (voos || []).length,
      matchedCount: matched.length,
      missingCount: missing_in_ato.length,
      mismatchCount: reg_mismatch.length,
    },
  };
}

/**
 * Normalize aircraft registration: remove hyphens, uppercase, trim.
 * e.g. "D2-TEE" => "D2TEE", "d2tee" => "D2TEE"
 */
function normalizeReg(reg) {
  if (!reg) return '';
  return reg.replace(/-/g, '').toUpperCase().trim();
}

/**
 * Build a lookup key from flight number, date, and movement type.
 * Normalizes the flight number (uppercase, trimmed).
 */
function buildVooKey(flightNumber, date, movementType) {
  const normalizedFlight = (flightNumber || '').toUpperCase().trim();
  const normalizedDate = (date || '').trim();
  const normalizedMovement = (movementType || '').toUpperCase().trim();
  return `${normalizedFlight}|${normalizedDate}|${normalizedMovement}`;
}

/**
 * Derive movement type (ARR/DEP) from FlightAware data relative to the airport.
 * If the airport is the destination => ARR, if origin => DEP.
 */
function deriveMovementType(rawData, airportIcao) {
  if (rawData.movement_type) {
    return rawData.movement_type.toUpperCase();
  }

  const destIcao = (rawData.dest_icao || rawData.dest_icao_actual || '').toUpperCase();
  const origIcao = (rawData.orig_icao || '').toUpperCase();
  const airport = (airportIcao || '').toUpperCase();

  if (destIcao === airport) return 'ARR';
  if (origIcao === airport) return 'DEP';

  // Fallback: if has landing time and dest matches, it's arrival
  if (rawData.datetime_landed && destIcao) return 'ARR';
  return 'DEP';
}

export default compareFlightAwareWithVoos;
