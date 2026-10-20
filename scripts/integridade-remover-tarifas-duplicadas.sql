-- ============================================================
-- Remove tarifas DUPLICADAS (double-count) — varredura integridade 2026-07-06.
--   76 pares "quebrados" (perna deletada = duplicata de um twin ativo) têm um
--   cálculo que DUPLICA o cálculo do par CORRETO (o do twin). A mesma operação
--   foi precificada 2x (~36,4M Kz). Remove só o cálculo do par QUEBRADO; o do
--   par correto (twin ativo) permanece. Guarda anti-proforma. Backup. Reversível.
-- ============================================================
BEGIN;

DROP TABLE IF EXISTS calculo_tarifa_bk_double_20260706;
CREATE TABLE calculo_tarifa_bk_double_20260706 AS
WITH broken AS (
  SELECT vl.id AS vlid,
    CASE WHEN arr.deleted_at IS NOT NULL THEN arr.numero_voo        ELSE dep.numero_voo        END AS nv,
    CASE WHEN arr.deleted_at IS NOT NULL THEN arr.data_operacao     ELSE dep.data_operacao     END AS dop,
    CASE WHEN arr.deleted_at IS NOT NULL THEN arr.aeroporto_operacao ELSE dep.aeroporto_operacao END AS aero,
    CASE WHEN arr.deleted_at IS NOT NULL THEN arr.tipo_movimento    ELSE dep.tipo_movimento    END AS mov
  FROM voo_ligado vl
  JOIN voo arr ON arr.id = vl.id_voo_arr
  JOIN voo dep ON dep.id = vl.id_voo_dep
  WHERE (arr.deleted_at IS NOT NULL) <> (dep.deleted_at IS NOT NULL)
    AND ((arr.deleted_at IS NOT NULL AND dep.deleted_at IS NULL AND dep.voo_ligado_id = vl.id)
      OR (dep.deleted_at IS NOT NULL AND arr.deleted_at IS NULL AND arr.voo_ligado_id = vl.id))
),
dup AS (
  SELECT b.vlid,
    (SELECT t.voo_ligado_id FROM voo t
       WHERE t.deleted_at IS NULL AND t.numero_voo = b.nv AND t.data_operacao = b.dop
         AND t.aeroporto_operacao = b.aero AND t.tipo_movimento = b.mov
         AND t.voo_ligado_id IS NOT NULL AND t.voo_ligado_id <> b.vlid
       LIMIT 1) AS par_correto
  FROM broken b
)
SELECT ct.* FROM calculo_tarifa ct
JOIN dup ON dup.vlid = ct.voo_ligado_id
WHERE dup.par_correto IS NOT NULL
  AND EXISTS (SELECT 1 FROM calculo_tarifa c2 WHERE c2.voo_ligado_id = dup.par_correto)   -- o par correto tambem tem calculo
  AND NOT EXISTS (SELECT 1 FROM proforma_item pi WHERE pi.calculo_tarifa_id = ct.id)      -- nao faturado
  AND NOT EXISTS (SELECT 1 FROM proforma p        WHERE p.calculo_tarifa_id = ct.id);

DELETE FROM calculo_tarifa WHERE id IN (SELECT id FROM calculo_tarifa_bk_double_20260706);

COMMIT;

-- Verificação
SELECT 'calculos duplicados removidos' AS item, count(*) AS n,
       round(coalesce(sum(total_tarifa),0)) AS kz FROM calculo_tarifa_bk_double_20260706;
