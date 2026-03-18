import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, Area, AreaChart } from 'recharts';
import { CheckCircle2, Shield, Users, Briefcase, Package, Plane, TrendingUp, TrendingDown, Target, Filter, X, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Combobox from '@/components/ui/combobox';
import { useI18n } from '@/components/lib/i18n';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const CATEGORY_CONFIG = {
  'check_in': { label: 'Check-in', icon: CheckCircle2, color: '#3B82F6' },
  'seguranca': { label: 'Segurança', icon: Shield, color: '#10B981' },
  'migratorio': { label: 'Migratório', icon: Users, color: '#8B5CF6' },
  'aduaneiro': { label: 'Aduaneiro', icon: Briefcase, color: '#F59E0B' },
  'bagagem': { label: 'Bagagem', icon: Package, color: '#06B6D4' },
  'embarque': { label: 'Embarque', icon: Plane, color: '#EC4899' }
};

export default function DashboardKPIs({ medicoes, tiposKPI, aeroportos, onExportPDF, isExporting }) {
  const { t } = useI18n();
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    aeroporto: 'todos',
    tipoKPI: 'todos'
  });

  const handleFilterChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFiltros({
      dataInicio: '',
      dataFim: '',
      aeroporto: 'todos',
      tipoKPI: 'todos'
    });
  };

  const hasActiveFilters = useMemo(() => 
    Object.values(filtros).some(value => value !== '' && value !== 'todos'), 
    [filtros]
  );

  // Filtrar medições com base nos filtros
  const medicoesFiltradas = useMemo(() => {
    return medicoes.filter(m => {
      const aeroportoMatch = filtros.aeroporto === 'todos' || m.aeroporto_id === filtros.aeroporto;
      const tipoMatch = filtros.tipoKPI === 'todos' || m.tipo_kpi_id === filtros.tipoKPI;
      const dataMatch = 
        (!filtros.dataInicio || m.data_medicao >= filtros.dataInicio) &&
        (!filtros.dataFim || m.data_medicao <= filtros.dataFim);
      
      return aeroportoMatch && tipoMatch && dataMatch;
    });
  }, [medicoes, filtros]);

  // Processar dados para o dashboard
  const dashboardData = useMemo(() => {
    // Estatísticas gerais (usando medicoesFiltradas)
    const totalMedicoes = medicoesFiltradas.length;
    const medicoesHoje = medicoesFiltradas.filter(m => m.data_medicao === new Date().toISOString().split('T')[0]).length;
    const medicoesDentroDaMeta = medicoesFiltradas.filter(m => m.dentro_da_meta === true).length;
    const percentualMeta = totalMedicoes > 0 ? ((medicoesDentroDaMeta / totalMedicoes) * 100).toFixed(1) : 0;

    // Agrupar por tipo de KPI (usando medicoesFiltradas)
    const medicoesPorTipo = {};
    tiposKPI.forEach(tipo => {
      const medicoesDoTipo = medicoesFiltradas.filter(m => m.tipo_kpi_id === tipo.id);
      const dentroDaMeta = medicoesDoTipo.filter(m => m.dentro_da_meta === true).length;
      
      // Calcular média do resultado principal
      const resultados = medicoesDoTipo
        .filter(m => m.resultado_principal !== null && m.resultado_principal !== undefined)
        .map(m => m.resultado_principal);
      
      const media = resultados.length > 0 
        ? resultados.reduce((acc, val) => acc + val, 0) / resultados.length 
        : 0;

      medicoesPorTipo[tipo.id] = {
        tipo,
        total: medicoesDoTipo.length,
        dentroDaMeta,
        foraDaMeta: medicoesDoTipo.length - dentroDaMeta,
        percentualMeta: medicoesDoTipo.length > 0 ? ((dentroDaMeta / medicoesDoTipo.length) * 100).toFixed(1) : 0,
        mediaResultado: media,
        categoria: tipo.categoria || 'operacional'
      };
    });

    // Agrupar por aeroporto (usando medicoesFiltradas)
    const medicoesPorAeroporto = {};
    aeroportos.forEach(aeroporto => {
      const medicoesDoAeroporto = medicoesFiltradas.filter(m => m.aeroporto_id === aeroporto.codigo_icao);
      const dentroDaMeta = medicoesDoAeroporto.filter(m => m.dentro_da_meta === true).length;

      medicoesPorAeroporto[aeroporto.codigo_icao] = {
        aeroporto,
        total: medicoesDoAeroporto.length,
        dentroDaMeta,
        foraDaMeta: medicoesDoAeroporto.length - dentroDaMeta,
        percentualMeta: medicoesDoAeroporto.length > 0 ? ((dentroDaMeta / medicoesDoAeroporto.length) * 100).toFixed(1) : 0
      };
    });

    // Dados para gráfico de barras (Top 5 KPIs por volume)
    const topKPIs = Object.values(medicoesPorTipo)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(item => ({
        nome: item.tipo.nome.length > 25 ? item.tipo.nome.substring(0, 25) + '...' : item.tipo.nome,
        total: item.total,
        dentroDaMeta: item.dentroDaMeta,
        foraDaMeta: item.foraDaMeta
      }));

    // Dados para gráfico de aeroportos (Top 5)
    const topAeroportos = Object.values(medicoesPorAeroporto)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(item => ({
        nome: item.aeroporto.codigo_icao,
        total: item.total,
        dentroDaMeta: item.dentroDaMeta,
        foraDaMeta: item.foraDaMeta
      }));

    // Dados para gráfico de pizza (distribuição por categoria)
    const medicoesPorCategoria = {};
    Object.values(medicoesPorTipo).forEach(item => {
      const cat = item.categoria;
      if (!medicoesPorCategoria[cat]) {
        medicoesPorCategoria[cat] = 0;
      }
      medicoesPorCategoria[cat] += item.total;
    });

    const pieData = Object.entries(medicoesPorCategoria).map(([categoria, total]) => ({
      name: categoria.charAt(0).toUpperCase() + categoria.slice(1),
      value: total
    }));

    // Análise temporal (últimos 30 dias)
    const analiseTemporalKPI = {};
    if (filtros.tipoKPI !== 'todos') {
      const kpiSelecionado = tiposKPI.find(t => t.id === filtros.tipoKPI);
      if (kpiSelecionado) {
        const medicoesTemporal = medicoesFiltradas
          .filter(m => m.tipo_kpi_id === filtros.tipoKPI)
          .sort((a, b) => new Date(a.data_medicao) - new Date(b.data_medicao))
          .slice(-30);

        analiseTemporalKPI.dados = medicoesTemporal.map(m => ({
          data: new Date(m.data_medicao).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
          resultado: m.resultado_principal || 0,
          meta: kpiSelecionado.meta_objetivo
        }));
      }
    }

    // Análise por aeroporto individual
    const analiseAeroportoIndividual = {};
    if (filtros.aeroporto !== 'todos') {
      const aeroporto = aeroportos.find(a => a.codigo_icao === filtros.aeroporto);
      if (aeroporto) {
        const medicoesAeroporto = medicoesFiltradas.filter(m => m.aeroporto_id === filtros.aeroporto);
        
        // Agrupar por tipo de KPI para este aeroporto
        const kpisPorAeroporto = {};
        medicoesAeroporto.forEach(m => {
          const tipo = tiposKPI.find(t => t.id === m.tipo_kpi_id);
          if (tipo) {
            if (!kpisPorAeroporto[tipo.id]) {
              kpisPorAeroporto[tipo.id] = {
                nome: tipo.nome,
                total: 0,
                dentroDaMeta: 0,
                mediaResultado: 0,
                resultados: []
              };
            }
            kpisPorAeroporto[tipo.id].total++;
            if (m.dentro_da_meta) kpisPorAeroporto[tipo.id].dentroDaMeta++;
            if (m.resultado_principal !== null) {
              kpisPorAeroporto[tipo.id].resultados.push(m.resultado_principal);
            }
          }
        });

        // Calcular médias
        Object.values(kpisPorAeroporto).forEach(kpi => {
          if (kpi.resultados.length > 0) {
            kpi.mediaResultado = kpi.resultados.reduce((sum, val) => sum + val, 0) / kpi.resultados.length;
          }
        });

        analiseAeroportoIndividual.aeroporto = aeroporto;
        analiseAeroportoIndividual.kpis = Object.values(kpisPorAeroporto);
        analiseAeroportoIndividual.totalMedicoes = medicoesAeroporto.length;
        analiseAeroportoIndividual.dentroDaMeta = medicoesAeroporto.filter(m => m.dentro_da_meta).length;
      }
    }

    return {
      totalMedicoes,
      medicoesHoje,
      medicoesDentroDaMeta,
      percentualMeta,
      medicoesPorTipo,
      medicoesPorAeroporto,
      topKPIs,
      topAeroportos,
      pieData,
      analiseTemporalKPI,
      analiseAeroportoIndividual
    };
  }, [medicoesFiltradas, tiposKPI, aeroportos, filtros]);

  const aeroportoOptions = useMemo(() => {
    // Apenas aeroportos que têm medições
    const aeroportosComMedicoes = aeroportos.filter(a => 
      medicoes.some(m => m.aeroporto_id === a.codigo_icao)
    );
    
    return [
      { value: 'todos', label: t('kpis.todosAeroportos') },
      ...aeroportosComMedicoes.map(a => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))
    ];
  }, [aeroportos, medicoes]);

  const tipoKPIOptions = useMemo(() => {
    // Apenas KPIs que têm medições
    const kpisComMedicoes = tiposKPI.filter(t => 
      medicoes.some(m => m.tipo_kpi_id === t.id)
    );
    
    return [
      { value: 'todos', label: t('kpis.todosKPIs') },
      ...kpisComMedicoes.map(tipo => ({ value: tipo.id, label: tipo.nome }))
    ];
  }, [tiposKPI, medicoes]);

  const handleExportPDF = async () => {
    if (onExportPDF) {
      await onExportPDF(medicoesFiltradas, filtros);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500" />
              {t('kpis.filtrosDashboard')}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={isExporting || medicoesFiltradas.length === 0}
              >
                <FileText className="w-4 h-4 mr-2" />
                {isExporting ? t('kpis.gerandoPDF') : t('kpis.exportarPDF')}
              </Button>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="text-red-600 border-red-200 hover:bg-red-50">
                  <X className="w-4 h-4 mr-1" />
                  {t('kpis.limparFiltrosBotao')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filtro-aeroporto">{t('kpis.aeroporto')}</Label>
              <Combobox
                id="filtro-aeroporto"
                options={aeroportoOptions}
                value={filtros.aeroporto}
                onValueChange={(v) => handleFilterChange('aeroporto', v)}
                placeholder="Selecione o aeroporto..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-tipo-kpi">{t('kpis.tipoKPI')}</Label>
              <Combobox
                id="filtro-tipo-kpi"
                options={tipoKPIOptions}
                value={filtros.tipoKPI}
                onValueChange={(v) => handleFilterChange('tipoKPI', v)}
                placeholder="Selecione o KPI..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-data-inicio">{t('kpis.dataInicio')}</Label>
              <Input
                id="filtro-data-inicio"
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-data-fim">{t('kpis.dataFim')}</Label>
              <Input
                id="filtro-data-fim"
                type="date"
                value={filtros.dataFim}
                onChange={(e) => handleFilterChange('dataFim', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">{t('kpis.totalMedicoesCard')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{dashboardData.totalMedicoes}</div>
            <p className="text-xs text-slate-500 mt-1">{t('kpis.todasMedicoes')}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">{t('kpis.hojeCard')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{dashboardData.medicoesHoje}</div>
            <p className="text-xs text-slate-500 mt-1">{t('kpis.medicoesHoje')}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">{t('kpis.dentroMetaLabel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{dashboardData.medicoesDentroDaMeta}</div>
            <p className="text-xs text-slate-500 mt-1">
              {dashboardData.percentualMeta}{t('kpis.percTotal')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">{t('kpis.performanceGeral')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold text-purple-600">{dashboardData.percentualMeta}%</div>
              {dashboardData.percentualMeta >= 80 ? (
                <TrendingUp className="w-6 h-6 text-green-500" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-500" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">{t('kpis.taxaConformidade')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Análise Temporal do KPI Selecionado */}
      {filtros.tipoKPI !== 'todos' && dashboardData.analiseTemporalKPI?.dados && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              {t('kpis.evolucaoTemporal')} - {tiposKPI.find(tipo => tipo.id === filtros.tipoKPI)?.nome}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboardData.analiseTemporalKPI.dados}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="resultado" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Resultado" />
                <Line type="monotone" dataKey="meta" stroke="#EF4444" strokeDasharray="5 5" name="Meta" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Análise Individual por Aeroporto */}
      {filtros.aeroporto !== 'todos' && dashboardData.analiseAeroportoIndividual?.aeroporto && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-blue-600" />
              {t('kpis.analiseAeroporto')}: {dashboardData.analiseAeroportoIndividual.aeroporto.nome}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData.analiseAeroportoIndividual.totalMedicoes}
                  </div>
                  <div className="text-sm text-slate-600">{t('kpis.totalMedicoes')}</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData.analiseAeroportoIndividual.dentroDaMeta}
                  </div>
                  <div className="text-sm text-slate-600">{t('kpis.dentroMetaLabel')}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2 font-semibold">{t('kpis.kpiLabel')}</th>
                      <th className="text-center p-2 font-semibold">{t('kpis.totalLabel')}</th>
                      <th className="text-center p-2 font-semibold">{t('kpis.mediaLabel')}</th>
                      <th className="text-center p-2 font-semibold">{t('kpis.performanceLabel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.analiseAeroportoIndividual.kpis.map((kpi, idx) => {
                      const percentual = kpi.total > 0 ? ((kpi.dentroDaMeta / kpi.total) * 100).toFixed(0) : 0;
                      return (
                        <tr key={idx} className="border-b hover:bg-slate-50">
                          <td className="p-2 text-xs">{kpi.nome}</td>
                          <td className="p-2 text-center">{kpi.total}</td>
                          <td className="p-2 text-center">{kpi.mediaResultado.toFixed(1)}</td>
                          <td className="p-2 text-center">
                            <Badge variant={percentual >= 80 ? 'success' : 'destructive'} className="text-xs">
                              {percentual}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Top 5 KPIs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              {t('kpis.top5KPIs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.topKPIs.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={dashboardData.topKPIs} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="nome" width={200} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="dentroDaMeta" name={t('kpis.dentroDaMetaBar')} fill="#10B981" stackId="a" />
                  <Bar dataKey="foraDaMeta" name={t('kpis.foraDaMetaBar')} fill="#EF4444" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-slate-400">
                {t('kpis.semDados')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Top 5 Aeroportos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-blue-600" />
              {t('kpis.top5Aeroportos')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.topAeroportos.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.topAeroportos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="dentroDaMeta" name={t('kpis.dentroDaMetaBar')} fill="#10B981" />
                  <Bar dataKey="foraDaMeta" name={t('kpis.foraDaMetaBar')} fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                {t('kpis.semDados')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cards Individuais dos 18 KPIs */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">{t('kpis.kpisIndividuais')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(dashboardData.medicoesPorTipo)
            .sort((a, b) => a.tipo.nome.localeCompare(b.tipo.nome))
            .map((item) => {
              const percentual = item.total > 0 ? parseFloat(item.percentualMeta) : 0;
              const categoriaConfig = CATEGORY_CONFIG[item.categoria] || { color: '#94A3B8', icon: Target };
              const Icon = categoriaConfig.icon;
              const color = item.tipo.cor_identificacao || categoriaConfig.color;

              return (
                <Card key={item.tipo.id} className="border-l-4 hover:shadow-lg transition-shadow" style={{ borderLeftColor: color }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="w-5 h-5" style={{ color: color }} />
                      <span className="text-sm font-semibold">{item.tipo.nome}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">{t('kpis.totalMedicoesCard')}:</span>
                        <span className="font-bold text-lg text-slate-900">{item.total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">{t('kpis.dentroMetaLabel')}:</span>
                        <span className="font-bold text-lg text-green-600">{item.dentroDaMeta}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">{t('kpis.mediaLabel')}:</span>
                        <span className="font-semibold text-blue-600">
                          {item.mediaResultado > 0 ? `${item.mediaResultado.toFixed(1)} ${item.tipo.unidade_medida || ''}` : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">{t('kpis.meta')}:</span>
                        <span className="font-semibold text-slate-700">
                          {item.tipo.meta_objetivo !== null && item.tipo.meta_objetivo !== undefined
                            ? `${item.tipo.meta_objetivo} ${item.tipo.unidade_medida || ''}`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-slate-600">{t('kpis.performanceLabel')}:</span>
                        <Badge 
                          variant={percentual >= 80 ? 'success' : percentual >= 60 ? 'warning' : 'destructive'}
                          className="text-sm font-bold"
                        >
                          {percentual.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 mt-3">
                      <div 
                        className="h-2.5 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${percentual}%`,
                          backgroundColor: color
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {Object.values(dashboardData.medicoesPorTipo).length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Target className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {t('kpis.nenhumKPI')}
            </h3>
            <p className="text-slate-500">
              {t('kpis.ajusteFiltros')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}