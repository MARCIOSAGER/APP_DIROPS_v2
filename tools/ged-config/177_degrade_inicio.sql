-- 177 — Cor e intensidade do véu (degradê) sobre a foto do cabeçalho do Início, nos DOIS portais:
-- Portal de Documentos (documentos_config) e Universidade (universidade_config).
-- hero_cor: cor em hex (#0b1f3a por omissão); hero_intensidade: forte | medio | suave | esquerda.
-- Editável em Configurações → Portal de cada portal. Correr como postgres: psql -f 177_degrade_inicio.sql (idempotente).
BEGIN;
ALTER TABLE public.documentos_config
  ADD COLUMN IF NOT EXISTS hero_cor         text NOT NULL DEFAULT '#0b1f3a',
  ADD COLUMN IF NOT EXISTS hero_intensidade text NOT NULL DEFAULT 'forte';
ALTER TABLE public.universidade_config
  ADD COLUMN IF NOT EXISTS hero_cor         text NOT NULL DEFAULT '#0b1f3a',
  ADD COLUMN IF NOT EXISTS hero_intensidade text NOT NULL DEFAULT 'forte';
COMMIT;
SELECT 'documentos_config' AS tabela, hero_cor, hero_intensidade FROM public.documentos_config WHERE id = 'geral'
UNION ALL
SELECT 'universidade_config', hero_cor, hero_intensidade FROM public.universidade_config WHERE id = 'geral';

-- recarregar a cache de esquema do PostgREST (senão a API não vê as alterações)
NOTIFY pgrst, 'reload schema';
