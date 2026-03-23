import { supabase } from '@/lib/supabaseClient';

const FR24_API_BASE = 'https://fr24api.flightradar24.com/api';
const MAX_RESULTS_PER_QUERY = 20; // Explorer plan limit
const RATE_LIMIT_DELAY_MS = 7000; // 10 req/min => ~6s, use 7s for safety
const BLOCK_HOURS = 6; // Split date range into 6h blocks to stay under 20-result limit

/**
 * Fetch flights from Flightradar24 API for a given airport and date range.
 * Splits the range into 6-hour blocks, respects rate limits, and deduplicates.
 *
 * Called via base44.functions.invoke('getFlightradarFlights', params)
 * or directly: getFlightradarFlights({ airportIcao, startDate, endDate, apiKey })
 *
 * @param {Object} params
 * @param {string} params.airportIcao - ICAO code (e.g. 'FNCA')
 * @param {string} params.startDate - ISO string or YYYY-MM-DD (start of range)
 * @param {string} params.endDate - ISO string or YYYY-MM-DD (end of range)
 * @param {string} [params.apiKey] - FR24 API key (Bearer token). If not provided, reads from api_config table.
 * @returns {{ success: boolean, flights: Array, stats: Object }}
 */
export async function getFlightradarFlights({ airportIcao, startDate, endDate, apiKey }) {
  if (!airportIcao) {
    return { success: false, error: 'airportIcao is required' };
  }

  // Resolve API key
  let resolvedKey = apiKey;
  if (!resolvedKey) {
    resolvedKey = await getStoredApiKey();
  }
  if (!resolvedKey) {
    return {
      success: false,
      error: 'FR24 API key not configured. Provide apiKey param or store in api_config table (config_key = "fr24_api_key").'
    };
  }

  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { success: false, error: 'Invalid date format. Use ISO 8601 or YYYY-MM-DD.' };
  }

  // Ensure end is at end-of-day if only date was provided
  if (endDate.length === 10) {
    end.setHours(23, 59, 59, 999);
  }

  // Generate 6h time blocks
  const blocks = generateTimeBlocks(start, end, BLOCK_HOURS);

  const allFlights = new Map(); // fr24_id => flight data (dedup)
  const stats = {
    totalBlocks: blocks.length,
    blocksProcessed: 0,
    apiCalls: 0,
    rateLimitHits: 0,
    creditErrors: 0,
    errors: [],
  };

  for (const block of blocks) {
    try {
      const flights = await fetchFlightsForBlock(
        resolvedKey,
        airportIcao,
        block.start,
        block.end
      );

      stats.apiCalls++;
      stats.blocksProcessed++;

      for (const flight of flights) {
        const key = flight.fr24_id || `${flight.flight}_${flight.datetime_takeoff}`;
        if (!allFlights.has(key)) {
          allFlights.set(key, {
            ...flight,
            airport_icao: airportIcao,
          });
        }
      }

      // Rate limit: wait between requests (except last one)
      if (stats.blocksProcessed < blocks.length) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    } catch (err) {
      stats.blocksProcessed++;

      if (err.status === 429) {
        stats.rateLimitHits++;
        stats.errors.push(`Rate limit hit at block ${stats.blocksProcessed}/${blocks.length}. Waiting 60s...`);
        await sleep(60000); // Wait 1 minute on rate limit
        // Retry this block
        try {
          const flights = await fetchFlightsForBlock(resolvedKey, airportIcao, block.start, block.end);
          stats.apiCalls++;
          for (const flight of flights) {
            const key = flight.fr24_id || `${flight.flight}_${flight.datetime_takeoff}`;
            if (!allFlights.has(key)) {
              allFlights.set(key, { ...flight, airport_icao: airportIcao });
            }
          }
        } catch (retryErr) {
          stats.errors.push(`Retry failed for block ${stats.blocksProcessed}: ${retryErr.message}`);
        }
      } else if (err.status === 402) {
        stats.creditErrors++;
        stats.errors.push('Insufficient API credits (402). Stopping.');
        break; // Stop entirely on credit exhaustion
      } else {
        stats.errors.push(`Block ${stats.blocksProcessed}: ${err.message}`);
      }
    }
  }

  const flights = Array.from(allFlights.values());

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
 * Fetch flights from FR24 API for a single time block.
 * Uses the /flights/list endpoint with airport filter.
 */
async function fetchFlightsForBlock(apiKey, airportIcao, blockStart, blockEnd) {
  // FR24 API expects Unix timestamps in seconds
  const timestampStart = Math.floor(blockStart.getTime() / 1000);
  const timestampEnd = Math.floor(blockEnd.getTime() / 1000);

  // Try both arrivals and departures
  const results = [];

  for (const movementType of ['arrivals', 'departures']) {
    const url = `${FR24_API_BASE}/historic/flights/list?${new URLSearchParams({
      airport: airportIcao,
      type: movementType,
      timestamp_start: timestampStart.toString(),
      timestamp_end: timestampEnd.toString(),
      limit: MAX_RESULTS_PER_QUERY.toString(),
    })}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Accept-Version': 'v1',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const err = new Error(`FR24 API error ${response.status}: ${errorBody}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const flights = data?.data || [];

    for (const f of flights) {
      results.push(normalizeFR24Flight(f, movementType, airportIcao));
    }

    // Rate limit between arrivals/departures calls
    if (movementType === 'arrivals') {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  return results;
}

/**
 * Normalize a raw FR24 API flight object into our standard format.
 */
function normalizeFR24Flight(raw, movementType, airportIcao) {
  return {
    fr24_id: String(raw.fr24_id || raw.id || ''),
    flight: raw.flight || '',
    callsign: raw.callsign || '',
    reg: raw.reg || raw.registration || '',
    type: raw.type || raw.aircraft_type || '',
    operating_as: raw.operating_as || raw.operator || '',
    painted_as: raw.painted_as || '',
    orig_icao: raw.orig_icao || raw.origin?.icao || '',
    orig_iata: raw.orig_iata || raw.origin?.iata || '',
    dest_icao: raw.dest_icao || raw.destination?.icao || '',
    dest_iata: raw.dest_iata || raw.destination?.iata || '',
    dest_icao_actual: raw.dest_icao_actual || '',
    dest_iata_actual: raw.dest_iata_actual || '',
    datetime_takeoff: raw.datetime_takeoff
      ? new Date(raw.datetime_takeoff * 1000).toISOString()
      : null,
    datetime_landed: raw.datetime_landed
      ? new Date(raw.datetime_landed * 1000).toISOString()
      : null,
    datetime_scheduled_takeoff: raw.datetime_scheduled_takeoff
      ? new Date(raw.datetime_scheduled_takeoff * 1000).toISOString()
      : null,
    datetime_scheduled_landed: raw.datetime_scheduled_landed
      ? new Date(raw.datetime_scheduled_landed * 1000).toISOString()
      : null,
    flight_ended: raw.flight_ended ?? false,
    flight_time: raw.flight_time || null,
    actual_distance: raw.actual_distance || null,
    circle_distance: raw.circle_distance || null,
    runway_takeoff: raw.runway_takeoff || '',
    runway_landed: raw.runway_landed || '',
    category: raw.category || '',
    movement_type: movementType === 'arrivals' ? 'ARR' : 'DEP',
    airport_icao: airportIcao,
    // Preserve original for raw_data storage
    _raw: raw,
  };
}

/**
 * Generate time blocks of `blockHours` hours between start and end.
 */
function generateTimeBlocks(start, end, blockHours) {
  const blocks = [];
  let current = new Date(start);

  while (current < end) {
    const blockEnd = new Date(current.getTime() + blockHours * 60 * 60 * 1000);
    blocks.push({
      start: new Date(current),
      end: blockEnd > end ? new Date(end) : blockEnd,
    });
    current = blockEnd;
  }

  return blocks;
}

/**
 * Try to read FR24 API key from a config store in Supabase.
 * Looks in api_config table or falls back to environment variable.
 */
async function getStoredApiKey() {
  // Try VITE env variable first (for development)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FR24_API_KEY) {
    return import.meta.env.VITE_FR24_API_KEY;
  }

  // Try api_config table in Supabase
  try {
    const { data, error } = await supabase
      .from('api_config')
      .select('config_value')
      .eq('config_key', 'fr24_api_key')
      .maybeSingle();

    if (!error && data?.config_value) {
      return data.config_value;
    }
  } catch {
    // Table may not exist yet
  }

  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default getFlightradarFlights;
