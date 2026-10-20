-- ============================================================================
-- 089_security_rls_hardening.sql
-- Endurecimento de RLS — Auditoria de Segurança 2026-08-29.
-- Fecha: F-01 (api_key aberta a qualquer autenticado), F-04 (movimento_financeiro
--        cross-tenant + inserção livre), F-05 (facturacao_trafego_pp legível por anon
--        + inserção livre), F-10 (plano_acao_corretiva permissiva).
--
-- IDEMPOTENTE: substitui as políticas EXISTENTES pelos mesmos nomes (DROP+CREATE),
-- por isso pode ser reaplicada. Não toca na política de service_role.
-- Depende dos helpers já existentes: is_admin(), is_superadmin(), current_user_empresa_id().
--
-- APLICAR (produção on-premise):
--   $psql = "C:\dirops\sga-onpremise\postgres\bin\psql.exe"
--   $dburl = (Select-String -Path "C:\dirops\sga-onpremise\config\auth.env" -Pattern 'postgres://[^\s"?]+' | Select-Object -First 1).Matches[0].Value
--   & $psql -d $dburl -f "C:\dirops\APP_DIROPS_v2\supabase\089_security_rls_hardening.sql"
--
-- VERIFICAR depois (deve NEGAR / 0 linhas):
--   SET ROLE anon; SELECT count(*) FROM facturacao_trafego_pp; RESET ROLE;   -- erro/negado
--   SET ROLE authenticated; SELECT count(*) FROM api_key; RESET ROLE;        -- 0 (sem is_admin)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- F-01  api_key : chaves de API (hash) — só admin da própria empresa / superadmin.
--        Antes: SELECT/INSERT/UPDATE/DELETE a authenticated USING(true).
-- ---------------------------------------------------------------------------
ALTER TABLE api_key ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_key_select ON api_key;
CREATE POLICY api_key_select ON api_key FOR SELECT TO authenticated
  USING (is_superadmin() OR (is_admin() AND empresa_id = current_user_empresa_id()));

DROP POLICY IF EXISTS api_key_insert ON api_key;
CREATE POLICY api_key_insert ON api_key FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (is_admin() AND empresa_id = current_user_empresa_id()));

DROP POLICY IF EXISTS api_key_update ON api_key;
CREATE POLICY api_key_update ON api_key FOR UPDATE TO authenticated
  USING (is_superadmin() OR (is_admin() AND empresa_id = current_user_empresa_id()))
  WITH CHECK (is_superadmin() OR (is_admin() AND empresa_id = current_user_empresa_id()));

DROP POLICY IF EXISTS api_key_delete ON api_key;
CREATE POLICY api_key_delete ON api_key FOR DELETE TO authenticated
  USING (is_superadmin() OR (is_admin() AND empresa_id = current_user_empresa_id()));
-- (api_key_service — service_role ALL — mantém-se intacta.)

-- ---------------------------------------------------------------------------
-- F-04  movimento_financeiro : sem coluna empresa_id -> escopo por junção ao aeroporto.
--        Antes: SELECT USING(true) (cross-tenant), INSERT WITH CHECK(true).
-- ---------------------------------------------------------------------------
ALTER TABLE movimento_financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_select_movimento_financeiro ON movimento_financeiro;
CREATE POLICY log_select_movimento_financeiro ON movimento_financeiro FOR SELECT TO authenticated
  USING (is_superadmin() OR EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = movimento_financeiro.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL)));

DROP POLICY IF EXISTS log_insert_movimento_financeiro ON movimento_financeiro;
CREATE POLICY log_insert_movimento_financeiro ON movimento_financeiro FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (is_admin() AND EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = movimento_financeiro.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL))));

DROP POLICY IF EXISTS log_update_movimento_financeiro ON movimento_financeiro;
CREATE POLICY log_update_movimento_financeiro ON movimento_financeiro FOR UPDATE TO authenticated
  USING (is_superadmin() OR (is_admin() AND EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = movimento_financeiro.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL))))
  WITH CHECK (is_superadmin() OR (is_admin() AND EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = movimento_financeiro.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL))));

DROP POLICY IF EXISTS log_delete_movimento_financeiro ON movimento_financeiro;
CREATE POLICY log_delete_movimento_financeiro ON movimento_financeiro FOR DELETE TO authenticated
  USING (is_superadmin() OR (is_admin() AND EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = movimento_financeiro.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL))));

-- ---------------------------------------------------------------------------
-- F-10  plano_acao_corretiva : escopo por junção ao aeroporto (tem aeroporto_id).
--        Antes: ALL a authenticated USING(true) WITH CHECK(true).
-- ---------------------------------------------------------------------------
ALTER TABLE plano_acao_corretiva ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_select_plano_acao_corretiva ON plano_acao_corretiva;
CREATE POLICY authenticated_select_plano_acao_corretiva ON plano_acao_corretiva FOR SELECT TO authenticated
  USING (is_superadmin() OR EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = plano_acao_corretiva.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL)));

DROP POLICY IF EXISTS authenticated_insert_plano_acao_corretiva ON plano_acao_corretiva;
CREATE POLICY authenticated_insert_plano_acao_corretiva ON plano_acao_corretiva FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = plano_acao_corretiva.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL)));

DROP POLICY IF EXISTS authenticated_update_plano_acao_corretiva ON plano_acao_corretiva;
CREATE POLICY authenticated_update_plano_acao_corretiva ON plano_acao_corretiva FOR UPDATE TO authenticated
  USING (is_superadmin() OR EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = plano_acao_corretiva.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL)))
  WITH CHECK (is_superadmin() OR EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = plano_acao_corretiva.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL)));

DROP POLICY IF EXISTS authenticated_delete_plano_acao_corretiva ON plano_acao_corretiva;
CREATE POLICY authenticated_delete_plano_acao_corretiva ON plano_acao_corretiva FOR DELETE TO authenticated
  USING (is_superadmin() OR (is_admin() AND EXISTS (
    SELECT 1 FROM aeroporto a WHERE a.id = plano_acao_corretiva.aeroporto_id
      AND (a.empresa_id = current_user_empresa_id() OR a.empresa_id IS NULL))));

-- ---------------------------------------------------------------------------
-- F-05  facturacao_trafego_pp : sem coluna de tenant.
--        Remover leitura por anon (exigir login); inserção só admin.
--        (UPDATE/DELETE já exigiam is_admin — mantêm-se.)
-- ---------------------------------------------------------------------------
ALTER TABLE facturacao_trafego_pp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_select_fact_pp ON facturacao_trafego_pp;   -- remove leitura anónima

DROP POLICY IF EXISTS fact_pp_insert ON facturacao_trafego_pp;
CREATE POLICY fact_pp_insert ON facturacao_trafego_pp FOR INSERT TO authenticated
  WITH CHECK (is_admin());

COMMIT;
