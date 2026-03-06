-- =====================================================
-- MIGRATION 002: Add all missing columns found in code vs schema analysis
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. VOO - soft delete columns
ALTER TABLE voo ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE voo ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;

-- 2. USERS - role column (derived from perfis, but code reads it directly)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 3. OCORRENCIA_SAFETY - missing audit and resolution columns
ALTER TABLE ocorrencia_safety ADD COLUMN IF NOT EXISTS resolucao TEXT;
ALTER TABLE ocorrencia_safety ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE ocorrencia_safety ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 4. CREDENCIAMENTO - missing notification and protocol columns
ALTER TABLE credenciamento ADD COLUMN IF NOT EXISTS email_notificacao TEXT;
ALTER TABLE credenciamento ADD COLUMN IF NOT EXISTS numero_protocolo TEXT;
ALTER TABLE credenciamento ADD COLUMN IF NOT EXISTS data_solicitacao TEXT;

-- 5. ORDEM_SERVICO - missing columns used by enviarTicketSuporte and other code
--    Code uses: tipo, categoria, descricao, numero_protocolo, solicitante_email, solicitante_nome
--    Schema has: categoria_manutencao, descricao_problema, numero_ordem (different names)
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS numero_protocolo TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS solicitante_email TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS solicitante_nome TEXT;

-- 6. CONFIGURACAO_SISTEMA - code stores arbitrary config as extra fields
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS email_notificacao_acessos TEXT;

-- 7. PROFORMA - missing voo_id reference
ALTER TABLE proforma ADD COLUMN IF NOT EXISTS voo_id UUID;

-- 8. SOLICITACAO_ACESSO - missing user_id reference (used by SolicitacaoPerfil.jsx)
ALTER TABLE solicitacao_acesso ADD COLUMN IF NOT EXISTS user_id UUID;

-- =====================================================
-- Set role='admin' for existing admin users (by perfis)
-- Run this AFTER inserting your admin user in the users table
-- =====================================================
UPDATE users SET role = 'admin' WHERE perfis @> ARRAY['administrador']::TEXT[];
