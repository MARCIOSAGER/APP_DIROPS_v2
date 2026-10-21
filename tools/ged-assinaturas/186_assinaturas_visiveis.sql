-- ============================================================================
-- 186_assinaturas_visiveis.sql - GED: assinaturas visiveis no PDF (rubricas), copia assinada derivada do
-- original selado, e verificacao publica por codigo (QR -> /vd/<codigo>).
--
--   Encaixa na 156 (fluxo de aprovacao) sem mexer no que ela garante:
--     * o PDF ORIGINAL assinado (documento_ficheiro papel 'pdf') nunca e alterado: o selo da 156 continua intacto;
--     * a COPIA ASSINADA e um ficheiro DERIVADO (papel 'assinado'), carregado pelo browser e registado aqui por
--       RPC SECURITY DEFINER. Nunca se apaga: uma copia mais recente marca a anterior como substituida;
--     * o CODIGO de verificacao de uma revisao = 12 primeiros hex (maiusculas, 4-4-4) do SHA-256 do PDF original
--       que a aprovacao final selou. Calcula-se a partir do ficheiro, por isso qualquer pessoa com o original o
--       pode recalcular; o servidor so o resolve para a ficha publica.
--
--   DECISAO (contrato, ponto 3): a copia assinada so se regista depois da APROVACAO FINAL (fluxo da versao em
--   'aprovado', com assinatura do acto 'aprovacao'). Uma copia com assinaturas parciais circularia como se fosse
--   o documento aprovado - e exactamente o equivoco que a copia existe para evitar. Antes da aprovacao, o portal
--   mostra as assinaturas no ecra; o PDF com rubricas so nasce no fim.
--
--   DECISAO (servir a copia): o SERVIDOR troca o ficheiro (patch 32). Quem abre o documento/versao pelo caminho
--   normal (portal, comparar versoes, links /s/ /p/ /v/) recebe a copia assinada vigente dessa versao, com o
--   carimbo de copia controlada por cima. Para isso o servidor usa doc_copia_assinada_por_chave (service_role).
--
--   Idempotente. ASCII puro (acentos em literais via chr()). Aplicar com psql -v ON_ERROR_STOP=1.
-- ============================================================================
SET client_encoding = 'UTF8';
SET client_min_messages = warning;
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1 - RUBRICAS (assinatura manuscrita digitalizada de cada pessoa)
-- ============================================================================
-- Ninguem le esta tabela directamente: nem anon, nem authenticated. So as funcoes abaixo, que decidem quem ve o que.
CREATE TABLE IF NOT EXISTS public.documento_rubrica (
  email          text PRIMARY KEY,
  imagem         text NOT NULL,
  sha256         text NOT NULL,
  actualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doc_rubrica_email_min_chk CHECK (email = lower(email) AND email <> ''),
  CONSTRAINT doc_rubrica_sha_chk CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT doc_rubrica_formato_chk CHECK (imagem ~ '^data:image/(png|jpeg);base64,'),
  CONSTRAINT doc_rubrica_tamanho_chk CHECK (length(imagem) <= 280000)
);
ALTER TABLE public.documento_rubrica ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documento_rubrica FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE public.documento_rubrica IS 'Rubrica (assinatura manuscrita digitalizada) de cada pessoa, como data URL PNG/JPEG. Sem privilegios para ninguem: so doc_rubrica_guardar/minha/da_versao lhe chegam.';

-- grava/substitui a rubrica do PROPRIO (email do token). p_imagem NULL apaga.
CREATE OR REPLACE FUNCTION public.doc_rubrica_guardar(p_imagem text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  c public.doc_ctx_t := public.doc_ctx();
  v_b64 text; v_bin bytea; v_sha text; v_em timestamptz; v_nome text;
BEGIN
  IF coalesce(c.email, '') = '' OR NOT public.doc_membro() THEN
    RAISE EXCEPTION 'Sessao sem utilizador do portal: entre de novo.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT full_name INTO v_nome FROM public.users WHERE lower(email) = c.email LIMIT 1;

  IF p_imagem IS NULL OR btrim(p_imagem) = '' THEN
    DELETE FROM public.documento_rubrica WHERE email = c.email;
    INSERT INTO public.log_auditoria (usuario_email, usuario_nome, entidade, acao, modulo, id_registro, detalhes, created_date)
    VALUES (c.email, coalesce(v_nome, c.email), 'documento_rubrica', 'rubrica_apagada', 'Documentos', c.email,
            'Rubrica apagada pelo proprio', now());
    RETURN jsonb_build_object('ok', true, 'apagada', true);
  END IF;

  p_imagem := btrim(p_imagem);
  IF p_imagem !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$' THEN
    RAISE EXCEPTION 'A rubrica tem de ser uma imagem PNG ou JPEG (data:image/png;base64,... ou data:image/jpeg;base64,...).'
      USING ERRCODE = 'check_violation';
  END IF;
  IF length(p_imagem) > 280000 THEN
    RAISE EXCEPTION 'A imagem da rubrica e grande demais (maximo cerca de 200 KB). Recorte-a ou reduza a resolucao.'
      USING ERRCODE = 'check_violation';
  END IF;
  v_b64 := regexp_replace(substr(p_imagem, strpos(p_imagem, ',') + 1), '\s', '', 'g');
  BEGIN
    v_bin := decode(v_b64, 'base64');
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A imagem da rubrica nao e base64 valido.' USING ERRCODE = 'check_violation';
  END;
  -- o conteudo tem de ser mesmo o que o prefixo diz (assinaturas PNG / JPEG)
  IF NOT ((p_imagem LIKE 'data:image/png;%' AND substring(v_bin FROM 1 FOR 8) = '\x89504e470d0a1a0a'::bytea)
       OR (p_imagem LIKE 'data:image/jpeg;%' AND substring(v_bin FROM 1 FOR 3) = '\xffd8ff'::bytea)) THEN
    RAISE EXCEPTION 'O conteudo da imagem nao corresponde ao formato declarado (PNG/JPEG).' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_bin) < 64 THEN
    RAISE EXCEPTION 'A imagem da rubrica esta vazia.' USING ERRCODE = 'check_violation';
  END IF;
  v_sha := encode(digest(v_bin, 'sha256'), 'hex');

  INSERT INTO public.documento_rubrica AS r (email, imagem, sha256, actualizado_em)
  VALUES (c.email, p_imagem, v_sha, now())
  ON CONFLICT (email) DO UPDATE SET imagem = EXCLUDED.imagem, sha256 = EXCLUDED.sha256, actualizado_em = now()
  RETURNING r.actualizado_em INTO v_em;

  INSERT INTO public.log_auditoria (usuario_email, usuario_nome, entidade, acao, modulo, id_registro, detalhes, dados_alterados, created_date)
  VALUES (c.email, coalesce(v_nome, c.email), 'documento_rubrica', 'rubrica_guardada', 'Documentos', c.email,
          'Rubrica guardada pelo proprio', jsonb_build_object('sha256', v_sha, 'bytes', length(v_bin)), now());
  RETURN jsonb_build_object('ok', true, 'sha256', v_sha, 'actualizado_em', v_em);
END $fn$;
REVOKE ALL ON FUNCTION public.doc_rubrica_guardar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doc_rubrica_guardar(text) TO authenticated, service_role;
COMMENT ON FUNCTION public.doc_rubrica_guardar(text) IS 'Grava/substitui a rubrica do proprio utilizador (email do token). NULL apaga. Valida PNG/JPEG em data URL ate ~200 KB.';

CREATE OR REPLACE FUNCTION public.doc_rubrica_minha()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT jsonb_build_object('imagem', r.imagem, 'actualizado_em', r.actualizado_em)
    FROM public.documento_rubrica r
   WHERE r.email = (public.doc_ctx()).email AND (public.doc_ctx()).email <> ''
$fn$;
REVOKE ALL ON FUNCTION public.doc_rubrica_minha() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doc_rubrica_minha() TO authenticated, service_role;

-- As rubricas de quem ASSINOU esta versao, e so para quem pode editar o documento ou e um desses signatarios.
CREATE OR REPLACE FUNCTION public.doc_rubricas_da_versao(p_versao uuid)
RETURNS TABLE (email text, imagem text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE c public.doc_ctx_t := public.doc_ctx(); v_doc uuid;
BEGIN
  IF p_versao IS NULL OR coalesce(c.email, '') = '' THEN RETURN; END IF;
  SELECT documento_id INTO v_doc FROM public.documento_versao WHERE id = p_versao;
  IF v_doc IS NULL THEN RETURN; END IF;
  IF NOT (public.pode_editar_documento(v_doc)
          OR EXISTS (SELECT 1 FROM public.documento_assinatura a
                      WHERE a.versao_id = p_versao AND lower(a.signatario_email) = c.email)) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT r.email, r.imagem
      FROM public.documento_rubrica r
     WHERE r.email IN (SELECT DISTINCT lower(a.signatario_email) FROM public.documento_assinatura a WHERE a.versao_id = p_versao);
END $fn$;
REVOKE ALL ON FUNCTION public.doc_rubricas_da_versao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doc_rubricas_da_versao(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.doc_rubricas_da_versao(uuid) IS 'Rubricas dos signatarios desta versao (documento_assinatura), so para quem pode editar o documento ou assinou a versao. Nunca devolve rubricas de nao-signatarios.';

-- ============================================================================
-- 2 - PAPEL 'assinado' em documento_ficheiro
-- ============================================================================
ALTER TABLE public.documento_ficheiro ADD COLUMN IF NOT EXISTS origem_ficheiro_id uuid REFERENCES public.documento_ficheiro(id) ON DELETE SET NULL;
ALTER TABLE public.documento_ficheiro ADD COLUMN IF NOT EXISTS origem_sha256 text;
ALTER TABLE public.documento_ficheiro ADD COLUMN IF NOT EXISTS substituida_em timestamptz;
ALTER TABLE public.documento_ficheiro ADD COLUMN IF NOT EXISTS substituida_por text;
COMMENT ON COLUMN public.documento_ficheiro.origem_sha256 IS 'Papel assinado: SHA-256 do PDF original selado de que esta copia foi derivada.';
COMMENT ON COLUMN public.documento_ficheiro.substituida_em IS 'Papel assinado: quando uma copia mais recente a substituiu (a linha fica, para historico).';

ALTER TABLE public.documento_ficheiro DROP CONSTRAINT IF EXISTS documento_ficheiro_papel_check;
ALTER TABLE public.documento_ficheiro ADD CONSTRAINT documento_ficheiro_papel_check
  CHECK (papel IN ('pdf', 'editavel', 'assinado'));
ALTER TABLE public.documento_ficheiro DROP CONSTRAINT IF EXISTS doc_ficheiro_prefixo_chk;
ALTER TABLE public.documento_ficheiro ADD CONSTRAINT doc_ficheiro_prefixo_chk CHECK (
  (papel = 'editavel' AND bucket = 'private-uploads' AND caminho LIKE 'editaveis/%')
  OR (papel = 'pdf' AND NOT public.doc_caminho_e_editavel(caminho))
  OR (papel = 'assinado' AND bucket = 'private-uploads' AND NOT public.doc_caminho_e_editavel(caminho))
);
ALTER TABLE public.documento_ficheiro DROP CONSTRAINT IF EXISTS doc_ficheiro_assinado_origem_chk;
ALTER TABLE public.documento_ficheiro ADD CONSTRAINT doc_ficheiro_assinado_origem_chk CHECK (
  papel <> 'assinado' OR (origem_sha256 ~ '^[0-9a-f]{64}$' AND origem_ficheiro_id IS NOT NULL)
);
-- uma copia vigente por versao
CREATE UNIQUE INDEX IF NOT EXISTS doc_ficheiro_assinado_vigente
  ON public.documento_ficheiro (versao_id) WHERE papel = 'assinado' AND substituida_em IS NULL;
CREATE INDEX IF NOT EXISTS doc_ficheiro_caminho_idx ON public.documento_ficheiro (caminho);

-- A ronda dos ficheiros 'pdf'/'editavel' vem do fluxo vivo (156). A da copia assinada e um contador proprio,
-- dado pela RPC de registo: nao se deixa o gatilho reescreve-lo (colidiria com doc_ficheiro_papel_unico).
CREATE OR REPLACE FUNCTION public.documento_ficheiro_ronda() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_ronda integer;
BEGIN
  IF NEW.papel IS DISTINCT FROM 'assinado' THEN
    SELECT ronda INTO v_ronda FROM public.documento_aprovacao
     WHERE versao_id = NEW.versao_id AND estado NOT IN ('cancelado', 'aprovado')
     ORDER BY created_date DESC LIMIT 1;
    NEW.ronda := coalesce(v_ronda, NEW.ronda, 1);
  END IF;
  IF NEW.documento_id IS NULL THEN
    SELECT documento_id INTO NEW.documento_id FROM public.documento_versao WHERE id = NEW.versao_id;
  END IF;
  NEW.sha256 := lower(NEW.sha256);
  NEW.origem_sha256 := lower(NEW.origem_sha256);
  RETURN NEW;
END $fn$;

-- A copia assinada tambem e imutavel: corrigir = registar outra copia (que substitui esta), nunca reescrever.
CREATE OR REPLACE FUNCTION public.documento_ficheiro_assinado_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.papel = 'assinado' THEN
      RAISE EXCEPTION 'Uma copia assinada nao se apaga: registe uma copia nova, que substitui esta e a deixa no historico.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.papel = 'assinado' AND (NEW.caminho IS DISTINCT FROM OLD.caminho OR NEW.sha256 IS DISTINCT FROM OLD.sha256
       OR NEW.bucket IS DISTINCT FROM OLD.bucket OR NEW.papel IS DISTINCT FROM OLD.papel
       OR NEW.versao_id IS DISTINCT FROM OLD.versao_id OR NEW.origem_sha256 IS DISTINCT FROM OLD.origem_sha256) THEN
    RAISE EXCEPTION 'Uma copia assinada nao se altera: registe uma copia nova.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.papel IS DISTINCT FROM 'assinado' AND NEW.papel = 'assinado' THEN
    RAISE EXCEPTION 'Um ficheiro nao muda de papel para copia assinada.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS documento_ficheiro_assinado_imutavel_tg ON public.documento_ficheiro;
CREATE TRIGGER documento_ficheiro_assinado_imutavel_tg
  BEFORE UPDATE OR DELETE ON public.documento_ficheiro
  FOR EACH ROW EXECUTE FUNCTION public.documento_ficheiro_assinado_imutavel();

-- 'authenticated' nao insere copias assinadas por fora da RPC (que confere a origem e a aprovacao).
DROP POLICY IF EXISTS doc_ficheiro_insert ON public.documento_ficheiro;
CREATE POLICY doc_ficheiro_insert ON public.documento_ficheiro FOR INSERT TO authenticated
  WITH CHECK (papel IN ('pdf', 'editavel')
              AND public.pode_editar_documento(documento_id)
              AND (papel = 'pdf' OR public.pode_ver_editavel(documento_id)));
-- SELECT continua igual (156): 'editavel' -> pode_ver_editavel; 'pdf' e 'assinado' -> pode_ver_documento.

-- registo de acesso por ficheiro passa a aceitar o papel novo
ALTER TABLE public.documento_ficheiro_acesso DROP CONSTRAINT IF EXISTS documento_ficheiro_acesso_papel_check;
ALTER TABLE public.documento_ficheiro_acesso ADD CONSTRAINT documento_ficheiro_acesso_papel_check
  CHECK (papel IN ('pdf', 'editavel', 'assinado'));

-- ============================================================================
-- 3 - ORIGINAL SELADO E CODIGO DE VERIFICACAO
-- ============================================================================
-- Codigo de uma revisao a partir do SHA-256 do PDF original: 12 primeiros hex, maiusculas, 4-4-4.
CREATE OR REPLACE FUNCTION public.doc_codigo_de_sha(p_sha text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE WHEN p_sha ~* '^[0-9a-f]{12}' THEN
    upper(substr(p_sha, 1, 4) || '-' || substr(p_sha, 5, 4) || '-' || substr(p_sha, 9, 4)) END
$fn$;
GRANT EXECUTE ON FUNCTION public.doc_codigo_de_sha(text) TO authenticated, service_role;

-- O PDF original que a APROVACAO FINAL desta versao selou (o ficheiro da assinatura 'aprovacao' mais recente de
-- um fluxo aprovado). Interna: sem verificacao de acesso, por isso nao concedida a authenticated.
CREATE OR REPLACE FUNCTION public.doc_original_assinado(p_versao uuid)
RETURNS TABLE (ficheiro_id uuid, sha256 text, nome text, tamanho bigint, fluxo_id uuid, aprovado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT f.id, f.sha256, f.nome, f.tamanho, a.fluxo_id, a.assinado_em
    FROM public.documento_assinatura a
    JOIN public.documento_aprovacao fl ON fl.id = a.fluxo_id AND fl.estado = 'aprovado'
    JOIN public.documento_ficheiro f ON f.id = a.ficheiro_id AND f.papel = 'pdf'
   WHERE a.versao_id = p_versao AND a.acto = 'aprovacao' AND a.ficheiro_sha256 = f.sha256
   ORDER BY a.assinado_em DESC, a.id DESC
   LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.doc_original_assinado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doc_original_assinado(uuid) TO service_role;

-- Codigo de verificacao de uma versao (para o portal/gerador desenhar o QR). NULL se ainda nao ha aprovacao final.
CREATE OR REPLACE FUNCTION public.doc_verificacao_codigo(p_versao uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_doc uuid; v_sha text;
BEGIN
  SELECT documento_id INTO v_doc FROM public.documento_versao WHERE id = p_versao;
  IF v_doc IS NULL OR NOT public.pode_ver_documento(v_doc) THEN RETURN NULL; END IF;
  SELECT o.sha256 INTO v_sha FROM public.doc_original_assinado(p_versao) o;
  RETURN public.doc_codigo_de_sha(v_sha);
END $fn$;
REVOKE ALL ON FUNCTION public.doc_verificacao_codigo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doc_verificacao_codigo(uuid) TO authenticated, service_role;

-- ============================================================================
-- 4 - COPIA ASSINADA: registo e consulta
-- ============================================================================
CREATE OR REPLACE FUNCTION public.doc_copia_assinada_registar(
  p_versao uuid, p_caminho text, p_sha256 text, p_tamanho bigint, p_nome text, p_origem_sha256 text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  c public.doc_ctx_t := public.doc_ctx();
  v record; o record; v_nome text; v_caminho text; v_ronda integer; v_id uuid; v_anterior uuid; v_n integer;
BEGIN
  IF coalesce(c.email, '') = '' THEN
    RAISE EXCEPTION 'Sessao sem utilizador: entre de novo no portal.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT id, documento_id, versao, rotulo INTO v FROM public.documento_versao WHERE id = p_versao FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Revisao inexistente.' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT public.pode_editar_documento(v.documento_id) THEN
    RAISE EXCEPTION 'Nao tem permissao para registar a copia assinada deste documento (editor do documento ou gestor).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO o FROM public.doc_original_assinado(p_versao);
  IF o.ficheiro_id IS NULL THEN
    RAISE EXCEPTION 'Esta revisao ainda nao tem aprovacao final assinada: a copia assinada so se gera depois de o director aprovar.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF lower(coalesce(p_origem_sha256, '')) <> o.sha256 THEN
    RAISE EXCEPTION 'A copia nao foi gerada a partir do PDF original assinado desta revisao (impressao digital de origem diferente). Gere-a de novo a partir do original.'
      USING ERRCODE = 'check_violation';
  END IF;
  p_sha256 := lower(btrim(coalesce(p_sha256, '')));
  IF p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Impressao digital (SHA-256) da copia invalida.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_sha256 = o.sha256 THEN
    RAISE EXCEPTION 'A copia e identica ao original: nao tem as assinaturas desenhadas.' USING ERRCODE = 'check_violation';
  END IF;

  v_caminho := regexp_replace(btrim(coalesce(p_caminho, '')), '^/+', '');
  v_caminho := regexp_replace(v_caminho, '^private-uploads/', '');
  IF v_caminho = '' OR v_caminho ~ '(^|/)\.\.(/|$)' OR v_caminho ~ '[\\?#]' OR length(v_caminho) > 400 THEN
    RAISE EXCEPTION 'Caminho da copia invalido.' USING ERRCODE = 'check_violation';
  END IF;
  IF public.doc_caminho_e_editavel(v_caminho) THEN
    RAISE EXCEPTION 'A copia assinada nao pode viver sob o prefixo reservado aos editaveis.' USING ERRCODE = 'check_violation';
  END IF;
  IF lower(v_caminho) !~ '\.pdf$' THEN
    RAISE EXCEPTION 'A copia assinada tem de ser um PDF.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.documento_ficheiro f WHERE f.caminho = v_caminho) THEN
    RAISE EXCEPTION 'Ja existe um ficheiro registado neste caminho.' USING ERRCODE = 'unique_violation';
  END IF;

  -- a anterior fica, marcada como substituida
  UPDATE public.documento_ficheiro
     SET substituida_em = now(), substituida_por = c.email
   WHERE versao_id = p_versao AND papel = 'assinado' AND substituida_em IS NULL
  RETURNING id INTO v_anterior;

  SELECT coalesce(max(ronda), 0) + 1 INTO v_ronda
    FROM public.documento_ficheiro WHERE versao_id = p_versao AND papel = 'assinado';

  INSERT INTO public.documento_ficheiro (documento_id, versao_id, papel, ronda, bucket, caminho, nome, mime, tamanho,
                                         sha256, carregado_por, origem_ficheiro_id, origem_sha256)
  VALUES (v.documento_id, p_versao, 'assinado', v_ronda, 'private-uploads', v_caminho,
          coalesce(nullif(btrim(coalesce(p_nome, '')), ''), regexp_replace(v_caminho, '^.*/', '')),
          'application/pdf', p_tamanho, p_sha256, c.email, o.ficheiro_id, o.sha256)
  RETURNING id INTO v_id;

  -- o carimbo visivel das assinaturas desta versao foi desenhado (nesta copia)
  UPDATE public.documento_assinatura
     SET carimbo_aplicado_em = now(), carimbo_por = c.email
   WHERE versao_id = p_versao;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  SELECT full_name INTO v_nome FROM public.users WHERE lower(email) = c.email LIMIT 1;
  IF o.fluxo_id IS NOT NULL THEN
    INSERT INTO public.documento_aprovacao_passo (fluxo_id, documento_id, ronda, acao, por_email, por_nome, detalhes)
    SELECT o.fluxo_id, v.documento_id, fl.ronda, 'carimbo_aplicado', c.email, v_nome,
           jsonb_build_object('copia_id', v_id, 'sha256', p_sha256, 'origem_sha256', o.sha256,
                              'substitui', v_anterior, 'codigo', public.doc_codigo_de_sha(o.sha256))
      FROM public.documento_aprovacao fl WHERE fl.id = o.fluxo_id;
  END IF;
  INSERT INTO public.log_auditoria (usuario_email, usuario_nome, entidade, acao, modulo, id_registro, detalhes, dados_alterados, created_date)
  VALUES (c.email, coalesce(v_nome, c.email), 'documento', 'copia_assinada_registada', 'Documentos', v.documento_id::text,
          'Copia assinada da revisao ' || coalesce(v.rotulo, v.versao::text) || ' (codigo ' || public.doc_codigo_de_sha(o.sha256) || ')'
            || CASE WHEN v_anterior IS NOT NULL THEN ' - substitui a copia anterior' ELSE '' END,
          jsonb_build_object('versao_id', p_versao, 'copia_id', v_id, 'caminho', v_caminho, 'sha256', p_sha256,
                             'origem_sha256', o.sha256, 'substitui', v_anterior, 'assinaturas_marcadas', v_n),
          now());
  RETURN v_id;
END $fn$;
REVOKE ALL ON FUNCTION public.doc_copia_assinada_registar(uuid, text, text, bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doc_copia_assinada_registar(uuid, text, text, bigint, text, text) TO authenticated, service_role;
COMMENT ON FUNCTION public.doc_copia_assinada_registar(uuid, text, text, bigint, text, text) IS 'Regista a copia assinada (PDF com rubricas e QR) derivada do original selado. Exige editar o documento, aprovacao final e origem = SHA do original. A copia anterior fica marcada substituida.';

CREATE OR REPLACE FUNCTION public.doc_copia_assinada_da_versao(p_versao uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_doc uuid; r jsonb;
BEGIN
  SELECT documento_id INTO v_doc FROM public.documento_versao WHERE id = p_versao;
  IF v_doc IS NULL OR NOT public.pode_ver_documento(v_doc) THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('id', f.id, 'caminho', f.caminho, 'sha256', f.sha256, 'nome', f.nome, 'tamanho', f.tamanho,
                            'criado_em', f.created_date, 'criado_por', f.carregado_por,
                            'origem_sha256', f.origem_sha256, 'codigo', public.doc_codigo_de_sha(f.origem_sha256))
    INTO r
    FROM public.documento_ficheiro f
   WHERE f.versao_id = p_versao AND f.papel = 'assinado' AND f.substituida_em IS NULL
   LIMIT 1;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.doc_copia_assinada_da_versao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doc_copia_assinada_da_versao(uuid) TO authenticated, service_role;

-- SERVIDOR (service_role): dada uma chave de storage pedida (todas as formas de codificacao), a copia assinada
-- vigente da versao cujo arquivo_uri e essa chave (o que documento.arquivo_privado_uri copia ao entrar em vigor).
-- O PDF original do fluxo (documento_ficheiro papel 'pdf', servido pela rota documentos-aprovacao) NAO e trocado:
-- e o artefacto selado, que os signatarios, o gerador da copia e a verificacao precisam de ver tal e qual.
-- NULL = servir o que foi pedido.
CREATE OR REPLACE FUNCTION public.doc_copia_assinada_por_chave(p_chaves text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT jsonb_build_object('id', f.id, 'documento_id', f.documento_id, 'versao_id', f.versao_id,
                            'versao_estado', v.estado, 'bucket', f.bucket, 'caminho', f.caminho,
                            'sha256', f.sha256, 'nome', f.nome)
    FROM public.documento_versao v
    JOIN public.documento_ficheiro f ON f.versao_id = v.id AND f.papel = 'assinado' AND f.substituida_em IS NULL
   WHERE v.arquivo_uri = ANY(p_chaves)
   ORDER BY (v.estado = 'em_vigor') DESC, f.created_date DESC
   LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.doc_copia_assinada_por_chave(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doc_copia_assinada_por_chave(text[]) TO service_role;

-- SERVIDOR (service_role): a quem pertence a chave de uma COPIA ASSINADA (para autorizar e carimbar quando o
-- portal pede o endereco da propria copia).
CREATE OR REPLACE FUNCTION public.doc_copia_assinada_dona(p_chaves text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT jsonb_build_object('documento_id', f.documento_id, 'versao_id', f.versao_id, 'versao_estado', v.estado,
                            'vigente', f.substituida_em IS NULL)
    FROM public.documento_ficheiro f JOIN public.documento_versao v ON v.id = f.versao_id
   WHERE f.papel = 'assinado' AND f.caminho = ANY(p_chaves)
   LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.doc_copia_assinada_dona(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doc_copia_assinada_dona(text[]) TO service_role;

-- ============================================================================
-- 5 - VERIFICACAO PUBLICA POR CODIGO (chamada pelo servidor com service_role; NAO concedida a anon)
-- ============================================================================
-- Aceita o codigo de revisao (12 hex, 4-4-4; tolera espacos, minusculas, O->0 e I/L->1) e, por conveniencia, o
-- codigo de uma assinatura individual (XXXX-XXXX-XXXX da 156), que leva a mesma ficha da revisao assinada.
-- Documentos AVSEC/classificados: so numero, revisao e estado - sem titulo, aeroporto, nomes nem impressoes digitais.
CREATE OR REPLACE FUNCTION public.doc_verificacao_por_codigo(p_codigo text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_raw text; v_hex text; v_fic record; v record; d record; o record; cur record; ae record; cp record;
  v_restrito boolean; v_estado text; v_cod text; v_ass jsonb;
BEGIN
  v_raw := upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Za-z]', '', 'g'));
  IF length(v_raw) <> 12 THEN RETURN jsonb_build_object('existe', false, 'motivo', 'formato'); END IF;
  v_hex := translate(v_raw, 'OIL', '011');
  SELECT NULL::uuid AS id, NULL::uuid AS versao_id, NULL::text AS sha256, NULL::text AS nome, NULL::bigint AS tamanho
    INTO v_fic;

  -- 1) codigo de revisao: PDF original assinado cujo SHA-256 comeca por estes 12 hex
  IF v_hex ~ '^[0-9A-F]{12}$' THEN
    SELECT f.id, f.versao_id, f.sha256, f.nome, f.tamanho INTO v_fic
      FROM public.documento_ficheiro f
     WHERE f.papel = 'pdf' AND f.sha256 LIKE lower(v_hex) || '%'
       AND EXISTS (SELECT 1 FROM public.documento_assinatura a WHERE a.ficheiro_id = f.id)
     ORDER BY EXISTS (SELECT 1 FROM public.documento_assinatura a WHERE a.ficheiro_id = f.id AND a.acto = 'aprovacao') DESC,
              f.created_date DESC
     LIMIT 1;
  END IF;
  -- 2) codigo de uma assinatura individual
  IF v_fic.id IS NULL THEN
    SELECT f.id, f.versao_id, f.sha256, f.nome, f.tamanho INTO v_fic
      FROM public.documento_assinatura a JOIN public.documento_ficheiro f ON f.id = a.ficheiro_id
     WHERE a.codigo = substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4)
     LIMIT 1;
  END IF;
  IF v_fic.id IS NULL THEN RETURN jsonb_build_object('existe', false, 'motivo', 'desconhecido'); END IF;

  SELECT * INTO v FROM public.documento_versao WHERE id = v_fic.versao_id;
  SELECT id, numero, titulo, aeroporto_id, deleted_at, processo_codigo, classificacao_categoria,
         nivel_confidencialidade, em_vigor_desde
    INTO d FROM public.documento WHERE id = v.documento_id;
  v_cod := public.doc_codigo_de_sha(v_fic.sha256);
  SELECT * INTO o FROM public.doc_original_assinado(v.id);

  v_restrito := public.doc_e_restrito_avsec(d.processo_codigo, d.classificacao_categoria, d.nivel_confidencialidade)
                OR EXISTS (SELECT 1 FROM public.documento_avsec x WHERE x.documento_id = d.id);

  -- revisao em vigor do mesmo documento (pode ser esta)
  SELECT cv.id, cv.versao, cv.rotulo, cv.vigor_desde INTO cur
    FROM public.documento_versao cv
   WHERE cv.documento_id = d.id AND cv.estado = 'em_vigor'
   ORDER BY cv.versao DESC LIMIT 1;

  v_estado := CASE
    WHEN d.deleted_at IS NOT NULL THEN 'retirado'
    WHEN o.ficheiro_id IS NULL OR o.ficheiro_id <> v_fic.id THEN
      CASE WHEN o.ficheiro_id IS NULL AND v.estado IN ('rascunho', 'em_revisao') THEN 'aprovacao_em_curso'
           ELSE 'ficheiro_nao_aprovado' END        -- um PDF de uma ronda anterior, que a aprovacao final nao selou
    WHEN v.estado = 'em_vigor' THEN 'em_vigor'
    WHEN v.estado = 'aprovado' THEN 'aprovado'
    WHEN v.estado = 'obsoleto' THEN 'substituida'
    WHEN v.estado = 'rejeitado' THEN 'rejeitado'
    ELSE 'outro' END;

  IF v_restrito THEN
    RETURN jsonb_build_object(
      'existe', true, 'codigo', v_cod, 'restrito', true,
      'nota', 'documento de acesso restrito',
      'numero', d.numero,
      'revisao', coalesce(nullif(btrim(coalesce(v.rotulo, '')), ''), 'Versao ' || v.versao),
      'estado', v_estado,
      'revisao_em_vigor', CASE WHEN v_estado = 'substituida' AND cur.id IS NOT NULL THEN jsonb_build_object(
          'revisao', coalesce(nullif(btrim(coalesce(cur.rotulo, '')), ''), 'Versao ' || cur.versao)) END);
  END IF;

  SELECT codigo_icao, nome INTO ae FROM public.documentos_aeroporto WHERE id = d.aeroporto_id;
  SELECT f.sha256, f.nome, f.tamanho, f.created_date INTO cp
    FROM public.documento_ficheiro f
   WHERE f.versao_id = v.id AND f.papel = 'assinado' AND f.substituida_em IS NULL AND f.origem_ficheiro_id = v_fic.id
   LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'nome', coalesce(a.signatario_nome, '(sem nome registado)'),
           'papel', a.signatario_papel,
           'acto', a.acto,
           'significado', a.significado,
           'assinado_em', a.assinado_em,
           'codigo', a.codigo,
           'em_substituicao_de', CASE WHEN a.em_substituicao_de IS NOT NULL THEN
               coalesce((SELECT u.full_name FROM public.users u WHERE lower(u.email) = a.em_substituicao_de LIMIT 1), 'titular') END,
           'mesmo_ficheiro', a.ficheiro_sha256 = v_fic.sha256)
           ORDER BY t.ordem, a.assinado_em), '[]'::jsonb)
    INTO v_ass
    FROM public.documento_assinatura a JOIN public.documento_acto t ON t.codigo = a.acto
   WHERE a.versao_id = v.id
     AND (a.ficheiro_id = v_fic.id
          OR a.fluxo_id = (SELECT a2.fluxo_id FROM public.documento_assinatura a2 WHERE a2.ficheiro_id = v_fic.id
                            ORDER BY a2.assinado_em DESC LIMIT 1));

  RETURN jsonb_build_object(
    'existe', true, 'codigo', v_cod, 'restrito', false,
    'numero', d.numero, 'titulo', d.titulo,
    'aeroporto', CASE WHEN ae.nome IS NOT NULL THEN ae.nome || coalesce(' (' || ae.codigo_icao || ')', '') END,
    'revisao', coalesce(nullif(btrim(coalesce(v.rotulo, '')), ''), 'Versao ' || v.versao),
    'versao_numero', v.versao,
    'estado', v_estado,
    'em_vigor_desde', CASE WHEN v.estado IN ('em_vigor', 'obsoleto', 'aprovado') THEN coalesce(v.vigor_desde,
                         CASE WHEN v.estado = 'em_vigor' THEN d.em_vigor_desde END) END,
    'vigor_ate', v.vigor_ate,
    'aprovado_em', o.aprovado_em,
    'revisao_em_vigor', CASE WHEN cur.id IS NOT NULL AND cur.id <> v.id THEN jsonb_build_object(
        'revisao', coalesce(nullif(btrim(coalesce(cur.rotulo, '')), ''), 'Versao ' || cur.versao),
        'em_vigor_desde', cur.vigor_desde,
        'codigo', (SELECT public.doc_codigo_de_sha(x.sha256) FROM public.doc_original_assinado(cur.id) x)) END,
    'original', jsonb_build_object('sha256', v_fic.sha256, 'nome', v_fic.nome, 'tamanho', v_fic.tamanho),
    'copia', CASE WHEN cp.sha256 IS NOT NULL THEN jsonb_build_object('sha256', cp.sha256, 'nome', cp.nome,
                     'tamanho', cp.tamanho, 'criado_em', cp.created_date) END,
    'assinaturas', v_ass);
END $fn$;
REVOKE ALL ON FUNCTION public.doc_verificacao_por_codigo(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doc_verificacao_por_codigo(text) TO service_role;
COMMENT ON FUNCTION public.doc_verificacao_por_codigo(text) IS 'Ficha publica de verificacao de uma revisao assinada (pagina /vd/<codigo>). So service_role: o servidor de funcoes chama-a e desenha a pagina. AVSEC/classificados: so numero, revisao e estado.';

COMMIT;
NOTIFY pgrst, 'reload schema';
