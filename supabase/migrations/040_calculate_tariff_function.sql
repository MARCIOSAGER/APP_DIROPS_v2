-- =============================================
-- 040: Stored functions for tariff calculation
-- calculate_tariff(UUID) — single voo_ligado
-- calculate_tariffs_batch(UUID[]) — selective batch
-- calculate_all_pending_tariffs(UUID) — all missing for empresa
-- =============================================

-- Helper: ROUND that works with double precision
CREATE OR REPLACE FUNCTION round2(val DOUBLE PRECISION) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$ SELECT ROUND(val::NUMERIC, 2) $$;

-- ============================================================
-- 1. calculate_tariff(p_voo_ligado_id UUID)
--    Calculates ALL tariff components for a given voo_ligado,
--    performs DELETE+INSERT into calculo_tarifa, and returns
--    the resulting calculo_tarifa record.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_tariff(p_voo_ligado_id UUID)
RETURNS SETOF calculo_tarifa
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Core records
    v_vl          RECORD;   -- voo_ligado
    v_arr         RECORD;   -- arrival voo
    v_dep         RECORD;   -- departure voo
    v_aero        RECORD;   -- aeroporto_operacao
    v_reg         RECORD;   -- registo_aeronave

    -- Derived values
    v_registo_raw       TEXT;
    v_registo_norm      TEXT;
    v_mtow_kg           NUMERIC;
    v_mtow_tonnes       INTEGER;
    v_categoria         TEXT;
    v_empresa_id        UUID;

    -- International / domestic
    v_origin_country    TEXT;
    v_dest_country      TEXT;
    v_aero_country      TEXT;
    v_is_international  BOOLEAN := FALSE;
    v_tipo_operacao     TEXT;       -- 'Internacional' / 'Doméstico'
    v_tipo_op_enum      TEXT;       -- 'internacional' / 'domestica'

    -- Exempt
    v_is_exempt         BOOLEAN := FALSE;

    -- Parking
    v_tempo_min         NUMERIC;
    v_tempo_horas       INTEGER;

    -- Tariff components (USD)
    v_pouso_usd         NUMERIC(12,2) := 0;
    v_permanencia_usd   NUMERIC(12,2) := 0;
    v_passageiros_usd   NUMERIC(12,2) := 0;
    v_carga_usd         NUMERIC(12,2) := 0;
    v_outras_usd        NUMERIC(12,2) := 0;
    v_recursos_usd      NUMERIC(12,2) := 0;
    v_servicos_usd      NUMERIC(12,2) := 0;

    -- Taxes & totals
    v_subtotal_usd      NUMERIC(12,2) := 0;
    v_total_tax_usd     NUMERIC(12,2) := 0;
    v_total_usd         NUMERIC(12,2) := 0;
    v_taxa_cambio       NUMERIC(12,4) := 850;

    -- Helpers
    v_periodo_noturno   BOOLEAN := FALSE;
    v_arr_noturno       BOOLEAN := FALSE;
    v_dep_noturno       BOOLEAN := FALSE;
    v_arr_hour          INTEGER;
    v_dep_hour          INTEGER;
    v_operacoes_noturnas INTEGER := 0;
    v_requer_ilum_extra BOOLEAN := FALSE;

    -- Landing bracket cursor
    v_bracket           RECORD;
    v_upper_bound       NUMERIC;
    v_weight_tonnes     INTEGER;

    -- Permanence
    v_tarifa_perm_rate  NUMERIC;
    v_horas_cobradas    INTEGER;
    v_aeronave_hangar   BOOLEAN := FALSE;

    -- Passengers / cargo
    v_pax_local         INTEGER := 0;
    v_pax_transito_tb   INTEGER := 0;
    v_pax_transito_dir  INTEGER := 0;
    v_carga_kg          NUMERIC := 0;
    v_pax_cuppss        INTEGER := 0;
    v_is_pax_exempt     BOOLEAN := FALSE;

    -- outra_tarifa lookup
    v_ot                RECORD;

    -- Tax loop
    v_tax               RECORD;

    -- Recursos / Servicos
    v_rec               RECORD;
    v_svc               RECORD;

    -- JSONB details
    v_detalhes          JSONB := '{}'::JSONB;
    v_escaloes          JSONB := '[]'::JSONB;
    v_outras_det        JSONB := '[]'::JSONB;
    v_recursos_det      JSONB := '[]'::JSONB;
    v_servicos_det      JSONB := '[]'::JSONB;
    v_impostos_det      JSONB := '[]'::JSONB;

    -- Result ID
    v_result_id         UUID;
BEGIN
    -- =========================================================
    -- STEP 1: LOOKUP voo_ligado, voo_arr, voo_dep, aeroporto
    -- =========================================================
    SELECT * INTO v_vl FROM voo_ligado WHERE id = p_voo_ligado_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'voo_ligado % not found', p_voo_ligado_id;
    END IF;

    SELECT * INTO v_arr FROM voo WHERE id = v_vl.id_voo_arr;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Arrival voo (id_voo_arr=%) not found for voo_ligado %', v_vl.id_voo_arr, p_voo_ligado_id;
    END IF;

    SELECT * INTO v_dep FROM voo WHERE id = v_vl.id_voo_dep;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Departure voo (id_voo_dep=%) not found for voo_ligado %', v_vl.id_voo_dep, p_voo_ligado_id;
    END IF;

    -- Aeroporto from voo_arr.aeroporto_operacao (ICAO code → lookup)
    SELECT * INTO v_aero
    FROM aeroporto
    WHERE codigo_icao = v_arr.aeroporto_operacao
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aeroporto "%" not found', v_arr.aeroporto_operacao;
    END IF;

    v_categoria  := v_aero.categoria;
    v_empresa_id := COALESCE(v_vl.empresa_id, v_arr.empresa_id);

    IF v_categoria IS NULL OR v_categoria = '' THEN
        RAISE EXCEPTION 'Aeroporto "%" has no categoria configured', v_aero.codigo_icao;
    END IF;

    -- =========================================================
    -- STEP 2: EXCHANGE RATE
    -- =========================================================
    SELECT COALESCE(
        (SELECT (cs.taxa_cambio_usd_aoa)::NUMERIC
         FROM configuracao_sistema cs
         LIMIT 1),
        850
    ) INTO v_taxa_cambio;

    -- =========================================================
    -- STEP 3: AIRCRAFT REGISTRATION & MTOW
    -- =========================================================
    IF v_vl.registo_alterado THEN
        v_registo_raw := v_vl.registo_dep;
    ELSE
        v_registo_raw := v_arr.registo_aeronave;
    END IF;

    -- Normalize: UPPER, remove dashes/spaces/dots/underscores
    v_registo_norm := UPPER(REGEXP_REPLACE(COALESCE(v_registo_raw, ''), '[\s\-_.]', '', 'g'));

    SELECT * INTO v_reg
    FROM registo_aeronave
    WHERE UPPER(REGEXP_REPLACE(COALESCE(registo, ''), '[\s\-_.]', '', 'g')) = v_registo_norm
    LIMIT 1;

    IF NOT FOUND OR v_reg.mtow_kg IS NULL THEN
        RAISE EXCEPTION 'Aircraft registration "%" not found or missing MTOW', v_registo_raw;
    END IF;

    v_mtow_kg     := v_reg.mtow_kg;
    v_mtow_tonnes := CEIL(v_mtow_kg / 1000.0)::INTEGER;

    -- =========================================================
    -- STEP 4: DOMESTIC vs INTERNATIONAL
    -- =========================================================
    -- Lookup origin airport country
    SELECT pais INTO v_origin_country
    FROM aeroporto
    WHERE codigo_icao = v_arr.aeroporto_origem_destino
    LIMIT 1;

    -- Lookup destination airport country
    SELECT pais INTO v_dest_country
    FROM aeroporto
    WHERE codigo_icao = v_dep.aeroporto_origem_destino
    LIMIT 1;

    v_aero_country := v_aero.pais;

    v_is_international := (
        (v_origin_country IS NOT NULL AND v_origin_country != 'AO') OR
        (v_aero_country IS NOT NULL AND v_aero_country != 'AO') OR
        (v_dest_country IS NOT NULL AND v_dest_country != 'AO')
    );

    IF v_is_international THEN
        v_tipo_operacao := 'Internacional';
        v_tipo_op_enum  := 'internacional';
    ELSE
        v_tipo_operacao := 'Doméstico';
        v_tipo_op_enum  := 'domestica';
    END IF;

    -- =========================================================
    -- STEP 5: EXEMPT CHECK
    -- =========================================================
    IF COALESCE(v_arr.tipo_voo, '') IN ('Militar', 'Humanitário', 'Oficial')
       OR COALESCE(v_dep.tipo_voo, '') IN ('Militar', 'Humanitário', 'Oficial')
    THEN
        v_is_exempt := TRUE;
    END IF;

    -- =========================================================
    -- STEP 6: PARKING DURATION
    -- =========================================================
    v_tempo_min   := COALESCE(v_vl.tempo_estacionamento_min, v_vl.tempo_permanencia_min, 0);
    v_tempo_horas := CEIL(v_tempo_min / 60.0)::INTEGER;

    -- Hangar check
    v_aeronave_hangar := COALESCE(v_arr.aeronave_no_hangar, FALSE) OR COALESCE(v_dep.aeronave_no_hangar, FALSE);

    -- =========================================================
    -- STEP 5b: IF EXEMPT, short-circuit with zeros
    -- =========================================================
    IF v_is_exempt THEN
        v_detalhes := jsonb_build_object(
            'isento', TRUE,
            'motivo_isencao', format('Voo do tipo isento - ARR: %s, DEP: %s', v_arr.tipo_voo, v_dep.tipo_voo),
            'tipo_voo_arr', v_arr.tipo_voo,
            'tipo_voo_dep', v_dep.tipo_voo,
            'observacao', 'Voos Militares, Oficiais e Humanitários são isentos de todas as tarifas aeroportuárias.',
            'categoria_aeroporto', v_categoria
        );

        -- Delete existing + insert zeros
        DELETE FROM calculo_tarifa WHERE voo_ligado_id = p_voo_ligado_id;

        INSERT INTO calculo_tarifa (
            voo_id, voo_ligado_id, companhia_id, aeroporto_id, categoria_aeroporto,
            mtow_kg, taxa_cambio_usd_aoa, tempo_permanencia_horas,
            data_calculo, tipo_tarifa, numero_voo,
            tarifa_pouso_usd, tarifa_pouso,
            tarifa_permanencia_usd, tarifa_permanencia,
            tarifa_passageiros_usd, tarifa_passageiros,
            tarifa_carga_usd, tarifa_carga,
            outras_tarifas_usd, outras_tarifas,
            tarifa_recursos_usd, tarifa_recursos,
            total_tarifa_usd, total_tarifa,
            periodo_noturno, detalhes_calculo, empresa_id
        ) VALUES (
            v_dep.id, p_voo_ligado_id, (SELECT id FROM companhia_aerea WHERE codigo_icao = v_arr.companhia_aerea OR codigo_iata = v_arr.companhia_aerea LIMIT 1), v_aero.id, v_categoria,
            v_mtow_kg, v_taxa_cambio, v_tempo_horas,
            NOW(), 'Voo Isento de Tarifas', COALESCE(v_arr.numero_voo, v_dep.numero_voo),
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            FALSE, v_detalhes, v_empresa_id
        )
        RETURNING id INTO v_result_id;

        RETURN QUERY SELECT * FROM calculo_tarifa WHERE id = v_result_id;
        RETURN;
    END IF;

    -- =========================================================
    -- Passenger / cargo type exemptions
    -- =========================================================
    v_is_pax_exempt := COALESCE(v_dep.tipo_voo, '') IN ('Carga', 'Militar', 'Humanitário', 'Oficial', 'Técnico');

    v_pax_local       := COALESCE(v_dep.passageiros_local, 0);
    v_pax_transito_tb := COALESCE(v_dep.passageiros_transito_transbordo, 0);
    v_pax_transito_dir := COALESCE(v_dep.passageiros_transito_direto, 0);
    v_carga_kg        := COALESCE(v_dep.carga_kg, 0);

    -- =========================================================
    -- STEP 7: LANDING TARIFF (cumulative brackets, deduplicated)
    -- DISTINCT ON ensures empresa-specific rows take priority
    -- over global rows for the same bracket range.
    -- =========================================================
    v_escaloes := '[]'::JSONB;

    FOR v_bracket IN
        SELECT DISTINCT ON (faixa_min, faixa_max) *
        FROM tarifa_pouso
        WHERE categoria_aeroporto = v_categoria
          AND status = 'ativa'
          AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
        ORDER BY faixa_min, faixa_max,
            CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
    LOOP
        IF v_mtow_kg <= v_bracket.faixa_min THEN
            CONTINUE;
        END IF;

        v_upper_bound   := LEAST(v_mtow_kg, v_bracket.faixa_max);
        v_weight_tonnes := CEIL((v_upper_bound - v_bracket.faixa_min) / 1000.0)::INTEGER;

        DECLARE
            v_rate NUMERIC;
            v_bracket_val NUMERIC;
        BEGIN
            IF v_is_international THEN
                v_rate := COALESCE(v_bracket.tarifa_internacional, 0);
            ELSE
                v_rate := COALESCE(v_bracket.tarifa_domestica, 0);
            END IF;

            v_bracket_val := round2(v_rate * v_weight_tonnes);
            v_pouso_usd   := v_pouso_usd + v_bracket_val;

            v_escaloes := v_escaloes || jsonb_build_object(
                'faixa', format('%s-%st', CEIL(v_bracket.faixa_min / 1000.0)::INTEGER, CEIL(v_bracket.faixa_max / 1000.0)::INTEGER),
                'tarifa', v_rate,
                'peso_no_escalao', v_weight_tonnes,
                'valor', v_bracket_val
            );
        END;
    END LOOP;

    v_detalhes := jsonb_set(v_detalhes, '{pouso}', jsonb_build_object(
        'tipoVoo', v_tipo_operacao,
        'mtowKg', v_mtow_kg,
        'mtowTonnes', v_mtow_tonnes,
        'escaloes', v_escaloes,
        'valor', v_pouso_usd,
        'categoria_aeroporto', v_categoria
    ));

    -- =========================================================
    -- STEP 8: PERMANENCE TARIFF (tiered)
    -- =========================================================
    IF v_aeronave_hangar THEN
        v_permanencia_usd := 0;
        v_detalhes := jsonb_set(v_detalhes, '{permanencia}', jsonb_build_object(
            'tipo', 'Isento (Hangar)',
            'tempoPermanencia', format('%sh', v_tempo_horas),
            'observacao', 'Aeronave foi para o hangar - isenta de tarifa de estacionamento',
            'valor', 0,
            'categoria_aeroporto', v_categoria
        ));
    ELSIF v_tempo_horas <= 2 THEN
        v_permanencia_usd := 0;
        v_detalhes := jsonb_set(v_detalhes, '{permanencia}', jsonb_build_object(
            'tipo', 'Isento (≤2h)',
            'tempoPermanencia', format('%sh', v_tempo_horas),
            'horasIsentas', v_tempo_horas,
            'valor', 0,
            'categoria_aeroporto', v_categoria
        ));
    ELSE
        -- Lookup tarifa_permanencia (empresa-specific first, then global)
        SELECT tarifa_usd_por_tonelada_hora INTO v_tarifa_perm_rate
        FROM tarifa_permanencia
        WHERE categoria_aeroporto = v_categoria
          AND status = 'ativa'
          AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
        ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF v_tarifa_perm_rate IS NULL THEN
            v_tarifa_perm_rate := 0;
        END IF;

        v_horas_cobradas := v_tempo_horas - 2;

        IF v_horas_cobradas <= 4 THEN
            v_permanencia_usd := round2(v_tarifa_perm_rate * v_mtow_tonnes * v_horas_cobradas);
            v_detalhes := jsonb_set(v_detalhes, '{permanencia}', jsonb_build_object(
                'tipo', 'Base (até 6h)',
                'tarifaBase', v_tarifa_perm_rate,
                'mtowTonnes', v_mtow_tonnes,
                'tempoPermanencia', format('%sh', v_tempo_horas),
                'horasCobradas', v_horas_cobradas,
                'horasIsentas', 2,
                'formula', format('%s × %st × %sh', v_tarifa_perm_rate, v_mtow_tonnes, v_horas_cobradas),
                'valor', v_permanencia_usd,
                'categoria_aeroporto', v_categoria
            ));
        ELSE
            DECLARE
                v_horas_alem6 INTEGER := v_horas_cobradas - 4;
            BEGIN
                v_permanencia_usd := round2(
                    (v_tarifa_perm_rate * v_mtow_tonnes * 4) +
                    (v_tarifa_perm_rate * 1.5 * v_mtow_tonnes * v_horas_alem6)
                );
                v_detalhes := jsonb_set(v_detalhes, '{permanencia}', jsonb_build_object(
                    'tipo', 'Com Sobretaxa (>6h)',
                    'tarifaBase', v_tarifa_perm_rate,
                    'mtowTonnes', v_mtow_tonnes,
                    'tempoPermanencia', format('%sh', v_tempo_horas),
                    'horasCobradas', v_horas_cobradas,
                    'horasIsentas', 2,
                    'horasBase', 4,
                    'horasAlem6', v_horas_alem6,
                    'formula', format('(%s × %st × 4h) + (%s × 1.5 × %st × %sh)', v_tarifa_perm_rate, v_mtow_tonnes, v_tarifa_perm_rate, v_mtow_tonnes, v_horas_alem6),
                    'valor', v_permanencia_usd,
                    'categoria_aeroporto', v_categoria
                ));
            END;
        END IF;
    END IF;

    -- =========================================================
    -- STEP 9: PASSENGER TARIFF
    -- =========================================================
    IF v_pax_local > 0 AND NOT v_is_pax_exempt THEN
        SELECT valor INTO v_ot
        FROM outra_tarifa
        WHERE tipo = 'embarque'
          AND categoria_aeroporto = v_categoria
          AND status = 'ativa'
          AND (tipo_operacao = 'ambos' OR tipo_operacao = v_tipo_op_enum)
          AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
        ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF FOUND THEN
            v_passageiros_usd := round2(v_ot.valor * v_pax_local);
        END IF;
    END IF;

    v_detalhes := jsonb_set(v_detalhes, '{passageiros}', jsonb_build_object(
        'tipoVoo', v_tipo_operacao,
        'passageirosDep', v_pax_local,
        'totalPassageirosCobranca', CASE WHEN v_is_pax_exempt THEN 0 ELSE v_pax_local END,
        'valor', v_passageiros_usd,
        'categoria_aeroporto', v_categoria
    ));

    -- =========================================================
    -- STEP 10: CARGO TARIFF
    -- =========================================================
    IF v_carga_kg > 0 THEN
        SELECT valor INTO v_ot
        FROM outra_tarifa
        WHERE tipo = 'carga'
          AND categoria_aeroporto = v_categoria
          AND status = 'ativa'
          AND (tipo_operacao = 'ambos' OR tipo_operacao = v_tipo_op_enum)
          AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
        ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF FOUND THEN
            v_carga_usd := round2(v_ot.valor * (v_carga_kg / 1000.0));
        END IF;
    END IF;

    v_detalhes := jsonb_set(v_detalhes, '{carga}', jsonb_build_object(
        'tipoVoo', v_tipo_operacao,
        'cargaDep', v_carga_kg,
        'totalCargaKg', v_carga_kg,
        'totalCargaTon', ROUND((v_carga_kg / 1000.0)::NUMERIC, 3),
        'valor', v_carga_usd,
        'categoria_aeroporto', v_categoria
    ));

    -- =========================================================
    -- STEP 11: OTHER TARIFFS
    -- =========================================================
    v_outras_det := '[]'::JSONB;

    -- 11a: LIGHTING (Iluminação)
    -- Determine nocturnal hours from horario_real or horario_previsto
    BEGIN
        v_arr_hour := EXTRACT(HOUR FROM (COALESCE(v_arr.horario_real, v_arr.horario_previsto))::TIME);
    EXCEPTION WHEN OTHERS THEN
        v_arr_hour := 12; -- default to daytime if can't parse
    END;

    BEGIN
        v_dep_hour := EXTRACT(HOUR FROM (COALESCE(v_dep.horario_real, v_dep.horario_previsto))::TIME);
    EXCEPTION WHEN OTHERS THEN
        v_dep_hour := 12;
    END;

    v_arr_noturno := (v_arr_hour >= 18 OR v_arr_hour < 6);
    v_dep_noturno := (v_dep_hour >= 18 OR v_dep_hour < 6);
    v_requer_ilum_extra := COALESCE(v_arr.requer_iluminacao_extra, FALSE) OR COALESCE(v_dep.requer_iluminacao_extra, FALSE);
    v_periodo_noturno := v_arr_noturno OR v_dep_noturno OR v_requer_ilum_extra;

    IF v_periodo_noturno THEN
        v_operacoes_noturnas := (CASE WHEN v_arr_noturno THEN 1 ELSE 0 END) + (CASE WHEN v_dep_noturno THEN 1 ELSE 0 END);
        -- If only iluminacao_extra is set but no nighttime ops, count as 1
        IF v_operacoes_noturnas = 0 AND v_requer_ilum_extra THEN
            v_operacoes_noturnas := 1;
        END IF;

        SELECT valor INTO v_ot
        FROM outra_tarifa
        WHERE tipo = 'iluminacao'
          AND categoria_aeroporto = v_categoria
          AND status = 'ativa'
          AND (tipo_operacao = 'ambos' OR tipo_operacao = v_tipo_op_enum)
          AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
        ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF FOUND THEN
            DECLARE
                v_ilum_val NUMERIC;
            BEGIN
                v_ilum_val := round2(v_ot.valor * v_operacoes_noturnas);
                v_outras_usd := v_outras_usd + v_ilum_val;
                v_outras_det := v_outras_det || jsonb_build_object(
                    'tipo', 'iluminacao',
                    'arrNoturno', v_arr_noturno,
                    'depNoturno', v_dep_noturno,
                    'iluminacaoExtra', v_requer_ilum_extra,
                    'operacoesNoturnas', v_operacoes_noturnas,
                    'tarifaPorOperacao', v_ot.valor,
                    'valor', v_ilum_val
                );
            END;
        END IF;
    END IF;

    -- 11b: SECURITY (Segurança)
    SELECT valor INTO v_ot
    FROM outra_tarifa
    WHERE tipo = 'seguranca'
      AND categoria_aeroporto = v_categoria
      AND status = 'ativa'
      AND (tipo_operacao = 'ambos' OR tipo_operacao = v_tipo_op_enum)
      AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
    ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF FOUND THEN
        v_outras_usd := v_outras_usd + COALESCE(v_ot.valor, 0);
        v_outras_det := v_outras_det || jsonb_build_object(
            'tipo', 'seguranca',
            'valor', COALESCE(v_ot.valor, 0)
        );
    END IF;

    -- 11c: TRANSIT TRANSBORDO
    IF v_pax_transito_tb > 0 THEN
        SELECT valor INTO v_ot
        FROM outra_tarifa
        WHERE tipo = 'transito_transbordo'
          AND categoria_aeroporto = v_categoria
          AND status = 'ativa'
          AND (tipo_operacao = 'ambos' OR tipo_operacao = v_tipo_op_enum)
          AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
        ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF FOUND THEN
            DECLARE v_tt_val NUMERIC;
            BEGIN
                v_tt_val := round2(v_ot.valor * v_pax_transito_tb);
                v_outras_usd := v_outras_usd + v_tt_val;
                v_outras_det := v_outras_det || jsonb_build_object(
                    'tipo', 'transito_transbordo',
                    'passageiros', v_pax_transito_tb,
                    'tarifaPorPassageiro', v_ot.valor,
                    'valor', v_tt_val
                );
            END;
        END IF;
    END IF;

    -- 11d: TRANSIT DIRETO
    IF v_pax_transito_dir > 0 THEN
        SELECT valor INTO v_ot
        FROM outra_tarifa
        WHERE tipo = 'transito_direto'
          AND categoria_aeroporto = v_categoria
          AND status = 'ativa'
          AND (tipo_operacao = 'ambos' OR tipo_operacao = v_tipo_op_enum)
          AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
        ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF FOUND THEN
            DECLARE v_td_val NUMERIC;
            BEGIN
                v_td_val := round2(v_ot.valor * v_pax_transito_dir);
                v_outras_usd := v_outras_usd + v_td_val;
                v_outras_det := v_outras_det || jsonb_build_object(
                    'tipo', 'transito_direto',
                    'passageiros', v_pax_transito_dir,
                    'tarifaPorPassageiro', v_ot.valor,
                    'valor', v_td_val
                );
            END;
        END IF;
    END IF;

    -- 11e: CUPPSS (local + transbordo passengers, DEP only)
    v_pax_cuppss := v_pax_local + v_pax_transito_tb;
    IF v_pax_cuppss > 0 AND NOT v_is_pax_exempt THEN
        SELECT valor INTO v_ot
        FROM outra_tarifa
        WHERE tipo = 'cuppss'
          AND categoria_aeroporto = v_categoria
          AND status = 'ativa'
          AND (tipo_operacao = 'ambos' OR tipo_operacao = v_tipo_op_enum)
          AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
        ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF FOUND THEN
            DECLARE v_cuppss_val NUMERIC;
            BEGIN
                v_cuppss_val := round2(v_ot.valor * v_pax_cuppss);
                v_outras_usd := v_outras_usd + v_cuppss_val;
                v_outras_det := v_outras_det || jsonb_build_object(
                    'tipo', 'cuppss',
                    'passageiros', v_pax_cuppss,
                    'tarifaPorPassageiro', v_ot.valor,
                    'valor', v_cuppss_val
                );
            END;
        END IF;
    END IF;

    -- Round outras
    v_outras_usd := round2(v_outras_usd);

    v_detalhes := jsonb_set(v_detalhes, '{outras}', v_outras_det);
    v_detalhes := jsonb_set(v_detalhes, '{iluminacao}', jsonb_build_object(
        'arrNoturno', v_arr_noturno,
        'depNoturno', v_dep_noturno,
        'iluminacaoExtra', v_requer_ilum_extra,
        'periodoNoturno', v_periodo_noturno
    ));

    -- =========================================================
    -- STEP 12: RESOURCES (recurso_voo)
    -- Auto-calculates values from tarifa_recurso when
    -- utilizado=true but valor_usd=0 (not manually set).
    -- PBB uses primeira_hora + hora_adicional pricing.
    -- GPU/PCA use valor_usd per hour (flat if no hours).
    -- =========================================================
    v_recursos_det := '[]'::JSONB;

    FOR v_rec IN
        SELECT * FROM recurso_voo WHERE voo_ligado_id = p_voo_ligado_id
    LOOP
        -- PCA
        IF COALESCE(v_rec.pca_utilizado, FALSE) THEN
            DECLARE
                v_pca_val NUMERIC := COALESCE(v_rec.pca_valor_usd, 0);
                v_pca_horas NUMERIC := COALESCE(v_rec.pca_tempo_horas, 0);
                v_tr RECORD;
            BEGIN
                IF v_pca_val <= 0 THEN
                    SELECT * INTO v_tr FROM tarifa_recurso
                    WHERE tipo = 'pca' AND status = 'ativa'
                      AND categoria_aeroporto = v_categoria
                      AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
                    ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END LIMIT 1;
                    IF FOUND THEN
                        IF v_pca_horas > 0 THEN
                            v_pca_val := round2(COALESCE(v_tr.valor_usd, 0) * v_pca_horas);
                        ELSE
                            v_pca_val := round2(COALESCE(v_tr.valor_usd, 0));
                        END IF;
                    END IF;
                END IF;
                IF v_pca_val > 0 THEN
                    v_recursos_usd := v_recursos_usd + v_pca_val;
                    v_recursos_det := v_recursos_det || jsonb_build_object(
                        'tipo', 'PCA', 'tempo_horas', v_pca_horas, 'valor_usd', v_pca_val);
                END IF;
            END;
        END IF;

        -- GPU
        IF COALESCE(v_rec.gpu_utilizado, FALSE) THEN
            DECLARE
                v_gpu_val NUMERIC := COALESCE(v_rec.gpu_valor_usd, 0);
                v_gpu_horas NUMERIC := COALESCE(v_rec.gpu_tempo_horas, 0);
                v_tr RECORD;
            BEGIN
                IF v_gpu_val <= 0 THEN
                    SELECT * INTO v_tr FROM tarifa_recurso
                    WHERE tipo = 'gpu' AND status = 'ativa'
                      AND categoria_aeroporto = v_categoria
                      AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
                    ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END LIMIT 1;
                    IF FOUND THEN
                        IF v_gpu_horas > 0 THEN
                            v_gpu_val := round2(COALESCE(v_tr.valor_usd, 0) * v_gpu_horas);
                        ELSE
                            v_gpu_val := round2(COALESCE(v_tr.valor_usd, 0));
                        END IF;
                    END IF;
                END IF;
                IF v_gpu_val > 0 THEN
                    v_recursos_usd := v_recursos_usd + v_gpu_val;
                    v_recursos_det := v_recursos_det || jsonb_build_object(
                        'tipo', 'GPU', 'tempo_horas', v_gpu_horas, 'valor_usd', v_gpu_val);
                END IF;
            END;
        END IF;

        -- PBB (primeira_hora + hora_adicional pricing)
        IF COALESCE(v_rec.pbb_utilizado, FALSE) THEN
            DECLARE
                v_pbb_val NUMERIC := COALESCE(v_rec.pbb_valor_usd, 0);
                v_pbb_horas NUMERIC := COALESCE(v_rec.pbb_tempo_horas, 0);
                v_tr RECORD;
            BEGIN
                IF v_pbb_val <= 0 THEN
                    SELECT * INTO v_tr FROM tarifa_recurso
                    WHERE tipo = 'pbb' AND status = 'ativa'
                      AND categoria_aeroporto = v_categoria
                      AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
                    ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END LIMIT 1;
                    IF FOUND THEN
                        IF COALESCE(v_tr.primeira_hora, 0) > 0 THEN
                            -- PBB tiered: primeira_hora + hora_adicional * (horas-1)
                            IF v_pbb_horas <= 1 THEN
                                v_pbb_val := round2(v_tr.primeira_hora);
                            ELSE
                                v_pbb_val := round2(v_tr.primeira_hora + COALESCE(v_tr.hora_adicional, 0) * (CEIL(v_pbb_horas) - 1));
                            END IF;
                        ELSIF v_pbb_horas > 0 THEN
                            v_pbb_val := round2(COALESCE(v_tr.valor_usd, 0) * v_pbb_horas);
                        ELSE
                            v_pbb_val := round2(COALESCE(v_tr.valor_usd, 0));
                        END IF;
                    END IF;
                END IF;
                IF v_pbb_val > 0 THEN
                    v_recursos_usd := v_recursos_usd + v_pbb_val;
                    v_recursos_det := v_recursos_det || jsonb_build_object(
                        'tipo', 'PBB', 'tempo_horas', v_pbb_horas, 'valor_usd', v_pbb_val);
                END IF;
            END;
        END IF;

        -- Check-in
        IF COALESCE(v_rec.checkin_utilizado, FALSE) THEN
            DECLARE
                v_chk_val NUMERIC := COALESCE(v_rec.checkin_valor_usd, 0);
                v_chk_horas NUMERIC := COALESCE(v_rec.checkin_tempo_horas, 0);
                v_tr RECORD;
            BEGIN
                IF v_chk_val <= 0 THEN
                    SELECT * INTO v_tr FROM tarifa_recurso
                    WHERE tipo = 'checkin' AND status = 'ativa'
                      AND categoria_aeroporto = v_categoria
                      AND (empresa_id = v_empresa_id OR empresa_id IS NULL)
                    ORDER BY CASE WHEN empresa_id = v_empresa_id THEN 0 ELSE 1 END LIMIT 1;
                    IF FOUND THEN
                        IF v_chk_horas > 0 THEN
                            v_chk_val := round2(COALESCE(v_tr.valor_usd, 0) * v_chk_horas);
                        ELSE
                            v_chk_val := round2(COALESCE(v_tr.valor_usd, 0));
                        END IF;
                    END IF;
                END IF;
                IF v_chk_val > 0 THEN
                    v_recursos_usd := v_recursos_usd + v_chk_val;
                    v_recursos_det := v_recursos_det || jsonb_build_object(
                        'tipo', 'Check-in', 'tempo_horas', v_chk_horas, 'valor_usd', v_chk_val);
                END IF;
            END;
        END IF;
    END LOOP;

    v_recursos_usd := round2(v_recursos_usd);

    v_detalhes := jsonb_set(v_detalhes, '{recursos}', jsonb_build_object(
        'itens', v_recursos_det,
        'total_usd', v_recursos_usd
    ));

    -- =========================================================
    -- STEP 12b: SERVICES (servico_voo) — optional, if table exists
    -- =========================================================
    v_servicos_det := '[]'::JSONB;

    BEGIN
        FOR v_svc IN
            SELECT * FROM servico_voo WHERE voo_ligado_id = p_voo_ligado_id
        LOOP
            IF COALESCE(v_svc.valor_total_usd, 0) > 0 THEN
                v_servicos_usd := v_servicos_usd + v_svc.valor_total_usd;
                v_servicos_det := v_servicos_det || jsonb_build_object(
                    'tipo', COALESCE(v_svc.tipo_servico, 'Serviço'),
                    'quantidade', COALESCE(v_svc.quantidade, 0),
                    'valor_usd', v_svc.valor_total_usd
                );
            END IF;
        END LOOP;
    EXCEPTION WHEN undefined_table THEN
        -- servico_voo table may not exist yet, skip silently
        NULL;
    END;

    v_servicos_usd := round2(COALESCE(v_servicos_usd, 0));

    v_detalhes := jsonb_set(v_detalhes, '{servicos}', jsonb_build_object(
        'itens', v_servicos_det,
        'total_usd', v_servicos_usd
    ));

    -- =========================================================
    -- STEP 13: TAXES (impostos)
    -- =========================================================
    v_subtotal_usd := round2(
        v_pouso_usd + v_permanencia_usd + v_passageiros_usd +
        v_carga_usd + v_outras_usd + v_recursos_usd + v_servicos_usd
    );

    v_impostos_det := '[]'::JSONB;
    v_total_tax_usd := 0;

    FOR v_tax IN
        SELECT *
        FROM imposto
        WHERE status = 'ativo'
          AND (aeroporto_id IS NULL OR aeroporto_id = v_aero.id)
          AND CASE WHEN data_inicio_vigencia IS NOT NULL AND data_inicio_vigencia != '' THEN data_inicio_vigencia::DATE ELSE '2000-01-01'::DATE END
              <= CASE WHEN v_dep.data_operacao IS NOT NULL AND v_dep.data_operacao != '' THEN v_dep.data_operacao::DATE ELSE CURRENT_DATE END
          AND (data_fim_vigencia IS NULL OR data_fim_vigencia = '' OR
              data_fim_vigencia::DATE >= CASE WHEN v_dep.data_operacao IS NOT NULL AND v_dep.data_operacao != '' THEN v_dep.data_operacao::DATE ELSE CURRENT_DATE END)
    LOOP
        DECLARE
            v_pct     NUMERIC;
            v_tax_val NUMERIC;
        BEGIN
            v_pct     := COALESCE(v_tax.valor, 0);
            v_tax_val := round2(v_subtotal_usd * v_pct / 100.0);
            v_total_tax_usd := v_total_tax_usd + v_tax_val;

            v_impostos_det := v_impostos_det || jsonb_build_object(
                'tipo', v_tax.tipo,
                'percentagem', v_pct,
                'valor_usd', v_tax_val,
                'valor_aoa', round2(v_tax_val * v_taxa_cambio)
            );
        END;
    END LOOP;

    v_total_tax_usd := round2(v_total_tax_usd);

    v_detalhes := jsonb_set(v_detalhes, '{impostos}', v_impostos_det);
    v_detalhes := jsonb_set(v_detalhes, '{subtotal_sem_impostos_usd}', to_jsonb(v_subtotal_usd));
    v_detalhes := jsonb_set(v_detalhes, '{subtotal_sem_impostos_aoa}', to_jsonb(round2(v_subtotal_usd * v_taxa_cambio)));
    v_detalhes := jsonb_set(v_detalhes, '{total_impostos_usd}', to_jsonb(v_total_tax_usd));
    v_detalhes := jsonb_set(v_detalhes, '{total_impostos_aoa}', to_jsonb(round2(v_total_tax_usd * v_taxa_cambio)));

    -- =========================================================
    -- STEP 14: TOTALS
    -- =========================================================
    v_total_usd := round2(v_subtotal_usd + v_total_tax_usd);

    -- Registration change details
    IF v_vl.registo_alterado THEN
        v_detalhes := jsonb_set(v_detalhes, '{alteracao_registo}', jsonb_build_object(
            'registo_arr', v_arr.registo_aeronave,
            'registo_dep', v_vl.registo_dep
        ));
    END IF;

    -- =========================================================
    -- STEP 15: DELETE + INSERT into calculo_tarifa
    -- =========================================================
    DELETE FROM calculo_tarifa WHERE voo_ligado_id = p_voo_ligado_id;

    INSERT INTO calculo_tarifa (
        voo_id, voo_ligado_id, companhia_id, aeroporto_id, categoria_aeroporto,
        mtow_kg, taxa_cambio_usd_aoa, tempo_permanencia_horas,
        data_calculo, tipo_tarifa, numero_voo,
        tarifa_pouso_usd,       tarifa_pouso,
        tarifa_permanencia_usd, tarifa_permanencia,
        tarifa_passageiros_usd, tarifa_passageiros,
        tarifa_carga_usd,       tarifa_carga,
        outras_tarifas_usd,     outras_tarifas,
        tarifa_recursos_usd,    tarifa_recursos,
        total_tarifa_usd,       total_tarifa,
        periodo_noturno, detalhes_calculo, empresa_id
    ) VALUES (
        v_dep.id,
        p_voo_ligado_id,
        (SELECT id FROM companhia_aerea WHERE codigo_icao = v_arr.companhia_aerea OR codigo_iata = v_arr.companhia_aerea LIMIT 1),
        v_aero.id,
        v_categoria,
        v_mtow_kg,
        v_taxa_cambio,
        v_tempo_horas,
        NOW(),
        'Tarifas Aeroportuárias',
        COALESCE(v_arr.numero_voo, v_dep.numero_voo),
        -- USD values
        v_pouso_usd,
        round2(v_pouso_usd * v_taxa_cambio),
        v_permanencia_usd,
        round2(v_permanencia_usd * v_taxa_cambio),
        v_passageiros_usd,
        round2(v_passageiros_usd * v_taxa_cambio),
        v_carga_usd,
        round2(v_carga_usd * v_taxa_cambio),
        v_outras_usd,
        round2(v_outras_usd * v_taxa_cambio),
        v_recursos_usd,
        round2(v_recursos_usd * v_taxa_cambio),
        -- Totals
        v_total_usd,
        round2(v_total_usd * v_taxa_cambio),
        -- Metadata
        v_periodo_noturno,
        v_detalhes,
        v_empresa_id
    )
    RETURNING id INTO v_result_id;

    -- =========================================================
    -- STEP 16: RETURN the calculo_tarifa record
    -- =========================================================
    RETURN QUERY SELECT * FROM calculo_tarifa WHERE id = v_result_id;
END;
$$;


-- ============================================================
-- 2. calculate_tariffs_batch(p_voo_ligado_ids UUID[])
--    Calculates tariffs for a specific list of voo_ligado IDs.
--    Returns the count of successfully calculated tariffs.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_tariffs_batch(p_voo_ligado_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id    UUID;
    v_count INTEGER := 0;
BEGIN
    FOREACH v_id IN ARRAY p_voo_ligado_ids
    LOOP
        BEGIN
            PERFORM calculate_tariff(v_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but continue with next voo_ligado
            RAISE WARNING 'calculate_tariff failed for voo_ligado %: %', v_id, SQLERRM;
        END;
    END LOOP;

    RETURN v_count;
END;
$$;


-- ============================================================
-- 3. calculate_all_pending_tariffs(p_empresa_id UUID)
--    Calculates tariffs for ALL voo_ligado belonging to the
--    empresa that don't yet have a calculo_tarifa record.
--    Returns the count of successfully calculated tariffs.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_all_pending_tariffs(p_empresa_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id    UUID;
    v_count INTEGER := 0;
BEGIN
    FOR v_id IN
        SELECT vl.id
        FROM voo_ligado vl
        WHERE vl.empresa_id = p_empresa_id
          AND NOT EXISTS (
              SELECT 1 FROM calculo_tarifa ct
              WHERE ct.voo_ligado_id = vl.id
          )
        ORDER BY vl.created_date DESC NULLS LAST
    LOOP
        BEGIN
            PERFORM calculate_tariff(v_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'calculate_tariff failed for voo_ligado %: %', v_id, SQLERRM;
        END;
    END LOOP;

    RETURN v_count;
END;
$$;


-- ============================================================
-- 4. get_calculo_map(p_empresa_id UUID)
--    Returns a lightweight map of all calculo_tarifa records
--    for a given empresa. Used by the UI to display tariff
--    totals without fetching full records.
-- ============================================================
CREATE OR REPLACE FUNCTION get_calculo_map(p_empresa_id UUID)
RETURNS TABLE (
    voo_dep_id     UUID,
    voo_ligado_id  UUID,
    total_tarifa_usd NUMERIC,
    total_tarifa   NUMERIC,
    tipo_tarifa    TEXT,
    taxa_cambio    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        ct.voo_id       AS voo_dep_id,
        ct.voo_ligado_id,
        ct.total_tarifa_usd,
        ct.total_tarifa,
        ct.tipo_tarifa,
        ct.taxa_cambio_usd_aoa AS taxa_cambio
    FROM calculo_tarifa ct
    WHERE ct.empresa_id = p_empresa_id;
$$;

GRANT EXECUTE ON FUNCTION get_calculo_map(UUID) TO authenticated;


-- ============================================================
-- Grant execute to authenticated users (via RLS the data is
-- already scoped by empresa_id in the underlying tables)
-- ============================================================
GRANT EXECUTE ON FUNCTION calculate_tariff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_tariffs_batch(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_all_pending_tariffs(UUID) TO authenticated;


-- ============================================================
-- Comments
-- ============================================================
COMMENT ON FUNCTION calculate_tariff IS
    'Calculates all tariff components for a single voo_ligado and upserts into calculo_tarifa. '
    'Algorithm matches the JS tariffCalculations.jsx logic: cumulative landing brackets, '
    'tiered permanence (2h free, +50% after 6h), passengers/cargo/lighting/security/transit/CUPPSS, '
    'resources, services, taxes. Returns the calculo_tarifa record.';

COMMENT ON FUNCTION calculate_tariffs_batch IS
    'Calculates tariffs for a batch of voo_ligado IDs. Skips failures with warnings. Returns count of successes.';

COMMENT ON FUNCTION calculate_all_pending_tariffs IS
    'Calculates tariffs for all voo_ligado of a given empresa that have no calculo_tarifa yet. Returns count.';
