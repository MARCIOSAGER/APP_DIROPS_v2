-- Migration 022: Add empresa_id to imposto table for multi-tenant isolation

ALTER TABLE public.imposto ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);

-- Backfill from aeroporto relationship (aeroporto_id UUID)
UPDATE public.imposto i
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE i.aeroporto_id = a.id
  AND i.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- Records without aeroporto_id → default to SGA
UPDATE public.imposto
SET empresa_id = '128bc692-3fae-4825-9c55-40565dbedcfb'
WHERE empresa_id IS NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_imposto_empresa_id ON public.imposto(empresa_id);
