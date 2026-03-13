-- Migration 010: Support for consolidated proformas
-- Adds tipo column to proforma and creates proforma_item junction table

-- Add tipo column to proforma (individual or consolidada)
ALTER TABLE proforma ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'individual';

-- Add periodo columns for consolidated proformas
ALTER TABLE proforma ADD COLUMN IF NOT EXISTS periodo_inicio TEXT;
ALTER TABLE proforma ADD COLUMN IF NOT EXISTS periodo_fim TEXT;

-- Create proforma_item junction table for consolidated proformas
CREATE TABLE IF NOT EXISTS proforma_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id UUID NOT NULL REFERENCES proforma(id) ON DELETE CASCADE,
  calculo_tarifa_id UUID REFERENCES calculo_tarifa(id),
  voo_ligado_id UUID REFERENCES voo_ligado(id),
  voo_id UUID REFERENCES voo(id),
  valor_usd DOUBLE PRECISION DEFAULT 0,
  valor_aoa DOUBLE PRECISION DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_proforma_item_proforma_id ON proforma_item(proforma_id);
CREATE INDEX IF NOT EXISTS idx_proforma_item_calculo_tarifa_id ON proforma_item(calculo_tarifa_id);
CREATE INDEX IF NOT EXISTS idx_proforma_tipo ON proforma(tipo);

-- Enable RLS
ALTER TABLE proforma_item ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (same pattern as other tables)
CREATE POLICY "proforma_item_select" ON proforma_item FOR SELECT TO authenticated USING (true);
CREATE POLICY "proforma_item_insert" ON proforma_item FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "proforma_item_update" ON proforma_item FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "proforma_item_delete" ON proforma_item FOR DELETE TO authenticated USING (true);
