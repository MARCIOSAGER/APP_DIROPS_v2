-- ============================================================
-- Remove todas as tarifas atribuídas à ATO (Autoridade do Transporte Aéreo).
-- A ATO é REGULADORA e tem 0 voos -> nenhuma tarifa dela é usada em faturação.
-- Numa plataforma só-SGA, é config morta. (O valor 197,88 da Pista 23/05 fica
-- documentado no RTA em docs/ — não se perde informação.)
-- Backup + verificação. Reversível.
-- ============================================================
BEGIN;

DROP TABLE IF EXISTS tarifas_ato_bk_20260706;
CREATE TABLE tarifas_ato_bk_20260706 AS
  SELECT 'outra_tarifa' AS tab, id, empresa_id FROM outra_tarifa
    WHERE empresa_id IN (SELECT id FROM empresa WHERE tipo='reguladora' OR nome ILIKE 'ATO%')
  UNION ALL
  SELECT 'tarifa_pouso', id, empresa_id FROM tarifa_pouso
    WHERE empresa_id IN (SELECT id FROM empresa WHERE tipo='reguladora' OR nome ILIKE 'ATO%')
  UNION ALL
  SELECT 'tarifa_permanencia', id, empresa_id FROM tarifa_permanencia
    WHERE empresa_id IN (SELECT id FROM empresa WHERE tipo='reguladora' OR nome ILIKE 'ATO%');

DELETE FROM outra_tarifa        WHERE empresa_id IN (SELECT id FROM empresa WHERE tipo='reguladora' OR nome ILIKE 'ATO%');
DELETE FROM tarifa_pouso        WHERE empresa_id IN (SELECT id FROM empresa WHERE tipo='reguladora' OR nome ILIKE 'ATO%');
DELETE FROM tarifa_permanencia  WHERE empresa_id IN (SELECT id FROM empresa WHERE tipo='reguladora' OR nome ILIKE 'ATO%');

COMMIT;

-- Verificação: 0 tarifas por-empresa ativas devem restar (só GLOBAL)
SELECT 'outra_tarifa'  AS tab, count(*) FILTER (WHERE empresa_id IS NOT NULL AND status='ativa') AS por_empresa_ativas FROM outra_tarifa
UNION ALL SELECT 'tarifa_pouso',       count(*) FILTER (WHERE empresa_id IS NOT NULL AND status='ativa') FROM tarifa_pouso
UNION ALL SELECT 'tarifa_permanencia', count(*) FILTER (WHERE empresa_id IS NOT NULL AND status='ativa') FROM tarifa_permanencia;
SELECT 'removidas (backup)' AS item, count(*) AS n FROM tarifas_ato_bk_20260706;
