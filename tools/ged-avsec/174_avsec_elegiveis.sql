-- ============================================================================
-- 174_avsec_elegiveis.sql — ponte Formação → Credencial AVSEC.
--   Decisão do dono (04/10/2026): concluir a Formação AVSEC torna a pessoa ELEGÍVEL para credenciamento; o gestor
--   confirma e emite a credencial (não é automático). Esta RPC devolve quem tem certificado do curso AVSEC
--   «Formação Inicial» (não revogado) e ainda NÃO tem credencial activa — para o Registo de Credenciados os
--   mostrar como sugestões. SECURITY DEFINER para não depender da RLS dos certificados; só gestores do portal veem.
-- ============================================================================
SET client_encoding = 'UTF8';
SET client_min_messages = warning;
BEGIN;

CREATE OR REPLACE FUNCTION public.avsec_formandos_elegiveis()
RETURNS TABLE(email text, nome text, emitido_em timestamptz, curso_titulo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (lower(c.aluno_email))
         c.aluno_email, c.aluno_nome, c.emitido_em, c.curso_titulo
    FROM public.certificado c
    JOIN public.curso cu ON cu.id = c.curso_id
   WHERE public.doc_gestor()                                   -- só gestores/admin do portal
     AND cu.titulo ILIKE '%AVSEC%Forma%Inicial%'
     AND c.revogado_em IS NULL
     AND c.aluno_email IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.documento_credenciado dc
        WHERE lower(dc.email) = lower(c.aluno_email)
          AND dc.estado = 'activo'
          AND (dc.valida_ate IS NULL OR dc.valida_ate >= current_date))
   ORDER BY lower(c.aluno_email), c.emitido_em DESC
$$;

REVOKE EXECUTE ON FUNCTION public.avsec_formandos_elegiveis() FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE EXECUTE ON FUNCTION public.avsec_formandos_elegiveis() FROM anon; END IF; END $$;
GRANT EXECUTE ON FUNCTION public.avsec_formandos_elegiveis() TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
SELECT 'ok' AS resultado;
