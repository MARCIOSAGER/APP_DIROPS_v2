-- 043: RPC to auto-create/update aircraft registrations and airlines from FR24 cache data
-- Creates missing registo_aeronave and companhia_aerea records
-- Updates existing registos that have NULL modelo or companhia

CREATE OR REPLACE FUNCTION sync_fr24_registos(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registos_created INT := 0;
  v_companhias_created INT := 0;
  v_registos_updated INT := 0;
  rec RECORD;
  v_modelo_id UUID;
  v_companhia_id UUID;
  v_mtow NUMERIC;
  v_existing_id UUID;
BEGIN
  -- ═══════════════════════════════════════════════════════════
  -- STEP 1: Create missing companhias from FR24 operating_as
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO companhia_aerea (nome, codigo_icao, created_by, created_date, updated_date)
  SELECT DISTINCT
    fr24.operating_as,
    fr24.operating_as,
    'FR24-Sync',
    NOW(),
    NOW()
  FROM (
    SELECT DISTINCT upper(trim(raw_data->>'operating_as')) AS operating_as
    FROM cache_voo_f_r24
    WHERE raw_data->>'operating_as' IS NOT NULL
      AND trim(raw_data->>'operating_as') <> ''
  ) fr24
  WHERE NOT EXISTS (
    SELECT 1 FROM companhia_aerea ca
    WHERE upper(ca.codigo_icao) = fr24.operating_as
  );

  GET DIAGNOSTICS v_companhias_created = ROW_COUNT;

  -- ═══════════════════════════════════════════════════════════
  -- STEP 2: Create missing registo_aeronave from FR24 reg
  -- ═══════════════════════════════════════════════════════════
  FOR rec IN
    SELECT DISTINCT
      upper(replace(trim(raw_data->>'reg'), '-', '')) AS reg_normalizado,
      upper(trim(raw_data->>'type')) AS ac_type,
      upper(trim(raw_data->>'operating_as')) AS operating_as
    FROM cache_voo_f_r24
    WHERE raw_data->>'reg' IS NOT NULL
      AND trim(raw_data->>'reg') <> ''
      AND upper(replace(trim(raw_data->>'reg'), '-', '')) NOT IN (
        SELECT registo_normalizado FROM registo_aeronave
        WHERE registo_normalizado IS NOT NULL
      )
  LOOP
    -- Look up modelo by ICAO code or ac_code
    v_modelo_id := NULL;
    v_mtow := NULL;
    IF rec.ac_type IS NOT NULL AND rec.ac_type <> '' THEN
      SELECT id, mtow_kg INTO v_modelo_id, v_mtow
      FROM modelo_aeronave
      WHERE upper(codigo_icao) = rec.ac_type
         OR upper(ac_code) = rec.ac_type
      LIMIT 1;
    END IF;

    -- Look up companhia by ICAO code
    v_companhia_id := NULL;
    IF rec.operating_as IS NOT NULL AND rec.operating_as <> '' THEN
      SELECT id INTO v_companhia_id
      FROM companhia_aerea
      WHERE upper(codigo_icao) = rec.operating_as
      LIMIT 1;
    END IF;

    -- Insert new registration
    INSERT INTO registo_aeronave (
      registo, registo_normalizado, id_modelo_aeronave, id_companhia_aerea,
      mtow_kg, empresa_id, created_by, created_date, updated_date
    ) VALUES (
      rec.reg_normalizado, rec.reg_normalizado, v_modelo_id, v_companhia_id,
      v_mtow, p_empresa_id, 'FR24-Sync', NOW(), NOW()
    );

    v_registos_created := v_registos_created + 1;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════
  -- STEP 3: Update existing registos with NULL modelo or companhia
  -- ═══════════════════════════════════════════════════════════
  FOR rec IN
    SELECT
      ra.id AS registo_id,
      ra.registo_normalizado,
      ra.id_modelo_aeronave,
      ra.id_companhia_aerea,
      fr24.ac_type,
      fr24.operating_as
    FROM registo_aeronave ra
    INNER JOIN (
      SELECT DISTINCT
        upper(replace(trim(raw_data->>'reg'), '-', '')) AS reg_normalizado,
        upper(trim(raw_data->>'type')) AS ac_type,
        upper(trim(raw_data->>'operating_as')) AS operating_as
      FROM cache_voo_f_r24
      WHERE raw_data->>'reg' IS NOT NULL
        AND trim(raw_data->>'reg') <> ''
    ) fr24 ON fr24.reg_normalizado = ra.registo_normalizado
    WHERE ra.id_modelo_aeronave IS NULL
       OR ra.id_companhia_aerea IS NULL
  LOOP
    v_modelo_id := rec.id_modelo_aeronave;
    v_companhia_id := rec.id_companhia_aerea;
    v_mtow := NULL;

    -- Fill modelo if missing
    IF v_modelo_id IS NULL AND rec.ac_type IS NOT NULL AND rec.ac_type <> '' THEN
      SELECT id, mtow_kg INTO v_modelo_id, v_mtow
      FROM modelo_aeronave
      WHERE upper(codigo_icao) = rec.ac_type
         OR upper(ac_code) = rec.ac_type
      LIMIT 1;
    END IF;

    -- Fill companhia if missing
    IF v_companhia_id IS NULL AND rec.operating_as IS NOT NULL AND rec.operating_as <> '' THEN
      SELECT id INTO v_companhia_id
      FROM companhia_aerea
      WHERE upper(codigo_icao) = rec.operating_as
      LIMIT 1;
    END IF;

    -- Only update if something changed
    IF v_modelo_id IS DISTINCT FROM rec.id_modelo_aeronave
       OR v_companhia_id IS DISTINCT FROM rec.id_companhia_aerea THEN
      UPDATE registo_aeronave
      SET id_modelo_aeronave = COALESCE(v_modelo_id, id_modelo_aeronave),
          id_companhia_aerea = COALESCE(v_companhia_id, id_companhia_aerea),
          mtow_kg = COALESCE(v_mtow, mtow_kg),
          updated_date = NOW()
      WHERE id = rec.registo_id;

      v_registos_updated := v_registos_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'registos_created', v_registos_created,
    'companhias_created', v_companhias_created,
    'registos_updated', v_registos_updated
  );
END;
$$;
