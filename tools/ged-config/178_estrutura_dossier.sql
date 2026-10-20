-- 178 — Secção de cada documento no dossier entregue à ANAC (vista «Estrutura do MOA / do PSA» na Biblioteca).
-- Formato: «MOA:AP.13», «MOA:AN.07», «MOA:01», «PSA:AN.02», «PSA:AP.01»… Vazio = o portal calcula pelas regras.
-- Não mexe em pastas, números, versões nem acessos. Correr como postgres: psql -f 178_estrutura_dossier.sql (idempotente).
BEGIN;
ALTER TABLE public.documento ADD COLUMN IF NOT EXISTS estrutura_ref text;
CREATE INDEX IF NOT EXISTS documento_estrutura_ref_idx ON public.documento (estrutura_ref) WHERE deleted_at IS NULL;
COMMENT ON COLUMN public.documento.estrutura_ref IS 'Secção no dossier MOA/PSA (ex. MOA:AP.13). Vista de navegação; não afecta pastas nem acessos.';
COMMIT;
SELECT column_name FROM information_schema.columns WHERE table_name = 'documento' AND column_name = 'estrutura_ref';

-- recarregar a cache de esquema do PostgREST (senão a API não vê as alterações)
NOTIFY pgrst, 'reload schema';
