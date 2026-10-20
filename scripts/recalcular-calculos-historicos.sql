-- ============================================================
-- RECÁLCULO dos cálculos de tarifa históricos com o motor corrigido.
-- RODAR *DEPOIS* de aplicar fix-motor-arredondamento-mtow.sql (Parte 1) e a
-- padronização das faixas (já aplicada). Corrige o double-count do pouso + o
-- arredondamento do MTOW nos valores JÁ gravados.
--
-- calculate_tariff() apaga o cálculo antigo e reinsere -> NÃO cria duplicados.
-- Como ele grava data_calculo = NOW(), restauramos a data ORIGINAL do backup
-- (senão relatórios por data de cálculo ficariam todos "hoje").
-- Erros pontuais (ex.: MTOW ausente, par com perna deletada) são pulados.
-- Backup completo + resumo antes/depois. Reversível.
-- ============================================================

-- 1) Backup
DROP TABLE IF EXISTS calculo_tarifa_bk_recalc_20260706;
CREATE TABLE calculo_tarifa_bk_recalc_20260706 AS SELECT * FROM calculo_tarifa;

-- 2) Recalcular cada voo ligado que tem cálculo (pulando erros)
DO $$
DECLARE r RECORD; n_ok int := 0; n_err int := 0;
BEGIN
  FOR r IN SELECT DISTINCT voo_ligado_id FROM calculo_tarifa_bk_recalc_20260706 WHERE voo_ligado_id IS NOT NULL LOOP
    BEGIN
      PERFORM calculate_tariff(r.voo_ligado_id);
      n_ok := n_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      n_err := n_err + 1;
    END;
  END LOOP;
  RAISE NOTICE 'Recalculados: % OK, % com erro (pulados, mantêm valor antigo)', n_ok, n_err;
END $$;

-- 3) Restaurar a data_calculo original (calculate_tariff usa NOW())
UPDATE calculo_tarifa c
  SET data_calculo = (SELECT min(b.data_calculo) FROM calculo_tarifa_bk_recalc_20260706 b WHERE b.voo_ligado_id = c.voo_ligado_id)
  WHERE EXISTS (SELECT 1 FROM calculo_tarifa_bk_recalc_20260706 b WHERE b.voo_ligado_id = c.voo_ligado_id);

-- 4) Antes x Depois (o pouso deve CAIR — some o escalão contado em dobro)
SELECT
  round(sum(b.tarifa_pouso_usd)) AS pouso_antes_usd,
  (SELECT round(sum(tarifa_pouso_usd)) FROM calculo_tarifa) AS pouso_depois_usd,
  round(sum(b.total_tarifa_usd))  AS total_antes_usd,
  (SELECT round(sum(total_tarifa_usd)) FROM calculo_tarifa)  AS total_depois_usd
FROM calculo_tarifa_bk_recalc_20260706 b;
