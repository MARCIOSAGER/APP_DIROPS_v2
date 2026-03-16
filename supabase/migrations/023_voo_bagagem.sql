-- Migration 023: Add bagagem columns to voo table
-- ARR: breakdown (local, transito_transbordo, transito_direto, total)
-- DEP: only total

ALTER TABLE voo ADD COLUMN IF NOT EXISTS bagagem_local INTEGER DEFAULT 0;
ALTER TABLE voo ADD COLUMN IF NOT EXISTS bagagem_transito_transbordo INTEGER DEFAULT 0;
ALTER TABLE voo ADD COLUMN IF NOT EXISTS bagagem_transito_direto INTEGER DEFAULT 0;
ALTER TABLE voo ADD COLUMN IF NOT EXISTS bagagem_total INTEGER DEFAULT 0;
