-- 054: Replace Edge Function get-dashboard-stats with full server-side RPC
-- All aggregations done in PostgreSQL — zero row transfer, no limit issues
-- Replaces both the old get_dashboard_stats (basic) and Edge Function (detailed)

CREATE OR REPLACE FUNCTION get_dashboard_stats_full(
  p_empresa_id uuid DEFAULT NULL,
  p_aeroporto text DEFAULT 'todos',
  p_dias integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $fn$
DECLARE
  v_data_inicio text;
  v_data_inicio_dobro text;
  v_hoje text;
  v_icaos text[];
  v_aero_ids uuid[];
  v_result jsonb;
  v_previous jsonb;
  v_top10 jsonb;
BEGIN
  v_hoje := CURRENT_DATE::text;
  v_data_inicio := (CURRENT_DATE - (p_dias || ' days')::interval)::date::text;
  v_data_inicio_dobro := (CURRENT_DATE - (p_dias * 2 || ' days')::interval)::date::text;

  -- Get empresa airport codes
  IF p_empresa_id IS NOT NULL THEN
    SELECT array_agg(codigo_icao), array_agg(id)
    INTO v_icaos, v_aero_ids
    FROM aeroporto
    WHERE empresa_id = p_empresa_id;
  END IF;

  -- Main stats (current period)
  SELECT jsonb_build_object(
    'totalVoos', COUNT(*),
    'chegadasHoje', COUNT(*) FILTER (WHERE data_operacao = v_hoje AND tipo_movimento = 'ARR'),
    'partidasHoje', COUNT(*) FILTER (WHERE data_operacao = v_hoje AND tipo_movimento = 'DEP'),
    'passageirosPeriodo', COALESCE(SUM(passageiros_total), 0),
    'taxaPontualidade', ROUND(
      100.0 * COUNT(*) FILTER (
        WHERE horario_real IS NOT NULL AND horario_real != ''
        AND horario_previsto IS NOT NULL AND horario_previsto != ''
        AND status = 'Realizado'
        AND ABS(
          (SPLIT_PART(horario_real, ':', 1)::int * 60 + SPLIT_PART(horario_real, ':', 2)::int) -
          (SPLIT_PART(horario_previsto, ':', 1)::int * 60 + SPLIT_PART(horario_previsto, ':', 2)::int)
        ) <= 15
      ) / NULLIF(COUNT(*) FILTER (
        WHERE horario_real IS NOT NULL AND horario_real != ''
        AND horario_previsto IS NOT NULL AND horario_previsto != ''
        AND status = 'Realizado'
      ), 0),
      1
    )
  )
  INTO v_result
  FROM voo v
  WHERE v.deleted_at IS NULL
    AND v.data_operacao >= v_data_inicio
    AND (
      p_aeroporto = 'todos'
      OR (p_aeroporto != 'todos' AND v.aeroporto_operacao = p_aeroporto)
      OR (p_aeroporto = 'todos' AND v_icaos IS NOT NULL AND v.aeroporto_operacao = ANY(v_icaos))
    );

  -- Linked flights stats
  SELECT v_result || jsonb_build_object(
    'voosUnicosLigados', (
      SELECT COUNT(DISTINCT vid) FROM (
        SELECT vl.id_voo_arr AS vid FROM voo_ligado vl
        JOIN voo v ON v.id = vl.id_voo_arr AND v.deleted_at IS NULL AND v.data_operacao >= v_data_inicio
        WHERE (p_empresa_id IS NULL OR vl.empresa_id = p_empresa_id OR v.aeroporto_operacao = ANY(COALESCE(v_icaos, ARRAY[]::text[])))
          AND (p_aeroporto = 'todos' OR v.aeroporto_operacao = p_aeroporto)
        UNION ALL
        SELECT vl.id_voo_dep AS vid FROM voo_ligado vl
        JOIN voo v ON v.id = vl.id_voo_dep AND v.deleted_at IS NULL AND v.data_operacao >= v_data_inicio
        WHERE (p_empresa_id IS NULL OR vl.empresa_id = p_empresa_id OR v.aeroporto_operacao = ANY(COALESCE(v_icaos, ARRAY[]::text[])))
          AND (p_aeroporto = 'todos' OR v.aeroporto_operacao = p_aeroporto)
      ) sub
    ),
    'voosLigados', (
      SELECT COUNT(*) FROM voo_ligado vl
      WHERE EXISTS (
        SELECT 1 FROM voo v WHERE v.id IN (vl.id_voo_arr, vl.id_voo_dep)
          AND v.deleted_at IS NULL AND v.data_operacao >= v_data_inicio
          AND (p_aeroporto = 'todos' OR v.aeroporto_operacao = p_aeroporto)
          AND (v_icaos IS NULL OR v.aeroporto_operacao = ANY(v_icaos))
      )
    ),
    'tempoMedioPermanencia', (
      SELECT COALESCE(ROUND(AVG(vl.tempo_permanencia_min)::numeric / 60, 2), 0)
      FROM voo_ligado vl
      WHERE vl.tempo_permanencia_min > 0
        AND (p_empresa_id IS NULL OR vl.empresa_id = p_empresa_id)
        AND EXISTS (
          SELECT 1 FROM voo v WHERE v.id IN (vl.id_voo_arr, vl.id_voo_dep)
            AND v.deleted_at IS NULL AND v.data_operacao >= v_data_inicio
            AND (p_aeroporto = 'todos' OR v.aeroporto_operacao = p_aeroporto)
            AND (v_icaos IS NULL OR v.aeroporto_operacao = ANY(v_icaos))
        )
    )
  )
  INTO v_result;

  -- Compute voosSemLink
  SELECT v_result || jsonb_build_object(
    'voosSemLink', (v_result->>'totalVoos')::int - (v_result->>'voosUnicosLigados')::int
  )
  INTO v_result;

  -- Tariff stats
  SELECT v_result || jsonb_build_object(
    'totalTarifas', COALESCE(SUM(ct.total_tarifa), 0),
    'voosSemCalculo', (v_result->>'totalVoos')::int - COUNT(DISTINCT ct.voo_id),
    'voosIsentos', COUNT(*) FILTER (WHERE COALESCE(ct.total_tarifa, 0) = 0)
  )
  INTO v_result
  FROM calculo_tarifa ct
  WHERE EXISTS (
    SELECT 1 FROM voo v WHERE v.id = ct.voo_id
      AND v.deleted_at IS NULL AND v.data_operacao >= v_data_inicio
      AND (p_aeroporto = 'todos' OR v.aeroporto_operacao = p_aeroporto)
      AND (v_icaos IS NULL OR v.aeroporto_operacao = ANY(v_icaos))
  );

  -- Safety & inspections
  SELECT v_result || jsonb_build_object(
    'ocorrenciasAbertas', (
      SELECT COUNT(*) FROM ocorrencia_safety o
      WHERE o.status NOT IN ('Fechada', 'Resolvida')
        AND (p_empresa_id IS NULL OR o.empresa_id = p_empresa_id
             OR o.aeroporto = ANY(COALESCE(v_icaos, ARRAY[]::text[])))
    ),
    'inspecoesPendentes', (
      SELECT COUNT(*) FROM inspecao i
      WHERE i.status IN ('Pendente', 'Agendada')
        AND (p_empresa_id IS NULL OR i.empresa_id = p_empresa_id
             OR i.aeroporto_id = ANY(COALESCE(v_aero_ids, ARRAY[]::uuid[])))
    )
  )
  INTO v_result;

  -- Top 10 airports by volume
  SELECT COALESCE(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  INTO v_top10
  FROM (
    SELECT
      v.aeroporto_operacao AS codigo_icao,
      v.aeroporto_operacao AS codigo,
      COUNT(*) AS "totalMovimentos",
      COUNT(*) FILTER (WHERE tipo_movimento = 'ARR') AS "movimentosArr",
      COUNT(*) FILTER (WHERE tipo_movimento = 'DEP') AS "movimentosDep",
      COALESCE(SUM(passageiros_total), 0) AS passageiros,
      COALESCE(SUM(passageiros_total) FILTER (WHERE tipo_movimento = 'ARR'), 0) AS "passageirosArr",
      COALESCE(SUM(passageiros_total) FILTER (WHERE tipo_movimento = 'DEP'), 0) AS "passageirosDep",
      COALESCE(SUM(carga_kg), 0) AS carga,
      COALESCE(SUM(carga_kg) FILTER (WHERE tipo_movimento = 'ARR'), 0) AS "cargaArr",
      COALESCE(SUM(carga_kg) FILTER (WHERE tipo_movimento = 'DEP'), 0) AS "cargaDep"
    FROM voo v
    WHERE v.deleted_at IS NULL
      AND v.data_operacao >= v_data_inicio
      AND v.aeroporto_operacao IS NOT NULL
      AND (p_aeroporto = 'todos' OR v.aeroporto_operacao = p_aeroporto)
      AND (v_icaos IS NULL OR v.aeroporto_operacao = ANY(v_icaos))
    GROUP BY v.aeroporto_operacao
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) sub;

  SELECT v_result || jsonb_build_object('top10Aeroportos', v_top10)
  INTO v_result;

  -- Previous period (for trends — double window)
  SELECT jsonb_build_object(
    'totalVoos', COUNT(*),
    'passageirosPeriodo', COALESCE(SUM(passageiros_total), 0),
    'taxaPontualidade', ROUND(
      100.0 * COUNT(*) FILTER (
        WHERE horario_real IS NOT NULL AND horario_real != ''
        AND horario_previsto IS NOT NULL AND horario_previsto != ''
        AND status = 'Realizado'
        AND ABS(
          (SPLIT_PART(horario_real, ':', 1)::int * 60 + SPLIT_PART(horario_real, ':', 2)::int) -
          (SPLIT_PART(horario_previsto, ':', 1)::int * 60 + SPLIT_PART(horario_previsto, ':', 2)::int)
        ) <= 15
      ) / NULLIF(COUNT(*) FILTER (
        WHERE horario_real IS NOT NULL AND horario_real != ''
        AND horario_previsto IS NOT NULL AND horario_previsto != ''
        AND status = 'Realizado'
      ), 0),
      1
    ),
    'voosUnicosLigados', (
      SELECT COUNT(DISTINCT vid) FROM (
        SELECT vl.id_voo_arr AS vid FROM voo_ligado vl
        JOIN voo v2 ON v2.id = vl.id_voo_arr AND v2.deleted_at IS NULL AND v2.data_operacao >= v_data_inicio_dobro
        WHERE (p_empresa_id IS NULL OR vl.empresa_id = p_empresa_id)
          AND (p_aeroporto = 'todos' OR v2.aeroporto_operacao = p_aeroporto)
          AND (v_icaos IS NULL OR v2.aeroporto_operacao = ANY(v_icaos))
        UNION ALL
        SELECT vl.id_voo_dep FROM voo_ligado vl
        JOIN voo v2 ON v2.id = vl.id_voo_dep AND v2.deleted_at IS NULL AND v2.data_operacao >= v_data_inicio_dobro
        WHERE (p_empresa_id IS NULL OR vl.empresa_id = p_empresa_id)
          AND (p_aeroporto = 'todos' OR v2.aeroporto_operacao = p_aeroporto)
          AND (v_icaos IS NULL OR v2.aeroporto_operacao = ANY(v_icaos))
      ) sub2
    ),
    'totalTarifas', (
      SELECT COALESCE(SUM(ct2.total_tarifa), 0) FROM calculo_tarifa ct2
      WHERE EXISTS (
        SELECT 1 FROM voo v2 WHERE v2.id = ct2.voo_id
          AND v2.deleted_at IS NULL AND v2.data_operacao >= v_data_inicio_dobro
          AND (p_aeroporto = 'todos' OR v2.aeroporto_operacao = p_aeroporto)
          AND (v_icaos IS NULL OR v2.aeroporto_operacao = ANY(v_icaos))
      )
    )
  )
  INTO v_previous
  FROM voo v
  WHERE v.deleted_at IS NULL
    AND v.data_operacao >= v_data_inicio_dobro
    AND (p_aeroporto = 'todos' OR v.aeroporto_operacao = p_aeroporto)
    AND (v_icaos IS NULL OR v.aeroporto_operacao = ANY(v_icaos));

  RETURN jsonb_build_object('data', v_result, 'previousData', v_previous);
END;
$fn$;
