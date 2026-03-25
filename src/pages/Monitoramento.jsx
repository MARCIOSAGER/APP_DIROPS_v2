import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import MonitoramentoSuperAdmin from '@/components/suporte/MonitoramentoSuperAdmin';
import { useI18n } from '@/components/lib/i18n';
import {
  Activity, RefreshCw, Gauge, Clock, BarChart2, Globe, Smartphone,
  Wifi, AlertCircle, CheckCircle, TrendingUp, TrendingDown
} from 'lucide-react';

// Rating helpers
const ratingColor = (r) => ({
  good: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  'needs-improvement': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  poor: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}[r] ?? 'bg-slate-100 text-slate-600');

const metricUnit = (name) => name === 'CLS' ? '' : 'ms';
const metricLabel = (name) => ({
  LCP: 'Largest Contentful Paint',
  CLS: 'Cumulative Layout Shift',
  FCP: 'First Contentful Paint',
  TTFB: 'Time to First Byte',
  INP: 'Interaction to Next Paint',
}[name] ?? name);

const thresholds = {
  LCP:  { good: 2500, poor: 4000 },
  FCP:  { good: 1800, poor: 3000 },
  TTFB: { good: 800,  poor: 1800 },
  INP:  { good: 200,  poor: 500  },
  CLS:  { good: 0.1,  poor: 0.25 },
};

function getRating(name, value) {
  const t = thresholds[name];
  if (!t) return null;
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

function MetricSummaryCard({ name, records }) {
  if (!records?.length) return null;
  const values = records.map(r => r.metric_value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const p75 = values.sort((a, b) => a - b)[Math.floor(values.length * 0.75)] ?? avg;
  const rating = getRating(name, p75);
  const unit = metricUnit(name);

  const goodCount = records.filter(r => r.rating === 'good').length;
  const goodPct = Math.round((goodCount / records.length) * 100);

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{metricLabel(name)}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {name === 'CLS' ? p75.toFixed(3) : Math.round(p75)}{unit}
            </p>
            <p className="text-xs text-slate-400">p75 · {records.length} amostras</p>
          </div>
          <Badge className={ratingColor(rating)}>
            {rating === 'good' ? 'Bom' : rating === 'needs-improvement' ? 'Médio' : 'Mau'}
          </Badge>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Bom</span>
            <span>{goodPct}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${goodPct >= 75 ? 'bg-green-500' : goodPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${goodPct}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PageTable({ records }) {
  const byPage = {};
  records.forEach(r => {
    if (!byPage[r.page_path]) byPage[r.page_path] = {};
    if (!byPage[r.page_path][r.metric_name]) byPage[r.page_path][r.metric_name] = [];
    byPage[r.page_path][r.metric_name].push(r.metric_value);
  });

  const pages = Object.entries(byPage)
    .map(([path, metrics]) => {
      const lcp = metrics.LCP;
      const ttfb = metrics.TTFB;
      const lcpP75 = lcp ? lcp.sort((a,b)=>a-b)[Math.floor(lcp.length*0.75)] : null;
      const ttfbP75 = ttfb ? ttfb.sort((a,b)=>a-b)[Math.floor(ttfb.length*0.75)] : null;
      return { path, lcpP75, ttfbP75, samples: Math.max(...Object.values(metrics).map(v => v.length)) };
    })
    .sort((a, b) => (b.lcpP75 ?? 0) - (a.lcpP75 ?? 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Página</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">LCP p75</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">TTFB p75</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Amostras</th>
          </tr>
        </thead>
        <tbody>
          {pages.map(({ path, lcpP75, ttfbP75, samples }) => (
            <tr key={path} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
              <td className="py-2 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">{path}</td>
              <td className="py-2 px-3 text-right">
                {lcpP75 != null ? (
                  <Badge className={`text-xs ${ratingColor(getRating('LCP', lcpP75))}`}>
                    {Math.round(lcpP75)}ms
                  </Badge>
                ) : '—'}
              </td>
              <td className="py-2 px-3 text-right">
                {ttfbP75 != null ? (
                  <Badge className={`text-xs ${ratingColor(getRating('TTFB', ttfbP75))}`}>
                    {Math.round(ttfbP75)}ms
                  </Badge>
                ) : '—'}
              </td>
              <td className="py-2 px-3 text-right text-slate-500 text-xs">{samples}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PERIODS = [
  { label: 'Últimas 24h', value: '1' },
  { label: 'Últimos 7 dias', value: '7' },
  { label: 'Últimos 30 dias', value: '30' },
];

export default function Monitoramento() {
  const { t } = useI18n();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');

  const fetchVitals = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));
      const { data, error } = await supabase
        .from('performance_log')
        .select('metric_name, metric_value, rating, page_path, connection_type, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000);
      if (!error) setRecords(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchVitals(); }, [fetchVitals]);

  const byMetric = {};
  records.forEach(r => {
    if (!byMetric[r.metric_name]) byMetric[r.metric_name] = [];
    byMetric[r.metric_name].push(r);
  });

  const byConnection = {};
  records.forEach(r => {
    const c = r.connection_type ?? 'unknown';
    byConnection[c] = (byConnection[c] || 0) + 1;
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            {t('monitoramento.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {t('monitoramento.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="h-8 text-sm border border-slate-200 dark:border-slate-700 rounded-md px-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchVitals} disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {t('btn.refresh')}
          </Button>
        </div>
      </div>

      {/* Cloudflare Worker + App stats */}
      <MonitoramentoSuperAdmin />

      {/* Web Vitals */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-600" />
          {t('monitoramento.webVitals')}
          <Badge variant="outline" className="text-xs font-normal">
            {records.length} amostras
          </Badge>
        </h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-slate-400">
              <Gauge className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('msg.no_data')}</p>
              <p className="text-xs mt-1">{t('monitoramento.dataAppears')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {['LCP', 'FCP', 'TTFB', 'INP', 'CLS'].map(name => (
                <MetricSummaryCard key={name} name={name} records={byMetric[name]} />
              ))}
            </div>

            {/* Por página */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {t('monitoramento.performancePorPagina')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <PageTable records={records} />
              </CardContent>
            </Card>

            {/* Tipo de ligação */}
            {Object.keys(byConnection).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    Tipo de Ligação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(byConnection)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-1.5">
                          <Wifi className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{type}</span>
                          <span className="text-xs text-slate-400">{count} sessões</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
