import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { airportIcao, startDate, endDate } = await req.json();

    if (!airportIcao || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "airportIcao, startDate e endDate são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get FR24 API key from api_config table
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: configData } = await supabase
      .from("api_config")
      .select("valor")
      .eq("chave", "FR24_API_KEY")
      .single();

    const apiKey = configData?.valor;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "FR24 API Key não configurada na tabela api_config" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Split into 6h blocks
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T23:59:59Z");
    const blocks: { from: string; to: string }[] = [];

    let current = new Date(start);
    while (current < end) {
      const blockEnd = new Date(current.getTime() + 6 * 60 * 60 * 1000 - 1000);
      const actualEnd = blockEnd > end ? end : blockEnd;
      blocks.push({
        from: current.toISOString().replace(".000Z", "Z"),
        to: actualEnd.toISOString().replace(".000Z", "Z"),
      });
      current = new Date(current.getTime() + 6 * 60 * 60 * 1000);
    }

    const allFlights: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const url = `https://fr24api.flightradar24.com/api/flight-summary/light?airports=${airportIcao}&flight_datetime_from=${blocks[i].from}&flight_datetime_to=${blocks[i].to}&limit=20`;

      try {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "Accept-Version": "v1",
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (response.status === 429) {
          // Rate limited - wait 60s and retry
          await new Promise((r) => setTimeout(r, 60000));
          const retry = await fetch(url, {
            headers: {
              Accept: "application/json",
              "Accept-Version": "v1",
              Authorization: `Bearer ${apiKey}`,
            },
          });
          if (retry.ok) {
            const data = await retry.json();
            if (data.data) allFlights.push(...data.data);
          }
        } else if (response.status === 402) {
          errors.push("Créditos FR24 esgotados");
          break;
        } else if (response.ok) {
          const data = await response.json();
          if (data.data) allFlights.push(...data.data);
        } else {
          const errText = await response.text();
          errors.push(`Bloco ${i + 1}: ${response.status} ${errText.substring(0, 100)}`);
        }
      } catch (e: any) {
        errors.push(`Bloco ${i + 1}: ${e.message}`);
      }

      // Rate limit: wait 7s between calls
      if (i < blocks.length - 1) {
        await new Promise((r) => setTimeout(r, 7000));
      }
    }

    // Deduplicate by fr24_id
    const seen = new Set<string>();
    const unique = allFlights.filter((f) => {
      if (seen.has(f.fr24_id)) return false;
      seen.add(f.fr24_id);
      return true;
    });

    // Optionally save to cache
    if (unique.length > 0) {
      const records = unique.map((f: any) => ({
        data_voo: (f.datetime_landed || f.datetime_takeoff || "").substring(0, 10) || startDate,
        numero_voo: f.flight || "",
        fr24_id: f.fr24_id,
        airport_icao: airportIcao,
        status: "pendente",
        raw_data: f,
        data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      }));

      // Upsert in batches
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50);
        await supabase.from("cache_voo_f_r24").upsert(batch, { onConflict: "fr24_id", ignoreDuplicates: true });
      }

      // Update status for those already in voo table
      const { data: existingVoos } = await supabase
        .from("voo")
        .select("numero_voo, data_operacao")
        .is("deleted_at", null);

      if (existingVoos) {
        const vooSet = new Set(existingVoos.map((v: any) => `${v.numero_voo}_${v.data_operacao}`));
        const importedIds = unique
          .filter((f: any) => {
            const dv = (f.datetime_landed || f.datetime_takeoff || "").substring(0, 10);
            return vooSet.has(`${f.flight}_${dv}`);
          })
          .map((f: any) => f.fr24_id);

        if (importedIds.length > 0) {
          await supabase
            .from("cache_voo_f_r24")
            .update({ status: "importado" })
            .in("fr24_id", importedIds);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: unique.length,
        blocks: blocks.length,
        errors,
        flights: unique,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
