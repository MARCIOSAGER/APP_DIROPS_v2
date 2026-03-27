import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Unlink, Plane } from 'lucide-react';
import { addDays } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { supabase } from '@/lib/supabaseClient';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { createPageUrl } from '@/utils';
import { hasUserProfile, getAeroportosPermitidos, isSuperAdmin } from '@/components/lib/userUtils';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';
import { useAeroportos, useCompanhias, useAeronaves, useModelosAeronave, useTarifasPouso, useTarifasPermanencia, useOutrasTarifas, useImpostos } from '@/components/lib/useStaticData';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useAuth } from '@/lib/AuthContext';
import { useVoos } from '@/hooks/useVoos';
import { useVoosLigados } from '@/hooks/useVoosLigados';
import { useCalculosTarifa, fetchCalculoMap } from '@/hooks/useCalculosTarifa';
import { useQueryClient } from '@tanstack/react-query';

import VoosTab from '../components/operacoes/VoosTab';
import VoosLigadosTab from '../components/operacoes/VoosLigadosTab';
import VoosSemLinkTab from '../components/operacoes/VoosSemLinkTab';
import FormVoo from '../components/operacoes/FormVoo';
import { downloadAsExcel } from '../components/lib/export';
import { calculateAllTariffs } from '../components/lib/tariffCalculations';

// Lazy-loaded modals and config panels (B-02: reduce initial chunk ~15 components)
const AeroportosConfig = React.lazy(() => import('../components/operacoes/config/AeroportosConfig'));
const CompanhiasConfig = React.lazy(() => import('../components/operacoes/config/CompanhiasConfig'));
const ModelosAeronaveConfig = React.lazy(() => import('../components/operacoes/config/ModelosAeronaveConfig'));
const RegistosAeronaveConfig = React.lazy(() => import('../components/operacoes/config/RegistosAeronaveConfig'));
const TariffDetailsModal = React.lazy(() => import('../components/operacoes/TariffDetailsModal'));

import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';
const CancelarProformaModal = React.lazy(() => import('../components/shared/CancelarProformaModal'));
const ProgressModal = React.lazy(() => import('../components/operacoes/ProgressModal'));

const GerarFaturaModal = React.lazy(() => import('../components/faturacao/GerarFaturaModal'));
import { Proforma } from '@/entities/Proforma';
import { base44 } from '@/api/base44Client';
import { registarCriacao } from '../components/lib/auditoria';
const AlterarCambioModal = React.lazy(() => import('../components/operacoes/AlterarCambioModal'));
const RecursosVooModal = React.lazy(() => import('../components/operacoes/RecursosVooModal'));
const UploadDocumentoVooModal = React.lazy(() => import('../components/operacoes/UploadDocumentoVooModal'));
const LixeiraVoosModal = React.lazy(() => import('../components/operacoes/LixeiraVoosModal'));
const DocumentosVooModal = React.lazy(() => import('../components/operacoes/DocumentosVooModal'));
const UploadMultiplosDocumentosModal = React.lazy(() => import('../components/operacoes/UploadMultiplosDocumentosModal'));
const FIDSPanel = React.lazy(() => import('../components/operacoes/FIDSPanel'));

const fmtAOA = new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' });
const formatCurrency = (value, currency = 'AOA') => {
  if (currency === 'AOA') return fmtAOA.format(value || 0);
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency }).format(value || 0);
};

// Helper: filtra tarifas por empresa_id
function filterTarifasByEmpresa(tarifas, empresaId) {
  if (!empresaId) return tarifas;
  const empresaTarifas = tarifas.filter(t => t.empresa_id === empresaId);
  const globalTarifas = tarifas.filter(t => !t.empresa_id);
  return empresaTarifas.length > 0 ? empresaTarifas : globalTarifas;
}

export default function Operacoes() {
   const { t, language } = useI18n();
   const { effectiveEmpresaId } = useCompanyView();
   const { user } = useAuth();
   const effectiveEmpresaIdRef = useRef(effectiveEmpresaId);
   effectiveEmpresaIdRef.current = effectiveEmpresaId;
  const [configuracaoSistema, setConfiguracaoSistema] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tipoMovimentoForm, setTipoMovimentoForm] = useState('ARR');
  const [editingVoo, setEditingVoo] = useState(null);
  const [vooArrToLink, setVooArrToLink] = useState(null);
  const [tariffDetailsData, setTariffDetailsData] = useState(null);
  const [gerarProformaCalculo, setGerarProformaCalculo] = useState(null);
  const [isGerarProformaModalOpen, setIsGerarProformaModalOpen] = useState(false);

  const [calculoParaAlterarCambio, setCalculoParaAlterarCambio] = useState(null);
  const [isAlterarCambioModalOpen, setIsAlterarCambioModalOpen] = useState(false);

  const [uploadDocumentoData, setUploadDocumentoData] = useState(null);
  const [isUploadDocumentoModalOpen, setIsUploadDocumentoModalOpen] = useState(false);

  const [isLixeiraModalOpen, setIsLixeiraModalOpen] = useState(false);
  const [documentosVooModalData, setDocumentosVooModalData] = useState(null);
  const [isDocumentosVooModalOpen, setIsDocumentosVooModalOpen] = useState(false);
  const [recursosVooModalData, setRecursosVooModalData] = useState(null);
  const [isRecursosVooModalOpen, setIsRecursosVooModalOpen] = useState(false);

  const [uploadMultiplosModalData, setUploadMultiplosModalData] = useState(null);
  const [isUploadMultiplosModalOpen, setIsUploadMultiplosModalOpen] = useState(false);

  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    tipoMovimento: 'todos',
    status: 'todos',
    companhia: 'todos',
    aeroporto: 'todos',
    tipoVoo: 'todos',
    statusVinculacao: 'todos',
    busca: '',
    passageirosMin: '',
    passageirosMax: '',
    cargaMin: '',
    cargaMax: '',
    origem: 'todos'
  });
  const [isFiltering, setIsFiltering] = useState(false);

  const [filtrosLigados, setFiltrosLigados] = useState({
    dataInicio: '',
    dataFim: '',
    companhia: 'todos',
    aeroportos: [],
    tipoVoo: 'todos',
    statusCalculo: 'todos',
    permanenciaMin: '',
    permanenciaMax: '',
    busca: ''
  });
  const [isFilteringLigados, setIsFilteringLigados] = useState(false);

  // --- Voos Sem Link tab state ---
  const [voosSemLink, setVoosSemLink] = useState([]);
  const [isLoadingSemLink, setIsLoadingSemLink] = useState(false);
  const [isLinkingAuto, setIsLinkingAuto] = useState(false);
  const [filtrosSemLink, setFiltrosSemLink] = useState({
    dataInicio: '',
    dataFim: '',
    tipoMovimento: 'todos',
    companhia: 'todos',
    busca: ''
  });
  const [semLinkLoaded, setSemLinkLoaded] = useState(false);

  const [sortField, setSortField] = useState('data_operacao');
  const [sortDirection, setSortDirection] = useState('desc');

  const [sortFieldLigados, setSortFieldLigados] = useState('horario_arr');
  const [sortDirectionLigados, setSortDirectionLigados] = useState('desc');

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [cancelarProformaModal, setCancelarProformaModal] = useState({ isOpen: false, proforma: null, descricao: '', onConfirm: null });

  const [progressModal, setProgressModal] = useState({
    isOpen: false,
    title: '',
    currentStep: 0,
    totalSteps: 0,
    successCount: 0,
    errorCount: 0,
    currentItem: '',
    errors: []
  });

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const getErrorMessage = (error) => {
    if (!error) return t('common.error');
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.error) return error.error;
    if (error.details) return error.details;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  };

  const { data: aeroportosCache = [], isLoading: isLoadingAeroportos } = useAeroportos();
  const { data: companhiasCache = [], isLoading: isLoadingCompanhias } = useCompanhias();
  const { data: aeronavesCache = [], isLoading: isLoadingAeronaves } = useAeronaves();
  const { data: modelosCache = [], isLoading: isLoadingModelos } = useModelosAeronave();
  const { data: tarifasPousoCache = [], isLoading: isLoadingTarifasPouso } = useTarifasPouso();
  const { data: tarifasPermanenciaCache = [], isLoading: isLoadingTarifasPermanencia } = useTarifasPermanencia();
  const { data: outrasTarifasCache = [], isLoading: isLoadingOutrasTarifas } = useOutrasTarifas();
  const { data: impostosCache = [], isLoading: isLoadingImpostos } = useImpostos();

  const empresaId = effectiveEmpresaId || user?.empresa_id;
  const queryClient = useQueryClient();

  const { data: voos = [], isLoading: isLoadingVoos } = useVoos({ empresaId });
  const { data: voosLigados = [], isLoading: isLoadingVoosLigados } = useVoosLigados({ empresaId });
  const { data: calculosTarifa = [], isLoading: isLoadingCalculos } = useCalculosTarifa({ empresaId });

  const isLoadingAll = isLoading || isLoadingVoos || isLoadingVoosLigados || isLoadingCalculos;

  const loadData = useCallback(async () => {
    if (hasUserProfile(user, 'gestor_empresa')) {
      window.location.href = createPageUrl('Credenciamento');
      return;
    }
    setIsLoading(true);
    try {
      const configData = await ConfiguracaoSistema.list().catch(() => []);
      const configuracaoSistemaData = configData.length > 0 ? configData[0] : { taxa_cambio_usd_aoa: 850 };
      setConfiguracaoSistema(configuracaoSistemaData);
    } catch (error) {
      console.error('Erro ao carregar configuracao:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData, effectiveEmpresaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // R-01: Derive data from TanStack cache via useMemo (eliminates 8 useEffect + 9 useState double-renders)
  const todosAeroportos = useMemo(() => aeroportosCache || [], [aeroportosCache]);
  const aeroportos = useMemo(() => {
    if (!aeroportosCache?.length || !user) return [];
    const allAngolan = aeroportosCache.filter(a => a.pais === 'AO');
    return getAeroportosPermitidos(user, allAngolan, effectiveEmpresaIdRef.current);
  }, [aeroportosCache, user]);
  const companhias = useMemo(() => companhiasCache || [], [companhiasCache]);
  const aeronaves = useMemo(() => aeronavesCache || [], [aeronavesCache]);
  const modelosAeronave = useMemo(() => modelosCache || [], [modelosCache]);

  const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
  const tarifasPouso = useMemo(() => filterTarifasByEmpresa(tarifasPousoCache || [], empId), [tarifasPousoCache, empId]);
  const tarifasPermanencia = useMemo(() => filterTarifasByEmpresa(tarifasPermanenciaCache || [], empId), [tarifasPermanenciaCache, empId]);
  const outrasTarifas = useMemo(() => filterTarifasByEmpresa(outrasTarifasCache || [], empId), [outrasTarifasCache, empId]);
  const impostos = useMemo(() => filterTarifasByEmpresa(impostosCache || [], empId), [impostosCache, empId]);

  // Server-side filter: build query from all filtros and reload voos
  const handleBuscarVoos = useCallback(async () => {
    setIsFiltering(true);
    try {
      const query = { deleted_at: { $is: null } };
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      if (empId) query.empresa_id = empId;

      // Date range
      if (filtros.dataInicio) query.data_operacao = { ...query.data_operacao, $gte: filtros.dataInicio };
      if (filtros.dataFim) query.data_operacao = { ...query.data_operacao, $lte: filtros.dataFim };

      // Exact-match filters
      if (filtros.tipoMovimento !== 'todos') query.tipo_movimento = filtros.tipoMovimento;
      if (filtros.status !== 'todos') query.status = filtros.status;
      if (filtros.tipoVoo !== 'todos') query.tipo_voo = filtros.tipoVoo;
      if (filtros.aeroporto !== 'todos') query.aeroporto_operacao = filtros.aeroporto;

      // Origem (created_by) filter
      if (filtros.origem === 'flightaware') query.created_by = { $ilike: '%FlightAware%' };
      else if (filtros.origem === 'sistema') query.created_by = { $ilike: '%import%' };
      else if (filtros.origem === 'manual') query.created_by = { $is: null };

      // Search: handled separately with .or() to search both numero_voo and registo_aeronave

      // Companhia: server-side filter by ICAO + IATA codes via $in
      if (filtros.companhia !== 'todos' && filtros.companhia !== 'outro') {
        const comp = companhias.find(c => c.codigo_icao === filtros.companhia);
        const codes = [filtros.companhia];
        if (comp?.codigo_iata && comp.codigo_iata !== filtros.companhia) codes.push(comp.codigo_iata);
        query.companhia_aerea = { $in: codes };
      }

      // Passageiros range
      if (filtros.passageirosMin) query.passageiros_total = { ...query.passageiros_total, $gte: parseInt(filtros.passageirosMin) };
      if (filtros.passageirosMax) query.passageiros_total = { ...query.passageiros_total, $lte: parseInt(filtros.passageirosMax) };

      // Carga range
      if (filtros.cargaMin) query.carga_kg = { ...query.carga_kg, $gte: parseFloat(filtros.cargaMin) };
      if (filtros.cargaMax) query.carga_kg = { ...query.carga_kg, $lte: parseFloat(filtros.cargaMax) };

      // If search text, use direct supabase query with .or() for numero_voo + registo_aeronave
      let data;
      if (filtros.busca) {
        let q = supabase.from('voo').select('*');
        // Apply all filters manually
        q = q.is('deleted_at', null);
        if (query.empresa_id) q = q.eq('empresa_id', query.empresa_id);
        if (query.data_operacao?.$gte) q = q.gte('data_operacao', query.data_operacao.$gte);
        if (query.data_operacao?.$lte) q = q.lte('data_operacao', query.data_operacao.$lte);
        if (query.tipo_movimento) q = q.eq('tipo_movimento', query.tipo_movimento);
        if (query.status) q = q.eq('status', query.status);
        if (query.tipo_voo) q = q.eq('tipo_voo', query.tipo_voo);
        if (query.aeroporto_operacao) q = q.eq('aeroporto_operacao', query.aeroporto_operacao);
        if (query.companhia_aerea?.$in) q = q.in('companhia_aerea', query.companhia_aerea.$in);
        if (query.created_by?.$ilike) q = q.ilike('created_by', query.created_by.$ilike);
        else if (query.created_by?.$is === null) q = q.is('created_by', null);
        // OR search across numero_voo and registo_aeronave
        q = q.or(`numero_voo.ilike.%${filtros.busca}%,registo_aeronave.ilike.%${filtros.busca}%`);
        q = q.order('data_operacao', { ascending: false });
        // Paginate
        const PAGE = 500;
        let all = [];
        let from = 0;
        while (true) {
          const { data: batch, error } = await q.range(from, from + PAGE - 1);
          if (error) throw error;
          if (!batch || batch.length === 0) break;
          all = all.concat(batch);
          if (batch.length < PAGE) break;
          from += PAGE;
        }
        data = all;
      } else {
        data = await Voo.filter(query, '-data_operacao');
      }
      queryClient.setQueryData(['voos', empresaId], data);
      // Reload voosLigados so statusVinculacao filter works correctly
      const empIdVl = effectiveEmpresaIdRef.current || user?.empresa_id;
      if (empIdVl) {
        const vlData = await VooLigado.filter({ empresa_id: empId }, '-created_date');
        queryClient.setQueryData(['voos-ligados', empresaId], vlData);
      }
    } catch (error) {
      console.error('Erro ao filtrar voos:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.erro_filtrar'),
        message: t('operacoes.erro_filtrar_msg')
      });
    } finally {
      setIsFiltering(false);
    }
  }, [filtros, user, companhias, t]);

  // Voos Ligados: server-side reload when user clicks "Buscar"
  const handleBuscarLigados = useCallback(async () => {
    setIsFilteringLigados(true);
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;

      // 1. Reload voos with date range (server-side)
      const vooQuery = { deleted_at: { $is: null } };
      if (empId) vooQuery.empresa_id = empId;
      if (filtrosLigados.dataInicio) {
        vooQuery.data_operacao = { ...vooQuery.data_operacao, $gte: filtrosLigados.dataInicio };
      }
      if (filtrosLigados.dataFim) {
        vooQuery.data_operacao = { ...vooQuery.data_operacao, $lte: filtrosLigados.dataFim };
      }

      const voosData = await Voo.filter(vooQuery, '-data_operacao');
      queryClient.setQueryData(['voos', empresaId], voosData);

      // 2. Reload voo_ligados + calculos
      const vlFilters = empId ? { empresa_id: empId } : {};
      const [vlData, calculosData] = await Promise.all([
        VooLigado.filter(vlFilters, '-created_date'),
        empId
          ? fetchCalculoMap(empId)
          : Promise.resolve([]),
      ]);

      queryClient.setQueryData(['voos-ligados', empresaId], vlData);
      queryClient.setQueryData(['calculos-tarifa', empresaId], calculosData);
    } catch (error) {
      console.error('❌ Erro ao buscar voos ligados:', error);
    } finally {
      setIsFilteringLigados(false);
    }
  }, [filtrosLigados.dataInicio, filtrosLigados.dataFim, user]);

  const voosLigadosValidos = useMemo(() => {
    // Deduplicate by id (pagination can return overlapping rows)
    const seen = new Set();
    return voosLigados.filter(vooLigado => {
      if (seen.has(vooLigado.id)) return false;
      seen.add(vooLigado.id);
      const vooArrExiste = voos.some(v => v.id === vooLigado.id_voo_arr);
      const vooDepExiste = voos.some(v => v.id === vooLigado.id_voo_dep);
      return vooArrExiste && vooDepExiste;
    });
  }, [voos, voosLigados]);

  // --- Voos Sem Link: compute from existing data ---
  const voosSemLinkComputed = useMemo(() => {
    if (!voos.length) return [];
    const linkedVooIds = new Set();
    voosLigados.forEach(vl => {
      linkedVooIds.add(vl.id_voo_arr);
      linkedVooIds.add(vl.id_voo_dep);
    });
    return voos.filter(v => !linkedVooIds.has(v.id) && v.status !== 'Cancelado');
  }, [voos, voosLigados]);

  const loadVoosSemLink = useCallback(async () => {
    setIsLoadingSemLink(true);
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      if (!empId) return;

      const { data, error } = await supabase.rpc('get_voos_sem_link', {
        p_empresa_id: empId,
        p_data_inicio: filtrosSemLink.dataInicio || null,
        p_data_fim: filtrosSemLink.dataFim || null,
        p_tipo: filtrosSemLink.tipoMovimento === 'todos' ? null : filtrosSemLink.tipoMovimento,
        p_companhia: filtrosSemLink.companhia === 'todos' ? null : filtrosSemLink.companhia,
        p_registo: filtrosSemLink.registo === 'todos' || !filtrosSemLink.registo ? null : filtrosSemLink.registo,
        p_busca: filtrosSemLink.busca || null,
      });

      if (error) throw error;
      setVoosSemLink(data || []);
      setSemLinkLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar voos sem link:', error);
    } finally {
      setIsLoadingSemLink(false);
    }
  }, [filtrosSemLink, user]);

  const handleLinkarAutomatico = useCallback(async () => {
    const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
    if (!empId) return;
    setIsLinkingAuto(true);
    try {
      const { data, error } = await supabase.rpc('link_and_calculate_pending', { p_empresa_id: empId });
      if (error) throw error;
      const linked = data?.linked ?? data?.[0]?.linked ?? 0;
      const calculated = data?.calculated ?? data?.[0]?.calculated ?? 0;
      setSuccessInfo({
        isOpen: true,
        title: 'Link Automático Concluído',
        message: `Linkados: ${linked}, Tarifas calculadas: ${calculated}`
      });
      // Reload both main data and sem link tab
      queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
      await loadVoosSemLink();
    } catch (error) {
      console.error('Erro no link automático:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro no Link Automático',
        message: error.message || 'Erro ao executar link automático'
      });
    } finally {
      setIsLinkingAuto(false);
    }
  }, [user, loadData, loadVoosSemLink]);

  const handleLinkarManual = useCallback(async (arrVoo, depVoo) => {
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      const arrDateTime = new Date(`${arrVoo.data_operacao}T${arrVoo.horario_real || arrVoo.horario_previsto || '00:00'}`);
      const depDateTime = new Date(`${depVoo.data_operacao}T${depVoo.horario_real || depVoo.horario_previsto || '00:00'}`);
      const tempoPermanenciaMin = Math.round((depDateTime.getTime() - arrDateTime.getTime()) / (1000 * 60));

      const vooLigadoData = {
        id_voo_arr: arrVoo.id,
        id_voo_dep: depVoo.id,
        tempo_permanencia_min: tempoPermanenciaMin,
        ...(empId ? { empresa_id: empId } : {})
      };

      const newVooLigado = await VooLigado.create(vooLigadoData);

      // Update voo_ligado_id on both voos
      await Promise.all([
        Voo.update(arrVoo.id, { voo_ligado_id: newVooLigado.id }),
        Voo.update(depVoo.id, { voo_ligado_id: newVooLigado.id })
      ]);

      // Calculate tariff
      const { error: calcError } = await supabase.rpc('calculate_tariff', { p_voo_ligado_id: newVooLigado.id });
      if (calcError) console.warn('Aviso: Erro ao calcular tarifa:', calcError.message);

      setSuccessInfo({
        isOpen: true,
        title: 'Voos Linkados',
        message: `${arrVoo.numero_voo} (ARR) linkado com ${depVoo.numero_voo} (DEP)`
      });

      // Reload
      queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
      await loadVoosSemLink();
    } catch (error) {
      console.error('Erro ao linkar manualmente:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Linkar',
        message: error.message || 'Erro ao linkar voos'
      });
    }
  }, [user, loadData, loadVoosSemLink]);

  // Stats for sem link tab
  const semLinkStats = useMemo(() => {
    const source = semLinkLoaded ? voosSemLink : voosSemLinkComputed;
    const arrCount = source.filter(v => v.tipo_movimento === 'ARR').length;
    const depCount = source.filter(v => v.tipo_movimento === 'DEP').length;

    // Sugestões: same registo within 7 days (ARR-DEP pairs)
    const arrVoos = source.filter(v => v.tipo_movimento === 'ARR');
    const depVoos = source.filter(v => v.tipo_movimento === 'DEP');
    let sugestoes = 0;
    arrVoos.forEach(arr => {
      if (!arr.registo_aeronave) return;
      const arrDate = new Date(arr.data_operacao);
      const hasMatch = depVoos.some(dep =>
        dep.registo_aeronave === arr.registo_aeronave &&
        new Date(dep.data_operacao) >= arrDate &&
        new Date(dep.data_operacao) <= addDays(arrDate, 7)
      );
      if (hasMatch) sugestoes++;
    });

    return { total: source.length, arr: arrCount, dep: depCount, sugestoes };
  }, [voosSemLink, voosSemLinkComputed, semLinkLoaded]);

  // Get suggestions for a specific voo
  const getSugestoesPar = useCallback((voo) => {
    const source = semLinkLoaded ? voosSemLink : voosSemLinkComputed;
    if (!voo.registo_aeronave) return [];
    const vooDate = new Date(voo.data_operacao);

    if (voo.tipo_movimento === 'ARR') {
      // Suggest DEP with same registo, DEP after ARR (same day: check time), <= ARR + 7 days
      return source.filter(v => {
        if (v.tipo_movimento !== 'DEP' || v.registo_aeronave !== voo.registo_aeronave || v.id === voo.id) return false;
        const vDate = new Date(v.data_operacao);
        if (vDate < vooDate || vDate > addDays(vooDate, 7)) return false;
        // Same day: DEP time must be after ARR time
        if (v.data_operacao === voo.data_operacao) {
          const depTime = v.horario_real || v.horario_previsto || '23:59';
          const arrTime = voo.horario_real || voo.horario_previsto || '00:00';
          if (depTime <= arrTime) return false;
        }
        return true;
      }).sort((a, b) => new Date(a.data_operacao) - new Date(b.data_operacao));
    } else {
      // DEP voo: suggest ARR with same registo, ARR before DEP, >= DEP - 7 days
      return source.filter(v => {
        if (v.tipo_movimento !== 'ARR' || v.registo_aeronave !== voo.registo_aeronave || v.id === voo.id) return false;
        const vDate = new Date(v.data_operacao);
        if (vDate > vooDate || vDate < addDays(vooDate, -7)) return false;
        // Same day: ARR time must be before DEP time
        if (v.data_operacao === voo.data_operacao) {
          const arrTime = v.horario_real || v.horario_previsto || '00:00';
          const depTime = voo.horario_real || voo.horario_previsto || '23:59';
          if (arrTime >= depTime) return false;
        }
        return true;
      }).sort((a, b) => new Date(b.data_operacao) - new Date(a.data_operacao));
    }
  }, [voosSemLink, voosSemLinkComputed, semLinkLoaded]);

  const handleOpenForm = (tipo, voo = null, vooArrToLinkParam = null) => {
    setTipoMovimentoForm(tipo);
    setEditingVoo(voo);
    setVooArrToLink(vooArrToLinkParam);
    setIsFormOpen(true);
  };

  // Server-side tariff calculation via PostgreSQL stored procedure
  // Single SQL call instead of 5+ API requests per voo
  const _recalculateSingleTariff = useCallback(async (vooLigado) => {
    try {
      const { data, error } = await supabase.rpc('calculate_tariff', {
        p_voo_ligado_id: vooLigado.id
      });

      if (error) {
        console.error('❌ Erro no cálculo SQL:', error.message);
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('❌ ========== ERRO NO RECÁLCULO ==========');
      console.error('   Erro completo:', error);
      throw error;
    }
  }, []);

  // Calcular estacionamento quando há troca de aeronave
  // Procura a chegada mais recente da aeronave DEP no mesmo aeroporto
  const calculateParkingForSwappedAircraft = (registoDep, aeroportoOperacao, depDateTime, voos, voosLigados) => {
    try {
      // Normalizar registo para comparação
      const normalizeReg = (r) => r ? r.trim().toUpperCase().replace(/[\s\-_.]/g, '') : '';
      const registoNorm = normalizeReg(registoDep);

      // Encontrar ARRs no mesmo aeroporto com o mesmo registo
      const arrsMatch = voos
        .filter(v =>
          v.tipo_movimento === 'ARR' &&
          v.aeroporto_operacao === aeroportoOperacao &&
          normalizeReg(v.registo_aeronave) === registoNorm
        )
        .map(v => {
          const dt = new Date(`${v.data_operacao}T${v.horario_real || v.horario_previsto}`);
          return { ...v, dateTime: dt };
        })
        .filter(v => v.dateTime < depDateTime) // Apenas antes do DEP
        .sort((a, b) => b.dateTime - a.dateTime); // Mais recente primeiro

      // Para cada ARR, verificar se já tem DEP linkado
      for (const arrVoo of arrsMatch) {
        const linkedAsDep = voosLigados.find(vl => vl.id_voo_arr === arrVoo.id);
        if (!linkedAsDep) {
          // Esta ARR não tem DEP — é a chegada desta aeronave
          const minutes = Math.round((depDateTime.getTime() - arrVoo.dateTime.getTime()) / (1000 * 60));
          return { minutes, source: 'auto' };
        }
      }

      // Não encontrou ARR sem DEP linkado
      console.warn(`⚠️ Não encontrada chegada para ${registoDep} em ${aeroportoOperacao}`);
      return { minutes: null, source: 'manual' };
    } catch (err) {
      console.error('Erro ao calcular estacionamento:', err);
      return { minutes: null, source: 'manual' };
    }
  };

  const handleSaveVoo = async ({ vooData, linkedArrVooId }) => {
    let tariffsCalculatedSuccessfully = false; 

    try {
      let savedVoo;
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      const vooDataWithMeta = {
        ...vooData,
        updated_by: user?.email || 'sistema',
        ...(empId && !editingVoo ? { empresa_id: empId } : {})
      };

      if (editingVoo) {
        await Voo.update(editingVoo.id, vooDataWithMeta);
        savedVoo = { ...editingVoo, ...vooDataWithMeta, id: editingVoo.id };
      } else {
        savedVoo = await Voo.create(vooDataWithMeta);
      }

      // Se é um voo DEP com vinculação ARR, criar/atualizar o VooLigado e calcular tarifas
      if (savedVoo.tipo_movimento === 'DEP' && linkedArrVooId) {


        // Buscar apenas o voo salvo fresco + usar state para dados estáticos
        const [freshSavedVoo, freshLinkedVoo] = await Promise.all([
          Voo.filter({ id: { $eq: savedVoo.id } }).then(r => r[0]),
          Voo.filter({ id: { $eq: linkedArrVooId } }).then(r => r[0])
        ]);

        // Merge fresh voo data into state arrays
        const voosAtualizadosBanco = voos.map(v => {
          if (v.id === savedVoo.id) return freshSavedVoo || { ...v, ...vooData };
          if (v.id === linkedArrVooId) return freshLinkedVoo || v;
          return v;
        });
        // Add if not in state (new voo)
        if (!voos.find(v => v.id === savedVoo.id) && freshSavedVoo) {
          voosAtualizadosBanco.push(freshSavedVoo);
        }

        const voosLigadosBanco = voosLigados;
        const aeronavesAtualizadas = aeronaves;
        const tarifasPousoAtualizadas = tarifasPouso;
        const tarifasPermanenciaAtualizadas = tarifasPermanencia;
        const outrasTarifasAtualizadas = outrasTarifas;
        const impostosAtualizadosBanco = impostos;
        const aeroportosAtualizados = todosAeroportos;

        const vooArr = voosAtualizadosBanco.find(v => v.id === linkedArrVooId);
        const vooDep = voosAtualizadosBanco.find(v => v.id === savedVoo.id);

        if (vooArr && vooDep) {
          const arrDateTime = new Date(`${vooArr.data_operacao}T${vooArr.horario_real || vooArr.horario_previsto}`);
          const depDateTime = new Date(`${vooDep.data_operacao}T${vooDep.horario_real || vooDep.horario_previsto}`);
          const tempoPermanenciaMin = Math.round((depDateTime.getTime() - arrDateTime.getTime()) / (1000 * 60));

          // Verificar se já existe vinculação (agora com constraint única no banco)
          const existingLink = voosLigadosBanco.find(vl => 
            vl.id_voo_arr === linkedArrVooId && vl.id_voo_dep === savedVoo.id
          );

          const vooLigadoData = {
            id_voo_arr: linkedArrVooId,
            id_voo_dep: savedVoo.id,
            tempo_permanencia_min: tempoPermanenciaMin,
            registo_alterado: vooData.registo_alterado || false,
            registo_dep: vooData.registo_alterado ? vooData.registo_dep : null,
            ...(empId ? { empresa_id: empId } : {})
          };

          // Se houve troca de registo, calcular estacionamento pela chegada da aeronave DEP
          if (vooData.registo_alterado && vooData.registo_dep) {
            const parkingResult = calculateParkingForSwappedAircraft(
              vooData.registo_dep,
              vooArr.aeroporto_operacao,
              depDateTime,
              voosAtualizadosBanco,
              voosLigadosBanco
            );
            vooLigadoData.tempo_estacionamento_min = parkingResult.minutes;
            vooLigadoData.estacionamento_origem = parkingResult.source;
          }

          let vooLigadoInstance;

          if (existingLink) {
            await VooLigado.update(existingLink.id, vooLigadoData);
            vooLigadoInstance = { ...existingLink, ...vooLigadoData };
          } else {
            vooLigadoInstance = await VooLigado.create(vooLigadoData);
          }

          // Atualizar voos com voo_ligado_id
          try {
            const vooLigadoUpdates = [];
            if (vooArr.voo_ligado_id !== vooLigadoInstance.id) {
              vooLigadoUpdates.push(Voo.update(linkedArrVooId, { voo_ligado_id: vooLigadoInstance.id }));
            }
            if (vooDep.voo_ligado_id !== vooLigadoInstance.id) {
              vooLigadoUpdates.push(Voo.update(savedVoo.id, { voo_ligado_id: vooLigadoInstance.id }));
            }
            if (vooLigadoUpdates.length > 0) {
              await Promise.all(vooLigadoUpdates);
            }

          } catch (updateError) {
            console.warn('⚠️ Erro ao atualizar voo_ligado_id (não crítico):', updateError);
          }

          // Calcular tarifas automaticamente com dados FRESCOS
          try {
            // Usar aeroportos atualizados do banco
            const aeroportoOperacao = aeroportosAtualizados.find(a => a.codigo_icao === vooArr.aeroporto_operacao);

            if (!aeroportoOperacao) {
              console.error('❌ CRÍTICO: Aeroporto não encontrado:', vooArr.aeroporto_operacao);
              console.error('   Aeroportos disponíveis:', aeroportosAtualizados.map(a => a.codigo_icao));
              throw new Error(`Aeroporto "${vooArr.aeroporto_operacao}" não encontrado na base de dados.`);
            }

            const aeronaveDoVoo = aeronavesAtualizadas.find(a => a.registo === vooDep.registo_aeronave);
            if (!aeronaveDoVoo) {
              console.error('❌ CRÍTICO: Aeronave não encontrada:', vooDep.registo_aeronave);
              console.error('   Aeronaves disponíveis:', aeronavesAtualizadas.map(a => a.registo));
              throw new Error(`Aeronave com registo "${vooDep.registo_aeronave}" não encontrada. Verifique se está cadastrada em Configurações > Registos.`);
            }

            if (!aeronaveDoVoo.mtow_kg) {
              console.error('❌ CRÍTICO: Aeronave sem MTOW:', aeronaveDoVoo.registo);
              throw new Error(`Aeronave "${aeronaveDoVoo.registo}" não possui MTOW configurado. Configure em Configurações > Registos.`);
            }

            const currentConfiguracao = {
              aeroportos: aeroportosAtualizados,
              aeronaves: aeronavesAtualizadas,
              tarifasPouso: tarifasPousoAtualizadas,
              tarifasPermanencia: tarifasPermanenciaAtualizadas,
              outrasTarifas: outrasTarifasAtualizadas,
              taxaCambio: configuracaoSistema?.taxa_cambio_usd_aoa || 850
            };

            const calculatedTariffs = await calculateAllTariffs(
              vooLigadoInstance, 
              vooArr,
              vooDep,
              aeroportoOperacao,
              currentConfiguracao,
              impostosAtualizadosBanco
            );

            if (!calculatedTariffs) {
              console.error('❌ CRÍTICO: calculateAllTariffs retornou null');
              throw new Error('Função calculateAllTariffs retornou null - verifique logs anteriores para detalhes.');
            }

            const calculoComVooLigado = {
              ...calculatedTariffs,
              voo_ligado_id: vooLigadoInstance.id,
              empresa_id: vooLigadoInstance.empresa_id || vooDep.empresa_id
            };

            // Use SQL RPC for reliable upsert (handles existing records)
            try {
              await _recalculateSingleTariff(vooLigadoInstance);
            } catch (rpcErr) {
              // Fallback: try entity create/update
              const existingCalcArr = await CalculoTarifa.filter({ voo_ligado_id: { $eq: vooLigadoInstance.id } });
              if (existingCalcArr.length > 0) {
                await CalculoTarifa.update(existingCalcArr[0].id, calculoComVooLigado);
              } else {
                await CalculoTarifa.create(calculoComVooLigado);
              }
            }

            tariffsCalculatedSuccessfully = true;
          } catch (calcError) {
            console.error('❌ ========== ERRO CRÍTICO NO CÁLCULO AUTOMÁTICO ==========');
            console.error('   Erro completo:', calcError);
            console.error('   Tipo:', calcError?.name);
            console.error('   Mensagem:', getErrorMessage(calcError));
            console.error('   Stack:', calcError?.stack);
            
            const errorMessage = getErrorMessage(calcError);
            
            setAlertInfo({
              isOpen: true,
              type: 'error',
              title: t('operacoes.erro_calculo_automatico'),
              message: `${errorMessage}`,
              showCancel: false,
              confirmText: t('operacoes.entendi')
            });
          }
        } else {
          console.warn('⚠️ Voo ARR ou DEP não encontrado:', linkedArrVooId, savedVoo.id);
        }
      }

      // Se estamos EDITANDO um voo ARR que está vinculado, recalcular
      if (editingVoo && savedVoo.tipo_movimento === 'ARR') {

        // Usar voosLigados do state (não recarregar do banco)
        const vooLigadoExistente = voosLigados.find(vl => vl.id_voo_arr === savedVoo.id);

        if (vooLigadoExistente) {
          try {
              // Usar state + merge do voo editado
              const vooArrAtualizado = { ...savedVoo, ...vooData };
              const vooDepAtualizado = voos.find(v => v.id === vooLigadoExistente.id_voo_dep);
              const aeroportoOperacao = todosAeroportos.find(a => a.codigo_icao === vooArrAtualizado?.aeroporto_operacao);

              if (vooArrAtualizado && vooDepAtualizado && aeroportoOperacao) {
                const currentConfiguracao = {
                  aeroportos: todosAeroportos,
                  aeronaves: aeronaves,
                  tarifasPouso: tarifasPouso,
                  tarifasPermanencia: tarifasPermanencia,
                  outrasTarifas: outrasTarifas,
                  taxaCambio: configuracaoSistema?.taxa_cambio_usd_aoa || 850
                };

                const calculatedTariffs = await calculateAllTariffs(
                  vooLigadoExistente,
                  vooArrAtualizado,
                  vooDepAtualizado,
                  aeroportoOperacao,
                  currentConfiguracao,
                  impostos
                );

                if (calculatedTariffs) {
                  const calculoComVooLigado = {
                    ...calculatedTariffs,
                    voo_ligado_id: vooLigadoExistente.id,
                    empresa_id: vooLigadoExistente.empresa_id || vooDepAtualizado.empresa_id
                  };

                  // Use state instead of fetching from DB
                  const existingCalculo = calculosTarifa.find(ct => ct.voo_ligado_id === vooLigadoExistente.id || ct.voo_id === vooDepAtualizado.id);

                  if (existingCalculo) {
                    await CalculoTarifa.update(existingCalculo.id, calculoComVooLigado);
                  } else {
                    await CalculoTarifa.create(calculoComVooLigado);
                  }

                  tariffsCalculatedSuccessfully = true;
                } else {
                  throw new Error('calculateAllTariffs retornou null');
                }
              } else {
                throw new Error('Dados incompletos para recálculo');
              }
            } catch (recalcError) {
            console.error('❌ Erro ao recalcular após editar ARR:', recalcError);
            const errorMessage = getErrorMessage(recalcError);
            setAlertInfo({
              isOpen: true,
              type: 'warning',
              title: t('operacoes.aviso'),
              message: errorMessage
            });
          }
        }
      }

      setIsFormOpen(false);
      setEditingVoo(null);
      setVooArrToLink(null);

      queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });

      setSuccessInfo({
        isOpen: true,
        title: editingVoo ? t('operacoes.voo_atualizado') : t('operacoes.voo_criado'),
        message: `${vooData.numero_voo}${tariffsCalculatedSuccessfully ? t(editingVoo ? 'operacoes.e_tarifas_recalculadas' : 'operacoes.e_tarifas_calculadas') : ''}.`
      });
    } catch (error) {
      console.error('Erro ao salvar voo:', error);
      const errorMessage = getErrorMessage(error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.erro_salvar_voo'),
        message: errorMessage || t('operacoes.erro_salvar_voo_msg')
      });
    }
  };

  const handleCancelarVoo = async (voo) => {
    setAlertInfo({
      isOpen: true,
      type: 'warning',
      title: t('operacoes.cancelar_voo'),
      message: `${t('operacoes.cancelar_voo')} ${voo.numero_voo}?`,
      showCancel: true,
      confirmText: t('operacoes.cancelar_voo'),
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          await Voo.update(voo.id, { ...voo, status: 'Cancelado', updated_by: user?.email || 'sistema' });
          queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
          setSuccessInfo({
            isOpen: true,
            title: t('operacoes.voo_cancelado'),
            message: `${voo.numero_voo}`
          });
        } catch (error) {
          console.error('Erro ao cancelar voo:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: t('operacoes.erro_cancelar'),
            message: t('operacoes.erro_cancelar_msg')
          });
        }
      }
    });
  };

  const handleExcluirVoo = async (voo) => {
    const doMoverLixeira = async (motivo) => {
      try {
        // Cancel active proformas linked to this voo
        try {
          const proformasVoo = await Proforma.filter({ voo_id: voo.id });
          for (const pf of proformasVoo) {
            if (pf.status !== 'cancelada' && pf.status !== 'paga') {
              await Proforma.update(pf.id, {
                status: 'cancelada',
                motivo_cancelamento: `Voo ${voo.numero_voo} movido para lixeira. Motivo: ${motivo}`,
                cancelado_por: user?.email || 'sistema',
                data_cancelamento: new Date().toISOString()
              });
            }
          }
        } catch (err) { console.warn('Operação secundária falhou:', err.message); }

        // Deslincar voo_ligado associado (se existir)
        try {
          const vooLigadoAssociado = voosLigados.find(vl =>
            vl.id_voo_arr === voo.id || vl.id_voo_dep === voo.id
          );
          if (vooLigadoAssociado) {
            // Null out voo_ligado_id on the other voo
            const outroVooId = vooLigadoAssociado.id_voo_arr === voo.id
              ? vooLigadoAssociado.id_voo_dep
              : vooLigadoAssociado.id_voo_arr;
            if (outroVooId) {
              await Voo.update(outroVooId, { voo_ligado_id: null });
            }
            await Voo.update(voo.id, { voo_ligado_id: null });
            await VooLigado.delete(vooLigadoAssociado.id);
          }
        } catch (err) { console.warn('Operação secundária falhou:', err.message); }

        await Voo.update(voo.id, {
          deleted_at: new Date().toISOString(),
          deleted_by: user?.email || 'sistema'
        });

        queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });

        setSuccessInfo({
          isOpen: true,
          title: t('operacoes.voo_lixeira'),
          message: `${voo.numero_voo}`
        });
      } catch (error) {
        console.error('Erro ao mover voo:', error);
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('operacoes.erro_mover'),
          message: t('operacoes.erro_mover_msg')
        });
      }
    };

    // Check for active proformas on this voo
    let proformasAtivas = [];
    try {
      const pfs = await Proforma.filter({ voo_id: voo.id });
      proformasAtivas = pfs.filter(pf => pf.status !== 'cancelada' && pf.status !== 'paga');
    } catch (err) { console.warn('Operação secundária falhou:', err.message); }

    if (proformasAtivas.length > 0) {
      setCancelarProformaModal({
        isOpen: true,
        proforma: proformasAtivas[0],
        descricao: t('proforma.descricao_cancel_voo'),
        onConfirm: async (motivo) => {
          setCancelarProformaModal(prev => ({ ...prev, isOpen: false }));
          await doMoverLixeira(motivo);
        }
      });
    } else {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.mover_lixeira'),
        message: `${voo.numero_voo}?`,
        showCancel: true,
        confirmText: t('operacoes.mover'),
        onConfirm: async () => {
          setAlertInfo(prev => ({ ...prev, isOpen: false }));
          await doMoverLixeira('Movido para lixeira pelo utilizador.');
        }
      });
    }
  };

  const handleExcluirPermanentemente = async (voo) => {
    if (!isSuperAdmin(user)) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.acesso_negado_titulo'),
        message: t('operacoes.acesso_negado_excluir')
      });
      return;
    }

    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: t('operacoes.excluir_permanentemente'),
      message: `${voo.numero_voo}? ${t('operacoes.excluir_permanentemente')}`,
      showCancel: true,
      confirmText: t('operacoes.excluir_permanentemente'),
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          await Voo.delete(voo.id);
          queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
          setSuccessInfo({
            isOpen: true,
            title: t('operacoes.voo_excluido'),
            message: `${voo.numero_voo}`
          });
        } catch (error) {
          console.error('Erro ao excluir permanentemente:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: t('operacoes.erro_excluir'),
            message: t('operacoes.erro_excluir_msg')
          });
        }
      }
    });
  };

  const handleExcluirVooLigado = async (vooLigado) => {
    const depVoo = voos.find(v => v.id === vooLigado.id_voo_dep);
    const arrVoo = voos.find(v => v.id === vooLigado.id_voo_arr);

    const doDelete = async (motivo) => {
      try {
        const calculoAssociado = calculosTarifa.find(ct =>
          ct.voo_id === vooLigado.id_voo_dep || ct.voo_ligado_id === vooLigado.id
        );

        // Cancelar proformas associadas ao calculo
        if (calculoAssociado) {
          const proformasAssociadas = await Proforma.filter({ calculo_tarifa_id: calculoAssociado.id });
          for (const pf of proformasAssociadas) {
            if (pf.status !== 'cancelada' && pf.status !== 'paga') {
              await Proforma.update(pf.id, {
                status: 'cancelada',
                motivo_cancelamento: `Vinculação excluída: ${arrVoo?.numero_voo || 'N/A'} (ARR) → ${depVoo?.numero_voo || 'N/A'} (DEP). Motivo: ${motivo}`,
                cancelado_por: user?.email || 'sistema',
                data_cancelamento: new Date().toISOString()
              });
            }
          }
          await CalculoTarifa.delete(calculoAssociado.id);
        }

        // Remover referência voo_ligado_id nos voos
        if (arrVoo && arrVoo.voo_ligado_id === vooLigado.id) {
          await Voo.update(arrVoo.id, { voo_ligado_id: null });
        }
        if (depVoo && depVoo.voo_ligado_id === vooLigado.id) {
          await Voo.update(depVoo.id, { voo_ligado_id: null });
        }

        // Excluir o VooLigado
        await VooLigado.delete(vooLigado.id);

        queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });

        setSuccessInfo({
          isOpen: true,
          title: t('operacoes.vinculacao_excluida'),
          message: t('operacoes.vinculacao_excluida_msg')
        });
      } catch (error) {
        console.error('Erro ao excluir vinculação:', error);
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('operacoes.erro_excluir'),
          message: t('operacoes.erro_excluir_vinculacao')
        });
      }
    };

    // Check if there are associated proformas that need cancellation justification
    const calculoAssociado = calculosTarifa.find(ct =>
      ct.voo_id === vooLigado.id_voo_dep || ct.voo_ligado_id === vooLigado.id
    );
    let proformasAtivas = [];
    if (calculoAssociado) {
      try {
        const pfs = await Proforma.filter({ calculo_tarifa_id: calculoAssociado.id });
        proformasAtivas = pfs.filter(pf => pf.status !== 'cancelada' && pf.status !== 'paga');
      } catch (err) { console.warn('Operação secundária falhou:', err.message); }
    }

    if (proformasAtivas.length > 0) {
      // Has active proformas — ask for justification before deleting
      setCancelarProformaModal({
        isOpen: true,
        proforma: proformasAtivas[0],
        descricao: t('proforma.descricao_cancel_voo_ligado'),
        onConfirm: async (motivo) => {
          setCancelarProformaModal(prev => ({ ...prev, isOpen: false }));
          await doDelete(motivo);
        }
      });
    } else {
      // No active proformas — standard confirmation
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.excluir_vinculacao'),
        message: `${arrVoo?.numero_voo || 'N/A'} (ARR) / ${depVoo?.numero_voo || 'N/A'} (DEP)`,
        showCancel: true,
        confirmText: t('operacoes.excluir_vinculacao'),
        onConfirm: async () => {
          setAlertInfo(prev => ({ ...prev, isOpen: false }));
          await doDelete('Vinculação excluída pelo utilizador.');
        }
      });
    }
  };

  const handleRecalcularTarifaSingle = async (vooLigado) => {
    try {
      await _recalculateSingleTariff(vooLigado);
      // Buscar apenas o cálculo atualizado em vez de recarregar tudo
      const updatedCalculo = await CalculoTarifa.filter({ voo_ligado_id: { $eq: vooLigado.id } });
      if (updatedCalculo.length > 0) {
        queryClient.setQueryData(['calculos-tarifa', empresaId], prev => {
          const withoutOld = (prev || []).filter(ct => ct.voo_ligado_id !== vooLigado.id);
          return [...withoutOld, ...updatedCalculo];
        });
      }
      setSuccessInfo({
        isOpen: true,
        title: t('operacoes.tarifa_recalculada'),
        message: t('operacoes.tarifa_recalculada_msg')
      });
    } catch (error) {
      console.error('Erro ao recalcular tarifa:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.erro_recalcular'),
        message: error.message || t('operacoes.erro_recalcular_msg')
      });
    }
  };

  const handleDeleteVooSemLink = async (voo) => {
    if (!confirm(`Eliminar voo ${voo.numero_voo} ${voo.tipo_movimento} ${voo.data_operacao}?`)) return;
    await Voo.update(voo.id, { deleted_at: new Date().toISOString() });
    if (semLinkLoaded) loadVoosSemLink(); else queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
  };

  const handleRecalcularTarifasLote = async (selectedVooLigadoIds = null) => {
    let targets = [];
    if (selectedVooLigadoIds && Array.isArray(selectedVooLigadoIds)) {
      targets = voosLigadosValidos.filter(vl => selectedVooLigadoIds.includes(vl.id));
    } else {
      targets = voosLigadosFiltrados;
    }

    if (targets.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: t('operacoes.nenhum_voo'),
        message: t('operacoes.nenhum_voo_recalcular')
      });
      return;
    }

    // Processamento automático em lotes
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    const timeEstimate = Math.ceil((targets.length * 2) / 60); // ~2 segundos por voo
    
    const confirmMessage = targets.length > BATCH_SIZE
      ? `Recalcular ${targets.length} voo(s) em ${totalBatches} lote(s) automáticos de ${BATCH_SIZE}?\n\nTempo estimado: ${timeEstimate} minuto(s). O processo será automático.`
      : `Recalcular ${targets.length} voo(s)? Tempo estimado: ${timeEstimate} minuto(s).`;

    setAlertInfo({
      isOpen: true,
      type: 'warning',
      title: t('operacoes.recalcular_tarifas'),
      message: confirmMessage,
      showCancel: true,
      confirmText: t('operacoes.recalcular'),
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Processar em batches (cada cálculo é 1 RPC call server-side)
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, targets.length);
          const batch = targets.slice(start, end);
          
          const batchTitle = totalBatches > 1
            ? `${t('operacoes.recalculando_tarifas')} - ${batchIndex + 1}/${totalBatches}`
            : t('operacoes.recalculando_tarifas');

          setProgressModal({
            isOpen: true,
            title: batchTitle,
            currentStep: start,
            totalSteps: targets.length,
            successCount: successCount,
            errorCount: errorCount,
            currentItem: '',
            errors: errors
          });

          for (let i = 0; i < batch.length; i++) {
            const globalIndex = start + i;
            const vl = batch[i];
            const depVoo = voos.find(v => v.id === vl.id_voo_dep);
            const arrVoo = voos.find(v => v.id === vl.id_voo_arr);
            const depVooNum = depVoo?.numero_voo || 'N/A';

            setProgressModal(prev => ({
              ...prev,
              currentStep: globalIndex,
              currentItem: `${t('home.voo')} ${depVooNum} (${globalIndex + 1}/${targets.length})`,
              successCount: successCount,
              errorCount: errorCount
            }));

            try {
              await _recalculateSingleTariff(vl);
              
              try {
                const batchUpdates = [];
                if (arrVoo && arrVoo.voo_ligado_id !== vl.id) {
                  batchUpdates.push(Voo.update(arrVoo.id, { voo_ligado_id: vl.id }));
                }
                if (depVoo && depVoo.voo_ligado_id !== vl.id) {
                  batchUpdates.push(Voo.update(depVoo.id, { voo_ligado_id: vl.id }));
                }
                if (batchUpdates.length > 0) await Promise.all(batchUpdates);
              } catch (updateError) {
                console.warn('⚠️ Erro ao atualizar voo_ligado_id:', updateError);
              }

              successCount++;

              // Rate limiting: pause every 10 items
              if ((globalIndex + 1) % 10 === 0) {
                await sleep(300);
              }
            } catch (error) {
              errorCount++;
              const errorMsg = `Voo ${depVooNum}: ${error.message}`;
              errors.push(errorMsg);
              setProgressModal(prev => ({
                ...prev,
                errorCount: errorCount,
                errors: [...prev.errors, errorMsg]
              }));

              if (error.message?.includes('Rate limit') || error.response?.status === 429) {
                console.warn('⚠️ Rate limit detectado. Pausando 3 segundos...');
                await sleep(3000);
              }
            }
          }

          // Pausa entre batches (exceto no último)
          if (batchIndex < totalBatches - 1) {
            setProgressModal(prev => ({
              ...prev,
              currentItem: `Preparando próximo lote... (${successCount}/${targets.length} concluídos)`
            }));
            await sleep(2000);
          }
        }

        setProgressModal(prev => ({
          ...prev,
          currentStep: targets.length,
          currentItem: t('operacoes.finalizando'),
          successCount: successCount,
          errorCount: errorCount
        }));

        queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });

        setTimeout(() => {
          setProgressModal(prev => ({ ...prev, isOpen: false }));
          
          if (errorCount === 0) {
            setSuccessInfo({
              isOpen: true,
              title: t('operacoes.recalculo_concluido'),
              message: `${successCount} / ${totalBatches}`
            });
          } else {
            setAlertInfo({
              isOpen: true,
              type: 'warning',
              title: t('operacoes.recalculo_parcial'),
              message: `${successCount} OK, ${errorCount} ${t('operacoes.erro')}`
            });
          }
        }, 2000);
      }
    });
  };

  const handleAlterarCambio = (calculo) => {
    setCalculoParaAlterarCambio(calculo);
    setIsAlterarCambioModalOpen(true);
  };

  const handleConfirmarAlterarCambio = async (calculo, novaTaxaCambio) => {
    try {
      const novoCalculoData = {
        ...calculo,
        taxa_cambio_usd_aoa: novaTaxaCambio,
        tarifa_pouso: calculo.tarifa_pouso_usd * novaTaxaCambio,
        tarifa_permanencia: calculo.tarifa_permanencia_usd * novaTaxaCambio,
        tarifa_passageiros: calculo.tarifa_passageiros_usd * novaTaxaCambio,
        tarifa_carga: calculo.tarifa_carga_usd * novaTaxaCambio,
        outras_tarifas: calculo.outras_tarifas_usd * novaTaxaCambio,
        total_tarifa: calculo.total_tarifa_usd * novaTaxaCambio,
        data_calculo: new Date().toISOString()
      };

      await CalculoTarifa.update(calculo.id, novoCalculoData);
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });

      setSuccessInfo({
        isOpen: true,
        title: t('operacoes.cambio_atualizado'),
        message: `${novaTaxaCambio} AOA/USD`
      });
    } catch (error) {
      console.error('Erro ao alterar câmbio:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.erro'),
        message: t('operacoes.erro_alterar')
      });
    }
  };

  const handleShowTariffDetails = async (calculo) => {
    // Lightweight calculo from fetchCalculoMap may lack details — fetch full record
    if (!calculo.detalhes_calculo && calculo.voo_ligado_id) {
      try {
        const full = await CalculoTarifa.filter({ voo_ligado_id: { $eq: calculo.voo_ligado_id } });
        if (full.length > 0) {
          setTariffDetailsData(full[0]);
          return;
        }
      } catch (e) {
        console.error('Error fetching full calculo:', e);
      }
    }
    setTariffDetailsData(calculo);
  };

  const handleExportTariffPDF = async (calculo) => {
    try {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: t('operacoes.gerando_pdf'),
        message: t('operacoes.aguarde_pdf')
      });

      const { exportTariffDetailsPdf } = await import('@/functions/exportTariffDetailsPdf');
      const response = await exportTariffDetailsPdf({ calculoId: calculo.id });

      if (response.data) {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const voo = voos.find(v => v.id === calculo.voo_id);
        a.download = `calculo_tarifa_${voo?.numero_voo || 'voo'}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        setAlertInfo({ isOpen: false });
        setSuccessInfo({
          isOpen: true,
          title: t('operacoes.pdf_exportado'),
          message: t('operacoes.pdf_exportado_msg')
        });
      }
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.erro_exportar'),
        message: error.message || t('operacoes.erro_exportar_msg')
      });
    }
  };

  const handleGerarProforma = async (calculo) => {
    if (!calculo) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.erro'),
        message: t('operacoes.erro_dados_msg')
      });
      return;
    }

    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      // D-01: Use .filter() instead of .list() — fetch only matching records
      const filterQuery = { calculo_tarifa_id: calculo.id, status: { $ne: 'cancelada' } };
      if (empId) filterQuery.empresa_id = empId;
      const proformasMatch = await Proforma.filter(filterQuery);
      const proformaExistente = proformasMatch?.[0];

      if (proformaExistente) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: t('operacoes.ja_existe'),
          message: `Proforma ${proformaExistente.numero_proforma}`
        });
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar proformas:', error);
    }

    setGerarProformaCalculo(calculo);
    setIsGerarProformaModalOpen(true);
  };

  const handleConfirmarGerarProforma = async (dadosProforma) => {
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      const ano = new Date().getFullYear();
      const prefixoProforma = `PF-${ano}-`;
      // D-01: Fetch only this year's proformas (not ALL) using server-side filter
      const filterQuery = { numero_proforma: { $like: `${prefixoProforma}%` } };
      if (empId) filterQuery.empresa_id = empId;
      const proformasDoAno = await Proforma.filter(filterQuery);
      const ultimaProformaDoAno = proformasDoAno.length > 0
        ? proformasDoAno.sort((a, b) => {
            const numA = parseInt(a.numero_proforma.split('-')[2]);
            const numB = parseInt(b.numero_proforma.split('-')[2]);
            return numB - numA;
          })[0]
        : null;

      let proximoNumero = 1;
      if (ultimaProformaDoAno) {
        const numAtual = parseInt(ultimaProformaDoAno.numero_proforma.split('-')[2]);
        proximoNumero = numAtual + 1;
      }

      const numeroProforma = `${prefixoProforma}${String(proximoNumero).padStart(6, '0')}`;

      const proformaData = {
        ...dadosProforma,
        numero_proforma: numeroProforma,
        status: 'emitida',
        data_emissao: new Date().toISOString().split('T')[0],
        voo_id: gerarProformaCalculo?.voo_id || null,
        emitida_por: user?.email || 'sistema',
        empresa_id: empId || null,
      };

      const novaProforma = await Proforma.create(proformaData);
      await registarCriacao('Proforma', novaProforma, 'faturacao');

      try {
        const pdfResponse = await base44.functions.invoke('gerarProformaPdfSimples', { proforma_id: novaProforma.id });
        // PDF generated successfully
      } catch (pdfError) {
        console.warn('⚠️ Erro ao gerar PDF:', pdfError);
      }

      setSuccessInfo({
        isOpen: true,
        title: t('operacoes.proforma_gerada'),
        message: `Proforma ${numeroProforma}`
      });

      setIsGerarProformaModalOpen(false);
      setGerarProformaCalculo(null);
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });

    } catch (error) {
      console.error('Erro ao gerar proforma:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.erro'),
        message: t('operacoes.erro_proforma')
      });
    }
  };

  const handleUploadDocumento = (vooLigado, tipoDocumento) => {
    setUploadDocumentoData({ vooLigado, tipoDocumento });
    setIsUploadDocumentoModalOpen(true);
  };

  const handleVerDocumentosVoo = (vooLigado) => {
    setDocumentosVooModalData(vooLigado);
    setIsDocumentosVooModalOpen(true);
  };

  const handleRecursosVoo = (vooLigado) => {
    setRecursosVooModalData(vooLigado);
    setIsRecursosVooModalOpen(true);
  };

  const handleResourcesSaved = async (vooLigado) => {
    setIsRecursosVooModalOpen(false);
    try {
      await _recalculateSingleTariff(vooLigado);
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
    } catch (err) {
      console.error('Erro ao recalcular após salvar recursos:', err);
    }
  };

  const handleOpenUploadFromDocumentosModal = (vooLigado) => {
    setIsDocumentosVooModalOpen(false);
    setDocumentosVooModalData(null);
    // Abrir o modal de upload múltiplo
    setUploadMultiplosModalData(vooLigado);
    setIsUploadMultiplosModalOpen(true);
  };

  const handleConfirmarUploadDocumento = async (file, tipoDocumento) => {
    try {
      // Upload do arquivo usando importação dinâmica
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;

      const { Documento } = await import('@/entities/Documento');
      
      const arrVoo = voos.find(v => v.id === uploadDocumentoData.vooLigado.id_voo_arr);
      const depVoo = voos.find(v => v.id === uploadDocumentoData.vooLigado.id_voo_dep);

      const tiposNome = {
        'general_declaration': 'General Declaration',
        'manifesto_passageiros': 'Manifesto de Passageiros',
        'manifesto_carga': 'Manifesto de Carga',
        'formulario_trafego': 'Formulário de Tráfego',
        'proforma_assinada': 'Proforma Assinada'
      };

      const documentoData = {
        titulo: `${tiposNome[tipoDocumento]} - ${arrVoo?.numero_voo} → ${depVoo?.numero_voo}`,
        categoria: 'outro',
        empresa_id: user?.empresa_id,
        aeroporto: arrVoo?.aeroporto_operacao,
        voo_ligado_id: uploadDocumentoData.vooLigado.id,
        arquivo_url: fileUrl,
        data_publicacao: new Date().toISOString().split('T')[0],
        descricao: `${tiposNome[tipoDocumento]} para voo ligado ${arrVoo?.numero_voo} (ARR) → ${depVoo?.numero_voo} (DEP). Registo: ${depVoo?.registo_aeronave}`,
        nivel_acesso: ['administrador', 'operacoes'],
        status: 'ativo'
      };

      await Documento.create(documentoData);

      setSuccessInfo({
        isOpen: true,
        title: t('operacoes.documento_enviado'),
        message: `${tiposNome[tipoDocumento]} foi salvo com sucesso.`
      });

    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      throw new Error(error.message || 'Não foi possível fazer upload do documento.');
    }
  };

  const handleExportCSV = () => {
    if (voosFiltrados.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: t('operacoes.sem_dados'),
        message: t('operacoes.sem_voos_exportar')
      });
      return;
    }

    const dataToExport = voosFiltrados.map(v => {
      const companhia = companhias.find(c => c.codigo_icao === v.companhia_aerea || c.codigo_iata === v.companhia_aerea);
      const aeroportoOp = todosAeroportos.find(a => a.codigo_icao === v.aeroporto_operacao);
      const aeroportoOriDest = todosAeroportos.find(a => a.codigo_icao === v.aeroporto_origem_destino);
      
      return {
        'Data Operação': v.data_operacao,
        'Tipo Movimento': v.tipo_movimento,
        'Número Voo': v.numero_voo,
        'Companhia ICAO': v.companhia_aerea,
        'Companhia Nome': companhia?.nome || v.companhia_aerea,
        'Registo Aeronave': v.registo_aeronave,
        'Aeroporto Operação': v.aeroporto_operacao,
        'Aeroporto Operação Nome': aeroportoOp?.nome || v.aeroporto_operacao,
        'Aeroporto Origem/Destino': v.aeroporto_origem_destino,
        'Aeroporto Origem/Destino Nome': aeroportoOriDest?.nome || v.aeroporto_origem_destino,
        'Horário Previsto (UTC)': v.horario_previsto,
        'Horário Real (UTC)': v.horario_real || '',
        'Tipo de Voo': v.tipo_voo,
        'Status': v.status,
        'Passageiros Locais': v.passageiros_local || 0,
        'Passageiros Trânsito c/ Transbordo': v.passageiros_transito_transbordo || 0,
        'Passageiros Trânsito Direto': v.passageiros_transito_direto || 0,
        'Total Passageiros': v.passageiros_total || 0,
        'Tripulação': v.tripulacao || 0,
        'Carga (kg)': v.carga_kg || 0,
        'Observações': v.observacoes || '',
        'Atualizado Por': v.updated_by || v.created_by || '',
        'Data Criação': v.created_date ? new Date(v.created_date).toLocaleString('pt-PT') : '',
        'Data Atualização': v.updated_date ? new Date(v.updated_date).toLocaleString('pt-PT') : ''
      };
    });
    downloadAsExcel(dataToExport, `voos_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportLinkedFlightsCSV = () => {
    if (voosLigadosFiltrados.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: t('operacoes.sem_dados'),
        message: t('operacoes.sem_voos_ligados_exportar')
      });
      return;
    }

    const dataToExport = voosLigadosFiltrados.map(vl => {
      const arrVoo = voos.find(v => v.id === vl.id_voo_arr);
      const depVoo = voos.find(v => v.id === vl.id_voo_dep);
      const calculo = calculosTarifa.find(ct => ct.voo_ligado_id === vl.id || ct.voo_id === depVoo?.id);

      // Determinar tipo de operação
      const aeroportoOrigem = todosAeroportos.find(a => a.codigo_icao === arrVoo?.aeroporto_origem_destino);
      const aeroportoOperacao = todosAeroportos.find(a => a.codigo_icao === arrVoo?.aeroporto_operacao);
      const aeroportoDestino = todosAeroportos.find(a => a.codigo_icao === depVoo?.aeroporto_origem_destino);
      
      const isInternational = 
        (aeroportoOrigem && aeroportoOrigem.pais !== 'AO') ||
        (aeroportoOperacao && aeroportoOperacao.pais !== 'AO') ||
        (aeroportoDestino && aeroportoDestino.pais !== 'AO');
      
      const tipoOperacao = isInternational ? 'Internacional' : 'Doméstico';

      const tempoPermanenciaHoras = (vl.tempo_permanencia_min / 60).toFixed(2);
      const companhia = companhias.find(c => c.codigo_icao === depVoo?.companhia_aerea || c.codigo_iata === depVoo?.companhia_aerea);
      const aeroportoOp = todosAeroportos.find(a => a.codigo_icao === arrVoo?.aeroporto_operacao);

      return {
        'Voo ARR': arrVoo?.numero_voo || 'N/A',
        'Data ARR': arrVoo?.data_operacao || 'N/A',
        'Horário Previsto ARR (UTC)': arrVoo?.horario_previsto || 'N/A',
        'Horário Real ARR (UTC)': arrVoo?.horario_real || 'N/A',
        'Voo DEP': depVoo?.numero_voo || 'N/A',
        'Data DEP': depVoo?.data_operacao || 'N/A',
        'Horário Previsto DEP (UTC)': depVoo?.horario_previsto || 'N/A',
        'Horário Real DEP (UTC)': depVoo?.horario_real || 'N/A',
        'Aeroporto ICAO': arrVoo?.aeroporto_operacao || 'N/A',
        'Aeroporto Nome': aeroportoOp?.nome || arrVoo?.aeroporto_operacao || 'N/A',
        'Rota Completa': arrVoo && depVoo ? `${arrVoo.aeroporto_origem_destino} → ${arrVoo.aeroporto_operacao} → ${depVoo.aeroporto_origem_destino}` : 'N/A',
        'Tipo Operacao': tipoOperacao,
        'Tipo de Voo': depVoo?.tipo_voo || 'N/A',
        'Companhia ICAO': depVoo?.companhia_aerea || 'N/A',
        'Companhia Nome': companhia?.nome || depVoo?.companhia_aerea || 'N/A',
        'Registo Aeronave': depVoo?.registo_aeronave || 'N/A',
        'Permanência (horas)': tempoPermanenciaHoras,
        'Permanência (minutos)': vl.tempo_permanencia_min || 0,
        'Passageiros Locais': depVoo?.passageiros_local || 0,
        'Passageiros Trânsito c/ Transbordo': depVoo?.passageiros_transito_transbordo || 0,
        'Passageiros Trânsito Direto': depVoo?.passageiros_transito_direto || 0,
        'Total Passageiros': depVoo?.passageiros_total || 0,
        'Tripulação': depVoo?.tripulacao || 0,
        'Carga (kg)': depVoo?.carga_kg || 0,
        'Status Voo ARR': arrVoo?.status || 'N/A',
        'Status Voo DEP': depVoo?.status || 'N/A',
        'Status Cálculo': calculo ? (calculo.tipo_tarifa === 'Voo Isento de Tarifas' ? 'Isento' : 'Calculado') : 'Sem Cálculo',
        'MTOW (kg)': calculo?.mtow_kg || 0,
        'Taxa Câmbio (AOA/USD)': calculo?.taxa_cambio_usd_aoa || configuracaoSistema?.taxa_cambio_usd_aoa || 850,
        'Tarifa Pouso (USD)': calculo?.tarifa_pouso_usd || 0,
        'Tarifa Pouso (AOA)': calculo?.tarifa_pouso || 0,
        'Tarifa Permanência (USD)': calculo?.tarifa_permanencia_usd || 0,
        'Tarifa Permanência (AOA)': calculo?.tarifa_permanencia || 0,
        'Tarifa Passageiros (USD)': calculo?.tarifa_passageiros_usd || 0,
        'Tarifa Passageiros (AOA)': calculo?.tarifa_passageiros || 0,
        'Tarifa Carga (USD)': calculo?.tarifa_carga_usd || 0,
        'Tarifa Carga (AOA)': calculo?.tarifa_carga || 0,
        'Outras Tarifas (USD)': calculo?.outras_tarifas_usd || 0,
        'Outras Tarifas (AOA)': calculo?.outras_tarifas || 0,
        'Total Tarifa (USD)': calculo?.total_tarifa_usd || 0,
        'Total Tarifa (AOA)': calculo?.total_tarifa || 0,
        'Observações ARR': arrVoo?.observacoes || '',
        'Observações DEP': depVoo?.observacoes || '',
        'Atualizado Por': depVoo?.updated_by || depVoo?.created_by || '',
        'Data Criação': vl.created_date ? new Date(vl.created_date).toLocaleString('pt-PT') : '',
        'Data Cálculo': calculo?.data_calculo ? new Date(calculo.data_calculo).toLocaleString('pt-PT') : ''
      };
    });

    downloadAsExcel(dataToExport, `voos_ligados_${new Date().toISOString().split('T')[0]}`);
    
    setSuccessInfo({
      isOpen: true,
      title: t('operacoes.exportacao_concluida'),
      message: `${dataToExport.length} Excel`
    });
  };

  const handleFilterChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  const handleFilterChangeLigados = (field, value) => {
    setFiltrosLigados(prev => ({ ...prev, [field]: value }));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prevDirection => prevDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSortLigados = (field) => {
    if (sortFieldLigados === field) {
      setSortDirectionLigados(prevDirection => prevDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortFieldLigados(field);
      setSortDirectionLigados('asc');
    }
  };

  const clearFilters = () => {
    setFiltros({
      dataInicio: '',
      dataFim: '',
      tipoMovimento: 'todos',
      status: 'todos',
      companhia: 'todos',
      aeroporto: 'todos',
      tipoVoo: 'todos',
      statusVinculacao: 'todos',
      busca: '',
      passageirosMin: '',
      passageirosMax: '',
      cargaMin: '',
      cargaMax: '',
      origem: 'todos'
    });
    setIsFiltering(false);
    queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
    queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
  };

  const clearFiltersLigados = () => {
    setFiltrosLigados({
      dataInicio: '',
      dataFim: '',
      companhia: 'todos',
      aeroportos: [],
      tipoVoo: 'todos',
      statusCalculo: 'todos',
      permanenciaMin: '',
      permanenciaMax: '',
      busca: ''
    });
    setIsFilteringLigados(false);
    queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
    queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
    queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
  };

  const voosFiltrados = useMemo(() => {
    // Most filters are now applied server-side via handleBuscarVoos.
    // Only client-side: statusVinculacao (requires voo_ligado join), companhia IATA fallback,
    // companhia "outro", and busca registo_aeronave fallback.
    let filtered = voos;

    // Companhia "outro": exclude known companies (cannot be done server-side)
    if (filtros.companhia === 'outro') {
      const knownCompanyCodes = new Set();
      companhias.forEach(c => { if (c.codigo_icao) knownCompanyCodes.add(c.codigo_icao); if (c.codigo_iata) knownCompanyCodes.add(c.codigo_iata); });
      filtered = filtered.filter(voo => voo.companhia_aerea && !knownCompanyCodes.has(voo.companhia_aerea));
    }

    // Busca: server-side filters numero_voo via $ilike; client-side also matches registo_aeronave
    if (filtros.busca) {
      const buscaLower = filtros.busca.toLowerCase();
      filtered = filtered.filter(voo =>
        voo.numero_voo?.toLowerCase().includes(buscaLower) ||
        voo.registo_aeronave?.toLowerCase().includes(buscaLower)
      );
    }

    // StatusVinculacao: requires voo_ligado relationship check, cannot be done server-side
    if (filtros.statusVinculacao !== 'todos') {
      filtered = filtered.filter(voo => {
        const isLinked = voosLigados.some((vl) => {
          const isLinkedToThisVoo = vl.id_voo_arr === voo.id || vl.id_voo_dep === voo.id;
          if (!isLinkedToThisVoo) return false;
          const vooArrExiste = voos.some(v => v.id === vl.id_voo_arr);
          const vooDepExiste = voos.some(v => v.id === vl.id_voo_dep);
          return vooArrExiste && vooDepExiste;
        });

        if (filtros.statusVinculacao === 'ligado') return isLinked;
        if (filtros.statusVinculacao === 'sem_link') return !isLinked && voo.status !== 'Cancelado';
        return true;
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;

      if (sortField === 'updated_date') {
        aValue = a.updated_date || a.created_date || '';
        bValue = b.updated_date || b.created_date || '';
      } else {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1;

      let comparison = 0;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue), 'pt', { numeric: true });
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [voos, filtros, sortField, sortDirection, companhias, voosLigados]);

  const voosLigadosFiltrados = useMemo(() => {
    const filtered = voosLigadosValidos.filter(vl => {
      const arrVoo = voos.find(v => v.id === vl.id_voo_arr);
      const depVoo = voos.find(v => v.id === vl.id_voo_dep);

      if (!arrVoo || !depVoo) return false;

      const dataMatch = (!filtrosLigados.dataInicio || arrVoo.data_operacao >= filtrosLigados.dataInicio) &&
                       (!filtrosLigados.dataFim || arrVoo.data_operacao <= filtrosLigados.dataFim);

      const companhiaFiltro = filtrosLigados.companhia;
      const companhiaMatch = companhiaFiltro === 'todos' ||
                            depVoo.companhia_aerea === companhiaFiltro ||
                            companhias.some(c => (c.codigo_icao === companhiaFiltro || c.codigo_iata === companhiaFiltro) &&
                              (c.codigo_icao === depVoo.companhia_aerea || c.codigo_iata === depVoo.companhia_aerea));

      const aeroportoMatch = !filtrosLigados.aeroportos || 
                            filtrosLigados.aeroportos.length === 0 ||
                            filtrosLigados.aeroportos.includes(arrVoo.aeroporto_operacao);

      const tipoVooMatch = filtrosLigados.tipoVoo === 'todos' ||
                          depVoo.tipo_voo === filtrosLigados.tipoVoo;

      const calculo = calculosTarifa.find(ct => ct.voo_ligado_id === vl.id || ct.voo_id === depVoo?.id);
      let statusCalculoMatch = true;
      if (filtrosLigados.statusCalculo !== 'todos') {
        if (filtrosLigados.statusCalculo === 'com_calculo') {
          statusCalculoMatch = calculo && calculo.tipo_tarifa !== 'Voo Isento de Tarifas';
        } else if (filtrosLigados.statusCalculo === 'sem_calculo') {
          statusCalculoMatch = !calculo;
        } else if (filtrosLigados.statusCalculo === 'isento') {
          statusCalculoMatch = calculo && calculo.tipo_tarifa === 'Voo Isento de Tarifas';
        } else if (filtrosLigados.statusCalculo === 'zerado') {
          statusCalculoMatch = calculo && (calculo.total_tarifa === 0 || calculo.total_tarifa_usd === 0) && calculo.tipo_tarifa !== 'Voo Isento de Tarifas';
        }
      }

      const tempoPermanenciaHoras = vl.tempo_permanencia_min / 60;
      const permanenciaMinMatch = !filtrosLigados.permanenciaMin ||
                                 tempoPermanenciaHoras >= parseFloat(filtrosLigados.permanenciaMin);
      const permanenciaMaxMatch = !filtrosLigados.permanenciaMax ||
                                 tempoPermanenciaHoras <= parseFloat(filtrosLigados.permanenciaMax);

      const buscaMatch = !filtrosLigados.busca ||
                        arrVoo.numero_voo?.toLowerCase().includes(filtrosLigados.busca.toLowerCase()) ||
                        depVoo.numero_voo?.toLowerCase().includes(filtrosLigados.busca.toLowerCase()) ||
                        depVoo.registo_aeronave?.toLowerCase().includes(filtrosLigados.busca.toLowerCase());

      return dataMatch && companhiaMatch && aeroportoMatch && tipoVooMatch &&
             statusCalculoMatch && permanenciaMinMatch && permanenciaMaxMatch && buscaMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const arrVooA = voos.find(v => v.id === a.id_voo_arr);
      const depVooA = voos.find(v => v.id === a.id_voo_dep);
      const arrVooB = voos.find(v => v.id === b.id_voo_arr);
      const depVooB = voos.find(v => v.id === b.id_voo_dep);

      let aValue, bValue;

      switch (sortFieldLigados) {
        case 'numero_voo':
          aValue = depVooA?.numero_voo || '';
          bValue = depVooB?.numero_voo || '';
          break;
        case 'horario_arr':
          aValue = arrVooA?.data_operacao && arrVooA?.horario_real ? `${arrVooA.data_operacao}T${arrVooA.horario_real}` : '';
          bValue = arrVooB?.data_operacao && arrVooB?.horario_real ? `${arrVooB.data_operacao}T${arrVooB.horario_real}` : '';
          break;
        case 'horario_dep':
          aValue = depVooA?.data_operacao && depVooA?.horario_real ? `${depVooA.data_operacao}T${depVooA.horario_real}` : '';
          bValue = depVooB?.data_operacao && depVooB?.horario_real ? `${depVooB.data_operacao}T${depVooB.horario_real}` : '';
          break;
        case 'registo_aeronave':
          aValue = depVooA?.registo_aeronave || '';
          bValue = depVooB?.registo_aeronave || '';
          break;
        case 'companhia_aerea':
          aValue = depVooA?.companhia_aerea || '';
          bValue = depVooB?.companhia_aerea || '';
          break;
        case 'tempo_permanencia_min':
          aValue = a.tempo_permanencia_min || 0;
          bValue = b.tempo_permanencia_min || 0;
          break;
        case 'total_tarifa':
          const calculoA = calculosTarifa.find(ct => ct.voo_ligado_id === a.id || ct.voo_id === depVooA?.id);
          const calculoB = calculosTarifa.find(ct => ct.voo_ligado_id === b.id || ct.voo_id === depVooB?.id);
          aValue = calculoA?.total_tarifa || 0;
          bValue = calculoB?.total_tarifa || 0;
          break;
        case 'updated_date':
          const calcA = calculosTarifa.find(ct => ct.voo_ligado_id === a.id || ct.voo_id === depVooA?.id);
          const calcB = calculosTarifa.find(ct => ct.voo_ligado_id === b.id || ct.voo_id === depVooB?.id);
          aValue = calcA?.updated_date || depVooA?.updated_date || '';
          bValue = calcB?.updated_date || depVooB?.updated_date || '';
          break;
        default:
          aValue = '';
          bValue = '';
      }

      if (aValue === null || aValue === undefined) return sortDirectionLigados === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDirectionLigados === 'asc' ? 1 : -1;

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue), 'pt', { numeric: true });
      }

      return sortDirectionLigados === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [voosLigadosValidos, voos, calculosTarifa, filtrosLigados, sortFieldLigados, sortDirectionLigados]);

  const companhiaOptions = useMemo(() => {
    const options = [{ value: 'todos', label: t('operacoes.todas_companhias') }];
    const knownCompanyCodes = new Set();
    companhias.forEach(c => {
      options.push({ value: c.codigo_icao, label: `${c.nome} (${c.codigo_icao})` });
      knownCompanyCodes.add(c.codigo_icao);
    });
    const hasOtherCompanies = voos.some(voo => voo.companhia_aerea && !knownCompanyCodes.has(voo.companhia_aerea));
    if (hasOtherCompanies) {
      options.push({ value: 'outro', label: t('operacoes.outra_companhia') });
    }
    return options;
  }, [companhias, voos, t]);

  const aeroportoOptions = useMemo(() => ([
    { value: 'todos', label: t('operacoes.todos_aeroportos') },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))
  ]), [aeroportos, t]);

  const tipoMovimentoOptions = useMemo(() => [
      { value: "todos", label: t('operacoes.todos') },
      { value: "ARR", label: t('operacoes.chegada') },
      { value: "DEP", label: t('operacoes.partida') },
  ], [t]);

  const tipoVooOptions = useMemo(() => [
    { value: 'todos', label: t('operacoes.todos') },
    { value: 'Regular', label: t('operacoes.regular') },
    { value: 'Não Regular', label: t('operacoes.nao_regular') },
    { value: 'Humanitário', label: t('operacoes.humanitario') },
    { value: 'Charter', label: t('operacoes.charter') },
    { value: 'Carga', label: t('operacoes.carga') },
    { value: 'Privado', label: t('operacoes.privado') },
    { value: 'Militar', label: t('operacoes.militar') },
    { value: 'Oficial', label: t('operacoes.oficial') },
    { value: 'Técnico', label: t('operacoes.tecnico') },
    { value: 'Outro', label: t('operacoes.outro') }
  ], [t]);

  const statusOptions = useMemo(() => ([
    { value: 'todos', label: t('operacoes.todos') },
    { value: 'Programado', label: t('operacoes.programado') },
    { value: 'Realizado', label: t('operacoes.realizado') },
    { value: 'Cancelado', label: t('operacoes.cancelado') },
  ]), [t]);

  const statusVinculacaoOptions = useMemo(() => [
    { value: 'todos', label: t('operacoes.todos_voos') },
    { value: 'ligado', label: t('operacoes.apenas_ligados') },
    { value: 'sem_link', label: t('operacoes.apenas_sem_link') }
  ], [t]);

  const configuracao = useMemo(() => ({
    aeroportos: todosAeroportos,
    aeronaves: aeronaves,
    tarifasPouso: tarifasPouso,
    tarifasPermanencia: tarifasPermanencia,
    outrasTarifas: outrasTarifas,
    impostos: impostos,
    taxaCambio: configuracaoSistema?.taxa_cambio_usd_aoa || 850
  }), [todosAeroportos, aeronaves, tarifasPouso, tarifasPermanencia, outrasTarifas, impostos, configuracaoSistema]);

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{t('page.operacoes.title')}</h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">{t('page.operacoes.subtitle')}</p>
          </div>
        </div>

        <Tabs defaultValue="voos" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="voos" className="text-xs sm:text-sm px-2 py-2">{t('tab.all_flights')}</TabsTrigger>
            <TabsTrigger value="linkados" className="text-xs sm:text-sm px-2 py-2">
              <span className="hidden sm:inline">{t('tab.linked_flights')}</span>
              <span className="sm:hidden">{t('tab.linked')}</span>
              {voosLigadosValidos.length > 0 && (
                <span className="ml-1 sm:ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                  {voosLigadosValidos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sem_link" className="text-xs sm:text-sm px-2 py-2">
              <Unlink className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">Voos Sem Link</span>
              <span className="sm:hidden">Sem Link</span>
              {semLinkStats.total > 0 && (
                <span className="ml-1 sm:ml-2 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                  {semLinkStats.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fids" className="text-xs sm:text-sm px-2 py-2">
              <Plane className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">FIDS</span>
              <span className="sm:hidden">FIDS</span>
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="text-xs sm:text-sm px-2 py-2">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('tab.config')}</span>
              <span className="sm:hidden">{t('operacoes.config')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voos" className="space-y-4 sm:space-y-6">
            <VoosTab
              voosFiltrados={voosFiltrados}
              isLoadingAll={isLoadingAll}
              isFiltering={isFiltering}
              filtros={filtros}
              aeroportos={aeroportos}
              companhias={companhias}
              voos={voos}
              voosLigados={voosLigados}
              sortField={sortField}
              sortDirection={sortDirection}
              t={t}
              language={language}
              user={user}
              onFilterChange={handleFilterChange}
              onSort={handleSort}
              onBuscar={handleBuscarVoos}
              onClearFilters={clearFilters}
              onRefresh={loadData}
              onExportCSV={handleExportCSV}
              onOpenForm={handleOpenForm}
              onLixeira={() => setIsLixeiraModalOpen(true)}
              onEditVoo={(voo) => handleOpenForm(voo.tipo_movimento, voo)}
              onCancelarVoo={handleCancelarVoo}
              onExcluirVoo={handleExcluirVoo}
              onLinkarManual={handleLinkarManual}
              onUploadDocumento={handleUploadDocumento}
              onVerDocumentosVoo={handleVerDocumentosVoo}
              onRecursosVoo={handleRecursosVoo}
            />
          </TabsContent>

          <TabsContent value="linkados" className="space-y-4 sm:space-y-6">
            <VoosLigadosTab
              voosLigadosValidos={voosLigadosValidos}
              voosLigadosFiltrados={voosLigadosFiltrados}
              voos={voos}
              calculosTarifa={calculosTarifa}
              todosAeroportos={todosAeroportos}
              aeroportos={aeroportos}
              companhias={companhias}
              isLoadingAll={isLoadingAll}
              isFilteringLigados={isFilteringLigados}
              filtrosLigados={filtrosLigados}
              sortFieldLigados={sortFieldLigados}
              sortDirectionLigados={sortDirectionLigados}
              configuracaoSistema={configuracaoSistema}
              t={t}
              language={language}
              formatCurrency={formatCurrency}
              user={user}
              onFilterChange={handleFilterChangeLigados}
              onClearFilters={clearFiltersLigados}
              onBuscar={handleBuscarLigados}
              onSort={handleSortLigados}
              onRefresh={loadData}
              onExcluirVooLigado={handleExcluirVooLigado}
              onRecalcularTarifaSingle={handleRecalcularTarifaSingle}
              onRecalcularTarifasLote={handleRecalcularTarifasLote}
              onShowTariffDetails={handleShowTariffDetails}
              onExportTariffPDF={handleExportTariffPDF}
              onExportCSV={handleExportLinkedFlightsCSV}
              onGerarProforma={handleGerarProforma}
              onAlterarCambio={handleAlterarCambio}
              onUploadDocumento={handleUploadDocumento}
              onVerDocumentosVoo={handleVerDocumentosVoo}
              onRecursosVoo={handleRecursosVoo}
              onUploadMultiplos={(vl) => { setUploadMultiplosModalData(vl); setIsUploadMultiplosModalOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="sem_link" className="space-y-4 sm:space-y-6">
            <VoosSemLinkTab
              voosSemLink={voosSemLink}
              voosSemLinkComputed={voosSemLinkComputed}
              semLinkStats={semLinkStats}
              isLoadingSemLink={isLoadingSemLink}
              isLinkingAuto={isLinkingAuto}
              filtrosSemLink={filtrosSemLink}
              semLinkLoaded={semLinkLoaded}
              aeroportos={aeroportos}
              companhias={companhias}
              t={t}
              onLinkarAutomatico={handleLinkarAutomatico}
              onLinkarManual={handleLinkarManual}
              onLoadSemLink={loadVoosSemLink}
              onFilterChange={(field, value) => setFiltrosSemLink(prev => ({ ...prev, [field]: value }))}
              onDeleteVoo={handleDeleteVooSemLink}
              getSugestoesPar={getSugestoesPar}
            />
          </TabsContent>


          <TabsContent value="fids" className="space-y-4 sm:space-y-6">
            <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
              <FIDSPanel aeroportos={todosAeroportos} />
            </React.Suspense>
          </TabsContent>

          <TabsContent value="configuracoes" className="space-y-4 sm:space-y-6">
            <Card className="shadow-sm border-0">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg md:text-xl">{t('operacoes.configuracoes')}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{t('operacoes.configuracoes_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <Tabs defaultValue="aeroportos" orientation="horizontal" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 h-auto">
                    <TabsTrigger value="aeroportos" className="text-xs sm:text-sm px-2 py-2">{t('operacoes.aeroportos')}</TabsTrigger>
                    <TabsTrigger value="companhias" className="text-xs sm:text-sm px-2 py-2">{t('operacoes.companhias')}</TabsTrigger>
                    <TabsTrigger value="modelos" className="text-xs sm:text-sm px-2 py-2">{t('operacoes.modelos')}</TabsTrigger>
                    <TabsTrigger value="registos" className="text-xs sm:text-sm px-2 py-2">{t('operacoes.registos')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="aeroportos" className="mt-4 sm:mt-6">
                    <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
                      <AeroportosConfig aeroportos={todosAeroportos} onReload={() => queryClient.invalidateQueries({ queryKey: ['aeroportos', empresaId] })} />
                    </React.Suspense>
                  </TabsContent>

                  <TabsContent value="companhias" className="mt-4 sm:mt-6">
                    <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
                      <CompanhiasConfig companhias={companhias} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['companhias', empresaId] })} />
                    </React.Suspense>
                  </TabsContent>

                  <TabsContent value="modelos" className="mt-4 sm:mt-6">
                    <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
                      <ModelosAeronaveConfig modelos={modelosAeronave} onReload={() => queryClient.invalidateQueries({ queryKey: ['modelos', empresaId] })} />
                    </React.Suspense>
                  </TabsContent>

                  <TabsContent value="registos" className="mt-4 sm:mt-6">
                    <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
                    <RegistosAeronaveConfig
                      registos={aeronaves}
                      modelos={modelosAeronave}
                      companhias={companhiasCache.length > 0 ? companhiasCache : companhias}
                      onReload={() => queryClient.invalidateQueries({ queryKey: ['aeronaves', empresaId] })}
                    />
                    </React.Suspense>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <React.Suspense fallback={null}>
      {isFormOpen && (
        <FormVoo
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingVoo(null); setVooArrToLink(null); }}
          onSubmit={handleSaveVoo}
          tipoMovimento={tipoMovimentoForm}
          vooInicial={editingVoo}
          aeroportos={aeroportos}
          aeroportosOrigemDestino={todosAeroportos}
          companhias={companhias}
          aeronaves={aeronaves}
          voos={voos}
          voosLigados={voosLigados}
          user={user}
          linkedArrVoo={vooArrToLink}
          setAlertInfo={setAlertInfo}
          onRefreshData={() => {
            queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
            queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
          }}
          modelos={modelosAeronave}
        />
      )}

      {tariffDetailsData && (
        <TariffDetailsModal
          isOpen={!!tariffDetailsData}
          onClose={() => setTariffDetailsData(null)}
          tariffCalculation={tariffDetailsData}
          voos={voos}
          voosLigados={voosLigados}
          aeroportos={todosAeroportos}
        />
      )}

      {gerarProformaCalculo && (() => {
        const vooDoCalculo = voos.find(v => v.id === gerarProformaCalculo.voo_id);
        const companhiaDoVoo = vooDoCalculo
          ? companhias.find(c => c.codigo_icao === vooDoCalculo.companhia_aerea || c.codigo_iata === vooDoCalculo.companhia_aerea)
          : null;

        if (!companhiaDoVoo) {
          console.error('❌ CRÍTICO: Companhia não encontrada para o voo:', {
            voo: vooDoCalculo?.numero_voo,
            companhia_aerea: vooDoCalculo?.companhia_aerea,
            companhias_disponiveis: companhias.map(c => c.codigo_icao)
          });
        }

        return (
          <GerarFaturaModal
            isOpen={isGerarProformaModalOpen}
            onClose={() => {
              setIsGerarProformaModalOpen(false);
              setGerarProformaCalculo(null);
            }}
            onConfirm={handleConfirmarGerarProforma}
            calculo={gerarProformaCalculo || {}}
            companhia={companhiaDoVoo}
            aeroporto={todosAeroportos.find(a => a.id === gerarProformaCalculo?.aeroporto_id)}
            voos={voos}
            voosLigados={voosLigados}
          />
        );
        })()}

      {calculoParaAlterarCambio && (
        <AlterarCambioModal
          isOpen={isAlterarCambioModalOpen}
          onClose={() => {
            setIsAlterarCambioModalOpen(false);
            setCalculoParaAlterarCambio(null);
          }}
          calculo={calculoParaAlterarCambio}
          onConfirm={handleConfirmarAlterarCambio}
          voos={voos}
        />
      )}

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
        showCancel={alertInfo.showCancel}
        onConfirm={alertInfo.onConfirm}
        confirmText={alertInfo.confirmText}
      />

      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
        title={successInfo.title}
        message={successInfo.message}
      />

      <ProgressModal
        isOpen={progressModal.isOpen}
        title={progressModal.title}
        currentStep={progressModal.currentStep}
        totalSteps={progressModal.totalSteps}
        successCount={progressModal.successCount}
        errorCount={progressModal.errorCount}
        currentItem={progressModal.currentItem}
        errors={progressModal.errors}
      />

      {uploadDocumentoData && (
        <UploadDocumentoVooModal
          isOpen={isUploadDocumentoModalOpen}
          onClose={() => {
            setIsUploadDocumentoModalOpen(false);
            setUploadDocumentoData(null);
          }}
          onConfirm={handleConfirmarUploadDocumento}
          vooLigado={uploadDocumentoData.vooLigado}
          voos={voos}
          tipoDocumento={uploadDocumentoData.tipoDocumento}
        />
      )}

      <CancelarProformaModal
        isOpen={cancelarProformaModal.isOpen}
        onClose={() => setCancelarProformaModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={cancelarProformaModal.onConfirm || (() => {})}
        proforma={cancelarProformaModal.proforma}
        descricao={cancelarProformaModal.descricao}
      />

      <LixeiraVoosModal
        isOpen={isLixeiraModalOpen}
        onClose={() => setIsLixeiraModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
          queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
          queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
        }}
        companhias={companhias}
        aeroportos={todosAeroportos}
        voosLigados={voosLigados}
      />

      {recursosVooModalData && (
        <RecursosVooModal
          isOpen={isRecursosVooModalOpen}
          onClose={() => { setIsRecursosVooModalOpen(false); setRecursosVooModalData(null); }}
          vooLigado={recursosVooModalData}
          voos={voos}
          aeroportos={todosAeroportos}
          onResourcesSaved={handleResourcesSaved}
        />
      )}

      {documentosVooModalData && (
        <DocumentosVooModal
          isOpen={isDocumentosVooModalOpen}
          onClose={() => {
            setIsDocumentosVooModalOpen(false);
            setDocumentosVooModalData(null);
          }}
          vooLigado={documentosVooModalData}
          voos={voos}
          onOpenUploadModal={handleOpenUploadFromDocumentosModal}
          user={user}
        />
      )}

      {uploadMultiplosModalData && (
        <UploadMultiplosDocumentosModal
          isOpen={isUploadMultiplosModalOpen}
          onClose={() => {
            setIsUploadMultiplosModalOpen(false);
            setUploadMultiplosModalData(null);
          }}
          vooLigado={uploadMultiplosModalData}
          voos={voos}
          user={user}
          onSuccess={(uploadedFiles) => {
            setIsUploadMultiplosModalOpen(false);
            setUploadMultiplosModalData(null);
            setDocumentosVooModalData(uploadMultiplosModalData);
            setIsDocumentosVooModalOpen(true);
          }}
        />
      )}
      </React.Suspense>
    </div>
  );
}