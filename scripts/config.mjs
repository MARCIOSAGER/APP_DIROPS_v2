// ============================================================
// CONFIGURACAO DA MIGRACAO
// ============================================================
// Credenciais sao lidas de scripts/.env.migration (nao vai pro Git)
// Copie scripts/.env.migration.example -> scripts/.env.migration e preencha
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '.env.migration');

// Carrega variaveis do .env.migration
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// --- Base44 (origem) ---
export const BASE44_API_KEY = process.env.BASE44_API_KEY || '';
export const BASE44_APP_ID = process.env.BASE44_APP_ID || '';
export const BASE44_API_URL = 'https://app.base44.com';

// --- Supabase (destino) ---
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// --- Mapeamento de entidades Base44 -> tabelas Supabase ---
export const ENTITY_TABLE_MAP = {
  // Entidade Base44: tabela Supabase
  'Aeroporto': 'aeroporto',
  'AreaAcesso': 'area_acesso',
  'CalculoTarifa': 'calculo_tarifa',
  'CampoKPI': 'campo_kpi',
  'CompanhiaAerea': 'companhia_aerea',
  'ConfiguracaoArea': 'configuracao_area',
  'ConfiguracaoNotificacoes': 'configuracao_notificacoes',
  'ConfiguracaoOptInZAPI': 'configuracao_opt_in_zapi',
  'ConfiguracaoSistema': 'configuracao_sistema',
  'Credenciamento': 'credenciamento',
  'Documento': 'documento',
  'Empresa': 'empresa',
  'HistoricoReclamacao': 'historico_reclamacao',
  'Imposto': 'imposto',
  'Inspecao': 'inspecao',
  'ItemAuditoria': 'item_auditoria',
  'ItemChecklist': 'item_checklist',
  'ItemPAC': 'item_pac',
  'LogAuditoria': 'log_auditoria',
  'MedicaoKPI': 'medicao_kpi',
  'ModeloAeronave': 'modelo_aeronave',
  'MovimentoFinanceiro': 'movimento_financeiro',
  'OcorrenciaSafety': 'ocorrencia_safety',
  'OrdemServico': 'ordem_servico',
  'OutraTarifa': 'outra_tarifa',
  'Pasta': 'pasta',
  'Placeholder': 'placeholder',
  'PlanoAcaoCorretiva': 'plano_acao_corretiva',
  'ProcessoAuditoria': 'processo_auditoria',
  'Proforma': 'proforma',
  'Reclamacao': 'reclamacao',
  'RegistoAeronave': 'registo_aeronave',
  'RegistoGRF': 'registo_grf',
  'RegraNotificacao': 'regra_notificacao',
  'RegraPermissao': 'regra_permissao',
  'RespostaAuditoria': 'resposta_auditoria',
  'RespostaInspecao': 'resposta_inspecao',
  'SolicitacaoAcesso': 'solicitacao_acesso',
  'TarifaPermanencia': 'tarifa_permanencia',
  'TarifaPouso': 'tarifa_pouso',
  'TipoAuditoria': 'tipo_auditoria',
  'TipoDocumento': 'tipo_documento',
  'TipoInspecao': 'tipo_inspecao',
  'TipoKPI': 'tipo_kpi',
  'ValorCampoKPI': 'valor_campo_kpi',
  'Voo': 'voo',
  'VooLigado': 'voo_ligado',
  'CacheVooFR24': 'cache_voo_fr24',
  'GrupoWhatsApp': 'grupo_whats_app',
  'HistoricoNotificacao': 'historico_notificacao',
  'LogAcessoDocumento': 'log_acesso_documento',
};

// Entidades que NAO devem ser migradas (dados efemeros ou gerados)
export const SKIP_ENTITIES = [
  'CacheVooFR24',      // Cache temporario
  'LogAuditoria',      // Logs serao gerados novamente
  'LogAcessoDocumento', // Logs serao gerados novamente
];
