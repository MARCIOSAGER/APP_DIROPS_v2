-- Migration 009: Add missing columns to proforma table

ALTER TABLE proforma ADD COLUMN IF NOT EXISTS emitida_por TEXT;
ALTER TABLE proforma ADD COLUMN IF NOT EXISTS data_pagamento TEXT;
ALTER TABLE proforma ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
