-- =====================================================
-- MIGRATION 005: Enable RLS + Policies for all tables
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- Helper: Enable RLS on all public tables
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- =====================================================
-- AUTHENTICATED USERS: Full access to all tables
-- (App-level permission control via perfis/roles)
-- =====================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- SELECT
    EXECUTE format(
      'CREATE POLICY "authenticated_select_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)',
      t.tablename
    );
    -- INSERT
    EXECUTE format(
      'CREATE POLICY "authenticated_insert_%1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (true)',
      t.tablename
    );
    -- UPDATE
    EXECUTE format(
      'CREATE POLICY "authenticated_update_%1$s" ON public.%1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      t.tablename
    );
    -- DELETE
    EXECUTE format(
      'CREATE POLICY "authenticated_delete_%1$s" ON public.%1$I FOR DELETE TO authenticated USING (true)',
      t.tablename
    );
  END LOOP;
END $$;

-- =====================================================
-- PUBLIC (ANON) ACCESS: Only for public forms
-- =====================================================

-- Reclamacao: public form can insert and read (for status check)
CREATE POLICY "anon_insert_reclamacao" ON public.reclamacao
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_reclamacao" ON public.reclamacao
  FOR SELECT TO anon USING (true);

-- Historico Reclamacao: public can insert (linked to reclamacao)
CREATE POLICY "anon_insert_historico_reclamacao" ON public.historico_reclamacao
  FOR INSERT TO anon WITH CHECK (true);

-- Credenciamento: public form can insert
CREATE POLICY "anon_insert_credenciamento" ON public.credenciamento
  FOR INSERT TO anon WITH CHECK (true);

-- Aeroporto: public forms need to read aeroportos list
CREATE POLICY "anon_select_aeroporto" ON public.aeroporto
  FOR SELECT TO anon USING (true);

-- Companhia Aerea: public forms may need this
CREATE POLICY "anon_select_companhia_aerea" ON public.companhia_aerea
  FOR SELECT TO anon USING (true);

-- Tipo Documento: public credenciamento form needs this
CREATE POLICY "anon_select_tipo_documento" ON public.tipo_documento
  FOR SELECT TO anon USING (true);

-- Empresa: public credenciamento form needs this
CREATE POLICY "anon_select_empresa" ON public.empresa
  FOR SELECT TO anon USING (true);

-- Configuracao Sistema: anon can read (for public page settings)
CREATE POLICY "anon_select_configuracao_sistema" ON public.configuracao_sistema
  FOR SELECT TO anon USING (true);

-- =====================================================
-- SERVICE ROLE bypasses RLS automatically (no policy needed)
-- Edge Functions using SUPABASE_SERVICE_ROLE_KEY bypass RLS
-- =====================================================
