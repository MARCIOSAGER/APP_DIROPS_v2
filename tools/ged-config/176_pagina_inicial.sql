-- 176 — Página inicial do Portal de Documentos configurável (como na Universidade):
-- foto de cabeçalho (+ crédito), texto de apresentação e o guia rápido «O que encontra aqui».
-- Editável em Gestão → Configurações → Portal. Correr como postgres: psql -f 176_pagina_inicial.sql (idempotente).
BEGIN;
ALTER TABLE public.documentos_config
  ADD COLUMN IF NOT EXISTS imagem_inicio_url     text,
  ADD COLUMN IF NOT EXISTS imagem_inicio_credito text,
  ADD COLUMN IF NOT EXISTS texto_apresentacao    text,
  ADD COLUMN IF NOT EXISTS mostrar_guia_inicio   boolean NOT NULL DEFAULT true;
COMMIT;
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'documentos_config' AND column_name IN ('imagem_inicio_url','imagem_inicio_credito','texto_apresentacao','mostrar_guia_inicio');

-- recarregar a cache de esquema do PostgREST (senão a API não vê as alterações)
NOTIFY pgrst, 'reload schema';
