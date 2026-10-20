-- 175 — Pastas AVSEC invisíveis a quem não tem necessidade de saber.
-- Uma pasta marcada com nivel_acesso = {avsec} (ou que esteja DENTRO de uma pasta assim) só é visível a
-- administradores, gestores documentais e pessoal com credencial AVSEC activa para o aeroporto da pasta.
-- Os restantes membros nem sabem que a pasta existe (não aparece na árvore nem nas contagens).
-- A parede documento-a-documento (migr 173) continua igual; isto acrescenta a parede ao nível da pasta.
-- Correr como postgres:  psql -f 175_pasta_avsec_restrita.sql   (idempotente)
BEGIN;

-- A pasta (ou alguma acima dela) é AVSEC?
CREATE OR REPLACE FUNCTION public.pasta_e_avsec(p_pasta uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH RECURSIVE sobe AS (
    SELECT id, pasta_pai_id, nivel_acesso, 1 AS n FROM public.pasta WHERE id = p_pasta
    UNION ALL
    SELECT p.id, p.pasta_pai_id, p.nivel_acesso, s.n + 1
      FROM public.pasta p JOIN sobe s ON p.id = s.pasta_pai_id
     WHERE s.n < 20
  )
  SELECT EXISTS (SELECT 1 FROM sobe WHERE 'avsec' = ANY (coalesce(nivel_acesso, '{}'::text[])))
$$;

-- Tem alguma credencial AVSEC activa para este aeroporto (qualquer manual)?
CREATE OR REPLACE FUNCTION public.pasta_tem_credencial_avsec(p_aeroporto uuid, p_email text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documento_credenciado c
     WHERE lower(c.email) = lower(p_email)
       AND c.estado = 'activo'
       AND (c.valida_ate IS NULL OR c.valida_ate >= current_date)
       AND (c.aeroporto_id IS NULL OR p_aeroporto IS NULL OR c.aeroporto_id = p_aeroporto)
  )
$$;

-- Visibilidade de pasta: igual à anterior + parede AVSEC.
CREATE OR REPLACE FUNCTION public.pasta_visivel_ctx(p_pasta uuid, c doc_ctx_t)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p record; v_apagada boolean;
BEGIN
  IF p_pasta IS NULL THEN RETURN true; END IF;
  IF c.admin THEN RETURN true; END IF;
  IF NOT c.membro THEN RETURN false; END IF;
  SELECT deleted_at IS NOT NULL INTO v_apagada FROM public.pasta WHERE id = p_pasta;
  IF v_apagada IS NULL OR v_apagada THEN RETURN false; END IF;
  SELECT * INTO p FROM public.pasta_permissoes_efetivas(p_pasta);
  -- ── need-to-know AVSEC: pasta AVSEC só a gestores e a credenciados do aeroporto ──
  IF public.pasta_e_avsec(p_pasta) AND NOT c.gestor
     AND NOT public.pasta_tem_credencial_avsec(p.aeroporto_pasta, c.email) THEN
    RETURN false;
  END IF;
  IF p.emails IS NOT NULL AND c.email IN (SELECT lower(x) FROM unnest(p.emails) x) THEN RETURN true; END IF;
  IF p.explicitas THEN
    IF p.perfis IS NOT NULL AND NOT (p.perfis && c.perfis) THEN RETURN false; END IF;
    IF p.aeroportos IS NOT NULL AND NOT (p.aeroportos && c.aeroportos) THEN RETURN false; END IF;
    IF p.perfis IS NULL AND p.aeroportos IS NULL THEN RETURN false; END IF; -- só emails explícitos e não estou lá
    RETURN true;
  END IF;
  -- sem permissões explícitas: regra por aeroporto da pasta (pastas sem aeroporto são de todos os membros)
  RETURN p.aeroporto_pasta IS NULL OR p.aeroporto_pasta = ANY(c.aeroportos);
END $function$;

COMMIT;

-- verificação: as 3 pastas AVSEC devem dar «true»
SELECT nome, public.pasta_e_avsec(id) AS e_avsec FROM public.pasta WHERE nome LIKE 'AVSEC%' AND deleted_at IS NULL;

-- recarregar a cache de esquema do PostgREST (senão a API não vê as alterações)
NOTIFY pgrst, 'reload schema';
