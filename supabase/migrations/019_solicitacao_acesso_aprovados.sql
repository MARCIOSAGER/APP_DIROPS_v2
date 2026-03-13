-- Migration 019: Add missing columns to solicitacao_acesso for approval workflow

ALTER TABLE public.solicitacao_acesso
  ADD COLUMN IF NOT EXISTS aeroportos_aprovados TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS perfil_aprovado TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS observacoes_aprovacao TEXT,
  ADD COLUMN IF NOT EXISTS data_resposta TIMESTAMPTZ;
