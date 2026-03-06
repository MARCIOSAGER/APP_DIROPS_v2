-- Add missing columns to Supabase tables for Base44 data migration

-- empresa
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS nif TEXT;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS email_principal TEXT;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS responsavel_email TEXT;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS responsavel_telefone TEXT;

-- modelo_aeronave
ALTER TABLE modelo_aeronave ADD COLUMN IF NOT EXISTS fabricante TEXT;
ALTER TABLE modelo_aeronave ADD COLUMN IF NOT EXISTS numero_motores INTEGER;
ALTER TABLE modelo_aeronave ADD COLUMN IF NOT EXISTS tipo_motor TEXT;

-- tipo_auditoria
ALTER TABLE tipo_auditoria ADD COLUMN IF NOT EXISTS periodicidade TEXT;
ALTER TABLE tipo_auditoria ADD COLUMN IF NOT EXISTS norma_referencia TEXT;

-- tipo_k_p_i
ALTER TABLE tipo_k_p_i ADD COLUMN IF NOT EXISTS formula TEXT;
ALTER TABLE tipo_k_p_i ADD COLUMN IF NOT EXISTS meta_tipo TEXT;
ALTER TABLE tipo_k_p_i ADD COLUMN IF NOT EXISTS periodicidade TEXT;

-- configuracao_sistema
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS valor TEXT;
ALTER TABLE configuracao_sistema ADD COLUMN IF NOT EXISTS descricao TEXT;

-- item_auditoria
ALTER TABLE item_auditoria ADD COLUMN IF NOT EXISTS ordem INTEGER;

-- outra_tarifa
ALTER TABLE outra_tarifa ADD COLUMN IF NOT EXISTS nome TEXT;

-- imposto
ALTER TABLE imposto ADD COLUMN IF NOT EXISTS nome TEXT;

-- tarifa_pouso
ALTER TABLE tarifa_pouso ADD COLUMN IF NOT EXISTS tipo_voo TEXT;
ALTER TABLE tarifa_pouso ADD COLUMN IF NOT EXISTS valor_por_tonelada NUMERIC;
ALTER TABLE tarifa_pouso ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'USD';

-- tarifa_permanencia
ALTER TABLE tarifa_permanencia ADD COLUMN IF NOT EXISTS tipo_voo TEXT;
ALTER TABLE tarifa_permanencia ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'USD';

-- grupo_whats_app
ALTER TABLE grupo_whats_app ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE grupo_whats_app ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE grupo_whats_app ADD COLUMN IF NOT EXISTS membros JSONB DEFAULT '[]';

-- tipo_documento
ALTER TABLE tipo_documento ADD COLUMN IF NOT EXISTS descricao TEXT;

-- campo_k_p_i
ALTER TABLE campo_k_p_i ADD COLUMN IF NOT EXISTS opcoes TEXT;
