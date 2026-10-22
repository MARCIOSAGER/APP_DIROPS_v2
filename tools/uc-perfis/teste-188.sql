-- teste-188.sql - prova a migracao 188 (perfis proprios da Universidade). TUDO EM ROLLBACK: nada fica gravado.
-- Inclui o corpo da 188 (para poder correr ANTES ou DEPOIS de a aplicar) seguido dos testes.
--   psql -h 127.0.0.1 -U postgres -d dirops_sga -v ON_ERROR_STOP=1 -f teste-188.sql
-- Cada verificacao escreve NOTICE "OK ..."; uma falha aborta com ERROR.
SET client_encoding = 'UTF8';
SET client_min_messages = warning;
BEGIN;
-- ----------------------------------------------------------------- corpo da migracao 188 (copia)

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


-- ===========================================================================================================
-- TESTES (tudo dentro da mesma transaccao, que termina em ROLLBACK)
-- ===========================================================================================================
SET client_min_messages = notice;

INSERT INTO public.users (auth_id, email, full_name, role, perfis, status) VALUES
  ('00000000-0000-4188-8000-000000000001', 't188.admin@sga.co.ao',     'Admin UC T188',     'user', '{admin_universidade}',      'ativo'),
  ('00000000-0000-4188-8000-000000000002', 't188.coord@sga.co.ao',     'Coord T188',        'user', '{uc_t188_coord}',           'ativo'),
  ('00000000-0000-4188-8000-000000000003', 't188.visit@sga.co.ao',     'Visitante T188',    'user', '{uc_t188_visit}',           'ativo'),
  ('00000000-0000-4188-8000-000000000004', 't188.formando@sga.co.ao',  'Formando T188',     'user', '{formando}',                'ativo'),
  ('00000000-0000-4188-8000-000000000005', 't188.instrutor@sga.co.ao', 'Instrutor T188',    'user', '{instrutor}',               'ativo'),
  ('00000000-0000-4188-8000-000000000006', 't188.misto@sga.co.ao',     'Misto T188',        'user', '{operacoes,uc_t188_visit}', 'ativo');
INSERT INTO public.curso (id, titulo, instrutor_email) VALUES ('00000000-0000-4188-8000-0000000000c1', 'Curso T188', 't188.coord@sga.co.ao');
INSERT INTO public.universidade_convite (email, token_hash, expira_em, perfis)
VALUES ('t188.convidado@sga.co.ao', 't188-hash', now() + interval '7 days', '{uc_t188_visit}');

-- 1) CHECKs (como postgres)
DO $$ BEGIN
  BEGIN
    INSERT INTO public.universidade_permissao (perfil, paginas, personalizado, nivel, label) VALUES ('xx_t188', '{}', true, 'formando', 'X');
    RAISE EXCEPTION 'FALHA: nome sem uc_ aceite';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 1a nome tecnico tem de comecar por uc_'; END;
  BEGIN
    INSERT INTO public.universidade_permissao (perfil, paginas, personalizado, nivel, label) VALUES ('uc_t188_x', '{}', true, 'admin', 'X');
    RAISE EXCEPTION 'FALHA: nivel admin aceite';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 1b nivel so formando/instrutor'; END;
  BEGIN
    INSERT INTO public.universidade_permissao (perfil, paginas, personalizado, nivel, label, cor) VALUES ('uc_t188_x', '{}', true, 'formando', 'X', 'red;background:url(x)');
    RAISE EXCEPTION 'FALHA: cor invalida aceite';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 1c cor so #rrggbb'; END;
  BEGIN
    INSERT INTO public.universidade_permissao (perfil, paginas) VALUES ('uc_t188_x', '{}');
    RAISE EXCEPTION 'FALHA: nome uc_ nao personalizado aceite';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 1d nome uc_ so existe como personalizado'; END;
  BEGIN
    INSERT INTO public.universidade_permissao (perfil, paginas, personalizado, nivel, label) VALUES ('uc_t188_x', '{}', true, 'formando', '  ');
    RAISE EXCEPTION 'FALHA: personalizado sem nome aceite';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 1e personalizado precisa de nome'; END;
  IF (SELECT nivel FROM public.universidade_permissao WHERE perfil = 'instrutor') IS DISTINCT FROM 'instrutor' THEN RAISE EXCEPTION 'FALHA: nivel do instrutor base'; END IF;
  RAISE NOTICE 'OK 1f perfis base com nivel preenchido';
END $$;

-- 2) Um formando nao cria perfis (RLS)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t188.formando@sga.co.ao","sub":"00000000-0000-4188-8000-000000000004"}', true);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.universidade_permissao (perfil, paginas, personalizado, nivel, label) VALUES ('uc_t188_hack', '{gestao}', true, 'instrutor', 'Hack');
    RAISE EXCEPTION 'FALHA: formando criou um perfil';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 2 formando nao cria perfis proprios'; END;
END $$;
RESET ROLE;

-- 3) O administrador da Universidade cria os perfis (RLS)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t188.admin@sga.co.ao","sub":"00000000-0000-4188-8000-000000000001"}', true);
INSERT INTO public.universidade_permissao (perfil, paginas, personalizado, nivel, label, cor, descricao) VALUES
  ('uc_t188_coord', '{formacao,sessoes,gestao,gestao_cursos}', true, 'instrutor', 'Coordena' || chr(231) || chr(227) || 'o T188', '#7c3aed', 'Teste'),
  ('uc_t188_visit', '{formacao}',                              true, 'formando',  'Visitante T188',                                '#0f766e', NULL);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.universidade_permissao WHERE personalizado AND perfil LIKE 'uc_t188_%') <> 2 THEN RAISE EXCEPTION 'FALHA: admin nao criou os perfis'; END IF;
  RAISE NOTICE 'OK 3 admin_universidade cria perfis proprios';
END $$;
RESET ROLE;

-- 4) Perfil proprio de nivel INSTRUTOR = poderes do instrutor
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t188.coord@sga.co.ao","sub":"00000000-0000-4188-8000-000000000002"}', true);
DO $$ DECLARE n int; BEGIN
  IF NOT public.pode_gerir_formacao() THEN RAISE EXCEPTION 'FALHA: coord (nivel instrutor) sem pode_gerir_formacao'; END IF;
  IF NOT public.pode_editar_curso('00000000-0000-4188-8000-0000000000c1') THEN RAISE EXCEPTION 'FALHA: coord nao edita o seu curso'; END IF;
  UPDATE public.curso SET descricao = 'editado T188' WHERE id = '00000000-0000-4188-8000-0000000000c1';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'FALHA: RLS impediu o coord de editar o seu curso'; END IF;
  INSERT INTO public.curso (titulo) VALUES ('Curso novo T188');   -- curso_insert: pode_gerir_formacao()
  SELECT count(*) INTO n FROM public.universidade_convite WHERE email = 't188.convidado@sga.co.ao';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: coord nao ve os convites'; END IF;
  UPDATE public.universidade_permissao SET paginas = '{gestao_configuracoes}' WHERE perfil = 'uc_t188_coord';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FALHA: nivel instrutor alterou perfis (so administradores)'; END IF;
  RAISE NOTICE 'OK 4 perfil proprio nivel instrutor: gere formacao, edita o seu curso, cria cursos, ve convites, nao mexe em perfis';
END $$;
RESET ROLE;

-- 5) Perfil proprio de nivel FORMANDO = nenhum poder de gestao
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t188.visit@sga.co.ao","sub":"00000000-0000-4188-8000-000000000003"}', true);
DO $$ DECLARE n int; BEGIN
  IF public.pode_gerir_formacao() THEN RAISE EXCEPTION 'FALHA: visit (nivel formando) com pode_gerir_formacao'; END IF;
  IF public.pode_editar_curso('00000000-0000-4188-8000-0000000000c1') THEN RAISE EXCEPTION 'FALHA: visit edita curso'; END IF;
  UPDATE public.curso SET descricao = 'hack' WHERE id = '00000000-0000-4188-8000-0000000000c1';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FALHA: visit alterou um curso'; END IF;
  SELECT count(*) INTO n FROM public.universidade_convite; IF n <> 0 THEN RAISE EXCEPTION 'FALHA: visit ve convites'; END IF;
  BEGIN
    INSERT INTO public.curso (titulo) VALUES ('Hack T188');
    RAISE EXCEPTION 'FALHA: visit criou um curso';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'OK 5 perfil proprio nivel formando: sem gestao, sem cursos, sem convites';
END $$;
RESET ROLE;

-- 6) Referencias: formando e instrutor base continuam como antes; instrutor nao edita curso alheio
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t188.formando@sga.co.ao","sub":"00000000-0000-4188-8000-000000000004"}', true);
DO $$ BEGIN
  IF public.pode_gerir_formacao() OR public.uc_tem_nivel('instrutor') THEN RAISE EXCEPTION 'FALHA: formando com gestao'; END IF;
  RAISE NOTICE 'OK 6a formando base sem gestao';
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t188.instrutor@sga.co.ao","sub":"00000000-0000-4188-8000-000000000005"}', true);
DO $$ BEGIN
  IF NOT public.pode_gerir_formacao() THEN RAISE EXCEPTION 'FALHA: instrutor base sem gestao'; END IF;
  IF public.pode_editar_curso('00000000-0000-4188-8000-0000000000c1') THEN RAISE EXCEPTION 'FALHA: instrutor edita curso alheio'; END IF;
  RAISE NOTICE 'OK 6b instrutor base igual (gere, nao edita curso alheio)';
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$ BEGIN
  IF public.pode_gerir_formacao() THEN RAISE EXCEPTION 'FALHA: anon com gestao'; END IF;
  RAISE NOTICE 'OK 6c anon: pode_gerir_formacao() = false, sem erro de permissao';
END $$;
RESET ROLE;

-- 7) Apagar perfis em uso (como o admin, pela RLS): sao retirados a quem os tinha; quem fica sem perfil UC fica formando
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t188.admin@sga.co.ao","sub":"00000000-0000-4188-8000-000000000001"}', true);
DELETE FROM public.universidade_permissao WHERE perfil IN ('uc_t188_visit', 'uc_t188_coord') AND personalizado;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.universidade_permissao WHERE perfil LIKE 'uc_t188_%') THEN RAISE EXCEPTION 'FALHA: perfis nao apagados'; END IF;
  IF (SELECT perfis FROM public.users WHERE email = 't188.visit@sga.co.ao') <> '{formando}' THEN RAISE EXCEPTION 'FALHA: visit devia ficar {formando}: %', (SELECT perfis FROM public.users WHERE email = 't188.visit@sga.co.ao'); END IF;
  IF (SELECT perfis FROM public.users WHERE email = 't188.coord@sga.co.ao') <> '{formando}' THEN RAISE EXCEPTION 'FALHA: coord devia ficar {formando}'; END IF;
  IF (SELECT perfis FROM public.users WHERE email = 't188.misto@sga.co.ao') <> '{operacoes,formando}' THEN RAISE EXCEPTION 'FALHA: misto devia ficar {operacoes,formando}: %', (SELECT perfis FROM public.users WHERE email = 't188.misto@sga.co.ao'); END IF;
  IF (SELECT perfis FROM public.universidade_convite WHERE email = 't188.convidado@sga.co.ao') <> '{formando}' THEN RAISE EXCEPTION 'FALHA: convite devia ficar {formando}'; END IF;
  RAISE NOTICE 'OK 7 apagar perfil em uso: retirado das pessoas e do convite, ficam formando';
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t188.coord@sga.co.ao","sub":"00000000-0000-4188-8000-000000000002"}', true);
DO $$ BEGIN
  IF public.pode_gerir_formacao() THEN RAISE EXCEPTION 'FALHA: coord ainda gere depois de apagado o perfil'; END IF;
  RAISE NOTICE 'OK 8 perfil apagado deixa de dar gestao';
END $$;
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'TODOS OS TESTES DA 188 PASSARAM (vai ser feito ROLLBACK)'; END $$;
ROLLBACK;
