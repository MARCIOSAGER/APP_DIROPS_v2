import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
const CF_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")!;

const ALLOWED_ORIGINS = [
  "https://app.marciosager.com",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

async function fetchWorkerMetrics(days: number) {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const query = `{
    viewer {
      accounts(filter: {accountTag: "${CF_ACCOUNT_ID}"}) {
        workersInvocationsAdaptive(
          limit: 10000,
          filter: {
            scriptName: "supabase-proxy",
            datetime_geq: "${start.toISOString()}",
            datetime_leq: "${now.toISOString()}"
          }
        ) {
          sum { requests errors subrequests }
        }
      }
    }
  }`;

  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  const items = data?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];

  return items.reduce(
    (acc: { requests: number; errors: number; subrequests: number }, item: any) => ({
      requests: acc.requests + (item.sum?.requests || 0),
      errors: acc.errors + (item.sum?.errors || 0),
      subrequests: acc.subrequests + (item.sum?.subrequests || 0),
    }),
    { requests: 0, errors: 0, subrequests: 0 }
  );
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (profile?.role !== "superadmin") {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const week = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [worker24h, worker7d, usersResult, voosResult, apiHoje, api7d] =
      await Promise.all([
        fetchWorkerMetrics(1),
        fetchWorkerMetrics(7),
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase.from("voo").select("*", { count: "exact", head: true })
          .gte("data_voo", today.toISOString().split("T")[0]),
        supabase.from("api_access_log").select("*", { count: "exact", head: true })
          .gte("created_at", today.toISOString()),
        supabase.from("api_access_log").select("*", { count: "exact", head: true })
          .gte("created_at", week.toISOString()),
      ]);

    return new Response(
      JSON.stringify({
        cloudflare: {
          worker: { today: worker24h, week: worker7d },
        },
        app: {
          totalUsers: usersResult.count ?? 0,
          voosHoje: voosResult.count ?? 0,
          apiCallsHoje: apiHoje.count ?? 0,
          apiCalls7d: api7d.count ?? 0,
        },
        updatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
