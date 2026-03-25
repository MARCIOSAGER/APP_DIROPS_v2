-- 052: sync_flightaware_daily() — fetches yesterday+today for all airports in aeroporto table
-- Called by pg_cron daily at 03:00 UTC (see migration 053)
-- Reuses fetch_fr24() from migration 051 — do NOT modify fetch_fr24
-- Skips flights already imported (status = 'importado')

CREATE OR REPLACE FUNCTION sync_flightaware_daily()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  r                 RECORD;
  airports_processed integer := 0;
  flights_upserted   integer := 0;
  errors             jsonb := '[]'::jsonb;
  date_from_yesterday text;
  date_to_yesterday   text;
  date_from_today     text;
  date_to_today       text;
  result             jsonb;
  flight             jsonb;
  fr24_id_val        text;
  upserted_count     integer;
BEGIN
  -- Build date strings for yesterday and today
  date_from_yesterday := (now() - interval '1 day')::date::text || 'T00:00:00Z';
  date_to_yesterday   := (now() - interval '1 day')::date::text || 'T23:59:59Z';
  date_from_today     := now()::date::text || 'T00:00:00Z';
  date_to_today       := now()::date::text || 'T23:59:59Z';

  FOR r IN
    SELECT codigo_icao FROM aeroporto
    WHERE codigo_icao IS NOT NULL AND codigo_icao != ''
  LOOP
    airports_processed := airports_processed + 1;

    -- Fetch yesterday's flights
    result := fetch_fr24(r.codigo_icao, date_from_yesterday, date_to_yesterday);

    IF result ? 'error' THEN
      RAISE NOTICE 'sync_flightaware_daily: error fetching yesterday for % — %', r.codigo_icao, result->>'error';
      errors := errors || jsonb_build_object('airport', r.codigo_icao, 'date', 'yesterday', 'error', result->>'error');
    ELSE
      FOR flight IN SELECT jsonb_array_elements(result->'data')
      LOOP
        fr24_id_val := flight->>'fr24_id';

        -- Skip entries with null or empty fr24_id
        CONTINUE WHEN fr24_id_val IS NULL OR fr24_id_val = '';

        INSERT INTO cache_voo_f_r24 (
          fr24_id,
          numero_voo,
          airport_icao,
          data_voo,
          data_expiracao,
          status,
          raw_data,
          updated_date,
          created_date
        )
        VALUES (
          fr24_id_val,
          COALESCE(flight->>'flight', ''),
          flight->>'airport_icao',
          COALESCE(
            NULLIF(flight->>'datetime_landed', ''),
            NULLIF(flight->>'datetime_takeoff', ''),
            now()::text
          )::date,
          (now() + interval '30 days')::date,
          'pendente',
          flight,
          now(),
          now()
        )
        ON CONFLICT (fr24_id) DO UPDATE SET
          raw_data    = EXCLUDED.raw_data,
          numero_voo  = EXCLUDED.numero_voo,
          data_voo    = EXCLUDED.data_voo,
          updated_date = now()
        WHERE cache_voo_f_r24.status != 'importado';

        GET DIAGNOSTICS upserted_count = ROW_COUNT;
        flights_upserted := flights_upserted + upserted_count;
      END LOOP;
    END IF;

    -- Fetch today's flights
    result := fetch_fr24(r.codigo_icao, date_from_today, date_to_today);

    IF result ? 'error' THEN
      RAISE NOTICE 'sync_flightaware_daily: error fetching today for % — %', r.codigo_icao, result->>'error';
      errors := errors || jsonb_build_object('airport', r.codigo_icao, 'date', 'today', 'error', result->>'error');
    ELSE
      FOR flight IN SELECT jsonb_array_elements(result->'data')
      LOOP
        fr24_id_val := flight->>'fr24_id';

        -- Skip entries with null or empty fr24_id
        CONTINUE WHEN fr24_id_val IS NULL OR fr24_id_val = '';

        INSERT INTO cache_voo_f_r24 (
          fr24_id,
          numero_voo,
          airport_icao,
          data_voo,
          data_expiracao,
          status,
          raw_data,
          updated_date,
          created_date
        )
        VALUES (
          fr24_id_val,
          COALESCE(flight->>'flight', ''),
          flight->>'airport_icao',
          COALESCE(
            NULLIF(flight->>'datetime_landed', ''),
            NULLIF(flight->>'datetime_takeoff', ''),
            now()::text
          )::date,
          (now() + interval '30 days')::date,
          'pendente',
          flight,
          now(),
          now()
        )
        ON CONFLICT (fr24_id) DO UPDATE SET
          raw_data    = EXCLUDED.raw_data,
          numero_voo  = EXCLUDED.numero_voo,
          data_voo    = EXCLUDED.data_voo,
          updated_date = now()
        WHERE cache_voo_f_r24.status != 'importado';

        GET DIAGNOSTICS upserted_count = ROW_COUNT;
        flights_upserted := flights_upserted + upserted_count;
      END LOOP;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'airports_processed', airports_processed,
    'flights_upserted',   flights_upserted,
    'errors',             errors
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'airports_processed', airports_processed,
      'flights_upserted',   flights_upserted,
      'errors',             errors || jsonb_build_object('fatal', SQLERRM)
    );
END;
$fn$;
