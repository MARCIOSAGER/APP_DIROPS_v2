-- Migration 029: Add empresa_id to tipo_inspecao and tipo_auditoria (Opção A)
-- item_checklist e item_auditoria herdam via FK do tipo pai
-- Also add missing columns to item_checklist (obrigatorio, status)

-- =====================================================
-- 1. tipo_inspecao + tipo_auditoria: empresa_id
-- =====================================================
ALTER TABLE tipo_inspecao ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);
ALTER TABLE tipo_auditoria ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);

CREATE INDEX IF NOT EXISTS idx_tipo_inspecao_empresa_id ON tipo_inspecao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tipo_auditoria_empresa_id ON tipo_auditoria(empresa_id);

-- =====================================================
-- 2. item_checklist: missing columns
-- =====================================================
ALTER TABLE item_checklist ADD COLUMN IF NOT EXISTS obrigatorio BOOLEAN DEFAULT TRUE;
ALTER TABLE item_checklist ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';

-- =====================================================
-- 3. inspecao: empresa_id (para filtro direto sem join)
-- =====================================================
ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);
CREATE INDEX IF NOT EXISTS idx_inspecao_empresa_id ON inspecao(empresa_id);

-- =====================================================
-- 4. RLS policies for tipo_inspecao
-- =====================================================
DROP POLICY IF EXISTS "empresa_select_tipo_inspecao" ON tipo_inspecao;
CREATE POLICY "empresa_select_tipo_inspecao" ON tipo_inspecao
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR empresa_id IS NULL
    OR empresa_id = public.current_user_empresa_id()
  );

DROP POLICY IF EXISTS "empresa_insert_tipo_inspecao" ON tipo_inspecao;
CREATE POLICY "empresa_insert_tipo_inspecao" ON tipo_inspecao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "empresa_update_tipo_inspecao" ON tipo_inspecao;
CREATE POLICY "empresa_update_tipo_inspecao" ON tipo_inspecao
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "empresa_delete_tipo_inspecao" ON tipo_inspecao;
CREATE POLICY "empresa_delete_tipo_inspecao" ON tipo_inspecao
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
    )
  );

-- =====================================================
-- 5. RLS policies for tipo_auditoria
-- =====================================================
DROP POLICY IF EXISTS "empresa_select_tipo_auditoria" ON tipo_auditoria;
CREATE POLICY "empresa_select_tipo_auditoria" ON tipo_auditoria
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR empresa_id IS NULL
    OR empresa_id = public.current_user_empresa_id()
  );

DROP POLICY IF EXISTS "empresa_insert_tipo_auditoria" ON tipo_auditoria;
CREATE POLICY "empresa_insert_tipo_auditoria" ON tipo_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "empresa_update_tipo_auditoria" ON tipo_auditoria;
CREATE POLICY "empresa_update_tipo_auditoria" ON tipo_auditoria
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "empresa_delete_tipo_auditoria" ON tipo_auditoria;
CREATE POLICY "empresa_delete_tipo_auditoria" ON tipo_auditoria
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
    )
  );

-- =====================================================
-- 6. Update RLS for inspecao (add empresa scope)
-- =====================================================
DROP POLICY IF EXISTS "empresa_select_inspecao" ON inspecao;
CREATE POLICY "empresa_select_inspecao" ON inspecao
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR empresa_id IS NULL
    OR empresa_id = public.current_user_empresa_id()
  );

DROP POLICY IF EXISTS "empresa_insert_inspecao" ON inspecao;
CREATE POLICY "empresa_insert_inspecao" ON inspecao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR empresa_id = public.current_user_empresa_id()
    OR empresa_id IS NULL
  );

DROP POLICY IF EXISTS "empresa_update_inspecao" ON inspecao;
CREATE POLICY "empresa_update_inspecao" ON inspecao
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
  );

DROP POLICY IF EXISTS "empresa_delete_inspecao" ON inspecao;
CREATE POLICY "empresa_delete_inspecao" ON inspecao
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_admin()
      AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)
    )
  );

-- Enable RLS on tables if not already
ALTER TABLE tipo_inspecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_auditoria ENABLE ROW LEVEL SECURITY;
