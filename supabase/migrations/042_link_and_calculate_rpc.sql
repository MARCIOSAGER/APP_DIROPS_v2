CREATE OR REPLACE FUNCTION link_and_calculate_pending(p_empresa_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_linked INT := 0;
  v_calculated INT := 0;
BEGIN
  -- Link unlinked voos by same registo (up to 7 days)
  WITH matches AS (
    SELECT DISTINCT ON (v_arr.id)
      v_arr.id as arr_id, v_dep.id as dep_id,
      (v_dep.data_operacao::date - v_arr.data_operacao::date) * 1440 as tempo_min
    FROM voo v_arr
    JOIN voo v_dep ON v_dep.empresa_id = v_arr.empresa_id
      AND v_dep.tipo_movimento = 'DEP'
      AND v_dep.deleted_at IS NULL
      AND UPPER(REPLACE(COALESCE(v_dep.registo_aeronave,''), '-', ''))
        = UPPER(REPLACE(COALESCE(v_arr.registo_aeronave,''), '-', ''))
      AND v_dep.data_operacao >= v_arr.data_operacao
      AND v_dep.data_operacao <= (v_arr.data_operacao::date + 7)::text
      AND NOT EXISTS (SELECT 1 FROM voo_ligado vl WHERE vl.id_voo_dep = v_dep.id)
    WHERE v_arr.tipo_movimento = 'ARR'
      AND v_arr.deleted_at IS NULL
      AND v_arr.empresa_id = p_empresa_id
      AND NOT EXISTS (SELECT 1 FROM voo_ligado vl WHERE vl.id_voo_arr = v_arr.id)
      AND v_arr.registo_aeronave IS NOT NULL
      AND v_arr.registo_aeronave <> ''
    ORDER BY v_arr.id, v_dep.data_operacao
  ),
  unique_matches AS (
    SELECT DISTINCT ON (dep_id) * FROM matches ORDER BY dep_id, tempo_min
  )
  INSERT INTO voo_ligado (id, id_voo_arr, id_voo_dep, empresa_id, tempo_permanencia_min, tempo_estacionamento_min, created_date, updated_date)
  SELECT gen_random_uuid(), arr_id, dep_id, p_empresa_id,
    GREATEST(tempo_min, 0), GREATEST(tempo_min, 0), NOW(), NOW()
  FROM unique_matches
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  -- Calculate pending tariffs
  SELECT calculate_all_pending_tariffs(p_empresa_id) INTO v_calculated;

  RETURN jsonb_build_object('linked', v_linked, 'calculated', v_calculated);
END;
$$;

GRANT EXECUTE ON FUNCTION link_and_calculate_pending TO authenticated;
