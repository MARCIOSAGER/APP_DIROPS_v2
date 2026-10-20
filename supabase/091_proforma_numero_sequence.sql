-- ============================================================================
-- 091_proforma_numero_sequence.sql
-- Onda 1 (integridade): numeração ATÓMICA de faturas proforma no servidor,
-- POR EMPRESA (cada empresa mantém a sua própria série anual PF-AAAA-NNNNNN).
--
-- Antes: número calculado no CLIENTE (maxSeq+1) a partir de lista truncada (~1000)
--        -> sob concorrência/escala, dois utilizadores podiam gerar o MESMO número.
-- Depois: sequência por (empresa, ano), atómica, via RPC proximo_numero_proforma().
--
-- APLICAR:
--   & $psql -d $dburl -f "C:\dirops\APP_DIROPS_v2\supabase\091_proforma_numero_sequence.sql"
-- VERIFICAR sem consumir número (o ROLLBACK desfaz o incremento):
--   BEGIN; SELECT proximo_numero_proforma('<uuid-da-empresa>'); ROLLBACK;
-- ============================================================================

BEGIN;

-- Sentinel para proformas sem empresa (empresa_id NULL) — a PK não aceita NULL.
CREATE TABLE IF NOT EXISTS proforma_contador (
  empresa_id     uuid NOT NULL,
  ano            integer NOT NULL,
  ultimo_numero  integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, ano)
);

-- Semear com o máximo já existente por (empresa, ano) — continuar, não recomeçar.
INSERT INTO proforma_contador (empresa_id, ano, ultimo_numero)
SELECT COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid) AS emp,
       substring(numero_proforma from 4 for 4)::int AS ano,
       max(substring(numero_proforma from 9)::int)  AS ultimo
FROM proforma
WHERE numero_proforma ~ '^PF-\d{4}-\d+$'
GROUP BY 1, 2
ON CONFLICT (empresa_id, ano) DO UPDATE
  SET ultimo_numero = GREATEST(proforma_contador.ultimo_numero, EXCLUDED.ultimo_numero);

-- Função atómica. Guarda anti-spoof: quem não é superadmin só numera a SUA empresa
-- (ignora o parâmetro), evitando que um utilizador "gaste" a série de outra empresa.
CREATE OR REPLACE FUNCTION proximo_numero_proforma(p_empresa_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_emp uuid;
  v_ano int := EXTRACT(YEAR FROM now())::int;
  v_seq int;
BEGIN
  IF is_superadmin() THEN
    v_emp := COALESCE(p_empresa_id, '00000000-0000-0000-0000-000000000000'::uuid);
  ELSE
    v_emp := COALESCE(current_user_empresa_id(), '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  INSERT INTO proforma_contador (empresa_id, ano, ultimo_numero)
  VALUES (v_emp, v_ano, 1)
  ON CONFLICT (empresa_id, ano) DO UPDATE
    SET ultimo_numero = proforma_contador.ultimo_numero + 1,
        updated_at = now()
  RETURNING ultimo_numero INTO v_seq;

  RETURN 'PF-' || v_ano::text || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

-- A app só PEDE um número (RPC); nunca lê/escreve o contador diretamente.
REVOKE ALL ON FUNCTION proximo_numero_proforma(uuid) FROM public;
GRANT EXECUTE ON FUNCTION proximo_numero_proforma(uuid) TO authenticated;

ALTER TABLE proforma_contador ENABLE ROW LEVEL SECURITY;   -- sem policy => acesso direto negado
REVOKE ALL ON proforma_contador FROM anon, authenticated;

COMMIT;
