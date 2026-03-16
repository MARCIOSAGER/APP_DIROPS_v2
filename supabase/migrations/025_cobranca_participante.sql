-- Migration 025: Adicionar campo participante à cobranca_servico
ALTER TABLE public.cobranca_servico ADD COLUMN IF NOT EXISTS participante TEXT;
