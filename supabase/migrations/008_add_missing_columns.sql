-- Migration 008: Add missing columns causing schema cache errors

-- 1. documento.voo_ligado_id - used to filter documents by linked flight
ALTER TABLE public.documento ADD COLUMN IF NOT EXISTS voo_ligado_id UUID;

-- 2. calculo_tarifa.periodo_noturno - boolean for night operation surcharge
ALTER TABLE public.calculo_tarifa ADD COLUMN IF NOT EXISTS periodo_noturno BOOLEAN DEFAULT FALSE;

-- 3. regra_permissao.descricao - description field for permission rules
ALTER TABLE public.regra_permissao ADD COLUMN IF NOT EXISTS descricao TEXT;
