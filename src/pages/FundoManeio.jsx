import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Filter, Plus, RefreshCw, FileDown, FileText, X, Trash2, Download, Pencil } from 'lucide-react';
// Keeping Select for other potential uses, but Combobox will be used for filters
import Combobox from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

import SortableTableHeader from '@/components/shared/SortableTableHeader';


import { MovimentoFinanceiro } from '@/entities/MovimentoFinanceiro';
import { TarifaPouso } from '@/entities/TarifaPouso';
import { TarifaPermanencia } from '@/entities/TarifaPermanencia';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { Imposto } from '@/entities/Imposto';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { Aeroporto } from '@/entities/Aeroporto';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';
import { User } from '@/entities/User';
import MovimentosFinanceirosChart from '../components/financeiro/MovimentosFinanceirosChart';
import FormMovimentoFinanceiro from '../components/financeiro/FormMovimentoFinanceiro';
import FormTarifaPouso from '../components/financeiro/FormTarifaPouso';
import FormTarifaPermanencia from '../components/financeiro/FormTarifaPermanencia';
import FormOutraTarifa from '../components/financeiro/FormOutraTarifa';
import FormImposto from '../components/financeiro/FormImposto';
import FormConfiguracaoSistema from '../components/financeiro/FormConfiguracaoSistema';
import { downloadAsCSV } from '../components/lib/export';
import AlertModal from '../components/shared/AlertModal';
import SendEmailModal from '../components/shared/SendEmailModal';
import { registarExclusao, registarExportacao } from '../components/lib/auditoria';
import { sendEmailDirect } from '@/functions/sendEmailDirect';


// Placeholder for RecentMovimentosFinanceiros component
const RecentMovimentosFinanceiros = ({ movimentos }) => (
  <Card className="border-0 shadow-sm">
    <CardHeader><CardTitle className="text-lg">Movimentos Recentes</CardTitle></CardHeader>
    <CardContent>
      {movimentos.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum movimento recente.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {movimentos.map((mov) => (
            <li key={mov.id} className="flex justify-between items-center border-b pb-2 last:border-b-0 last:pb-0">
              <div className="flex-1">
                <p className="font-medium">{mov.descricao}</p>
                <p className="text-xs text-gray-500">{new Date(mov.data).toLocaleDateString('pt-AO')} - {mov.categoria}</p>
              </div>
              <span className={`font-semibold ${mov.tipo === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(mov.valor_kz)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

export default function FundoManeio() {
  const [movimentos, setMovimentos] = useState([]);
  const [tarifasPouso, setTarifasPouso] = useState([]);
  const [tarifasPermanencia, setTarifasPermanencia] = useState([]);
  const [outrasTarifas, setOutrasTarifas] = useState([]);
  const [impostos, setImpostos] = useState([]);
  const [calculosTarifa, setCalculosTarifa] = useState([]);
  const [voos, setVoos] = useState([]);
  const [voosLigados, setVoosLigados] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [todosAeroportos, setTodosAeroportos] = useState([]); // To hold all airports before user filtering
  const [aeronaves, setAeronaves] = useState([]); // Assuming this might be needed by tariff calculations, but not fetched yet
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Consolidated form open state and type (existing)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState('movimento'); // 'movimento', 'tarifa_pouso', 'tarifa_permanencia', 'outra_tarifa', 'imposto'
  const [editingMovimento, setEditingMovimento] = useState(null);
  const [selectedMovimentos, setSelectedMovimentos] = useState([]);

  // New states for tariff forms as per outline (for editing context, though not fully implemented for edit)
  const [isTarifaPousoFormOpen, setIsTarifaPousoFormOpen] = useState(false);
  const [isTarifaPermanenciaFormOpen, setIsTarifaPermanenciaFormOpen] = useState(false);
  const [isOutraTarifaFormOpen, setIsOutraTarifaFormOpen] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState(null); // Assuming this is for edit functionality
  const [isConfiguracaoFormOpen, setIsConfiguracaoFormOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('movimentos'); // New state for active tab

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, entity: null, id: null });
  const [emailModal, setEmailModal] = useState({ isOpen: false, subject: '', data: null });
  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    dataInicio: '',
    dataFim: '',
    categoria: 'todos',
    tipo: 'todos',
    busca: ''
  });

  const [sortField, setSortField] = useState('data');
  const [sortDirection, setSortDirection] = useState('desc');

  // Novos states para filtros e ordenação das tarifas
  const [filtrosTarifaPouso, setFiltrosTarifaPouso] = useState({
    categoria: 'todos',
    status: 'todos',
    busca: ''
  });
  const [sortFieldPouso, setSortFieldPouso] = useState('faixa_min');
  const [sortDirectionPouso, setSortDirectionPouso] = useState('asc');

  const [filtrosOutrasTarifas, setFiltrosOutrasTarifas] = useState({
    tipo: 'todos',
    tipoOperacao: 'todos',
    categoria: 'todos',
    status: 'todos',
    busca: ''
  });
  const [sortFieldOutras, setSortFieldOutras] = useState('tipo');
  const [sortDirectionOutras, setSortDirectionOutras] = useState('asc');

  const [configuracao, setConfiguracao] = useState(null);


  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Fetch all data concurrently
      const [
        movimentosData,
        aeroportosData,
        tarifasPousoData,
        tarifasPermanenciaData,
        outrasTarifasData,
        impostosData,
        calculosTarifaData,
        voosData,
        voosLigadosData,
        aeronavesData,
        configsData
      ] = await Promise.all([
        MovimentoFinanceiro.list('-data'),
        Aeroporto.list(),
        TarifaPouso.list(),
        TarifaPermanencia.list(),
        OutraTarifa.list(),
        Imposto.list(),
        CalculoTarifa.list(),
        Voo.list(),
        VooLigado.list(),
        (async () => {
          try {
            const { RegistoAeronave } = await import('@/entities/RegistoAeronave');
            return await RegistoAeronave.list();
          } catch (err) {
            console.warn('Erro ao carregar registos de aeronaves:', err);
            return [];
          }
        })(),
        (async () => {
            try {
                const configs = await ConfiguracaoSistema.list();
                return configs.length > 0 ? configs[0] : { taxa_cambio_usd_aoa: 850 };
            } catch (err) {
                console.warn('Erro ao carregar configuração:', err);
                return { taxa_cambio_usd_aoa: 850 };
            }
        })()
      ]);

      setConfiguracao(configsData);
      setTodosAeroportos(aeroportosData);
      setAeronaves(aeronavesData);

      // 1. Filter all airports to only those in Angola
      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');

      // 2. Determine which airports the current user has access to (by their actual ID)
      let userAccessibleAeroportos = aeroportosAngola; // Default: all Angola airports
      let userAccessibleAirportIds = aeroportosAngola.map(a => a.id); // Default: all Angola airport IDs

      // If not an admin or a user with 'administrador' profile, apply airport access filter
      if (user && user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
        if (user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso) && user.aeroportos_acesso.length > 0) {
          // Filter `aeroportosAngola` by `codigo_icao` from `user.aeroportos_acesso`
          const userIcaoCodes = new Set(user.aeroportos_acesso.map(code => code.trim().toUpperCase()));
          userAccessibleAeroportos = aeroportosAngola.filter(a => userIcaoCodes.has(a.codigo_icao?.trim().toUpperCase()));
          userAccessibleAirportIds = userAccessibleAeroportos.map(a => a.id);
        } else {
          // If not admin/administrador and no aeroportos_acesso defined, they see no airports/movements
          userAccessibleAeroportos = [];
          userAccessibleAirportIds = [];
        }
      }
      setAeroportos(userAccessibleAeroportos); // Set the filtered airports for the component

      // 3. MUDANÇA: Guardar TODOS os voos e voos ligados para uso interno nos cálculos
      setVoos(voosData); // Set the full list of flights
      setVoosLigados(voosLigadosData); // Set the full list of linked flights

      // 4. Filter Movimentos Financeiros based on user's accessible airport IDs
      const movimentosFiltrados = movimentosData.filter(m => userAccessibleAirportIds.includes(m.aeroporto_id));
      setMovimentos(movimentosFiltrados);

      // 5. Filter Calculos Tarifa based on user's accessible airport IDs
      const calculosTarifaFiltrados = calculosTarifaData.filter(c => userAccessibleAirportIds.includes(c.aeroporto_id));
      setCalculosTarifa(calculosTarifaFiltrados);

      // 6. Tariffs (Pouso, Permanencia, Outras) are filtered by categoria_aeroporto, not direct aeroporto_id.
      // If a user has access to *any* airport in a given category, they should see tariffs for that category.
      // For now, these are not filtered by specific userAccessibleAirportIds, but rather by their category.
      // If there's a specific requirement to filter these based on user's airport access category, it would need more complex logic.
      setTarifasPouso(tarifasPousoData);
      setTarifasPermanencia(tarifasPermanenciaData);
      setOutrasTarifas(outrasTarifasData);
      setImpostos(impostosData);

      console.log('✅ Dados carregados:', {
        movimentos: movimentosFiltrados.length,
        aeroportos: userAccessibleAeroportos.length,
        aeronaves: aeronavesData.length,
        tarifasPouso: tarifasPousoData.length,
        calculosTarifa: calculosTarifaFiltrados.length,
        voos: voosData.length, // Total de voos (unfiltered)
        voosLigados: voosLigadosData.length, // Total de voos ligados (unfiltered)
        configuracao: configsData
      });
    } catch (error) {
      console.error("Erro ao carregar dados do fundo de maneio:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro de Carga',
        message: 'Ocorreu um erro ao carregar os dados. Tente novamente.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [setAeroportos, setCalculosTarifa, setConfiguracao, setCurrentUser, setIsLoading, setMovimentos, setOutrasTarifas, setTarifasPermanencia, setTarifasPouso, setVoos, setVoosLigados, setAlertInfo, setTodosAeroportos, setAeronaves]); // Added setAeronaves to dependencies

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = useCallback((field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  const handleSortPouso = (field, direction) => {
    setSortFieldPouso(field);
    setSortDirectionPouso(direction);
  };

  const handleSortOutras = (field, direction) => {
    setSortFieldOutras(field);
    setSortDirectionOutras(direction);
  };

  // Consolidated form submission logic
  const handleFormSubmit = async (data) => {
    try {
      if (editingMovimento && formType === 'movimento') {
        await MovimentoFinanceiro.update(editingMovimento.id, data);
      } else if (editingTarifa) { // For editing tariffs
        switch (formType) {
          case 'tarifa_pouso':
            await TarifaPouso.update(editingTarifa.id, data);
            break;
          case 'tarifa_permanencia':
            await TarifaPermanencia.update(editingTarifa.id, data);
            break;
          case 'outra_tarifa':
            await OutraTarifa.update(editingTarifa.id, data);
            break;
          case 'imposto':
            await Imposto.update(editingTarifa.id, data);
            break;
          default:
            console.error("Tipo de formulário desconhecido para edição:", formType);
            return;
        }
      } else { // For creating new entries
        switch (formType) {
          case 'movimento':
            await MovimentoFinanceiro.create(data);
            break;
          case 'tarifa_pouso':
            await TarifaPouso.create(data);
            break;
          case 'tarifa_permanencia':
            await TarifaPermanencia.create(data);
            break;
          case 'outra_tarifa':
            await OutraTarifa.create(data);
            break;
          case 'imposto':
            await Imposto.create(data);
            break;
          default:
            console.error("Tipo de formulário desconhecido para criação:", formType);
            return;
        }
      }
      setIsFormOpen(false);
      setEditingMovimento(null);
      setEditingTarifa(null);
      loadData();
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'O registo foi criado/atualizado com sucesso.'
      });
    } catch (error) {
      console.error(`Erro ao submeter formulário de ${formType}:`, error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Ocorreu um erro ao registar. Tente novamente.'
      });
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
      
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Configuração Atualizada!',
        message: `Taxa de câmbio alterada para ${data.taxa_cambio_usd_aoa} AOA/USD. Novos cálculos usarão esta taxa.`
      });
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível atualizar a configuração.'
      });
    }
  };

  const handleOpenForm = (type, item = null) => {
    setFormType(type);
    if (type === 'movimento') {
      setEditingMovimento(item);
      setEditingTarifa(null);
    } else {
      setEditingTarifa(item);
      setEditingMovimento(null);
    }
    setIsFormOpen(true);
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
        case 'MovimentoFinanceiro':
          // Verificar se o movimento ainda existe antes de tentar excluir
          dadosParaAuditoria = movimentos.find(m => m.id === id);
          if (!dadosParaAuditoria) {
            setAlertInfo({
              isOpen: true,
              type: 'warning',
              title: 'Registo Não Encontrado',
              message: 'Este movimento financeiro já foi excluído ou não existe mais. A lista será atualizada.'
            });
            loadData(); // Recarregar dados para sincronizar
            setDeleteInfo({ isOpen: false, entity: null, id: null });
            return;
          }
          await MovimentoFinanceiro.delete(id);
          break;
        case 'TarifaPouso':
          dadosParaAuditoria = tarifasPouso.find(t => t.id === id);
          if (!dadosParaAuditoria) {
            setAlertInfo({
              isOpen: true,
              type: 'warning',
              title: 'Registo Não Encontrado',
              message: 'Esta tarifa de pouso já foi excluída ou não existe mais. A lista será atualizada.'
            });
            loadData();
            setDeleteInfo({ isOpen: false, entity: null, id: null });
            return;
          }
          await TarifaPouso.delete(id);
          break;
        case 'TarifaPermanencia':
          dadosParaAuditoria = tarifasPermanencia.find(t => t.id === id);
          if (!dadosParaAuditoria) {
            setAlertInfo({
              isOpen: true,
              type: 'warning',
              title: 'Registo Não Encontrado',
              message: 'Esta tarifa de estacionamento já foi excluída ou não existe mais. A lista será atualizada.'
            });
            loadData();
            setDeleteInfo({ isOpen: false, entity: null, id: null });
            return;
          }
          await TarifaPermanencia.delete(id);
          break;
        case 'OutraTarifa':
          dadosParaAuditoria = outrasTarifas.find(t => t.id === id);
          if (!dadosParaAuditoria) {
            setAlertInfo({
              isOpen: true,
              type: 'warning',
              title: 'Registo Não Encontrado',
              message: 'Esta tarifa já foi excluída ou não existe mais. A lista será atualizada.'
            });
            loadData();
            setDeleteInfo({ isOpen: false, entity: null, id: null });
            return;
          }
          await OutraTarifa.delete(id);
          break;
        case 'Imposto':
          dadosParaAuditoria = impostos.find(t => t.id === id);
          if (!dadosParaAuditoria) {
            setAlertInfo({
              isOpen: true,
              type: 'warning',
              title: 'Registo Não Encontrado',
              message: 'Este imposto já foi excluído ou não existe mais. A lista será atualizada.'
            });
            loadData();
            setDeleteInfo({ isOpen: false, entity: null, id: null });
            return;
          }
          await Imposto.delete(id);
          break;
        case 'CalculoTarifa':
          dadosParaAuditoria = calculosTarifa.find(c => c.id === id);
          if (!dadosParaAuditoria) {
            setAlertInfo({
              isOpen: true,
              type: 'warning',
              title: 'Registo Não Encontrado',
              message: 'Este cálculo de tarifa já foi excluído ou não existe mais. A lista será atualizada.'
            });
            loadData();
            setDeleteInfo({ isOpen: false, entity: null, id: null });
            return;
          }
          await CalculoTarifa.delete(id);
          break;
        default:
          throw new Error('Entidade desconhecida para exclusão');
      }

      if (dadosParaAuditoria) {
        await registarExclusao(entity, dadosParaAuditoria, 'financeiro');
      }

      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: 'O registo foi excluído com sucesso.'
      });
      loadData();
    } catch (error) {
      console.error(`Erro ao excluir registo de ${entity}:`, error);

      // Tratamento específico para erros 404 (não encontrado)
      if (error.response?.status === 404 || error.message?.includes('not found')) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Registo Não Encontrado',
          message: 'Este registo já foi excluído ou não existe mais. A lista será atualizada automaticamente.'
        });
        loadData(); // Recarregar dados para sincronizar
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro de Exclusão',
          message: `Ocorreu um erro ao excluir o registo. Detalhes: ${error.message || 'Erro desconhecido'}`
        });
      }
    } finally {
      setDeleteInfo({ isOpen: false, entity: null, id: null });
    }
  };

  const handleFilterChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFiltros({
      aeroporto: 'todos',
      dataInicio: '',
      dataFim: '',
      categoria: 'todos',
      tipo: 'todos',
      busca: ''
    });
  };

  const hasActiveFilters = filtros.dataInicio !== '' || filtros.dataFim !== '' ||
                          filtros.categoria !== 'todos' || filtros.tipo !== 'todos' ||
                          filtros.aeroporto !== 'todos' || filtros.busca !== '';

  const filteredMovimentos = useMemo(() => {
    let filtered = movimentos.filter(mov => {
      const selectedAirport = aeroportos.find(a => a.id === filtros.aeroporto);
      const aeroportoId = selectedAirport ? selectedAirport.id : null; // Use airport ID for filtering

      const aeroportoMatch = filtros.aeroporto === 'todos' || (aeroportoId && mov.aeroporto_id === aeroportoId);
      const categoriaMatch = filtros.categoria === 'todos' || mov.categoria === filtros.categoria;
      const tipoMatch = filtros.tipo === 'todos' || mov.tipo === filtros.tipo;
      const dataMatch = (!filtros.dataInicio || mov.data >= filtros.dataInicio) &&
                        (!filtros.dataFim || mov.data <= filtros.dataFim);
      const buscaMatch = filtros.busca === '' ||
                         mov.descricao.toLowerCase().includes(filtros.busca.toLowerCase()) ||
                         mov.categoria.toLowerCase().includes(filtros.busca.toLowerCase());

      return aeroportoMatch && categoriaMatch && tipoMatch && dataMatch && buscaMatch;
    });

    // Ordenação
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Tratamento especial para datas
      if (sortField === 'data') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [movimentos, filtros, sortField, sortDirection, aeroportos]);

  // Filtros para Tarifas de Pouso
  const tarifasPousoFiltradas = useMemo(() => {
    let filtered = tarifasPouso.filter(t => {
      const categoriaMatch = filtrosTarifaPouso.categoria === 'todos' || t.categoria_aeroporto === filtrosTarifaPouso.categoria;
      const statusMatch = filtrosTarifaPouso.status === 'todos' || t.status === filtrosTarifaPouso.status;
      const buscaMatch = !filtrosTarifaPouso.busca || 
        t.categoria_aeroporto.toLowerCase().includes(filtrosTarifaPouso.busca.toLowerCase()) ||
        String(t.faixa_min).includes(filtrosTarifaPouso.busca) ||
        String(t.faixa_max).includes(filtrosTarifaPouso.busca) ||
        String(t.tarifa_domestica).includes(filtrosTarifaPouso.busca) ||
        String(t.tarifa_internacional).includes(filtrosTarifaPouso.busca);
      
      return categoriaMatch && statusMatch && buscaMatch;
    });

    // Ordenação
    filtered.sort((a, b) => {
      let aVal = a[sortFieldPouso];
      let bVal = b[sortFieldPouso];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirectionPouso === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirectionPouso === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [tarifasPouso, filtrosTarifaPouso, sortFieldPouso, sortDirectionPouso]);

  // Filtros para Outras Tarifas
  const outrasTarifasFiltradas = useMemo(() => {
    let filtered = outrasTarifas.filter(t => {
      const tipoMatch = filtrosOutrasTarifas.tipo === 'todos' || t.tipo === filtrosOutrasTarifas.tipo;
      const tipoOperacaoMatch = filtrosOutrasTarifas.tipoOperacao === 'todos' || t.tipo_operacao === filtrosOutrasTarifas.tipoOperacao;
      const categoriaMatch = filtrosOutrasTarifas.categoria === 'todos' || t.categoria_aeroporto === filtrosOutrasTarifas.categoria;
      const statusMatch = filtrosOutrasTarifas.status === 'todos' || t.status === filtrosOutrasTarifas.status;
      const buscaMatch = !filtrosOutrasTarifas.busca || 
        t.tipo.toLowerCase().includes(filtrosOutrasTarifas.busca.toLowerCase()) ||
        t.descricao?.toLowerCase().includes(filtrosOutrasTarifas.busca.toLowerCase()) ||
        t.unidade?.toLowerCase().includes(filtrosOutrasTarifas.busca.toLowerCase()) ||
        String(t.valor).includes(filtrosOutrasTarifas.busca);
      
      return tipoMatch && tipoOperacaoMatch && categoriaMatch && statusMatch && buscaMatch;
    });

    // Ordenação
    filtered.sort((a, b) => {
      let aVal = a[sortFieldOutras];
      let bVal = b[sortFieldOutras];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirectionOutras === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirectionOutras === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [outrasTarifas, filtrosOutrasTarifas, sortFieldOutras, sortDirectionOutras]);

  const handleSelectMovimento = (id, checked) => {
    setSelectedMovimentos(prev =>
      checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleSelectAllMovimentos = (checked) => {
    if (checked) {
      setSelectedMovimentos(filteredMovimentos.map(m => m.id));
    } else {
      setSelectedMovimentos([]);
    }
  };

  const movimentosParaAcao = useMemo(() => {
    return selectedMovimentos.length > 0
      ? movimentos.filter(m => selectedMovimentos.includes(m.id))
      : filteredMovimentos;
  }, [selectedMovimentos, movimentos, filteredMovimentos]);

  const handleExportCSV = async () => {
    const dataToExport = movimentosParaAcao.map(mov => ({
      'Data': mov.data,
      'Tipo': mov.tipo,
      'Categoria': mov.categoria,
      'Descrição': mov.descricao,
      'Valor (Kz)': mov.valor_kz,
      'Aeroporto': aeroportos.find(a => a.id === mov.aeroporto_id)?.nome || mov.aeroporto_id // Changed from codigo_icao to id
    }));

    await registarExportacao('MovimentoFinanceiro', 'CSV', filtros, 'financeiro');
    downloadAsCSV(dataToExport, `relatorio_fundo_maneio_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = async () => {
    try {
      await registarExportacao('MovimentoFinanceiro', 'PDF', filtros, 'financeiro');

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      const { totalReceitas, totalDespesas, saldo } = kpiData;

      try {
        const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.arrayBuffer();
          const base64Image = btoa(String.fromCharCode(...new Uint8Array(logoBlob)));
          doc.addImage(`data:image/png;base64,${base64Image}`, 'PNG', 160, 10, 30, 15);
        }
      } catch (logoError) {
        console.log('Logo não adicionado:', logoError);
      }

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('DIROPS-SGA', 20, 20);
      doc.setFontSize(16);
      doc.text('Relatório Fundo de Maneio', 20, 30);

      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-AO')}`, 20, 40);
      doc.text(`Total de Receitas: ${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totalReceitas)}`, 20, 47);
      doc.text(`Total de Despesas: ${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totalDespesas)}`, 20, 54);
      doc.text(`Saldo: ${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(saldo)}`, 20, 61);

      let yPosition = 75;

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Data', 20, yPosition);
      doc.text('Tipo', 45, yPosition);
      doc.text('Categoria', 70, yPosition);
      doc.text('Aeroporto', 110, yPosition);
      doc.text('Valor (Kz)', 150, yPosition);
      doc.setFont(undefined, 'normal');
      yPosition += 5;

      doc.line(20, yPosition, 190, yPosition);
      yPosition += 5;

      movimentosParaAcao.forEach((movimento) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 30;
          try {
            const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
            fetch(logoUrl).then(res => res.ok ? res.blob() : null).then(blob => {
              if (blob) {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = function() {
                    const base64data = reader.result;
                    doc.addImage(base64data, 'PNG', 160, 10, 30, 15);
                }
              }
            });
          } catch (logoError) {
            console.log('Logo não adicionado na nova página:', logoError);
          }
        }

        const aeroportoNome = aeroportos.find(a => a.id === movimento.aeroporto_id)?.nome || movimento.aeroporto_id; // Changed from codigo_icao to id

        doc.setFontSize(9);
        doc.text(`${new Date(movimento.data).toLocaleDateString('pt-AO')}`, 20, yPosition);
        doc.text(`${movimento.tipo.toUpperCase()}`, 45, yPosition);
        doc.text(`${movimento.categoria}`, 70, yPosition);
        doc.text(`${aeroportoNome}`, 110, yPosition);
        doc.text(`${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(movimento.valor_kz)}`, 150, yPosition);

        yPosition += 7;
      });

      doc.save(`relatorio_fundo_maneio_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro de Exportação',
          message: 'Ocorreu um erro ao gerar o PDF. Tente novamente.'
      });
    }
  };

  const handleSendEmail = async (to, subject) => {
    try {
      // Preparar dados para envio por email
      const emailData = movimentosParaAcao.map(mov => ({
        'Data': mov.data,
        'Tipo': mov.tipo,
        'Categoria': mov.categoria,
        'Descrição': mov.descricao,
        'Valor (Kz)': new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(mov.valor_kz),
        'Aeroporto': aeroportos.find(a => a.id === mov.aeroporto_id)?.nome || mov.aeroporto_id // Changed from codigo_icao to id
      }));

      const { totalReceitas, totalDespesas, saldo } = kpiData;

      let emailBody = `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">`;

      // Cabeçalho
      emailBody += `<div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">`;
      emailBody += `<h1 style="margin: 0; font-size: 28px; font-weight: bold;">📊 Relatório do Fundo de Maneio</h1>`;
      emailBody += `<p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Gerado em ${new Date().toLocaleDateString('pt-AO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</p>`;
      emailBody += `</div>`;

      // Resumo Financeiro
      emailBody += `<div style="background: #f8fafc; padding: 25px; border-left: 4px solid #10b981;">`;
      emailBody += `<h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px;">💰 Resumo Financeiro</h2>`;
      emailBody += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">`;

      emailBody += `<div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
      emailBody += `<p style="margin: 0; font-size: 14px; color: #6b7280;">Total de Receitas</p>`;
      emailBody += `<p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #10b981;">${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totalReceitas)}</p>`;
      emailBody += `</div>`;

      emailBody += `<div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
      emailBody += `<p style="margin: 0; font-size: 14px; color: #6b7280;">Total de Despesas</p>`;
      emailBody += `<p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #ef4444;">${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totalDespesas)}</p>`;
      emailBody += `</div>`;

      emailBody += `<div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid ${saldo >= 0 ? '#3b82f6' : '#ef4444'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
      emailBody += `<p style="margin: 0; font-size: 14px; color: #6b7280;">Saldo</p>`;
      emailBody += `<p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: ${saldo >= 0 ? '#3b82f6' : '#ef4444'};">${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(saldo)}</p>`;
      emailBody += `</div>`;

      emailBody += `</div></div>`;

      // Tabela de Movimentos
      emailBody += `<div style="background: white; padding: 25px;">`;
      emailBody += `<h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px;">📋 Movimentos (${movimentosParaAcao.length} registos)</h2>`;

      if (movimentosParaAcao.length > 0) {
        emailBody += `<div style="overflow-x: auto;">`;
        emailBody += `<table style="width: 100%; border-collapse: collapse; margin-top: 15px;">`;

        // Cabeçalho da tabela
        emailBody += `<thead>`;
        emailBody += `<tr style="background: #f1f5f9;">`;
        emailBody += `<th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #374151;">Data</th>`;
        emailBody += `<th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #374151;">Tipo</th>`;
        emailBody += `<th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #374151;">Categoria</th>`;
        emailBody += `<th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #374151;">Aeroporto</th>`;
        emailBody += `<th style="padding: 12px; text-align: right; border: 1px solid #e2e8f0; font-weight: 600; color: #374151;">Valor</th>`;
        emailBody += `</tr>`;
        emailBody += `</thead>`;

        // Corpo da tabela
        emailBody += `<tbody>`;
        emailData.slice(0, 50).forEach((mov, index) => {
          const bgColor = index % 2 === 0 ? 'white' : '#f8fafc';
          const tipoColor = mov.Tipo === 'receita' ? '#10b981' : '#ef4444';

          emailBody += `<tr style="background: ${bgColor};">`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 14px;">${new Date(mov.Data).toLocaleDateString('pt-AO')}</td>`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 14px;">`;
          emailBody += `<span style="background: ${tipoColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${mov.Tipo.toUpperCase()}</span>`;
          emailBody += `</td>`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 14px;">${mov.Categoria}</td>`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 14px;">${mov.Aeroporto}</td>`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: 600; color: ${tipoColor};">${mov['Valor (Kz)']}</td>`;
          emailBody += `</tr>`;

          // Linha com descrição (se existir)
          if (mov.Descrição) {
            emailBody += `<tr style="background: ${bgColor};">`;
            emailBody += `<td colspan="5" style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #6b7280; font-style: italic;">📝 ${mov.Descrição}</td>`;
            emailBody += `</tr>`;
          }
        });
        emailBody += `</tbody>`;
        emailBody += `</table>`;
        emailBody += `</div>`;

        if (movimentosParaAcao.length > 50) {
          emailBody += `<div style="margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">`;
          emailBody += `<p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Nota:</strong> Foram exibidos apenas os primeiros 50 registos. Total de registos: ${movimentosParaAcao.length}</p>`;
          emailBody += `</div>`;
        }
      } else {
        emailBody += `<p style="text-align: center; color: #6b7280; font-style: italic; margin: 20px 0;">Nenhum movimento encontrado para o período selecionado.</p>`;
      }

      emailBody += `</div>`;

      // Rodapé
      emailBody += `<div style="background: #1f2937; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">`;
      emailBody += `<p style="margin: 0; font-size: 14px; opacity: 0.8}>🏢 Relatório gerado pelo Sistema DIROPS-SGA</p>`;
      emailBody += `<p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.6;">Este é um email automático, não responda.</p>`;
      emailBody += `</div>`;

      emailBody += `</div>`;

      const response = await sendEmailDirect({
        to: to,
        subject: subject || `📊 Relatório Fundo de Maneio - ${new Date().toLocaleDateString('pt-AO')}`,
        body: emailBody,
        from_name: 'DIROPS-SGA'
      });

      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return false;
    }
  };

  const kpiData = useMemo(() => {
    const totalReceitas = filteredMovimentos.filter(m => m.tipo === 'receita').reduce((sum, m) => sum + m.valor_kz, 0);
    const totalDespesas = filteredMovimentos.filter(m => m.tipo === 'despesa').reduce((sum, m) => sum + m.valor_kz, 0);
    const saldo = totalReceitas - totalDespesas;

    return { totalReceitas, totalDespesas, saldo };
  }, [filteredMovimentos]);

  const chartData = useMemo(() => {
    return Object.values(filteredMovimentos.reduce((acc, mov) => {
      const monthYear = new Date(mov.data).toISOString().slice(0, 7);
      if (!acc[monthYear]) acc[monthYear] = { mesAno: monthYear, receita: 0, despesa: 0 };
      acc[monthYear][mov.tipo] += mov.valor_kz;
      return acc;
    }, {}));
  }, [filteredMovimentos]);

  const aeroportoOptions = useMemo(() => ([
    { value: 'todos', label: 'Todos os Aeroportos' },
    ...aeroportos.map(a => ({ value: a.id, label: a.nome })) // Changed to a.id
  ]), [aeroportos]);

  const tipoOptions = useMemo(() => ([
    { value: 'todos', label: 'Todos' },
    { value: 'receita', label: 'Receita' },
    { value: 'despesa', label: 'Despesa' },
  ]), []);

  const categoriaOptions = useMemo(() => ([
    { value: 'todos', label: 'Todas' },
    { value: 'Apoio Financeiro', label: 'Apoio Financeiro' },
    { value: 'Engenharia/Manutenção', label: 'Engenharia/Manutenção' },
    { value: 'Operações', label: 'Operações' },
    { value: 'SGSO', label: 'SGSO' },
    { value: 'Segurança', label: 'Segurança' },
    { value: 'Resposta a Emergência', label: 'Resposta a Emergência' },
  ]), []);

  // Options para filtros de tarifas
  const categoriaAeroportoOptions = useMemo(() => ([
    { value: 'todos', label: 'Todas as Categorias' },
    { value: 'categoria_1', label: 'Categoria 1' },
    { value: 'categoria_2', label: 'Categoria 2' },
    { value: 'categoria_3', label: 'Categoria 3' },
    { value: 'categoria_4', label: 'Categoria 4' }
  ]), []);

  const statusTarifaOptions = useMemo(() => ([
    { value: 'todos', label: 'Todos' },
    { value: 'ativa', label: 'Ativa' },
    { value: 'inativa', label: 'Inativa' }
  ]), []);

  const tipoOutraTarifaOptions = [
    { value: 'todos', label: 'Todos os Tipos' },
    { value: 'embarque', label: 'Embarque' },
    { value: 'transito_transbordo', label: 'Trânsito com Transbordo' },
    { value: 'transito_direto', label: 'Trânsito Direto' },
    { value: 'carga', label: 'Carga' },
    { value: 'seguranca', label: 'Segurança' },
    { value: 'iluminacao', label: 'Iluminação' }
  ];

  const tipoOperacaoOutraTarifaOptions = [
    { value: 'todos', label: 'Todas as Operações' },
    { value: 'domestica', label: 'Apenas Doméstico' },
    { value: 'internacional', label: 'Apenas Internacional' },
    { value: 'ambos', label: 'Ambos' }
  ];

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <DollarSign className="w-6 md:w-8 h-6 md:h-8 text-emerald-600" />
              Fundo de Maneio
            </h1>
            <p className="text-slate-600 mt-1">Gestão de receitas e despesas operacionais</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => setEmailModal({
                isOpen: true,
                subject: `Relatório Fundo de Maneio - ${new Date().toLocaleDateString('pt-AO')}`,
                data: filteredMovimentos
              })}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Enviar Email
            </Button>
            <Button onClick={() => handleOpenForm('movimento')} className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Novo Movimento
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">Total Receitas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-600">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(kpiData.totalReceitas)}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">Total Despesas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(kpiData.totalDespesas)}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">Saldo</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${kpiData.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(kpiData.saldo)}</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="movimentos" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
            <TabsTrigger value="tarifas_pouso">Tarifas Pouso</TabsTrigger>
            <TabsTrigger value="tarifas_permanencia">Tarifas Estacionamento</TabsTrigger>
            <TabsTrigger value="outras_tarifas">Outras Tarifas</TabsTrigger>
            <TabsTrigger value="impostos">Impostos</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="movimentos" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500" />
                    Filtros
                  </CardTitle>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search-input">Pesquisar</Label>
                    <Input
                      id="search-input"
                      placeholder="Descrição ou Categoria"
                      value={filtros.busca}
                      onChange={(e) => handleFilterChange('busca', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="airport-select">Aeroporto</Label>
                    <Combobox
                      id="airport-select"
                      options={aeroportoOptions}
                      value={filtros.aeroporto}
                      onValueChange={(v) => handleFilterChange('aeroporto', v)}
                      placeholder={aeroportos.length === 0 ? "Nenhum aeroporto disponível" : "Procurar aeroporto..."}
                      searchPlaceholder="Procurar aeroporto..."
                      noResultsMessage="Nenhum aeroporto encontrado"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo-select">Tipo</Label>
                    <Combobox
                      id="tipo-select"
                      options={tipoOptions}
                      value={filtros.tipo}
                      onValueChange={(v) => handleFilterChange('tipo', v)}
                      placeholder="Selecione..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria-select">Categoria</Label>
                    <Combobox
                      id="categoria-select"
                      options={categoriaOptions}
                      value={filtros.categoria}
                      onValueChange={(v) => handleFilterChange('categoria', v)}
                      placeholder="Selecione..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data-inicio">Data Início</Label>
                    <Input
                      id="data-inicio"
                      type="date"
                      value={filtros.dataInicio}
                      onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data-fim">Data Fim</Label>
                    <Input
                      id="data-fim"
                      type="date"
                      value={filtros.dataFim}
                      onChange={(e) => handleFilterChange('dataFim', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Movimentos do Fundo de Maneio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                           <Checkbox
                            checked={selectedMovimentos.length === filteredMovimentos.length && filteredMovimentos.length > 0}
                            onCheckedChange={handleSelectAllMovimentos}
                           />
                        </TableHead>
                        <SortableTableHeader
                          field="data"
                          label="Data"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHeader
                          field="tipo"
                          label="Tipo"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHeader
                          field="categoria"
                          label="Categoria"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHeader
                          field="descricao"
                          label="Descrição"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <TableHead>Aeroporto</TableHead>
                        <SortableTableHeader
                          field="valor_kz"
                          label="Valor (Kz)"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovimentos.map((movimento) => (
                        <TableRow key={movimento.id} data-state={selectedMovimentos.includes(movimento.id) ? "selected" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedMovimentos.includes(movimento.id)}
                              onCheckedChange={(checked) => handleSelectMovimento(movimento.id, checked)}
                            />
                          </TableCell>
                          <TableCell>{new Date(movimento.data).toLocaleDateString('pt-AO')}</TableCell>
                          <TableCell>
                            <Badge className={`${
                              movimento.tipo === 'receita' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'
                            }`}>
                              {movimento.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell>{movimento.categoria}</TableCell>
                          <TableCell>{movimento.descricao}</TableCell>
                          <TableCell>{aeroportos.find(a => a.id === movimento.aeroporto_id)?.nome || movimento.aeroporto_id}</TableCell>
                          <TableCell className="text-right font-medium">
                            {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(movimento.valor_kz)}
                          </TableCell>
                          <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="hover:bg-slate-200" onClick={() => handleOpenForm('movimento', movimento)}>
                                  <Pencil className="h-4 w-4 text-slate-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:bg-red-100"
                                  onClick={() => handleDeleteClick('MovimentoFinanceiro', movimento.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MovimentosFinanceirosChart data={chartData} />
              </div>
              <div>
                <RecentMovimentosFinanceiros movimentos={filteredMovimentos.slice(0, 10)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tarifas_pouso">
            {/* Filtros para Tarifas de Pouso */}
            <Card className="mb-4 border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500" />
                    Filtros
                  </CardTitle>
                  {(filtrosTarifaPouso.categoria !== 'todos' || filtrosTarifaPouso.status !== 'todos' || filtrosTarifaPouso.busca !== '') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFiltrosTarifaPouso({ categoria: 'todos', status: 'todos', busca: '' })}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Pesquisar</Label>
                    <Input
                      placeholder="Pesquisar..."
                      value={filtrosTarifaPouso.busca}
                      onChange={(e) => setFiltrosTarifaPouso(prev => ({ ...prev, busca: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria Aeroporto</Label>
                    <Combobox
                      options={categoriaAeroportoOptions}
                      value={filtrosTarifaPouso.categoria}
                      onValueChange={(v) => setFiltrosTarifaPouso(prev => ({ ...prev, categoria: v }))}
                      placeholder="Selecione..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Combobox
                      options={statusTarifaOptions}
                      value={filtrosTarifaPouso.status}
                      onValueChange={(v) => setFiltrosTarifaPouso(prev => ({ ...prev, status: v }))}
                      placeholder="Selecione..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Tarifas de Pouso</CardTitle>
                <Button onClick={() => handleOpenForm('tarifa_pouso')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Tarifa de Pouso
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          field="faixa_min"
                          label="Faixa Mínima (kg)"
                          currentSortField={sortFieldPouso}
                          currentSortDirection={sortDirectionPouso}
                          onSort={handleSortPouso}
                        />
                        <SortableTableHeader
                          field="faixa_max"
                          label="Faixa Máxima (kg)"
                          currentSortField={sortFieldPouso}
                          currentSortDirection={sortDirectionPouso}
                          onSort={handleSortPouso}
                        />
                        <SortableTableHeader
                          field="categoria_aeroporto"
                          label="Categoria Aeroporto"
                          currentSortField={sortFieldPouso}
                          currentSortDirection={sortDirectionPouso}
                          onSort={handleSortPouso}
                        />
                        <SortableTableHeader
                          field="tarifa_domestica"
                          label="Doméstica (USD)"
                          currentSortField={sortFieldPouso}
                          currentSortDirection={sortDirectionPouso}
                          onSort={handleSortPouso}
                        />
                        <SortableTableHeader
                          field="tarifa_internacional"
                          label="Internacional (USD)"
                          currentSortField={sortFieldPouso}
                          currentSortDirection={sortDirectionPouso}
                          onSort={handleSortPouso}
                        />
                        <SortableTableHeader
                          field="status"
                          label="Status"
                          currentSortField={sortFieldPouso}
                          currentSortDirection={sortDirectionPouso}
                          onSort={handleSortPouso}
                        />
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tarifasPousoFiltradas.map((tarifa) => (
                        <TableRow key={tarifa.id}>
                          <TableCell className="font-medium">{new Intl.NumberFormat('pt-AO').format(tarifa.faixa_min)} kg</TableCell>
                          <TableCell className="font-medium">{new Intl.NumberFormat('pt-AO').format(tarifa.faixa_max)} kg</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {tarifa.categoria_aeroporto.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-green-700 font-medium">
                            ${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(tarifa.tarifa_domestica)}
                          </TableCell>
                          <TableCell className="text-blue-700 font-medium">
                            ${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(tarifa.tarifa_internacional)}
                          </TableCell>
                          <TableCell>
                            <Badge className={tarifa.status === 'ativa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {tarifa.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="hover:bg-slate-200" onClick={() => handleOpenForm('tarifa_pouso', tarifa)}>
                              <Pencil className="h-4 w-4 text-slate-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100" onClick={() => handleDeleteClick('TarifaPouso', tarifa.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tarifas_permanencia">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Tarifas de Estacionamento</CardTitle>
                <Button onClick={() => handleOpenForm('tarifa_permanencia')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Tarifa de Estacionamento
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
                    {tarifasPermanencia.map((tarifa) => (
                      <TableRow key={tarifa.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {tarifa.categoria_aeroporto.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-blue-700">
                          ${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(tarifa.tarifa_usd_por_tonelada_hora || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge className={tarifa.status === 'ativa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {tarifa.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="hover:bg-slate-200" onClick={() => handleOpenForm('tarifa_permanencia', tarifa)}>
                            <Pencil className="h-4 w-4 text-slate-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100" onClick={() => handleDeleteClick('TarifaPermanencia', tarifa.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outras_tarifas">
            {/* Filtros para Outras Tarifas */}
            <Card className="mb-4 border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500" />
                    Filtros
                  </CardTitle>
                  {(filtrosOutrasTarifas.tipo !== 'todos' || filtrosOutrasTarifas.tipoOperacao !== 'todos' || filtrosOutrasTarifas.categoria !== 'todos' || filtrosOutrasTarifas.status !== 'todos' || filtrosOutrasTarifas.busca !== '') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFiltrosOutrasTarifas({ tipo: 'todos', tipoOperacao: 'todos', categoria: 'todos', status: 'todos', busca: '' })}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Pesquisar</Label>
                    <Input
                      placeholder="Pesquisar..."
                      value={filtrosOutrasTarifas.busca}
                      onChange={(e) => setFiltrosOutrasTarifas(prev => ({ ...prev, busca: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Combobox
                      options={tipoOutraTarifaOptions}
                      value={filtrosOutrasTarifas.tipo}
                      onValueChange={(v) => setFiltrosOutrasTarifas(prev => ({ ...prev, tipo: v }))}
                      placeholder="Selecione..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Operação</Label>
                    <Combobox
                      options={tipoOperacaoOutraTarifaOptions}
                      value={filtrosOutrasTarifas.tipoOperacao}
                      onValueChange={(v) => setFiltrosOutrasTarifas(prev => ({ ...prev, tipoOperacao: v }))}
                      placeholder="Selecione..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria Aeroporto</Label>
                    <Combobox
                      options={categoriaAeroportoOptions}
                      value={filtrosOutrasTarifas.categoria}
                      onValueChange={(v) => setFiltrosOutrasTarifas(prev => ({ ...prev, categoria: v }))}
                      placeholder="Selecione..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Combobox
                      options={statusTarifaOptions}
                      value={filtrosOutrasTarifas.status}
                      onValueChange={(v) => setFiltrosOutrasTarifas(prev => ({ ...prev, status: v }))}
                      placeholder="Selecione..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Outras Tarifas</CardTitle>
                <Button onClick={() => handleOpenForm('outra_tarifa')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Outra Tarifa
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          field="tipo"
                          label="Tipo"
                          currentSortField={sortFieldOutras}
                          currentSortDirection={sortDirectionOutras}
                          onSort={handleSortOutras}
                        />
                        <SortableTableHeader
                          field="tipo_operacao"
                          label="Tipo Operação"
                          currentSortField={sortFieldOutras}
                          currentSortDirection={sortDirectionOutras}
                          onSort={handleSortOutras}
                        />
                        <SortableTableHeader
                          field="categoria_aeroporto"
                          label="Categoria Aeroporto"
                          currentSortField={sortFieldOutras}
                          currentSortDirection={sortDirectionOutras}
                          onSort={handleSortOutras}
                        />
                        <SortableTableHeader
                          field="valor"
                          label="Valor (USD)"
                          currentSortField={sortFieldOutras}
                          currentSortDirection={sortDirectionOutras}
                          onSort={handleSortOutras}
                        />
                        <SortableTableHeader
                          field="unidade"
                          label="Unidade"
                          currentSortField={sortFieldOutras}
                          currentSortDirection={sortDirectionOutras}
                          onSort={handleSortOutras}
                        />
                        <SortableTableHeader
                          field="descricao"
                          label="Descrição"
                          currentSortField={sortFieldOutras}
                          currentSortDirection={sortDirectionOutras}
                          onSort={handleSortOutras}
                        />
                        <SortableTableHeader
                          field="status"
                          label="Status"
                          currentSortField={sortFieldOutras}
                          currentSortDirection={sortDirectionOutras}
                          onSort={handleSortOutras}
                        />
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outrasTarifasFiltradas.map((tarifa) => (
                        <TableRow key={tarifa.id}>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {tarifa.tipo.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {tarifa.tipo_operacao === 'domestica' ? 'Doméstico' : tarifa.tipo_operacao === 'internacional' ? 'Internacional' : 'Ambos'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {tarifa.categoria_aeroporto.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-green-700 font-medium">${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(tarifa.valor)}</TableCell>
                          <TableCell className="capitalize">{tarifa.unidade.replace('_', ' ')}</TableCell>
                          <TableCell>{tarifa.descricao}</TableCell>
                          <TableCell>
                            <Badge className={tarifa.status === 'ativa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {tarifa.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="hover:bg-slate-200" onClick={() => handleOpenForm('outra_tarifa', tarifa)}>
                              <Pencil className="h-4 w-4 text-slate-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100" onClick={() => handleDeleteClick('OutraTarifa', tarifa.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="impostos">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Impostos</CardTitle>
                <Button onClick={() => handleOpenForm('imposto')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Imposto
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
                    {impostos.map((imposto) => (
                      <TableRow key={imposto.id}>
                        <TableCell className="font-medium">{imposto.tipo}</TableCell>
                        <TableCell className="text-blue-700 font-medium">{imposto.valor}%</TableCell>
                        <TableCell>
                          {imposto.aeroporto_id 
                            ? aeroportos.find(a => a.id === imposto.aeroporto_id)?.nome || 'N/A'
                            : 'Todos'
                          }
                        </TableCell>
                        <TableCell>{new Date(imposto.data_inicio_vigencia).toLocaleDateString('pt-AO')}</TableCell>
                        <TableCell>
                          <Badge className={imposto.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {imposto.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="hover:bg-slate-200" onClick={() => handleOpenForm('imposto', imposto)}>
                            <Pencil className="h-4 w-4 text-slate-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100" onClick={() => handleDeleteClick('Imposto', imposto.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuracoes">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Configurações do Sistema</CardTitle>
                <p className="text-sm text-slate-600 mt-1">Gerir configurações globais do sistema de tarifas</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Taxa de Câmbio Padrão</h3>
                      <p className="text-sm text-blue-700 mb-4">
                        Esta taxa é usada automaticamente para converter valores USD em AOA em todos os cálculos de tarifas.
                      </p>
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-blue-600" />
                        <div>
                          <p className="text-3xl font-bold text-blue-900">
                            {configuracao?.taxa_cambio_usd_aoa || 850}
                            <span className="text-lg font-normal text-blue-700 ml-2">AOA/USD</span>
                          </p>
                          <p className="text-xs text-blue-600 mt-1">1 USD = {configuracao?.taxa_cambio_usd_aoa || 850} Kwanza</p>
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => setIsConfiguracaoFormOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Alterar
                    </Button>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>⚠️ Nota Importante:</strong> A alteração da taxa de câmbio afeta apenas os <strong>novos cálculos</strong>. 
                    Os cálculos já existentes mantêm a taxa que foi usada no momento do cálculo.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {isFormOpen && formType === 'movimento' && (
        <FormMovimentoFinanceiro
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingMovimento(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          movimentoInitial={editingMovimento}
          currentUser={currentUser}
        />
      )}
      {isFormOpen && formType === 'tarifa_pouso' && (
        <FormTarifaPouso
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingTarifa(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          tarifa={editingTarifa}
        />
      )}
      {isFormOpen && formType === 'tarifa_permanencia' && (
        <FormTarifaPermanencia
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingTarifa(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          tarifa={editingTarifa}
        />
      )}
      {isFormOpen && formType === 'outra_tarifa' && (
        <FormOutraTarifa
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingTarifa(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          tarifa={editingTarifa}
        />
      )}
      {isFormOpen && formType === 'imposto' && (
        <FormImposto
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingTarifa(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          imposto={editingTarifa}
        />
      )}

      <SendEmailModal
        isOpen={emailModal.isOpen}
        onClose={() => setEmailModal({ isOpen: false, subject: '', data: null })}
        onSend={handleSendEmail}
        defaultSubject={emailModal.subject}
        title="Enviar Relatório por Email"
      />

      <AlertModal
        isOpen={deleteInfo.isOpen}
        onClose={() => setDeleteInfo({ isOpen: false, entity: null, id: null })}
        onConfirm={handleDeleteConfirm}
        type="warning"
        title="Confirmar Exclusão"
        message="Tem a certeza que deseja excluir este registo? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        showCancel
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
      />

      <AlertModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ ...successInfo, isOpen: false })}
        type="success"
        title={successInfo.title}
        message={successInfo.message}
      />

      <FormConfiguracaoSistema
        isOpen={isConfiguracaoFormOpen}
        onClose={() => setIsConfiguracaoFormOpen(false)}
        onSubmit={handleConfiguracaoSubmit}
        configuracao={configuracao}
      />
    </div>
  );
}