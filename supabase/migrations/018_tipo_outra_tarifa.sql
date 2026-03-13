-- Migration 018: Tabela para tipos de outra tarifa (CRUD dinâmico)

CREATE TABLE IF NOT EXISTS public.tipo_outra_tarifa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  unidade_padrao TEXT DEFAULT 'passageiro',
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  ordem INT DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.tipo_outra_tarifa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read tipo_outra_tarifa" ON public.tipo_outra_tarifa
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert tipo_outra_tarifa" ON public.tipo_outra_tarifa
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update tipo_outra_tarifa" ON public.tipo_outra_tarifa
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete tipo_outra_tarifa" ON public.tipo_outra_tarifa
  FOR DELETE TO authenticated USING (true);

-- Seed com tipos existentes
INSERT INTO public.tipo_outra_tarifa (value, label, unidade_padrao, ordem) VALUES
  ('embarque', 'Embarque', 'passageiro', 1),
  ('transito_transbordo', 'Trânsito com Transbordo', 'passageiro', 2),
  ('transito_direto', 'Trânsito Direto', 'passageiro', 3),
  ('carga', 'Carga', 'tonelada', 4),
  ('seguranca', 'Segurança', 'fixa', 5),
  ('iluminacao', 'Iluminação', 'voo', 6),
  ('checkin', 'Assistência ao Passageiro (Check-in)', 'balcao_hora', 7),
  ('cuppss', 'CUPPSS / CUSS', 'passageiro', 8),
  ('assistencia_especial', 'Ass. Passageiro Necessidades Especiais', 'passageiro', 9),
  ('fast_track', 'Serviço Fast Track Premium', 'passageiro', 10),
  ('assistencia_bagagem', 'Assistência à Bagagem', 'passageiro', 11),
  ('brs', 'BRS (Baggage Reconciliation System)', 'bagagem', 12);
