-- Migration 020: Add registo_dep column to voo table (for aircraft registration change on departure)

ALTER TABLE public.voo
  ADD COLUMN IF NOT EXISTS registo_dep TEXT;
