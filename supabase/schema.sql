-- =====================================================
-- DIROPS-SGA Database Schema
-- Supabase PostgreSQL
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS & ACCESS
-- =====================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  telefone TEXT,
  whatsapp_number TEXT,
  whatsapp_opt_in_status TEXT,
  whatsapp_opt_in_date TIMESTAMPTZ,
  perfis TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'ativo',
  aeroportos_acesso TEXT[] DEFAULT '{}',
  empresa_id UUID,
  role TEXT DEFAULT 'user',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE regra_permissao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  perfil TEXT NOT NULL,
  paginas_permitidas TEXT[] DEFAULT '{}',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE solicitacao_acesso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_completo TEXT,
  email TEXT,
  telefone TEXT,
  perfil_solicitado TEXT,
  empresa_solicitante_id UUID,
  aeroportos_solicitados TEXT[] DEFAULT '{}',
  justificativa TEXT,
  status TEXT DEFAULT 'pendente',
  user_id UUID,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE empresa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'ativa',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. OPERATIONS - Airports, Airlines, Aircraft
-- =====================================================

CREATE TABLE aeroporto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_icao TEXT UNIQUE,
  codigo_iata TEXT,
  nome TEXT,
  cidade TEXT,
  provincia TEXT,
  pais TEXT DEFAULT 'AO',
  tipo_operacao TEXT,
  categoria TEXT,
  status TEXT DEFAULT 'operacional',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  soleiras TEXT,
  "isSGA" BOOLEAN DEFAULT FALSE,
  updated_by TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE companhia_aerea (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_icao TEXT,
  codigo_iata TEXT,
  nome TEXT,
  nacionalidade TEXT,
  tipo TEXT DEFAULT 'comercial',
  status TEXT DEFAULT 'ativa',
  updated_by TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE modelo_aeronave (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modelo TEXT,
  codigo_icao TEXT,
  codigo_iata TEXT,
  mtow_kg DOUBLE PRECISION,
  comprimento_m DOUBLE PRECISION,
  envergadura_m DOUBLE PRECISION,
  ac_code TEXT,
  total_assentos_modelo INTEGER,
  updated_by TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE registo_aeronave (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registo TEXT,
  registo_normalizado TEXT,
  id_modelo_aeronave UUID REFERENCES modelo_aeronave(id),
  id_companhia_aerea UUID REFERENCES companhia_aerea(id),
  mtow_kg DOUBLE PRECISION,
  total_assentos INTEGER,
  num_first INTEGER DEFAULT 0,
  num_business INTEGER DEFAULT 0,
  num_premium INTEGER DEFAULT 0,
  num_economy INTEGER DEFAULT 0,
  updated_by TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. FLIGHTS
-- =====================================================

CREATE TABLE voo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_movimento TEXT,
  numero_voo TEXT,
  data_operacao TEXT,
  horario_previsto TEXT,
  horario_real TEXT,
  aeroporto_operacao TEXT,
  registo_aeronave TEXT,
  companhia_aerea TEXT,
  aeroporto_origem_destino TEXT,
  tipo_voo TEXT,
  status TEXT DEFAULT 'Programado',
  passageiros_local INTEGER DEFAULT 0,
  passageiros_transito_transbordo INTEGER DEFAULT 0,
  passageiros_transito_direto INTEGER DEFAULT 0,
  passageiros_total INTEGER DEFAULT 0,
  tripulacao INTEGER DEFAULT 0,
  carga_kg DOUBLE PRECISION DEFAULT 0,
  observacoes TEXT,
  aeronave_no_hangar BOOLEAN DEFAULT FALSE,
  requer_iluminacao_extra BOOLEAN DEFAULT FALSE,
  voo_ligado_id UUID,
  updated_by TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  deleted_by TEXT DEFAULT NULL
);

CREATE TABLE voo_ligado (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_voo_arr UUID REFERENCES voo(id),
  id_voo_dep UUID REFERENCES voo(id),
  tempo_permanencia_min DOUBLE PRECISION DEFAULT 0,
  updated_by TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cache_voo_f_r24 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_voo TEXT,
  data_expiracao TEXT,
  status TEXT DEFAULT 'pendente',
  numero_voo TEXT,
  fr24_id TEXT,
  airport_icao TEXT,
  raw_data JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. FINANCIAL - Tariffs, Taxes, Billing
-- =====================================================

CREATE TABLE tarifa_pouso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faixa_min DOUBLE PRECISION,
  faixa_max DOUBLE PRECISION,
  tarifa_domestica DOUBLE PRECISION,
  tarifa_internacional DOUBLE PRECISION,
  categoria_aeroporto TEXT,
  status TEXT DEFAULT 'ativa',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tarifa_permanencia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faixa_min DOUBLE PRECISION DEFAULT 0,
  faixa_max DOUBLE PRECISION DEFAULT 999999,
  tarifa_usd_por_tonelada_hora DOUBLE PRECISION,
  categoria_aeroporto TEXT,
  status TEXT DEFAULT 'ativa',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outra_tarifa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT,
  tipo_operacao TEXT DEFAULT 'ambos',
  valor DOUBLE PRECISION,
  unidade TEXT,
  categoria_aeroporto TEXT,
  descricao TEXT,
  status TEXT DEFAULT 'ativa',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE imposto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT,
  valor DOUBLE PRECISION,
  aeroporto_id UUID,
  data_inicio_vigencia TEXT,
  data_fim_vigencia TEXT,
  descricao TEXT,
  status TEXT DEFAULT 'ativo',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE configuracao_sistema (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  taxa_cambio_usd_aoa DOUBLE PRECISION,
  email_notificacao_acessos TEXT,
  smtp_host TEXT,
  smtp_port TEXT DEFAULT '587',
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_from_name TEXT DEFAULT 'DIROPS-SGA',
  smtp_from_email TEXT,
  smtp_secure BOOLEAN DEFAULT TRUE,
  email_notificacoes_padrao TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE calculo_tarifa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voo_id UUID REFERENCES voo(id),
  voo_ligado_id UUID REFERENCES voo_ligado(id),
  companhia_id UUID,
  aeroporto_id UUID,
  categoria_aeroporto TEXT,
  mtow_kg DOUBLE PRECISION,
  taxa_cambio_usd_aoa DOUBLE PRECISION,
  tempo_permanencia_horas DOUBLE PRECISION,
  data_calculo TEXT,
  tipo_tarifa TEXT,
  numero_voo TEXT,
  tarifa_pouso_usd DOUBLE PRECISION DEFAULT 0,
  tarifa_pouso DOUBLE PRECISION DEFAULT 0,
  tarifa_permanencia_usd DOUBLE PRECISION DEFAULT 0,
  tarifa_permanencia DOUBLE PRECISION DEFAULT 0,
  tarifa_passageiros_usd DOUBLE PRECISION DEFAULT 0,
  tarifa_passageiros DOUBLE PRECISION DEFAULT 0,
  tarifa_carga_usd DOUBLE PRECISION DEFAULT 0,
  tarifa_carga DOUBLE PRECISION DEFAULT 0,
  outras_tarifas_usd DOUBLE PRECISION DEFAULT 0,
  outras_tarifas DOUBLE PRECISION DEFAULT 0,
  total_tarifa_usd DOUBLE PRECISION DEFAULT 0,
  total_tarifa DOUBLE PRECISION DEFAULT 0,
  detalhes_calculo JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movimento_financeiro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aeroporto_id UUID,
  data TEXT,
  tipo TEXT,
  categoria TEXT,
  descricao TEXT,
  valor_kz DOUBLE PRECISION DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE proforma (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_proforma TEXT,
  data_emissao TEXT,
  data_vencimento TEXT,
  companhia_aerea_id UUID,
  aeroporto_id UUID,
  calculo_tarifa_id UUID REFERENCES calculo_tarifa(id),
  valor_total_usd DOUBLE PRECISION DEFAULT 0,
  valor_total_aoa DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'emitida',
  observacoes TEXT,
  pdf_url TEXT,
  taxa_cambio DOUBLE PRECISION,
  voo_id UUID,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. SAFETY
-- =====================================================

CREATE TABLE ocorrencia_safety (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_ocorrencia TEXT,
  aeroporto TEXT,
  data_ocorrencia TEXT,
  hora_ocorrencia TEXT,
  local_especifico TEXT,
  descricao TEXT,
  acoes_tomadas TEXT,
  evidencias_fotograficas TEXT[] DEFAULT '{}',
  gravidade TEXT DEFAULT 'baixa',
  status TEXT DEFAULT 'aberta',
  resolucao TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. INSPECTIONS
-- =====================================================

CREATE TABLE tipo_inspecao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  codigo TEXT,
  descricao TEXT,
  frequencia TEXT,
  status TEXT DEFAULT 'ativo',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE item_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_inspecao_id UUID REFERENCES tipo_inspecao(id),
  ordem INTEGER,
  item TEXT,
  criterio TEXT,
  categoria TEXT,
  permite_fotos BOOLEAN DEFAULT FALSE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspecao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_inspecao_id UUID REFERENCES tipo_inspecao(id),
  aeroporto_id UUID,
  data_inspecao TEXT,
  hora_inicio TEXT,
  hora_fim TEXT,
  inspetor_responsavel TEXT,
  condicoes_climaticas TEXT,
  resumo_geral TEXT,
  status TEXT DEFAULT 'em_andamento',
  total_itens INTEGER DEFAULT 0,
  itens_conformes INTEGER DEFAULT 0,
  itens_nao_conformes INTEGER DEFAULT 0,
  itens_nao_aplicaveis INTEGER DEFAULT 0,
  requer_acao_imediata BOOLEAN DEFAULT FALSE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resposta_inspecao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspecao_id UUID REFERENCES inspecao(id),
  item_checklist_id UUID REFERENCES item_checklist(id),
  resultado TEXT,
  observacoes TEXT,
  fotos TEXT[] DEFAULT '{}',
  acao_corretiva TEXT,
  prazo_correcao TEXT,
  responsavel_correcao TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. AUDIT
-- =====================================================

CREATE TABLE tipo_auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  codigo TEXT,
  descricao TEXT,
  categoria TEXT,
  status TEXT DEFAULT 'ativo',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE item_auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_auditoria_id UUID REFERENCES tipo_auditoria(id),
  numero TEXT,
  item TEXT,
  referencia_norma TEXT,
  status TEXT DEFAULT 'ativo',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE processo_auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_auditoria_id UUID REFERENCES tipo_auditoria(id),
  aeroporto_id UUID,
  data_auditoria TEXT,
  auditor_responsavel TEXT,
  equipe_auditoria TEXT,
  observacoes_gerais TEXT,
  itens_selecionados TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'planejada',
  percentual_conformidade DOUBLE PRECISION DEFAULT 0,
  total_itens INTEGER DEFAULT 0,
  itens_conformes INTEGER DEFAULT 0,
  itens_nao_conformes INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resposta_auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_auditoria_id UUID REFERENCES processo_auditoria(id),
  item_auditoria_id UUID REFERENCES item_auditoria(id),
  situacao_encontrada TEXT,
  observacao TEXT,
  evidencias TEXT[] DEFAULT '{}',
  acao_corretiva_recomendada TEXT,
  responsavel_correcao TEXT,
  prazo_correcao TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plano_acao_corretiva (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_auditoria_id UUID REFERENCES processo_auditoria(id),
  aeroporto_id UUID,
  numero_pac TEXT,
  tipo TEXT DEFAULT 'interno',
  responsavel_elaboracao TEXT,
  prazo_conclusao TEXT,
  observacoes_gerais TEXT,
  data_criacao TEXT,
  total_nao_conformidades INTEGER DEFAULT 0,
  nao_conformidades_concluidas INTEGER DEFAULT 0,
  percentual_conclusao DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'elaboracao',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE item_p_a_c (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pac_id UUID REFERENCES plano_acao_corretiva(id),
  resposta_auditoria_id UUID,
  item_auditoria_id UUID,
  descricao_nao_conformidade TEXT,
  acao_corretiva_proposta TEXT,
  observacoes TEXT,
  responsavel TEXT,
  prazo_implementacao TEXT,
  categoria_prazo TEXT,
  status TEXT DEFAULT 'pendente',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. KPIs
-- =====================================================

CREATE TABLE tipo_k_p_i (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  codigo TEXT,
  descricao TEXT,
  categoria TEXT,
  unidade_medida TEXT,
  meta_objetivo DOUBLE PRECISION,
  cor_identificacao TEXT,
  status TEXT DEFAULT 'ativo',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campo_k_p_i (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_kpi_id UUID REFERENCES tipo_k_p_i(id),
  nome_campo TEXT,
  tipo_campo TEXT,
  descricao_ajuda TEXT,
  unidade TEXT,
  valor_minimo DOUBLE PRECISION,
  valor_maximo DOUBLE PRECISION,
  obrigatorio BOOLEAN DEFAULT FALSE,
  formula_calculo TEXT,
  categoria_medicao TEXT,
  ordem INTEGER,
  status TEXT DEFAULT 'ativo',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE medicao_k_p_i (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_kpi_id UUID REFERENCES tipo_k_p_i(id),
  aeroporto_id UUID,
  data_medicao TEXT,
  hora_inicio TEXT,
  hora_fim TEXT,
  numero_voo TEXT,
  companhia_aerea_codigo_icao TEXT,
  responsavel_medicao TEXT,
  turno TEXT,
  observacoes_gerais TEXT,
  resultado_principal DOUBLE PRECISION,
  dentro_da_meta BOOLEAN,
  status TEXT DEFAULT 'concluida',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE valor_campo_k_p_i (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicao_kpi_id UUID REFERENCES medicao_k_p_i(id),
  campo_kpi_id UUID REFERENCES campo_k_p_i(id),
  valor_texto TEXT,
  valor_numerico DOUBLE PRECISION,
  valor_boolean BOOLEAN,
  observacoes TEXT,
  calculado_automaticamente BOOLEAN DEFAULT FALSE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. COMPLAINTS
-- =====================================================

CREATE TABLE reclamacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT,
  descricao TEXT,
  canal_entrada TEXT,
  reclamante_nome TEXT,
  reclamante_contacto TEXT,
  aeroporto_id UUID,
  categoria_reclamacao TEXT,
  prioridade TEXT DEFAULT 'media',
  anexos TEXT[] DEFAULT '{}',
  protocolo_numero TEXT,
  data_recebimento TEXT,
  status TEXT DEFAULT 'recebida',
  area_responsavel TEXT,
  responsavel_principal TEXT,
  prazo_resposta TEXT,
  observacao TEXT,
  solucao_aplicada TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE historico_reclamacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reclamacao_id UUID REFERENCES reclamacao(id),
  data_evento TEXT,
  tipo_evento TEXT,
  detalhes TEXT,
  usuario_email TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE configuracao_area (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area TEXT,
  emails_notificacao TEXT[] DEFAULT '{}',
  responsavel_principal TEXT,
  configuracoes_extras JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. CREDENTIALING
-- =====================================================

CREATE TABLE area_acesso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  descricao TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tipo_documento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  tipo_credencial TEXT,
  formato_aceito TEXT[] DEFAULT '{}',
  tamanho_max_mb DOUBLE PRECISION,
  ordem INTEGER,
  status TEXT DEFAULT 'ativo',
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE credenciamento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_solicitante_id UUID REFERENCES empresa(id),
  tipo_credencial TEXT,
  periodo_validade TEXT,
  aeroporto_id UUID,
  areas_acesso TEXT[] DEFAULT '{}',
  justificativa_acesso TEXT,
  nome_completo TEXT,
  numero_passaporte TEXT,
  nacionalidade TEXT,
  data_nascimento TEXT,
  funcao_empresa TEXT,
  matricula_viatura TEXT,
  modelo_viatura TEXT,
  cor_viatura TEXT,
  condutor_principal TEXT,
  data_inicio_validade TEXT,
  data_fim_validade TEXT,
  documentos_anexos JSONB,
  email_notificacao TEXT,
  numero_protocolo TEXT,
  data_solicitacao TEXT,
  status TEXT DEFAULT 'pendente',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. DOCUMENTS
-- =====================================================

CREATE TABLE pasta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  descricao TEXT,
  cor TEXT,
  nivel_acesso TEXT[] DEFAULT '{}',
  ordem INTEGER,
  aeroporto_id UUID,
  protegida_senha BOOLEAN DEFAULT FALSE,
  senha TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT,
  categoria TEXT,
  aeroporto TEXT,
  versao TEXT,
  data_publicacao TEXT,
  descricao TEXT,
  nivel_acesso TEXT[] DEFAULT '{}',
  nivel_confidencialidade TEXT DEFAULT 'interno',
  requer_senha_adicional BOOLEAN DEFAULT FALSE,
  senha TEXT,
  bloquear_download BOOLEAN DEFAULT FALSE,
  adicionar_marca_dagua BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'ativo',
  arquivo_url TEXT,
  arquivo_privado_uri TEXT,
  usar_storage_privado BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  updated_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE log_acesso_documento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  documento_id UUID REFERENCES documento(id),
  usuario_email TEXT,
  usuario_nome TEXT,
  tipo_acesso TEXT,
  data_hora_acesso TIMESTAMPTZ DEFAULT NOW(),
  endereco_ip TEXT,
  user_agent TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. MAINTENANCE
-- =====================================================

CREATE TABLE ordem_servico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT,
  numero_ordem TEXT,
  descricao_problema TEXT,
  acao_corretiva_sugerida TEXT,
  aeroporto_id UUID,
  prioridade TEXT DEFAULT 'media',
  categoria_manutencao TEXT,
  responsavel_manutencao TEXT,
  prazo_estimado TEXT,
  custos_estimados DOUBLE PRECISION,
  aprovacao_necessaria BOOLEAN DEFAULT FALSE,
  observacoes_manutencao TEXT,
  status TEXT DEFAULT 'pendente',
  data_abertura TEXT,
  tipo TEXT,
  categoria TEXT,
  descricao TEXT,
  numero_protocolo TEXT,
  solicitante_email TEXT,
  solicitante_nome TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 13. GRF (Runway Condition)
-- =====================================================

CREATE TABLE registo_g_r_f (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aeroporto TEXT,
  mes INTEGER,
  dia INTEGER,
  hora_utc TEXT,
  pista TEXT,
  rwycc1 TEXT,
  perc1 TEXT,
  lamina1 TEXT,
  condicao1 TEXT,
  rwycc2 TEXT,
  perc2 TEXT,
  lamina2 TEXT,
  condicao2 TEXT,
  rwycc3 TEXT,
  perc3 TEXT,
  lamina3 TEXT,
  condicao3 TEXT,
  observacoes TEXT,
  updated_by TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 14. NOTIFICATIONS
-- =====================================================

CREATE TABLE regra_notificacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento TEXT,
  perfil TEXT,
  canal_notificacao TEXT,
  template_assunto TEXT,
  template_corpo TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE configuracao_notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ativo BOOLEAN DEFAULT TRUE,
  prazo_resposta_padrao INTEGER,
  prazo_conclusao_padrao INTEGER,
  notificar_prazo_vencimento BOOLEAN DEFAULT TRUE,
  dias_antes_alerta INTEGER DEFAULT 3,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE configuracao_opt_in_z_a_p_i (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  palavras_chave_opt_in TEXT[] DEFAULT '{}',
  palavras_chave_opt_out TEXT[] DEFAULT '{}',
  mensagem_confirmacao_opt_in TEXT,
  mensagem_confirmacao_opt_out TEXT,
  mensagem_boas_vindas TEXT,
  enviar_resposta_automatica BOOLEAN DEFAULT TRUE,
  ativo BOOLEAN DEFAULT TRUE,
  grupos_palavras_registrar TEXT[] DEFAULT '{}',
  grupos_palavras_parar TEXT[] DEFAULT '{}',
  grupos_mensagem_registro_sucesso TEXT,
  grupos_mensagem_ja_registrado TEXT,
  grupos_mensagem_desativacao TEXT,
  grupos_mensagem_nao_encontrado TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE historico_notificacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notificacao_id UUID,
  evento TEXT,
  canal TEXT,
  destinatario TEXT,
  conteudo TEXT,
  status TEXT DEFAULT 'pendente',
  data_envio TIMESTAMPTZ,
  data_entrega TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE grupo_whats_app (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_grupo TEXT,
  chat_id TEXT,
  status TEXT DEFAULT 'pendente',
  data_aprovacao TIMESTAMPTZ,
  notificacoes_ativas BOOLEAN DEFAULT TRUE,
  criador_email TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE placeholder (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  valor_padrao TEXT,
  descricao TEXT,
  categoria TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 15. AUDIT LOG
-- =====================================================

CREATE TABLE log_auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_email TEXT,
  usuario_nome TEXT,
  entidade TEXT,
  acao TEXT,
  modulo TEXT,
  id_registro TEXT,
  dados_alterados JSONB,
  detalhes TEXT,
  endereco_ip TEXT,
  user_agent TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for performance
-- =====================================================

CREATE INDEX idx_voo_data_operacao ON voo(data_operacao);
CREATE INDEX idx_voo_aeroporto ON voo(aeroporto_operacao);
CREATE INDEX idx_voo_status ON voo(status);
CREATE INDEX idx_voo_ligado_arr ON voo_ligado(id_voo_arr);
CREATE INDEX idx_voo_ligado_dep ON voo_ligado(id_voo_dep);
CREATE INDEX idx_calculo_tarifa_voo ON calculo_tarifa(voo_id);
CREATE INDEX idx_calculo_tarifa_voo_ligado ON calculo_tarifa(voo_ligado_id);
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_reclamacao_status ON reclamacao(status);
CREATE INDEX idx_ocorrencia_safety_status ON ocorrencia_safety(status);
CREATE INDEX idx_documento_categoria ON documento(categoria);
CREATE INDEX idx_log_auditoria_created ON log_auditoria(created_date);
CREATE INDEX idx_historico_notificacao_created ON historico_notificacao(created_date);
