-- Updated sync_fr24_registos: now also creates missing models and airports
CREATE OR REPLACE FUNCTION sync_fr24_registos(p_empresa_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_companhias_created INT := 0;
  v_registos_created INT := 0;
  v_registos_updated INT := 0;
  v_aeroportos_created INT := 0;
  v_modelos_created INT := 0;
BEGIN
  -- Step 1: Create missing companhias
  INSERT INTO companhia_aerea (id, nome, codigo_icao, created_by, created_date, updated_date)
  SELECT gen_random_uuid(), sq.airline_code, sq.airline_code, 'FR24-Sync', NOW(), NOW()
  FROM (SELECT DISTINCT raw_data->>'operating_as' as airline_code
        FROM cache_voo_f_r24
        WHERE raw_data->>'operating_as' IS NOT NULL AND raw_data->>'operating_as' <> '') sq
  WHERE NOT EXISTS (SELECT 1 FROM companhia_aerea ca WHERE ca.codigo_icao = sq.airline_code)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_companhias_created = ROW_COUNT;

  -- Step 2: Create missing aircraft models
  INSERT INTO modelo_aeronave (id, modelo, codigo_icao, created_date, updated_date)
  SELECT gen_random_uuid(), sq.type_code, sq.type_code, NOW(), NOW()
  FROM (SELECT DISTINCT raw_data->>'type' as type_code
        FROM cache_voo_f_r24
        WHERE raw_data->>'type' IS NOT NULL AND raw_data->>'type' <> '') sq
  WHERE NOT EXISTS (SELECT 1 FROM modelo_aeronave ma WHERE ma.codigo_icao = sq.type_code OR ma.ac_code = sq.type_code)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_modelos_created = ROW_COUNT;

  -- Step 3: Create missing airports
  WITH fr24_airports AS (
    SELECT DISTINCT raw_data->>'orig_icao' as icao FROM cache_voo_f_r24 WHERE raw_data->>'orig_icao' IS NOT NULL
    UNION
    SELECT DISTINCT raw_data->>'dest_icao_actual' FROM cache_voo_f_r24 WHERE raw_data->>'dest_icao_actual' IS NOT NULL
  )
  INSERT INTO aeroporto (id, codigo_icao, nome, created_date, updated_date)
  SELECT gen_random_uuid(), fa.icao, fa.icao, NOW(), NOW()
  FROM fr24_airports fa
  WHERE fa.icao IS NOT NULL AND fa.icao <> ''
    AND NOT EXISTS (SELECT 1 FROM aeroporto a WHERE a.codigo_icao = fa.icao)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_aeroportos_created = ROW_COUNT;

  -- Step 4: Create missing aircraft registrations
  INSERT INTO registo_aeronave (id, registo, registo_normalizado, id_modelo_aeronave, id_companhia_aerea, empresa_id, created_by, created_date, updated_date)
  SELECT gen_random_uuid(),
    sq.reg_norm, sq.reg_norm,
    (SELECT ma.id FROM modelo_aeronave ma WHERE ma.codigo_icao = sq.tipo OR ma.ac_code = sq.tipo LIMIT 1),
    (SELECT ca.id FROM companhia_aerea ca WHERE ca.codigo_icao = sq.airline LIMIT 1),
    p_empresa_id, 'FR24-Sync', NOW(), NOW()
  FROM (SELECT DISTINCT
          UPPER(REPLACE(raw_data->>'reg', '-', '')) as reg_norm,
          raw_data->>'type' as tipo,
          raw_data->>'operating_as' as airline
        FROM cache_voo_f_r24
        WHERE raw_data->>'reg' IS NOT NULL AND raw_data->>'reg' <> '') sq
  WHERE NOT EXISTS (SELECT 1 FROM registo_aeronave ra WHERE ra.registo = sq.reg_norm OR ra.registo_normalizado = sq.reg_norm)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_registos_created = ROW_COUNT;

  -- Step 5: Update existing registos missing modelo or companhia
  WITH fr24_info AS (
    SELECT DISTINCT ON (UPPER(REPLACE(raw_data->>'reg', '-', '')))
      UPPER(REPLACE(raw_data->>'reg', '-', '')) as reg_norm,
      raw_data->>'type' as tipo,
      raw_data->>'operating_as' as airline
    FROM cache_voo_f_r24
    WHERE raw_data->>'reg' IS NOT NULL
    ORDER BY UPPER(REPLACE(raw_data->>'reg', '-', '')), created_date DESC
  )
  UPDATE registo_aeronave ra SET
    id_modelo_aeronave = COALESCE(ra.id_modelo_aeronave, (SELECT ma.id FROM modelo_aeronave ma WHERE ma.codigo_icao = fi.tipo OR ma.ac_code = fi.tipo LIMIT 1)),
    id_companhia_aerea = COALESCE(ra.id_companhia_aerea, (SELECT ca.id FROM companhia_aerea ca WHERE ca.codigo_icao = fi.airline LIMIT 1)),
    updated_date = NOW()
  FROM fr24_info fi
  WHERE (ra.registo = fi.reg_norm OR ra.registo_normalizado = fi.reg_norm)
    AND (ra.id_modelo_aeronave IS NULL OR ra.id_companhia_aerea IS NULL);
  GET DIAGNOSTICS v_registos_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'companhias_created', v_companhias_created,
    'modelos_created', v_modelos_created,
    'aeroportos_created', v_aeroportos_created,
    'registos_created', v_registos_created,
    'registos_updated', v_registos_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sync_fr24_registos TO authenticated;
