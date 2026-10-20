-- ============================================================
-- Dedup das tabelas de configuração de tarifas (integridade 2026-07-06).
--   Remove só CÓPIAS EXATAS (mesma categoria/faixa/tipo + MESMA empresa + MESMO
--   valor) — preserva tarifas legítimas por empresa e as globais. O motor usa
--   LIMIT 1, então isto não muda preços; só tira entulho e risco de edição.
--   IMPORTANTE: iluminação categoria_1 tem 87.30 (Pista 25/07) E 197.88 (Pista
--   23/05) — AMBOS são valores OFICIAIS do RTA-2015 (pistas diferentes), NÃO um
--   erro. O dedup por valor mantém os dois (só remove cópias exatas repetidas).
--   servico_voo não referencia nenhuma outra_tarifa (0 refs) -> deletar é seguro.
--   Backups completos por tabela. Reversível.
-- ============================================================
BEGIN;

DROP TABLE IF EXISTS tarifa_permanencia_bk_dup_20260706;
CREATE TABLE tarifa_permanencia_bk_dup_20260706 AS SELECT * FROM tarifa_permanencia;
DROP TABLE IF EXISTS tarifa_pouso_bk_dup_20260706;
CREATE TABLE tarifa_pouso_bk_dup_20260706 AS SELECT * FROM tarifa_pouso;
DROP TABLE IF EXISTS outra_tarifa_bk_dup_20260706;
CREATE TABLE outra_tarifa_bk_dup_20260706 AS SELECT * FROM outra_tarifa;

-- Dedup exato — mantém o menor id por grupo idêntico (valor faz parte da chave,
-- então 87.30 e 197.88 da iluminação cat_1 são preservados: 1 de cada).
DELETE FROM tarifa_permanencia t USING tarifa_permanencia k
  WHERE t.id > k.id
    AND t.categoria_aeroporto            IS NOT DISTINCT FROM k.categoria_aeroporto
    AND t.faixa_min                      IS NOT DISTINCT FROM k.faixa_min
    AND t.faixa_max                      IS NOT DISTINCT FROM k.faixa_max
    AND t.empresa_id                     IS NOT DISTINCT FROM k.empresa_id
    AND t.tarifa_usd_por_tonelada_hora   IS NOT DISTINCT FROM k.tarifa_usd_por_tonelada_hora
    AND t.status                         IS NOT DISTINCT FROM k.status;

DELETE FROM tarifa_pouso t USING tarifa_pouso k
  WHERE t.id > k.id
    AND t.categoria_aeroporto   IS NOT DISTINCT FROM k.categoria_aeroporto
    AND t.faixa_min             IS NOT DISTINCT FROM k.faixa_min
    AND t.faixa_max             IS NOT DISTINCT FROM k.faixa_max
    AND t.empresa_id            IS NOT DISTINCT FROM k.empresa_id
    AND t.tarifa_domestica      IS NOT DISTINCT FROM k.tarifa_domestica
    AND t.tarifa_internacional  IS NOT DISTINCT FROM k.tarifa_internacional
    AND t.status                IS NOT DISTINCT FROM k.status;

DELETE FROM outra_tarifa t USING outra_tarifa k
  WHERE t.id > k.id
    AND t.tipo                IS NOT DISTINCT FROM k.tipo
    AND t.tipo_operacao       IS NOT DISTINCT FROM k.tipo_operacao
    AND t.categoria_aeroporto IS NOT DISTINCT FROM k.categoria_aeroporto
    AND t.empresa_id          IS NOT DISTINCT FROM k.empresa_id
    AND t.valor               IS NOT DISTINCT FROM k.valor
    AND t.unidade             IS NOT DISTINCT FROM k.unidade
    AND t.status              IS NOT DISTINCT FROM k.status;

COMMIT;

-- Verificação: nenhum grupo exato deve ter >1 agora
SELECT 'estacionamento' AS tabela, count(*) AS ativas FROM tarifa_permanencia WHERE status = 'ativa'
UNION ALL SELECT 'aterragem', count(*) FROM tarifa_pouso    WHERE status = 'ativa'
UNION ALL SELECT 'outras',    count(*) FROM outra_tarifa    WHERE status = 'ativa';
