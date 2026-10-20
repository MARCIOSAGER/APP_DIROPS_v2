-- ============================================================================
-- 173_avsec_need_to_know.sql — a vista dos documentos AVSEC passa a precisar de CREDENCIAL (need-to-know).
--   Decisão do dono (04/10/2026): documentos de segurança da aviação só são visíveis no portal a quem tem
--   credencial AVSEC activa. Até aqui a tabela `documento_credenciado` (migr 158) só dizia quem podia POSSUIR
--   uma cópia; a VISTA no portal continuava a reger-se só por pasta/aeroporto. Esta migração liga a credencial
--   à vista, dentro de `pode_ver_documento` — a única regra de acesso, para não haver duas verdades.
--
--   Um documento é AVSEC-restrito quando: está classificado (classificacao_categoria preenchida) OU é 'secreto'
--   OU pertence a um manual do setor AVSEC (migr 172). Administradores e gestores documentais continuam a ver
--   (gerem o regime); todos os outros precisam de credencial activa com âmbito que cubra o aeroporto e o manual.
--
--   AVISO OPERACIONAL: ao aplicar, quem não estiver credenciado deixa de ver os documentos AVSEC. É preciso
--   credenciar o pessoal AVSEC em Gestão → regime AVSEC → Credenciados.
-- ============================================================================
SET client_encoding = 'UTF8';
SET client_min_messages = warning;
BEGIN;

-- é um documento sujeito ao regime AVSEC de vista restrita?
CREATE OR REPLACE FUNCTION public.doc_e_restrito_avsec(p_processo text, p_categoria text, p_nivel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(p_categoria IS NOT NULL, false)
      OR coalesce(p_nivel = 'secreto', false)
      OR EXISTS (SELECT 1 FROM public.documento_processo p WHERE p.codigo = p_processo AND p.setor_codigo = 'AVSEC')
$$;

-- o utilizador tem credencial AVSEC activa que cubra este aeroporto e este manual?
--   • credencial com aeroporto nulo vale para todos os aeroportos; com processo nulo vale para todo o AVSEC;
--   • caducada (valida_ate < hoje) ou não-activa não conta.
CREATE OR REPLACE FUNCTION public.doc_tem_credencial_avsec(p_aeroporto uuid, p_processo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documento_credenciado c
     WHERE lower(c.email) = public.doc_email()
       AND c.estado = 'activo'
       AND (c.valida_ate IS NULL OR c.valida_ate >= current_date)
       AND (c.aeroporto_id IS NULL OR c.aeroporto_id = p_aeroporto)
       AND (c.processo_codigo IS NULL OR c.processo_codigo = p_processo)
  )
$$;
GRANT EXECUTE ON FUNCTION public.doc_e_restrito_avsec(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.doc_tem_credencial_avsec(uuid, text) TO authenticated, service_role;

-- pode_ver_documento: igual ao original (migr 136b), com UMA adição — a parede AVSEC logo após confirmar que é membro.
CREATE OR REPLACE FUNCTION public.pode_ver_documento(p_doc uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d record;
BEGIN
  IF p_doc IS NULL THEN RETURN false; END IF;
  IF public.doc_admin() THEN RETURN true; END IF;
  SELECT id, pasta_id, aeroporto_id, estado, deleted_at, created_by, responsavel_email, usuarios_acesso_explicito,
         voo_ligado_id, empresa_id, processo_codigo, classificacao_categoria, nivel_confidencialidade
    INTO d FROM public.documento WHERE id = p_doc;
  IF d.id IS NULL THEN RETURN false; END IF;
  -- documentos de voo do DIROPS: regra antiga por empresa
  IF d.voo_ligado_id IS NOT NULL THEN RETURN public.is_superadmin() OR d.empresa_id = public.current_user_empresa_id() OR d.empresa_id IS NULL; END IF;
  IF NOT public.doc_membro() THEN RETURN false; END IF;
  -- ── need-to-know AVSEC: documentos de segurança da aviação só a gestores e a credenciados ──
  IF public.doc_e_restrito_avsec(d.processo_codigo, d.classificacao_categoria, d.nivel_confidencialidade)
     AND NOT public.doc_gestor()
     AND NOT public.doc_tem_credencial_avsec(d.aeroporto_id, d.processo_codigo) THEN
    RETURN false;
  END IF;
  IF lower(coalesce(d.created_by, '')) = public.doc_email() OR lower(coalesce(d.responsavel_email, '')) = public.doc_email() THEN RETURN d.deleted_at IS NULL OR public.doc_gestor(); END IF;
  IF d.usuarios_acesso_explicito IS NOT NULL AND jsonb_typeof(d.usuarios_acesso_explicito) = 'array'
     AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(d.usuarios_acesso_explicito) e WHERE lower(e) = public.doc_email()) THEN RETURN d.deleted_at IS NULL; END IF;
  IF d.pasta_id IS NOT NULL THEN
    IF NOT public.pode_ver_pasta(d.pasta_id) THEN RETURN false; END IF;
  ELSIF d.aeroporto_id IS NOT NULL AND NOT (d.aeroporto_id = ANY(public.doc_meus_aeroportos())) THEN
    RETURN false;
  END IF;
  IF d.deleted_at IS NOT NULL THEN RETURN public.doc_gestor(); END IF;                       -- lixeira: só gestores
  IF coalesce(d.estado, 'em_vigor') IN ('rascunho', 'em_revisao', 'aprovado') THEN RETURN public.doc_editor(); END IF; -- ainda não publicado
  RETURN true;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- quantos documentos passam a ser restritos por esta regra
SELECT count(*) AS docs_avsec_restritos
  FROM public.documento d
 WHERE d.voo_ligado_id IS NULL AND d.deleted_at IS NULL
   AND public.doc_e_restrito_avsec(d.processo_codigo, d.classificacao_categoria, d.nivel_confidencialidade);
