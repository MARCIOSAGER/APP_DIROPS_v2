/**
 * Migration script: Base44 -> Supabase
 *
 * Usage: SUPABASE_SERVICE_KEY=your_key node supabase/migrate-from-base44.cjs
 *
 * Pulls all entity data from Base44 API and inserts into Supabase.
 * Handles ID mapping (Base44 string IDs -> Supabase UUIDs).
 */

const { createClient } = require('@supabase/supabase-js');

// ---- CONFIG ----
const BASE44_API_KEY = '1ba42f030a284ec390f8a9944b6e1e0b';
const BASE44_APP_ID = '6870dc26cbf5444a4fbe6aa9';
const BASE44_URL = `https://app.base44.com/api/apps/${BASE44_APP_ID}/entities`;

const SUPABASE_URL = 'https://glernwcsuwcyzwsnelad.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Set SUPABASE_SERVICE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ID mapping: Base44 ID -> Supabase UUID
const idMap = {};

// ---- HELPERS ----

async function fetchBase44(entityName) {
  const allData = [];
  let skip = 0;
  const limit = 500;

  while (true) {
    const url = `${BASE44_URL}/${entityName}?limit=${limit}${skip > 0 ? '&skip=' + skip : ''}`;
    const res = await fetch(url, {
      headers: { 'api_key': BASE44_API_KEY }
    });

    if (!res.ok) {
      console.warn(`  Warning: ${entityName} fetch failed (${res.status})`);
      break;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    allData.push(...data);
    if (data.length < limit) break;
    skip += limit;
  }

  return allData;
}

function mapId(oldId) {
  if (!oldId) return null;
  return idMap[oldId] || null;
}

function cleanDate(val) {
  if (!val) return null;
  try {
    return new Date(val).toISOString();
  } catch {
    return null;
  }
}

function cleanArray(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  return [];
}

function cleanNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// Insert with ID mapping (Base44 ID -> new Supabase UUID)
async function insertWithMapping(tableName, records, base44Ids) {
  if (records.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < records.length; i += 50) {
    const chunk = records.slice(i, i + 50);
    const chunkIds = base44Ids.slice(i, i + 50);
    const { data, error } = await supabase.from(tableName).insert(chunk).select('id');

    if (error) {
      console.error(`  Error inserting into ${tableName}:`, error.message);
      // One by one fallback
      for (let j = 0; j < chunk.length; j++) {
        const { data: single, error: singleErr } = await supabase.from(tableName).insert(chunk[j]).select('id');
        if (!singleErr && single?.[0]) {
          idMap[chunkIds[j]] = single[0].id;
          inserted++;
        } else if (singleErr) {
          console.error(`  Failed:`, singleErr.message, JSON.stringify(chunk[j]).slice(0, 150));
        }
      }
    } else if (data) {
      data.forEach((row, idx) => {
        if (row.id && chunkIds[idx]) {
          idMap[chunkIds[idx]] = row.id;
        }
      });
      inserted += data.length;
    }
  }
  return inserted;
}

// ---- ENTITY MIGRATIONS ----
// Column names mapped to actual Supabase schema

async function migrateEmpresa() {
  const data = await fetchBase44('Empresa');
  console.log(`  Fetched ${data.length} empresas`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      nif: item.nif,
      endereco: item.endereco,
      telefone: item.telefone,
      email_principal: item.email_principal,
      responsavel_nome: item.responsavel_nome,
      responsavel_email: item.responsavel_email,
      responsavel_telefone: item.responsavel_telefone,
      area_atividade: item.area_atividade,
      status: item.status || 'ativo',
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('empresa', records, ids);
}

async function migrateAeroporto() {
  const data = await fetchBase44('Aeroporto');
  console.log(`  Fetched ${data.length} aeroportos`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      codigo_icao: item.codigo_icao,
      codigo_iata: item.codigo_iata,
      cidade: item.cidade,
      provincia: item.provincia,
      pais: item.pais,
      latitude: cleanNumber(item.latitude),
      longitude: cleanNumber(item.longitude),
      categoria: item.categoria,
      tipo_operacao: item.tipo_operacao,
      soleiras: item.soleiras,
      status: item.status || 'operacional',
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('aeroporto', records, ids);
}

async function migrateCompanhiaAerea() {
  const data = await fetchBase44('CompanhiaAerea');
  console.log(`  Fetched ${data.length} companhias aereas`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      codigo_icao: item.codigo_icao,
      codigo_iata: item.codigo_iata,
      pais_origem: item.pais_origem,
      // Supabase uses 'nacionalidade' but also has pais_origem
      tipo: item.tipo,
      status: item.status || 'ativo',
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('companhia_aerea', records, ids);
}

async function migrateModeloAeronave() {
  const data = await fetchBase44('ModeloAeronave');
  console.log(`  Fetched ${data.length} modelos aeronave`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      codigo_icao: item.codigo_icao,
      fabricante: item.fabricante,
      modelo: item.modelo,
      categoria_wake: item.categoria_wake,
      envergadura_m: cleanNumber(item.envergadura),  // Base44: envergadura -> Supabase: envergadura_m
      comprimento: cleanNumber(item.comprimento),
      mtow_kg: cleanNumber(item.mtow_kg),
      numero_motores: cleanNumber(item.numero_motores),
      tipo_motor: item.tipo_motor,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('modelo_aeronave', records, ids);
}

async function migrateRegraPermissao() {
  const data = await fetchBase44('RegraPermissao');
  console.log(`  Fetched ${data.length} regras permissao`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      perfil: item.perfil,
      paginas_permitidas: cleanArray(item.paginas_permitidas),
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('regra_permissao', records, ids);
}

async function migrateConfiguracaoSistema() {
  const data = await fetchBase44('ConfiguracaoSistema');
  console.log(`  Fetched ${data.length} configuracoes sistema`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      chave: item.chave,
      valor: item.valor,
      descricao: item.descricao,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('configuracao_sistema', records, ids);
}

async function migrateTarifaPouso() {
  const data = await fetchBase44('TarifaPouso');
  console.log(`  Fetched ${data.length} tarifas pouso`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      categoria_aeroporto: item.categoria_aeroporto,
      tipo_voo: item.tipo_voo,
      faixa_min: cleanNumber(item.faixa_peso_min),       // Base44: faixa_peso_min -> Supabase: faixa_min
      faixa_peso_max: cleanNumber(item.faixa_peso_max),
      valor_por_tonelada: cleanNumber(item.valor_por_tonelada),
      moeda: item.moeda || 'USD',
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('tarifa_pouso', records, ids);
}

async function migrateTarifaPermanencia() {
  const data = await fetchBase44('TarifaPermanencia');
  console.log(`  Fetched ${data.length} tarifas permanencia`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      categoria_aeroporto: item.categoria_aeroporto,
      tipo_voo: item.tipo_voo,
      tarifa_usd_por_tonelada_hora: cleanNumber(item.valor_por_hora_tonelada), // remapped
      horas_gratis: cleanNumber(item.horas_gratis),
      moeda: item.moeda || 'USD',
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('tarifa_permanencia', records, ids);
}

async function migrateOutraTarifa() {
  const data = await fetchBase44('OutraTarifa');
  console.log(`  Fetched ${data.length} outras tarifas`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      tipo: item.tipo,
      valor: cleanNumber(item.valor),
      unidade: item.unidade,
      moeda: item.moeda || 'USD',
      aplicavel_a: item.aplicavel_a,
      descricao: item.descricao,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('outra_tarifa', records, ids);
}

async function migrateImposto() {
  const data = await fetchBase44('Imposto');
  console.log(`  Fetched ${data.length} impostos`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      tipo: item.tipo,
      percentual: cleanNumber(item.percentual),
      valor: cleanNumber(item.valor_fixo),        // Base44: valor_fixo -> Supabase: valor
      aplicavel_a: item.aplicavel_a,
      descricao: item.descricao,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('imposto', records, ids);
}

async function migrateTipoInspecao() {
  const data = await fetchBase44('TipoInspecao');
  console.log(`  Fetched ${data.length} tipos inspecao`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      descricao: item.descricao,
      frequencia: item.periodicidade,              // Base44: periodicidade -> Supabase: frequencia
      area_responsavel: item.area_responsavel,
      ativo: item.ativo !== false,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('tipo_inspecao', records, ids);
}

async function migrateItemChecklist() {
  const data = await fetchBase44('ItemChecklist');
  console.log(`  Fetched ${data.length} itens checklist`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      tipo_inspecao_id: mapId(item.tipo_inspecao_id),
      descricao: item.descricao,
      item: item.descricao,                         // Also populate 'item' column
      categoria: item.categoria,
      ordem: cleanNumber(item.ordem),
      obrigatorio: item.obrigatorio !== false,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('item_checklist', records, ids);
}

async function migrateTipoAuditoria() {
  const data = await fetchBase44('TipoAuditoria');
  console.log(`  Fetched ${data.length} tipos auditoria`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      descricao: item.descricao,
      periodicidade: item.periodicidade,
      norma_referencia: item.norma_referencia,
      ativo: item.ativo !== false,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('tipo_auditoria', records, ids);
}

async function migrateItemAuditoria() {
  const data = await fetchBase44('ItemAuditoria');
  console.log(`  Fetched ${data.length} itens auditoria`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      tipo_auditoria_id: mapId(item.tipo_auditoria_id),
      item: item.descricao,                          // Base44: descricao -> Supabase: item
      referencia_norma: item.requisito,              // Base44: requisito -> Supabase: referencia_norma
      categoria: item.categoria,
      ordem: cleanNumber(item.ordem),
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('item_auditoria', records, ids);
}

async function migrateTipoKPI() {
  const data = await fetchBase44('TipoKPI');
  console.log(`  Fetched ${data.length} tipos KPI`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      descricao: item.descricao,
      categoria: item.categoria,
      unidade_medida: item.unidade_medida,
      formula: item.formula,
      meta_objetivo: cleanNumber(item.meta_valor),    // Base44: meta_valor -> Supabase: meta_objetivo
      meta_tipo: item.meta_tipo,
      periodicidade: item.periodicidade,
      ativo: item.ativo !== false,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('tipo_k_p_i', records, ids);
}

async function migrateCampoKPI() {
  const data = await fetchBase44('CampoKPI');
  console.log(`  Fetched ${data.length} campos KPI`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      tipo_kpi_id: mapId(item.tipo_kpi_id),
      nome_campo: item.nome,                          // Base44: nome -> Supabase: nome_campo
      tipo_campo: item.tipo_campo,
      obrigatorio: item.obrigatorio !== false,
      opcoes: item.opcoes ? JSON.stringify(item.opcoes) : null,
      ordem: cleanNumber(item.ordem),
      descricao_ajuda: item.descricao,                // Base44: descricao -> Supabase: descricao_ajuda
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('campo_k_p_i', records, ids);
}

async function migrateTipoDocumento() {
  const data = await fetchBase44('TipoDocumento');
  console.log(`  Fetched ${data.length} tipos documento`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      descricao: item.descricao,
      tipo_credencial: item.categoria,                // Base44: categoria -> Supabase: tipo_credencial
      formato_aceito: item.extensoes_permitidas ? JSON.stringify(item.extensoes_permitidas) : null,
      tamanho_max_mb: cleanNumber(item.tamanho_max_mb),
      ativo: item.ativo !== false,
      created_date: cleanDate(item.created_date),
    });
  }

  return insertWithMapping('tipo_documento', records, ids);
}

async function migrateRegraNotificacao() {
  const data = await fetchBase44('RegraNotificacao');
  console.log(`  Fetched ${data.length} regras notificacao`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome: item.nome,
      evento: item.evento,
      canal: item.canal,
      perfil: Array.isArray(item.perfis_destino) ? item.perfis_destino.join(',') : item.perfis_destino,
      template_corpo: item.template,                  // Base44: template -> Supabase: template_corpo
      ativo: item.ativo !== false,
      created_date: cleanDate(item.created_date),
    });
  }

  return insertWithMapping('regra_notificacao', records, ids);
}

async function migrateGrupoWhatsApp() {
  const data = await fetchBase44('GrupoWhatsApp');
  console.log(`  Fetched ${data.length} grupos whatsapp`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome_grupo: item.nome,                          // Base44: nome -> Supabase: nome_grupo
      descricao: item.descricao,
      aeroporto_codigo: item.aeroporto_codigo,
      tipo: item.tipo,
      membros: item.membros || [],
      ativo: item.ativo !== false,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('grupo_whats_app', records, ids);
}

// ---- PHASE 3: Operational data (Voo, VooLigado, RegistoAeronave, etc.) ----

async function migrateRegistoAeronave() {
  const data = await fetchBase44('RegistoAeronave');
  console.log(`  Fetched ${data.length} registos aeronave`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      registo: item.registo,
      registo_normalizado: item.registo_normalizado,
      id_modelo_aeronave: mapId(item.id_modelo_aeronave),
      id_companhia_aerea: mapId(item.id_companhia_aerea),
      mtow_kg: cleanNumber(item.mtow_kg),
      total_assentos: cleanNumber(item.total_assentos),
      num_first: cleanNumber(item.num_first),
      num_business: cleanNumber(item.num_business),
      num_premium: cleanNumber(item.num_premium),
      num_economy: cleanNumber(item.num_economy),
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('registo_aeronave', records, ids);
}

async function migrateVoo() {
  const data = await fetchBase44('Voo');
  console.log(`  Fetched ${data.length} voos`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      tipo_movimento: item.tipo_movimento,
      numero_voo: item.numero_voo,
      data_operacao: item.data_operacao,
      horario_previsto: item.horario_previsto,
      horario_real: item.horario_real,
      aeroporto_operacao: item.aeroporto_operacao,
      registo_aeronave: item.registo_aeronave,
      companhia_aerea: item.companhia_aerea,
      aeroporto_origem_destino: item.aeroporto_origem_destino,
      tipo_voo: item.tipo_voo,
      status: item.status,
      passageiros_local: cleanNumber(item.passageiros_local),
      passageiros_transito_transbordo: cleanNumber(item.passageiros_transito_transbordo),
      passageiros_transito_direto: cleanNumber(item.passageiros_transito_direto),
      passageiros_total: cleanNumber(item.passageiros_total),
      tripulacao: cleanNumber(item.tripulacao),
      carga_kg: cleanNumber(item.carga_kg),
      observacoes: item.observacoes,
      aeronave_no_hangar: item.aeronave_no_hangar === true,
      requer_iluminacao_extra: item.requer_iluminacao_extra === true,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('voo', records, ids);
}

async function migrateVooLigado() {
  const data = await fetchBase44('VooLigado');
  console.log(`  Fetched ${data.length} voos ligados`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      id_voo_arr: mapId(item.id_voo_arr),
      id_voo_dep: mapId(item.id_voo_dep),
      tempo_permanencia_min: cleanNumber(item.tempo_permanencia_min),
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('voo_ligado', records, ids);
}

async function migrateCalculoTarifa() {
  const data = await fetchBase44('CalculoTarifa');
  console.log(`  Fetched ${data.length} calculos tarifa`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      voo_id: mapId(item.voo_id),
      voo_ligado_id: mapId(item.voo_ligado_id),
      companhia_id: mapId(item.companhia_id),
      aeroporto_id: mapId(item.aeroporto_id),
      categoria_aeroporto: item.categoria_aeroporto,
      mtow_kg: cleanNumber(item.mtow_kg),
      taxa_cambio_usd_aoa: cleanNumber(item.taxa_cambio_usd_aoa),
      tempo_permanencia_horas: cleanNumber(item.tempo_permanencia_horas),
      data_calculo: item.data_calculo,
      tipo_tarifa: item.tipo_tarifa,
      numero_voo: item.numero_voo,
      tarifa_pouso_usd: cleanNumber(item.tarifa_pouso_usd),
      tarifa_pouso: cleanNumber(item.tarifa_pouso),
      tarifa_permanencia_usd: cleanNumber(item.tarifa_permanencia_usd),
      tarifa_permanencia: cleanNumber(item.tarifa_permanencia),
      tarifa_passageiros_usd: cleanNumber(item.tarifa_passageiros_usd),
      tarifa_passageiros: cleanNumber(item.tarifa_passageiros),
      tarifa_carga_usd: cleanNumber(item.tarifa_carga_usd),
      tarifa_carga: cleanNumber(item.tarifa_carga),
      outras_tarifas_usd: cleanNumber(item.outras_tarifas_usd),
      outras_tarifas: cleanNumber(item.outras_tarifas),
      total_tarifa_usd: cleanNumber(item.total_tarifa_usd),
      total_tarifa: cleanNumber(item.total_tarifa),
      detalhes_calculo: item.detalhes_calculo,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('calculo_tarifa', records, ids);
}

async function migrateProforma() {
  const data = await fetchBase44('Proforma');
  console.log(`  Fetched ${data.length} proformas`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      numero_proforma: item.numero_proforma,
      data_emissao: item.data_emissao,
      data_vencimento: item.data_vencimento,
      companhia_aerea_id: mapId(item.companhia_aerea_id),
      aeroporto_id: mapId(item.aeroporto_id),
      calculo_tarifa_id: mapId(item.calculo_tarifa_id),
      valor_total_usd: cleanNumber(item.valor_total_usd),
      valor_total_aoa: cleanNumber(item.valor_total_aoa),
      status: item.status,
      observacoes: item.observacoes,
      pdf_url: item.pdf_url,
      taxa_cambio: cleanNumber(item.taxa_cambio),
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('proforma', records, ids);
}

async function migrateInspecao() {
  const data = await fetchBase44('Inspecao');
  console.log(`  Fetched ${data.length} inspecoes`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      tipo_inspecao_id: mapId(item.tipo_inspecao_id),
      aeroporto_id: mapId(item.aeroporto_id),
      data_inspecao: item.data_inspecao,
      hora_inicio: item.hora_inicio,
      hora_fim: item.hora_fim,
      inspetor_responsavel: item.inspetor_responsavel,
      condicoes_climaticas: item.condicoes_climaticas,
      resumo_geral: item.resumo_geral,
      status: item.status,
      total_itens: cleanNumber(item.total_itens),
      itens_conformes: cleanNumber(item.itens_conformes),
      itens_nao_conformes: cleanNumber(item.itens_nao_conformes),
      itens_nao_aplicaveis: cleanNumber(item.itens_nao_aplicaveis),
      requer_acao_imediata: item.requer_acao_imediata === true,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('inspecao', records, ids);
}

async function migrateRespostaInspecao() {
  const data = await fetchBase44('RespostaInspecao');
  console.log(`  Fetched ${data.length} respostas inspecao`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      inspecao_id: mapId(item.inspecao_id),
      item_checklist_id: mapId(item.item_checklist_id),
      resultado: item.resultado,
      observacoes: item.observacoes,
      fotos: item.fotos,
      acao_corretiva: item.acao_corretiva,
      prazo_correcao: item.prazo_correcao,
      responsavel_correcao: item.responsavel_correcao,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('resposta_inspecao', records, ids);
}

async function migrateProcessoAuditoria() {
  const data = await fetchBase44('ProcessoAuditoria');
  console.log(`  Fetched ${data.length} processos auditoria`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      tipo_auditoria_id: mapId(item.tipo_auditoria_id),
      aeroporto_id: mapId(item.aeroporto_id),
      data_auditoria: item.data_auditoria,
      auditor_responsavel: item.auditor_responsavel,
      equipe_auditoria: item.equipe_auditoria,
      observacoes_gerais: item.observacoes_gerais,
      itens_selecionados: item.itens_selecionados,
      status: item.status,
      percentual_conformidade: cleanNumber(item.percentual_conformidade),
      total_itens: cleanNumber(item.total_itens),
      itens_conformes: cleanNumber(item.itens_conformes),
      itens_nao_conformes: cleanNumber(item.itens_nao_conformes),
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('processo_auditoria', records, ids);
}

async function migrateRespostaAuditoria() {
  const data = await fetchBase44('RespostaAuditoria');
  console.log(`  Fetched ${data.length} respostas auditoria`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      processo_auditoria_id: mapId(item.processo_auditoria_id),
      item_auditoria_id: mapId(item.item_auditoria_id),
      situacao_encontrada: item.situacao_encontrada,
      observacao: item.observacao,
      evidencias: item.evidencias,
      acao_corretiva_recomendada: item.acao_corretiva_recomendada,
      responsavel_correcao: item.responsavel_correcao,
      prazo_correcao: item.prazo_correcao,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('resposta_auditoria', records, ids);
}

async function migrateCredenciamento() {
  const data = await fetchBase44('Credenciamento');
  console.log(`  Fetched ${data.length} credenciamentos`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      empresa_solicitante_id: mapId(item.empresa_solicitante_id),
      tipo_credencial: item.tipo_credencial,
      periodo_validade: item.periodo_validade,
      aeroporto_id: mapId(item.aeroporto_id),
      areas_acesso: item.areas_acesso,
      justificativa_acesso: item.justificativa_acesso,
      nome_completo: item.nome_completo,
      numero_passaporte: item.numero_passaporte,
      nacionalidade: item.nacionalidade,
      data_nascimento: item.data_nascimento,
      funcao_empresa: item.funcao_empresa,
      matricula_viatura: item.matricula_viatura,
      modelo_viatura: item.modelo_viatura,
      cor_viatura: item.cor_viatura,
      condutor_principal: item.condutor_principal,
      data_inicio_validade: item.data_inicio_validade,
      data_fim_validade: item.data_fim_validade,
      documentos_anexos: item.documentos_anexos,
      status: item.status,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('credenciamento', records, ids);
}

async function migrateDocumento() {
  const data = await fetchBase44('Documento');
  console.log(`  Fetched ${data.length} documentos`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      titulo: item.titulo,
      categoria: item.categoria,
      aeroporto: item.aeroporto,
      versao: item.versao,
      data_publicacao: item.data_publicacao,
      descricao: item.descricao,
      nivel_acesso: item.nivel_acesso,
      nivel_confidencialidade: item.nivel_confidencialidade,
      status: item.status,
      arquivo_url: item.arquivo_url,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('documento', records, ids);
}

async function migrateOrdemServico() {
  const data = await fetchBase44('OrdemServico');
  console.log(`  Fetched ${data.length} ordens servico`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      titulo: item.titulo,
      numero_ordem: item.numero_ordem,
      descricao_problema: item.descricao_problema,
      acao_corretiva_sugerida: item.acao_corretiva_sugerida,
      aeroporto_id: mapId(item.aeroporto_id),
      prioridade: item.prioridade,
      categoria_manutencao: item.categoria_manutencao,
      responsavel_manutencao: item.responsavel_manutencao,
      prazo_estimado: item.prazo_estimado,
      custos_estimados: cleanNumber(item.custos_estimados),
      aprovacao_necessaria: item.aprovacao_necessaria === true,
      observacoes_manutencao: item.observacoes_manutencao,
      status: item.status,
      data_abertura: item.data_abertura,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('ordem_servico', records, ids);
}

async function migrateRegistoGRF() {
  const data = await fetchBase44('RegistoGRF');
  console.log(`  Fetched ${data.length} registos GRF`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      aeroporto: item.aeroporto,
      mes: item.mes,
      dia: item.dia,
      hora_utc: item.hora_utc,
      pista: item.pista,
      rwycc1: item.rwycc1,
      perc1: item.perc1,
      lamina1: item.lamina1,
      condicao1: item.condicao1,
      rwycc2: item.rwycc2,
      perc2: item.perc2,
      lamina2: item.lamina2,
      condicao2: item.condicao2,
      rwycc3: item.rwycc3,
      perc3: item.perc3,
      lamina3: item.lamina3,
      condicao3: item.condicao3,
      observacoes: item.observacoes,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('registo_g_r_f', records, ids);
}

async function migrateSolicitacaoAcesso() {
  const data = await fetchBase44('SolicitacaoAcesso');
  console.log(`  Fetched ${data.length} solicitacoes acesso`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      nome_completo: item.nome_completo,
      email: item.email,
      telefone: item.telefone,
      perfil_solicitado: item.perfil_solicitado,
      empresa_solicitante_id: mapId(item.empresa_solicitante_id),
      aeroportos_solicitados: cleanArray(item.aeroportos_solicitados),
      justificativa: item.justificativa,
      status: item.status,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('solicitacao_acesso', records, ids);
}

async function migrateOcorrenciaSafety() {
  const data = await fetchBase44('OcorrenciaSafety');
  console.log(`  Fetched ${data.length} ocorrencias safety`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      tipo_ocorrencia: item.tipo_ocorrencia,
      aeroporto: item.aeroporto,
      data_ocorrencia: item.data_ocorrencia,
      hora_ocorrencia: item.hora_ocorrencia,
      local_especifico: item.local_especifico,
      descricao: item.descricao,
      acoes_tomadas: item.acoes_tomadas,
      evidencias_fotograficas: item.evidencias_fotograficas,
      gravidade: item.gravidade,
      status: item.status,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('ocorrencia_safety', records, ids);
}

async function migrateReclamacao() {
  const data = await fetchBase44('Reclamacao');
  console.log(`  Fetched ${data.length} reclamacoes`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      titulo: item.titulo,
      descricao: item.descricao,
      canal_entrada: item.canal_entrada,
      reclamante_nome: item.reclamante_nome,
      reclamante_contacto: item.reclamante_contacto,
      aeroporto_id: mapId(item.aeroporto_id),
      categoria_reclamacao: item.categoria_reclamacao,
      prioridade: item.prioridade,
      protocolo_numero: item.protocolo_numero,
      data_recebimento: item.data_recebimento,
      status: item.status,
      area_responsavel: item.area_responsavel,
      responsavel_principal: item.responsavel_principal,
      prazo_resposta: item.prazo_resposta,
      observacao: item.observacao,
      solucao_aplicada: item.solucao_aplicada,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('reclamacao', records, ids);
}

async function migrateMedicaoKPI() {
  const data = await fetchBase44('MedicaoKPI');
  console.log(`  Fetched ${data.length} medicoes KPI`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      tipo_kpi_id: mapId(item.tipo_kpi_id),
      aeroporto_id: mapId(item.aeroporto_id),
      data_medicao: item.data_medicao,
      hora_inicio: item.hora_inicio,
      hora_fim: item.hora_fim,
      numero_voo: item.numero_voo,
      companhia_aerea_codigo_icao: item.companhia_aerea_codigo_icao,
      responsavel_medicao: item.responsavel_medicao,
      turno: item.turno,
      observacoes_gerais: item.observacoes_gerais,
      resultado_principal: cleanNumber(item.resultado_principal),
      dentro_da_meta: item.dentro_da_meta,
      status: item.status,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('medicao_k_p_i', records, ids);
}

async function migrateMovimentoFinanceiro() {
  const data = await fetchBase44('MovimentoFinanceiro');
  console.log(`  Fetched ${data.length} movimentos financeiros`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      aeroporto_id: mapId(item.aeroporto_id),
      data: item.data,
      tipo: item.tipo,
      categoria: item.categoria,
      descricao: item.descricao,
      valor_kz: cleanNumber(item.valor_kz),
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('movimento_financeiro', records, ids);
}

async function migratePlanoAcaoCorretiva() {
  const data = await fetchBase44('PlanoAcaoCorretiva');
  console.log(`  Fetched ${data.length} planos acao corretiva`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      processo_auditoria_id: mapId(item.processo_auditoria_id),
      aeroporto_id: mapId(item.aeroporto_id),
      numero_pac: item.numero_pac,
      tipo: item.tipo,
      responsavel_elaboracao: item.responsavel_elaboracao,
      prazo_conclusao: item.prazo_conclusao,
      observacoes_gerais: item.observacoes_gerais,
      data_criacao: item.data_criacao,
      total_nao_conformidades: cleanNumber(item.total_nao_conformidades),
      nao_conformidades_concluidas: cleanNumber(item.nao_conformidades_concluidas),
      percentual_conclusao: cleanNumber(item.percentual_conclusao),
      status: item.status,
      created_date: cleanDate(item.created_date),
      updated_date: cleanDate(item.updated_date),
    });
  }

  return insertWithMapping('plano_acao_corretiva', records, ids);
}

async function migrateLogAuditoria() {
  const data = await fetchBase44('LogAuditoria');
  console.log(`  Fetched ${data.length} logs auditoria`);

  const records = [];
  const ids = [];
  for (const item of data) {
    ids.push(item.id);
    records.push({
      usuario_email: item.usuario_email,
      usuario_nome: item.usuario_nome,
      entidade: item.entidade,
      acao: item.acao,
      modulo: item.modulo,
      id_registro: item.id_registro,
      dados_alterados: item.dados_alterados,
      detalhes: item.detalhes,
      created_date: cleanDate(item.created_date),
    });
  }

  return insertWithMapping('log_auditoria', records, ids);
}

// ---- MAIN ----

async function main() {
  console.log('=== DIROPS-SGA: Base44 -> Supabase Migration ===\n');

  // Phase 1: Reference data (no foreign key dependencies)
  console.log('Phase 1: Reference/Config data...');

  const phase1 = [
    ['Empresa', migrateEmpresa],
    ['Aeroporto', migrateAeroporto],
    ['CompanhiaAerea', migrateCompanhiaAerea],
    ['ModeloAeronave', migrateModeloAeronave],
    ['RegraPermissao', migrateRegraPermissao],
    ['ConfiguracaoSistema', migrateConfiguracaoSistema],
    ['TarifaPouso', migrateTarifaPouso],
    ['TarifaPermanencia', migrateTarifaPermanencia],
    ['OutraTarifa', migrateOutraTarifa],
    ['Imposto', migrateImposto],
    ['TipoInspecao', migrateTipoInspecao],
    ['TipoAuditoria', migrateTipoAuditoria],
    ['TipoKPI', migrateTipoKPI],
    ['TipoDocumento', migrateTipoDocumento],
    ['RegraNotificacao', migrateRegraNotificacao],
    ['GrupoWhatsApp', migrateGrupoWhatsApp],
  ];

  for (const [name, fn] of phase1) {
    process.stdout.write(`[${name}] `);
    try {
      const count = await fn();
      console.log(`OK (${count} records)`);
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
    }
  }

  // Phase 2: Dependent on phase 1 IDs
  console.log('\nPhase 2: Dependent reference data...');

  const phase2 = [
    ['ItemChecklist', migrateItemChecklist],
    ['ItemAuditoria', migrateItemAuditoria],
    ['CampoKPI', migrateCampoKPI],
    ['RegistoAeronave', migrateRegistoAeronave],
  ];

  for (const [name, fn] of phase2) {
    process.stdout.write(`[${name}] `);
    try {
      const count = await fn();
      console.log(`OK (${count} records)`);
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
    }
  }

  // Phase 3: Operational data (depends on phase 1+2 IDs)
  console.log('\nPhase 3: Operational data...');

  const phase3 = [
    ['Voo', migrateVoo],
    ['VooLigado', migrateVooLigado],
    ['CalculoTarifa', migrateCalculoTarifa],
    ['Proforma', migrateProforma],
    ['Inspecao', migrateInspecao],
    ['RespostaInspecao', migrateRespostaInspecao],
    ['ProcessoAuditoria', migrateProcessoAuditoria],
    ['RespostaAuditoria', migrateRespostaAuditoria],
    ['Credenciamento', migrateCredenciamento],
    ['Documento', migrateDocumento],
    ['OrdemServico', migrateOrdemServico],
    ['RegistoGRF', migrateRegistoGRF],
    ['SolicitacaoAcesso', migrateSolicitacaoAcesso],
    ['OcorrenciaSafety', migrateOcorrenciaSafety],
    ['Reclamacao', migrateReclamacao],
    ['MedicaoKPI', migrateMedicaoKPI],
    ['MovimentoFinanceiro', migrateMovimentoFinanceiro],
    ['PlanoAcaoCorretiva', migratePlanoAcaoCorretiva],
    ['LogAuditoria', migrateLogAuditoria],
  ];

  for (const [name, fn] of phase3) {
    process.stdout.write(`[${name}] `);
    try {
      const count = await fn();
      console.log(`OK (${count} records)`);
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
    }
  }

  console.log(`\nTotal ID mappings: ${Object.keys(idMap).length}`);
  console.log('\n=== Migration complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
