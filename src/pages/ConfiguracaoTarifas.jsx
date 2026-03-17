import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Settings2, Filter, Plus, RefreshCw, X, Trash2, Pencil, DollarSign } from 'lucide-react';
import Combobox from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import SortableTableHeader from '@/components/shared/SortableTableHeader';

import { TarifaPouso } from '@/entities/TarifaPouso';
import { TarifaPermanencia } from '@/entities/TarifaPermanencia';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { Imposto } from '@/entities/Imposto';
import { TarifaRecurso } from '@/entities/TarifaRecurso';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';
import { Aeroporto } from '@/entities/Aeroporto';
import { TipoOutraTarifa } from '@/entities/TipoOutraTarifa';
import { TipoServicoGeral } from '@/entities/TipoServicoGeral';
import { Cliente } from '@/entities/Cliente';
import { Textarea } from '@/components/ui/textarea';

import FormTarifaPouso from '../components/financeiro/FormTarifaPouso';
import FormTarifaPermanencia from '../components/financeiro/FormTarifaPermanencia';
import FormOutraTarifa from '../components/financeiro/FormOutraTarifa';
import FormImposto from '../components/financeiro/FormImposto';
import FormConfiguracaoSistema from '../components/financeiro/FormConfiguracaoSistema';
import FormTarifaRecurso from '../components/financeiro/FormTarifaRecurso';
import GerirTiposOutraTarifaModal from '../components/financeiro/GerirTiposOutraTarifaModal';
import AlertModal from '../components/shared/AlertModal';
import { registarExclusao } from '../components/lib/auditoria';
import { getAeroportosPermitidos } from '@/components/lib/userUtils';
import { User } from '@/entities/User';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useI18n } from '@/components/lib/i18n';

// Helper: filtra tarifas por empresa_id
function filterTarifasByEmpresa(tarifas, empresaId) {
  if (!empresaId) return tarifas;
  const empresaTarifas = tarifas.filter(t => t.empresa_id === empresaId);
  const globalTarifas = tarifas.filter(t => !t.empresa_id);
  return empresaTarifas.length > 0 ? empresaTarifas : globalTarifas;
}

export default function ConfiguracaoTarifas() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const [tarifasPouso, setTarifasPouso] = useState([]);
  const [tarifasPermanencia, setTarifasPermanencia] = useState([]);
  const [outrasTarifas, setOutrasTarifas] = useState([]);
  const [impostos, setImpostos] = useState([]);
  const [tarifasRecursos, setTarifasRecursos] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [configuracao, setConfiguracao] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('tarifas_pouso');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState('');
  const [editingTarifa, setEditingTarifa] = useState(null);
  const [isConfiguracaoFormOpen, setIsConfiguracaoFormOpen] = useState(false);
  const [isTarifaRecursoFormOpen, setIsTarifaRecursoFormOpen] = useState(false);
  const [editingTarifaRecurso, setEditingTarifaRecurso] = useState(null);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, entity: null, id: null });
  const [isGerirTiposOpen, setIsGerirTiposOpen] = useState(false);
  const [tiposOutraTarifa, setTiposOutraTarifa] = useState([]);
  const [tiposServicoGeral, setTiposServicoGeral] = useState([]);
  const [editingServicoGeral, setEditingServicoGeral] = useState(null);
  const [isServicoGeralFormOpen, setIsServicoGeralFormOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [editingCliente, setEditingCliente] = useState(null);
  const [isClienteFormOpen, setIsClienteFormOpen] = useState(false);

  // Filtros tarifas pouso
  const [filtrosTarifaPouso, setFiltrosTarifaPouso] = useState({ categoria: 'todos', status: 'todos', busca: '' });
  const [sortFieldPouso, setSortFieldPouso] = useState('faixa_min');
  const [sortDirectionPouso, setSortDirectionPouso] = useState('asc');

  // Filtros outras tarifas
  const [filtrosOutrasTarifas, setFiltrosOutrasTarifas] = useState({ tipo: 'todos', tipoOperacao: 'todos', categoria: 'todos', status: 'todos', busca: '' });
  const [sortFieldOutras, setSortFieldOutras] = useState('tipo');
  const [sortDirectionOutras, setSortDirectionOutras] = useState('asc');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();

      const [
        aeroportosData,
        tarifasPousoData,
        tarifasPermanenciaData,
        outrasTarifasData,
        impostosData,
        tarifasRecursosData,
        configsData,
        tiposData,
        tiposServicoGeralData,
        clientesData
      ] = await Promise.all([
        (effectiveEmpresaId || user.empresa_id) ? Aeroporto.filter({ empresa_id: effectiveEmpresaId || user.empresa_id }) : Aeroporto.list(),
        TarifaPouso.list(),
        TarifaPermanencia.list(),
        OutraTarifa.list(),
        Imposto.list(),
        TarifaRecurso.list(),
        (async () => {
          try {
            const configs = await ConfiguracaoSistema.list();
            return configs.length > 0 ? configs[0] : { taxa_cambio_usd_aoa: 850 };
          } catch { return { taxa_cambio_usd_aoa: 850 }; }
        })(),
        TipoOutraTarifa.list().catch(() => []),
        TipoServicoGeral.list().catch(() => []),
        Cliente.list().catch(() => [])
      ]);

      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');
      const userAccessibleAeroportos = getAeroportosPermitidos(user, aeroportosAngola, effectiveEmpresaId);
      setAeroportos(userAccessibleAeroportos);

      setTarifasPouso(filterTarifasByEmpresa(tarifasPousoData, effectiveEmpresaId));
      setTarifasPermanencia(filterTarifasByEmpresa(tarifasPermanenciaData, effectiveEmpresaId));
      setOutrasTarifas(filterTarifasByEmpresa(outrasTarifasData, effectiveEmpresaId));
      setImpostos(filterTarifasByEmpresa(impostosData, effectiveEmpresaId));
      setTarifasRecursos(filterTarifasByEmpresa(tarifasRecursosData || [], effectiveEmpresaId));
      setConfiguracao(configsData);
      setTiposOutraTarifa((tiposData || []).filter(t => t.status === 'ativa').sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
      setTiposServicoGeral((tiposServicoGeralData || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
      setClientes(clientesData || []);
    } catch (error) {
      console.error("Erro ao carregar tarifas:", error);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro de Carga', message: 'Ocorreu um erro ao carregar os dados. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  }, [effectiveEmpresaId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenForm = (type, item = null) => {
    setFormType(type);
    setEditingTarifa(item);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data) => {
    try {
      // Convert empty strings to null for UUID fields
      ['aeroporto_id', 'empresa_id'].forEach(f => {
        if (data[f] === '' || data[f] === undefined) data[f] = null;
      });

      if (effectiveEmpresaId) {
        data = { ...data, empresa_id: effectiveEmpresaId };
      }

      if (editingTarifa) {
        switch (formType) {
          case 'tarifa_pouso': await TarifaPouso.update(editingTarifa.id, data); break;
          case 'tarifa_permanencia': await TarifaPermanencia.update(editingTarifa.id, data); break;
          case 'outra_tarifa': await OutraTarifa.update(editingTarifa.id, data); break;
          case 'imposto': await Imposto.update(editingTarifa.id, data); break;
        }
      } else {
        switch (formType) {
          case 'tarifa_pouso': await TarifaPouso.create(data); break;
          case 'tarifa_permanencia': await TarifaPermanencia.create(data); break;
          case 'outra_tarifa': await OutraTarifa.create(data); break;
          case 'imposto': await Imposto.create(data); break;
        }
      }
      setIsFormOpen(false);
      setEditingTarifa(null);
      loadData();
      setAlertInfo({ isOpen: true, type: 'success', title: 'Sucesso', message: 'O registo foi criado/atualizado com sucesso.' });
    } catch (error) {
      console.error(`Erro ao submeter formulário de ${formType}:`, error);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Ocorreu um erro ao registar. Tente novamente.' });
    }
  };

  const handleConfiguracaoSubmit = async (data) => {
    try {
      if (configuracao && configuracao.id) {
        await ConfiguracaoSistema.update(configuracao.id, data);
      } else {
        await ConfiguracaoSistema.create(data);
      }
      setIsConfiguracaoFormOpen(false);
      await loadData();
      setAlertInfo({ isOpen: true, type: 'success', title: 'Configuração Atualizada!', message: `Taxa de câmbio alterada para ${data.taxa_cambio_usd_aoa} AOA/USD.` });
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível atualizar a configuração.' });
    }
  };

  const handleDeleteClick = (entity, id) => {
    setDeleteInfo({ isOpen: true, entity, id });
  };

  const handleDeleteConfirm = async () => {
    const { entity, id } = deleteInfo;
    if (!entity || !id) return;

    try {
      let dadosParaAuditoria = null;

      switch (entity) {
        case 'TarifaPouso':
          dadosParaAuditoria = tarifasPouso.find(t => t.id === id);
          if (!dadosParaAuditoria) { loadData(); setDeleteInfo({ isOpen: false, entity: null, id: null }); return; }
          await TarifaPouso.delete(id);
          break;
        case 'TarifaPermanencia':
          dadosParaAuditoria = tarifasPermanencia.find(t => t.id === id);
          if (!dadosParaAuditoria) { loadData(); setDeleteInfo({ isOpen: false, entity: null, id: null }); return; }
          await TarifaPermanencia.delete(id);
          break;
        case 'OutraTarifa':
          dadosParaAuditoria = outrasTarifas.find(t => t.id === id);
          if (!dadosParaAuditoria) { loadData(); setDeleteInfo({ isOpen: false, entity: null, id: null }); return; }
          await OutraTarifa.delete(id);
          break;
        case 'TarifaRecurso':
          dadosParaAuditoria = tarifasRecursos.find(t => t.id === id);
          if (!dadosParaAuditoria) { loadData(); setDeleteInfo({ isOpen: false, entity: null, id: null }); return; }
          await TarifaRecurso.delete(id);
          break;
        case 'Imposto':
          dadosParaAuditoria = impostos.find(t => t.id === id);
          if (!dadosParaAuditoria) { loadData(); setDeleteInfo({ isOpen: false, entity: null, id: null }); return; }
          await Imposto.delete(id);
          break;
        case 'servico_geral':
          dadosParaAuditoria = tiposServicoGeral.find(t => t.id === id);
          if (!dadosParaAuditoria) { loadData(); setDeleteInfo({ isOpen: false, entity: null, id: null }); return; }
          await TipoServicoGeral.delete(id);
          break;
        case 'empresa':
          dadosParaAuditoria = clientes.find(t => t.id === id);
          if (!dadosParaAuditoria) { loadData(); setDeleteInfo({ isOpen: false, entity: null, id: null }); return; }
          await Cliente.delete(id);
          break;
        default:
          throw new Error('Entidade desconhecida para exclusão');
      }

      if (dadosParaAuditoria) {
        await registarExclusao(entity, dadosParaAuditoria, 'financeiro');
      }

      setAlertInfo({ isOpen: true, type: 'success', title: 'Sucesso', message: 'O registo foi excluído com sucesso.' });
      loadData();
    } catch (error) {
      console.error(`Erro ao excluir registo de ${entity}:`, error);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro de Exclusão', message: `Ocorreu um erro ao excluir o registo.` });
    } finally {
      setDeleteInfo({ isOpen: false, entity: null, id: null });
    }
  };

  // Filtered/sorted data
  const tarifasPousoFiltradas = useMemo(() => {
    let filtered = tarifasPouso.filter(t => {
      const categoriaMatch = filtrosTarifaPouso.categoria === 'todos' || t.categoria_aeroporto === filtrosTarifaPouso.categoria;
      const statusMatch = filtrosTarifaPouso.status === 'todos' || t.status === filtrosTarifaPouso.status;
      const buscaMatch = !filtrosTarifaPouso.busca ||
        t.categoria_aeroporto?.toLowerCase().includes(filtrosTarifaPouso.busca.toLowerCase()) ||
        String(t.faixa_min).includes(filtrosTarifaPouso.busca) ||
        String(t.faixa_max).includes(filtrosTarifaPouso.busca);
      return categoriaMatch && statusMatch && buscaMatch;
    });
    filtered.sort((a, b) => {
      let aVal = a[sortFieldPouso], bVal = b[sortFieldPouso];
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
      if (aVal < bVal) return sortDirectionPouso === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirectionPouso === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [tarifasPouso, filtrosTarifaPouso, sortFieldPouso, sortDirectionPouso]);

  const outrasTarifasFiltradas = useMemo(() => {
    let filtered = outrasTarifas.filter(t => {
      const tipoMatch = filtrosOutrasTarifas.tipo === 'todos' || t.tipo === filtrosOutrasTarifas.tipo;
      const tipoOperacaoMatch = filtrosOutrasTarifas.tipoOperacao === 'todos' || t.tipo_operacao === filtrosOutrasTarifas.tipoOperacao;
      const categoriaMatch = filtrosOutrasTarifas.categoria === 'todos' || t.categoria_aeroporto === filtrosOutrasTarifas.categoria;
      const statusMatch = filtrosOutrasTarifas.status === 'todos' || t.status === filtrosOutrasTarifas.status;
      const buscaMatch = !filtrosOutrasTarifas.busca ||
        t.tipo?.toLowerCase().includes(filtrosOutrasTarifas.busca.toLowerCase()) ||
        t.descricao?.toLowerCase().includes(filtrosOutrasTarifas.busca.toLowerCase());
      return tipoMatch && tipoOperacaoMatch && categoriaMatch && statusMatch && buscaMatch;
    });
    filtered.sort((a, b) => {
      let aVal = a[sortFieldOutras], bVal = b[sortFieldOutras];
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
      if (aVal < bVal) return sortDirectionOutras === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirectionOutras === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [outrasTarifas, filtrosOutrasTarifas, sortFieldOutras, sortDirectionOutras]);

  // Filter options
  const categoriaAeroportoOptions = [
    { value: 'todos', label: 'Todas as Categorias' },
    { value: 'categoria_1', label: 'Categoria 1' },
    { value: 'categoria_2', label: 'Categoria 2' },
    { value: 'categoria_3', label: 'Categoria 3' },
    { value: 'categoria_4', label: 'Categoria 4' }
  ];

  const statusTarifaOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'ativa', label: 'Ativa' },
    { value: 'inativa', label: 'Inativa' }
  ];

  const tipoOutraTarifaOptions = useMemo(() => {
    const fromDb = tiposOutraTarifa.map(t => ({ value: t.value, label: t.label }));
    return [{ value: 'todos', label: 'Todos os Tipos' }, ...fromDb];
  }, [tiposOutraTarifa]);

  const tipoOperacaoOutraTarifaOptions = [
    { value: 'todos', label: 'Todas as Operações' },
    { value: 'domestica', label: 'Apenas Doméstico' },
    { value: 'internacional', label: 'Apenas Internacional' },
    { value: 'ambos', label: 'Ambos' }
  ];

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <Settings2 className="w-6 md:w-8 h-6 md:h-8 text-blue-600 dark:text-blue-400" />
              {t('page.config_tarifas.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.config_tarifas.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('btn.refresh')}
          </Button>
        </div>

        {/* Taxa de câmbio resumo */}
        <Card className="border-0 shadow-sm bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Taxa de Câmbio Actual</p>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    {configuracao?.taxa_cambio_usd_aoa || 850} <span className="text-sm font-normal">AOA/USD</span>
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsConfiguracaoFormOpen(true)} className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900">
                <Pencil className="w-4 h-4 mr-2" />
                Alterar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="tarifas_pouso" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="tarifas_pouso">Pouso</TabsTrigger>
            <TabsTrigger value="tarifas_permanencia">Estacionamento</TabsTrigger>
            <TabsTrigger value="outras_tarifas">Outras Tarifas</TabsTrigger>
            <TabsTrigger value="tarifas_recursos">Recursos</TabsTrigger>
            <TabsTrigger value="servicos_gerais">Serviços Gerais</TabsTrigger>
            <TabsTrigger value="empresas">Clientes</TabsTrigger>
            <TabsTrigger value="impostos">Impostos</TabsTrigger>
          </TabsList>

          {/* ==================== TARIFAS DE POUSO ==================== */}
          <TabsContent value="tarifas_pouso">
            <Card className="mb-4 border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    Filtros
                  </CardTitle>
                  {(filtrosTarifaPouso.categoria !== 'todos' || filtrosTarifaPouso.status !== 'todos' || filtrosTarifaPouso.busca !== '') && (
                    <Button variant="outline" size="sm" onClick={() => setFiltrosTarifaPouso({ categoria: 'todos', status: 'todos', busca: '' })} className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950">
                      <X className="w-4 h-4 mr-1" /> Limpar Filtros
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Pesquisar</Label>
                    <Input placeholder="Pesquisar..." value={filtrosTarifaPouso.busca} onChange={(e) => setFiltrosTarifaPouso(prev => ({ ...prev, busca: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria Aeroporto</Label>
                    <Combobox options={categoriaAeroportoOptions} value={filtrosTarifaPouso.categoria} onValueChange={(v) => setFiltrosTarifaPouso(prev => ({ ...prev, categoria: v }))} placeholder="Selecione..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Combobox options={statusTarifaOptions} value={filtrosTarifaPouso.status} onValueChange={(v) => setFiltrosTarifaPouso(prev => ({ ...prev, status: v }))} placeholder="Selecione..." />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Tarifas de Pouso</CardTitle>
                <Button onClick={() => handleOpenForm('tarifa_pouso')}>
                  <Plus className="w-4 h-4 mr-2" /> Nova Tarifa de Pouso
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader field="faixa_min" label="Faixa Mínima (kg)" currentSortField={sortFieldPouso} currentSortDirection={sortDirectionPouso} onSort={(f, d) => { setSortFieldPouso(f); setSortDirectionPouso(d); }} />
                        <SortableTableHeader field="faixa_max" label="Faixa Máxima (kg)" currentSortField={sortFieldPouso} currentSortDirection={sortDirectionPouso} onSort={(f, d) => { setSortFieldPouso(f); setSortDirectionPouso(d); }} />
                        <SortableTableHeader field="categoria_aeroporto" label="Categoria" currentSortField={sortFieldPouso} currentSortDirection={sortDirectionPouso} onSort={(f, d) => { setSortFieldPouso(f); setSortDirectionPouso(d); }} />
                        <SortableTableHeader field="tarifa_domestica" label="Doméstica (USD)" currentSortField={sortFieldPouso} currentSortDirection={sortDirectionPouso} onSort={(f, d) => { setSortFieldPouso(f); setSortDirectionPouso(d); }} />
                        <SortableTableHeader field="tarifa_internacional" label="Internacional (USD)" currentSortField={sortFieldPouso} currentSortDirection={sortDirectionPouso} onSort={(f, d) => { setSortFieldPouso(f); setSortDirectionPouso(d); }} />
                        <SortableTableHeader field="status" label="Status" currentSortField={sortFieldPouso} currentSortDirection={sortDirectionPouso} onSort={(f, d) => { setSortFieldPouso(f); setSortDirectionPouso(d); }} />
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tarifasPousoFiltradas.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhuma tarifa de pouso configurada</TableCell></TableRow>
                      ) : tarifasPousoFiltradas.map((tarifa) => (
                        <TableRow key={tarifa.id}>
                          <TableCell className="font-medium">{new Intl.NumberFormat('pt-AO').format(tarifa.faixa_min)} kg</TableCell>
                          <TableCell className="font-medium">{new Intl.NumberFormat('pt-AO').format(tarifa.faixa_max)} kg</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{tarifa.categoria_aeroporto?.replace('_', ' ')}</Badge></TableCell>
                          <TableCell className="text-green-700 dark:text-green-400 font-medium">${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(tarifa.tarifa_domestica)}</TableCell>
                          <TableCell className="text-blue-700 dark:text-blue-400 font-medium">${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(tarifa.tarifa_internacional)}</TableCell>
                          <TableCell><Badge className={tarifa.status === 'ativa' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}>{tarifa.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => handleOpenForm('tarifa_pouso', tarifa)}><Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900" onClick={() => handleDeleteClick('TarifaPouso', tarifa.id)}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TARIFAS DE PERMANÊNCIA ==================== */}
          <TabsContent value="tarifas_permanencia">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Tarifas de Estacionamento</CardTitle>
                <Button onClick={() => handleOpenForm('tarifa_permanencia')}>
                  <Plus className="w-4 h-4 mr-2" /> Nova Tarifa de Estacionamento
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria Aeroporto</TableHead>
                      <TableHead>Tarifa por Tonelada/Hora (USD)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tarifasPermanencia.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhuma tarifa de estacionamento configurada</TableCell></TableRow>
                    ) : tarifasPermanencia.map((tarifa) => (
                      <TableRow key={tarifa.id}>
                        <TableCell><Badge variant="outline" className="capitalize">{tarifa.categoria_aeroporto?.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="font-medium text-blue-700">${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(tarifa.tarifa_usd_por_tonelada_hora || 0)}</TableCell>
                        <TableCell><Badge className={tarifa.status === 'ativa' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}>{tarifa.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => handleOpenForm('tarifa_permanencia', tarifa)}><Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900" onClick={() => handleDeleteClick('TarifaPermanencia', tarifa.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== OUTRAS TARIFAS ==================== */}
          <TabsContent value="outras_tarifas">
            <Card className="mb-4 border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    Filtros
                  </CardTitle>
                  {(filtrosOutrasTarifas.tipo !== 'todos' || filtrosOutrasTarifas.tipoOperacao !== 'todos' || filtrosOutrasTarifas.categoria !== 'todos' || filtrosOutrasTarifas.status !== 'todos' || filtrosOutrasTarifas.busca !== '') && (
                    <Button variant="outline" size="sm" onClick={() => setFiltrosOutrasTarifas({ tipo: 'todos', tipoOperacao: 'todos', categoria: 'todos', status: 'todos', busca: '' })} className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950">
                      <X className="w-4 h-4 mr-1" /> Limpar Filtros
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Pesquisar</Label>
                    <Input placeholder="Pesquisar..." value={filtrosOutrasTarifas.busca} onChange={(e) => setFiltrosOutrasTarifas(prev => ({ ...prev, busca: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Combobox options={tipoOutraTarifaOptions} value={filtrosOutrasTarifas.tipo} onValueChange={(v) => setFiltrosOutrasTarifas(prev => ({ ...prev, tipo: v }))} placeholder="Selecione..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Operação</Label>
                    <Combobox options={tipoOperacaoOutraTarifaOptions} value={filtrosOutrasTarifas.tipoOperacao} onValueChange={(v) => setFiltrosOutrasTarifas(prev => ({ ...prev, tipoOperacao: v }))} placeholder="Selecione..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria Aeroporto</Label>
                    <Combobox options={categoriaAeroportoOptions} value={filtrosOutrasTarifas.categoria} onValueChange={(v) => setFiltrosOutrasTarifas(prev => ({ ...prev, categoria: v }))} placeholder="Selecione..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Combobox options={statusTarifaOptions} value={filtrosOutrasTarifas.status} onValueChange={(v) => setFiltrosOutrasTarifas(prev => ({ ...prev, status: v }))} placeholder="Selecione..." />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Outras Tarifas</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsGerirTiposOpen(true)}>
                    <Settings2 className="w-4 h-4 mr-2" /> Gerir Tipos
                  </Button>
                  <Button onClick={() => handleOpenForm('outra_tarifa')}>
                    <Plus className="w-4 h-4 mr-2" /> Nova Outra Tarifa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader field="tipo" label="Tipo" currentSortField={sortFieldOutras} currentSortDirection={sortDirectionOutras} onSort={(f, d) => { setSortFieldOutras(f); setSortDirectionOutras(d); }} />
                        <SortableTableHeader field="tipo_operacao" label="Tipo Operação" currentSortField={sortFieldOutras} currentSortDirection={sortDirectionOutras} onSort={(f, d) => { setSortFieldOutras(f); setSortDirectionOutras(d); }} />
                        <SortableTableHeader field="categoria_aeroporto" label="Categoria" currentSortField={sortFieldOutras} currentSortDirection={sortDirectionOutras} onSort={(f, d) => { setSortFieldOutras(f); setSortDirectionOutras(d); }} />
                        <SortableTableHeader field="valor" label="Valor (USD)" currentSortField={sortFieldOutras} currentSortDirection={sortDirectionOutras} onSort={(f, d) => { setSortFieldOutras(f); setSortDirectionOutras(d); }} />
                        <SortableTableHeader field="unidade" label="Unidade" currentSortField={sortFieldOutras} currentSortDirection={sortDirectionOutras} onSort={(f, d) => { setSortFieldOutras(f); setSortDirectionOutras(d); }} />
                        <SortableTableHeader field="descricao" label="Descrição" currentSortField={sortFieldOutras} currentSortDirection={sortDirectionOutras} onSort={(f, d) => { setSortFieldOutras(f); setSortDirectionOutras(d); }} />
                        <SortableTableHeader field="status" label="Status" currentSortField={sortFieldOutras} currentSortDirection={sortDirectionOutras} onSort={(f, d) => { setSortFieldOutras(f); setSortDirectionOutras(d); }} />
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outrasTarifasFiltradas.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhuma outra tarifa configurada</TableCell></TableRow>
                      ) : outrasTarifasFiltradas.map((tarifa) => (
                        <TableRow key={tarifa.id}>
                          <TableCell><Badge variant="outline">{tipoOutraTarifaOptions.find(o => o.value === tarifa.tipo)?.label || tarifa.tipo?.replace('_', ' ')}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{tarifa.tipo_operacao === 'domestica' ? 'Doméstico' : tarifa.tipo_operacao === 'internacional' ? 'Internacional' : 'Ambos'}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{tarifa.categoria_aeroporto?.replace('_', ' ')}</Badge></TableCell>
                          <TableCell className="text-green-700 dark:text-green-400 font-medium">${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(tarifa.valor)}</TableCell>
                          <TableCell className="capitalize">{tarifa.unidade?.replace('_', ' ')}</TableCell>
                          <TableCell>{tarifa.descricao}</TableCell>
                          <TableCell><Badge className={tarifa.status === 'ativa' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}>{tarifa.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => handleOpenForm('outra_tarifa', tarifa)}><Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900" onClick={() => handleDeleteClick('OutraTarifa', tarifa.id)}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TARIFAS DE RECURSOS ==================== */}
          <TabsContent value="tarifas_recursos">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Tarifas de Recursos (USD/hora)</CardTitle>
                <Button onClick={() => { setEditingTarifaRecurso(null); setIsTarifaRecursoFormOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Nova Tarifa Recurso
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor (USD/h)</TableHead>
                        <TableHead>Categoria Aeroporto</TableHead>
                        <TableHead>Tipo Operação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tarifasRecursos.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhuma tarifa de recurso configurada</TableCell></TableRow>
                      ) : tarifasRecursos.map(tr => (
                        <TableRow key={tr.id}>
                          <TableCell className="font-medium">
                            {{ pca: 'PCA', gpu: 'GPU', pbb: 'PBB', combustivel: 'Combustível', checkin: 'Check-in' }[tr.tipo] || tr.tipo}
                          </TableCell>
                          <TableCell>{Number(tr.valor_usd || 0).toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline">{(tr.categoria_aeroporto || '').replace('categoria_', 'Cat. ')}</Badge></TableCell>
                          <TableCell>{{ ambos: 'Ambos', domestica: 'Doméstico', internacional: 'Internacional' }[tr.tipo_operacao] || tr.tipo_operacao}</TableCell>
                          <TableCell><Badge className={tr.status === 'ativa' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}>{tr.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{tr.descricao || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingTarifaRecurso(tr); setIsTarifaRecursoFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900" onClick={() => handleDeleteClick('TarifaRecurso', tr.id)}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== SERVIÇOS GERAIS (Cursos/Licenças + Bombeiros) ==================== */}
          <TabsContent value="servicos_gerais">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Serviços Gerais — Cursos, Licenças e Bombeiros</CardTitle>
                  <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => { setEditingServicoGeral(null); setIsServicoGeralFormOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> Novo Tipo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {['cursos_licencas', 'bombeiros'].map(cat => {
                  const items = tiposServicoGeral.filter(t => t.categoria === cat);
                  return (
                    <div key={cat} className="mb-6">
                      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                        {cat === 'cursos_licencas' ? '📚 Cursos e Licenças' : '🚒 Serviços de Bombeiros'}
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor Padrão (USD)</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]">Acções</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-slate-400 dark:text-slate-500">Nenhum tipo cadastrado</TableCell></TableRow>
                          ) : items.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.label}</TableCell>
                              <TableCell className="font-semibold text-green-700 dark:text-green-400">{Number(item.valor_padrao_usd || 0).toFixed(2)}</TableCell>
                              <TableCell><Badge variant="outline">{item.unidade || '—'}</Badge></TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'ativa' ? 'default' : 'secondary'} className={item.status === 'ativa' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : ''}>
                                  {item.status === 'ativa' ? 'Activa' : 'Inactiva'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingServicoGeral(item); setIsServicoGeralFormOpen(true); }}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setDeleteInfo({ isOpen: true, entity: 'servico_geral', id: item.id })}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== EMPRESAS ==================== */}
          <TabsContent value="empresas">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Clientes</CardTitle>
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => { setEditingCliente(null); setIsClienteFormOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Novo Cliente
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[100px]">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-slate-400 dark:text-slate-500">Nenhum cliente cadastrado</TableCell></TableRow>
                    ) : clientes.map(emp => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.nome}</TableCell>
                        <TableCell>{emp.nif || '—'}</TableCell>
                        <TableCell>{emp.telefone || '—'}</TableCell>
                        <TableCell>{emp.email || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingCliente(emp); setIsClienteFormOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setDeleteInfo({ isOpen: true, entity: 'empresa', id: emp.id })}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== IMPOSTOS ==================== */}
          <TabsContent value="impostos">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Impostos</CardTitle>
                <Button onClick={() => handleOpenForm('imposto')}>
                  <Plus className="w-4 h-4 mr-2" /> Novo Imposto
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Percentagem</TableHead>
                      <TableHead>Aeroporto</TableHead>
                      <TableHead>Data Início</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impostos.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhum imposto configurado</TableCell></TableRow>
                    ) : impostos.map((imposto) => (
                      <TableRow key={imposto.id}>
                        <TableCell className="font-medium">{imposto.tipo}</TableCell>
                        <TableCell className="text-blue-700 dark:text-blue-400 font-medium">{imposto.valor}%</TableCell>
                        <TableCell>{imposto.aeroporto_id ? aeroportos.find(a => a.id === imposto.aeroporto_id)?.nome || 'N/A' : 'Todos'}</TableCell>
                        <TableCell>{new Date(imposto.data_inicio_vigencia).toLocaleDateString('pt-AO')}</TableCell>
                        <TableCell><Badge className={imposto.status === 'ativo' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}>{imposto.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => handleOpenForm('imposto', imposto)}><Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900" onClick={() => handleDeleteClick('Imposto', imposto.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== MODAIS ==================== */}
      {isFormOpen && formType === 'tarifa_pouso' && (
        <FormTarifaPouso isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingTarifa(null); }} onSubmit={handleFormSubmit} aeroportos={aeroportos} tarifa={editingTarifa} />
      )}
      {isFormOpen && formType === 'tarifa_permanencia' && (
        <FormTarifaPermanencia isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingTarifa(null); }} onSubmit={handleFormSubmit} aeroportos={aeroportos} tarifa={editingTarifa} />
      )}
      {isFormOpen && formType === 'outra_tarifa' && (
        <FormOutraTarifa isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingTarifa(null); }} onSubmit={handleFormSubmit} aeroportos={aeroportos} tarifa={editingTarifa} />
      )}
      {isFormOpen && formType === 'imposto' && (
        <FormImposto isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingTarifa(null); }} onSubmit={handleFormSubmit} aeroportos={aeroportos} imposto={editingTarifa} />
      )}

      <FormTarifaRecurso
        isOpen={isTarifaRecursoFormOpen}
        onClose={() => { setIsTarifaRecursoFormOpen(false); setEditingTarifaRecurso(null); }}
        onSubmit={async (data) => {
          try {
            if (effectiveEmpresaId) { data = { ...data, empresa_id: effectiveEmpresaId }; }
            if (editingTarifaRecurso?.id) {
              await TarifaRecurso.update(editingTarifaRecurso.id, data);
            } else {
              await TarifaRecurso.create(data);
            }
            setIsTarifaRecursoFormOpen(false);
            setEditingTarifaRecurso(null);
            loadData();
          } catch (err) {
            console.error('Erro ao salvar tarifa recurso:', err);
          }
        }}
        tarifa={editingTarifaRecurso}
      />

      <FormConfiguracaoSistema isOpen={isConfiguracaoFormOpen} onClose={() => setIsConfiguracaoFormOpen(false)} onSubmit={handleConfiguracaoSubmit} configuracao={configuracao} />

      <AlertModal isOpen={deleteInfo.isOpen} onClose={() => setDeleteInfo({ isOpen: false, entity: null, id: null })} onConfirm={handleDeleteConfirm} type="warning" title="Confirmar Exclusão" message="Tem a certeza que deseja excluir este registo? Esta ação não pode ser desfeita." confirmText="Excluir" showCancel />
      <AlertModal isOpen={alertInfo.isOpen} onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })} type={alertInfo.type} title={alertInfo.title} message={alertInfo.message} />
      <GerirTiposOutraTarifaModal isOpen={isGerirTiposOpen} onClose={() => setIsGerirTiposOpen(false)} onUpdated={loadData} />

      {/* Form Serviço Geral */}
      {isServicoGeralFormOpen && (
        <FormServicoGeralInline
          isOpen={isServicoGeralFormOpen}
          onClose={() => { setIsServicoGeralFormOpen(false); setEditingServicoGeral(null); }}
          item={editingServicoGeral}
          onSaved={loadData}
        />
      )}

      {/* Form Cliente */}
      {isClienteFormOpen && (
        <FormClienteInline
          isOpen={isClienteFormOpen}
          onClose={() => { setIsClienteFormOpen(false); setEditingCliente(null); }}
          cliente={editingCliente}
          onSaved={loadData}
        />
      )}
    </div>
  );
}

// Inline form component for Tipo Serviço Geral
function FormServicoGeralInline({ isOpen, onClose, item, onSaved }) {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    value: '',
    label: '',
    categoria: 'cursos_licencas',
    valor_padrao_usd: 0,
    unidade: 'participante',
    status: 'ativa',
    ordem: 0,
  });

  useEffect(() => {
    if (item) {
      setForm({
        value: item.value || '',
        label: item.label || '',
        categoria: item.categoria || 'cursos_licencas',
        valor_padrao_usd: Number(item.valor_padrao_usd) || 0,
        unidade: item.unidade || 'participante',
        status: item.status || 'ativa',
        ordem: Number(item.ordem) || 0,
      });
    } else {
      setForm({ value: '', label: '', categoria: 'cursos_licencas', valor_padrao_usd: 0, unidade: 'participante', status: 'ativa', ordem: 0 });
    }
  }, [item, isOpen]);

  const handleSave = async () => {
    if (!form.value || !form.label) return;
    setIsSaving(true);
    try {
      if (item?.id) {
        await TipoServicoGeral.update(item.id, form);
      } else {
        await TipoServicoGeral.create(form);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar tipo serviço geral:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar' : 'Novo'} Tipo de Serviço Geral</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
              <option value="cursos_licencas">Cursos e Licenças</option>
              <option value="bombeiros">Serviços de Bombeiros</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Identificador (value) *</Label>
            <Input value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="ex: curso_8h" disabled={!!item} />
          </div>
          <div className="space-y-2">
            <Label>Descrição (label) *</Label>
            <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="ex: Curso Seg. Operacional (8h)" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Padrão (USD)</Label>
              <Input type="number" min="0" step="0.01" value={form.valor_padrao_usd} onChange={e => setForm(p => ({ ...p, valor_padrao_usd: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))}>
                <option value="participante">Participante</option>
                <option value="unidade">Unidade</option>
                <option value="ocorrência">Ocorrência</option>
                <option value="solicitação">Solicitação</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" min="0" value={form.ordem} onChange={e => setForm(p => ({ ...p, ordem: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option value="ativa">Activa</option>
                <option value="inativa">Inactiva</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || !form.value || !form.label} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline form component for Cliente
function FormClienteInline({ isOpen, onClose, cliente, onSaved }) {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    nif: '',
    telefone: '',
    email: '',
    endereco: '',
    website: '',
    observacoes: '',
  });

  useEffect(() => {
    if (cliente) {
      setForm({
        nome: cliente.nome || '',
        nif: cliente.nif || '',
        telefone: cliente.telefone || '',
        email: cliente.email || '',
        endereco: cliente.endereco || '',
        website: cliente.website || '',
        observacoes: cliente.observacoes || '',
      });
    } else {
      setForm({ nome: '', nif: '', telefone: '', email: '', endereco: '', website: '', observacoes: '' });
    }
  }, [cliente, isOpen]);

  const handleSave = async () => {
    if (!form.nome) return;
    setIsSaving(true);
    try {
      if (cliente?.id) {
        await Cliente.update(cliente.id, form);
      } else {
        await Cliente.create(form);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cliente ? 'Editar' : 'Novo'} Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do cliente" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>NIF</Label>
              <Input value={form.nif} onChange={e => setForm(p => ({ ...p, nif: e.target.value }))} placeholder="NIF" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="+244 ..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} placeholder="Endereço" />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="www.empresa.com" />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} placeholder="Observações..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || !form.nome} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
