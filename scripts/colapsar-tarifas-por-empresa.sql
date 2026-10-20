-- ============================================================
-- Colapsa tarifas por-empresa redundantes -> 1 GLOBAL por categoria.
-- Contexto: além do GLOBAL (empresa_id NULL), existem linhas por-empresa (SGA
-- operadora, ATO reguladora c/ 0 voos) com o MESMO valor -> redundantes (o motor
-- usa empresa-first e cai no global igual). Só aparecem "duplicadas" na visão
-- superadmin ("todas as empresas"); na visão SGA já mostra 1 por categoria.
-- Remove só as linhas de empresa que DUPLICAM um valor global idêntico; preserva
-- o GLOBAL e qualquer override genuíno (valor diferente, ex.: iluminação 197,88
-- da Pista 23/05). Zero mudança de faturação. Backups por tabela.
-- ============================================================
BEGIN;

DROP TABLE IF EXISTS tarifa_permanencia_bk_colapso_20260706;
CREATE TABLE tarifa_permanencia_bk_colapso_20260706 AS SELECT * FROM tarifa_permanencia WHERE empresa_id IS NOT NULL;
DROP TABLE IF EXISTS tarifa_pouso_bk_colapso_20260706;
CREATE TABLE tarifa_pouso_bk_colapso_20260706 AS SELECT * FROM tarifa_pouso WHERE empresa_id IS NOT NULL;
DROP TABLE IF EXISTS outra_tarifa_bk_colapso_20260706;
CREATE TABLE outra_tarifa_bk_colapso_20260706 AS SELECT * FROM outra_tarifa WHERE empresa_id IS NOT NULL;

-- Estacionamento: remove por-empresa que iguala um global
DELETE FROM tarifa_permanencia t WHERE t.empresa_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM tarifa_permanencia g WHERE g.empresa_id IS NULL
    AND g.categoria_aeroporto          IS NOT DISTINCT FROM t.categoria_aeroporto
    AND g.faixa_min                    IS NOT DISTINCT FROM t.faixa_min
    AND g.faixa_max                    IS NOT DISTINCT FROM t.faixa_max
    AND g.tarifa_usd_por_tonelada_hora IS NOT DISTINCT FROM t.tarifa_usd_por_tonelada_hora
    AND g.status                       IS NOT DISTINCT FROM t.status);

-- Aterragem
DELETE FROM tarifa_pouso t WHERE t.empresa_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM tarifa_pouso g WHERE g.empresa_id IS NULL
    AND g.categoria_aeroporto  IS NOT DISTINCT FROM t.categoria_aeroporto
    AND g.faixa_min            IS NOT DISTINCT FROM t.faixa_min
    AND g.faixa_max            IS NOT DISTINCT FROM t.faixa_max
    AND g.tarifa_domestica     IS NOT DISTINCT FROM t.tarifa_domestica
    AND g.tarifa_internacional IS NOT DISTINCT FROM t.tarifa_internacional
    AND g.status               IS NOT DISTINCT FROM t.status);

-- Outras tarifas
DELETE FROM outra_tarifa t WHERE t.empresa_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM outra_tarifa g WHERE g.empresa_id IS NULL
    AND g.tipo                IS NOT DISTINCT FROM t.tipo
    AND g.tipo_operacao       IS NOT DISTINCT FROM t.tipo_operacao
    AND g.categoria_aeroporto IS NOT DISTINCT FROM t.categoria_aeroporto
    AND g.valor               IS NOT DISTINCT FROM t.valor
    AND g.unidade             IS NOT DISTINCT FROM t.unidade
    AND g.status              IS NOT DISTINCT FROM t.status);

COMMIT;

-- Verificação (esperado: 1 linha por categoria no estacionamento)
SELECT categoria_aeroporto, count(*) AS n, string_agg(coalesce(left(empresa_id::text,8),'GLOBAL'),',') AS empresas
  FROM tarifa_permanencia WHERE status='ativa' GROUP BY 1 ORDER BY 1;
