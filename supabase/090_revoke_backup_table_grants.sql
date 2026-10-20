-- ============================================================================
-- 090_revoke_backup_table_grants.sql
-- F-03 (Auditoria de Segurança 2026-08-29): as ~22 tabelas de backup (_bk_*/_backup_*)
-- têm RLS DESLIGADO e concediam SELECT a anon e escrita a authenticated -> eram
-- legíveis via PostgREST (mesmo sem login, com a anon key pública) e apagáveis.
--
-- Nesta BD, TODAS as tabelas base sem RLS no schema public são exatamente essas
-- cópias de backup (as tabelas da app têm RLS). Este script revoga o acesso de
-- anon/authenticated a essas tabelas -> o PostgREST deixa de as expor.
-- NÃO destrói dados (podes fazer DROP delas mais tarde, quando confirmares que já
-- não são precisas).
--
-- APLICAR:
--   & $psql -d $dburl -f "C:\dirops\APP_DIROPS_v2\supabase\090_revoke_backup_table_grants.sql"
-- VERIFICAR depois (deve dar erro de permissão, não 0 linhas):
--   SET ROLE anon; SELECT count(*) FROM _bk_voo_78; RESET ROLE;
-- ============================================================================

DO $$
DECLARE
  t text;
  n int := 0;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity      -- sem RLS = (nesta BD) tabela de backup
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    n := n + 1;
    RAISE NOTICE 'F-03: revogado anon/authenticated em %', t;
  END LOOP;
  RAISE NOTICE 'F-03: total de tabelas de backup fechadas ao PostgREST: %', n;
END $$;
