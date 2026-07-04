import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { RefreshCw, Users, Plane, Activity, AlertCircle, Globe, Database, ShieldCheck } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function MetricCard({ icon: Icon, label, value, sub, color = "blue" }) {
  const colorMap = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    orange: "text-orange-500",
    red: "text-red-500",
    purple: "text-purple-600 dark:text-purple-400",
  };
  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-white dark:bg-slate-800 shrink-0 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function ServiceCard({ icon: Icon, label, up }) {
  const ok = up === true;
  const unknown = up == null;
  const tone = ok ? "text-green-600 dark:text-green-400" : unknown ? "text-slate-400" : "text-red-500";
  const dot = ok ? "bg-green-500" : unknown ? "bg-slate-300" : "bg-red-500";
  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-white dark:bg-slate-800 shrink-0 ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className={`text-sm font-bold flex items-center gap-1.5 ${tone}`}>
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} />
          {unknown ? '—' : ok ? 'Operacional' : 'Fora do ar'}
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{children}</p>
  );
}

export default function MonitoramentoSuperAdmin() {
  const [app, setApp] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Métricas reais da aplicação (utilizadores, voos hoje) — a função on-premise
    // conta direto no PostgREST. (Mantém o nome 'cloudflare-metrics' do servidor.)
    const metricsPromise = (async () => {
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Métricas indisponíveis (timeout)')), 5000)
        );
        const result = await Promise.race([supabase.functions.invoke('cloudflare-metrics'), timeout]);
        if (result?.error) throw new Error(result.error.message || 'Métricas indisponíveis');
        setApp(result?.data?.app || null);
      } catch (err) {
        setError(err.message);
        setApp(null);
      }
    })();

    // Saúde dos serviços on-premise (ping direto, com teto de 4s).
    const healthPromise = (async () => {
      const ping = async (url, opts) => {
        try {
          const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(4000) });
          return r.ok;
        } catch { return false; }
      };
      const [api, auth] = await Promise.all([
        ping(`${SUPABASE_URL}/rest/v1/aeroporto?limit=1`, { method: 'HEAD', headers: { apikey: SUPABASE_ANON_KEY } }),
        ping(`${SUPABASE_URL}/auth/v1/health`, { method: 'GET' }),
      ]);
      // nginx serve esta própria página — se a está a ver, o web server está de pé.
      setHealth({ web: true, api, auth });
    })();

    await Promise.all([metricsPromise, healthPromise]);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const fmt = (n) => n?.toLocaleString('pt-PT') ?? '—';

  return (
    <Card className="mb-6 border-blue-100 dark:border-blue-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Monitoramento do Sistema
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-xs text-slate-400">
                {lastUpdate.toLocaleTimeString('pt-PT')}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && !health && !app ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">

            {/* Saúde dos serviços on-premise */}
            <div>
              <SectionLabel>Serviços (on-premise)</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ServiceCard icon={Globe} label="Web (nginx)" up={health?.web} />
                <ServiceCard icon={Database} label="API / Base de Dados (PostgREST)" up={health?.api} />
                <ServiceCard icon={ShieldCheck} label="Autenticação (GoTrue)" up={health?.auth} />
              </div>
            </div>

            {/* Métricas reais da aplicação */}
            <div>
              <SectionLabel>Aplicação</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={Users} label="Utilizadores" value={fmt(app?.totalUsers)} color="green" />
                <MetricCard icon={Plane} label="Voos hoje" value={fmt(app?.voosHoje)} color="blue" />
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
