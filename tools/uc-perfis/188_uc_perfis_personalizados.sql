-- ============================================================================
-- 188_uc_perfis_personalizados.sql -- Universidade Corporativa: o administrador cria perfis proprios.
--   Um perfil personalizado (ex. "Coordenador de formacao do FNLU", "Formando externo") assenta num NIVEL BASE
--   -- formando ou instrutor -- que e o que as regras de acesso aos dados conhecem; o perfil acrescenta nome, cor,
--   descricao e as paginas que a pessoa ve no portal. Quem tem o perfil tem, nos dados, exactamente os poderes do
--   nivel base:
--     . formando  -> nenhum poder extra (como hoje qualquer conta activa);
--     . instrutor -> pode_gerir_formacao() e pode_editar_curso() nos cursos de que e responsavel/co-instrutor/autor.
--   Administracao NAO e nivel de perfis proprios: administrar a Universidade e ter o perfil admin_universidade.
--   (Mesmo molde da migracao 179 do Portal de Documentos.)
--
--   . universidade_permissao ganha label, cor, descricao, nivel e personalizado (+ CHECKs: nome uc_[a-z0-9_],
--     nivel formando/instrutor, cor #rrggbb);
--   . uc_tem_nivel(nivel): o utilizador da sessao tem algum perfil proprio desse nivel;
--   . pode_gerir_formacao() e pode_editar_curso() passam a contar os perfis proprios de nivel instrutor;
--   . apagar um perfil proprio retira-o a quem o tinha (users.perfis e convites por aceitar); quem fica sem
--     nenhum perfil da Universidade passa a formando (nunca fica sem acesso).
--   Idempotente. Correr como postgres:
--     psql -h 127.0.0.1 -U postgres -d dirops_sga -v ON_ERROR_STOP=1 -f 188_uc_perfis_personalizados.sql
-- ============================================================================
SET client_encoding = 'UTF8';
SET client_min_messages = warning;
BEGIN;

ALTER TABLE public.universidade_permissao
  ADD COLUMN IF NOT EXISTS label         text,
  ADD COLUMN IF NOT EXISTS cor           text,
  ADD COLUMN IF NOT EXISTS descricao     text,
  ADD COLUMN IF NOT EXISTS nivel         text,
  ADD COLUMN IF NOT EXISTS personalizado boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'universidade_permissao_nivel_chk') THEN
    ALTER TABLE public.universidade_permissao ADD CONSTRAINT universidade_permissao_nivel_chk
      CHECK (nivel IS NULL OR nivel IN ('formando', 'instrutor'));
  END IF;
  -- os personalizados tem nivel, nome tecnico proprio (uc_...) e nome visivel; um nome uc_... so existe como personalizado
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'universidade_permissao_personalizado_chk') THEN
    ALTER TABLE public.universidade_permissao ADD CONSTRAINT universidade_permissao_personalizado_chk
      CHECK (CASE WHEN personalizado
                  THEN nivel IS NOT NULL AND perfil ~ '^uc_[a-z0-9_]{2,40}$' AND coalesce(btrim(label), '') <> '' AND length(label) <= 60
                  ELSE perfil !~ '^uc_' END);
  END IF;
  -- a cor vai para um atributo style no portal: so #rrggbb
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'universidade_permissao_cor_chk') THEN
    ALTER TABLE public.universidade_permissao ADD CONSTRAINT universidade_permissao_cor_chk
      CHECK (cor IS NULL OR cor ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END $$;

UPDATE public.universidade_permissao SET nivel = 'formando'  WHERE perfil = 'formando'  AND nivel IS NULL;
UPDATE public.universidade_permissao SET nivel = 'instrutor' WHERE perfil = 'instrutor' AND nivel IS NULL;

-- O utilizador da sessao tem algum perfil proprio deste nivel? (SECURITY DEFINER: le users e universidade_permissao
-- sem depender da RLS de quem chama; so responde sobre o proprio utilizador.)
CREATE OR REPLACE FUNCTION public.uc_tem_nivel(p_nivel text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(auth.email(), '') <> '' AND EXISTS (
    SELECT 1
      FROM public.users u
      JOIN public.universidade_permissao p ON p.personalizado AND p.perfil = ANY(u.perfis)
     WHERE lower(u.email) = lower(auth.email()) AND p.nivel = p_nivel
  );
$$;
REVOKE ALL ON FUNCTION public.uc_tem_nivel(text) FROM PUBLIC;
-- anon tambem: e chamada dentro de pode_gerir_formacao(), que as politicas avaliam para qualquer papel (devolve false)
GRANT EXECUTE ON FUNCTION public.uc_tem_nivel(text) TO anon, authenticated, service_role;

-- Gestao da formacao: igual a anterior + perfis proprios de nivel instrutor.
CREATE OR REPLACE FUNCTION public.pode_gerir_formacao() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.is_admin() OR public.tem_perfil('instrutor') OR public.tem_perfil('admin_universidade')
      OR public.uc_tem_nivel('instrutor');
$$;

-- Editar um curso: igual a anterior; o perfil proprio de nivel instrutor conta como 'instrutor'.
CREATE OR REPLACE FUNCTION public.pode_editar_curso(p_curso uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.is_admin() OR (
    (public.tem_perfil('instrutor') OR public.uc_tem_nivel('instrutor')) AND EXISTS (
      SELECT 1 FROM public.curso c
       WHERE c.id = p_curso
         AND (lower(coalesce(c.instrutor_email, '')) = lower(auth.email())
              OR lower(coalesce(c.created_by, '')) = lower(auth.email())
              OR lower(auth.email()) = ANY (SELECT lower(x) FROM unnest(c.instrutores) x))
    )
  );
$$;

-- Apagar um perfil proprio: retira-o a quem o tinha. Quem fica sem nenhum perfil da Universidade fica formando.
CREATE OR REPLACE FUNCTION public.uc_perfil_apagado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_resto text[];
BEGIN
  IF NOT OLD.personalizado THEN RETURN OLD; END IF;
  UPDATE public.users u
     SET perfis = CASE WHEN EXISTS (SELECT 1 FROM unnest(array_remove(u.perfis, OLD.perfil)) x
                                     WHERE x IN ('formando', 'instrutor', 'admin_universidade') OR x ~ '^uc_')
                       THEN array_remove(u.perfis, OLD.perfil)
                       ELSE array_append(array_remove(u.perfis, OLD.perfil), 'formando') END,
         updated_date = now()
   WHERE OLD.perfil = ANY(u.perfis);
  UPDATE public.universidade_convite c
     SET perfis = CASE WHEN cardinality(array_remove(c.perfis, OLD.perfil)) > 0
                       THEN array_remove(c.perfis, OLD.perfil) ELSE ARRAY['formando'] END,
         updated_date = now()
   WHERE OLD.perfil = ANY(c.perfis) AND c.aceite_em IS NULL;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.uc_perfil_apagado() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_uc_perfil_apagado ON public.universidade_permissao;
CREATE TRIGGER trg_uc_perfil_apagado AFTER DELETE ON public.universidade_permissao
  FOR EACH ROW EXECUTE FUNCTION public.uc_perfil_apagado();

COMMIT;

SELECT perfil, nivel, personalizado FROM public.universidade_permissao ORDER BY personalizado, perfil;
-- recarregar a cache de esquema do PostgREST (senao a API nao ve as colunas novas)
NOTIFY pgrst, 'reload schema';
