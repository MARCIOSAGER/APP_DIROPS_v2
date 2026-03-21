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
    const { airportIcao, dateFrom, dateTo } = await req.json();

    if (!airportIcao || !dateFrom || !dateTo) {
      return new Response(
        JSON.stringify({ error: "airportIcao, dateFrom e dateTo são obrigatórios" }),
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
        JSON.stringify({ error: "FR24 API Key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single API call
    const url = `https://fr24api.flightradar24.com/api/flight-summary/light?airports=${airportIcao}&flight_datetime_from=${dateFrom}&flight_datetime_to=${dateTo}&limit=20`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Version": "v1",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `FR24 API ${response.status}: ${errText.substring(0, 200)}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const flights = data.data || [];

    // Save to cache
    if (flights.length > 0) {
      const records = flights.map((f: any) => ({
        data_voo: (f.datetime_landed || f.datetime_takeoff || "").substring(0, 10) || dateFrom.substring(0, 10),
        numero_voo: f.flight || "",
        fr24_id: f.fr24_id,
        airport_icao: airportIcao,
        status: "pendente",
        raw_data: f,
        data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      }));

      await supabase.from("cache_voo_f_r24").upsert(records, { onConflict: "fr24_id", ignoreDuplicates: true });
    }

    return new Response(
      JSON.stringify({ success: true, total: flights.length, flights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
