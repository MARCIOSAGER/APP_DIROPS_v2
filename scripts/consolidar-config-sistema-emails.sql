-- ============================================================
-- Configuracao do sistema: consolidar 5 linhas -> 1 singleton canonico
-- e adicionar colunas email_alertas + email_suporte.
--
-- Porque: a tabela tinha 5 linhas e vários leitores fazem .limit(1) SEM
-- ORDER BY -> pegavam uma linha aleatória. Um email podia ser GRAVADO numa
-- linha e LIDO de outra (ex.: notificacoes.jsx vs Credenciamento config).
-- Canonica = a linha mais antiga (created_date ASC), que casa com o hook
-- determinístico (ORDER BY created_date ASC LIMIT 1).
-- Faz backup antes. Reversível.
-- ============================================================
BEGIN;

-- backup completo das 5 linhas
DROP TABLE IF EXISTS configuracao_sistema_bk_20260706;
CREATE TABLE configuracao_sistema_bk_20260706 AS
  SELECT * FROM public.configuracao_sistema;

-- novas colunas (idempotente)
ALTER TABLE public.configuracao_sistema ADD COLUMN IF NOT EXISTS email_alertas text;
ALTER TABLE public.configuracao_sistema ADD COLUMN IF NOT EXISTS email_suporte text;

-- setar os 3 emails do sistema na linha canonica (todos @sga.co.ao = entregáveis
-- pelo relay; o admin pode trocar depois pela UI). Mantém o que já houver.
UPDATE public.configuracao_sistema SET
  email_alertas             = COALESCE(NULLIF(TRIM(email_alertas), ''),             'oaeroportos@sga.co.ao'),
  email_suporte             = COALESCE(NULLIF(TRIM(email_suporte), ''),             'oaeroportos@sga.co.ao'),
  email_notificacao_acessos = COALESCE(NULLIF(TRIM(email_notificacao_acessos), ''), 'oaeroportos@sga.co.ao'),
  updated_date              = now()
WHERE id = (SELECT id FROM public.configuracao_sistema ORDER BY created_date ASC LIMIT 1);

-- apagar as outras 4 (a canonica é a mais antiga)
DELETE FROM public.configuracao_sistema
WHERE id <> (SELECT id FROM public.configuracao_sistema ORDER BY created_date ASC LIMIT 1);

COMMIT;

-- Verificação (esperado: linhas=1, os 3 emails = oaeroportos@sga.co.ao)
SELECT count(*) AS linhas FROM public.configuracao_sistema;
SELECT email_alertas, email_suporte, email_notificacao_acessos
  FROM public.configuracao_sistema;
