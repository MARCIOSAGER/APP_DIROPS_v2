-- Seta empresa_id = SGA nos 7 aeródromos angolanos marcados isSGA=true mas sem empresa_id
-- (FNAM Ambriz, FNCG Cavango, FNCZ Cazombo, FNPB Sanza Pombo, FNSU Sumbe, FNZE Nzeto, FNZG Nzagi).
-- Efeito: passam a aparecer para usuários SGA normais (não só superadmin). Faz backup antes.
BEGIN;

DROP TABLE IF EXISTS aeroporto_bk_empresa_20260706;
CREATE TABLE aeroporto_bk_empresa_20260706 AS
  SELECT id, codigo_icao, empresa_id
  FROM public.aeroporto
  WHERE "isSGA" = true AND empresa_id IS NULL;

UPDATE public.aeroporto
  SET empresa_id = '128bc692-3fae-4825-9c55-40565dbedcfb'  -- SGA, SA
  WHERE "isSGA" = true AND empresa_id IS NULL;

COMMIT;

-- Verificação
SELECT count(*) AS backup_linhas FROM aeroporto_bk_empresa_20260706;
SELECT count(*) FILTER (WHERE empresa_id IS NOT NULL) AS com_empresa,
       count(*) FILTER (WHERE "isSGA" = true)          AS is_sga
  FROM public.aeroporto;
