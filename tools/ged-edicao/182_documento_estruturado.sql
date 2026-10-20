-- ============================================================================
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
  ('POP', ('"Procedimento operacional padr\u00e3o"'::jsonb #>> '{}'), '{"seccoes":[{"chave":"objectivo","titulo":"Objectivo","obrigatoria":true,"ajuda":"Uma ou duas frases: o que este procedimento garante e porque existe. Comece por um verbo no infinitivo.","exemplo":"Estabelecer o procedimento de inspec\u00e7\u00e3o di\u00e1ria da \u00e1rea de movimento do Aeroporto, de modo a detectar e remover FOD e anomalias antes do in\u00edcio das opera\u00e7\u00f5es."},{"chave":"ambito","titulo":"\u00c2mbito e aplicabilidade","obrigatoria":true,"ajuda":"A quem e onde se aplica: \u00e1reas do aeroporto, servi\u00e7os, turnos, situa\u00e7\u00f5es. Diga tamb\u00e9m o que fica de fora.","exemplo":"Aplica-se a todo o pessoal da Direc\u00e7\u00e3o de Opera\u00e7\u00f5es que realiza inspec\u00e7\u00f5es na pista, caminhos de circula\u00e7\u00e3o e placas, em todos os turnos. N\u00e3o se aplica \u00e0s inspec\u00e7\u00f5es de manuten\u00e7\u00e3o de balizagem."},{"chave":"referencias","titulo":"Refer\u00eancias","obrigatoria":true,"ajuda":"Normas, regulamentos e documentos internos em que o procedimento se apoia (ICAO, ANAC, MOA, outros POP). Use uma lista.","exemplo":"ICAO Anexo 14, Vol. I; ICAO Doc 9137 Parte 8; NTA aplic\u00e1vel da ANAC; Manual de Opera\u00e7\u00f5es do Aer\u00f3dromo (MOA), cap\u00edtulo 5."},{"chave":"definicoes","titulo":"Defini\u00e7\u00f5es e abreviaturas","obrigatoria":false,"ajuda":"Termos e siglas usados no texto que um leitor novo pode n\u00e3o conhecer. Uma tabela de duas colunas funciona bem.","exemplo":"FOD \u2014 Foreign Object Debris (objecto estranho na \u00e1rea de movimento). AOC \u2014 Centro de Opera\u00e7\u00f5es do Aeroporto."},{"chave":"responsabilidades","titulo":"Responsabilidades","obrigatoria":true,"ajuda":"Quem faz o qu\u00ea: uma linha por fun\u00e7\u00e3o (n\u00e3o por nome de pessoa). Inclua quem executa, quem verifica e quem aprova.","exemplo":"Chefe de Turno de Opera\u00e7\u00f5es: garante a realiza\u00e7\u00e3o da inspec\u00e7\u00e3o e regista as anomalias. T\u00e9cnico de Opera\u00e7\u00f5es: executa a inspec\u00e7\u00e3o. Director de Opera\u00e7\u00f5es: verifica o cumprimento mensal."},{"chave":"procedimento","titulo":"Procedimento","obrigatoria":true,"ajuda":"Os passos, por ordem, numa lista numerada. Um passo = uma ac\u00e7\u00e3o. Use \u00abNota\u00bb ou \u00abAviso\u00bb (cita\u00e7\u00e3o) para pontos de seguran\u00e7a.","exemplo":"1. Coordenar com a Torre de Controlo a entrada na pista. 2. Percorrer a pista no sentido contr\u00e1rio ao das aterragens. 3. Registar e remover qualquer FOD encontrado. 4. Informar a Torre da sa\u00edda da pista."},{"chave":"registos","titulo":"Registos","obrigatoria":true,"ajuda":"Que registos o procedimento produz, onde ficam guardados e por quanto tempo. Indique o n\u00famero do formul\u00e1rio, se existir.","exemplo":"Ficha de Inspec\u00e7\u00e3o da \u00c1rea de Movimento (FR-FNLU-MOA-003), arquivada no AOC durante 2 anos."},{"chave":"anexos","titulo":"Anexos","obrigatoria":false,"ajuda":"Fluxogramas, mapas, listas de verifica\u00e7\u00e3o ou imagens de apoio. Pode inserir imagens directamente.","exemplo":"Anexo A \u2014 Mapa dos percursos de inspec\u00e7\u00e3o. Anexo B \u2014 Lista de verifica\u00e7\u00e3o."},{"chave":"historico","titulo":"Hist\u00f3rico de revis\u00f5es","obrigatoria":true,"automatica":true,"ajuda":"Preenchido automaticamente: cada revis\u00e3o gerada pelo editor acrescenta uma linha (revis\u00e3o, data, descri\u00e7\u00e3o, autor).","exemplo":"00 \u00b7 2026-10-20 \u00b7 Emiss\u00e3o inicial \u00b7 J. Silva"}]}'::jsonb, 10),
  ('PR', ('"Plano ou programa"'::jsonb #>> '{}'), '{"seccoes":[{"chave":"objectivo","titulo":"Objectivo","obrigatoria":true,"ajuda":"O que o programa pretende alcan\u00e7ar.","exemplo":"Definir o programa anual de manuten\u00e7\u00e3o preventiva das ajudas visuais."},{"chave":"ambito","titulo":"\u00c2mbito","obrigatoria":true,"ajuda":"A que \u00e1reas, sistemas ou pessoas se aplica.","exemplo":"Aplica-se a todos os sistemas de balizagem luminosa do aeroporto."},{"chave":"referencias","titulo":"Refer\u00eancias","obrigatoria":false,"ajuda":"Normas e documentos de apoio.","exemplo":"ICAO Anexo 14; Manual do fabricante."},{"chave":"responsabilidades","titulo":"Responsabilidades","obrigatoria":true,"ajuda":"Quem coordena, executa e controla o programa.","exemplo":"Chefe de Manuten\u00e7\u00e3o: coordena e reporta trimestralmente."},{"chave":"actividades","titulo":"Actividades e calend\u00e1rio","obrigatoria":true,"ajuda":"As actividades previstas com periodicidade ou datas. Uma tabela ajuda.","exemplo":"Inspec\u00e7\u00e3o visual \u2014 di\u00e1ria; Medi\u00e7\u00e3o fotom\u00e9trica \u2014 semestral."},{"chave":"monitorizacao","titulo":"Monitoriza\u00e7\u00e3o e indicadores","obrigatoria":false,"ajuda":"Como se mede o cumprimento.","exemplo":"Percentagem de actividades cumpridas no prazo (meta \u2265 95%)."},{"chave":"anexos","titulo":"Anexos","obrigatoria":false,"ajuda":"Documentos de apoio.","exemplo":"Anexo A \u2014 Calend\u00e1rio anual."},{"chave":"historico","titulo":"Hist\u00f3rico de revis\u00f5es","obrigatoria":true,"automatica":true,"ajuda":"Preenchido automaticamente: cada revis\u00e3o gerada pelo editor acrescenta uma linha (revis\u00e3o, data, descri\u00e7\u00e3o, autor).","exemplo":"00 \u00b7 2026-10-20 \u00b7 Emiss\u00e3o inicial \u00b7 J. Silva"}]}'::jsonb, 20),
  ('PL', ('"Plano"'::jsonb #>> '{}'), '{"seccoes":[{"chave":"objectivo","titulo":"Objectivo","obrigatoria":true,"ajuda":"O que o plano garante.","exemplo":"Estabelecer a resposta do aeroporto a uma emerg\u00eancia com aeronave."},{"chave":"ambito","titulo":"\u00c2mbito","obrigatoria":true,"ajuda":"Situa\u00e7\u00f5es e entidades abrangidas.","exemplo":"Emerg\u00eancias na \u00e1rea de movimento e nas zonas de aproxima\u00e7\u00e3o."},{"chave":"referencias","titulo":"Refer\u00eancias","obrigatoria":false,"ajuda":"Normas e documentos de apoio.","exemplo":"ICAO Doc 9137 Parte 7."},{"chave":"organizacao","titulo":"Organiza\u00e7\u00e3o e responsabilidades","obrigatoria":true,"ajuda":"Entidades envolvidas e o papel de cada uma.","exemplo":"Centro de Opera\u00e7\u00f5es de Emerg\u00eancia, Bombeiros, Pol\u00edcia, Sa\u00fade."},{"chave":"accoes","titulo":"Ac\u00e7\u00f5es e procedimentos","obrigatoria":true,"ajuda":"O que se faz, por fase ou cen\u00e1rio.","exemplo":"Fase de alerta: ... Fase de resposta: ..."},{"chave":"comunicacoes","titulo":"Comunica\u00e7\u00f5es","obrigatoria":false,"ajuda":"Meios e contactos.","exemplo":"Frequ\u00eancias, telefones de emerg\u00eancia."},{"chave":"anexos","titulo":"Anexos","obrigatoria":false,"ajuda":"Mapas, contactos, listas.","exemplo":"Anexo A \u2014 Mapa quadr\u00edcula."},{"chave":"historico","titulo":"Hist\u00f3rico de revis\u00f5es","obrigatoria":true,"automatica":true,"ajuda":"Preenchido automaticamente: cada revis\u00e3o gerada pelo editor acrescenta uma linha (revis\u00e3o, data, descri\u00e7\u00e3o, autor).","exemplo":"00 \u00b7 2026-10-20 \u00b7 Emiss\u00e3o inicial \u00b7 J. Silva"}]}'::jsonb, 30),
  ('MA', ('"Manual"'::jsonb #>> '{}'), '{"seccoes":[{"chave":"introducao","titulo":"Introdu\u00e7\u00e3o","obrigatoria":true,"ajuda":"Prop\u00f3sito do manual e como est\u00e1 organizado.","exemplo":"Este manual descreve..."},{"chave":"ambito","titulo":"\u00c2mbito e aplicabilidade","obrigatoria":true,"ajuda":"A quem se aplica.","exemplo":"Aplica-se a todo o pessoal do aeroporto."},{"chave":"definicoes","titulo":"Defini\u00e7\u00f5es e abreviaturas","obrigatoria":false,"ajuda":"Termos e siglas.","exemplo":"SMS \u2014 Sistema de Gest\u00e3o da Seguran\u00e7a Operacional."},{"chave":"conteudo","titulo":"Conte\u00fado","obrigatoria":true,"ajuda":"O corpo do manual. Use t\u00edtulos (n\u00edveis 2 a 4) para os cap\u00edtulos.","exemplo":"Cap\u00edtulo 1 \u2014 ..."},{"chave":"anexos","titulo":"Anexos","obrigatoria":false,"ajuda":"Material de apoio.","exemplo":"Anexo A \u2014 ..."},{"chave":"historico","titulo":"Hist\u00f3rico de revis\u00f5es","obrigatoria":true,"automatica":true,"ajuda":"Preenchido automaticamente: cada revis\u00e3o gerada pelo editor acrescenta uma linha (revis\u00e3o, data, descri\u00e7\u00e3o, autor).","exemplo":"00 \u00b7 2026-10-20 \u00b7 Emiss\u00e3o inicial \u00b7 J. Silva"}]}'::jsonb, 40),
  ('FR', ('"Ficha ou formul\u00e1rio"'::jsonb #>> '{}'), '{"seccoes":[{"chave":"instrucoes","titulo":"Instru\u00e7\u00f5es de preenchimento","obrigatoria":false,"ajuda":"Como e quando preencher o formul\u00e1rio.","exemplo":"Preencher no fim de cada inspec\u00e7\u00e3o e entregar ao Chefe de Turno."},{"chave":"campos","titulo":"Campos do formul\u00e1rio","obrigatoria":true,"ajuda":"O formul\u00e1rio propriamente dito. Use uma tabela com os campos e espa\u00e7o para preencher.","exemplo":"Data | Hora | Inspector | Observa\u00e7\u00f5es"},{"chave":"assinaturas","titulo":"Assinaturas","obrigatoria":false,"ajuda":"Quem assina o formul\u00e1rio.","exemplo":"Executado por / Verificado por"},{"chave":"historico","titulo":"Hist\u00f3rico de revis\u00f5es","obrigatoria":true,"automatica":true,"ajuda":"Preenchido automaticamente: cada revis\u00e3o gerada pelo editor acrescenta uma linha (revis\u00e3o, data, descri\u00e7\u00e3o, autor).","exemplo":"00 \u00b7 2026-10-20 \u00b7 Emiss\u00e3o inicial \u00b7 J. Silva"}]}'::jsonb, 50),
  ('LT', ('"Lista"'::jsonb #>> '{}'), '{"seccoes":[{"chave":"objectivo","titulo":"Objectivo","obrigatoria":false,"ajuda":"Para que serve a lista.","exemplo":"Lista de verifica\u00e7\u00e3o da abertura do turno."},{"chave":"lista","titulo":"Lista","obrigatoria":true,"ajuda":"Os itens, numa lista ou tabela (item, verifica\u00e7\u00e3o, observa\u00e7\u00f5es).","exemplo":"1. R\u00e1dios testados. 2. Viatura de inspec\u00e7\u00e3o abastecida."},{"chave":"historico","titulo":"Hist\u00f3rico de revis\u00f5es","obrigatoria":true,"automatica":true,"ajuda":"Preenchido automaticamente: cada revis\u00e3o gerada pelo editor acrescenta uma linha (revis\u00e3o, data, descri\u00e7\u00e3o, autor).","exemplo":"00 \u00b7 2026-10-20 \u00b7 Emiss\u00e3o inicial \u00b7 J. Silva"}]}'::jsonb, 60),
  ('RE', ('"Regulamento"'::jsonb #>> '{}'), '{"seccoes":[{"chave":"objecto","titulo":"Objecto","obrigatoria":true,"ajuda":"O que o regulamento regula.","exemplo":"O presente regulamento estabelece as regras de circula\u00e7\u00e3o no lado ar."},{"chave":"ambito","titulo":"\u00c2mbito","obrigatoria":true,"ajuda":"A quem se aplica.","exemplo":"Aplica-se a todas as pessoas e viaturas no lado ar."},{"chave":"disposicoes","titulo":"Disposi\u00e7\u00f5es","obrigatoria":true,"ajuda":"Os artigos. Use t\u00edtulos de n\u00edvel 3 para cada artigo.","exemplo":"Artigo 1.\u00ba \u2014 ..."},{"chave":"sancoes","titulo":"Incumprimento e san\u00e7\u00f5es","obrigatoria":false,"ajuda":"Consequ\u00eancias do incumprimento.","exemplo":"O incumprimento implica a suspens\u00e3o da credencial."},{"chave":"entrada_vigor","titulo":"Entrada em vigor","obrigatoria":false,"ajuda":"Quando produz efeitos.","exemplo":"Entra em vigor na data da sua aprova\u00e7\u00e3o."},{"chave":"historico","titulo":"Hist\u00f3rico de revis\u00f5es","obrigatoria":true,"automatica":true,"ajuda":"Preenchido automaticamente: cada revis\u00e3o gerada pelo editor acrescenta uma linha (revis\u00e3o, data, descri\u00e7\u00e3o, autor).","exemplo":"00 \u00b7 2026-10-20 \u00b7 Emiss\u00e3o inicial \u00b7 J. Silva"}]}'::jsonb, 70),
  ('DO', ('"Documento ou acordo"'::jsonb #>> '{}'), '{"seccoes":[{"chave":"partes","titulo":"Partes / enquadramento","obrigatoria":false,"ajuda":"Quem est\u00e1 envolvido e o contexto.","exemplo":"SGA e a entidade X."},{"chave":"conteudo","titulo":"Conte\u00fado","obrigatoria":true,"ajuda":"O texto do documento.","exemplo":"..."},{"chave":"anexos","titulo":"Anexos","obrigatoria":false,"ajuda":"Material de apoio.","exemplo":"Anexo A \u2014 ..."},{"chave":"historico","titulo":"Hist\u00f3rico de revis\u00f5es","obrigatoria":true,"automatica":true,"ajuda":"Preenchido automaticamente: cada revis\u00e3o gerada pelo editor acrescenta uma linha (revis\u00e3o, data, descri\u00e7\u00e3o, autor).","exemplo":"00 \u00b7 2026-10-20 \u00b7 Emiss\u00e3o inicial \u00b7 J. Silva"}]}'::jsonb, 80)
  ) AS v(classe, nome, schema, ordem)
 WHERE EXISTS (SELECT 1 FROM public.documento_classe c WHERE c.codigo = v.classe)
ON CONFLICT (classe_codigo, nome) DO NOTHING;

COMMIT;

SELECT classe_codigo, nome, jsonb_array_length(schema -> 'seccoes') AS seccoes FROM public.documento_modelo ORDER BY ordem;
-- recarregar a cache de esquema do PostgREST (senao a API nao ve as tabelas novas)
NOTIFY pgrst, 'reload schema';
