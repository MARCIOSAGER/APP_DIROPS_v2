-- ============================================================
-- (a) Limpeza de voo_ligado mortos/soltos (varredura integridade 2026-07-06)
--   - 31 pares com AMBAS as pernas deletadas
--   -  3 pares com uma perna deletada E a sobrevivente NÃO aponta mais aqui
--   Só remove os que NÃO têm cálculo (guarda anti-perda de faturação).
--   Antes de apagar o voo_ligado, zera voo.voo_ligado_id que aponte p/ ele
--   (evita violar FK). Backup completo. Reversível.
-- ============================================================
BEGIN;

DROP TABLE IF EXISTS voo_ligado_bk_mortos_20260706;
CREATE TABLE voo_ligado_bk_mortos_20260706 AS
  SELECT vl.* FROM voo_ligado vl
  JOIN voo arr ON arr.id = vl.id_voo_arr
  JOIN voo dep ON dep.id = vl.id_voo_dep
  WHERE (
        (arr.deleted_at IS NOT NULL AND dep.deleted_at IS NOT NULL)               -- ambas mortas
     OR ( (arr.deleted_at IS NOT NULL) <> (dep.deleted_at IS NOT NULL)            -- uma morta...
          AND NOT ( (arr.deleted_at IS NOT NULL AND dep.deleted_at IS NULL AND dep.voo_ligado_id = vl.id)
                 OR (dep.deleted_at IS NOT NULL AND arr.deleted_at IS NULL AND arr.voo_ligado_id = vl.id) ) ) -- ...e sobrevivente não aponta aqui
      )
    AND NOT EXISTS (SELECT 1 FROM calculo_tarifa ct WHERE ct.voo_ligado_id = vl.id);

-- soltar referências voo -> voo_ligado antes de apagar (FK-safe)
UPDATE voo SET voo_ligado_id = NULL, updated_date = now()
  WHERE voo_ligado_id IN (SELECT id FROM voo_ligado_bk_mortos_20260706);

DELETE FROM voo_ligado WHERE id IN (SELECT id FROM voo_ligado_bk_mortos_20260706);

COMMIT;

-- Verificação
SELECT 'pares removidos (backup)' AS item, count(*) AS n FROM voo_ligado_bk_mortos_20260706;
