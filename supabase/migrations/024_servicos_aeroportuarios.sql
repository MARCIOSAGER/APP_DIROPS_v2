-- Migration 024: Serviços Aeroportuários
-- Tabelas para cobranças de serviços por voo e serviços gerais (cursos/licenças)

-- 1. servico_voo: cobranças de serviços ligadas a um voo_ligado
CREATE TABLE IF NOT EXISTS public.servico_voo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voo_ligado_id UUID NOT NULL REFERENCES public.voo_ligado(id) ON DELETE CASCADE,
  tipo_servico TEXT NOT NULL,
  outra_tarifa_id UUID REFERENCES public.outra_tarifa(id),
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'passageiro',
  valor_unitario_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servico_voo_voo_ligado ON public.servico_voo(voo_ligado_id);
CREATE INDEX IF NOT EXISTS idx_servico_voo_tipo ON public.servico_voo(tipo_servico);

-- 2. tipo_servico_geral: catálogo de serviços gerais (cursos, licenças, bombeiros)
CREATE TABLE IF NOT EXISTS public.tipo_servico_geral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'cursos_licencas',
  valor_padrao_usd NUMERIC(12,2) DEFAULT 0,
  unidade TEXT DEFAULT 'participante',
  status TEXT DEFAULT 'ativa',
  ordem INT DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data: cursos e licenças
INSERT INTO public.tipo_servico_geral (value, label, categoria, valor_padrao_usd, unidade, ordem) VALUES
  ('curso_2h', 'Curso Seg. Operacional/AVSEC (até 2h)', 'cursos_licencas', 50.00, 'participante', 1),
  ('curso_4h', 'Curso Seg. Operacional/AVSEC (até 4h)', 'cursos_licencas', 100.00, 'participante', 2),
  ('curso_8h', 'Curso Seg. Operacional/AVSEC (até 8h)', 'cursos_licencas', 150.00, 'participante', 3),
  ('licenca_lcla', 'Licença de Condução do Lado Ar (LCLA)', 'cursos_licencas', 100.00, 'unidade', 4),
  ('derrame_pequeno', 'Limpeza de Derrame - Pequena proporção (até 10m²)', 'bombeiros', 800.00, 'ocorrência', 10),
  ('derrame_medio', 'Limpeza de Derrame - Média proporção (10 a 30m²)', 'bombeiros', 2080.00, 'ocorrência', 11),
  ('derrame_grande', 'Limpeza de Derrame - Grande proporção (acima de 30m²)', 'bombeiros', 3500.00, 'ocorrência', 12),
  ('resfriamento_trem', 'Resfriamento do Trem de Pouso', 'bombeiros', 60.00, 'solicitação', 13),
  ('reabastecimento_pax', 'Reabastecimento com Passageiro a Bordo', 'bombeiros', 60.00, 'solicitação', 14)
ON CONFLICT (value) DO NOTHING;

-- 3. cobranca_servico: cobranças gerais (não ligadas a voos)
CREATE TABLE IF NOT EXISTS public.cobranca_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresa(id),
  tipo_servico_geral_id UUID REFERENCES public.tipo_servico_geral(id),
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'cursos_licencas',
  descricao TEXT,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_unitario_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_servico DATE DEFAULT CURRENT_DATE,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cobranca_servico_empresa ON public.cobranca_servico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_servico_data ON public.cobranca_servico(data_servico);

-- 4. Colunas extras em calculo_tarifa
ALTER TABLE public.calculo_tarifa ADD COLUMN IF NOT EXISTS tarifa_servicos_usd NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.calculo_tarifa ADD COLUMN IF NOT EXISTS tarifa_servicos NUMERIC(12,2) DEFAULT 0;

-- 5. RLS
ALTER TABLE public.servico_voo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servico_voo_select" ON public.servico_voo FOR SELECT USING (true);
CREATE POLICY "servico_voo_insert" ON public.servico_voo FOR INSERT WITH CHECK (true);
CREATE POLICY "servico_voo_update" ON public.servico_voo FOR UPDATE USING (true);
CREATE POLICY "servico_voo_delete" ON public.servico_voo FOR DELETE USING (true);

ALTER TABLE public.tipo_servico_geral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipo_servico_geral_select" ON public.tipo_servico_geral FOR SELECT USING (true);
CREATE POLICY "tipo_servico_geral_insert" ON public.tipo_servico_geral FOR INSERT WITH CHECK (true);
CREATE POLICY "tipo_servico_geral_update" ON public.tipo_servico_geral FOR UPDATE USING (true);
CREATE POLICY "tipo_servico_geral_delete" ON public.tipo_servico_geral FOR DELETE USING (true);

ALTER TABLE public.cobranca_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobranca_servico_select" ON public.cobranca_servico FOR SELECT USING (true);
CREATE POLICY "cobranca_servico_insert" ON public.cobranca_servico FOR INSERT WITH CHECK (true);
CREATE POLICY "cobranca_servico_update" ON public.cobranca_servico FOR UPDATE USING (true);
CREATE POLICY "cobranca_servico_delete" ON public.cobranca_servico FOR DELETE USING (true);
