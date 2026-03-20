import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Download, Settings, Filter, X, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';

import { supabase } from '@/lib/supabaseClient';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { RegistoAeronave } from '@/entities/RegistoAeronave';
import { ModeloAeronave } from '@/entities/ModeloAeronave';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { TarifaPouso } from '@/entities/TarifaPouso';
import { TarifaPermanencia } from '@/entities/TarifaPermanencia';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { Imposto } from '@/entities/Imposto';
import { User } from '@/entities/User';
import { createPageUrl } from '@/utils';
import { hasUserProfile, getAeroportosPermitidos, isSuperAdmin } from '@/components/lib/userUtils';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';
import { useAeroportos, useCompanhias, useAeronaves, useModelosAeronave } from '@/components/lib/useStaticData';
import { useCompanyView } from '@/lib/CompanyViewContext';

import VoosTable from '../components/operacoes/VoosTable';
import FormVoo from '../components/operacoes/FormVoo';
import { downloadAsExcel } from '../components/lib/export';
import { calculateAllTariffs } from '../components/lib/tariffCalculations';

import AeroportosConfig from '../components/operacoes/config/AeroportosConfig';
import CompanhiasConfig from '../components/operacoes/config/CompanhiasConfig';
import ModelosAeronaveConfig from '../components/operacoes/config/ModelosAeronaveConfig';
import RegistosAeronaveConfig from '../components/operacoes/config/RegistosAeronaveConfig';
import VoosLigadosTable from '../components/operacoes/VoosLigadosTable';
import TariffDetailsModal from '../components/operacoes/TariffDetailsModal';
import VoosLigadosFilters from '../components/operacoes/VoosLigadosFilters';

import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';
import CancelarProformaModal from '../components/shared/CancelarProformaModal';
import ProgressModal from '../components/operacoes/ProgressModal';

import GerarFaturaModal from '../components/faturacao/GerarFaturaModal';
import { Proforma } from '@/entities/Proforma';
import { base44 } from '@/api/base44Client';
import { registarCriacao } from '../components/lib/auditoria';
import AlterarCambioModal from '../components/operacoes/AlterarCambioModal';
import RecursosVooModal from '../components/operacoes/RecursosVooModal';
import UploadDocumentoVooModal from '../components/operacoes/UploadDocumentoVooModal';
import LixeiraVoosModal from '../components/operacoes/LixeiraVoosModal';
import DocumentosVooModal from '../components/operacoes/DocumentosVooModal';
import UploadMultiplosDocumentosModal from '../components/operacoes/UploadMultiplosDocumentosModal';

const formatCurrency = (value, currency = 'AOA') => {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: currency }).format(value || 0);
};

// Helper: fetch lightweight calculo map (paginated, bypasses PostgREST 1000 row limit)
async function fetchCalculoMap(empresaId) {
  const PAGE = 500;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('calculo_tarifa')
      .select('voo_id,voo_ligado_id,total_tarifa_usd,total_tarifa,tipo_tarifa,taxa_cambio_usd_aoa')
      .eq('empresa_id', empresaId)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Calculo map error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

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
   const effectiveEmpresaIdRef = useRef(effectiveEmpresaId);
   effectiveEmpresaIdRef.current = effectiveEmpresaId;
   const [voos, setVoos] = useState([]);
   const [voosLigados, setVoosLigados] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [todosAeroportos, setTodosAeroportos] = useState([]);
  const [companhias, setCompanhias] = useState([]);
  const [aeronaves, setAeronaves] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [modelosAeronave, setModelosAeronave] = useState([]);
  const [calculosTarifa, setCalculosTarifa] = useState([]);
  const [tarifasPouso, setTarifasPouso] = useState([]);
  const [tarifasPermanencia, setTarifasPermanencia] = useState([]);
  const [outrasTarifas, setOutrasTarifas] = useState([]);
  const [impostos, setImpostos] = useState([]);
  const [configuracaoSistema, setConfiguracaoSistema] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tipoMovimentoForm, setTipoMovimentoForm] = useState('ARR');
  const [editingVoo, setEditingVoo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
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
    cargaMax: ''
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

  const loadData = useCallback(async (tentativa = 1) => {
    const MAX_TENTATIVAS = 3;
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      if (hasUserProfile(user, 'gestor_empresa')) {
        window.location.href = createPageUrl('Credenciamento');
        return;
      }

      // Server-side filters: empresa_id + deleted_at
      const empId = effectiveEmpresaIdRef.current || user.empresa_id;
      const vooFilters = { deleted_at: { $is: null } };
      if (empId) vooFilters.empresa_id = empId;
      const vlFilters = empId ? { empresa_id: empId } : {};

      // Load data: Voos + VooLigados via entity (paginated), CalculosTarifa via lightweight RPC
      const [
        voosResult,
        voosLigadosResult,
        calculosMapResult,
        tarifasPousoResult,
        tarifasPermanenciaResult,
        outrasTarifasResult,
        impostosResult,
        configResult
      ] = await Promise.allSettled([
        Voo.filter(vooFilters, '-data_operacao', 1000),
        VooLigado.filter(vlFilters, '-created_date'),
        empId
          ? fetchCalculoMap(empId)
          : Promise.resolve([]),
        TarifaPouso.filter(empId ? { empresa_id: empId } : {}).catch(() => []),
        TarifaPermanencia.filter(empId ? { empresa_id: empId } : {}).catch(() => []),
        OutraTarifa.filter(empId ? { empresa_id: empId } : {}).catch(() => []),
        Imposto.list().catch(() => []),
        ConfiguracaoSistema.list().catch(() => [])
      ]);

      const voosData = voosResult.status === 'fulfilled' ? voosResult.value : [];
      const voosLigadosData = voosLigadosResult.status === 'fulfilled' ? voosLigadosResult.value : [];

      // Calculo map — direct table query returns exact column names, no mapping needed
      const calculosTarifaData = calculosMapResult.status === 'fulfilled' ? calculosMapResult.value : [];
      const tarifasPousoData = tarifasPousoResult.status === 'fulfilled' ? tarifasPousoResult.value : [];
      const tarifasPermanenciaData = tarifasPermanenciaResult.status === 'fulfilled' ? tarifasPermanenciaResult.value : [];
      const outrasTarifasData = outrasTarifasResult.status === 'fulfilled' ? outrasTarifasResult.value : [];
      const impostosData = impostosResult.status === 'fulfilled' ? impostosResult.value : [];
      const configData = configResult.status === 'fulfilled' ? configResult.value : [];

      const configuracaoSistemaData = configData.length > 0 ? configData[0] : { taxa_cambio_usd_aoa: 850 };

      // Data already filtered server-side — no client-side filtering needed
      setVoos(voosData);
      setVoosLigados(voosLigadosData);
      setCalculosTarifa(calculosTarifaData);
      setTarifasPouso(filterTarifasByEmpresa(tarifasPousoData, empId));
      setTarifasPermanencia(filterTarifasByEmpresa(tarifasPermanenciaData, empId));
      setOutrasTarifas(filterTarifasByEmpresa(outrasTarifasData, empId));
      setImpostos(filterTarifasByEmpresa(impostosData, empId));
      setConfiguracaoSistema(configuracaoSistemaData);

      setIsLoading(false);
    } catch (error) {
      console.error(`❌ Erro ao carregar dados (tentativa ${tentativa}):`, error);

      if (tentativa < MAX_TENTATIVAS && !error.message?.includes('You must be logged in') && error.response?.status !== 403) {
        const tempoEspera = tentativa * 2000;
        setTimeout(() => { loadData(tentativa + 1); }, tempoEspera);
        return;
      }

      if (error.message?.includes('You must be logged in')) {
        alert(t('operacoes.sessao_expirada'));
        await User.login();
      } else if (error.response?.status === 403) {
        alert(t('operacoes.acesso_negado'));
        window.location.href = createPageUrl('Home');
      }

      setIsLoading(false);
    }
  }, []);

  const refreshSpecificData = async (dataTypes = ['voos', 'voosLigados', 'calculosTarifa']) => {
    try {
      const promises = [];

      if (dataTypes.includes('voos')) {
        promises.push(Voo.list('-data_operacao', 1000).then(data => ({ type: 'voos', data })));
      }
      if (dataTypes.includes('voosLigados')) {
        promises.push(VooLigado.list('-created_date', 1000).then(data => ({ type: 'voosLigados', data })));
      }
      if (dataTypes.includes('calculosTarifa')) {
        const empIdCalc = effectiveEmpresaIdRef.current || currentUser?.empresa_id;
        promises.push(CalculoTarifa.filter(empIdCalc ? { empresa_id: empIdCalc } : {}, '-data_calculo').then(data => ({ type: 'calculosTarifa', data })));
      }
      if (dataTypes.includes('companhias')) {
        promises.push(CompanhiaAerea.list().then(data => ({ type: 'companhias', data })));
      }
      if (dataTypes.includes('aeroportos')) {
        const empresaIdFiltroAero = effectiveEmpresaIdRef.current || currentUser?.empresa_id;
        promises.push((empresaIdFiltroAero ? Aeroporto.filter({ empresa_id: empresaIdFiltroAero }) : Aeroporto.list()).then(data => ({ type: 'aeroportos', data })));
      }
      if (dataTypes.includes('aeronaves')) {
        promises.push(RegistoAeronave.list().then(data => ({ type: 'aeronaves', data })));
      }
      if (dataTypes.includes('modelos')) {
        promises.push(ModeloAeronave.list().then(data => ({ type: 'modelos', data })));
      }


      const results = await Promise.allSettled(promises);

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { type, data } = result.value;
          switch (type) {
            case 'voos': {
              const empresaIdFiltro = effectiveEmpresaIdRef.current || currentUser?.empresa_id;
              const voosFilt = data.filter(v => !v.deleted_at);
              setVoos(empresaIdFiltro ? voosFilt.filter(v => v.empresa_id === empresaIdFiltro) : voosFilt);
              break;
            }
            case 'voosLigados': {
              const empresaIdFiltro = effectiveEmpresaIdRef.current || currentUser?.empresa_id;
              setVoosLigados(empresaIdFiltro ? data.filter(vl => vl.empresa_id === empresaIdFiltro) : data);
              break;
            }
            case 'calculosTarifa':
              setCalculosTarifa(data);
              break;
            case 'companhias':
              setCompanhias(data);
              break;
            case 'aeroportos':
              setTodosAeroportos(data);
              const allAngolanAeroportos = data.filter(a => a.pais === 'AO');
              setAeroportos(getAeroportosPermitidos(currentUser, allAngolanAeroportos, effectiveEmpresaIdRef.current));
              break;
            case 'aeronaves':
              setAeronaves(data);
              break;
            case 'modelos':
              setModelosAeronave(data);
              break;
            default:
              break;
          }
        }
      });

    } catch (error) {
      console.error('❌ Erro na atualização específica:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData, effectiveEmpresaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar dados estáticos com os caches (useStaticData hooks)
  useEffect(() => {
    if (aeroportosCache.length > 0) {
      setTodosAeroportos(aeroportosCache);
      const allAngolan = aeroportosCache.filter(a => a.pais === 'AO');
      if (currentUser) {
        setAeroportos(getAeroportosPermitidos(currentUser, allAngolan, effectiveEmpresaIdRef.current));
      }
    }
  }, [aeroportosCache, currentUser]);

  useEffect(() => {
    if (companhiasCache.length > 0) setCompanhias(companhiasCache);
  }, [companhiasCache]);

  useEffect(() => {
    if (aeronavesCache.length > 0) setAeronaves(aeronavesCache);
  }, [aeronavesCache]);

  useEffect(() => {
    if (modelosCache.length > 0) setModelosAeronave(modelosCache);
  }, [modelosCache]);

  // Filtragem por data (server-side) quando os filtros de data mudam
  useEffect(() => {
    const handleServerSideFilter = async () => {
      if (!filtros.dataInicio && !filtros.dataFim) {
        // Se não há filtros de data, recarregar com os 100 últimos voos
        setIsFiltering(false);
        return;
      }

      setIsFiltering(true);
      try {
        const query = { deleted_at: { $eq: null } };
        if (filtros.dataInicio) {
          query.data_operacao = { ...query.data_operacao, $gte: filtros.dataInicio };
        }
        if (filtros.dataFim) {
          query.data_operacao = { ...query.data_operacao, $lte: filtros.dataFim };
        }

        // Buscar em lotes com paginação
        let allVoos = [];
        let skip = 0;
        const BATCH_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
          const batch = await Voo.filter(query, '-data_operacao', BATCH_SIZE, skip);

          if (batch && batch.length > 0) {
            allVoos = [...allVoos, ...batch];

            if (batch.length < BATCH_SIZE) {
              hasMore = false;
            } else {
              skip += BATCH_SIZE;
            }
          } else {
            hasMore = false;
          }
        }

        // Filtrar por empresa_id direto
        const empId = effectiveEmpresaIdRef.current || currentUser?.empresa_id;
        const filteredVoos = empId ? allVoos.filter(v => v.empresa_id === empId) : allVoos;

        setVoos(filteredVoos);
      } catch (error) {
        console.error('❌ Erro ao filtrar voos por data:', error);
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('operacoes.erro_filtrar'),
          message: t('operacoes.erro_filtrar_msg')
        });
      } finally {
        setIsFiltering(false);
      }
    };

    // Debounce de 500ms para evitar múltiplas chamadas ao servidor
    const timer = setTimeout(handleServerSideFilter, 500);
    return () => clearTimeout(timer);
  }, [filtros.dataInicio, filtros.dataFim, currentUser]);

  // Voos Ligados: server-side reload when user clicks "Buscar"
  const handleBuscarLigados = useCallback(async () => {
    setIsFilteringLigados(true);
    try {
      const empId = effectiveEmpresaIdRef.current || currentUser?.empresa_id;

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
      setVoos(voosData);

      // 2. Reload voo_ligados + calculos
      const vlFilters = empId ? { empresa_id: empId } : {};
      const [vlData, calculosData] = await Promise.all([
        VooLigado.filter(vlFilters, '-created_date'),
        empId
          ? fetchCalculoMap(empId)
          : Promise.resolve([]),
      ]);

      setVoosLigados(vlData);
      setCalculosTarifa(calculosData);
    } catch (error) {
      console.error('❌ Erro ao buscar voos ligados:', error);
    } finally {
      setIsFilteringLigados(false);
    }
  }, [filtrosLigados.dataInicio, filtrosLigados.dataFim, currentUser]);

  const voosLigadosValidos = useMemo(() => {
    return voosLigados.filter(vooLigado => {
      const vooArrExiste = voos.some(v => v.id === vooLigado.id_voo_arr);
      const vooDepExiste = voos.some(v => v.id === vooLigado.id_voo_dep);
      return vooArrExiste && vooDepExiste;
    });
  }, [voos, voosLigados]);

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
      const empId = effectiveEmpresaIdRef.current || currentUser?.empresa_id;
      const vooDataWithMeta = {
        ...vooData,
        updated_by: currentUser?.email || 'sistema',
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

            // Verificar se já existe cálculo (usar state em vez de buscar do banco)
            const existingCalculo = calculosTarifa.find(ct => ct.voo_ligado_id === vooLigadoInstance.id || ct.voo_id === vooDep.id);

            if (existingCalculo) {
              await CalculoTarifa.update(existingCalculo.id, calculoComVooLigado);
            } else {
              await CalculoTarifa.create(calculoComVooLigado);
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

      await refreshSpecificData(['voos', 'voosLigados', 'calculosTarifa']);

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
          await Voo.update(voo.id, { ...voo, status: 'Cancelado', updated_by: currentUser?.email || 'sistema' });
          await refreshSpecificData(['voos']);
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
                cancelado_por: currentUser?.email || 'sistema',
                data_cancelamento: new Date().toISOString()
              });
            }
          }
        } catch (_) {}

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
        } catch (_) {}

        await Voo.update(voo.id, {
          deleted_at: new Date().toISOString(),
          deleted_by: currentUser?.email || 'sistema'
        });

        await refreshSpecificData(['voos', 'voosLigados', 'calculosTarifa']);

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
    } catch (_) {}

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
    if (!isSuperAdmin(currentUser)) {
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
          await refreshSpecificData(['voos']);
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
                cancelado_por: currentUser?.email || 'sistema',
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

        await refreshSpecificData(['voos', 'voosLigados', 'calculosTarifa']);

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
      } catch (_) {}
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

        await refreshSpecificData(['calculosTarifa', 'voosLigados', 'voos']);

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
      await refreshSpecificData(['calculosTarifa']);

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
      const empId = effectiveEmpresaIdRef.current || currentUser?.empresa_id;
      const proformas = await Proforma.list();
      const proformaExistente = proformas.find(f =>
        f.calculo_tarifa_id === calculo.id &&
        f.status !== 'cancelada' &&
        (!empId || f.empresa_id === empId)
      );

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
      const empId = effectiveEmpresaIdRef.current || currentUser?.empresa_id;
      const proformas = await Proforma.list();
      const ano = new Date().getFullYear();
      const prefixoProforma = `PF-${ano}-`;
      // Numeração sequencial por empresa
      const proformasDoAno = proformas.filter(f =>
        f.numero_proforma?.startsWith(prefixoProforma) &&
        (!empId || f.empresa_id === empId)
      );
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
        emitida_por: currentUser?.email || 'sistema',
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
      await refreshSpecificData(['calculosTarifa', 'voosLigados']);

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
      await refreshSpecificData(['calculosTarifa']);
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
        empresa_id: currentUser?.empresa_id,
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
      cargaMax: ''
    });
    setIsFiltering(false);
        loadData(); // Recarregar com os 1000 últimos voos
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
    loadData();
  };

  const voosFiltrados = useMemo(() => {
    const filtered = voos.filter(voo => {
      const dataMatch = (!filtros.dataInicio || voo.data_operacao >= filtros.dataInicio) &&
                       (!filtros.dataFim || voo.data_operacao <= filtros.dataFim);
      const tipoMatch = filtros.tipoMovimento === 'todos' || voo.tipo_movimento === filtros.tipoMovimento;
      const statusMatch = filtros.status === 'todos' || voo.status === filtros.status;


      let companhiaMatch = true;
      if (filtros.companhia !== 'todos') {
        if (filtros.companhia === 'outro') {
          const knownCompanyCodes = new Set();
          companhias.forEach(c => { if (c.codigo_icao) knownCompanyCodes.add(c.codigo_icao); if (c.codigo_iata) knownCompanyCodes.add(c.codigo_iata); });
          companhiaMatch = voo.companhia_aerea && !knownCompanyCodes.has(voo.companhia_aerea);
        } else {
          const comp = companhias.find(c => c.codigo_icao === filtros.companhia);
          companhiaMatch = voo.companhia_aerea === filtros.companhia ||
            (comp && (comp.codigo_iata === voo.companhia_aerea || comp.codigo_icao === voo.companhia_aerea));
        }
      }

      const aeroportoMatch = filtros.aeroporto === 'todos' || voo.aeroporto_operacao === filtros.aeroporto;
      const tipoVooMatch = filtros.tipoVoo === 'todos' || voo.tipo_voo === filtros.tipoVoo;

      const buscaMatch = !filtros.busca ||
                         voo.numero_voo?.toLowerCase().includes(filtros.busca.toLowerCase()) ||
                         voo.registo_aeronave?.toLowerCase().includes(filtros.busca.toLowerCase());

      // Filtro de passageiros
      const passageirosMin = filtros.passageirosMin ? parseInt(filtros.passageirosMin) : null;
      const passageirosMax = filtros.passageirosMax ? parseInt(filtros.passageirosMax) : null;
      const passageirosTotal = voo.passageiros_total || 0;
      const passageirosMatch = 
        (passageirosMin === null || passageirosTotal >= passageirosMin) &&
        (passageirosMax === null || passageirosTotal <= passageirosMax);

      // Filtro de carga
      const cargaMin = filtros.cargaMin ? parseFloat(filtros.cargaMin) : null;
      const cargaMax = filtros.cargaMax ? parseFloat(filtros.cargaMax) : null;
      const cargaKg = voo.carga_kg || 0;
      const cargaMatch = 
        (cargaMin === null || cargaKg >= cargaMin) &&
        (cargaMax === null || cargaKg <= cargaMax);

      // Filtro de vinculação
      let vinculacaoMatch = true;
      if (filtros.statusVinculacao !== 'todos') {
        const isLinked = voosLigados.some((vl) => {
          const isLinkedToThisVoo = vl.id_voo_arr === voo.id || vl.id_voo_dep === voo.id;
          if (!isLinkedToThisVoo) return false;
          
          const vooArrExiste = voos.some(v => v.id === vl.id_voo_arr);
          const vooDepExiste = voos.some(v => v.id === vl.id_voo_dep);
          
          return vooArrExiste && vooDepExiste;
        });

        if (filtros.statusVinculacao === 'ligado') {
          vinculacaoMatch = isLinked;
        } else if (filtros.statusVinculacao === 'sem_link') {
          vinculacaoMatch = !isLinked && voo.status !== 'Cancelado';
        }
      }

      return dataMatch && tipoMatch && statusMatch && companhiaMatch && aeroportoMatch && 
             tipoVooMatch && buscaMatch && passageirosMatch && cargaMatch && vinculacaoMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

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
          <TabsList className="grid w-full grid-cols-4 h-auto">
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
            <TabsTrigger value="configuracoes" className="text-xs sm:text-sm px-2 py-2">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('tab.config')}</span>
              <span className="sm:hidden">{t('operacoes.config')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voos" className="space-y-4 sm:space-y-6">
            <Card className="shadow-sm border-0">
              <CardHeader className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
                <div>
                  <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {t('operacoes.gestao_voos')}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{t('operacoes.gestao_voos_desc')}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Button variant="outline" onClick={loadData} disabled={isLoading} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-10 px-2 sm:px-4">
                    <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline ml-2 text-sm">{t('operacoes.atualizar')}</span>
                  </Button>
                  <Button variant="outline" onClick={handleExportCSV} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-10 px-2 sm:px-4">
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline ml-2 text-sm">Excel</span>
                  </Button>
                  {(currentUser?.role === 'admin' || currentUser?.perfis?.includes('administrador')) && (
                    <Button variant="outline" onClick={() => setIsLixeiraModalOpen(true)} className="border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950 h-8 sm:h-10 px-2 sm:px-4">
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline ml-2 text-sm">{t('operacoes.lixeira')}</span>
                    </Button>
                  )}
                  <Button className="bg-blue-500 hover:bg-blue-600 text-white h-8 sm:h-10 px-2 sm:px-4" onClick={() => handleOpenForm('ARR', null)}>
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline ml-2 text-sm">{t('operacoes.adicionar_voo')}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <Card className="mb-4 sm:mb-6 border-slate-200 dark:border-slate-700">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
                      <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400" />
                      <span className="hidden sm:inline">{t('operacoes.filtros_pesquisa')}</span>
                      <span className="sm:hidden">{t('operacoes.filtros')}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div className="sm:col-span-2 lg:col-span-4">
                        <Label htmlFor="busca" className="text-xs sm:text-sm">{t('operacoes.pesquisar')}</Label>
                        <Input
                          id="busca"
                          placeholder={t('operacoes.voo_ou_matricula')}
                          value={filtros.busca}
                          onChange={(e) => handleFilterChange('busca', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="data-inicio" className="text-xs sm:text-sm">{t('operacoes.data_inicio')}</Label>
                        <Input id="data-inicio" type="date" value={filtros.dataInicio} onChange={(e) => handleFilterChange('dataInicio', e.target.value)} className="text-xs sm:text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="data-fim" className="text-xs sm:text-sm">{t('operacoes.data_fim')}</Label>
                        <Input id="data-fim" type="date" value={filtros.dataFim} onChange={(e) => handleFilterChange('dataFim', e.target.value)} className="text-xs sm:text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="filtro-tipo" className="text-xs sm:text-sm">{t('operacoes.tipo')}</Label>
                        <Select
                          id="filtro-tipo"
                          options={tipoMovimentoOptions}
                          value={filtros.tipoMovimento}
                          onValueChange={(v) => handleFilterChange('tipoMovimento', v)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-status" className="text-xs sm:text-sm">{t('operacoes.status')}</Label>
                        <Select
                          id="filtro-status"
                          options={statusOptions}
                          value={filtros.status}
                          onValueChange={(v) => handleFilterChange('status', v)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-tipo-voo" className="text-xs sm:text-sm">{t('operacoes.tipo_voo')}</Label>
                        <Combobox
                          id="filtro-tipo-voo"
                          options={tipoVooOptions}
                          value={filtros.tipoVoo}
                          onValueChange={(v) => handleFilterChange('tipoVoo', v)}
                          placeholder={`${t('operacoes.todos')}...`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-companhia" className="text-xs sm:text-sm">{t('operacoes.companhia')}</Label>
                        <Combobox
                          id="filtro-companhia"
                          options={companhiaOptions}
                          value={filtros.companhia}
                          onValueChange={(v) => handleFilterChange('companhia', v)}
                          placeholder={`${t('operacoes.todos')}...`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-aeroporto" className="text-xs sm:text-sm">{t('operacoes.aeroporto')}</Label>
                        <Combobox
                          id="filtro-aeroporto"
                          options={aeroportoOptions}
                          value={filtros.aeroporto}
                          onValueChange={(v) => handleFilterChange('aeroporto', v)}
                          placeholder={`${t('operacoes.todos')}...`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-vinculacao" className="text-xs sm:text-sm">{t('operacoes.vinculacao')}</Label>
                        <Select
                          id="filtro-vinculacao"
                          options={statusVinculacaoOptions}
                          value={filtros.statusVinculacao}
                          onValueChange={(v) => handleFilterChange('statusVinculacao', v)}
                        />
                      </div>


                      <div>
                        <Label htmlFor="passageiros-min" className="text-xs sm:text-sm">{t('operacoes.passageiros_min')}</Label>
                        <Input
                          id="passageiros-min"
                          type="number"
                          placeholder="0"
                          value={filtros.passageirosMin}
                          onChange={(e) => handleFilterChange('passageirosMin', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="passageiros-max" className="text-xs sm:text-sm">{t('operacoes.passageiros_max')}</Label>
                        <Input
                          id="passageiros-max"
                          type="number"
                          placeholder="999"
                          value={filtros.passageirosMax}
                          onChange={(e) => handleFilterChange('passageirosMax', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="carga-min" className="text-xs sm:text-sm">{t('operacoes.carga_min')}</Label>
                        <Input
                          id="carga-min"
                          type="number"
                          placeholder="0"
                          value={filtros.cargaMin}
                          onChange={(e) => handleFilterChange('cargaMin', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="carga-max" className="text-xs sm:text-sm">{t('operacoes.carga_max')}</Label>
                        <Input
                          id="carga-max"
                          type="number"
                          placeholder="50000"
                          value={filtros.cargaMax}
                          onChange={(e) => handleFilterChange('cargaMax', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <Button variant="outline" onClick={clearFilters} className="w-full text-xs sm:text-sm">
                          <X className="w-3 h-3 sm:w-4 sm:h-4 mr-2" /> {t('operacoes.limpar')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {isFiltering && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">{t('operacoes.carregando_voos')}</p>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <VoosTable
                      voos={voosFiltrados}
                      voosLigados={voosLigados}
                      isLoading={isLoading}
                      onEditVoo={(voo) => handleOpenForm(voo.tipo_movimento, voo)}
                      onCancelarVoo={handleCancelarVoo}
                      onExcluirVoo={handleExcluirVoo}
                      currentUser={currentUser}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="linkados" className="space-y-4 sm:space-y-6">
            <Card className="shadow-sm border-0">
              <CardHeader className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
                <div>
                  <CardTitle className="text-base sm:text-lg md:text-xl flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-fit text-xs">
                        {voosLigadosValidos.length} {t('operacoes.pares')}
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-2">
                    {t('operacoes.voos_ligados_desc')}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Button variant="outline" onClick={loadData} disabled={isLoading} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-10 px-2 sm:px-4">
                    <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline ml-2 text-sm">{t('operacoes.atualizar')}</span>
                  </Button>
                  <Button variant="outline" onClick={handleExportLinkedFlightsCSV} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-10 px-2 sm:px-4">
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline ml-2 text-sm">Excel</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <VoosLigadosFilters
                   filtros={filtrosLigados}
                   onFilterChange={handleFilterChangeLigados}
                   onClearFilters={clearFiltersLigados}
                   onBuscar={handleBuscarLigados}
                   isSearching={isFilteringLigados}
                   companhias={companhias}
                   aeroportos={todosAeroportos}
                 />

                {isFilteringLigados && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">{t('operacoes.carregando_ligados')}</p>
                    </div>
                  </div>
                )}

                {voosLigadosFiltrados.length === 0 && !isLoading ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p className="text-sm sm:text-base">{t('operacoes.nenhum_voo_ligado')}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <VoosLigadosTable
                        voosLigados={voosLigadosFiltrados}
                        voos={voos}
                        calculosTarifa={calculosTarifa}
                        isLoading={isLoading}
                        onShowTariffDetails={handleShowTariffDetails}
                        onExportPDF={handleExportTariffPDF}
                        onGerarProforma={handleGerarProforma}
                        onRecalcularTarifa={async (vooLigado) => {
                          try {
                            await _recalculateSingleTariff(vooLigado);
                            // Buscar apenas o cálculo atualizado em vez de recarregar tudo
                            const updatedCalculo = await CalculoTarifa.filter({ voo_ligado_id: { $eq: vooLigado.id } });
                            if (updatedCalculo.length > 0) {
                              setCalculosTarifa(prev => {
                                const withoutOld = prev.filter(ct => ct.voo_ligado_id !== vooLigado.id);
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
                        }}
                        onRecalcularTarifaLote={handleRecalcularTarifasLote}
                        onAlterarCambio={handleAlterarCambio}
                        onExcluirVooLigado={handleExcluirVooLigado}
                        onUploadDocumento={handleUploadDocumento}
                        onVerDocumentosVoo={handleVerDocumentosVoo}
                        onRecursosVoo={handleRecursosVoo}
                        todosAeroportos={todosAeroportos}
                        sortField={sortFieldLigados}
                        sortDirection={sortDirectionLigados}
                        onSort={handleSortLigados}
                        currentUser={currentUser}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
                    <AeroportosConfig aeroportos={todosAeroportos} onReload={() => refreshSpecificData(['aeroportos'])} />
                  </TabsContent>

                  <TabsContent value="companhias" className="mt-4 sm:mt-6">
                    <CompanhiasConfig companhias={companhias} onUpdate={() => refreshSpecificData(['companhias'])} />
                  </TabsContent>

                  <TabsContent value="modelos" className="mt-4 sm:mt-6">
                    <ModelosAeronaveConfig modelos={modelosAeronave} onReload={() => refreshSpecificData(['modelos'])} />
                  </TabsContent>

                  <TabsContent value="registos" className="mt-4 sm:mt-6">
                    <RegistosAeronaveConfig
                      registos={aeronaves}
                      modelos={modelosAeronave}
                      companhias={companhiasCache.length > 0 ? companhiasCache : companhias}
                      onReload={() => refreshSpecificData(['aeronaves'])}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
          currentUser={currentUser}
          linkedArrVoo={vooArrToLink}
          setAlertInfo={setAlertInfo}
          onRefreshData={() => refreshSpecificData(['voos', 'voosLigados'])}
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
        onSuccess={() => refreshSpecificData(['voos', 'voosLigados', 'calculosTarifa'])}
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
          currentUser={currentUser}
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
          currentUser={currentUser}
          onSuccess={(uploadedFiles) => {
            setIsUploadMultiplosModalOpen(false);
            setUploadMultiplosModalData(null);
            setDocumentosVooModalData(uploadMultiplosModalData);
            setIsDocumentosVooModalOpen(true);
          }}
        />
      )}
    </div>
  );
}