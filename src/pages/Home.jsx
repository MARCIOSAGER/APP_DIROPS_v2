import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Select from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plane,
  Clock,
  DollarSign,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  MapPin,
  Users,
  RefreshCw,
  AlertTriangle,
  Timer,
  Link as LinkIcon,
  AlertCircle,
  ShieldCheck,
  ClipboardCheck,
  Plus,
  Wrench,
  Search,
  Activity } from
"lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

import MonitoramentoSuperAdmin from '@/components/suporte/MonitoramentoSuperAdmin';

// Lazy load dos componentes de gráficos para melhor performance
const MovimentosChart = React.lazy(() => import("../components/dashboard/MovimentosChart"));
const PontualidadeChart = React.lazy(() => import("../components/dashboard/PontualidadeChart"));
const ReceitasChart = React.lazy(() => import("../components/dashboard/ReceitasChart"));
const SafetyAlerts = React.lazy(() => import("../components/dashboard/SafetyAlerts"));

import { Voo } from "@/entities/Voo";
import { CalculoTarifa } from "@/entities/CalculoTarifa";
import { OcorrenciaSafety } from "@/entities/OcorrenciaSafety";
import { OrdemServico } from "@/entities/OrdemServico";
import { Aeroporto } from "@/entities/Aeroporto";
import { Inspecao } from "@/entities/Inspecao";
import { User } from '@/entities/User';
import { createPageUrl } from '@/utils';
import { hasUserProfile, ensureUserProfilesExist, getAeroportosPermitidos } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useI18n } from '@/components/lib/i18n';

import { getDashboardStats } from '@/functions/getDashboardStats';
import { supabase } from '@/lib/supabaseClient';

const formatCurrency = (value) =>
new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value || 0);

export default function DashboardInterno() {
  const { t, language } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const [voos, setVoos] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [ocorrenciasSafety, setOcorrenciasSafety] = useState([]);
  const [inspecoes, setInspecoes] = useState([]);
  const [voosLigados, setVoosLigados] = useState([]);
  const [calculosTarifa, setCalculosTarifa] = useState([]);
  const [ordensServico, setOrdensServico] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [serverStats, setServerStats] = useState(null);
  const [previousPeriodStats, setPreviousPeriodStats] = useState(null);
  const [selectedAeroporto, setSelectedAeroporto] = useState("todos");
  const [selectedPeriodo, setSelectedPeriodo] = useState("30");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('Iniciando...');
  const [currentUser, setCurrentUser] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setLoadingStatus(t('common.loading'));
      const user = await User.me();
      const userWithProfiles = ensureUserProfilesExist(user);
      setCurrentUser(userWithProfiles);

      if (hasUserProfile(userWithProfiles, 'gestor_empresa')) {
        setLoadingStatus(t('layout.redirecting'));
        window.location.href = createPageUrl('Credenciamento');
        return;
      }

      setLoadingStatus(t('common.loading'));
      let aeroportosData = [];
      try {
        const empresaIdFiltro = effectiveEmpresaId || userWithProfiles.empresa_id;
        aeroportosData = await (empresaIdFiltro ? Aeroporto.filter({ empresa_id: empresaIdFiltro }) : Aeroporto.list());
      } catch (err) {
        console.error('❌ Erro ao carregar aeroportos:', err);
      }

      // Filtrar aeroportos por empresa + permissões do utilizador
      const aeroportosFiltrados = getAeroportosPermitidos(userWithProfiles, aeroportosData, effectiveEmpresaId);

      setAeroportos(aeroportosFiltrados);

      setLoadingStatus(t('common.loading'));
      const [voosDataResult, ocorrenciasDataResult, inspecoesDataResult, calculosTarifaResult, ordensServicoResult] = await Promise.allSettled([
      Voo.list('-data_operacao', 500),
      OcorrenciaSafety.list('-data_ocorrencia', 50),
      Inspecao.list('-data_inspecao', 50),
      CalculoTarifa.list('-data_calculo', 1000),
      OrdemServico.list('-created_date', 10)]
      );

      let voosData = voosDataResult.status === 'fulfilled' ? voosDataResult.value : [];
      let ocorrenciasData = ocorrenciasDataResult.status === 'fulfilled' ? ocorrenciasDataResult.value : [];
      let inspecoesData = inspecoesDataResult.status === 'fulfilled' ? inspecoesDataResult.value : [];
      let calculosTarifaData = calculosTarifaResult.status === 'fulfilled' ? calculosTarifaResult.value : [];
      let ordensServicoData = ordensServicoResult.status === 'fulfilled' ? ordensServicoResult.value : [];
      setOrdensServico(ordensServicoData);

      // Filtrar voos por aeroportos da empresa (mais fiável que voo.empresa_id que pode não estar preenchido)
      const empresaId = effectiveEmpresaId || userWithProfiles.empresa_id;
      const icaosPermitidos = new Set(aeroportosFiltrados.map(a => a.codigo_icao));
      const voosFiltrados = empresaId
        ? voosData.filter(v => icaosPermitidos.has(v.aeroporto_operacao))
        : voosData;
      setVoos(voosFiltrados);

      // Ocorrências e inspeções: filtrar por aeroportos da empresa
      const ocorrenciasFiltradas = empresaId
        ? ocorrenciasData.filter(o => icaosPermitidos.has(o.aeroporto))
        : ocorrenciasData;
      setOcorrenciasSafety(ocorrenciasFiltradas);

      const aeroportoIdsPermitidos = new Set(aeroportosFiltrados.map(a => a.id));
      const inspecoesFiltradas = empresaId
        ? inspecoesData.filter(i => aeroportoIdsPermitidos.has(i.aeroporto_id))
        : inspecoesData;
      setInspecoes(inspecoesFiltradas);

      // Filtrar cálculos de tarifa: só os que têm voo_id dentro dos voos filtrados
      const vooIdsFiltrados = new Set(voosFiltrados.map(v => v.id));
      const calculosFiltrados = calculosTarifaData.filter(c => vooIdsFiltrados.has(c.voo_id));
      setCalculosTarifa(calculosFiltrados);

      setLoadingStatus(t('general.success'));
    } catch (error) {
      console.error("❌ Erro ao carregar dados específicos:", error);
      setLoadingStatus(t('common.loading'));
      setError(error.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveEmpresaId]);

  const loadDashboardStats = useCallback(async () => {
    if (!currentUser) return;

    setIsLoadingStats(true);
    try {
      const empresaId = effectiveEmpresaId || currentUser.empresa_id;
      const params = { aeroporto: selectedAeroporto, periodo: selectedPeriodo, empresaId };
      // Fetch current and previous period in parallel for trend comparison
      const previousPeriodo = String(parseInt(selectedPeriodo) * 2);
      const [response, prevResponse, rpcResult] = await Promise.all([
        getDashboardStats(params),
        getDashboardStats({ aeroporto: selectedAeroporto, periodo: previousPeriodo, empresaId }),
        supabase.rpc('get_dashboard_stats', {
          p_empresa_id: empresaId || null,
          p_dias: parseInt(selectedPeriodo) || 30,
        }).then(res => res.data).catch(err => { console.error('RPC get_dashboard_stats error:', err); return null; }),
      ]);
      setDashboardStats(response.data);
      setPreviousPeriodStats(prevResponse.data);
      setServerStats(rpcResult);
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);
      setError(error.message || t('common.error'));
      setDashboardStats(null);
      setServerStats(null);
      setPreviousPeriodStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [selectedAeroporto, selectedPeriodo, currentUser, effectiveEmpresaId]);

  const checkUserAndLoadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setLoadingStatus(t('common.loading'));
      // Race against a 45s timeout to prevent infinite loading
      await Promise.race([
        loadData(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 45000))
      ]);

    } catch (error) {
      console.error("❌ Erro geral no Dashboard:", error);

      if (error.message === 'timeout') {
        setError('O carregamento demorou demasiado. Verifique a sua ligação e tente novamente.');
        return;
      }

      if (error.response?.status === 401 || error.message?.includes('401') || error.message?.includes('not authenticated')) {
        console.debug('Utilizador não autenticado, redirecionando para login');
        window.location.href = '/login';
        return;
      }

      if (String(error.message).includes('403')) {
        if (currentUser && hasUserProfile(currentUser, 'gestor_empresa')) {
          window.location.href = createPageUrl('Credenciamento');
          return;
        }
        setError(t('operacoes.acesso_negado'));
      } else {
        setError(error.message || t('common.error'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadData]);

  useEffect(() => {
    checkUserAndLoadData();
  }, [checkUserAndLoadData]);

  useEffect(() => {
    if (currentUser && !isLoading) {
      loadDashboardStats();
    }
  }, [selectedAeroporto, selectedPeriodo, currentUser, isLoading, loadDashboardStats]);

  const filteredVoos = useMemo(() => {
    return selectedAeroporto === "todos" ?
    voos :
    voos.filter((voo) => voo.aeroporto_operacao === selectedAeroporto);
  }, [voos, selectedAeroporto]);

  const filteredOcorrencias = useMemo(() => {
    return selectedAeroporto === "todos" ?
    ocorrenciasSafety :
    ocorrenciasSafety.filter((ocorrencia) => ocorrencia.aeroporto === selectedAeroporto);
  }, [ocorrenciasSafety, selectedAeroporto]);

  const filteredInspecoes = useMemo(() => {
    return selectedAeroporto === 'todos' ?
    inspecoes :
    inspecoes.filter((inspecao) => aeroportos.find((a) => a.id === inspecao.aeroporto_id)?.codigo_icao === selectedAeroporto);
  }, [inspecoes, selectedAeroporto, aeroportos]);

  const filteredCalculosTarifa = useMemo(() => {
    if (!calculosTarifa || !filteredVoos) return [];
    const voosIdsSet = new Set(filteredVoos.map((v) => v.id));
    return calculosTarifa.filter((ct) => voosIdsSet.has(ct.voo_id));
  }, [calculosTarifa, filteredVoos]);

  const filteredVoosLigados = useMemo(() => {
    if (!voosLigados || !voos) return [];
    return voosLigados.filter((vl) => {
      const arrVoo = voos.find((v) => v.id === vl.id_voo_arr);
      const depVoo = voos.find((v) => v.id === vl.id_voo_dep);
      if (!arrVoo || !depVoo) {
        return false;
      }
      if (selectedAeroporto === 'todos') return true;
      return arrVoo.aeroporto_operacao === selectedAeroporto &&
      depVoo.aeroporto_operacao === selectedAeroporto;
    });
  }, [voosLigados, voos, selectedAeroporto]);

  const aeroportoOptions = useMemo(() => [
  { value: 'todos', label: t('home.todos_aeroportos') },
  ...aeroportos.map((aeroporto) => ({ value: aeroporto.codigo_icao, label: aeroporto.nome }))],
  [aeroportos, t]);

  const periodoOptions = useMemo(() => [
  { value: '7', label: `7 ${t('home.dias')}` },
  { value: '30', label: `30 ${t('home.dias')}` },
  { value: '90', label: `90 ${t('home.dias')}` }],
  [t]);

  // Trend calculation: current period vs remainder of double-period (i.e. previous equivalent period)
  const calcTrend = useCallback((currentVal, doubleVal) => {
    if (!doubleVal && doubleVal !== 0) return null;
    const previousVal = doubleVal - currentVal;
    if (previousVal === 0 && currentVal === 0) return null;
    if (previousVal === 0) return { direction: 'up', pct: 100 };
    const pct = ((currentVal - previousVal) / Math.abs(previousVal)) * 100;
    return { direction: pct >= 0 ? 'up' : 'down', pct: Math.abs(pct).toFixed(0) };
  }, []);

  const trends = useMemo(() => {
    if (!dashboardStats || !previousPeriodStats) return {};
    return {
      voos: calcTrend(serverStats?.total_voos ?? dashboardStats.totalVoos, previousPeriodStats.totalVoos),
      pontualidade: calcTrend(serverStats?.pontualidade ?? dashboardStats.taxaPontualidade, previousPeriodStats.taxaPontualidade),
      passageiros: calcTrend(serverStats?.total_passageiros ?? dashboardStats.passageirosPeriodo, previousPeriodStats.passageirosPeriodo),
    };
  }, [dashboardStats, previousPeriodStats, serverStats, calcTrend]);

  // Top 10 Companhias (for single-airport enterprises like ATO)
  const [receitaPorCompanhia, setReceitaPorCompanhia] = useState(new Map());

  // Load revenue server-side when period/aeroporto changes
  useEffect(() => {
    const loadReceita = async () => {
      if (!currentUser || aeroportos.length > 1) return; // Only for single-airport (ATO)
      const empresaId = effectiveEmpresaId || currentUser.empresa_id;
      if (!empresaId) return;
      try {
        const { data } = await supabase.rpc('get_receita_por_companhia', {
          p_empresa_id: empresaId,
          p_dias: parseInt(selectedPeriodo) || 30,
        });
        const map = new Map();
        (data || []).forEach(r => map.set(r.companhia_code, { usd: r.total_usd, voos: r.voos_count }));
        setReceitaPorCompanhia(map);
      } catch (e) {
        console.error('Erro receita:', e);
      }
    };
    loadReceita();
  }, [currentUser, effectiveEmpresaId, selectedPeriodo, aeroportos.length]);

  const top10Companhias = useMemo(() => {
    const compMap = new Map();
    filteredVoos.forEach(v => {
      const code = v.companhia_aerea || 'N/A';
      if (!compMap.has(code)) compMap.set(code, { codigo: code, totalMovimentos: 0, arr: 0, dep: 0, passageiros: 0, carga: 0, receita: 0 });
      const c = compMap.get(code);
      c.totalMovimentos++;
      if (v.tipo_movimento === 'ARR') {
        c.arr++;
        c.passageiros += (v.passageiros_desembarcados || 0);
      } else {
        c.dep++;
        c.passageiros += (v.passageiros_local || 0) + (v.passageiros_transito_transbordo || 0);
      }
      c.carga += (v.carga_kg || 0);
    });
    // Add server-side revenue
    receitaPorCompanhia.forEach((rev, code) => {
      if (compMap.has(code)) {
        compMap.get(code).receita = rev.usd;
      }
    });
    return Array.from(compMap.values())
      .sort((a, b) => b.totalMovimentos - a.totalMovimentos)
      .slice(0, 10);
  }, [filteredVoos, receitaPorCompanhia]);

  const showCompanhiasInsteadOfAeroportos = aeroportos.length <= 1;

  // Recent activity: combine recent voos, inspecoes, and ordens de servico
  const recentActivity = useMemo(() => {
    const items = [];
    // Recent flights
    filteredVoos.slice(0, 5).forEach(v => {
      items.push({
        id: `voo-${v.id}`,
        type: 'voo',
        icon: Plane,
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-50 dark:bg-blue-950',
        description: `${t('home.voo')} ${v.numero_voo || ''} ${v.tipo_movimento || ''} - ${v.aeroporto_operacao || ''}`,
        date: v.created_date || v.data_operacao,
        link: createPageUrl('Operacoes'),
      });
    });
    // Recent inspections
    filteredInspecoes.slice(0, 5).forEach(i => {
      items.push({
        id: `insp-${i.id}`,
        type: 'inspecao',
        icon: ClipboardCheck,
        iconColor: 'text-yellow-600',
        iconBg: 'bg-yellow-50 dark:bg-yellow-950',
        description: `${t('home.inspecao')} ${i.tipo || ''} - ${i.status || t('home.pendente')}`,
        date: i.created_date || i.data_inspecao,
        link: createPageUrl('Inspecoes'),
      });
    });
    // Recent maintenance orders
    ordensServico.slice(0, 5).forEach(os => {
      items.push({
        id: `os-${os.id}`,
        type: 'os',
        icon: Wrench,
        iconColor: 'text-purple-600',
        iconBg: 'bg-purple-50 dark:bg-purple-950',
        description: `OS${os.numero ? ` #${os.numero}` : ''} - ${os.titulo || os.descricao?.substring(0, 40) || t('home.ordem_servico')}`,
        date: os.created_date,
        link: createPageUrl('Manutencao'),
      });
    });
    return items
      .filter(item => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [filteredVoos, filteredInspecoes, ordensServico]);

  // Trend indicator component
  const TrendIndicator = ({ trend }) => {
    if (!trend) return null;
    const isUp = trend.direction === 'up';
    return (
      <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${isUp ? 'text-green-600' : 'text-red-600'}`}>
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {trend.pct}%
      </span>
    );
  };

  if (error) {
    return (
      <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('home.erro')}:</strong> {error}
            </AlertDescription>
          </Alert>
          <div className="flex gap-4">
            <Button onClick={checkUserAndLoadData} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('home.tentar_novamente')}
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/Home'}>
              {t('home.tentar_novamente')}
            </Button>
          </div>
        </div>
      </div>);

  }

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{t('page.home.title')}</h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
              Sistema DIROPS • {new Date().toLocaleDateString('pt-AO')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => window.location.href = createPageUrl('Operacoes')}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('home.novo_voo')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-400 dark:hover:bg-yellow-950"
              onClick={() => window.location.href = createPageUrl('Inspecoes')}
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              {t('home.nova_inspecao')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-purple-500 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-950"
              onClick={() => window.location.href = createPageUrl('Manutencao')}
            >
              <Wrench className="h-3.5 w-3.5 mr-1.5" />
              {t('home.nova_os')}
            </Button>
          </div>
        </div>

        <div className="flex gap-4">
          <Select
            className="w-48"
            options={aeroportoOptions}
            value={selectedAeroporto}
            onValueChange={setSelectedAeroporto}
            placeholder={t('home.todos_aeroportos')} />


          <Select
            className="w-32"
            options={periodoOptions}
            value={selectedPeriodo}
            onValueChange={setSelectedPeriodo}
            placeholder={t('home.periodo')} />


          <Button onClick={() => {checkUserAndLoadData();loadDashboardStats();}} variant="outline" disabled={isLoading || isLoadingStats}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isLoadingStats ? 'animate-spin' : ''}`} />
            {t('home.atualizar')}
          </Button>
        </div>

        <MonitoramentoSuperAdmin />

        {isLoading ?
        <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">{loadingStatus}</p>
          </div> :

        <>
            {isLoadingStats ?
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                {Array(8).fill(0).map((_, i) =>
            <Card key={i} className="border-0 shadow-sm">
                    <CardHeader className="pb-2 px-4 pt-4">
                      <Skeleton className="h-6 w-6 rounded" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <Skeleton className="h-6 w-16 mb-2" />
                      <Skeleton className="h-3 w-24 mb-1" />
                      <Skeleton className="h-2 w-20" />
                    </CardContent>
                  </Card>
            )}
              </div> :
          dashboardStats &&
          <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950">
                        <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{serverStats?.total_voos ?? dashboardStats?.totalVoos ?? 0}</span>
                        <TrendIndicator trend={trends.voos} />
                      </div>
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1.5 line-clamp-2">{t('home.total_voos')}</p>
                      {(serverStats?.ligados > 0 || dashboardStats?.voosUnicosLigados > 0) &&
                  <p className="text-[9px] text-slate-400">
                          {serverStats?.ligados ?? dashboardStats?.voosUnicosLigados ?? 0} {t('home.ligados')}, {serverStats?.sem_link ?? dashboardStats?.voosSemLink ?? 0} {t('home.sem_link')}
                        </p>
                  }
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950">
                        <Plane className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">{serverStats?.chegadas_hoje ?? dashboardStats?.chegadasHoje ?? 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1.5 line-clamp-2">{t('home.chegadas_hoje')}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950">
                        <Plane className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">{serverStats?.partidas_hoje ?? dashboardStats?.partidasHoje ?? 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1.5 line-clamp-2">{t('home.partidas_hoje')}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950">
                        <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{(serverStats?.pontualidade ?? dashboardStats?.taxaPontualidade ?? 0).toFixed(1)}%</span>
                        <TrendIndicator trend={trends.pontualidade} />
                      </div>
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1.5 line-clamp-2">{t('home.pontualidade')}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className={`p-1.5 rounded-lg ${(dashboardStats?.ocorrenciasAbertas || 0) > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-gray-50 dark:bg-gray-900'}`}>
                        <ShieldAlert className={`h-4 w-4 ${(dashboardStats?.ocorrenciasAbertas || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`} />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">{dashboardStats?.ocorrenciasAbertas || 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1.5 line-clamp-2">{t('home.ocorrencias_abertas')}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                        <ClipboardCheck className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">{dashboardStats?.inspecoesPendentes || 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1.5 line-clamp-2">{t('home.inspecoes_pendentes')}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950">
                        <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {(() => {
                            const pax = serverStats?.total_passageiros ?? dashboardStats?.passageirosPeriodo ?? 0;
                            return pax > 0 ? `${(pax / 1000).toFixed(1)}K` : '0';
                          })()}
                        </span>
                        <TrendIndicator trend={trends.passageiros} />
                      </div>
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1.5 line-clamp-2">{t('home.passageiros_periodo')}</p>
                    </CardContent>
                  </Card>
                </div>

                {dashboardStats && (dashboardStats.voosLigados || 0) > 0 &&
            <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-green-600" />
                        <CardTitle className="text-lg">{t('home.voos_ligados_tarifas')}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <Card className="border-slate-200 dark:border-slate-700">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('home.total_voos_ligados')}</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{dashboardStats.voosLigados || 0}</p>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 p-2 rounded-lg">
                                <LinkIcon className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200 dark:border-slate-700">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('home.tempo_medio_permanencia')}</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{(dashboardStats.tempoMedioPermanencia || 0).toFixed(2)}h</p>
                              </div>
                              <div className="bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 p-2 rounded-lg">
                                <Timer className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200 dark:border-slate-700">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('home.total_tarifas')}</p>
                                <p className="text-slate-900 dark:text-slate-100 text-lg font-bold">{formatCurrency(dashboardStats.totalTarifas || 0)}</p>
                              </div>
                              <div className="flex-shrink-0 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 p-2 rounded-lg">
                                <DollarSign className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200 dark:border-slate-700">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('home.voos_sem_calculo')}</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{dashboardStats.voosSemCalculo || 0}</p>
                              </div>
                              <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-2 rounded-lg">
                                <AlertCircle className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200 dark:border-slate-700">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('home.voos_isentos')}</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{dashboardStats.voosIsentos || 0}</p>
                              </div>
                              <div className="bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400 p-2 rounded-lg">
                                <ShieldCheck className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
            }

                {/* Top 10: Companhias (single airport) OR Aeroportos (multi airport) */}
                {showCompanhiasInsteadOfAeroportos && top10Companhias.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <Plane className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">Top 10 Companhias por Volume</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {top10Companhias.map((comp, index) =>
                  <Card key={comp.codigo} className="border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-base font-bold text-slate-400">#{index + 1}</span>
                                <span className="text-xs font-bold text-blue-600">{comp.codigo}</span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="bg-slate-50 dark:bg-slate-800 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 mb-0.5">{t('home.movimentos')}:</p>
                                  <p className="text-base font-bold text-slate-900">{comp.totalMovimentos}</p>
                                  <div className="flex justify-between text-[10px] mt-0.5">
                                    <span className="text-green-600">ARR: {comp.arr}</span>
                                    <span className="text-purple-600">DEP: {comp.dep}</span>
                                  </div>
                                </div>
                                <div className="bg-blue-50 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 mb-0.5">{t('home.passageiros')}:</p>
                                  <p className="text-base font-bold text-blue-900">{comp.passageiros.toLocaleString()}</p>
                                </div>
                                <div className="bg-orange-50 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 mb-0.5">{t('home.carga_total')}:</p>
                                  <p className="text-base font-bold text-orange-900">{comp.carga.toLocaleString()} kg</p>
                                </div>
                                {comp.receita > 0 && (
                                <div className="bg-green-50 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 mb-0.5">Receita (USD):</p>
                                  <p className="text-base font-bold text-green-700">${comp.receita.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                  )}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {!showCompanhiasInsteadOfAeroportos && dashboardStats && dashboardStats.top10Aeroportos && dashboardStats.top10Aeroportos.length > 0 &&
            <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">{t('home.top10_aeroportos')}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {dashboardStats.top10Aeroportos.map((aeroporto, index) =>
                  <Card key={aeroporto.id || aeroporto.codigo_icao} className="border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-base font-bold text-slate-400 dark:text-slate-500">#{index + 1}</span>
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{aeroporto.codigo || aeroporto.codigo_icao || ''}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{aeroporto.cidade || ''}</p>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="bg-slate-50 dark:bg-slate-800 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mb-0.5">{t('home.movimentos')}:</p>
                                  <p className="text-base font-bold text-slate-900 dark:text-slate-100">{aeroporto.totalMovimentos || 0}</p>
                                  <div className="flex justify-between text-[10px] mt-0.5">
                                    <span className="text-green-600">ARR: {aeroporto.movimentosArr || aeroporto.arr || 0}</span>
                                    <span className="text-purple-600">DEP: {aeroporto.movimentosDep || aeroporto.dep || 0}</span>
                                  </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-950 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mb-0.5">{t('home.passageiros')}:</p>
                                  <p className="text-base font-bold text-blue-900 dark:text-blue-300">{(aeroporto.passageiros || 0).toLocaleString()}</p>
                                  <div className="flex justify-between text-[10px] mt-0.5">
                                    <span className="text-green-600">ARR: {(aeroporto.passageirosArr || 0).toLocaleString()}</span>
                                    <span className="text-purple-600">DEP: {(aeroporto.passageirosDep || 0).toLocaleString()}</span>
                                  </div>
                                </div>

                                <div className="bg-orange-50 dark:bg-orange-950 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mb-0.5">{t('home.carga_total')}:</p>
                                  <p className="text-base font-bold text-orange-900 dark:text-orange-300">{(aeroporto.carga || 0).toLocaleString()} kg</p>
                                  <div className="flex justify-between text-[10px] mt-0.5">
                                    <span className="text-green-600">ARR: {(aeroporto.cargaArr || 0).toLocaleString()} kg</span>
                                    <span className="text-purple-600">DEP: {(aeroporto.cargaDep || 0).toLocaleString()} kg</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                  )}
                      </div>
                    </CardContent>
                  </Card>
            }
              </>
          }

            <React.Suspense fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              </div>
          }>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MovimentosChart voos={filteredVoos} isLoading={isLoading} />
                <PontualidadeChart voos={filteredVoos} isLoading={isLoading} />
              </div>
            </React.Suspense>

            <React.Suspense fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              </div>
          }>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ReceitasChart voos={filteredVoos} isLoading={isLoading} calculosTarifa={filteredCalculosTarifa} />
                <SafetyAlerts ocorrencias={filteredOcorrencias} isLoading={isLoading} />
              </div>
            </React.Suspense>

            {/* Actividade Recente */}
            {recentActivity.length > 0 && (
              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <CardTitle className="text-lg">{t('home.actividade_recente')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentActivity.map((item) => {
                      const IconComponent = item.icon;
                      let timeAgo = '';
                      try {
                        timeAgo = formatDistanceToNow(new Date(item.date), { addSuffix: true, ...(language === 'pt' ? { locale: pt } : {}) });
                      } catch {
                        timeAgo = '';
                      }
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 -mx-2 transition-colors"
                          onClick={() => window.location.href = item.link}
                        >
                          <div className={`p-1.5 rounded-lg flex-shrink-0 ${item.iconBg}`}>
                            <IconComponent className={`h-4 w-4 ${item.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{item.description}</p>
                          </div>
                          <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                            {timeAgo}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        }
      </div>
    </div>);

}