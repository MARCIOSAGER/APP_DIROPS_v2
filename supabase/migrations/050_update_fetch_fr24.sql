-- 050: Update fetch_fr24 to use FlightAware API with full field mapping
-- Field names now match normalizeFlightAwareFlight() for consistency

CREATE OR REPLACE FUNCTION fetch_fr24(p_airport text, p_date_from text, p_date_to text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  api_key text := 'ZM6KDgWxboMqxYJq1z15HJQtVQ2uzdJ3';
  arr_resp http_response;
  dep_resp http_response;
  all_flights jsonb := '[]'::jsonb;
  flight jsonb;
  norm jsonb;
  origin jsonb;
  dest jsonb;
BEGIN
  -- Fetch arrivals
  arr_resp := http((
    'GET',
    'https://aeroapi.flightaware.com/aeroapi/airports/' || p_airport || '/flights/arrivals?max_pages=2&start=' || p_date_from || '&end=' || p_date_to,
    ARRAY[http_header('x-apikey', api_key)],
    NULL, NULL
  )::http_request);

  IF arr_resp.status = 200 THEN
    FOR flight IN SELECT jsonb_array_elements(arr_resp.content::jsonb->'arrivals')
    LOOP
      origin := flight->'origin';
      dest := flight->'destination';
      norm := jsonb_build_object(
        'fr24_id', flight->>'fa_flight_id',
        'flight', COALESCE(flight->>'ident_iata', flight->>'ident'),
        'callsign', flight->>'ident_icao',
        'flight_number', flight->>'flight_number',
        'reg', flight->>'registration',
        'type', flight->>'aircraft_type',
        'operating_as', flight->>'operator_icao',
        'operator_iata', flight->>'operator_iata',
        'movement_type', 'ARR',
        'airport_icao', p_airport,
        'orig_icao', origin->>'code_icao',
        'orig_iata', origin->>'code_iata',
        'orig_name', origin->>'name',
        'orig_city', origin->>'city',
        'dest_icao', dest->>'code_icao',
        'dest_iata', dest->>'code_iata',
        'dest_icao_actual', dest->>'code_icao',
        'dest_iata_actual', dest->>'code_iata',
        'dest_name', dest->>'name',
        'dest_city', dest->>'city',
        'datetime_takeoff', COALESCE(flight->>'actual_off', flight->>'estimated_off'),
        'datetime_landed', COALESCE(flight->>'actual_on', flight->>'estimated_on'),
        'datetime_scheduled_takeoff', flight->>'scheduled_off',
        'datetime_scheduled_landed', flight->>'scheduled_on',
        'datetime_estimated_takeoff', flight->>'estimated_off',
        'datetime_estimated_landed', flight->>'estimated_on',
        'datetime_gate_departure', COALESCE(flight->>'actual_out', flight->>'estimated_out'),
        'datetime_gate_arrival', COALESCE(flight->>'actual_in', flight->>'estimated_in'),
        'departure_delay', flight->'departure_delay',
        'arrival_delay', flight->'arrival_delay',
        'actual_distance', flight->'route_distance',
        'flight_time', flight->>'filed_ete',
        'runway_takeoff', flight->>'actual_runway_off',
        'runway_landed', flight->>'actual_runway_on',
        'gate_origin', flight->>'gate_origin',
        'gate_destination', flight->>'gate_destination',
        'terminal_origin', flight->>'terminal_origin',
        'terminal_destination', flight->>'terminal_destination',
        'baggage_claim', flight->>'baggage_claim',
        'status', flight->>'status',
        'progress_percent', flight->'progress_percent',
        'cancelled', COALESCE((flight->>'cancelled')::boolean, false),
        'diverted', COALESCE((flight->>'diverted')::boolean, false),
        'flight_ended', CASE
          WHEN flight->>'status' ILIKE '%Arrived%' OR (flight->'progress_percent')::int = 100 THEN true
          ELSE false
        END,
        'category', flight->>'type',
        'flight_type', flight->>'type',
        'codeshares', COALESCE(flight->'codeshares', '[]'::jsonb),
        'codeshares_iata', COALESCE(flight->'codeshares_iata', '[]'::jsonb),
        'data_source', 'flightaware'
      );
      all_flights := all_flights || norm;
    END LOOP;
  END IF;

  -- Fetch departures
  dep_resp := http((
    'GET',
    'https://aeroapi.flightaware.com/aeroapi/airports/' || p_airport || '/flights/departures?max_pages=2&start=' || p_date_from || '&end=' || p_date_to,
    ARRAY[http_header('x-apikey', api_key)],
    NULL, NULL
  )::http_request);

  IF dep_resp.status = 200 THEN
    FOR flight IN SELECT jsonb_array_elements(dep_resp.content::jsonb->'departures')
    LOOP
      origin := flight->'origin';
      dest := flight->'destination';
      norm := jsonb_build_object(
        'fr24_id', flight->>'fa_flight_id',
        'flight', COALESCE(flight->>'ident_iata', flight->>'ident'),
        'callsign', flight->>'ident_icao',
        'flight_number', flight->>'flight_number',
        'reg', flight->>'registration',
        'type', flight->>'aircraft_type',
        'operating_as', flight->>'operator_icao',
        'operator_iata', flight->>'operator_iata',
        'movement_type', 'DEP',
        'airport_icao', p_airport,
        'orig_icao', origin->>'code_icao',
        'orig_iata', origin->>'code_iata',
        'orig_name', origin->>'name',
        'orig_city', origin->>'city',
        'dest_icao', dest->>'code_icao',
        'dest_iata', dest->>'code_iata',
        'dest_icao_actual', dest->>'code_icao',
        'dest_iata_actual', dest->>'code_iata',
        'dest_name', dest->>'name',
        'dest_city', dest->>'city',
        'datetime_takeoff', COALESCE(flight->>'actual_off', flight->>'estimated_off'),
        'datetime_landed', COALESCE(flight->>'actual_on', flight->>'estimated_on'),
        'datetime_scheduled_takeoff', flight->>'scheduled_off',
        'datetime_scheduled_landed', flight->>'scheduled_on',
        'datetime_estimated_takeoff', flight->>'estimated_off',
        'datetime_estimated_landed', flight->>'estimated_on',
        'datetime_gate_departure', COALESCE(flight->>'actual_out', flight->>'estimated_out'),
        'datetime_gate_arrival', COALESCE(flight->>'actual_in', flight->>'estimated_in'),
        'departure_delay', flight->'departure_delay',
        'arrival_delay', flight->'arrival_delay',
        'actual_distance', flight->'route_distance',
        'flight_time', flight->>'filed_ete',
        'runway_takeoff', flight->>'actual_runway_off',
        'runway_landed', flight->>'actual_runway_on',
        'gate_origin', flight->>'gate_origin',
        'gate_destination', flight->>'gate_destination',
        'terminal_origin', flight->>'terminal_origin',
        'terminal_destination', flight->>'terminal_destination',
        'baggage_claim', flight->>'baggage_claim',
        'status', flight->>'status',
        'progress_percent', flight->'progress_percent',
        'cancelled', COALESCE((flight->>'cancelled')::boolean, false),
        'diverted', COALESCE((flight->>'diverted')::boolean, false),
        'flight_ended', CASE
          WHEN flight->>'status' ILIKE '%Arrived%' OR (flight->'progress_percent')::int = 100 THEN true
          ELSE false
        END,
        'category', flight->>'type',
        'flight_type', flight->>'type',
        'codeshares', COALESCE(flight->'codeshares', '[]'::jsonb),
        'codeshares_iata', COALESCE(flight->'codeshares_iata', '[]'::jsonb),
        'data_source', 'flightaware'
      );
      all_flights := all_flights || norm;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('data', all_flights);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$fn$;
