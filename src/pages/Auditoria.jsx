import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Shield,
  Plane,
  AlertTriangle,
  Building,
  Settings,
  Plus,
  FileText,
  RefreshCw,
  ClipboardCheck,
  CheckCircle,
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

import { TipoAuditoria } from '@/entities/TipoAuditoria';
import { ItemAuditoria } from '@/entities/ItemAuditoria';
import { RespostaAuditoria } from '@/entities/RespostaAuditoria';
import { ProcessoAuditoria } from '@/entities/ProcessoAuditoria';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User';
import { PlanoAcaoCorretiva } from '@/entities/PlanoAcaoCorretiva';
import { ItemPAC } from '@/entities/ItemPAC';

import { ensureUserProfilesExist, getAeroportosPermitidos, filtrarDadosPorAcesso, isAdminProfile } from '../components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { Empresa } from '@/entities/Empresa';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

import FormProcessoAuditoria from '../components/auditoria/FormProcessoAuditoria';
import ConfiguracaoAuditoria from '../components/auditoria/ConfiguracaoAuditoria';
import AuditoriaDetailModal from '../components/auditoria/AuditoriaDetailModal';
import FormChecklist from '../components/auditoria/FormChecklist';
import FormPAC from '../components/auditoria/FormPAC';
import AlertModal from '../components/shared/AlertModal';

import AuditoriaStatsCards from '../components/auditoria/AuditoriaStatsCards';
import ProcessosTab from '../components/auditoria/ProcessosTab';
import PACsTab from '../components/auditoria/PACsTab';
import { exportAuditoriaPDF } from '../components/auditoria/exportAuditoriaPDF';

const CATEGORIAS_CONFIG = {
  seguranca_operacional: {
    labelKey: 'auditoria.segurancaOperacional',
    label: 'Segurança Operacional',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  seguranca_avsec: {
    labelKey: 'auditoria.segurancaAvsec',
    label: 'Segurança AVSEC',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  resposta_emergencia: {
    labelKey: 'auditoria.respostaEmergencia',
    label: 'Resposta a Emergência',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  infraestrutura: {
    labelKey: 'auditoria.infraestrutura',
    label: 'Infraestrutura',
    icon: Building,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  operacoes: {
    labelKey: 'auditoria.operacoes',
    label: 'Operações',
    icon: Plane,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  }
};

export default function Auditoria() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const { user } = useAuth();
  const currentUser = ensureUserProfilesExist(user);

  // --- Shared data state ---
  const [tiposAuditoria, setTiposAuditoria] = useState([]);
  const [processosAuditoria, setProcessosAuditoria] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [users, setUsers] = useState([]);
  const [pacs, setPacs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- UI state ---
  const [activeTab, setActiveTab] = useState('processos');
  const [selectedCategoria, setSelectedCategoria] = useState('todos');

  // --- Modal/form state ---
  const [showFormProcesso, setShowFormProcesso] = useState(false);
  const [selectedProcesso, setSelectedProcesso] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showFormPAC, setShowFormPAC] = useState(false);
  const [editingProcesso, setEditingProcesso] = useState(null);
  const [editingPAC, setEditingPAC] = useState(null);
  const [nonConformitiesForPAC, setNonConformitiesForPAC] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [deleteProcessoInfo, setDeleteProcessoInfo] = useState({ isOpen: false, processo: null });
  const [deletePACInfo, setDeletePACInfo] = useState({ isOpen: false, pac: null });

  // --- Filters ---
  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    status: 'todos',
    dataInicio: '',
    dataFim: '',
    responsavel: ''
  });
  const [isSearching, setIsSearching] = useState(false);

  // --- Permission & alerts ---
  const [gestaoPermission, setGestaoPermission] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });

  const showSuccess = useCallback((title, description) => {
    setAlertInfo({ isOpen: true, type: 'success', title, message: description });
  }, []);

  const showError = useCallback((title, description) => {
    setAlertInfo({ isOpen: true, type: 'error', title, message: description });
  }, []);

  // Aeroportos the user has access to
  const aeroportosAcesso = useMemo(() => {
    if (!currentUser || !Array.isArray(aeroportos)) return [];
    return getAeroportosPermitidos(currentUser, aeroportos, effectiveEmpresaId);
  }, [aeroportos, currentUser, effectiveEmpresaId]);

  // --- Data loading ---
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isAdmin = isAdminProfile(currentUser);
      setGestaoPermission(isAdmin);

      const empId = effectiveEmpresaId || currentUser?.empresa_id;
      const processoPromise = empId
        ? ProcessoAuditoria.filter({ empresa_id: empId }, '-data_auditoria')
        : ProcessoAuditoria.list('-data_auditoria');

      const [tiposData, processosData, aeroportosData, usersData, pacsData, , , empresasData] = await Promise.all([
        TipoAuditoria.list(),
        processoPromise,
        Aeroporto.filter({ pais: 'AO' }),
        empId ? User.filter({ empresa_id: empId }) : User.list(),
        PlanoAcaoCorretiva.list('-data_criacao'),
        ItemAuditoria.list(),
        ItemPAC.list(),
        Empresa.list()
      ]);

      const processosFiltrados = filtrarDadosPorAcesso(user, processosData || [], 'aeroporto_id', aeroportosData || [], effectiveEmpresaId);
      const pacsFiltrados = filtrarDadosPorAcesso(user, pacsData || [], 'aeroporto_id', aeroportosData || [], effectiveEmpresaId);

      setProcessosAuditoria(processosFiltrados);
      setTiposAuditoria(tiposData || []);
      setAeroportos(aeroportosData || []);
      setPacs(pacsFiltrados);
      setUsers(usersData || []);
      setEmpresas(empresasData || []);
    } catch (error) {
      console.error('Erro ao carregar dados ou verificar usuário:', error);
      setGestaoPermission(false);
      setProcessosAuditoria([]);
      setAeroportos([]);
      setTiposAuditoria([]);
      setUsers([]);
      setPacs([]);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('auditoria.erroCarregamento'),
        message: t('auditoria.erroCarregamentoDesc')
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Search / filter ---
  const handleBuscar = async () => {
    setIsSearching(true);
    try {
      const empId = effectiveEmpresaId || currentUser?.empresa_id;

      const queryProcesso = {};
      if (empId) queryProcesso.empresa_id = empId;
      if (filtros.aeroporto !== 'todos') queryProcesso.aeroporto_id = filtros.aeroporto;
      if (filtros.status !== 'todos') queryProcesso.status = filtros.status;
      if (filtros.dataInicio) queryProcesso.data_auditoria = { ...queryProcesso.data_auditoria, $gte: filtros.dataInicio };
      if (filtros.dataFim) queryProcesso.data_auditoria = { ...queryProcesso.data_auditoria, $lte: filtros.dataFim };

      const processosData = await ProcessoAuditoria.filter(
        Object.keys(queryProcesso).length > 0 ? queryProcesso : {},
        '-data_auditoria'
      );
      const processosFiltrados = filtrarDadosPorAcesso(currentUser, processosData || [], 'aeroporto_id', aeroportos || [], effectiveEmpresaId);
      setProcessosAuditoria(processosFiltrados);

      const queryPAC = {};
      if (empId) queryPAC.empresa_id = empId;
      if (filtros.aeroporto !== 'todos') queryPAC.aeroporto_id = filtros.aeroporto;
      if (filtros.status !== 'todos') queryPAC.status = filtros.status;
      if (filtros.dataInicio) queryPAC.data_criacao = { ...queryPAC.data_criacao, $gte: filtros.dataInicio };
      if (filtros.dataFim) queryPAC.data_criacao = { ...queryPAC.data_criacao, $lte: filtros.dataFim };

      const pacsData = await PlanoAcaoCorretiva.filter(
        Object.keys(queryPAC).length > 0 ? queryPAC : {},
        '-data_criacao'
      );
      const pacsFiltrados = filtrarDadosPorAcesso(currentUser, pacsData || [], 'aeroporto_id', aeroportos || [], effectiveEmpresaId);
      setPacs(pacsFiltrados);
    } catch (error) {
      console.error('Erro ao buscar:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearFilters = () => {
    setFiltros({
      aeroporto: 'todos',
      status: 'todos',
      dataInicio: '',
      dataFim: '',
      responsavel: ''
    });
    setAlertInfo({ isOpen: false, type: 'info', title: '', message: '' });
    loadData();
  };

  const hasActiveFilters = filtros.aeroporto !== 'todos' || filtros.status !== 'todos' || filtros.dataInicio || filtros.dataFim || filtros.responsavel;

  // --- Stats ---
  const estatisticas = useMemo(() => ({
    total: processosAuditoria.length,
    concluidas: processosAuditoria.filter((p) => p.status === 'concluida').length,
    emAndamento: processosAuditoria.filter((p) => p.status === 'em_andamento').length,
    conformidadeMedia: processosAuditoria.length > 0 ?
      processosAuditoria.reduce((acc, p) => acc + (p.percentual_conformidade || 0), 0) / processosAuditoria.length : 0
  }), [processosAuditoria]);

  // --- Aeroporto options for combobox ---
  const aeroportoOptions = useMemo(() => [
    { value: 'todos', label: t('auditoria.todosAeroportos') },
    ...aeroportosAcesso.map((a) => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))
  ], [aeroportosAcesso, t]);

  // --- Handlers ---
  const handleSuccess = () => {
    loadData();
    setShowFormProcesso(false);
    setShowConfigModal(false);
    setShowFormPAC(false);
    setEditingProcesso(null);
    setEditingPAC(null);
    setSelectedProcesso(null);
    setNonConformitiesForPAC([]);
    showSuccess(t('auditoria.operacaoRealizada'), t('auditoria.dadosAtualizados'));
  };

  const handleViewAuditoria = (processo) => {
    setSelectedProcesso(processo);
    setShowDetailModal(true);
  };

  const openForm = (processo = null) => {
    setEditingProcesso(processo);
    setShowFormProcesso(true);
  };

  const handleDeleteProcesso = async () => {
    if (deleteProcessoInfo.processo) {
      try {
        await ProcessoAuditoria.delete(deleteProcessoInfo.processo.id);
        showSuccess(t('auditoria.auditoriaExcluida'), t('auditoria.auditoriaExcluidaMsg'));
        loadData();
      } catch (error) {
        console.error('Erro ao excluir auditoria:', error);
        showError(t('auditoria.erroExcluir'), t('auditoria.erroExcluirAuditoriaMsg'));
      }
      setDeleteProcessoInfo({ isOpen: false, processo: null });
    }
  };

  const handleDeletePAC = async () => {
    if (deletePACInfo.pac) {
      try {
        await PlanoAcaoCorretiva.delete(deletePACInfo.pac.id);
        showSuccess(t('auditoria.pacExcluido'), t('auditoria.pacExcluidoMsg'));
        loadData();
      } catch (error) {
        console.error('Erro ao excluir PAC:', error);
        showError(t('auditoria.erroExcluir'), t('auditoria.erroExcluirPACMsg'));
      }
      setDeletePACInfo({ isOpen: false, pac: null });
    }
  };

  const handleEditAuditoria = (processo) => {
    if (processo.status === 'planejada') {
      openForm(processo);
    } else if (processo.status === 'em_andamento') {
      setSelectedProcesso(processo);
      setShowChecklistModal(true);
    } else if (processo.status === 'concluida' && processo.itens_nao_conformes > 0) {
      handleCreatePAC(processo);
    } else {
      handleViewAuditoria(processo);
    }
  };

  const handleCreatePAC = async (processo) => {
    try {
      const respostasNC = await RespostaAuditoria.filter({
        processo_auditoria_id: processo.id,
        situacao_encontrada: 'NC'
      });

      if (respostasNC.length === 0) {
        showError(t("auditoria.semNaoConformidades"), t("auditoria.semNaoConformidadesMsg"));
        return;
      }

      const tipoAuditoria = tiposAuditoria.find((t) => t.id === processo.tipo_auditoria_id);
      if (!tipoAuditoria) {
        showError(t("auditoria.erroPrepararPAC"), t("auditoria.tipoNaoEncontrado"));
        return;
      }

      const allItems = await ItemAuditoria.filter({ tipo_auditoria_id: tipoAuditoria.id });
      const itemMap = new Map(allItems.map((item) => [item.id, item]));

      const enrichedNCs = respostasNC.map((r) => ({
        ...r,
        item: itemMap.get(r.item_auditoria_id)
      }));

      setNonConformitiesForPAC(enrichedNCs);
      setSelectedProcesso(processo);
      setShowFormPAC(true);
    } catch (error) {
      showError(t("auditoria.erroPrepararPAC"), t("auditoria.erroCarregarNCs"));
      console.error("Erro ao carregar NCs para o PAC:", error);
    }
  };

  const handleEditPAC = (pac) => {
    setEditingPAC(pac);
    setShowFormPAC(true);
  };

  const handleProcessoFormSubmit = async (novoProcesso) => {
    setShowFormProcesso(false);
    setEditingProcesso(null);

    if (novoProcesso) {
      if (!editingProcesso || novoProcesso.status === 'em_andamento' || novoProcesso.status === 'planejada') {
        setSelectedProcesso(novoProcesso);
        setShowChecklistModal(true);
      } else {
        await loadData();
      }
    } else {
      await loadData();
    }
  };

  const handleChecklistComplete = async () => {
    await loadData();
    setShowChecklistModal(false);
    setSelectedProcesso(null);
    showSuccess(t('auditoria.checklistConcluido'), t('auditoria.checklistConcluidoMsg'));
  };

  const handleExportPDF = useCallback(async (processo) => {
    setIsLoading(true);
    try {
      await exportAuditoriaPDF({ processo, aeroportos, currentUser, empresas });
      showSuccess(t('auditoria.relatorioExportado'), t('auditoria.relatorioExportadoMsg'));
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      showError(t('auditoria.erroExportarPDF'), `${error.message || ''}`);
    } finally {
      setIsLoading(false);
    }
  }, [aeroportos, showSuccess, showError, currentUser, empresas]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <Shield className="w-6 md:w-8 h-6 md:h-8 text-indigo-600 dark:text-indigo-400" />
              {t('page.auditoria.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.auditoria.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            {gestaoPermission &&
            <Button variant="outline" onClick={() => setShowConfigModal(true)}>
                <Settings className="w-4 h-4 mr-2" />
                {t('auditoria.configuracoes')}
              </Button>
            }
            <Button className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-blue-700" onClick={() => openForm()}>
              <Plus className="w-4 h-4 mr-2" /> {t('auditoria.novaAuditoria')}
            </Button>
          </div>
        </div>

        {/* Auth warning */}
        {currentUser === null && !isLoading &&
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('auditoria.naoAutenticado')}</AlertTitle>
            <AlertDescription>
              {t('auditoria.naoAutenticadoDesc')}
            </AlertDescription>
          </Alert>
        }

        {/* Alert banner */}
        {alertInfo.isOpen &&
        <Alert variant={alertInfo.type === 'error' ? 'destructive' : 'default'} className="mb-4">
            {alertInfo.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            <AlertTitle>{alertInfo.title}</AlertTitle>
            <AlertDescription>{alertInfo.message}</AlertDescription>
          </Alert>
        }

        {/* Stats cards */}
        <AuditoriaStatsCards estatisticas={estatisticas} />

        {/* Category filter buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Button
            variant={selectedCategoria === 'todos' ? 'default' : 'outline'}
            onClick={() => setSelectedCategoria('todos')}
            className="justify-start h-auto p-3 flex-col gap-2">
            <FileText className="w-5 h-5" />
            <span className="text-xs">{t('auditoria.todasCategorias')}</span>
          </Button>
          {Object.entries(CATEGORIAS_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Button
                key={key}
                variant={selectedCategoria === key ? 'default' : 'outline'}
                onClick={() => setSelectedCategoria(key)}
                className="justify-start h-auto p-3 flex-col gap-2">
                <Icon className={`w-5 h-5 ${selectedCategoria === key ? 'text-white' : config.color}`} />
                <span className="text-xs text-center leading-tight">{t(config.labelKey)}</span>
              </Button>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center mb-6 border-b dark:border-slate-700">
            <TabsList className="grid w-full grid-cols-2 bg-transparent border-b-0 p-0 m-0">
              <TabsTrigger value="processos" className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none -mb-px">
                <ClipboardCheck className="w-4 h-4" />
                <span className="hidden sm:inline">{t('auditoria.processosAuditoria')}</span>
              </TabsTrigger>
              <TabsTrigger value="pacs" className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none -mb-px">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{t('auditoria.planosAcaoCorretiva')}</span>
              </TabsTrigger>
            </TabsList>
            <Button onClick={loadData} variant="outline" className="ml-4 shrink-0">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('auditoria.atualizar')}
            </Button>
          </div>

          <TabsContent value="processos" className="space-y-6">
            <ProcessosTab
              processosAuditoria={processosAuditoria}
              tiposAuditoria={tiposAuditoria}
              aeroportos={aeroportos}
              filtros={filtros}
              setFiltros={setFiltros}
              aeroportoOptions={aeroportoOptions}
              selectedCategoria={selectedCategoria}
              hasActiveFilters={hasActiveFilters}
              onBuscar={handleBuscar}
              onClear={clearFilters}
              isSearching={isSearching}
              isLoading={isLoading}
              gestaoPermission={gestaoPermission}
              onView={handleViewAuditoria}
              onEdit={(processo) => openForm(processo)}
              onDelete={(processo) => setDeleteProcessoInfo({ isOpen: true, processo })}
            />
          </TabsContent>

          <TabsContent value="pacs" className="mt-6 space-y-6">
            <PACsTab
              pacs={pacs}
              processosAuditoria={processosAuditoria}
              tiposAuditoria={tiposAuditoria}
              aeroportos={aeroportos}
              filtros={filtros}
              setFiltros={setFiltros}
              aeroportoOptions={aeroportoOptions}
              hasActiveFilters={hasActiveFilters}
              onBuscar={handleBuscar}
              onClear={clearFilters}
              isSearching={isSearching}
              isLoading={isLoading}
              gestaoPermission={gestaoPermission}
              onEditPAC={handleEditPAC}
              onDeletePAC={(pac) => setDeletePACInfo({ isOpen: true, pac })}
            />
          </TabsContent>
        </Tabs>

        {/* Modals */}
        {showFormProcesso &&
        <FormProcessoAuditoria
          isOpen={showFormProcesso}
          onClose={() => {
            setShowFormProcesso(false);
            setEditingProcesso(null);
          }}
          tipos={tiposAuditoria}
          aeroportos={aeroportosAcesso}
          onSubmit={handleProcessoFormSubmit}
          processoInicial={editingProcesso}
          currentUser={currentUser} />
        }

        {showDetailModal && selectedProcesso &&
        <AuditoriaDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedProcesso(null);
          }}
          processo={selectedProcesso}
          tipo={tiposAuditoria.find((t) => t.id === selectedProcesso.tipo_auditoria_id)}
          aeroporto={aeroportos.find((a) => a.codigo_icao === selectedProcesso.aeroporto_id)}
          onCreatePAC={handleCreatePAC}
          onExportPDF={handleExportPDF} />
        }

        {showChecklistModal && selectedProcesso &&
        <FormChecklist
          isOpen={showChecklistModal}
          onClose={() => {
            setShowChecklistModal(false);
            setSelectedProcesso(null);
          }}
          processo={selectedProcesso}
          onUpdate={handleChecklistComplete}
          currentUser={currentUser} />
        }

        {showFormPAC &&
        <FormPAC
          isOpen={showFormPAC}
          onClose={() => {
            setShowFormPAC(false);
            setSelectedProcesso(null);
            setEditingPAC(null);
            setNonConformitiesForPAC([]);
          }}
          processoAuditoria={selectedProcesso}
          aeroporto={aeroportos.find((a) => a.codigo_icao === (selectedProcesso?.aeroporto_id || editingPAC?.aeroporto_id))}
          onSubmit={handleSuccess}
          naoConformidades={nonConformitiesForPAC}
          pacInicial={editingPAC} />
        }

        {showConfigModal &&
        <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('auditoria.configuracoesAuditoria')}</DialogTitle>
              </DialogHeader>
              <ConfiguracaoAuditoria
              tipos={tiposAuditoria}
              onUpdate={handleSuccess} />
            </DialogContent>
          </Dialog>
        }

        <AlertModal
          isOpen={deleteProcessoInfo.isOpen}
          onClose={() => setDeleteProcessoInfo({ isOpen: false, processo: null })}
          onConfirm={handleDeleteProcesso}
          title={t('auditoria.confirmarExclusao')}
          message={t('auditoria.confirmarExclusaoAuditoria').replace('{0}', deleteProcessoInfo.processo?.numero_auditoria || '')}
          type="warning"
          confirmText={t('auditoria.excluir')}
          showCancel />

        <AlertModal
          isOpen={deletePACInfo.isOpen}
          onClose={() => setDeletePACInfo({ isOpen: false, pac: null })}
          onConfirm={handleDeletePAC}
          title={t('auditoria.confirmarExclusao')}
          message={t('auditoria.confirmarExclusaoPAC').replace('{0}', deletePACInfo.pac?.numero_pac || '')}
          type="warning"
          confirmText={t('auditoria.excluir')}
          showCancel />

      </div>
    </div>
  );
}
