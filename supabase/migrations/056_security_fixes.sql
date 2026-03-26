-- Migration 056: Security fixes from audit 2026-03-26
-- Fixes: C-03 (reclamacao anon read), H-04 (solicitacao_servico RLS), M-02 (self-escalation prevention)

-- ============================================================
-- C-03: Remove anon SELECT on reclamacao (was USING(true))
-- Only authenticated users should read reclamacao data
-- ============================================================

DROP POLICY IF EXISTS "anon_select_reclamacao" ON reclamacao;
DROP POLICY IF EXISTS "anon_insert_reclamacao" ON reclamacao;

-- Allow anon INSERT only (public complaint form) but NOT read
CREATE POLICY "anon_insert_reclamacao"
  ON reclamacao FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated users: read only their empresa's reclamacoes
CREATE POLICY "auth_select_reclamacao"
  ON reclamacao FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM users WHERE auth_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND empresa_id IS NULL)
  );

-- ============================================================
-- H-04: Fix solicitacao_servico RLS — scope by empresa_id
-- Was: USING(true) for all authenticated users
-- ============================================================

DROP POLICY IF EXISTS "ss_select" ON solicitacao_servico;
DROP POLICY IF EXISTS "ss_insert" ON solicitacao_servico;
DROP POLICY IF EXISTS "ss_update" ON solicitacao_servico;

CREATE POLICY "ss_select_empresa"
  ON solicitacao_servico FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM users WHERE auth_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND empresa_id IS NULL)
  );

CREATE POLICY "ss_insert_empresa"
  ON solicitacao_servico FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM users WHERE auth_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND empresa_id IS NULL)
  );

CREATE POLICY "ss_update_empresa"
  ON solicitacao_servico FOR UPDATE
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM users WHERE auth_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND empresa_id IS NULL)
  );

-- ============================================================
-- M-02: Prevent self-escalation of role, perfis, empresa_id
-- Users cannot change their own sensitive fields
-- Only other admins/superadmins can modify these
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is updating their own row, prevent changes to sensitive fields
  IF NEW.auth_id = auth.uid() THEN
    NEW.role := OLD.role;
    NEW.perfis := OLD.perfis;
    NEW.empresa_id := OLD.empresa_id;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_self_escalation ON users;
CREATE TRIGGER trg_prevent_self_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_escalation();
