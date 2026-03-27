import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ['https://app.marciosager.com', 'http://localhost:5173'];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const SYNC_SECRET = "1ba42f030a284ec390f8a9944b6e1e0b"; // Base44 API key as auth token
const SGA_EMPRESA_ID = "128bc692-3fae-4825-9c55-40565dbedcfb";

// Base44 entity → Supabase table
const TABLE_MAP: Record<string, string> = {
  Voo: "voo",
  VooLigado: "voo_ligado",
  CalculoTarifa: "calculo_tarifa",
  MedicaoKPI: "medicao_k_p_i",
  TipoKPI: "tipo_k_p_i",
  CampoKPI: "campo_k_p_i",
  ValorCampoKPI: "valor_campo_k_p_i",
};

// Fields to remove (Base44 internal)
const REMOVE_FIELDS = ["__v", "_id", "app_id", "entity_type", "row_id", "created_by_id", "is_sample"];

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function cleanRecord(record: Record<string, unknown>, table: string) {
  const cleaned = { ...record };

  // Remove internal fields
  for (const f of REMOVE_FIELDS) delete cleaned[f];

  // Preserve base44 id, let Supabase generate UUID
  if (cleaned.id && typeof cleaned.id === "string" && !isUUID(cleaned.id)) {
    cleaned.base44_id = cleaned.id;
    delete cleaned.id;
  }

  // Map empresa_id
  if (cleaned.empresa_id && typeof cleaned.empresa_id === "string" && !isUUID(cleaned.empresa_id)) {
    cleaned.empresa_id = SGA_EMPRESA_ID;
  }
  if (!cleaned.empresa_id) {
    cleaned.empresa_id = SGA_EMPRESA_ID;
  }

  // For VooLigado: remap voo references
  // Note: id_voo_arr and id_voo_dep are Base44 ObjectIds — we need to look them up
  // For now, store them and handle mapping

  cleaned.updated_by = "sync_base44";

  return cleaned;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== SYNC_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { entity, action, record } = body;

    if (!entity || !record) {
      return new Response(JSON.stringify({ error: "Missing entity or record" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const table = TABLE_MAP[entity];
    if (!table) {
      return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const cleaned = cleanRecord(record, table);
    const base44Id = record.id;

    if (action === "created") {
      // For Voo: check if already exists by natural key
      if (table === "voo") {
        const { data: existing } = await supabase
          .from("voo")
          .select("id")
          .eq("numero_voo", record.numero_voo)
          .eq("data_operacao", record.data_operacao)
          .eq("tipo_movimento", record.tipo_movimento)
          .eq("aeroporto_operacao", record.aeroporto_operacao)
          .eq("empresa_id", SGA_EMPRESA_ID)
          .limit(1);

        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ status: "skipped", reason: "already exists", id: existing[0].id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Remove voo_ligado_id (Base44 ObjectId, not UUID)
        delete cleaned.voo_ligado_id;
      }

      if (table === "voo_ligado") {
        // Remap id_voo_arr and id_voo_dep from Base44 ObjectIds to Supabase UUIDs
        if (cleaned.id_voo_arr && !isUUID(String(cleaned.id_voo_arr))) {
          const { data: arrVoo } = await supabase.from("voo").select("id").eq("base44_id", String(cleaned.id_voo_arr)).limit(1);
          const { data: depVoo } = await supabase.from("voo").select("id").eq("base44_id", String(cleaned.id_voo_dep)).limit(1);
          if (arrVoo?.[0] && depVoo?.[0]) {
            cleaned.id_voo_arr = arrVoo[0].id;
            cleaned.id_voo_dep = depVoo[0].id;
          } else {
            return new Response(JSON.stringify({ status: "skipped", reason: "voo references not found in supabase" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      if (table === "calculo_tarifa") {
        // Remap voo_id from Base44 ObjectId to Supabase UUID
        if (cleaned.voo_id && !isUUID(String(cleaned.voo_id))) {
          const { data: voo } = await supabase.from("voo").select("id").eq("base44_id", String(cleaned.voo_id)).limit(1);
          if (voo?.[0]) {
            cleaned.voo_id = voo[0].id;
          } else {
            delete cleaned.voo_id;
          }
        }
        if (cleaned.voo_ligado_id && !isUUID(String(cleaned.voo_ligado_id))) {
          const { data: vl } = await supabase.from("voo_ligado").select("id").eq("base44_id", String(cleaned.voo_ligado_id)).limit(1);
          if (vl?.[0]) {
            cleaned.voo_ligado_id = vl[0].id;
          } else {
            delete cleaned.voo_ligado_id;
          }
        }
        if (cleaned.aeroporto_id && !isUUID(String(cleaned.aeroporto_id))) {
          delete cleaned.aeroporto_id;
        }
      }

      const { data, error } = await supabase.from(table).insert(cleaned).select("id");

      if (error) {
        console.error(`Insert error [${table}]:`, error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "inserted", id: data?.[0]?.id, base44_id: base44Id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "updated") {
      // Find existing record by natural key (Voo) or skip
      if (table === "voo") {
        const { data: existing } = await supabase
          .from("voo")
          .select("id")
          .eq("numero_voo", record.numero_voo)
          .eq("data_operacao", record.data_operacao)
          .eq("tipo_movimento", record.tipo_movimento)
          .eq("aeroporto_operacao", record.aeroporto_operacao)
          .eq("empresa_id", SGA_EMPRESA_ID)
          .limit(1);

        if (!existing || existing.length === 0) {
          // Not found — insert instead
          delete cleaned.voo_ligado_id;
          const { data, error } = await supabase.from(table).insert(cleaned).select("id");
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ status: "inserted_on_update", id: data?.[0]?.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update existing
        delete cleaned.voo_ligado_id;
        const { error } = await supabase.from(table).update(cleaned).eq("id", existing[0].id);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ status: "updated", id: existing[0].id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For other tables with base44_id lookup
      if (record.id) {
        const { data: found } = await supabase.from(table).select("id").eq("base44_id", record.id).limit(1);
        if (found?.[0]) {
          const { error } = await supabase.from(table).update(cleaned).eq("id", found[0].id);
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ status: "updated", id: found[0].id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ status: "skipped", reason: "record not found for update on " + table }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "deleted") {
      // Soft-delete: set deleted_at timestamp
      const base44Id = record.id;
      if (!base44Id) {
        return new Response(JSON.stringify({ status: "skipped", reason: "no id in deleted record" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find by base44_id
      const { data: found } = await supabase.from(table).select("id").eq("base44_id", base44Id).limit(1);

      if (!found?.[0]) {
        // Try natural key for Voo
        if (table === "voo" && record.numero_voo) {
          const { data: byKey } = await supabase
            .from("voo").select("id")
            .eq("numero_voo", record.numero_voo)
            .eq("data_operacao", record.data_operacao)
            .eq("tipo_movimento", record.tipo_movimento)
            .eq("aeroporto_operacao", record.aeroporto_operacao)
            .eq("empresa_id", SGA_EMPRESA_ID)
            .limit(1);
          if (byKey?.[0]) {
            const { error } = await supabase.from("voo").update({
              deleted_at: new Date().toISOString(),
              deleted_by: "sync_base44",
            }).eq("id", byKey[0].id);
            if (error) {
              return new Response(JSON.stringify({ error: error.message }), {
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ status: "soft_deleted", id: byKey[0].id }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        return new Response(JSON.stringify({ status: "skipped", reason: "record not found for delete" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Soft-delete
      const updateData: Record<string, unknown> = {
        deleted_at: new Date().toISOString(),
        updated_by: "sync_base44",
      };
      if (table === "voo") updateData.deleted_by = "sync_base44";

      const { error } = await supabase.from(table).update(updateData).eq("id", found[0].id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "soft_deleted", id: found[0].id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "ignored", action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("base44-sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
