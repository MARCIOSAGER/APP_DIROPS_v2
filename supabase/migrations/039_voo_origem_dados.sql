-- Migration 039: Add origem_dados column to voo table
-- Differentiates imported historical flights (AIAAN_IMPORT) from system-created flights (SISTEMA)

ALTER TABLE voo ADD COLUMN IF NOT EXISTS origem_dados TEXT DEFAULT 'SISTEMA';
CREATE INDEX IF NOT EXISTS idx_voo_origem_dados ON voo(origem_dados);

-- Set existing flights as SISTEMA
UPDATE voo SET origem_dados = 'SISTEMA' WHERE origem_dados IS NULL;
