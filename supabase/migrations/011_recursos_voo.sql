-- Migration 011: Recursos do Voo (Flight Resources)
-- Tabela de configuração de tarifas por recurso + registo de uso por voo ligado + combustível no voo DEP

-- ============================================================
-- 1. Tabela tarifa_recurso (configuração de preços por hora)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tarifa_recurso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'pca','gpu','pbb','combustivel','checkin'
  valor_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria_aeroporto TEXT, -- 'categoria_1','categoria_2','categoria_3'
  tipo_operacao TEXT DEFAULT 'ambos', -- 'domestico','internacional','ambos'
  status TEXT DEFAULT 'ativa', -- 'ativa','inativa'
  descricao TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Tabela recurso_voo (registos por voo ligado)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recurso_voo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voo_ligado_id UUID NOT NULL REFERENCES public.voo_ligado(id) ON DELETE CASCADE,
  -- PCA (Ar Pré-Condicionado)
  pca_utilizado BOOLEAN DEFAULT FALSE,
  pca_hora_inicio TIMESTAMPTZ,
  pca_hora_fim TIMESTAMPTZ,
  pca_posicao_stand TEXT,
  pca_tempo_horas NUMERIC(8,2) DEFAULT 0,
  pca_valor_usd NUMERIC(12,2) DEFAULT 0,
  -- GPU (Ground Power Unit)
  gpu_utilizado BOOLEAN DEFAULT FALSE,
  gpu_hora_inicio TIMESTAMPTZ,
  gpu_hora_fim TIMESTAMPTZ,
  gpu_posicao_stand TEXT,
  gpu_tempo_horas NUMERIC(8,2) DEFAULT 0,
  gpu_valor_usd NUMERIC(12,2) DEFAULT 0,
  -- PBB (Ponte de Embarque)
  pbb_utilizado BOOLEAN DEFAULT FALSE,
  pbb_hora_inicio TIMESTAMPTZ,
  pbb_hora_fim TIMESTAMPTZ,
  pbb_posicao_stand TEXT,
  pbb_tempo_horas NUMERIC(8,2) DEFAULT 0,
  pbb_valor_usd NUMERIC(12,2) DEFAULT 0,
  -- Check-in (Balcões)
  checkin_utilizado BOOLEAN DEFAULT FALSE,
  checkin_hora_inicio TIMESTAMPTZ,
  checkin_hora_fim TIMESTAMPTZ,
  checkin_posicoes TEXT, -- ex: "B01-16"
  checkin_num_balcoes INT DEFAULT 0,
  checkin_tempo_horas NUMERIC(8,2) DEFAULT 0,
  checkin_valor_usd NUMERIC(12,2) DEFAULT 0,
  -- Total
  total_recursos_usd NUMERIC(12,2) DEFAULT 0,
  -- Audit
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurso_voo_voo_ligado ON public.recurso_voo(voo_ligado_id);

-- ============================================================
-- 3. Colunas de combustível na tabela voo (para DEP)
-- ============================================================
ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS combustivel_utilizado BOOLEAN DEFAULT FALSE;
ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS combustivel_hora_inicio TIME;
ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS combustivel_hora_fim TIME;
ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS combustivel_posicao_stand TEXT;
ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS combustivel_litros NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS combustivel_tipo TEXT; -- 'JET-A1','AVGAS'
ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS combustivel_tempo_horas NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.voo ADD COLUMN IF NOT EXISTS combustivel_valor_usd NUMERIC(12,2) DEFAULT 0;

-- ============================================================
-- 4. Colunas de recursos no calculo_tarifa
-- ============================================================
ALTER TABLE public.calculo_tarifa ADD COLUMN IF NOT EXISTS tarifa_recursos_usd NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.calculo_tarifa ADD COLUMN IF NOT EXISTS tarifa_recursos NUMERIC(12,2) DEFAULT 0;

-- ============================================================
-- 5. RLS Policies
-- ============================================================
ALTER TABLE public.tarifa_recurso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurso_voo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarifa_recurso_select" ON public.tarifa_recurso FOR SELECT USING (true);
CREATE POLICY "tarifa_recurso_insert" ON public.tarifa_recurso FOR INSERT WITH CHECK (true);
CREATE POLICY "tarifa_recurso_update" ON public.tarifa_recurso FOR UPDATE USING (true);
CREATE POLICY "tarifa_recurso_delete" ON public.tarifa_recurso FOR DELETE USING (true);

CREATE POLICY "recurso_voo_select" ON public.recurso_voo FOR SELECT USING (true);
CREATE POLICY "recurso_voo_insert" ON public.recurso_voo FOR INSERT WITH CHECK (true);
CREATE POLICY "recurso_voo_update" ON public.recurso_voo FOR UPDATE USING (true);
CREATE POLICY "recurso_voo_delete" ON public.recurso_voo FOR DELETE USING (true);
