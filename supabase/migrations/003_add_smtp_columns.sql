-- =====================================================
-- MIGRATION 003: Add SMTP configuration columns
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_port TEXT DEFAULT '587';
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_password TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_from_name TEXT DEFAULT 'DIROPS-SGA';
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_from_email TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT TRUE;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS email_notificacoes_padrao TEXT;
