import { supabase } from '@/lib/supabaseClient';

/**
 * Upsert FlightAware flight data into the cache_voo_f_r24 table.
 * Deduplicates by fr24_id using Supabase upsert.
 *
 * @param {Object} params
 * @param {Array} params.flights - Array of normalized FlightAware flight objects
 * @param {string} [params.empresaId] - Optional empresa_id to tag records
 * @param {number} [params.cacheDays=30] - Number of days before cache expires
 * @returns {{ success: boolean, inserted: number, updated: number, skipped: number, errors: string[] }}
 */
export async function syncFlightAwareToCache({ flights, empresaId, cacheDays = 30 }) {
  if (!flights || !Array.isArray(flights) || flights.length === 0) {
    return { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };
  }

  const errors = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Calculate expiration date
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + cacheDays);
  const dataExpiracao = expirationDate.toISOString().split('T')[0];

  // Check which fr24_ids already exist
  const fr24Ids = flights
    .map(f => f.fr24_id)
    .filter(Boolean);

  const existingMap = new Map(); // fr24_id => { id, status }
  if (fr24Ids.length > 0) {
    // Fetch in batches of 100 to avoid query limits
    for (let i = 0; i < fr24Ids.length; i += 100) {
      const batch = fr24Ids.slice(i, i + 100);
      const { data: existing, error } = await supabase
        .from('cache_voo_f_r24')
        .select('id, fr24_id, status')
        .in('fr24_id', batch);

      if (error) {
        errors.push(`Error fetching existing records: ${error.message}`);
      } else if (existing) {
        for (const row of existing) {
          existingMap.set(row.fr24_id, { id: row.id, status: row.status });
        }
      }
    }
  }

  // Prepare records for upsert
  const toInsert = [];
  const toUpdate = [];

  for (const flight of flights) {
    if (!flight.fr24_id) {
      skipped++;
      continue;
    }

    // Derive data_voo from takeoff or landing time
    const dataVoo = deriveDataVoo(flight);

    // Build raw_data (exclude internal _raw wrapper, flatten)
    const rawData = { ...flight };
    delete rawData._raw;
    // Also store the original API response if available
    if (flight._raw) {
      rawData._original = flight._raw;
    }

    const record = {
      fr24_id: flight.fr24_id,
      numero_voo: flight.callsign || flight.flight || '',
      airport_icao: flight.airport_icao || '',
      data_voo: dataVoo,
      data_expiracao: dataExpiracao,
      status: 'pendente',
      raw_data: rawData,
      updated_date: new Date().toISOString(),
    };

    if (existingMap.has(flight.fr24_id)) {
      const existing = existingMap.get(flight.fr24_id);
      // Don't overwrite status of already-imported records
      if (existing.status === 'importado') {
        skipped++;
        continue;
      }
      toUpdate.push({
        id: existing.id,
        ...record,
      });
    } else {
      // Insert new
      toInsert.push({
        ...record,
        created_date: new Date().toISOString(),
      });
    }
  }

  // Batch insert new records
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error } = await supabase
        .from('cache_voo_f_r24')
        .insert(batch);

      if (error) {
        errors.push(`Insert batch error: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }
  }

  // Batch update existing records
  if (toUpdate.length > 0) {
    for (const record of toUpdate) {
      const { id, ...changes } = record;
      const { error } = await supabase
        .from('cache_voo_f_r24')
        .update(changes)
        .eq('id', id);

      if (error) {
        errors.push(`Update error for ${record.fr24_id}: ${error.message}`);
      } else {
        updated++;
      }
    }
  }

  return {
    success: errors.length === 0,
    inserted,
    updated,
    skipped,
    total: flights.length,
    errors,
  };
}

/**
 * Derive the operation date from flight timestamps.
 * Prefers takeoff time, falls back to landing time.
 */
function deriveDataVoo(flight) {
  const timestamp = flight.datetime_takeoff || flight.datetime_landed;
  if (!timestamp) {
    return new Date().toISOString().split('T')[0];
  }

  try {
    const dt = new Date(timestamp);
    if (isNaN(dt.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    return dt.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export default syncFlightAwareToCache;
