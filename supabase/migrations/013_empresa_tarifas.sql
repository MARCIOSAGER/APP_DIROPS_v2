-- Migration 013: empresa_id nas tabelas de tarifas + PBB campos especiais
-- Permite tarifas diferentes por empresa (SGA vs ATO)

-- 1. empresa_id nas 4 tabelas de tarifas
ALTER TABLE public.tarifa_pouso ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);
ALTER TABLE public.tarifa_permanencia ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);
ALTER TABLE public.outra_tarifa ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);
ALTER TABLE public.tarifa_recurso ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_tarifa_pouso_empresa ON public.tarifa_pouso(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tarifa_permanencia_empresa ON public.tarifa_permanencia(empresa_id);
CREATE INDEX IF NOT EXISTS idx_outra_tarifa_empresa ON public.outra_tarifa(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tarifa_recurso_empresa ON public.tarifa_recurso(empresa_id);

-- 3. PBB: campos especiais na tarifa_recurso (1ª hora + hora adicional)
ALTER TABLE public.tarifa_recurso ADD COLUMN IF NOT EXISTS primeira_hora NUMERIC(12,2);
ALTER TABLE public.tarifa_recurso ADD COLUMN IF NOT EXISTS hora_adicional NUMERIC(12,2);
