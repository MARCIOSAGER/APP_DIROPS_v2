-- =============================================
-- 033: Add missing created_by/updated_by to tarifa & imposto tables
-- Also adds empresa_id to imposto if missing
-- =============================================

-- imposto
ALTER TABLE imposto ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE imposto ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE imposto ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresa(id);

-- tarifa_pouso
ALTER TABLE tarifa_pouso ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE tarifa_pouso ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- tarifa_permanencia
ALTER TABLE tarifa_permanencia ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE tarifa_permanencia ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- outra_tarifa
ALTER TABLE outra_tarifa ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE outra_tarifa ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- tarifa_recurso
ALTER TABLE tarifa_recurso ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE tarifa_recurso ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Index for empresa_id on imposto
CREATE INDEX IF NOT EXISTS idx_imposto_empresa_id ON imposto(empresa_id);
