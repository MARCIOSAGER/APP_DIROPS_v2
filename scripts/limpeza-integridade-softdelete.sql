-- ============================================================
-- Limpeza de artefatos de soft-delete (varredura de integridade 2026-07-06)
--   1) Remove calculo_tarifa órfão: aponta p/ voo DELETADO e NÃO está em
--      nenhuma proforma (header nem item). São ~74 cálculos (~117M Kz) que
--      nunca foram faturados e só inflam relatórios que não filtram deleted_at.
--   2) Zera voo_ligado_id de voos ATIVOS que apontam p/ um voo_ligado que
--      já não existe (6 voos) — deixa re-linkar corretamente.
-- Faz backup antes de cada passo. Reversível. NÃO toca em nada faturado.
-- ============================================================
BEGIN;

-- ---- 1) calculo_tarifa órfão (voo deletado, fora de proformas) ----
DROP TABLE IF EXISTS calculo_tarifa_bk_orfaos_20260706;
CREATE TABLE calculo_tarifa_bk_orfaos_20260706 AS
  SELECT ct.* FROM calculo_tarifa ct
  WHERE EXISTS (SELECT 1 FROM voo v WHERE v.id = ct.voo_id AND v.deleted_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM proforma_item pi WHERE pi.calculo_tarifa_id = ct.id)
    AND NOT EXISTS (SELECT 1 FROM proforma p        WHERE p.calculo_tarifa_id = ct.id);

DELETE FROM calculo_tarifa ct
  WHERE EXISTS (SELECT 1 FROM voo v WHERE v.id = ct.voo_id AND v.deleted_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM proforma_item pi WHERE pi.calculo_tarifa_id = ct.id)
    AND NOT EXISTS (SELECT 1 FROM proforma p        WHERE p.calculo_tarifa_id = ct.id);

-- ---- 2) voos ATIVOS com voo_ligado_id apontando p/ ligado inexistente ----
DROP TABLE IF EXISTS voo_bk_ligado_orfao_20260706;
CREATE TABLE voo_bk_ligado_orfao_20260706 AS
  SELECT v.id, v.numero_voo, v.data_operacao, v.voo_ligado_id
  FROM voo v
  WHERE v.deleted_at IS NULL
    AND v.voo_ligado_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM voo_ligado vl WHERE vl.id = v.voo_ligado_id);

UPDATE voo v SET voo_ligado_id = NULL, updated_date = now()
  WHERE v.deleted_at IS NULL
    AND v.voo_ligado_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM voo_ligado vl WHERE vl.id = v.voo_ligado_id);

COMMIT;

-- ---- Verificação ----
SELECT 'calculos removidos (backup)' AS item, count(*) AS n FROM calculo_tarifa_bk_orfaos_20260706
UNION ALL
SELECT 'voos re-abertos p/ link (backup)', count(*) FROM voo_bk_ligado_orfao_20260706
UNION ALL
SELECT 'RESTAM calc orfaos (deve ser 0 exceto os em proforma)', count(*) FROM calculo_tarifa ct
  WHERE EXISTS (SELECT 1 FROM voo v WHERE v.id = ct.voo_id AND v.deleted_at IS NOT NULL)
UNION ALL
SELECT 'RESTAM voos ativos c/ link orfao (deve ser 0)', count(*) FROM voo v
  WHERE v.deleted_at IS NULL AND v.voo_ligado_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM voo_ligado vl WHERE vl.id = v.voo_ligado_id);
