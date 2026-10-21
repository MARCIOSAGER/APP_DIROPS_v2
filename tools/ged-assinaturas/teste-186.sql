-- teste-186.sql - prova a migracao 186 (rubricas, copia assinada, verificacao publica). TUDO EM ROLLBACK.
-- Correr DEPOIS de aplicar a 186:
--   psql -h 127.0.0.1 -U postgres -d dirops_sga -v ON_ERROR_STOP=1 -f teste-186.sql
-- Cada verificacao escreve NOTICE "OK ..."; uma falha aborta com ERROR e nada fica gravado.
SET client_min_messages = notice;
BEGIN;

-- ---------------------------------------------------------------------------
-- Cenario (criado e desfeito dentro da transaccao)
-- ---------------------------------------------------------------------------
INSERT INTO public.users (email, full_name, role, perfis, portais, status) VALUES
  ('t186.gestor@sga.co.ao',     'Gestor Teste 186',     'user', '{gestor_documentos}', '{documentos}', 'ativo'),
  ('t186.elaborador@sga.co.ao', 'Elaborador Teste 186', 'user', '{leitor_documentos}', '{documentos}', 'ativo'),
  ('t186.director@sga.co.ao',   'Director Teste 186',   'user', '{leitor_documentos}', '{documentos}', 'ativo'),
  ('t186.leitor@sga.co.ao',     'Leitor Teste 186',     'user', '{leitor_documentos}', '{documentos}', 'ativo'),
  ('t186.outro@sga.co.ao',      'Outro Teste 186',      'user', '{leitor_documentos}', '{documentos}', 'ativo');

CREATE TEMP TABLE t186 (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON t186 TO authenticated;

DO $$
DECLARE d1 uuid; d2 uuid; v1 uuid; v2 uuid; f1 uuid; f2 uuid; fl1 uuid; fl2 uuid;
  sha1 text := 'ab12cd34ef56' || repeat('0', 52);
  sha2 text := 'fe98dc76ba54' || repeat('1', 52);
BEGIN
  -- documento normal
  INSERT INTO public.documento (titulo, numero, estado, created_by, usar_storage_privado)
  VALUES ('Manual de Teste 186', 'T186-001', 'em_vigor', 't186.gestor@sga.co.ao', true) RETURNING id INTO d1;
  INSERT INTO public.documento_versao (documento_id, versao, rotulo, arquivo_uri, estado, vigor_desde)
  VALUES (d1, 1, 'Revisao 01', 't186_original.pdf', 'em_vigor', current_date - 30) RETURNING id INTO v1;
  INSERT INTO public.documento_ficheiro (documento_id, versao_id, papel, caminho, nome, sha256)
  VALUES (d1, v1, 'pdf', 'fluxo/2026/t186/original.pdf', 'original.pdf', sha1) RETURNING id INTO f1;
  INSERT INTO public.documento_aprovacao (documento_id, versao_id, estado, elaborador_email, director_email)
  VALUES (d1, v1, 'aprovado', 't186.elaborador@sga.co.ao', 't186.director@sga.co.ao') RETURNING id INTO fl1;
  INSERT INTO public.documento_assinatura (documento_id, fluxo_id, versao_id, ficheiro_id, ronda, acto, significado,
      signatario_email, signatario_nome, signatario_papel, ficheiro_sha256, payload_canonico, chave_id, assinatura, codigo, cadeia)
  VALUES
    (d1, fl1, v1, f1, 1, 'elaboracao', 'Elaborei.', 't186.elaborador@sga.co.ao', 'Elaborador Teste 186', 'elaborador',
     sha1, '{}', 'teste', 'x1', 'T186-AAAA-0001', 't186-c1'),
    (d1, fl1, v1, f1, 1, 'aprovacao', 'Aprovo.', 't186.director@sga.co.ao', 'Director Teste 186', 'director_aeroporto',
     sha1, '{}', 'teste', 'x2', 'T186-AAAA-0002', 't186-c2');

  -- documento AVSEC (classificado)
  INSERT INTO public.documento (titulo, numero, estado, created_by, usar_storage_privado, classificacao_categoria)
  VALUES ('Programa Secreto Teste 186', 'T186-PSA', 'em_vigor', 't186.gestor@sga.co.ao', true, '3.c') RETURNING id INTO d2;
  INSERT INTO public.documento_versao (documento_id, versao, rotulo, arquivo_uri, estado)
  VALUES (d2, 1, 'Revisao 02', 't186_psa.pdf', 'em_vigor') RETURNING id INTO v2;
  INSERT INTO public.documento_ficheiro (documento_id, versao_id, papel, caminho, nome, sha256)
  VALUES (d2, v2, 'pdf', 'fluxo/2026/t186/psa.pdf', 'psa.pdf', sha2) RETURNING id INTO f2;
  INSERT INTO public.documento_aprovacao (documento_id, versao_id, estado, elaborador_email, director_email)
  VALUES (d2, v2, 'aprovado', 't186.elaborador@sga.co.ao', 't186.director@sga.co.ao') RETURNING id INTO fl2;
  INSERT INTO public.documento_assinatura (documento_id, fluxo_id, versao_id, ficheiro_id, ronda, acto, significado,
      signatario_email, signatario_nome, signatario_papel, ficheiro_sha256, payload_canonico, chave_id, assinatura, codigo, cadeia)
  VALUES (d2, fl2, v2, f2, 1, 'aprovacao', 'Aprovo.', 't186.director@sga.co.ao', 'Director Teste 186', 'director_aeroporto',
          sha2, '{}', 'teste', 'x3', 'T186-AAAA-0003', 't186-c3');

  INSERT INTO t186 VALUES ('d1', d1), ('v1', v1), ('f1', f1), ('d2', d2), ('v2', v2);
END $$;

-- imagem PNG minima valida (assinatura PNG + 60 bytes) em data URL
CREATE TEMP TABLE t186_img ON COMMIT DROP AS
  SELECT 'data:image/png;base64,' || encode('\x89504e470d0a1a0a'::bytea || decode(repeat('00', 60), 'hex'), 'base64') AS png;
GRANT SELECT ON t186_img TO authenticated;

-- ---------------------------------------------------------------------------
-- 1) Rubrica: cada um grava a SUA; a tabela nao se le directamente
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.director@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
SELECT public.doc_rubrica_guardar((SELECT png FROM t186_img));
DO $$ BEGIN
  ASSERT (public.doc_rubrica_minha() ->> 'imagem') LIKE 'data:image/png;base64,%', 'director devia ver a propria rubrica';
  RAISE NOTICE 'OK 1a: o proprio grava e le a sua rubrica';
END $$;
DO $$ BEGIN
  PERFORM 1 FROM public.documento_rubrica;
  RAISE EXCEPTION 'FALHOU: authenticated conseguiu ler documento_rubrica directamente';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 1b: SELECT directo a documento_rubrica recusado';
END $$;
DO $$ BEGIN
  INSERT INTO public.documento_rubrica (email, imagem, sha256) VALUES ('t186.elaborador@sga.co.ao', 'data:image/png;base64,AA', repeat('a', 64));
  RAISE EXCEPTION 'FALHOU: authenticated inseriu rubrica de outra pessoa';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 1c: INSERT directo (rubrica de outra pessoa) recusado';
END $$;
DO $$ BEGIN
  PERFORM public.doc_rubrica_guardar('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
  RAISE EXCEPTION 'FALHOU: aceitou GIF';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 1d: formato nao PNG/JPEG recusado';
END $$;
DO $$ BEGIN
  PERFORM public.doc_rubrica_guardar('data:image/png;base64,' || repeat('A', 300000));
  RAISE EXCEPTION 'FALHOU: aceitou imagem grande demais';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 1e: imagem acima do limite recusada';
END $$;
RESET ROLE;

-- o elaborador (signatario) e o "outro" (NAO signatario) tambem tem rubrica
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.elaborador@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
SELECT public.doc_rubrica_guardar((SELECT png FROM t186_img));
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.outro@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
SELECT public.doc_rubrica_guardar((SELECT png FROM t186_img));
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.documento_rubrica WHERE email LIKE 't186.%') = 3, 'deviam existir 3 rubricas, cada uma no email do proprio';
  RAISE NOTICE 'OK 1f: cada rubrica ficou gravada no email do token (nao do corpo)';
END $$;

-- ---------------------------------------------------------------------------
-- 2) doc_rubricas_da_versao: so signatarios, e so para editores/signatarios
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.gestor@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; m int; BEGIN
  SELECT count(*), count(*) FILTER (WHERE email = 't186.outro@sga.co.ao') INTO n, m
    FROM public.doc_rubricas_da_versao((SELECT id FROM t186 WHERE k = 'v1'));
  ASSERT n = 2, 'gestor devia ver as 2 rubricas dos signatarios, viu ' || n;
  ASSERT m = 0, 'a rubrica do nao-signatario nao pode aparecer';
  RAISE NOTICE 'OK 2a: editor ve as rubricas dos signatarios e nao a do nao-signatario';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.leitor@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.doc_rubricas_da_versao((SELECT id FROM t186 WHERE k = 'v1'));
  ASSERT n = 0, 'leitor nao pode ver rubricas, viu ' || n;
  RAISE NOTICE 'OK 2b: leitor nao recebe rubricas';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.outro@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.doc_rubricas_da_versao((SELECT id FROM t186 WHERE k = 'v1'));
  ASSERT n = 0, 'nao-signatario com rubrica nao pode ver as outras, viu ' || n;
  RAISE NOTICE 'OK 2c: quem tem rubrica mas nao assinou nao ve as dos outros';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.elaborador@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.doc_rubricas_da_versao((SELECT id FROM t186 WHERE k = 'v1'));
  ASSERT n = 2, 'signatario devia ver as rubricas dos co-signatarios, viu ' || n;
  RAISE NOTICE 'OK 2d: signatario ve as rubricas dos co-signatarios desta versao';
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- 3) Copia assinada: recusas e registo
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.leitor@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.doc_copia_assinada_registar((SELECT id FROM t186 WHERE k = 'v1'), 'copias-assinadas/2026/t186/a.pdf',
    repeat('c', 64), 1000, 'a.pdf', 'ab12cd34ef56' || repeat('0', 52));
  RAISE EXCEPTION 'FALHOU: leitor registou copia assinada';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 3a: quem nao pode editar nao regista copia';
END $$;
DO $$ BEGIN
  INSERT INTO public.documento_ficheiro (documento_id, versao_id, papel, caminho, nome, sha256, origem_sha256, origem_ficheiro_id)
  VALUES ((SELECT id FROM t186 WHERE k = 'd1'), (SELECT id FROM t186 WHERE k = 'v1'), 'assinado', 'copias-assinadas/x.pdf', 'x.pdf',
          repeat('c', 64), 'ab12cd34ef56' || repeat('0', 52), (SELECT id FROM t186 WHERE k = 'f1'));
  RAISE EXCEPTION 'FALHOU: INSERT directo de papel assinado aceite';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 3b: INSERT directo de copia assinada recusado (so pela RPC)';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"t186.gestor@sga.co.ao"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.doc_copia_assinada_registar((SELECT id FROM t186 WHERE k = 'v1'), 'copias-assinadas/2026/t186/a.pdf',
    repeat('c', 64), 1000, 'a.pdf', repeat('9', 64));
  RAISE EXCEPTION 'FALHOU: aceitou sha de origem errado';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 3c: SHA de origem errado recusado';
END $$;
DO $$ BEGIN
  PERFORM public.doc_copia_assinada_registar((SELECT id FROM t186 WHERE k = 'v1'), 'editaveis/2026/t186/a.pdf',
    repeat('c', 64), 1000, 'a.pdf', 'ab12cd34ef56' || repeat('0', 52));
  RAISE EXCEPTION 'FALHOU: aceitou caminho de editavel';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 3d: caminho sob editaveis/ recusado';
END $$;
DO $$ DECLARE c1 uuid; c2 uuid; j jsonb; BEGIN
  c1 := public.doc_copia_assinada_registar((SELECT id FROM t186 WHERE k = 'v1'), 'copias-assinadas/2026/t186/a.pdf',
    repeat('c', 64), 1000, 'a.pdf', 'ab12cd34ef56' || repeat('0', 52));
  c2 := public.doc_copia_assinada_registar((SELECT id FROM t186 WHERE k = 'v1'), '/private-uploads/copias-assinadas/2026/t186/b.pdf',
    repeat('d', 64), 1001, 'b.pdf', 'AB12CD34EF56' || repeat('0', 52));
  j := public.doc_copia_assinada_da_versao((SELECT id FROM t186 WHERE k = 'v1'));
  ASSERT (j ->> 'id')::uuid = c2, 'a copia vigente devia ser a segunda';
  ASSERT j ->> 'caminho' = 'copias-assinadas/2026/t186/b.pdf', 'caminho devia vir normalizado, veio ' || (j ->> 'caminho');
  ASSERT j ->> 'codigo' = 'AB12-CD34-EF56', 'codigo errado: ' || coalesce(j ->> 'codigo', 'null');
  ASSERT public.doc_verificacao_codigo((SELECT id FROM t186 WHERE k = 'v1')) = 'AB12-CD34-EF56', 'doc_verificacao_codigo errado';
  RAISE NOTICE 'OK 3e: registo aceite; a segunda copia substitui a primeira; codigo AB12-CD34-EF56';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.documento_ficheiro WHERE versao_id = (SELECT id FROM t186 WHERE k = 'v1') AND papel = 'assinado') = 2,
    'as duas copias deviam continuar registadas (historico)';
  ASSERT (SELECT count(*) FROM public.documento_ficheiro WHERE versao_id = (SELECT id FROM t186 WHERE k = 'v1') AND papel = 'assinado'
           AND substituida_em IS NOT NULL) = 1, 'a primeira devia estar marcada substituida';
  ASSERT (SELECT bool_and(carimbo_aplicado_em IS NOT NULL AND carimbo_por = 't186.gestor@sga.co.ao')
            FROM public.documento_assinatura WHERE versao_id = (SELECT id FROM t186 WHERE k = 'v1')), 'carimbo_aplicado_em nao marcado';
  ASSERT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'copia_assinada_registada'
                  AND id_registro = (SELECT id FROM t186 WHERE k = 'd1')::text), 'sem auditoria';
  ASSERT EXISTS (SELECT 1 FROM public.documento_aprovacao_passo WHERE acao = 'carimbo_aplicado'
                  AND documento_id = (SELECT id FROM t186 WHERE k = 'd1')), 'sem passo carimbo_aplicado';
  RAISE NOTICE 'OK 3f: historico mantido, carimbo marcado, auditoria e passo do fluxo escritos';
END $$;
DO $$ BEGIN
  DELETE FROM public.documento_ficheiro WHERE papel = 'assinado' AND versao_id = (SELECT id FROM t186 WHERE k = 'v1');
  RAISE EXCEPTION 'FALHOU: copia assinada apagada';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 3g: copia assinada nao se apaga (nem como superutilizador)';
END $$;
DO $$ DECLARE j jsonb; BEGIN
  j := public.doc_copia_assinada_por_chave(ARRAY['t186_original.pdf']);
  ASSERT j ->> 'caminho' = 'copias-assinadas/2026/t186/b.pdf', 'troca pelo arquivo_uri da versao falhou';
  j := public.doc_copia_assinada_por_chave(ARRAY['fluxo/2026/t186/original.pdf']);
  ASSERT j IS NULL, 'o PDF original selado do fluxo nao pode ser trocado pela copia';
  ASSERT public.doc_copia_assinada_por_chave(ARRAY['copias-assinadas/2026/t186/b.pdf']) IS NULL, 'a propria copia nao se troca';
  ASSERT (public.doc_copia_assinada_dona(ARRAY['copias-assinadas/2026/t186/a.pdf']) ->> 'vigente')::boolean = false, 'dona da copia antiga';
  RAISE NOTICE 'OK 3h: o servidor troca a chave da versao pela copia vigente; o original selado do fluxo nao e trocado';
END $$;

-- ---------------------------------------------------------------------------
-- 4) Verificacao publica
-- ---------------------------------------------------------------------------
DO $$ DECLARE j jsonb; BEGIN
  j := public.doc_verificacao_por_codigo('ab12 cd34 ef56');
  ASSERT (j ->> 'existe')::boolean, 'codigo normal nao encontrado';
  ASSERT j ->> 'estado' = 'em_vigor', 'estado devia ser em_vigor: ' || (j ->> 'estado');
  ASSERT j ->> 'titulo' = 'Manual de Teste 186', 'titulo em falta';
  ASSERT jsonb_array_length(j -> 'assinaturas') = 2, 'deviam vir 2 assinaturas';
  ASSERT (j -> 'copia' ->> 'sha256') = repeat('d', 64), 'copia vigente em falta';
  ASSERT position('@' IN j::text) = 0, 'a ficha publica nao pode ter emails';
  RAISE NOTICE 'OK 4a: ficha publica completa (sem emails)';

  j := public.doc_verificacao_por_codigo('FE98-DC76-BA54');
  ASSERT (j ->> 'existe')::boolean AND (j ->> 'restrito')::boolean, 'AVSEC devia existir e vir restrito';
  ASSERT NOT (j ? 'titulo') AND NOT (j ? 'assinaturas') AND NOT (j ? 'original') AND NOT (j ? 'aeroporto'),
    'AVSEC nao pode revelar titulo/assinaturas/impressoes/aeroporto: ' || j::text;
  ASSERT j ->> 'numero' = 'T186-PSA' AND j ->> 'revisao' = 'Revisao 02' AND j ->> 'estado' = 'em_vigor', 'AVSEC: numero/revisao/estado';
  RAISE NOTICE 'OK 4b: documento AVSEC so mostra numero, revisao e estado';

  j := public.doc_verificacao_por_codigo('T186-AAAA-0002');
  ASSERT (j ->> 'codigo') = 'AB12-CD34-EF56', 'codigo de assinatura devia levar a ficha da revisao';
  RAISE NOTICE 'OK 4c: codigo de uma assinatura individual leva a ficha da revisao';

  ASSERT NOT (public.doc_verificacao_por_codigo('0000-0000-0000') ->> 'existe')::boolean, 'codigo inexistente';
  ASSERT NOT (public.doc_verificacao_por_codigo('abc') ->> 'existe')::boolean, 'formato invalido';
  RAISE NOTICE 'OK 4d: codigo inexistente/invalido -> existe=false';
END $$;
-- versao substituida
DO $$ DECLARE j jsonb; v3 uuid; BEGIN
  UPDATE public.documento_versao SET estado = 'obsoleto' WHERE id = (SELECT id FROM t186 WHERE k = 'v1');
  INSERT INTO public.documento_versao (documento_id, versao, rotulo, arquivo_uri, estado, vigor_desde)
  VALUES ((SELECT id FROM t186 WHERE k = 'd1'), 2, 'Revisao 02', 't186_rev2.pdf', 'em_vigor', current_date) RETURNING id INTO v3;
  j := public.doc_verificacao_por_codigo('AB12-CD34-EF56');
  ASSERT j ->> 'estado' = 'substituida', 'devia estar substituida: ' || (j ->> 'estado');
  ASSERT j -> 'revisao_em_vigor' ->> 'revisao' = 'Revisao 02', 'devia indicar a revisao em vigor';
  RAISE NOTICE 'OK 4e: revisao antiga aparece substituida, com a revisao em vigor indicada';
END $$;
-- anon e authenticated nao chamam a verificacao nem as funcoes do servidor
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM public.doc_verificacao_por_codigo('AB12-CD34-EF56');
  RAISE EXCEPTION 'FALHOU: anon chamou doc_verificacao_por_codigo';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 4f: anon nao chama doc_verificacao_por_codigo';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.doc_copia_assinada_por_chave(ARRAY['x']);
  RAISE EXCEPTION 'FALHOU: authenticated chamou doc_copia_assinada_por_chave';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 4g: authenticated nao chama as funcoes so do servidor';
END $$;
RESET ROLE;

DO $$ BEGIN RAISE NOTICE '=== teste-186: TODAS AS VERIFICACOES PASSARAM (vai ser feito ROLLBACK) ==='; END $$;
ROLLBACK;
