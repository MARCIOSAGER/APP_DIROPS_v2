-- Migration 035: Update regra_permissao - add missing pages to profiles
-- Applied directly via API on 2026-03-18, documented here for tracking

-- Add missing pages to administrador profile
UPDATE regra_permissao
SET paginas_permitidas = ARRAY[
  'Home','Operacoes','FundoManeio','Faturacao','Safety','Inspecoes',
  'KPIsOperacionais','Manutencao','Auditoria','Credenciamento','GestaoAcessos',
  'GRF','Documentos','LogAuditoria','PowerBi','GerirPermissoes',
  'ServicosAeroportuarios','Proforma','Suporte','GuiaUtilizador',
  'GestaoEmpresas','Reclamacoes','GestaoAPIKeys','GestaoNotificacoes',
  'ConfiguracaoTarifas','Lixeira'
]
WHERE perfil = 'administrador';

-- Add Reclamacoes to operacoes profile
UPDATE regra_permissao
SET paginas_permitidas = array_append(paginas_permitidas, 'Reclamacoes')
WHERE perfil = 'operacoes'
  AND NOT ('Reclamacoes' = ANY(paginas_permitidas));
