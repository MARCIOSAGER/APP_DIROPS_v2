-- ============================================================================
-- 179_perfis_personalizados.sql — Portal de Documentos: o administrador cria perfis próprios.
--   Um perfil personalizado (ex. «Auditor ANAC», «Técnico AVSEC») assenta num NÍVEL BASE — leitor, editor ou
--   gestor — que é o que as regras de acesso aos dados conhecem; o perfil acrescenta nome, cor, descrição e as
--   páginas que a pessoa vê. Quem tem o perfil tem, nos dados, exactamente os poderes do nível base.
--   · documentos_permissao ganha label, cor, descricao, nivel e personalizado;
--   · doc_ctx() passa a contar os perfis personalizados pelo seu nível (o portal «documentos» continua exigido);
--   · documento_tipo deixa de olhar para os nomes fixos e usa doc_gestor() (vale para os personalizados).
--   Administrador não é nível base de perfis personalizados: dar administração é dar o perfil admin_documentos.
--   Idempotente. Correr como postgres: psql -f 179_perfis_personalizados.sql
-- ============================================================================
SET client_encoding = 'UTF8';
SET client_min_messages = warning;
BEGIN;

ALTER TABLE public.documentos_permissao
  ADD COLUMN IF NOT EXISTS label         text,
  ADD COLUMN IF NOT EXISTS cor           text,
  ADD COLUMN IF NOT EXISTS descricao     text,
  ADD COLUMN IF NOT EXISTS nivel         text,
  ADD COLUMN IF NOT EXISTS personalizado boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_permissao_nivel_chk') THEN
    ALTER TABLE public.documentos_permissao ADD CONSTRAINT documentos_permissao_nivel_chk
      CHECK (nivel IS NULL OR nivel IN ('leitor', 'editor', 'gestor'));
  END IF;
  -- os personalizados têm de ter nível e um nome técnico próprio (doc_…), que não colide com perfis de outros portais
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_permissao_personalizado_chk') THEN
    ALTER TABLE public.documentos_permissao ADD CONSTRAINT documentos_permissao_personalizado_chk
      CHECK (NOT personalizado OR (nivel IS NOT NULL AND perfil ~ '^doc_[a-z0-9_]{2,40}$' AND coalesce(btrim(label), '') <> ''));
  END IF;
END $$;

UPDATE public.documentos_permissao SET nivel = 'leitor' WHERE perfil = 'leitor_documentos' AND nivel IS NULL;
UPDATE public.documentos_permissao SET nivel = 'editor' WHERE perfil = 'editor_documentos' AND nivel IS NULL;
UPDATE public.documentos_permissao SET nivel = 'gestor' WHERE perfil = 'gestor_documentos' AND nivel IS NULL;

-- Contexto: igual à 148, mais os perfis personalizados contados pelo nível base.
CREATE OR REPLACE FUNCTION public.doc_ctx() RETURNS public.doc_ctx_t
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH eu AS (SELECT lower(coalesce(auth.email(), '')) AS email),
  u AS (
    SELECT eu.email,
           coalesce(x.perfis, '{}'::text[]) AS perfis,
           coalesce(x.role, '') AS role,
           (x.id IS NOT NULL AND x.status = 'ativo' AND 'documentos' = ANY(coalesce(x.portais, '{}'::text[]))) AS pode_entrar
      FROM eu LEFT JOIN public.users x ON lower(x.email) = eu.email AND eu.email <> ''
  ),
  a AS (
    SELECT coalesce(array_agg(DISTINCT t.aeroporto_id), '{}'::uuid[]) AS aeroportos FROM (
      SELECT m.aeroporto_id FROM public.documentos_acesso_aeroporto m, eu WHERE m.email = eu.email AND eu.email <> ''
      UNION ALL
      SELECT r.aeroporto_id FROM public.documentos_aeroporto_responsavel r, eu WHERE r.email = eu.email AND eu.email <> '') t
  ),
  c AS (  -- perfis personalizados da pessoa → níveis base
    SELECT coalesce(bool_or(p.nivel = 'gestor'), false) AS g,
           coalesce(bool_or(p.nivel IN ('gestor', 'editor')), false) AS e,
           coalesce(bool_or(true), false) AS l
      FROM public.documentos_permissao p, u
     WHERE p.personalizado AND p.perfil = ANY(u.perfis)
  ),
  f AS (
    SELECT u.email, u.perfis, a.aeroportos, u.pode_entrar,
           (u.role IN ('admin', 'superadmin') OR 'administrador' = ANY(u.perfis) OR 'admin_documentos' = ANY(u.perfis)) AS admin,
           ('gestor_documentos' = ANY(u.perfis) OR c.g) AS g,
           ('editor_documentos' = ANY(u.perfis) OR c.e) AS e,
           ('leitor_documentos' = ANY(u.perfis) OR c.l) AS l
      FROM u, a, c
  )
  SELECT ROW(email, perfis, aeroportos,
             pode_entrar AND admin,
             pode_entrar AND (admin OR g),
             pode_entrar AND (admin OR g OR e),
             pode_entrar AND (admin OR g OR e OR l))::public.doc_ctx_t
    FROM f
$$;

-- Tipos de documento: gestores (incluindo personalizados de nível gestor) e administradores.
DROP POLICY IF EXISTS doc_tipo_write ON public.documento_tipo;
CREATE POLICY doc_tipo_write ON public.documento_tipo FOR ALL
  USING (public.is_admin() OR (SELECT public.doc_gestor()))
  WITH CHECK (public.is_admin() OR (SELECT public.doc_gestor()));

COMMIT;

SELECT perfil, nivel, personalizado FROM public.documentos_permissao ORDER BY personalizado, perfil;
-- recarregar a cache de esquema do PostgREST (senão a API não vê as colunas novas)
NOTIFY pgrst, 'reload schema';
