-- =====================================================
-- ALL PENDING MIGRATIONS - Run in Supabase Dashboard > SQL Editor
-- =====================================================

-- === MIGRATION 002: Missing columns across all tables ===

-- 1. VOO - soft delete columns
ALTER TABLE voo ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE voo ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;

-- 2. USERS - role column
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 3. OCORRENCIA_SAFETY - missing audit and resolution columns
ALTER TABLE ocorrencia_safety ADD COLUMN IF NOT EXISTS resolucao TEXT;
ALTER TABLE ocorrencia_safety ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE ocorrencia_safety ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 4. CREDENCIAMENTO - missing notification and protocol columns
ALTER TABLE credenciamento ADD COLUMN IF NOT EXISTS email_notificacao TEXT;
ALTER TABLE credenciamento ADD COLUMN IF NOT EXISTS numero_protocolo TEXT;
ALTER TABLE credenciamento ADD COLUMN IF NOT EXISTS data_solicitacao TEXT;

-- 5. ORDEM_SERVICO - missing columns
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS numero_protocolo TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS solicitante_email TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS solicitante_nome TEXT;

-- 6. CONFIGURACAO_SISTEMA - email notificacao acessos
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS email_notificacao_acessos TEXT;

-- 7. PROFORMA - missing voo_id reference
ALTER TABLE proforma ADD COLUMN IF NOT EXISTS voo_id UUID;

-- 8. SOLICITACAO_ACESSO - missing user_id reference
ALTER TABLE solicitacao_acesso ADD COLUMN IF NOT EXISTS user_id UUID;

-- === MIGRATION 003: SMTP configuration columns ===

ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_port TEXT DEFAULT '587';
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_password TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_from_name TEXT DEFAULT 'DIROPS-SGA';
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_from_email TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT TRUE;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS email_notificacoes_padrao TEXT;

-- === Set role='admin' for existing admin users ===
UPDATE users SET role = 'admin' WHERE perfis @> ARRAY['administrador']::TEXT[];

-- === Disable RLS on all existing tables (safe - skips missing ones) ===
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '__%'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
    RAISE NOTICE 'RLS disabled on: %', tbl;
  END LOOP;
END $$;
