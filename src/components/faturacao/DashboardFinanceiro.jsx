import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Select from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search, Loader2, DollarSign, Plane, TrendingUp, BarChart3,
  Filter, PieChart as PieChartIcon, Download, Globe, Home,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';

const COLORS = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#65a30d', '#ea580c', '#4f46e5'];

const fmtNum = (v, d = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '0';
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
};

const fmtCompact = (v) => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default function DashboardFinanceiro({ companhias, aeroportos }) {
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [calculos, setCalculos] = useState([]);

  const [filtro, setFiltro] = useState({
    aeroporto_id: '',
    data_inicio: '',
    data_fim: '',
  });

  const handleBuscar = async () => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      // Server-side filtered query
      const rpcParams = {};
      if (filtro.aeroporto_id) rpcParams.p_aeroporto_id = filtro.aeroporto_id;
      if (filtro.data_inicio) rpcParams.p_data_inicio = filtro.data_inicio;
      if (filtro.data_fim) rpcParams.p_data_fim = filtro.data_fim;

      // If no aeroporto, use first allowed
      if (!filtro.aeroporto_id && aeroportos.length > 0 && aeroportos.length < 30) {
        rpcParams.p_aeroporto_id = aeroportos[0]?.id;
      }

      const PAGE = 1000;
      let allCalcs = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.rpc('get_calculos_por_periodo', rpcParams).range(from, from + PAGE - 1);
        if (error) { console.error('RPC error:', error); break; }
        if (!data || data.length === 0) break;
        allCalcs = allCalcs.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      setCalculos(allCalcs);
    } catch (error) {
      console.error('Erro:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  // Build companhia map
  const compMap = useMemo(() => {
    const m = new Map();
    companhias.forEach(c => m.set(c.id, c));
    return m;
  }, [companhias]);

  // KPIs
  const kpis = useMemo(() => {
    if (calculos.length === 0) return null;
    const totalUsd = calculos.reduce((s, c) => s + (c.total_tarifa_usd || 0), 0);
    const totalAoa = calculos.reduce((s, c) => s + (c.total_tarifa || 0), 0);
    const totalPouso = calculos.reduce((s, c) => s + (c.tarifa_pouso_usd || 0), 0);
    const totalPerm = calculos.reduce((s, c) => s + (c.tarifa_permanencia_usd || 0), 0);
    const totalPax = calculos.reduce((s, c) => s + (c.tarifa_passageiros_usd || 0), 0);
    const avgPerVoo = totalUsd / calculos.length;
    const cambioSum = calculos.reduce((s, c) => s + (c.taxa_cambio_usd_aoa || 0), 0);
    const avgCambio = cambioSum / calculos.length;
    return { totalUsd, totalAoa, count: calculos.length, avgPerVoo, totalPouso, totalPerm, totalPax, avgCambio };
  }, [calculos]);

  // 1. Receita por Companhia (Top 10)
  const receitaPorCompanhia = useMemo(() => {
    const map = new Map();
    calculos.forEach(c => {
      const comp = compMap.get(c.companhia_id);
      const nome = comp ? comp.nome : 'Outros';
      map.set(nome, (map.get(nome) || 0) + (c.total_tarifa_usd || 0));
    });
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome: nome.length > 20 ? nome.substring(0, 18) + '...' : nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [calculos, compMap]);

  // 2. Receita Mensal (by data_operacao when available)
  const receitaMensal = useMemo(() => {
    const map = new Map();
    calculos.forEach(c => {
      const d = c._data_operacao || c.data_calculo?.split('T')[0] || '';
      const mes = d.substring(0, 7); // YYYY-MM
      if (mes) {
        const cur = map.get(mes) || { valor: 0, count: 0 };
        cur.valor += c.total_tarifa_usd || 0;
        cur.count += 1;
        map.set(mes, cur);
      }
    });
    return Array.from(map.entries())
      .map(([mes, { valor, count }]) => ({
        mes,
        valor,
        label: mes.substring(5) + '/' + mes.substring(2, 4), // MM/YY
        count,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [calculos]);

  // 3. Distribuição por Tipo de Tarifa
  const distribuicaoTarifa = useMemo(() => {
    let pouso = 0, perm = 0, pax = 0, carga = 0, recursos = 0, outras = 0;
    calculos.forEach(c => {
      pouso += c.tarifa_pouso_usd || 0;
      perm += c.tarifa_permanencia_usd || 0;
      pax += c.tarifa_passageiros_usd || 0;
      carga += c.tarifa_carga_usd || 0;
      recursos += c.tarifa_recursos_usd || 0;
      outras += c.outras_tarifas_usd || 0;
    });
    return [
      { nome: 'Aterr./Desc.', valor: pouso },
      { nome: 'Estacionamento', valor: perm },
      { nome: 'Passageiros', valor: pax },
      { nome: 'Carga', valor: carga },
      { nome: 'Recursos', valor: recursos },
      { nome: 'Outras', valor: outras },
    ].filter(d => d.valor > 0);
  }, [calculos]);

  // 4. Quantidade de Voos por Companhia
  const voosPorCompanhia = useMemo(() => {
    const map = new Map();
    calculos.forEach(c => {
      const comp = compMap.get(c.companhia_id);
      const nome = comp ? comp.nome : 'Outros';
      map.set(nome, (map.get(nome) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([nome, qtd]) => ({ nome: nome.length > 20 ? nome.substring(0, 18) + '...' : nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [calculos, compMap]);

  // 5. Top 10 Voos por Receita
  const topVoos = useMemo(() => {
    return [...calculos]
      .sort((a, b) => (b.total_tarifa_usd || 0) - (a.total_tarifa_usd || 0))
      .slice(0, 10)
      .map(c => {
        const comp = compMap.get(c.companhia_id);
        return {
          numero: c.numero_voo || '—',
          companhia: comp?.codigo_icao || '—',
          mtow: c.mtow_kg ? Math.round(c.mtow_kg / 1000) : 0,
          totalUsd: c.total_tarifa_usd || 0,
        };
      });
  }, [calculos, compMap]);

  // 6. Internacional vs Doméstico
  const intVsDom = useMemo(() => {
    let intl = 0, dom = 0, intlCount = 0, domCount = 0;
    calculos.forEach(c => {
      const det = c.detalhes_calculo || {};
      const tipo = det.pouso?.tipoVoo || '';
      if (tipo.toLowerCase().includes('int')) {
        intl += c.total_tarifa_usd || 0;
        intlCount++;
      } else {
        dom += c.total_tarifa_usd || 0;
        domCount++;
      }
    });
    return {
      data: [
        { nome: 'Internacional', valor: intl, count: intlCount },
        { nome: 'Doméstico', valor: dom, count: domCount },
      ].filter(d => d.valor > 0),
      intl, dom, intlCount, domCount,
    };
  }, [calculos]);

  const aeroportoOptions = [
    { value: '', label: 'Todos os Aeroportos' },
    ...aeroportos.map(a => ({ value: a.id, label: `${a.nome} (${a.codigo_icao})` })),
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-2 shadow-lg rounded border text-xs">
        <p className="font-medium">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: ${fmtNum(p.value)}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-purple-600" />
            Filtros do Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Aeroporto</Label>
              <Select
                options={aeroportoOptions}
                value={filtro.aeroporto_id}
                onValueChange={v => setFiltro(p => ({ ...p, aeroporto_id: v }))}
                placeholder="Todos"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={filtro.data_inicio} onChange={e => setFiltro(p => ({ ...p, data_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={filtro.data_fim} onChange={e => setFiltro(p => ({ ...p, data_fim: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleBuscar} disabled={isSearching} className="bg-purple-600 hover:bg-purple-700 text-white w-full">
                {isSearching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</> : <><Search className="mr-2 h-4 w-4" /> Carregar Dados</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isSearching && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      {hasSearched && !isSearching && calculos.length === 0 && (
        <Card><CardContent className="p-8 text-center text-slate-500">
          <p className="font-medium">Nenhum dado encontrado</p>
          <p className="text-xs mt-1">Ajuste os filtros e tente novamente</p>
        </CardContent></Card>
      )}

      {kpis && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card><CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 p-2 rounded-lg"><Plane className="w-4 h-4 text-blue-600" /></div>
                <div><p className="text-[11px] text-slate-500">Voos Facturados</p><p className="text-lg font-bold">{fmtNum(kpis.count, 0)}</p></div>
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="bg-green-50 p-2 rounded-lg"><DollarSign className="w-4 h-4 text-green-600" /></div>
                <div><p className="text-[11px] text-slate-500">Receita Total (USD)</p><p className="text-sm font-bold text-green-700">${fmtNum(kpis.totalUsd)}</p></div>
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="bg-amber-50 p-2 rounded-lg"><TrendingUp className="w-4 h-4 text-amber-600" /></div>
                <div><p className="text-[11px] text-slate-500">Média por Voo</p><p className="text-sm font-bold text-amber-700">${fmtNum(kpis.avgPerVoo)}</p></div>
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="bg-purple-50 p-2 rounded-lg"><Globe className="w-4 h-4 text-purple-600" /></div>
                <div><p className="text-[11px] text-slate-500">Internacional</p><p className="text-sm font-bold text-purple-700">{intVsDom.intlCount} voos</p></div>
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="bg-cyan-50 p-2 rounded-lg"><Home className="w-4 h-4 text-cyan-600" /></div>
                <div><p className="text-[11px] text-slate-500">Doméstico</p><p className="text-sm font-bold text-cyan-700">{intVsDom.domCount} voos</p></div>
              </div>
            </CardContent></Card>
          </div>

          {/* Row 1: Receita por Companhia + Receita Mensal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Receita por Companhia */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  Top 10 — Receita por Companhia (USD)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={receitaPorCompanhia} layout="vertical" margin={{ left: 10, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={fmtCompact} fontSize={10} />
                    <YAxis type="category" dataKey="nome" width={120} fontSize={10} />
                    <Tooltip formatter={(v) => [`$${fmtNum(v)}`, 'Receita']} />
                    <Bar dataKey="valor" fill="#059669" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 9, formatter: fmtCompact }}>
                      {receitaPorCompanhia.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 2. Receita Mensal */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Evolução Mensal da Receita (USD)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={receitaMensal} margin={{ left: 10, right: 10, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis tickFormatter={fmtCompact} fontSize={10} />
                    <Tooltip formatter={(v) => [`$${fmtNum(v)}`, 'Receita']} labelFormatter={(l) => `Mês: ${l}`} />
                    <Area type="monotone" dataKey="valor" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} label={{ position: 'top', fontSize: 9, formatter: fmtCompact }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Distribuição Tarifa + INT vs DOM */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 3. Distribuição por Tipo de Tarifa */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-amber-600" />
                  Distribuição por Tipo de Tarifa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={distribuicaoTarifa} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={100} label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                      {distribuicaoTarifa.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`$${fmtNum(v)}`, 'Valor']} />
                    <Legend fontSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 6. Internacional vs Doméstico */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-600" />
                  Internacional vs Doméstico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={intVsDom.data} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={80} label={({ nome, percent }) => `${(percent * 100).toFixed(0)}%`} fontSize={11}>
                        <Cell fill="#7c3aed" />
                        <Cell fill="#0891b2" />
                      </Pie>
                      <Tooltip formatter={(v) => [`$${fmtNum(v)}`, 'Receita']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col justify-center space-y-3">
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-purple-600">Internacional</p>
                      <p className="text-lg font-bold text-purple-700">{intVsDom.intlCount} voos</p>
                      <p className="text-sm text-purple-600">${fmtNum(intVsDom.intl)}</p>
                    </div>
                    <div className="p-3 bg-cyan-50 rounded-lg">
                      <p className="text-xs text-cyan-600">Doméstico</p>
                      <p className="text-lg font-bold text-cyan-700">{intVsDom.domCount} voos</p>
                      <p className="text-sm text-cyan-600">${fmtNum(intVsDom.dom)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Voos por Companhia + Top 10 Voos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 4. Quantidade de Voos por Companhia */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plane className="w-4 h-4 text-blue-600" />
                  Top 10 — Voos por Companhia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={voosPorCompanhia} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis type="category" dataKey="nome" width={120} fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="qtd" name="Voos" fill="#2563eb" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10 }}>
                      {voosPorCompanhia.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 5. Top 10 Voos por Receita */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Top 10 — Voos com Maior Receita
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3">Nº</TableHead>
                      <TableHead className="px-3">Voo</TableHead>
                      <TableHead className="px-3">Comp.</TableHead>
                      <TableHead className="px-3 text-right">PMD(t)</TableHead>
                      <TableHead className="px-3 text-right">Total (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topVoos.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="px-3 text-slate-400">{i + 1}</TableCell>
                        <TableCell className="px-3 font-mono">{v.numero}</TableCell>
                        <TableCell className="px-3">{v.companhia}</TableCell>
                        <TableCell className="px-3 text-right">{v.mtow}</TableCell>
                        <TableCell className="px-3 text-right font-bold text-green-700">${fmtNum(v.totalUsd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
