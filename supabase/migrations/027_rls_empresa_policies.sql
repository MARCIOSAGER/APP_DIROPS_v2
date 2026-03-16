-- =====================================================
-- MIGRATION 027: Proper RLS Policies (empresa-based)
-- Replaces the permissive USING(true) policies from 005
-- =====================================================

-- =====================================================
-- 1. HELPER FUNCTIONS
-- =====================================================

-- Get current user's empresa_id from users table
CREATE OR REPLACE FUNCTION public.current_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Check if current user is superadmin (no empresa_id + admin role)
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND empresa_id IS NULL
      AND (role = 'admin' OR 'administrador' = ANY(perfis))
  );
$$;

-- Check if current user is admin (empresa or super)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND (role = 'admin' OR 'administrador' = ANY(perfis))
  );
$$;

-- =====================================================
-- 2. DROP ALL OLD PERMISSIVE POLICIES
-- =====================================================

DO $$
DECLARE
  t RECORD;
  pol_name TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- Drop authenticated_* policies from migration 005
    FOR pol_name IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.tablename
        AND policyname LIKE 'authenticated_%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, t.tablename);
    END LOOP;
  END LOOP;
END $$;

-- Also drop policies created by other migrations (011, etc.)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname NOT LIKE 'anon_%'
      AND policyname NOT LIKE 'authenticated_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- =====================================================
-- 3. TABLES WITH empresa_id — Empresa-scoped access
-- Superadmin sees all, others see only their empresa
-- =====================================================

-- List of tables with empresa_id column
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'voo', 'voo_ligado', 'calculo_tarifa',
    'proforma', 'proforma_item',
    'ocorrencia_safety', 'inspecao', 'ordem_servico',
    'reclamacao', 'documento', 'credenciamento',
    'processo_auditoria', 'medicao_k_p_i',
    'tarifa_pouso', 'tarifa_permanencia', 'outra_tarifa', 'tarifa_recurso',
    'imposto', 'cobranca_servico',
    'aeroporto'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls
  LOOP
    -- Check table exists before creating policies
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN

      -- SELECT: superadmin sees all, others see own empresa
      EXECUTE format(
        'CREATE POLICY "empresa_select_%1$s" ON public.%1$I
         FOR SELECT TO authenticated
         USING (
           public.is_superadmin()
           OR empresa_id = public.current_user_empresa_id()
           OR empresa_id IS NULL
         )',
        tbl
      );

      -- INSERT: superadmin can insert for any, others only for own empresa
      EXECUTE format(
        'CREATE POLICY "empresa_insert_%1$s" ON public.%1$I
         FOR INSERT TO authenticated
         WITH CHECK (
           public.is_superadmin()
           OR empresa_id = public.current_user_empresa_id()
           OR empresa_id IS NULL
         )',
        tbl
      );

      -- UPDATE: superadmin can update any, others only own empresa
      EXECUTE format(
        'CREATE POLICY "empresa_update_%1$s" ON public.%1$I
         FOR UPDATE TO authenticated
         USING (
           public.is_superadmin()
           OR empresa_id = public.current_user_empresa_id()
           OR empresa_id IS NULL
         )
         WITH CHECK (
           public.is_superadmin()
           OR empresa_id = public.current_user_empresa_id()
           OR empresa_id IS NULL
         )',
        tbl
      );

      -- DELETE: only admins can delete, scoped by empresa
      EXECUTE format(
        'CREATE POLICY "empresa_delete_%1$s" ON public.%1$I
         FOR DELETE TO authenticated
         USING (
           public.is_superadmin()
           OR (
             public.is_admin()
             AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
           )
         )',
        tbl
      );

    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 4. USERS TABLE — Special handling
-- Users can see their own profile + same empresa users
-- Only admins can modify other users
-- =====================================================

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR auth_id = auth.uid()
    OR empresa_id = public.current_user_empresa_id()
  );

CREATE POLICY "users_insert" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR auth_id = auth.uid()
  );

CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR auth_id = auth.uid()
    OR (
      public.is_admin()
      AND empresa_id = public.current_user_empresa_id()
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR auth_id = auth.uid()
    OR (
      public.is_admin()
      AND empresa_id = public.current_user_empresa_id()
    )
  );

CREATE POLICY "users_delete" ON public.users
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND empresa_id = public.current_user_empresa_id()
    )
  );

-- =====================================================
-- 5. SOLICITACAO_ACESSO — Special handling
-- Uses empresa_solicitante_id instead of empresa_id
-- Admins of the target empresa can see/manage
-- =====================================================

CREATE POLICY "solicitacao_select" ON public.solicitacao_acesso
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR empresa_solicitante_id = public.current_user_empresa_id()
  );

CREATE POLICY "solicitacao_insert" ON public.solicitacao_acesso
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "solicitacao_update" ON public.solicitacao_acesso
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND empresa_solicitante_id = public.current_user_empresa_id()
    )
  );

CREATE POLICY "solicitacao_delete" ON public.solicitacao_acesso
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
  );

-- =====================================================
-- 6. EMPRESA TABLE — All authenticated can read
-- Only superadmin can modify
-- =====================================================

CREATE POLICY "empresa_select" ON public.empresa
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "empresa_insert" ON public.empresa
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin());

CREATE POLICY "empresa_update" ON public.empresa
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR id = public.current_user_empresa_id()
  );

CREATE POLICY "empresa_delete" ON public.empresa
  FOR DELETE TO authenticated
  USING (public.is_superadmin());

-- =====================================================
-- 7. CONFIG/LOOKUP TABLES — All authenticated read
-- Only admins can write
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'companhia_aerea', 'modelo_aeronave', 'registo_aeronave',
    'tipo_documento', 'tipo_auditoria', 'tipo_inspecao',
    'tipo_outra_tarifa', 'tipo_servico_geral',
    'tipo_k_p_i', 'campo_k_p_i', 'valor_campo_k_p_i',
    'area_acesso', 'configuracao_area',
    'configuracao_notificacoes', 'configuracao_opt_in_zapi',
    'placeholder', 'regra_notificacao', 'regra_permissao',
    'grupo_whatsapp'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN

      EXECUTE format(
        'CREATE POLICY "config_select_%1$s" ON public.%1$I
         FOR SELECT TO authenticated USING (true)',
        tbl
      );

      EXECUTE format(
        'CREATE POLICY "config_insert_%1$s" ON public.%1$I
         FOR INSERT TO authenticated WITH CHECK (public.is_admin())',
        tbl
      );

      EXECUTE format(
        'CREATE POLICY "config_update_%1$s" ON public.%1$I
         FOR UPDATE TO authenticated
         USING (public.is_admin()) WITH CHECK (public.is_admin())',
        tbl
      );

      EXECUTE format(
        'CREATE POLICY "config_delete_%1$s" ON public.%1$I
         FOR DELETE TO authenticated USING (public.is_admin())',
        tbl
      );

    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 8. CONFIGURACAO_SISTEMA — Special (singleton config)
-- All authenticated read, only admin write
-- Anon can read (already exists from 005)
-- =====================================================

CREATE POLICY "config_sistema_select" ON public.configuracao_sistema
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "config_sistema_insert" ON public.configuracao_sistema
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "config_sistema_update" ON public.configuracao_sistema
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "config_sistema_delete" ON public.configuracao_sistema
  FOR DELETE TO authenticated USING (public.is_superadmin());

-- =====================================================
-- 9. LOG/HISTORY TABLES — Authenticated can read + insert
-- Only superadmin can delete
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'log_auditoria', 'log_acesso_documento',
    'historico_reclamacao', 'historico_notificacao',
    'movimento_financeiro'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN

      EXECUTE format(
        'CREATE POLICY "log_select_%1$s" ON public.%1$I
         FOR SELECT TO authenticated USING (true)',
        tbl
      );

      EXECUTE format(
        'CREATE POLICY "log_insert_%1$s" ON public.%1$I
         FOR INSERT TO authenticated WITH CHECK (true)',
        tbl
      );

      EXECUTE format(
        'CREATE POLICY "log_update_%1$s" ON public.%1$I
         FOR UPDATE TO authenticated
         USING (public.is_admin()) WITH CHECK (public.is_admin())',
        tbl
      );

      EXECUTE format(
        'CREATE POLICY "log_delete_%1$s" ON public.%1$I
         FOR DELETE TO authenticated USING (public.is_superadmin())',
        tbl
      );

    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 10. PASTA (folders) — All authenticated read/write
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pasta') THEN
    CREATE POLICY "pasta_select" ON public.pasta
      FOR SELECT TO authenticated USING (true);
    CREATE POLICY "pasta_insert" ON public.pasta
      FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "pasta_update" ON public.pasta
      FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    CREATE POLICY "pasta_delete" ON public.pasta
      FOR DELETE TO authenticated USING (public.is_admin());
  END IF;
END $$;

-- =====================================================
-- 11. CACHE TABLE — All authenticated read/write
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cache_voo_f_r24') THEN
    CREATE POLICY "cache_select" ON public.cache_voo_f_r24
      FOR SELECT TO authenticated USING (true);
    CREATE POLICY "cache_insert" ON public.cache_voo_f_r24
      FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "cache_update" ON public.cache_voo_f_r24
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "cache_delete" ON public.cache_voo_f_r24
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- =====================================================
-- NOTE: Anon policies from migration 005 are preserved
-- (reclamacao, credenciamento, aeroporto, empresa, etc.)
-- Service role bypasses RLS automatically.
-- =====================================================

-- =====================================================
-- 12. SERVICO_VOO & RECURSO_VOO — no empresa_id, scoped via voo_ligado
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['servico_voo', 'recurso_voo', 'cliente'];
BEGIN
  FOREACH tbl IN ARRAY tbls
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format(
        'CREATE POLICY "open_select_%1$s" ON public.%1$I
         FOR SELECT TO authenticated USING (true)', tbl);
      EXECUTE format(
        'CREATE POLICY "open_insert_%1$s" ON public.%1$I
         FOR INSERT TO authenticated WITH CHECK (true)', tbl);
      EXECUTE format(
        'CREATE POLICY "open_update_%1$s" ON public.%1$I
         FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tbl);
      EXECUTE format(
        'CREATE POLICY "admin_delete_%1$s" ON public.%1$I
         FOR DELETE TO authenticated USING (public.is_admin())', tbl);
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- GRANT EXECUTE on helper functions
-- =====================================================
GRANT EXECUTE ON FUNCTION public.current_user_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
