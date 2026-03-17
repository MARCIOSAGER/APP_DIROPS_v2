-- ============================================
-- Migration 032: Performance indexes for scale
-- ============================================

-- Voo: frequently filtered by deleted_at, data_operacao, empresa_id
CREATE INDEX IF NOT EXISTS idx_voo_deleted_at ON public.voo(deleted_at);
CREATE INDEX IF NOT EXISTS idx_voo_data_operacao ON public.voo(data_operacao DESC);
CREATE INDEX IF NOT EXISTS idx_voo_empresa_data ON public.voo(empresa_id, data_operacao DESC);

-- Proforma: filtered by data_emissao, status, empresa_id
CREATE INDEX IF NOT EXISTS idx_proforma_data_emissao ON public.proforma(data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_proforma_status ON public.proforma(status);
CREATE INDEX IF NOT EXISTS idx_proforma_empresa_data ON public.proforma(empresa_id, data_emissao DESC);

-- Documento: filtered by status, data_publicacao
CREATE INDEX IF NOT EXISTS idx_documento_data_publicacao ON public.documento(data_publicacao DESC);

-- Ordem Servico: filtered by status, data_abertura
CREATE INDEX IF NOT EXISTS idx_ordem_servico_status ON public.ordem_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordem_servico_data ON public.ordem_servico(data_abertura DESC);

-- Solicitacao Servico: filtered by status, created_date
CREATE INDEX IF NOT EXISTS idx_solicitacao_servico_status ON public.solicitacao_servico(status);

-- Inspecao: filtered by status, data_inspecao, empresa_id
CREATE INDEX IF NOT EXISTS idx_inspecao_data ON public.inspecao(data_inspecao DESC);
CREATE INDEX IF NOT EXISTS idx_inspecao_status ON public.inspecao(status);

-- Processo Auditoria: filtered by status
CREATE INDEX IF NOT EXISTS idx_processo_auditoria_status ON public.processo_auditoria(status);

-- Medicao KPI: filtered by data_medicao
CREATE INDEX IF NOT EXISTS idx_medicao_kpi_data ON public.medicao_k_p_i(data_medicao DESC);

-- Calculo Tarifa: filtered by data_calculo, voo_id
CREATE INDEX IF NOT EXISTS idx_calculo_tarifa_data ON public.calculo_tarifa(data_calculo DESC);
CREATE INDEX IF NOT EXISTS idx_calculo_tarifa_voo ON public.calculo_tarifa(voo_id);

-- Log Auditoria: filtered by created_date, tabela
CREATE INDEX IF NOT EXISTS idx_log_auditoria_data ON public.log_auditoria(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_entidade ON public.log_auditoria(entidade);

-- Credenciamento: filtered by status
CREATE INDEX IF NOT EXISTS idx_credenciamento_status ON public.credenciamento(status);

-- Ocorrencia Safety: filtered by status, data_ocorrencia
CREATE INDEX IF NOT EXISTS idx_ocorrencia_safety_status ON public.ocorrencia_safety(status);
CREATE INDEX IF NOT EXISTS idx_ocorrencia_safety_data ON public.ocorrencia_safety(data_ocorrencia DESC);

-- Reclamacao: filtered by status
CREATE INDEX IF NOT EXISTS idx_reclamacao_status ON public.reclamacao(status);

-- Movimento Financeiro: filtered by data, tipo
CREATE INDEX IF NOT EXISTS idx_movimento_financeiro_data ON public.movimento_financeiro(data DESC);

-- Voo Ligado: filtered by voo IDs for join lookups
CREATE INDEX IF NOT EXISTS idx_voo_ligado_voo_arr ON public.voo_ligado(id_voo_arr);
CREATE INDEX IF NOT EXISTS idx_voo_ligado_voo_dep ON public.voo_ligado(id_voo_dep);

-- API access log: filtered by api_key_id, created_at
CREATE INDEX IF NOT EXISTS idx_api_access_log_key ON public.api_access_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_access_log_data ON public.api_access_log(created_at DESC);
