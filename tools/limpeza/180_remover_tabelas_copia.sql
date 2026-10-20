-- 180 — Remove as 22 tabelas de cópia temporária de correcções antigas (Junho–Julho 2026). Pedido do dono a 20/10/2026.
-- Arquivo completo antes de apagar: C:\dirops\sga-onpremise\backups\arquivo-tabelas\tabelas-copia-temporaria-20261020.dump
--   restaurar uma: pg_restore -h 127.0.0.1 -U postgres -d dirops_sga -t <tabela> <ficheiro.dump>
-- Verificado a 20/10/2026: nenhuma vista, chave estrangeira ou código depende delas.
BEGIN;
DROP TABLE IF EXISTS public._backup_voo_dedup_20260622;
DROP TABLE IF EXISTS public._bk_calc_78;
DROP TABLE IF EXISTS public._bk_companhia_dup_20260706;
DROP TABLE IF EXISTS public._bk_vligado_78;
DROP TABLE IF EXISTS public._bk_voo_46;
DROP TABLE IF EXISTS public._bk_voo_78;
DROP TABLE IF EXISTS public._bk_voo_famerge_20260706;
DROP TABLE IF EXISTS public.aeroporto_bk_empresa_20260706;
DROP TABLE IF EXISTS public.calculo_tarifa_bk_orfaos_20260706;
DROP TABLE IF EXISTS public.calculo_tarifa_bk_recalc_20260706;
DROP TABLE IF EXISTS public.configuracao_sistema_bk_20260706;
DROP TABLE IF EXISTS public.outra_tarifa_bk_colapso_20260706;
DROP TABLE IF EXISTS public.outra_tarifa_bk_dup_20260706;
DROP TABLE IF EXISTS public.tarifa_permanencia_bk_colapso_20260706;
DROP TABLE IF EXISTS public.tarifa_permanencia_bk_dup_20260706;
DROP TABLE IF EXISTS public.tarifa_pouso_bk_colapso_20260706;
DROP TABLE IF EXISTS public.tarifa_pouso_bk_dup_20260706;
DROP TABLE IF EXISTS public.tarifa_pouso_bk_faixas_20260706;
DROP TABLE IF EXISTS public.tarifas_ato_bk_20260706;
DROP TABLE IF EXISTS public.voo_bk_ligado_orfao_20260706;
DROP TABLE IF EXISTS public.voo_ligado_bk_mortos_20260706;
DROP TABLE IF EXISTS public.voo_ligado_repair_20260706;
COMMIT;
SELECT count(*) AS tabelas_copia_restantes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND (c.relname ~ '^_' OR c.relname ~ '_bk_|_bk$|^bk_|_repair_');
NOTIFY pgrst, 'reload schema';
