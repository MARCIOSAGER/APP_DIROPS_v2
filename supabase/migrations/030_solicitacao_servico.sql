-- Migration 030: Sistema SS (Solicitação de Serviço) + melhorias OS

-- =====================================================
-- 1. Tabela solicitacao_servico (SS)
-- =====================================================
CREATE TABLE IF NOT EXISTS solicitacao_servico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_ss TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  aeroporto_id UUID REFERENCES aeroporto(id),
  empresa_id UUID REFERENCES empresa(id),
  localizacao TEXT,
  fotos TEXT[] DEFAULT '{}',

  -- Origem
  origem TEXT DEFAULT 'manual',
  inspecao_id UUID REFERENCES inspecao(id),
  item_checklist_id UUID REFERENCES item_checklist(id),

  -- Status
  status TEXT DEFAULT 'aberta',
  prioridade_sugerida TEXT DEFAULT 'media',

  -- Solicitante
  solicitante_id UUID,
  solicitante_nome TEXT,
  solicitante_email TEXT,

  -- Análise
  analisado_por TEXT,
  data_analise TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  ordem_servico_id UUID,

  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_empresa_id ON solicitacao_servico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ss_aeroporto_id ON solicitacao_servico(aeroporto_id);
CREATE INDEX IF NOT EXISTS idx_ss_status ON solicitacao_servico(status);
CREATE INDEX IF NOT EXISTS idx_ss_inspecao_id ON solicitacao_servico(inspecao_id);

-- =====================================================
-- 2. Colunas novas em ordem_servico
-- =====================================================
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS solicitacao_id UUID;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS tipo_execucao TEXT DEFAULT 'interna';
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS fornecedor TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS contato_fornecedor TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS data_atribuicao TIMESTAMPTZ;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS data_inicio_execucao TIMESTAMPTZ;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS data_verificacao TIMESTAMPTZ;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS verificado_por TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS custos_reais DOUBLE PRECISION;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS observacoes_conclusao TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS observacoes_atribuicao TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS fotos_antes TEXT[] DEFAULT '{}';
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS fotos_depois TEXT[] DEFAULT '{}';
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS inspecao_id UUID;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS item_checklist_id UUID;

-- =====================================================
-- 3. RLS para solicitacao_servico
-- =====================================================
ALTER TABLE solicitacao_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ss_select" ON solicitacao_servico FOR SELECT TO authenticated
  USING (public.is_superadmin() OR empresa_id IS NULL OR empresa_id = public.current_user_empresa_id());

CREATE POLICY "ss_insert" ON solicitacao_servico FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL);

CREATE POLICY "ss_update" ON solicitacao_servico FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL);

CREATE POLICY "ss_delete" ON solicitacao_servico FOR DELETE TO authenticated
  USING (public.is_superadmin() OR (public.is_admin() AND (empresa_id = public.current_user_empresa_id() OR empresa_id IS NULL)));
