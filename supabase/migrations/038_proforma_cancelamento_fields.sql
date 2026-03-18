-- Migration 038: Add cancellation audit fields to proforma
-- Applied directly via API on 2026-03-18

ALTER TABLE public.proforma
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS cancelado_por TEXT,
  ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMPTZ;

-- These fields are set when status = 'cancelada' in two scenarios:
-- 1. Direct cancellation by user on the Proforma page
-- 2. Automatic cancellation when the associated voo or voo_ligado is deleted
