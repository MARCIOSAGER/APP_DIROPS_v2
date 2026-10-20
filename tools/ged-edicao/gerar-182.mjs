// Gera tools/ged-edicao/182_documento_estruturado.sql a partir de src/documentos/edicao/modelosPadrao.js
// (fonte única dos modelos). O SQL sai em ASCII puro: os textos dos modelos vão em JSON com escapes \uXXXX.
// Uso: node tools/ged-edicao/gerar-182.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MODELOS_PADRAO } from '../../src/documentos/edicao/modelosPadrao.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const asciiJson = (v) => JSON.stringify(v).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
// texto com acentos: passa por jsonb para o literal ficar ASCII
const txt = (s) => `(${lit(asciiJson(String(s)))}::jsonb #>> '{}')`;

const seed = MODELOS_PADRAO.map(m =>
  `  (${lit(m.classe_codigo)}, ${txt(m.nome)}, ${lit(asciiJson(m.schema))}::jsonb, ${m.ordem})`).join(',\n');

const sql = `-- ============================================================================
-- 182_documento_estruturado.sql -- Portal de Documentos: editor proprio estruturado ("Redigir documentos").
--   * documento_modelo: modelos por classe (POP, PR, PL, MA, FR, LT, RE, DO) com a lista de seccoes
--     {chave, titulo, obrigatoria, ajuda, exemplo, automatica?}. Seed gerado de src/documentos/edicao/modelosPadrao.js
--     por tools/ged-edicao/gerar-182.mjs (nao editar o seed a mao: editar o .js e voltar a gerar).
--   * documento_rascunho_estruturado: o rascunho em edicao (conteudo = contrato JSON de
--     src/documentos/edicao/contrato.js). documento_id nulo = documento novo ainda sem registo.
--     Um rascunho por documento (indice unico parcial); "Rever" reabre a mesma linha com a revisao seguinte.
--   * Nada entra em vigor por aqui: "Gerar rascunho" cria uma documento_versao em RASCUNHO que segue o fluxo
--     normal de aprovacao.
--   RLS no padrao do 179 (doc_ctx): ler modelos = membro; escrever modelos = gestor;
--   rascunhos = admin, ou quem pode editar o documento (pode_editar_documento), ou -- documento novo --
--   editor do aeroporto (o autor ou um gestor).
--   Idempotente. Correr como postgres: psql -f 182_documento_estruturado.sql
-- ============================================================================
SET client_encoding = 'UTF8';
SET client_min_messages = warning;
BEGIN;

CREATE TABLE IF NOT EXISTS public.documento_modelo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_codigo  text NOT NULL REFERENCES public.documento_classe(codigo) ON UPDATE CASCADE,
  nome           text NOT NULL,
  schema         jsonb NOT NULL DEFAULT '{"seccoes": []}'::jsonb,
  activo         boolean NOT NULL DEFAULT true,
  ordem          integer NOT NULL DEFAULT 100,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  actualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documento_modelo_schema_chk CHECK (jsonb_typeof(schema -> 'seccoes') = 'array'),
  CONSTRAINT documento_modelo_nome_uk UNIQUE (classe_codigo, nome)
);

CREATE TABLE IF NOT EXISTS public.documento_rascunho_estruturado (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id     uuid REFERENCES public.documento(id) ON DELETE CASCADE,
  modelo           text NOT NULL,
  modelo_id        uuid REFERENCES public.documento_modelo(id) ON DELETE SET NULL,
  conteudo         jsonb NOT NULL,
  conteudo_gerado  jsonb,
  titulo           text,
  numero           text,
  revisao          text,
  aeroporto_id     uuid REFERENCES public.documentos_aeroporto(id) ON DELETE SET NULL,
  criado_por       text NOT NULL DEFAULT lower(coalesce(auth.email(), '')),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  actualizado_por  text,
  actualizado_em   timestamptz NOT NULL DEFAULT now(),
  estado           text NOT NULL DEFAULT 'em_edicao',
  versao_gerada_id uuid REFERENCES public.documento_versao(id) ON DELETE SET NULL,
  gerado_em        timestamptz,
  CONSTRAINT documento_rascunho_estruturado_estado_chk CHECK (estado IN ('em_edicao', 'gerado')),
  CONSTRAINT documento_rascunho_estruturado_conteudo_chk CHECK (jsonb_typeof(conteudo) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS documento_rascunho_estruturado_doc_uk
  ON public.documento_rascunho_estruturado(documento_id) WHERE documento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS documento_rascunho_estruturado_aero_ix ON public.documento_rascunho_estruturado(aeroporto_id);
CREATE INDEX IF NOT EXISTS documento_rascunho_estruturado_autor_ix ON public.documento_rascunho_estruturado(lower(criado_por));

-- carimbo de actualizacao (e quem) em cada gravacao
CREATE OR REPLACE FUNCTION public.documento_estruturado_tocar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_em := now();
  IF TG_TABLE_NAME = 'documento_rascunho_estruturado' THEN
    NEW.actualizado_por := lower(coalesce(auth.email(), NEW.actualizado_por, ''));
    -- titulo/numero/revisao espelham o cabecalho do conteudo (para a lista nao ter de abrir o jsonb)
    NEW.titulo  := coalesce(NULLIF(btrim(NEW.conteudo #>> '{cabecalho,titulo}'), ''), NEW.titulo);
    NEW.numero  := coalesce(NULLIF(btrim(NEW.conteudo #>> '{cabecalho,numero}'), ''), NEW.numero);
    NEW.revisao := coalesce(NULLIF(btrim(NEW.conteudo #>> '{cabecalho,revisao}'), ''), NEW.revisao);
    IF TG_OP = 'UPDATE' THEN NEW.criado_por := OLD.criado_por; NEW.criado_em := OLD.criado_em; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS documento_modelo_tocar ON public.documento_modelo;
CREATE TRIGGER documento_modelo_tocar BEFORE UPDATE ON public.documento_modelo
  FOR EACH ROW EXECUTE FUNCTION public.documento_estruturado_tocar();
DROP TRIGGER IF EXISTS documento_rascunho_estruturado_tocar ON public.documento_rascunho_estruturado;
CREATE TRIGGER documento_rascunho_estruturado_tocar BEFORE INSERT OR UPDATE ON public.documento_rascunho_estruturado
  FOR EACH ROW EXECUTE FUNCTION public.documento_estruturado_tocar();

-- quem pode mexer num rascunho estruturado
CREATE OR REPLACE FUNCTION public.pode_editar_rascunho_estruturado(p_documento uuid, p_aeroporto uuid, p_criado_por text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.doc_ctx_t;
BEGIN
  c := public.doc_ctx();
  IF c.admin THEN RETURN true; END IF;
  IF NOT c.editor THEN RETURN false; END IF;
  IF p_documento IS NOT NULL THEN RETURN public.pode_editar_documento(p_documento); END IF;
  IF p_aeroporto IS NOT NULL AND NOT (p_aeroporto = ANY(c.aeroportos)) THEN RETURN false; END IF;
  RETURN c.gestor OR lower(coalesce(p_criado_por, '')) = c.email;
END $$;
REVOKE ALL ON FUNCTION public.pode_editar_rascunho_estruturado(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_editar_rascunho_estruturado(uuid, uuid, text) TO authenticated;

ALTER TABLE public.documento_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_rascunho_estruturado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documento_modelo FROM anon;
REVOKE ALL ON public.documento_rascunho_estruturado FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_modelo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_rascunho_estruturado TO authenticated;

DROP POLICY IF EXISTS doc_modelo_select ON public.documento_modelo;
CREATE POLICY doc_modelo_select ON public.documento_modelo FOR SELECT TO authenticated
  USING ((SELECT (public.doc_ctx()).membro));
DROP POLICY IF EXISTS doc_modelo_write ON public.documento_modelo;
CREATE POLICY doc_modelo_write ON public.documento_modelo FOR ALL TO authenticated
  USING ((SELECT public.doc_gestor())) WITH CHECK ((SELECT public.doc_gestor()));

DROP POLICY IF EXISTS doc_rascunho_est_select ON public.documento_rascunho_estruturado;
CREATE POLICY doc_rascunho_est_select ON public.documento_rascunho_estruturado FOR SELECT TO authenticated
  USING (public.pode_editar_rascunho_estruturado(documento_id, aeroporto_id, criado_por));
DROP POLICY IF EXISTS doc_rascunho_est_insert ON public.documento_rascunho_estruturado;
CREATE POLICY doc_rascunho_est_insert ON public.documento_rascunho_estruturado FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_rascunho_estruturado(documento_id, aeroporto_id, criado_por)
              AND (lower(criado_por) = (SELECT public.doc_email()) OR (SELECT public.doc_admin())));
DROP POLICY IF EXISTS doc_rascunho_est_update ON public.documento_rascunho_estruturado;
CREATE POLICY doc_rascunho_est_update ON public.documento_rascunho_estruturado FOR UPDATE TO authenticated
  USING (public.pode_editar_rascunho_estruturado(documento_id, aeroporto_id, criado_por))
  WITH CHECK (public.pode_editar_rascunho_estruturado(documento_id, aeroporto_id, criado_por));
DROP POLICY IF EXISTS doc_rascunho_est_delete ON public.documento_rascunho_estruturado;
CREATE POLICY doc_rascunho_est_delete ON public.documento_rascunho_estruturado FOR DELETE TO authenticated
  USING (public.pode_editar_rascunho_estruturado(documento_id, aeroporto_id, criado_por));

-- seed dos modelos (nao reescreve modelos ja existentes: os gestores podem afina-los)
INSERT INTO public.documento_modelo (classe_codigo, nome, schema, ordem)
SELECT v.classe, v.nome, v.schema, v.ordem
  FROM (VALUES
${seed}
  ) AS v(classe, nome, schema, ordem)
 WHERE EXISTS (SELECT 1 FROM public.documento_classe c WHERE c.codigo = v.classe)
ON CONFLICT (classe_codigo, nome) DO NOTHING;

COMMIT;

SELECT classe_codigo, nome, jsonb_array_length(schema -> 'seccoes') AS seccoes FROM public.documento_modelo ORDER BY ordem;
-- recarregar a cache de esquema do PostgREST (senao a API nao ve as tabelas novas)
NOTIFY pgrst, 'reload schema';
`;

if (/[^\x00-\x7f]/.test(sql)) {
  const i = sql.search(/[^\x00-\x7f]/);
  throw new Error('SQL nao e ASCII perto de: ' + sql.slice(Math.max(0, i - 40), i + 10));
}
writeFileSync(path.join(aqui, '182_documento_estruturado.sql'), sql.replace(/\r?\n/g, '\n'));
console.log('escrito 182_documento_estruturado.sql (' + sql.length + ' bytes)');
