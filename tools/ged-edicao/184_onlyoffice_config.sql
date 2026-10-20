-- ============================================================================
-- 184_onlyoffice_config.sql -- Portal de Documentos, caminho A do plano de edicao:
--   EDICAO NO NAVEGADOR COM O ONLYOFFICE DOCS -- PRONTO E DESLIGADO.
--
--   Acrescenta a documentos_config (linha unica id='geral') as chaves que ligam o modulo
--   functions/dirops-functions/docs-onlyoffice.js (patch 31). Tudo nasce DESLIGADO:
--     onlyoffice_activo       boolean  default false -- interruptor geral (botao "Editar no navegador" + rotas)
--     onlyoffice_url          text     null          -- Document Server visto pelo NAVEGADOR,
--                                                       ex. 'http://srvkms001/onlyoffice' (procurador nginx)
--     onlyoffice_url_interna  text     null          -- Document Server visto pelo servidor de funcoes (Node),
--                                                       ex. 'http://127.0.0.1:8080' ou 'http://<ip-da-vm>';
--                                                       null = igual a onlyoffice_url
--     onlyoffice_retorno_url  text     null          -- base por onde o Document Server chega ao nginx do DIROPS
--                                                       (ficheiro + callback), ex. 'http://10.1.65.45';
--                                                       null = DOCS_APP_URL do servidor de funcoes
--     onlyoffice_gerar_pdf    boolean  default true  -- depois de gravar o .docx, gerar o PDF (LibreOffice)
--
--   O SEGREDO JWT NAO VAI PARA A BASE: vive em C:\dirops\sga-onpremise\secrets\onlyoffice_jwt.txt (o modulo le-o).
--   Idempotente. Correr como postgres: psql -f 184_onlyoffice_config.sql
--   Desligar a qualquer momento:  UPDATE public.documentos_config SET onlyoffice_activo = false WHERE id = 'geral';
-- ============================================================================
SET client_min_messages = warning;
BEGIN;

ALTER TABLE public.documentos_config ADD COLUMN IF NOT EXISTS onlyoffice_activo      boolean NOT NULL DEFAULT false;
ALTER TABLE public.documentos_config ADD COLUMN IF NOT EXISTS onlyoffice_url         text;
ALTER TABLE public.documentos_config ADD COLUMN IF NOT EXISTS onlyoffice_url_interna text;
ALTER TABLE public.documentos_config ADD COLUMN IF NOT EXISTS onlyoffice_retorno_url text;
ALTER TABLE public.documentos_config ADD COLUMN IF NOT EXISTS onlyoffice_gerar_pdf   boolean NOT NULL DEFAULT true;

-- enderecos: so http(s), sem barra final (o modulo junta os caminhos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_config_onlyoffice_url_chk') THEN
    ALTER TABLE public.documentos_config ADD CONSTRAINT documentos_config_onlyoffice_url_chk CHECK (
          (onlyoffice_url         IS NULL OR onlyoffice_url         ~ '^https?://[^ ]+[^/ ]$')
      AND (onlyoffice_url_interna IS NULL OR onlyoffice_url_interna ~ '^https?://[^ ]+[^/ ]$')
      AND (onlyoffice_retorno_url IS NULL OR onlyoffice_retorno_url ~ '^https?://[^ ]+[^/ ]$'));
  END IF;
  -- ligar sem endereco nao faz sentido: o botao apareceria e daria erro
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_config_onlyoffice_activo_chk') THEN
    ALTER TABLE public.documentos_config ADD CONSTRAINT documentos_config_onlyoffice_activo_chk CHECK (
      onlyoffice_activo = false OR onlyoffice_url IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.documentos_config.onlyoffice_activo      IS 'Edicao no navegador (ONLYOFFICE Docs) ligada. Migr 184 / patch 31. Segredo JWT em secrets\onlyoffice_jwt.txt.';
COMMENT ON COLUMN public.documentos_config.onlyoffice_url         IS 'Document Server visto pelo navegador (ex. http://srvkms001/onlyoffice). Sem barra final.';
COMMENT ON COLUMN public.documentos_config.onlyoffice_url_interna IS 'Document Server visto pelo servidor de funcoes (ex. http://127.0.0.1:8080). Null = onlyoffice_url.';
COMMENT ON COLUMN public.documentos_config.onlyoffice_retorno_url IS 'Base por onde o Document Server chega ao nginx do DIROPS (ficheiro + callback). Null = DOCS_APP_URL.';
COMMENT ON COLUMN public.documentos_config.onlyoffice_gerar_pdf   IS 'Apos gravar o .docx editado, gerar o PDF em rascunho com o LibreOffice.';

COMMIT;

NOTIFY pgrst, 'reload schema';
