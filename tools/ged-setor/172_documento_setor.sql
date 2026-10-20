-- ============================================================================
-- 172_documento_setor.sql — Área/Setor como camada de ORGANIZAÇÃO (não de acesso).
--   Decisão do dono (04/10/2026): setor serve para navegar, filtrar e tirar relatórios por área, e para dizer
--   quem é o responsável. NÃO esconde documentos entre setores do mesmo aeroporto — o MOA é um manual integrado.
--   A única parede de acesso por área continua a ser o AVSEC (nível `avsec` nas pastas + regime da migração 158).
--
--   Desenho elegante: o setor NÃO se etiqueta documento a documento. Cada MANUAL (documento_processo) pertence a
--   um setor; o setor de um documento é o do seu manual (3.º segmento do código). Muda-se o mapa dos manuais e
--   todos os documentos acompanham. Os setores seguem os responsáveis que o próprio MOA define (AN.05).
-- ============================================================================
SET client_encoding = 'UTF8';
SET client_min_messages = warning;
BEGIN;

CREATE TABLE IF NOT EXISTS public.documento_setor (
  codigo       text PRIMARY KEY,
  nome         text NOT NULL,
  descricao    text,
  cor          text,                       -- cor de etiqueta (hex), opcional
  ordem        integer NOT NULL DEFAULT 0,
  ativo        boolean NOT NULL DEFAULT true,
  created_date timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_setor TO authenticated, service_role;
ALTER TABLE public.documento_setor ENABLE ROW LEVEL SECURITY;

INSERT INTO public.documento_setor (codigo, nome, descricao, cor, ordem) VALUES
  ('OPS',   'Operações',                      'Operação do aeródromo, movimento na superfície, circulação no lado ar, segurança de pista.', '#2563eb', 1),
  ('SGSO',  'Segurança Operacional (Safety)', 'Gestão da segurança operacional (SGSO) e risco de fauna.',                                   '#16a34a', 2),
  ('AVSEC', 'Segurança da Aviação (AVSEC)',   'Segurança da aviação civil e facilitação. Acesso restrito (need-to-know).',                  '#7c3aed', 3),
  ('RE',    'Resposta à Emergência e SSCI',   'Plano de emergência, contingência, remoção de aeronave, salvamento e combate a incêndios.',  '#dc2626', 4),
  ('MNT',   'Manutenção',                     'Manutenção do aeroporto, edifícios, balizagem, grupo gerador.',                              '#ea580c', 5),
  ('GERAL', 'Geral / Administração',          'Documentos sem manual atribuído ou de âmbito administrativo.',                               '#64748b', 9)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, cor = EXCLUDED.cor, ordem = EXCLUDED.ordem;

-- cada manual pertence a um setor
ALTER TABLE public.documento_processo ADD COLUMN IF NOT EXISTS setor_codigo text REFERENCES public.documento_setor(codigo);
CREATE INDEX IF NOT EXISTS documento_processo_setor_idx ON public.documento_processo (setor_codigo);

-- mapa manual → setor (os que não constam ficam em GERAL, por baixo)
UPDATE public.documento_processo SET setor_codigo = v.setor FROM (VALUES
  ('MOA','OPS'), ('SMGCS','OPS'), ('NOCLA','OPS'), ('MPIP','OPS'), ('PBZPA','OPS'), ('RST','OPS'), ('PFOA','OPS'),
  ('MGSO','SGSO'), ('PGRF','SGSO'),
  ('PSA','AVSEC'), ('AVSE','AVSEC'), ('PFT','AVSEC'),
  ('PEA','RE'), ('PCA','RE'), ('PRAFS','RE'), ('PSCI','RE'), ('PCBA','RE'), ('PTRBA','RE'),
  ('PMA','MNT'), ('PMB','MNT'), ('PME','MNT'), ('PMP','MNT'), ('PGG','MNT')
) AS v(cod, setor) WHERE public.documento_processo.codigo = v.cod;

UPDATE public.documento_processo SET setor_codigo = 'GERAL' WHERE setor_codigo IS NULL;

-- quem lê / quem escreve (igual aos processos: lêem os membros, mexem os gestores)
DROP POLICY IF EXISTS doc_setor_select ON public.documento_setor;
CREATE POLICY doc_setor_select ON public.documento_setor FOR SELECT TO authenticated USING ((SELECT public.doc_membro()));
DROP POLICY IF EXISTS doc_setor_write ON public.documento_setor;
CREATE POLICY doc_setor_write ON public.documento_setor FOR ALL TO authenticated USING ((SELECT public.doc_gestor())) WITH CHECK ((SELECT public.doc_gestor()));

COMMIT;
NOTIFY pgrst, 'reload schema';

SELECT s.codigo, s.nome, count(p.codigo) AS manuais
  FROM public.documento_setor s
  LEFT JOIN public.documento_processo p ON p.setor_codigo = s.codigo
 GROUP BY s.codigo, s.nome, s.ordem ORDER BY s.ordem;
