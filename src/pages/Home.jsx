import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Select from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plane,
  Clock,
  DollarSign,
  ShieldAlert,
  TrendingUp,
  Calendar,
  MapPin,
  Users,
  RefreshCw,
  AlertTriangle,
  Timer,
  Link as LinkIcon,
  AlertCircle,
  ShieldCheck,
  ClipboardCheck,
  Package } from
"lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Lazy load dos componentes de gráficos para melhor performance
const MovimentosChart = React.lazy(() => import("../components/dashboard/MovimentosChart"));
const PontualidadeChart = React.lazy(() => import("../components/dashboard/PontualidadeChart"));
const ReceitasChart = React.lazy(() => import("../components/dashboard/ReceitasChart"));
const SafetyAlerts = React.lazy(() => import("../components/dashboard/SafetyAlerts"));

import { Voo } from "@/entities/Voo";
import { VooLigado } from "@/entities/VooLigado";
import { CalculoTarifa } from "@/entities/CalculoTarifa";
import { OcorrenciaSafety } from "@/entities/OcorrenciaSafety";
import { Aeroporto } from "@/entities/Aeroporto";
import { Inspecao } from "@/entities/Inspecao";
import { User } from '@/entities/User';
import { createPageUrl } from '@/utils';
import { hasUserProfile, ensureUserProfilesExist, getAeroportosPermitidos, filtrarDadosPorAcesso, filtrarDadosPorAeroportoId, isSuperAdmin, getEmailsEmpresa, filtrarDadosPorCriador } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';

import { getDashboardStats } from '@/functions/getDashboardStats';

const formatCurrency = (value) =>
new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value || 0);

export default function DashboardInterno() {
  const { effectiveEmpresaId } = useCompanyView();
  const [voos, setVoos] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [ocorrenciasSafety, setOcorrenciasSafety] = useState([]);
  const [inspecoes, setInspecoes] = useState([]);
  const [voosLigados, setVoosLigados] = useState([]);
  const [calculosTarifa, setCalculosTarifa] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
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
      setLoadingStatus('Carregando utilizador...');
      const user = await User.me();
      const userWithProfiles = ensureUserProfilesExist(user);
      setCurrentUser(userWithProfiles);

      if (hasUserProfile(userWithProfiles, 'gestor_empresa')) {
        setLoadingStatus('Redirecionando...');
        window.location.href = createPageUrl('Credenciamento');
        return;
      }

      setLoadingStatus('Carregando aeroportos...');
      let aeroportosData = [];
      try {
        const empresaIdFiltro = effectiveEmpresaId || userWithProfiles.empresa_id;
        aeroportosData = await (empresaIdFiltro ? Aeroporto.filter({ empresa_id: empresaIdFiltro }) : Aeroporto.list());
        console.log('✅ Aeroportos carregados:', aeroportosData.length);
      } catch (err) {
        console.error('❌ Erro ao carregar aeroportos:', err);
      }

      // Filtrar aeroportos por empresa + permissões do utilizador
      const aeroportosFiltrados = getAeroportosPermitidos(userWithProfiles, aeroportosData, effectiveEmpresaId);

      setAeroportos(aeroportosFiltrados);

      setLoadingStatus('Carregando dados para gráficos...');
      const [voosDataResult, ocorrenciasDataResult, inspecoesDataResult, calculosTarifaResult] = await Promise.allSettled([
      Voo.list('-data_operacao', 500),
      OcorrenciaSafety.list('-data_ocorrencia', 50),
      Inspecao.list('-data_inspecao', 50),
      CalculoTarifa.list('-data_calculo', 1000)]
      );

      let voosData = voosDataResult.status === 'fulfilled' ? voosDataResult.value : [];
      let ocorrenciasData = ocorrenciasDataResult.status === 'fulfilled' ? ocorrenciasDataResult.value : [];
      let inspecoesData = inspecoesDataResult.status === 'fulfilled' ? inspecoesDataResult.value : [];
      let calculosTarifaData = calculosTarifaResult.status === 'fulfilled' ? calculosTarifaResult.value : [];

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

      console.log('✅ Dados carregados para gráficos');
      console.log('📊 Cálculos de Tarifa carregados:', calculosTarifaData.length);
      setLoadingStatus('Concluído!');
    } catch (error) {
      console.error("❌ Erro ao carregar dados específicos:", error);
      setLoadingStatus('Dados carregados parcialmente');
      setError(error.message || 'Erro ao carregar dados para gráficos.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveEmpresaId]);

  const loadDashboardStats = useCallback(async () => {
    if (!currentUser) return;

    setIsLoadingStats(true);
    try {
      const params = { aeroporto: selectedAeroporto, periodo: selectedPeriodo, empresaId: effectiveEmpresaId || currentUser.empresa_id };
      const response = await getDashboardStats(params);
      setDashboardStats(response.data);
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);
      setError(error.message || 'Erro ao carregar estatísticas do dashboard.');
      setDashboardStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [selectedAeroporto, selectedPeriodo, currentUser, effectiveEmpresaId]);

  const checkUserAndLoadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setLoadingStatus('Verificando utilizador...');
      // loadData já carrega o user internamente, não precisa carregar duas vezes
      await loadData();

    } catch (error) {
      console.error("❌ Erro geral no Dashboard:", error);

      if (error.response?.status === 401 || error.message?.includes('401') || error.message?.includes('not authenticated')) {
        console.log('Utilizador não autenticado, redirecionando para login');
        window.location.href = '/login';
        return;
      }

      if (String(error.message).includes('403')) {
        if (currentUser && hasUserProfile(currentUser, 'gestor_empresa')) {
          window.location.href = createPageUrl('Credenciamento');
          return;
        }
        setError('Acesso negado. Você não tem permissão para visualizar este dashboard.');
      } else {
        setError(error.message || 'Ocorreu um erro desconhecido.');
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
  { value: 'todos', label: 'Todos os Aeroportos' },
  ...aeroportos.map((aeroporto) => ({ value: aeroporto.codigo_icao, label: aeroporto.nome }))],
  [aeroportos]);

  const periodoOptions = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' }];


  if (error) {
    return (
      <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Erro:</strong> {error}
            </AlertDescription>
          </Alert>
          <div className="flex gap-4">
            <Button onClick={checkUserAndLoadData} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar Novamente
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/Home'}>
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>);

  }

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">Dashboard Operacional</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Sistema DIROPS • {new Date().toLocaleDateString('pt-AO')}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <Select
            className="w-48"
            options={aeroportoOptions}
            value={selectedAeroporto}
            onValueChange={setSelectedAeroporto}
            placeholder="Todos os Aeroportos" />


          <Select
            className="w-32"
            options={periodoOptions}
            value={selectedPeriodo}
            onValueChange={setSelectedPeriodo}
            placeholder="Período" />


          <Button onClick={() => {checkUserAndLoadData();loadDashboardStats();}} variant="outline" disabled={isLoading || isLoadingStats}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isLoadingStats ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {isLoading ?
        <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">{loadingStatus}</p>
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
                      <div className="p-1.5 rounded-lg bg-blue-50">
                        <Plane className="h-4 w-4 text-blue-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 mb-1">{dashboardStats?.totalVoos || 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1.5 line-clamp-2">Total de Voos</p>
                      {dashboardStats?.voosUnicosLigados > 0 &&
                  <p className="text-[9px] text-slate-400">
                          {dashboardStats.voosUnicosLigados} ligados, {dashboardStats.voosSemLink} sem link
                        </p>
                  }
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-sky-50">
                        <Plane className="h-4 w-4 text-sky-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 mb-1">{dashboardStats?.chegadasHoje || 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1.5 line-clamp-2">Chegadas Hoje</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-cyan-50">
                        <Plane className="h-4 w-4 text-cyan-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 mb-1">{dashboardStats?.partidasHoje || 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1.5 line-clamp-2">Partidas Hoje</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-green-50">
                        <Clock className="h-4 w-4 text-green-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 mb-1">{(dashboardStats?.taxaPontualidade || 0).toFixed(1)}%</div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1.5 line-clamp-2">Pontualidade</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className={`p-1.5 rounded-lg ${(dashboardStats?.ocorrenciasAbertas || 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <ShieldAlert className={`h-4 w-4 ${(dashboardStats?.ocorrenciasAbertas || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`} />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 mb-1">{dashboardStats?.ocorrenciasAbertas || 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1.5 line-clamp-2">Ocorrências Abertas</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-yellow-50">
                        <ClipboardCheck className="h-4 w-4 text-yellow-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 mb-1">{dashboardStats?.inspecoesPendentes || 0}</div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1.5 line-clamp-2">Inspeções Pendentes</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                      <div className="p-1.5 rounded-lg bg-indigo-50">
                        <Users className="h-4 w-4 text-indigo-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-xl font-bold text-slate-900 mb-1">
                        {(dashboardStats?.passageirosPeriodo || 0) > 0 ?
                    `${(dashboardStats.passageirosPeriodo / 1000).toFixed(1)}K` :
                    '0'}
                      </div>
                      <p className="text-[10px] font-medium text-slate-600 mb-1.5 line-clamp-2">Passageiros (Período)</p>
                    </CardContent>
                  </Card>
                </div>

                {dashboardStats && (dashboardStats.voosLigados || 0) > 0 &&
            <Card className="border-slate-200">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-green-600" />
                        <CardTitle className="text-lg">Voos Ligados & Tarifas</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <Card className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-600 mb-1">Total de Voos Ligados</p>
                                <p className="text-xl font-bold text-slate-900">{dashboardStats.voosLigados || 0}</p>
                              </div>
                              <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                                <LinkIcon className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-600 mb-1">Tempo Médio Permanência</p>
                                <p className="text-xl font-bold text-slate-900">{(dashboardStats.tempoMedioPermanencia || 0).toFixed(2)}h</p>
                              </div>
                              <div className="bg-orange-50 text-orange-600 p-2 rounded-lg">
                                <Timer className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-600 mb-1">Total de Tarifas</p>
                                <p className="text-slate-900 text-lg font-bold">{formatCurrency(dashboardStats.totalTarifas || 0)}</p>
                              </div>
                              <div className="flex-shrink-0 bg-green-50 text-green-600 p-2 rounded-lg">
                                <DollarSign className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-600 mb-1">Voos Sem Cálculo</p>
                                <p className="text-xl font-bold text-slate-900">{dashboardStats.voosSemCalculo || 0}</p>
                              </div>
                              <div className="bg-red-50 text-red-600 p-2 rounded-lg">
                                <AlertCircle className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-600 mb-1">Voos Isentos</p>
                                <p className="text-xl font-bold text-slate-900">{dashboardStats.voosIsentos || 0}</p>
                              </div>
                              <div className="bg-yellow-50 text-yellow-600 p-2 rounded-lg">
                                <ShieldCheck className="w-5 h-5" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
            }

                {dashboardStats && dashboardStats.top10Aeroportos && dashboardStats.top10Aeroportos.length > 0 &&
            <Card className="border-slate-200">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">Top 10 Aeroportos por Volume</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {dashboardStats.top10Aeroportos.map((aeroporto, index) =>
                  <Card key={aeroporto.id || aeroporto.codigo_icao} className="border-slate-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-base font-bold text-slate-400">#{index + 1}</span>
                                    <span className="text-xs font-bold text-blue-600">{aeroporto.codigo || aeroporto.codigo_icao || ''}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500">{aeroporto.cidade || ''}</p>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="bg-slate-50 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 mb-0.5">Movimentos:</p>
                                  <p className="text-base font-bold text-slate-900">{aeroporto.totalMovimentos || 0}</p>
                                  <div className="flex justify-between text-[10px] mt-0.5">
                                    <span className="text-green-600">ARR: {aeroporto.movimentosArr || aeroporto.arr || 0}</span>
                                    <span className="text-purple-600">DEP: {aeroporto.movimentosDep || aeroporto.dep || 0}</span>
                                  </div>
                                </div>

                                <div className="bg-blue-50 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 mb-0.5">Passageiros:</p>
                                  <p className="text-base font-bold text-blue-900">{(aeroporto.passageiros || 0).toLocaleString()}</p>
                                  <div className="flex justify-between text-[10px] mt-0.5">
                                    <span className="text-green-600">ARR: {(aeroporto.passageirosArr || 0).toLocaleString()}</span>
                                    <span className="text-purple-600">DEP: {(aeroporto.passageirosDep || 0).toLocaleString()}</span>
                                  </div>
                                </div>

                                <div className="bg-orange-50 rounded p-1.5">
                                  <p className="text-[10px] text-slate-600 mb-0.5">Carga Total:</p>
                                  <p className="text-base font-bold text-orange-900">{(aeroporto.carga || 0).toLocaleString()} kg</p>
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
          </>
        }
      </div>
    </div>);

}