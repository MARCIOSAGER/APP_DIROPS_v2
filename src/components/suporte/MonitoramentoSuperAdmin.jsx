import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { RefreshCw, Server, Users, Plane, Activity, AlertCircle, Zap, CheckCircle } from 'lucide-react';

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

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{children}</p>
  );
}

export default function MonitoramentoSuperAdmin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudflare-metrics`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setData(await res.json());
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const fmt = (n) => n?.toLocaleString('pt-PT') ?? '—';

  const errorRate = (errors, requests) => {
    if (!requests) return '0%';
    return ((errors / requests) * 100).toFixed(1) + '%';
  };

  const w = data?.cloudflare?.worker;
  const app = data?.app;
  const hasErrors = (w?.today?.errors ?? 0) > 0;

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
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-5">

            {/* Cloudflare Worker */}
            <div>
              <SectionLabel>Cloudflare Worker — Proxy REST API</SectionLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={Zap}
                  label="Requests hoje"
                  value={fmt(w?.today?.requests)}
                  color="blue"
                />
                <MetricCard
                  icon={Zap}
                  label="Requests 7 dias"
                  value={fmt(w?.week?.requests)}
                  color="blue"
                />
                <MetricCard
                  icon={hasErrors ? AlertCircle : CheckCircle}
                  label="Erros hoje"
                  value={fmt(w?.today?.errors)}
                  sub={errorRate(w?.today?.errors, w?.today?.requests)}
                  color={hasErrors ? "red" : "green"}
                />
                <MetricCard
                  icon={Server}
                  label="Sub-requests hoje"
                  value={fmt(w?.today?.subrequests)}
                  color="purple"
                />
              </div>
            </div>

            {/* App */}
            <div>
              <SectionLabel>Aplicação</SectionLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={Users}
                  label="Utilizadores"
                  value={fmt(app?.totalUsers)}
                  color="green"
                />
                <MetricCard
                  icon={Plane}
                  label="Voos hoje"
                  value={fmt(app?.voosHoje)}
                  color="blue"
                />
                <MetricCard
                  icon={Activity}
                  label="Chamadas API hoje"
                  value={fmt(app?.apiCallsHoje)}
                  color="purple"
                />
                <MetricCard
                  icon={Activity}
                  label="Chamadas API 7 dias"
                  value={fmt(app?.apiCalls7d)}
                  color="purple"
                />
              </div>
            </div>

            {/* Limite free tier */}
            {w?.today?.requests !== undefined && (
              <div className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                Workers free tier: {fmt(w.today.requests)} / 100.000 requests hoje
                {w.today.requests > 80000 && (
                  <span className="ml-2 text-orange-500 font-semibold">⚠ Próximo do limite diário</span>
                )}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
