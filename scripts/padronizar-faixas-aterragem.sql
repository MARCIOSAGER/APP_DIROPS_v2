-- ============================================================
-- Padroniza os escalões de peso da tarifa_pouso (aterragem).
-- PROBLEMA: o 1º escalão estava definido como 0-10000 E 1-10000 kg, e o último
-- como 150001-999999 E 150001-1000000. Como o motor calculate_tariff faz
-- DISTINCT ON (faixa_min, faixa_max) e essas variantes têm limites diferentes,
-- ele processava AS DUAS -> contava o escalão em DOBRO -> SOBRECOBRANÇA no pouso
-- (ex.: Cat1 doméstico +45,30 USD por aterragem; internacional +72,10).
-- FIX: normaliza os limites (0-10000 e 150001-1000000) e remove a cópia exata.
-- Só mexe nos limites (não muda valores de tarifa). Backup + verificação.
-- ============================================================
BEGIN;

DROP TABLE IF EXISTS tarifa_pouso_bk_faixas_20260706;
CREATE TABLE tarifa_pouso_bk_faixas_20260706 AS SELECT * FROM tarifa_pouso;

-- 1) normaliza os limites dos escalões extremos
UPDATE tarifa_pouso SET faixa_min = 0        WHERE faixa_min = 1      AND faixa_max = 10000;
UPDATE tarifa_pouso SET faixa_max = 1000000  WHERE faixa_min = 150001 AND faixa_max = 999999;

-- 2) agora as variantes viraram cópias EXATAS -> dedup (mantém menor id)
DELETE FROM tarifa_pouso t USING tarifa_pouso k
  WHERE t.id > k.id
    AND t.categoria_aeroporto   IS NOT DISTINCT FROM k.categoria_aeroporto
    AND t.faixa_min             IS NOT DISTINCT FROM k.faixa_min
    AND t.faixa_max             IS NOT DISTINCT FROM k.faixa_max
    AND t.empresa_id            IS NOT DISTINCT FROM k.empresa_id
    AND t.tarifa_domestica      IS NOT DISTINCT FROM k.tarifa_domestica
    AND t.tarifa_internacional  IS NOT DISTINCT FROM k.tarifa_internacional
    AND t.status                IS NOT DISTINCT FROM k.status;

COMMIT;

-- Verificação: cada categoria deve ter exatamente 5 escalões (por empresa/global)
SELECT categoria_aeroporto, faixa_min, faixa_max, count(*) AS n
  FROM tarifa_pouso WHERE status = 'ativa'
  GROUP BY 1,2,3 ORDER BY 1, faixa_min;
