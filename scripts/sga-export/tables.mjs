// Classificação de tabelas para export SGA Cloud → On-Premise.
// Baseado na análise de supabase/migrations/001..056.
//
// SGA empresa_id: 128bc692-3fae-4825-9c55-40565dbedcfb
//
// Categorias:
//   tenant   — tem coluna empresa_id; filtrar por empresa_id = SGA OR empresa_id IS NULL
//   childOf  — sem empresa_id; filtrar via FK ao registro pai (que é tenant)
//   global   — lookup/reference; export full
//   special  — regra customizada
//   skip     — ephemeral (cache/logs); não exportar

export const SGA_EMPRESA_ID = '128bc692-3fae-4825-9c55-40565dbedcfb';

// Tabelas com coluna empresa_id direta.
// Filtro: WHERE empresa_id = SGA OR empresa_id IS NULL.
// O NULL captura registros globais (ex: tipos compartilhados que não foram atribuídos).
export const TENANT_TABLES = [
  'users',
  'aeroporto',
  'voo',
  'voo_ligado',
  'calculo_tarifa',
  'proforma',
  'proforma_item',
  'ocorrencia_safety',
  'inspecao',
  'tipo_inspecao',
  'ordem_servico',
  'reclamacao',
  'documento',
  'credenciamento',
  'processo_auditoria',
  'tipo_auditoria',
  'medicao_k_p_i',
  'imposto',
  'registo_aeronave',
  'tarifa_pouso',
  'tarifa_permanencia',
  'outra_tarifa',
  'tarifa_recurso',
  'solicitacao_servico',
  'cobranca_servico',
  'api_key',
];

// Tabelas-filhas: sem empresa_id, mas dependem de um registro pai tenant.
// Definimos cada uma com sua FK e a tabela pai (que deve estar em TENANT_TABLES).
export const CHILD_TABLES = [
  { table: 'voo_ligado',         parentFk: 'id_voo_arr',            parentTable: 'voo',                parentKey: 'id' },
  // ↑ voo_ligado tem empresa_id (mig 021), mas em registros antigos pode estar NULL — child fallback
  { table: 'recurso_voo',        parentFk: 'voo_ligado_id',         parentTable: 'voo_ligado',         parentKey: 'id' },
  { table: 'servico_voo',        parentFk: 'voo_ligado_id',         parentTable: 'voo_ligado',         parentKey: 'id' },
  { table: 'resposta_inspecao',  parentFk: 'inspecao_id',           parentTable: 'inspecao',           parentKey: 'id' },
  { table: 'resposta_auditoria', parentFk: 'processo_auditoria_id', parentTable: 'processo_auditoria', parentKey: 'id' },
  { table: 'plano_acao_corretiva', parentFk: 'processo_auditoria_id', parentTable: 'processo_auditoria', parentKey: 'id' },
  { table: 'item_p_a_c',         parentFk: 'pac_id',                parentTable: 'plano_acao_corretiva', parentKey: 'id' },
  { table: 'item_checklist',     parentFk: 'tipo_inspecao_id',      parentTable: 'tipo_inspecao',      parentKey: 'id' },
  { table: 'item_auditoria',     parentFk: 'tipo_auditoria_id',     parentTable: 'tipo_auditoria',     parentKey: 'id' },
  { table: 'valor_campo_k_p_i',  parentFk: 'medicao_kpi_id',        parentTable: 'medicao_k_p_i',      parentKey: 'id' },
  { table: 'historico_reclamacao', parentFk: 'reclamacao_id',       parentTable: 'reclamacao',         parentKey: 'id' },
  // movimento_financeiro e registo_g_r_f: pai é aeroporto via aeroporto_id (UUID) e aeroporto (TEXT ICAO) respectivamente.
  { table: 'movimento_financeiro', parentFk: 'aeroporto_id',        parentTable: 'aeroporto',          parentKey: 'id' },
  { table: 'registo_g_r_f',      parentFk: 'aeroporto',             parentTable: 'aeroporto',          parentKey: 'codigo_icao' },
  // pasta tem aeroporto_id (nullable) — exportar tudo onde aeroporto é SGA ou aeroporto_id IS NULL (global)
  { table: 'pasta',              parentFk: 'aeroporto_id',          parentTable: 'aeroporto',          parentKey: 'id', includeNullFk: true },
];

// Tabelas-globais: export integral.
export const GLOBAL_TABLES = [
  'companhia_aerea',
  'modelo_aeronave',
  'tipo_documento',
  'tipo_k_p_i',
  'campo_k_p_i',
  'tipo_servico_geral',
  'area_acesso',
  'configuracao_area',
  'regra_permissao',
  'regra_notificacao',
  'configuracao_notificacoes',
  'configuracao_opt_in_z_a_p_i',
  'configuracao_sistema',
  'placeholder',
  'grupo_whats_app',
  'cliente',
];

// Tabelas especiais com regra customizada.
export const SPECIAL_TABLES = [
  // empresa: queremos só a row SGA (id = SGA_EMPRESA_ID)
  { table: 'empresa', kind: 'whereId', column: 'id', value: SGA_EMPRESA_ID },
  // solicitacao_acesso: usa empresa_solicitante_id, não empresa_id
  { table: 'solicitacao_acesso', kind: 'whereEq', column: 'empresa_solicitante_id', value: SGA_EMPRESA_ID, includeNull: true },
];

// Ephemeral / regenerável — não exportar.
export const SKIP_TABLES = [
  'cache_voo_f_r24',
  'log_auditoria',
  'log_acesso_documento',
  'historico_notificacao',
  'api_rate_limit',
  'api_access_log',
];

// Sanity-check: detectar overlap entre categorias (erro de classificação).
export function assertNoOverlap() {
  const all = new Map();
  const add = (name, cat) => {
    if (all.has(name)) {
      throw new Error(`Tabela ${name} aparece em duas categorias: ${all.get(name)} e ${cat}`);
    }
    all.set(name, cat);
  };
  for (const t of TENANT_TABLES) add(t, 'tenant');
  for (const t of CHILD_TABLES) add(t.table, 'child');
  for (const t of GLOBAL_TABLES) add(t, 'global');
  for (const t of SPECIAL_TABLES) add(t.table, 'special');
  for (const t of SKIP_TABLES) add(t, 'skip');
  return all;
}

// Lista de TODAS as tabelas que esperamos encontrar (para detectar tabelas novas no Cloud
// que não foram classificadas — script vai emitir warning).
export function allKnownTables() {
  return new Set([
    ...TENANT_TABLES,
    ...CHILD_TABLES.map(c => c.table),
    ...GLOBAL_TABLES,
    ...SPECIAL_TABLES.map(s => s.table),
    ...SKIP_TABLES,
  ]);
}
