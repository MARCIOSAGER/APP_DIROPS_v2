-- Migration 034: Add empresa_id to registo_aeronave table
-- The registo_aeronave table was missed in migration 021 which added empresa_id
-- to all other operational tables. This fixes the multi-tenant isolation gap.

-- 1. Add empresa_id column
ALTER TABLE public.registo_aeronave
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);

-- 2. Backfill empresa_id from related voo records where possible
-- registo_aeronave.registo_normalizado matches voo.registo_aeronave
UPDATE public.registo_aeronave ra
SET empresa_id = (
  SELECT v.empresa_id
  FROM public.voo v
  WHERE v.registo_aeronave = ra.registo_normalizado
    AND v.empresa_id IS NOT NULL
  LIMIT 1
)
WHERE ra.empresa_id IS NULL;

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_registo_aeronave_empresa_id
  ON public.registo_aeronave(empresa_id);

-- 4. Update RLS policy to include empresa_id filtering
-- (RLS policies from migration 027 cover this table via the general pattern)
