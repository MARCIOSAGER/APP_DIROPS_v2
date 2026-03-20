-- Recalculate ALL tariffs for both empresas
-- This forces recalculation with the corrected function (IATA/ICAO + Internacional fix)

-- Recalculate SGA
DO $$
DECLARE
    v_id UUID;
    v_count INTEGER := 0;
    v_err INTEGER := 0;
BEGIN
    FOR v_id IN
        SELECT vl.id FROM voo_ligado vl
        WHERE vl.empresa_id = '128bc692-3fae-4825-9c55-40565dbedcfb'
        ORDER BY vl.created_date DESC
    LOOP
        BEGIN
            PERFORM calculate_tariff(v_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            v_err := v_err + 1;
            RAISE WARNING 'SGA erro voo_ligado %: %', v_id, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'SGA: % sucesso, % erros', v_count, v_err;
END;
$$;

-- Recalculate ATO
DO $$
DECLARE
    v_id UUID;
    v_count INTEGER := 0;
    v_err INTEGER := 0;
BEGIN
    FOR v_id IN
        SELECT vl.id FROM voo_ligado vl
        WHERE vl.empresa_id = '031274b1-d4eb-42a6-8080-44c0bb31a455'
        ORDER BY vl.created_date DESC
    LOOP
        BEGIN
            PERFORM calculate_tariff(v_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            v_err := v_err + 1;
            RAISE WARNING 'ATO erro voo_ligado %: %', v_id, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'ATO: % sucesso, % erros', v_count, v_err;
END;
$$;
