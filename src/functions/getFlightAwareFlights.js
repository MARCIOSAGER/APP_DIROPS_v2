import { supabase } from '@/lib/supabaseClient';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

/**
 * Fetch flights from FlightAware AeroAPI for a given airport and date range.
 * Uses Supabase Edge Function proxy to avoid CORS issues.
 *
 * @param {Object} params
 * @param {string} params.airportIcao - ICAO code (e.g. 'FNBJ')
 * @param {string} [params.startDate] - ISO string or YYYY-MM-DD
 * @param {string} [params.endDate] - ISO string or YYYY-MM-DD
 * @param {string} [params.type] - 'arrivals' | 'departures' | 'all' (default: 'all')
 * @param {number} [params.maxPages] - Max pages to fetch (default: 5)
 * @param {Function} [params.onProgress] - Progress callback
 * @returns {{ success: boolean, flights: Array, stats: Object }}
 */
export async function getFlightAwareFlights({
  airportIcao,
  startDate,
  endDate,
  type = 'all',
  maxPages = 5,
  onProgress,
}) {
  if (!airportIcao) {
    return { success: false, error: 'airportIcao is required' };
  }

  const stats = {
    apiCalls: 0,
    totalArrivals: 0,
    totalDepartures: 0,
    errors: [],
  };

  const allFlights = [];

  // Build query params for FlightAware API
  const queryParams = {};
  if (maxPages) queryParams.max_pages = maxPages.toString();

  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return { success: false, error: 'Invalid startDate format.' };
    }
    queryParams.start = start.toISOString();
  }
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return { success: false, error: 'Invalid endDate format.' };
    }
    if (typeof endDate === 'string' && endDate.length === 10) {
      end.setHours(23, 59, 59, 999);
    }
    queryParams.end = end.toISOString();
  }

  try {
    if (type === 'all' || type === 'arrivals') {
      onProgress?.({ phase: 'arrivals', current: 0, total: 1 });

      const arrivalsData = await fetchViaProxy(
        `/airports/${airportIcao}/flights/arrivals`,
        queryParams,
        stats
      );

      const arrivals = (arrivalsData?.arrivals || []).map((f) =>
        normalizeFlightAwareFlight(f, 'ARR', airportIcao)
      );
      allFlights.push(...arrivals);
      stats.totalArrivals = arrivals.length;

      onProgress?.({ phase: 'arrivals', current: 1, total: 1 });
    }

    if (type === 'all' || type === 'departures') {
      onProgress?.({ phase: 'departures', current: 0, total: 1 });

      const departuresData = await fetchViaProxy(
        `/airports/${airportIcao}/flights/departures`,
        queryParams,
        stats
      );

      const departures = (departuresData?.departures || []).map((f) =>
        normalizeFlightAwareFlight(f, 'DEP', airportIcao)
      );
      allFlights.push(...departures);
      stats.totalDepartures = departures.length;

      onProgress?.({ phase: 'departures', current: 1, total: 1 });
    }
  } catch (err) {
    stats.errors.push(err.message);
    if (allFlights.length === 0) {
      return { success: false, error: err.message, stats };
    }
  }

  // Deduplicate by fa_flight_id
  const deduped = new Map();
  for (const f of allFlights) {
    const key = f.fa_flight_id || `${f.flight}_${f.datetime_takeoff}`;
    if (!deduped.has(key)) {
      deduped.set(key, f);
    }
  }

  const flights = Array.from(deduped.values());

  return {
    success: true,
    flights,
    stats: {
      ...stats,
      totalFlights: flights.length,
    },
  };
}

/**
 * Call FlightAware API through Supabase Edge Function proxy to avoid CORS.
 */
async function fetchViaProxy(endpoint, params, stats) {
  const proxyUrl = `${SUPABASE_URL}/functions/v1/flightaware-proxy`;

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ endpoint, params }),
  });

  stats.apiCalls++;

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let errorMsg;
    try {
      const parsed = JSON.parse(errorBody);
      errorMsg = parsed.error || `FlightAware API error ${response.status}`;
    } catch {
      errorMsg = `FlightAware proxy error ${response.status}: ${errorBody.substring(0, 200)}`;
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();

  // The proxy might return an error in the JSON body
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * Normalize a FlightAware API flight object into our standard format
 * compatible with the existing cache_voo_fr24 / import pipeline.
 */
function normalizeFlightAwareFlight(raw, movementType, airportIcao) {
  const origin = raw.origin || {};
  const dest = raw.destination || {};

  return {
    // Unique ID from FlightAware
    fa_flight_id: raw.fa_flight_id || '',
    // Maps to fr24_id column in cache_voo_f_r24 table
    fr24_id: raw.fa_flight_id || '',

    // Flight identification
    flight: raw.ident || '',
    callsign: raw.atc_ident || raw.ident || '',
    flight_number: raw.flight_number || '',
    reg: raw.registration || '',
    type: (raw.aircraft_type || '').trim(),
    operating_as: raw.operator_icao || raw.operator || '',
    operator_iata: raw.operator_iata || '',
    painted_as: '',

    // Airport info
    orig_icao: origin.code_icao || '',
    orig_iata: origin.code_iata || '',
    orig_name: origin.name || '',
    orig_city: origin.city || '',
    dest_icao: dest.code_icao || '',
    dest_iata: dest.code_iata || '',
    dest_name: dest.name || '',
    dest_city: dest.city || '',
    dest_icao_actual: dest.code_icao || '',
    dest_iata_actual: dest.code_iata || '',

    // Times (FlightAware uses OUT/OFF/ON/IN model, already ISO 8601)
    datetime_takeoff: raw.actual_off || raw.estimated_off || raw.scheduled_off || null,
    datetime_landed: raw.actual_on || raw.estimated_on || raw.scheduled_on || null,
    datetime_scheduled_takeoff: raw.scheduled_off || null,
    datetime_scheduled_landed: raw.scheduled_on || null,
    datetime_estimated_takeoff: raw.estimated_off || null,
    datetime_estimated_landed: raw.estimated_on || null,

    // Gate times (FlightAware exclusive)
    datetime_gate_departure: raw.actual_out || raw.estimated_out || raw.scheduled_out || null,
    datetime_gate_arrival: raw.actual_in || raw.estimated_in || raw.scheduled_in || null,
    scheduled_gate_departure: raw.scheduled_out || null,
    scheduled_gate_arrival: raw.scheduled_in || null,

    // Flight status
    status: raw.status || '',
    progress_percent: raw.progress_percent,
    flight_ended: raw.status === 'Arrived' || raw.progress_percent === 100,
    cancelled: raw.cancelled || false,
    diverted: raw.diverted || false,

    // Flight details
    flight_time: raw.filed_ete || null,
    departure_delay: raw.departure_delay || 0,
    arrival_delay: raw.arrival_delay || 0,
    actual_distance: raw.route_distance || null,
    circle_distance: null,
    runway_takeoff: raw.actual_runway_off || '',
    runway_landed: raw.actual_runway_on || '',

    // Terminal/gate info
    gate_origin: raw.gate_origin || '',
    gate_destination: raw.gate_destination || '',
    terminal_origin: raw.terminal_origin || '',
    terminal_destination: raw.terminal_destination || '',
    baggage_claim: raw.baggage_claim || '',

    // Classification
    category: raw.type || '',
    flight_type: raw.type || '',
    movement_type: movementType,
    airport_icao: airportIcao,

    // Codeshares
    codeshares: raw.codeshares || [],
    codeshares_iata: raw.codeshares_iata || [],

    // Source identifier
    data_source: 'flightaware',

    // Preserve original for raw_data storage
    _raw: raw,
  };
}

/**
 * Fetch flights for FIDS (Flight Information Display System).
 * Returns current/recent arrivals and departures for display.
 */
export async function getFlightAwareFIDS({ airportIcao }) {
  if (!airportIcao) {
    return { success: false, error: 'airportIcao is required' };
  }

  const stats = { apiCalls: 0, errors: [] };

  try {
    const params = { max_pages: '2' };

    // Fetch arrivals and departures in parallel via proxy
    const [arrivalsData, departuresData] = await Promise.all([
      fetchViaProxy(`/airports/${airportIcao}/flights/arrivals`, params, stats),
      fetchViaProxy(`/airports/${airportIcao}/flights/departures`, params, stats),
    ]);

    const arrivals = (arrivalsData?.arrivals || []).map((f) =>
      normalizeFlightAwareFlight(f, 'ARR', airportIcao)
    );
    const departures = (departuresData?.departures || []).map((f) =>
      normalizeFlightAwareFlight(f, 'DEP', airportIcao)
    );

    // Sort by most recent first
    const sortByTime = (a, b) => {
      const timeA = a.movement_type === 'ARR'
        ? (a.datetime_landed || a.datetime_estimated_landed || a.datetime_scheduled_landed)
        : (a.datetime_takeoff || a.datetime_estimated_takeoff || a.datetime_scheduled_takeoff);
      const timeB = b.movement_type === 'ARR'
        ? (b.datetime_landed || b.datetime_estimated_landed || b.datetime_scheduled_landed)
        : (b.datetime_takeoff || b.datetime_estimated_takeoff || b.datetime_scheduled_takeoff);
      return new Date(timeB) - new Date(timeA);
    };

    arrivals.sort(sortByTime);
    departures.sort(sortByTime);

    return {
      success: true,
      arrivals,
      departures,
      stats,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return { success: false, error: err.message, stats };
  }
}

export default getFlightAwareFlights;
