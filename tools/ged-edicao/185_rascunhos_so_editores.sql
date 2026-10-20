-- 185: versoes em rascunho/em revisao deixam de aparecer a quem so consulta o documento.
-- Continuam visiveis a quem pode editar o documento (editor responsavel/autor, gestor, admin)
-- e a quem esta no fluxo de aprovacao dessa versao (elaborador, revisor, director).
-- Versoes em vigor, aprovadas, obsoletas e fonte nao mudam.
BEGIN;

DROP POLICY IF EXISTS doc_versao_select ON public.documento_versao;
CREATE POLICY doc_versao_select ON public.documento_versao FOR SELECT
USING (
  documento_id IN (SELECT unnest(public.doc_documentos_visiveis()))
  AND (
    coalesce(estado, '') NOT IN ('rascunho', 'em_revisao')
    OR public.pode_editar_documento(documento_id)
    OR EXISTS (
      SELECT 1 FROM public.documento_aprovacao a
      WHERE a.versao_id = documento_versao.id
        AND (public.doc_ctx()).email IN (lower(coalesce(a.elaborador_email, '')), lower(coalesce(a.revisor_email, '')), lower(coalesce(a.director_email, '')))
    )
  )
);

COMMIT;
NOTIFY pgrst, 'reload schema';
