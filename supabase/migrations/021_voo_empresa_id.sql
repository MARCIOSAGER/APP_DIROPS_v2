-- Migration 021: Add empresa_id to ALL operational tables for multi-tenant isolation
-- Each record belongs to one empresa. Superadmin (empresa_id=null) sees all.

-- ============================================
-- 1. ADD empresa_id COLUMN TO ALL TABLES
-- ============================================

ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.voo_ligado ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.calculo_tarifa ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.proforma ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.proforma_item ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.ocorrencia_safety ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.inspecao ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.ordem_servico ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.reclamacao ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.documento ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.credenciamento ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.processo_auditoria ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);
ALTER TABLE public.medicao_k_p_i ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa(id);

-- ============================================
-- 2. BACKFILL from aeroporto relationship
-- ============================================

-- Tables with ICAO code (aeroporto_operacao / aeroporto TEXT field):

-- voo: aeroporto_operacao → aeroporto.empresa_id
UPDATE public.voo v
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE v.aeroporto_operacao = a.codigo_icao
  AND v.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- ocorrencia_safety: aeroporto (ICAO text)
UPDATE public.ocorrencia_safety os
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE os.aeroporto = a.codigo_icao
  AND os.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- documento: aeroporto (ICAO text)
UPDATE public.documento d
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE d.aeroporto = a.codigo_icao
  AND d.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- Tables with UUID (aeroporto_id UUID field):

-- proforma: aeroporto_id (UUID)
UPDATE public.proforma p
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE p.aeroporto_id = a.id
  AND p.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- inspecao: aeroporto_id (UUID)
UPDATE public.inspecao i
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE i.aeroporto_id = a.id
  AND i.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- ordem_servico: aeroporto_id (UUID)
UPDATE public.ordem_servico os
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE os.aeroporto_id = a.id
  AND os.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- reclamacao: aeroporto_id (UUID)
UPDATE public.reclamacao r
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE r.aeroporto_id = a.id
  AND r.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- credenciamento: aeroporto_id (UUID)
UPDATE public.credenciamento c
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE c.aeroporto_id = a.id
  AND c.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- processo_auditoria: aeroporto_id (UUID)
UPDATE public.processo_auditoria pa
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE pa.aeroporto_id = a.id
  AND pa.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- medicao_k_p_i: aeroporto_id (UUID)
UPDATE public.medicao_k_p_i mk
SET empresa_id = a.empresa_id
FROM public.aeroporto a
WHERE mk.aeroporto_id = a.id
  AND mk.empresa_id IS NULL AND a.empresa_id IS NOT NULL;

-- Tables derived from parent records:

-- voo_ligado: from ARR voo
UPDATE public.voo_ligado vl
SET empresa_id = v.empresa_id
FROM public.voo v
WHERE vl.id_voo_arr = v.id
  AND vl.empresa_id IS NULL AND v.empresa_id IS NOT NULL;

-- calculo_tarifa: from voo
UPDATE public.calculo_tarifa ct
SET empresa_id = v.empresa_id
FROM public.voo v
WHERE ct.voo_id = v.id
  AND ct.empresa_id IS NULL AND v.empresa_id IS NOT NULL;

-- proforma_item: from proforma
UPDATE public.proforma_item pi
SET empresa_id = p.empresa_id
FROM public.proforma p
WHERE pi.proforma_id = p.id
  AND pi.empresa_id IS NULL AND p.empresa_id IS NOT NULL;

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_voo_empresa_id ON public.voo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_voo_ligado_empresa_id ON public.voo_ligado(empresa_id);
CREATE INDEX IF NOT EXISTS idx_calculo_tarifa_empresa_id ON public.calculo_tarifa(empresa_id);
CREATE INDEX IF NOT EXISTS idx_proforma_empresa_id ON public.proforma(empresa_id);
CREATE INDEX IF NOT EXISTS idx_proforma_item_empresa_id ON public.proforma_item(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencia_safety_empresa_id ON public.ocorrencia_safety(empresa_id);
CREATE INDEX IF NOT EXISTS idx_inspecao_empresa_id ON public.inspecao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordem_servico_empresa_id ON public.ordem_servico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reclamacao_empresa_id ON public.reclamacao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_documento_empresa_id ON public.documento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_credenciamento_empresa_id ON public.credenciamento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_processo_auditoria_empresa_id ON public.processo_auditoria(empresa_id);
CREATE INDEX IF NOT EXISTS idx_medicao_kpi_empresa_id ON public.medicao_k_p_i(empresa_id);
