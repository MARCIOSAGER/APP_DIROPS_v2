-- ============================================================
-- (b) Reparo dos 20 pares meio-quebrados com TWIN único e LIVRE.
--   A perna deletada é duplicata de um voo ativo idêntico (mesmo nº/data/
--   aeroporto/movimento) que ainda NÃO está noutro par. Re-aponta o
--   voo_ligado para esse twin e linka o twin de volta. A tarifa (já calculada)
--   permanece válida. Só toca nos casos com EXATAMENTE 1 twin e 1 livre.
--   Staging = backup do estado antigo (old_arr/old_dep). Reversível.
-- ============================================================
BEGIN;

DROP TABLE IF EXISTS voo_ligado_repair_20260706;
CREATE TABLE voo_ligado_repair_20260706 AS
WITH broken AS (
  SELECT vl.id AS vlid, vl.id_voo_arr AS old_arr, vl.id_voo_dep AS old_dep,
    (arr.deleted_at IS NOT NULL) AS arr_del,
    CASE WHEN arr.deleted_at IS NOT NULL THEN arr.numero_voo        ELSE dep.numero_voo        END AS nv,
    CASE WHEN arr.deleted_at IS NOT NULL THEN arr.data_operacao     ELSE dep.data_operacao     END AS dop,
    CASE WHEN arr.deleted_at IS NOT NULL THEN arr.aeroporto_operacao ELSE dep.aeroporto_operacao END AS aero,
    CASE WHEN arr.deleted_at IS NOT NULL THEN arr.tipo_movimento    ELSE dep.tipo_movimento    END AS mov
  FROM voo_ligado vl
  JOIN voo arr ON arr.id = vl.id_voo_arr
  JOIN voo dep ON dep.id = vl.id_voo_dep
  WHERE (arr.deleted_at IS NOT NULL) <> (dep.deleted_at IS NOT NULL)
    AND ( (arr.deleted_at IS NOT NULL AND dep.deleted_at IS NULL AND dep.voo_ligado_id = vl.id)
       OR (dep.deleted_at IS NOT NULL AND arr.deleted_at IS NULL AND arr.voo_ligado_id = vl.id) )
)
SELECT b.vlid, b.arr_del, b.old_arr, b.old_dep,
  (SELECT t.id FROM voo t
     WHERE t.deleted_at IS NULL AND t.numero_voo = b.nv AND t.data_operacao = b.dop
       AND t.aeroporto_operacao = b.aero AND t.tipo_movimento = b.mov
       AND (t.voo_ligado_id IS NULL OR t.voo_ligado_id = b.vlid)
     LIMIT 1) AS twin_id
FROM broken b
WHERE (SELECT count(*) FROM voo t WHERE t.deleted_at IS NULL AND t.numero_voo = b.nv
          AND t.data_operacao = b.dop AND t.aeroporto_operacao = b.aero AND t.tipo_movimento = b.mov) = 1
  AND (SELECT count(*) FROM voo t WHERE t.deleted_at IS NULL AND t.numero_voo = b.nv
          AND t.data_operacao = b.dop AND t.aeroporto_operacao = b.aero AND t.tipo_movimento = b.mov
          AND (t.voo_ligado_id IS NULL OR t.voo_ligado_id = b.vlid)) = 1;

-- re-aponta a perna deletada para o twin
UPDATE voo_ligado vl SET
  id_voo_arr = CASE WHEN r.arr_del THEN r.twin_id ELSE vl.id_voo_arr END,
  id_voo_dep = CASE WHEN r.arr_del THEN vl.id_voo_dep ELSE r.twin_id END,
  updated_date = now()
FROM voo_ligado_repair_20260706 r WHERE vl.id = r.vlid;

-- linka o twin de volta ao par
UPDATE voo t SET voo_ligado_id = r.vlid, updated_date = now()
FROM voo_ligado_repair_20260706 r WHERE t.id = r.twin_id;

COMMIT;

-- Verificação
SELECT 'pares reparados (staging)' AS item, count(*) AS n FROM voo_ligado_repair_20260706
UNION ALL
SELECT 'ainda quebrados apos reparo (deve ser 0)', count(*)
  FROM voo_ligado_repair_20260706 r
  JOIN voo_ligado vl ON vl.id = r.vlid
  JOIN voo a ON a.id = vl.id_voo_arr
  JOIN voo d ON d.id = vl.id_voo_dep
  WHERE a.deleted_at IS NOT NULL OR d.deleted_at IS NOT NULL;
