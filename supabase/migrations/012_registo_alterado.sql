-- Migration 012: Suporte a troca de registo de aeronave
-- Separa permanência (estatística) de estacionamento (faturação)
-- Quando registo_alterado = true, o DEP usa aeronave diferente do ARR

ALTER TABLE public.voo_ligado
  ADD COLUMN IF NOT EXISTS registo_alterado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS registo_dep TEXT,
  ADD COLUMN IF NOT EXISTS tempo_estacionamento_min INTEGER,
  ADD COLUMN IF NOT EXISTS estacionamento_origem TEXT; -- 'auto','manual'
