import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://app.marciosager.com",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
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

    // Verify user JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // Admin client for DB queries (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { aeroporto, periodo, empresaId } = body;

    const diasPeriodo = parseInt(periodo) || 30;
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasPeriodo);
    const dataInicioStr = dataInicio.toISOString().split("T")[0];
    const hoje = new Date().toISOString().split("T")[0];

    // Get empresa ICAO codes for filtering
    let empresaIcaos: string[] | null = null;
    let empresaAeroIds: string[] | null = null;
    if (empresaId) {
      const { data: aeros } = await supabase
        .from("aeroporto")
        .select("id, codigo_icao")
        .eq("empresa_id", empresaId);
      if (aeros) {
        empresaIcaos = aeros.map((a: any) => a.codigo_icao);
        empresaAeroIds = aeros.map((a: any) => a.id);
      }
    }

    // Build voo filter (count: 'exact' returns true row count in response header)
    let vooQuery = supabase
      .from("voo")
      .select("id,data_operacao,tipo_movimento,aeroporto_operacao,horario_previsto,horario_real,status,passageiros_total,carga_kg", { count: 'exact' })
      .gte("data_operacao", dataInicioStr)
      .is("deleted_at", null);

    if (aeroporto && aeroporto !== "todos") {
      vooQuery = vooQuery.eq("aeroporto_operacao", aeroporto);
    } else if (empresaIcaos && empresaIcaos.length > 0) {
      vooQuery = vooQuery.in("aeroporto_operacao", empresaIcaos);
    }

    // Run all queries in parallel (limit 10000 to avoid PostgREST 1000-row default cap)
    const [voosResult, voosLigadosResult, calculosResult, ocorrenciasResult, inspecoesResult] =
      await Promise.all([
        vooQuery.limit(10000),
        supabase.from("voo_ligado").select("id,id_voo_arr,id_voo_dep,tempo_permanencia_min,empresa_id").limit(10000),
        supabase.from("calculo_tarifa").select("voo_id,total_tarifa").limit(10000),
        supabase.from("ocorrencia_safety").select("id,status,aeroporto,empresa_id").limit(10000),
        supabase.from("inspecao").select("id,status,aeroporto_id,empresa_id").limit(10000),
      ]);

    const voos: any[] = voosResult.data || [];
    const totalVoosExact: number = voosResult.count ?? voos.length; // exact count from DB, not limited by .limit()
    const voosLigados: any[] = voosLigadosResult.data || [];
    const calculos: any[] = calculosResult.data || [];
    const ocorrencias: any[] = ocorrenciasResult.data || [];
    const inspecoes: any[] = inspecoesResult.data || [];

    // --- Compute stats ---
    const vooIds = new Set(voos.map((v: any) => v.id));

    // Basic counts (use exact count from DB header, not array length)
    const totalVoos = totalVoosExact;
    const voosHoje = voos.filter((v: any) => v.data_operacao === hoje);
    const chegadasHoje = voosHoje.filter((v: any) => v.tipo_movimento === "ARR").length;
    const partidasHoje = voosHoje.filter((v: any) => v.tipo_movimento === "DEP").length;

    // Punctuality
    const voosComHorarios = voos.filter(
      (v: any) => v.horario_previsto && v.horario_real && v.status === "Realizado"
    );
    let pontuais = 0;
    voosComHorarios.forEach((v: any) => {
      const [ph, pm] = v.horario_previsto.split(":").map(Number);
      const [rh, rm] = v.horario_real.split(":").map(Number);
      const diffMin = Math.abs(rh * 60 + rm - (ph * 60 + pm));
      if (diffMin <= 15) pontuais++;
    });
    const taxaPontualidade =
      voosComHorarios.length > 0 ? (pontuais / voosComHorarios.length) * 100 : 0;

    // Passengers
    const passageirosPeriodo = voos.reduce(
      (sum: number, v: any) => sum + (v.passageiros_total || 0), 0
    );

    // Safety & inspections filter
    let ocorrenciasFiltradas = ocorrencias;
    let inspecoesFiltradas = inspecoes;
    if (empresaId) {
      const icaoSet = new Set(empresaIcaos || []);
      const aeroIdSet = new Set(empresaAeroIds || []);
      ocorrenciasFiltradas = ocorrencias.filter(
        (o: any) => o.empresa_id === empresaId || icaoSet.has(o.aeroporto)
      );
      inspecoesFiltradas = inspecoes.filter(
        (i: any) => i.empresa_id === empresaId || aeroIdSet.has(i.aeroporto_id)
      );
    }
    const ocorrenciasAbertas = ocorrenciasFiltradas.filter(
      (o: any) => o.status && o.status !== "Fechada" && o.status !== "Resolvida"
    ).length;
    const inspecoesPendentes = inspecoesFiltradas.filter(
      (i: any) => i.status === "Pendente" || i.status === "Agendada"
    ).length;

    // Linked flights
    const voosLigadosFiltrados = empresaId
      ? voosLigados.filter(
          (vl: any) =>
            vl.empresa_id === empresaId ||
            vooIds.has(vl.id_voo_arr) ||
            vooIds.has(vl.id_voo_dep)
        )
      : voosLigados.filter(
          (vl: any) => vooIds.has(vl.id_voo_arr) || vooIds.has(vl.id_voo_dep)
        );
    const voosComLink = new Set<string>();
    voosLigadosFiltrados.forEach((vl: any) => {
      voosComLink.add(vl.id_voo_arr);
      voosComLink.add(vl.id_voo_dep);
    });
    const voosUnicosLigados = voosComLink.size;
    const voosSemLink = totalVoos - voosUnicosLigados;

    const temposValidos = voosLigadosFiltrados.filter(
      (vl: any) => vl.tempo_permanencia_min > 0
    );
    const tempoMedioPermanencia =
      temposValidos.length > 0
        ? temposValidos.reduce(
            (sum: number, vl: any) => sum + vl.tempo_permanencia_min, 0
          ) /
          temposValidos.length /
          60
        : 0;

    // Tariffs
    const calculosComVoo = calculos.filter((c: any) => vooIds.has(c.voo_id));
    const totalTarifas = calculosComVoo.reduce(
      (sum: number, c: any) => sum + (c.total_tarifa || 0), 0
    );
    const vooIdsComCalculo = new Set(calculosComVoo.map((c: any) => c.voo_id));
    const voosSemCalculo = voos.filter((v: any) => !vooIdsComCalculo.has(v.id)).length;
    const voosIsentos = calculosComVoo.filter((c: any) => (c.total_tarifa || 0) === 0).length;

    // Top 10 airports
    const statsPorAeroporto: Record<string, any> = {};
    voos.forEach((v: any) => {
      const icao = v.aeroporto_operacao;
      if (!icao) return;
      if (!statsPorAeroporto[icao]) {
        statsPorAeroporto[icao] = {
          codigo_icao: icao, codigo: icao, totalMovimentos: 0,
          movimentosArr: 0, movimentosDep: 0,
          passageiros: 0, passageirosArr: 0, passageirosDep: 0,
          carga: 0, cargaArr: 0, cargaDep: 0,
        };
      }
      const s = statsPorAeroporto[icao];
      s.totalMovimentos++;
      if (v.tipo_movimento === "ARR") {
        s.movimentosArr++; s.passageirosArr += v.passageiros_total || 0; s.cargaArr += v.carga_kg || 0;
      } else {
        s.movimentosDep++; s.passageirosDep += v.passageiros_total || 0; s.cargaDep += v.carga_kg || 0;
      }
      s.passageiros += v.passageiros_total || 0;
      s.carga += v.carga_kg || 0;
    });
    const top10Aeroportos = Object.values(statsPorAeroporto)
      .sort((a: any, b: any) => b.totalMovimentos - a.totalMovimentos)
      .slice(0, 10);

    // Previous period (double window for trend)
    const dataInicioDobro = new Date();
    dataInicioDobro.setDate(dataInicioDobro.getDate() - diasPeriodo * 2);
    const dataIniciodobroStr = dataInicioDobro.toISOString().split("T")[0];

    let voosDobroQuery = supabase
      .from("voo")
      .select("id,data_operacao,tipo_movimento,aeroporto_operacao,passageiros_total,horario_previsto,horario_real,status")
      .gte("data_operacao", dataIniciodobroStr)
      .is("deleted_at", null);

    if (aeroporto && aeroporto !== "todos") {
      voosDobroQuery = voosDobroQuery.eq("aeroporto_operacao", aeroporto);
    } else if (empresaIcaos && empresaIcaos.length > 0) {
      voosDobroQuery = voosDobroQuery.in("aeroporto_operacao", empresaIcaos);
    }

    const { data: voosDobro } = await voosDobroQuery.limit(10000);
    const vd = voosDobro || [];
    const vdIds = new Set(vd.map((v: any) => v.id));
    const voosLigadosDobro = voosLigados.filter(
      (vl: any) => vdIds.has(vl.id_voo_arr) || vdIds.has(vl.id_voo_dep)
    );
    const vdComLink = new Set<string>();
    voosLigadosDobro.forEach((vl: any) => { vdComLink.add(vl.id_voo_arr); vdComLink.add(vl.id_voo_dep); });
    const calculosDobro = calculos.filter((c: any) => vdIds.has(c.voo_id));
    const vdComHorarios = vd.filter(
      (v: any) => v.horario_previsto && v.horario_real && v.status === "Realizado"
    );
    let vdPontuais = 0;
    vdComHorarios.forEach((v: any) => {
      const [ph, pm] = v.horario_previsto.split(":").map(Number);
      const [rh, rm] = v.horario_real.split(":").map(Number);
      if (Math.abs(rh * 60 + rm - (ph * 60 + pm)) <= 15) vdPontuais++;
    });

    const previousData = {
      totalVoos: vd.length,
      taxaPontualidade: vdComHorarios.length > 0 ? (vdPontuais / vdComHorarios.length) * 100 : 0,
      passageirosPeriodo: vd.reduce((sum: number, v: any) => sum + (v.passageiros_total || 0), 0),
      voosUnicosLigados: vdComLink.size,
      totalTarifas: calculosDobro.reduce((sum: number, c: any) => sum + (c.total_tarifa || 0), 0),
    };

    return new Response(
      JSON.stringify({
        data: {
          totalVoos, chegadasHoje, partidasHoje, taxaPontualidade,
          ocorrenciasAbertas, inspecoesPendentes, passageirosPeriodo,
          voosUnicosLigados, voosSemLink, voosLigados: voosLigadosFiltrados.length,
          tempoMedioPermanencia, totalTarifas, voosSemCalculo, voosIsentos,
          top10Aeroportos,
        },
        previousData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
