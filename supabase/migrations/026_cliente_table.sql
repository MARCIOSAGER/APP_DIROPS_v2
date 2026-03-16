-- Migration 026: Create separate 'cliente' table for billing clients
-- Separates billing clients (airlines, logistics) from system operators (empresa = ATO, SGA)

-- 1. Create cliente table
CREATE TABLE IF NOT EXISTS public.cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  nif TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  website TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ativa',
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  updated_by TEXT
);

-- 2. Add cliente_id to cobranca_servico (keeping empresa_id for backward compat temporarily)
ALTER TABLE public.cobranca_servico
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.cliente(id);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_cobranca_servico_cliente ON public.cobranca_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_nome ON public.cliente(nome);

-- 4. RLS
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.cliente
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 5. Migrate existing cobranca_servico.empresa_id data to cliente table
-- Insert empresas that are referenced in cobranca_servico into cliente (if any exist)
INSERT INTO public.cliente (id, nome, nif, telefone, email, endereco, website, observacoes, status, created_date)
SELECT e.id, e.nome, e.nif, e.telefone, e.email, e.endereco, e.website, e.observacoes, e.status, e.created_date
FROM public.empresa e
WHERE e.id IN (SELECT DISTINCT empresa_id FROM public.cobranca_servico WHERE empresa_id IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. Backfill cliente_id from empresa_id
UPDATE public.cobranca_servico
SET cliente_id = empresa_id
WHERE empresa_id IS NOT NULL AND cliente_id IS NULL;
