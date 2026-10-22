-- 187: quando uma revisao gerada no editor estruturado entra em vigor, o titulo do documento no GED passa a ser o
-- titulo do documento redigido (ex.: padronizacao a partir dos modelos-mestre). So nesse momento: um rascunho nunca
-- muda o titulo do documento em vigor. Idempotente.
BEGIN;

CREATE OR REPLACE FUNCTION public.documento_titulo_da_revisao_em_vigor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_titulo text;
BEGIN
  IF NEW.estado = 'em_vigor' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'em_vigor') THEN
    SELECT nullif(btrim(r.conteudo->'cabecalho'->>'titulo'), '') INTO v_titulo
      FROM public.documento_rascunho_estruturado r
     WHERE r.documento_id = NEW.documento_id AND r.versao_gerada_id = NEW.id
     LIMIT 1;
    IF v_titulo IS NOT NULL AND position('{{' in v_titulo) = 0 THEN
      UPDATE public.documento SET titulo = v_titulo, updated_date = now()
       WHERE id = NEW.documento_id AND titulo IS DISTINCT FROM v_titulo;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS documento_titulo_revisao_tg ON public.documento_versao;
CREATE TRIGGER documento_titulo_revisao_tg AFTER INSERT OR UPDATE OF estado ON public.documento_versao
  FOR EACH ROW EXECUTE FUNCTION public.documento_titulo_da_revisao_em_vigor();

COMMIT;
NOTIFY pgrst, 'reload schema';
