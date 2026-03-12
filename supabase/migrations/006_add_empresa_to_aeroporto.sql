-- =====================================================
-- MIGRATION 006: Add empresa_id to aeroporto table
-- Enables multi-tenant filtering by organization
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- Add empresa_id column to aeroporto
ALTER TABLE public.aeroporto
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_aeroporto_empresa_id ON public.aeroporto(empresa_id);

-- Create index on users.empresa_id if not exists
CREATE INDEX IF NOT EXISTS idx_users_empresa_id ON public.users(empresa_id);
