-- ============================================================================
-- 181_documento_reserva.sql -- Portal de Documentos, Fase F0 do plano de edicao:
--   RESERVA PARA EDICAO (check-out). Quem vai preparar a revisao seguinte de um documento reserva-o; enquanto a
--   reserva estiver activa, mais ninguem carrega uma revisao nova desse documento (evita duas pessoas a editar
--   copias diferentes do mesmo manual e uma apagar o trabalho da outra).
--
--   * Tabela documento_reserva: uma linha por documento (PK = documento_id). A reserva expira sozinha
--     (expira_em, por omissao +7 dias): uma reserva expirada conta como livre e e substituida na reserva seguinte.
--     Libertar = apagar a linha (o rasto fica em log_auditoria). Activa <=> existe linha E expira_em > now().
--   * Leitura: quem ve o documento ve a reserva (para o aviso "Em edicao por X desde ...").
--   * Escrita SO pelas funcoes doc_reservar / doc_libertar (SECURITY DEFINER), que verificam:
--       - reservar: pode_editar_documento() (editor do documento ou gestor) e nao haver reserva activa de outra
--         pessoa (a propria pessoa pode renovar a sua);
--       - libertar: quem reservou, ou um gestor; forcar (libertar a reserva activa de outra pessoa) so gestor.
--   * doc_reserva_activa(p_doc) devolve a reserva activa (ou nada) -- para o servidor/ONLYOFFICE.
--   * Cada reserva / renovacao / libertacao / libertacao forcada fica em log_auditoria (modulo Documentos).
--   * Trigger em documento_versao: um utilizador (pedido com email no token) nao insere revisao nova num
--     documento reservado por OUTRA pessoa. Processos do servidor sem email (agendador, importacoes) passam.
--   Regra sagrada mantida: nada aqui altera o documento nem revisoes existentes.
--   Idempotente. Correr como postgres: psql -f 181_documento_reserva.sql
-- ============================================================================
SET client_min_messages = warning;
BEGIN;

CREATE TABLE IF NOT EXISTS public.documento_reserva (
  documento_id   uuid PRIMARY KEY REFERENCES public.documento(id) ON DELETE CASCADE,
  reservado_por  text NOT NULL,                         -- email em minusculas, como documento_versao.criado_por
  reservado_nome text,
  reservado_em   timestamptz NOT NULL DEFAULT now(),
  expira_em      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  nota           text,
  CONSTRAINT documento_reserva_expira_chk CHECK (expira_em > reservado_em),
  CONSTRAINT documento_reserva_email_chk CHECK (reservado_por = lower(btrim(reservado_por)) AND reservado_por <> '')
);
CREATE INDEX IF NOT EXISTS documento_reserva_por_idx ON public.documento_reserva (reservado_por);

ALTER TABLE public.documento_reserva ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documento_reserva FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.documento_reserva FROM authenticated;
GRANT SELECT ON public.documento_reserva TO authenticated;
GRANT ALL ON public.documento_reserva TO service_role;

DROP POLICY IF EXISTS doc_reserva_select ON public.documento_reserva;
CREATE POLICY doc_reserva_select ON public.documento_reserva FOR SELECT TO authenticated
  USING (public.pode_ver_documento(documento_id));

-- -- reservar (ou renovar a propria reserva) ---------------------------------
CREATE OR REPLACE FUNCTION public.doc_reservar(p_doc uuid, p_nota text DEFAULT NULL, p_dias integer DEFAULT 7)
RETURNS public.documento_reserva
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.doc_ctx_t := public.doc_ctx();
  r public.documento_reserva;
  v_nome text;
  v_dias integer := least(greatest(coalesce(p_dias, 7), 1), 30);
  v_renova boolean := false;
BEGIN
  IF coalesce(c.email, '') = '' THEN
    RAISE EXCEPTION 'Sessao sem utilizador: entre de novo no portal.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.pode_editar_documento(p_doc) THEN
    RAISE EXCEPTION 'Nao tem permissao para editar este documento: a reserva e para quem prepara a revisao seguinte (editor do documento ou gestor).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO r FROM public.documento_reserva WHERE documento_id = p_doc FOR UPDATE;
  IF FOUND AND r.expira_em > now() AND r.reservado_por <> c.email THEN
    RAISE EXCEPTION 'Este documento ja esta reservado para edicao por % desde %. Peca-lhe que o liberte, ou a um gestor que force a libertacao.',
      coalesce(r.reservado_nome, r.reservado_por), to_char(r.reservado_em AT TIME ZONE 'Africa/Luanda', 'DD/MM/YYYY HH24:MI')
      USING ERRCODE = 'P0001';
  END IF;
  v_renova := FOUND AND r.reservado_por = c.email AND r.expira_em > now();

  SELECT full_name INTO v_nome FROM public.users WHERE lower(email) = c.email LIMIT 1;

  INSERT INTO public.documento_reserva AS x (documento_id, reservado_por, reservado_nome, reservado_em, expira_em, nota)
  VALUES (p_doc, c.email, nullif(btrim(coalesce(v_nome, '')), ''), now(), now() + make_interval(days => v_dias),
          nullif(btrim(coalesce(p_nota, '')), ''))
  ON CONFLICT (documento_id) DO UPDATE
    SET reservado_por  = EXCLUDED.reservado_por,
        reservado_nome = EXCLUDED.reservado_nome,
        -- renovar mantem a data de inicio (o aviso diz "desde" quando a pessoa comecou a editar)
        reservado_em   = CASE WHEN v_renova THEN x.reservado_em ELSE EXCLUDED.reservado_em END,
        expira_em      = EXCLUDED.expira_em,
        nota           = coalesce(EXCLUDED.nota, CASE WHEN v_renova THEN x.nota END)
  RETURNING * INTO r;

  INSERT INTO public.log_auditoria (usuario_email, usuario_nome, entidade, acao, modulo, id_registro, detalhes, dados_alterados, created_date)
  VALUES (c.email, coalesce(v_nome, c.email), 'documento',
          CASE WHEN v_renova THEN 'documento_reserva_renovada' ELSE 'documento_reservado' END,
          'Documentos', p_doc::text,
          'Reserva para edicao ate ' || to_char(r.expira_em AT TIME ZONE 'Africa/Luanda', 'DD/MM/YYYY HH24:MI')
            || coalesce(' - ' || r.nota, ''),
          jsonb_build_object('reservado_por', r.reservado_por, 'reservado_em', r.reservado_em, 'expira_em', r.expira_em),
          now());
  RETURN r;
END $$;

-- -- libertar (quem reservou ou gestor; forcar = gestor sobre a reserva activa de outra pessoa) --
CREATE OR REPLACE FUNCTION public.doc_libertar(p_doc uuid, p_forcar boolean DEFAULT false, p_motivo text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.doc_ctx_t := public.doc_ctx();
  r public.documento_reserva;
  v_gestor boolean;
  v_dono boolean;
  v_activa boolean;
BEGIN
  IF coalesce(c.email, '') = '' THEN
    RAISE EXCEPTION 'Sessao sem utilizador: entre de novo no portal.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO r FROM public.documento_reserva WHERE documento_id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;     -- ja estava livre: nada a fazer

  v_gestor := (c.admin OR c.gestor) AND public.pode_editar_documento(p_doc);
  v_dono := r.reservado_por = c.email;
  v_activa := r.expira_em > now();

  IF NOT v_dono AND v_activa THEN
    IF NOT v_gestor THEN
      RAISE EXCEPTION 'So quem reservou o documento (%) ou um gestor o pode libertar.', coalesce(r.reservado_nome, r.reservado_por)
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT coalesce(p_forcar, false) THEN
      RAISE EXCEPTION 'A reserva e de % e ainda esta activa: para a retirar use Forcar libertacao.', coalesce(r.reservado_nome, r.reservado_por)
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF NOT v_dono AND NOT public.pode_editar_documento(p_doc) THEN
    -- uma reserva expirada ja nao prende ninguem: qualquer editor do documento a pode limpar
    RAISE EXCEPTION 'Nao tem permissao para editar este documento.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM public.documento_reserva WHERE documento_id = p_doc;

  INSERT INTO public.log_auditoria (usuario_email, usuario_nome, entidade, acao, modulo, id_registro, detalhes, dados_alterados, created_date)
  VALUES (c.email, c.email, 'documento',
          CASE WHEN NOT v_dono AND v_activa THEN 'documento_reserva_forcada' ELSE 'documento_libertado' END,
          'Documentos', p_doc::text,
          CASE WHEN NOT v_dono AND v_activa
                 THEN 'Libertacao forcada da reserva de ' || r.reservado_por
                      || coalesce(' - motivo: ' || nullif(btrim(coalesce(p_motivo, '')), ''), '')
               WHEN NOT v_activa THEN 'Reserva expirada de ' || r.reservado_por || ' retirada'
               ELSE 'Reserva para edicao libertada' END,
          jsonb_build_object('reservado_por', r.reservado_por, 'reservado_em', r.reservado_em, 'expira_em', r.expira_em),
          now());
  RETURN true;
END $$;

-- -- consulta: a reserva activa de um documento (vazio se livre ou expirada) --
CREATE OR REPLACE FUNCTION public.doc_reserva_activa(p_doc uuid)
RETURNS SETOF public.documento_reserva
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM public.documento_reserva WHERE documento_id = p_doc AND expira_em > now()
$$;

REVOKE ALL ON FUNCTION public.doc_reservar(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.doc_libertar(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.doc_reserva_activa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doc_reservar(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.doc_libertar(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.doc_reserva_activa(uuid) TO authenticated, service_role;

-- -- revisao nova bloqueada enquanto o documento esta reservado por outra pessoa --
CREATE OR REPLACE FUNCTION public.documento_versao_respeita_reserva()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(coalesce(auth.email(), ''));
  r public.documento_reserva;
BEGIN
  IF v_email = '' THEN RETURN NEW; END IF;      -- processos do servidor sem utilizador (agendador, importacoes)
  SELECT * INTO r FROM public.documento_reserva WHERE documento_id = NEW.documento_id;
  IF FOUND AND r.expira_em > now() AND r.reservado_por <> v_email THEN
    RAISE EXCEPTION 'Este documento esta reservado para edicao por % desde %: so essa pessoa pode carregar uma revisao nova. Peca-lhe que o liberte (ou a um gestor que force a libertacao).',
      coalesce(r.reservado_nome, r.reservado_por), to_char(r.reservado_em AT TIME ZONE 'Africa/Luanda', 'DD/MM/YYYY')
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS documento_versao_reserva_tg ON public.documento_versao;
CREATE TRIGGER documento_versao_reserva_tg BEFORE INSERT ON public.documento_versao
  FOR EACH ROW EXECUTE FUNCTION public.documento_versao_respeita_reserva();

COMMIT;

-- recarregar a cache de esquema do PostgREST (senao a API nao ve a tabela nem as funcoes novas)
NOTIFY pgrst, 'reload schema';
