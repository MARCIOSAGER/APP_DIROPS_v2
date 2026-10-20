-- Acrescenta o estado de VERSÃO 'fonte' (ficheiro-fonte editável, p.ex. o .docx de origem de um PDF em vigor) à
-- CHECK constraint de documento_versao. 'fonte' NÃO conta como revisão em vigor/aprovada, por isso nunca dispara
-- o aviso «versão substituída». Correr uma vez, como postgres. Idempotente (recria a constraint).
BEGIN;
ALTER TABLE documento_versao DROP CONSTRAINT IF EXISTS documento_versao_estado_check;
ALTER TABLE documento_versao ADD CONSTRAINT documento_versao_estado_check
  CHECK (estado = ANY (ARRAY['rascunho','em_revisao','aprovado','em_vigor','obsoleto','rejeitado','fonte']));
COMMIT;

-- recarregar a cache de esquema do PostgREST (senão a API não vê as alterações)
NOTIFY pgrst, 'reload schema';
