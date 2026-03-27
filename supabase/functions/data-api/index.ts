import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://app.marciosager.com",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Allowed entities → real table names + columns to exclude from response
const ALLOWED_ENTITIES: Record<string, { table: string; excludeColumns: string[] }> = {
  voo:                  { table: "voo",                   excludeColumns: ["created_by", "updated_by"] },
  ordem_servico:        { table: "ordem_servico",         excludeColumns: ["created_by", "updated_by"] },
  solicitacao_servico:  { table: "solicitacao_servico",    excludeColumns: ["created_by", "updated_by"] },
  inspecao:             { table: "inspecao",               excludeColumns: ["created_by", "updated_by"] },
  proforma:             { table: "proforma",               excludeColumns: ["created_by", "updated_by"] },
  proforma_item:        { table: "proforma_item",          excludeColumns: [] },
  ocorrencia_safety:    { table: "ocorrencia_safety",      excludeColumns: ["created_by", "updated_by"] },
  aeroporto:            { table: "aeroporto",              excludeColumns: [] },
  medicao_kpi:          { table: "medicao_k_p_i",          excludeColumns: [] },
  movimento_financeiro: { table: "movimento_financeiro",   excludeColumns: ["created_by", "updated_by"] },
  calculo_tarifa:       { table: "calculo_tarifa",         excludeColumns: [] },
  credenciamento:       { table: "credenciamento",         excludeColumns: ["created_by", "updated_by"] },
  reclamacao:           { table: "reclamacao",              excludeColumns: ["created_by", "updated_by"] },
  tipo_inspecao:        { table: "tipo_inspecao",           excludeColumns: [] },
  auditoria:            { table: "auditoria",              excludeColumns: ["created_by", "updated_by"] },
  item_checklist:       { table: "item_checklist",         excludeColumns: [] },
  servico_aeroportuario:{ table: "servico_aeroportuario",  excludeColumns: [] },
  cliente:              { table: "cliente",                excludeColumns: [] },
  companhia_aerea:      { table: "companhia_aerea",        excludeColumns: [] },
  modelo_aeronave:      { table: "modelo_aeronave",        excludeColumns: [] },
  registo_aeronave:     { table: "registo_aeronave",       excludeColumns: [] },
  tarifa_pouso:         { table: "tarifa_pouso",           excludeColumns: [] },
  tarifa_permanencia:   { table: "tarifa_permanencia",     excludeColumns: [] },
  outra_tarifa:         { table: "outra_tarifa",           excludeColumns: [] },
  tarifa_recurso:       { table: "tarifa_recurso",         excludeColumns: [] },
  tipo_auditoria:       { table: "tipo_auditoria",         excludeColumns: [] },
  processo_auditoria:   { table: "processo_auditoria",     excludeColumns: ["created_by", "updated_by"] },
  plano_acao_corretiva: { table: "plano_acao_corretiva",   excludeColumns: [] },
};

// Tables that use empresa_id directly
const EMPRESA_FILTERED_TABLES = new Set([
  "ordem_servico", "solicitacao_servico", "inspecao", "proforma",
  "movimento_financeiro", "aeroporto", "tipo_inspecao", "auditoria",
  "credenciamento", "voo", "cliente", "servico_aeroportuario",
  "tarifa_pouso", "tarifa_permanencia", "outra_tarifa", "tarifa_recurso",
  "tipo_auditoria", "processo_auditoria",
]);

// Tables that don't have empresa_id (filter via join or skip)
const NO_EMPRESA_FILTER = new Set([
  "proforma_item", "calculo_tarifa", "item_checklist", "medicao_k_p_i",
  "companhia_aerea", "modelo_aeronave", "registo_aeronave", "plano_acao_corretiva",
]);

const MAX_ROWS = 10000;

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Apply filter operators similar to _createEntity.js
function applyFilters(query: any, filters: Record<string, any>) {
  for (const [field, condition] of Object.entries(filters)) {
    if (condition === null || condition === undefined) continue;

    if (typeof condition === "object" && !Array.isArray(condition)) {
      for (const [op, val] of Object.entries(condition)) {
        switch (op) {
          case "$eq":       query = query.eq(field, val); break;
          case "$ne":       query = query.neq(field, val); break;
          case "$gt":       query = query.gt(field, val); break;
          case "$gte":      query = query.gte(field, val); break;
          case "$lt":       query = query.lt(field, val); break;
          case "$lte":      query = query.lte(field, val); break;
          case "$in":       query = query.in(field, val as any[]); break;
          case "$like":     query = query.ilike(field, val as string); break;
          case "$contains": query = query.contains(field, val); break;
          case "$is":       query = query.is(field, val); break;
        }
      }
    } else {
      query = query.eq(field, condition);
    }
  }
  return query;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const requestStart = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "DIROPS Data API. Use POST with JSON body to query data.", version: "1.0" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let keyRecord: any = null;
  let responseStatus = 500;
  let rowsReturned = 0;
  let errorMsg: string | null = null;
  let entityName = "unknown";

  try {
    // 1. Extract and validate API key
    const authHeader = req.headers.get("authorization") || "";
    const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!apiKey) {
      responseStatus = 401;
      errorMsg = "API key não fornecida. Use header Authorization: Bearer <api_key>";
      throw new Error(errorMsg);
    }

    // 2. Hash and lookup
    const keyHash = await hashKey(apiKey);

    const { data: keyData, error: keyError } = await supabase
      .from("api_key")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .is("revoked_at", null)
      .single();

    if (keyError || !keyData) {
      responseStatus = 401;
      errorMsg = "API key inválida ou revogada.";
      throw new Error(errorMsg);
    }

    keyRecord = keyData;

    // 3. Check expiration
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      responseStatus = 401;
      errorMsg = "API key expirada.";
      throw new Error(errorMsg);
    }

    // 4. Check IP allowlist
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (keyRecord.allowed_ips && keyRecord.allowed_ips.length > 0) {
      if (!keyRecord.allowed_ips.includes(clientIp)) {
        responseStatus = 403;
        errorMsg = `IP ${clientIp} não autorizado para esta API key.`;
        throw new Error(errorMsg);
      }
    }

    // 5. Rate limiting (DB-backed)
    const windowStart = new Date();
    windowStart.setSeconds(0, 0);

    const { data: allowed } = await supabase.rpc("check_and_increment_rate_limit", {
      p_key_hash: keyHash,
      p_window_start: windowStart.toISOString(),
      p_max_requests: keyRecord.rate_limit_per_minute,
    });

    if (!allowed) {
      responseStatus = 429;
      errorMsg = "Limite de requisições excedido. Tente novamente em 1 minuto.";
      return new Response(
        JSON.stringify({ error: errorMsg }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(keyRecord.rate_limit_per_minute),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil((windowStart.getTime() + 60000) / 1000)),
          },
        }
      );
    }

    // 6. Parse request body
    const body = await req.json();
    entityName = body.entity || "unknown";
    const filters = body.filters || {};
    const orderBy = body.order_by || "-created_date";
    const limit = Math.min(parseInt(body.limit) || 1000, MAX_ROWS);
    const offset = parseInt(body.offset) || 0;
    const fields = body.fields || null; // null = all allowed fields

    // 7a. Special endpoint: extrato (consolidated billing extract)
    if (entityName === "extrato") {
      // CRITICAL: always filter by empresa_id from API key (server-side in SQL)
      const rpcParams: Record<string, any> = {
        p_empresa_id: keyRecord.empresa_id,
      };
      if (filters.aeroporto_id) rpcParams.p_aeroporto_id = filters.aeroporto_id;
      if (filters.companhia_id) rpcParams.p_companhia_id = filters.companhia_id;
      if (filters.data_inicio) rpcParams.p_data_inicio = filters.data_inicio;
      if (filters.data_fim) rpcParams.p_data_fim = filters.data_fim;

      // Get calculos via RPC (filtered by empresa_id + data_operacao + complete ARR+DEP)
      const { data: calculos, error: rpcError } = await supabase
        .rpc("get_calculos_por_periodo", rpcParams)
        .limit(limit);

      if (rpcError) {
        responseStatus = 500;
        errorMsg = `Erro no extrato: ${rpcError.message}`;
        throw new Error(errorMsg);
      }

      const empresaCalcs = calculos || [];

      // Get voo + voo_ligado data for each calculo
      const vooIds = [...new Set(empresaCalcs.map((c: any) => c.voo_id).filter(Boolean))];
      const vlIds = [...new Set(empresaCalcs.map((c: any) => c.voo_ligado_id).filter(Boolean))];

      const [voosRes, vlRes, compRes] = await Promise.all([
        vooIds.length > 0
          ? supabase.from("voo").select("id,numero_voo,data_operacao,horario_real,horario_previsto,tipo_movimento,aeroporto_operacao,aeroporto_origem_destino,registo_aeronave,companhia_aerea,passageiros_local,passageiros_transito_transbordo,carga_kg,tipo_voo").in("id", vooIds)
          : { data: [] },
        vlIds.length > 0
          ? supabase.from("voo_ligado").select("id,id_voo_arr,id_voo_dep,tempo_permanencia_min").in("id", vlIds)
          : { data: [] },
        supabase.from("companhia_aerea").select("id,nome,codigo_icao,codigo_iata"),
      ]);

      const vooMap = new Map((voosRes.data || []).map((v: any) => [v.id, v]));
      const vlMap = new Map((vlRes.data || []).map((vl: any) => [vl.id, vl]));
      const compMap = new Map((compRes.data || []).map((c: any) => [c.id, c]));

      // Build enriched extrato rows
      const extratoRows = empresaCalcs.map((calc: any) => {
        const vl = vlMap.get(calc.voo_ligado_id);
        const vooArr = vl ? vooMap.get(vl.id_voo_arr) : null;
        const vooDep = vl ? vooMap.get(vl.id_voo_dep) : null;
        const comp = compMap.get(calc.companhia_id);
        const det = calc.detalhes_calculo || {};

        return {
          numero_voo_arr: vooArr?.numero_voo || null,
          numero_voo_dep: vooDep?.numero_voo || null,
          data_arr: vooArr?.data_operacao || null,
          data_dep: vooDep?.data_operacao || null,
          horario_arr: vooArr?.horario_real || vooArr?.horario_previsto || null,
          horario_dep: vooDep?.horario_real || vooDep?.horario_previsto || null,
          registo: vooArr?.registo_aeronave || vooDep?.registo_aeronave || null,
          companhia_icao: comp?.codigo_icao || vooDep?.companhia_aerea || null,
          companhia_nome: comp?.nome || null,
          tipo_operacao: det.pouso?.tipoVoo || null,
          tipo_voo: vooDep?.tipo_voo || null,
          aeroporto_operacao: vooArr?.aeroporto_operacao || null,
          origem: vooArr?.aeroporto_origem_destino || null,
          destino: vooDep?.aeroporto_origem_destino || null,
          mtow_kg: calc.mtow_kg,
          tempo_permanencia_horas: calc.tempo_permanencia_horas,
          passageiros: vooDep?.passageiros_local || 0,
          carga_kg: vooDep?.carga_kg || 0,
          tarifa_pouso_usd: calc.tarifa_pouso_usd,
          tarifa_permanencia_usd: calc.tarifa_permanencia_usd,
          tarifa_passageiros_usd: calc.tarifa_passageiros_usd,
          tarifa_carga_usd: calc.tarifa_carga_usd,
          outras_tarifas_usd: calc.outras_tarifas_usd,
          tarifa_recursos_usd: calc.tarifa_recursos_usd,
          total_tarifa_usd: calc.total_tarifa_usd,
          total_tarifa_aoa: calc.total_tarifa,
          taxa_cambio: calc.taxa_cambio_usd_aoa,
          periodo_noturno: calc.periodo_noturno,
        };
      });

      rowsReturned = extratoRows.length;
      responseStatus = 200;

      // Log access
      supabase.from("api_key").update({ last_used_at: new Date().toISOString() })
        .eq("id", keyRecord.id).then(() => {}).catch(() => {});

      const elapsed = Date.now() - requestStart;
      supabase.from("api_access_log").insert({
        api_key_id: keyRecord.id,
        entity: "extrato",
        filters_used: filters,
        rows_returned: rowsReturned,
        response_status: responseStatus,
        response_time_ms: elapsed,
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
      }).then(() => {}).catch(() => {});

      return new Response(
        JSON.stringify({
          data: extratoRows,
          meta: { total: extratoRows.length, limit, offset: 0, entity: "extrato" },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Validate entity
    const entityConfig = ALLOWED_ENTITIES[entityName];
    if (!entityConfig) {
      responseStatus = 400;
      errorMsg = `Entidade '${entityName}' não disponível. Entidades permitidas: ${Object.keys(ALLOWED_ENTITIES).join(", ")}, extrato`;
      throw new Error(errorMsg);
    }

    // 8. Check scopes
    if (keyRecord.scopes.length > 0 && !keyRecord.scopes.includes(entityName)) {
      responseStatus = 403;
      errorMsg = `API key não tem permissão para aceder a '${entityName}'. Scopes: ${keyRecord.scopes.join(", ")}`;
      throw new Error(errorMsg);
    }

    // 9. Build query - ALWAYS inject empresa_id from key record
    const tableName = entityConfig.table;
    let selectFields = "*";
    if (fields && Array.isArray(fields) && fields.length > 0) {
      // Remove excluded columns from requested fields
      const safeFields = fields.filter((f: string) => !entityConfig.excludeColumns.includes(f));
      selectFields = safeFields.join(",");
    }

    let query = supabase.from(tableName).select(selectFields, { count: "exact" });

    // CRITICAL: Always filter by empresa_id from the verified key
    if (EMPRESA_FILTERED_TABLES.has(tableName)) {
      query = query.eq("empresa_id", keyRecord.empresa_id);
    } else if (!NO_EMPRESA_FILTER.has(tableName)) {
      // For tables not in either set, try empresa_id anyway (safe: will just return empty if column doesn't exist)
      query = query.eq("empresa_id", keyRecord.empresa_id);
    }

    // Apply user filters (CANNOT override empresa_id — already set above)
    // Remove empresa_id from user filters to prevent tampering
    delete filters.empresa_id;
    delete filters.created_by;
    delete filters.updated_by;
    query = applyFilters(query, filters);

    // Order
    const desc = orderBy.startsWith("-");
    const orderField = desc ? orderBy.slice(1) : orderBy;
    query = query.order(orderField, { ascending: !desc });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    // 10. Execute
    const { data, count, error: queryError } = await query;

    if (queryError) {
      responseStatus = 500;
      errorMsg = `Erro ao consultar dados: ${queryError.message}`;
      throw new Error(errorMsg);
    }

    // 11. Remove excluded columns from response
    let cleanData = data || [];
    if (entityConfig.excludeColumns.length > 0 && !fields) {
      cleanData = cleanData.map((row: any) => {
        const clean = { ...row };
        for (const col of entityConfig.excludeColumns) {
          delete clean[col];
        }
        return clean;
      });
    }

    rowsReturned = cleanData.length;
    responseStatus = 200;

    // Update last_used_at
    supabase.from("api_key").update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id).then(() => {}).catch(() => {});

    const response = {
      data: cleanData,
      meta: {
        total: count,
        limit,
        offset,
        returned: rowsReturned,
        entity: entityName,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(keyRecord.rate_limit_per_minute),
      },
    });

  } catch (error) {
    const status = responseStatus !== 500 ? responseStatus : 500;
    errorMsg = errorMsg || error.message;

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    // Audit log (fire-and-forget)
    try {
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      supabase.from("api_access_log").insert({
        api_key_id: keyRecord?.id || null,
        empresa_id: keyRecord?.empresa_id || null,
        endpoint: entityName,
        method: req.method,
        ip_address: clientIp,
        user_agent: userAgent,
        status_code: responseStatus,
        response_time_ms: Date.now() - requestStart,
        rows_returned: rowsReturned,
        error_message: errorMsg,
      }).then(() => {}).catch(console.error);
    } catch (_) {
      // Audit log should never break the response
    }

    // Cleanup old rate limits periodically (1% chance per request)
    if (Math.random() < 0.01) {
      supabase.rpc("cleanup_api_rate_limits").then(() => {}).catch(() => {});
    }
  }
});
