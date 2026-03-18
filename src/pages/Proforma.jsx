import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  Search,
  Filter,
  X,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  RefreshCw,
  Layers,
  BarChart3 } from
'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import Select from '@/components/ui/select';

import { Proforma } from '@/entities/Proforma';
import { ProformaItem } from '@/entities/ProformaItem';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User';
import { downloadAsCSV } from '@/components/lib/export';
import { base44 } from '@/api/base44Client';
import { registarCriacao } from '@/components/lib/auditoria';
import { getAeroportosPermitidos, ensureUserProfilesExist } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useI18n } from '@/components/lib/i18n';

import EditarFaturaModal from '../components/faturacao/EditarFaturaModal';
import GerarProformaConsolidadaModal from '../components/faturacao/GerarProformaConsolidadaModal';
import GerarRelatorioFaturacaoModal from '../components/faturacao/GerarRelatorioFaturacaoModal';
import DashboardFaturacao from '../components/faturacao/DashboardFaturacao';
import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';

const STATUS_CONFIG = {
  emitida: { labelKey: 'proforma.status_emitida', color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700', icon: FileText },
  enviada: { labelKey: 'proforma.status_enviada', color: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700', icon: CheckCircle },
  paga: { labelKey: 'proforma.status_paga', color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700', icon: CheckCircle },
  vencida: { labelKey: 'proforma.status_vencida', color: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700', icon: AlertCircle },
  cancelada: { labelKey: 'proforma.status_cancelada', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700', icon: X }
};

export default function ProformaPage() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const [proformas, setProformas] = useState([]);
  const [companhias, setCompanhias] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const [editingProforma, setEditingProforma] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConsolidadaModalOpen, setIsConsolidadaModalOpen] = useState(false);
  const [isRelatorioModalOpen, setIsRelatorioModalOpen] = useState(false);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });

  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    status: 'todos',
    companhia: 'todos',
    aeroporto: 'todos',
    busca: ''
  });

  const [activeTab, setActiveTab] = useState('proformas');
  const [sortField, setSortField] = useState('data_emissao');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    loadData();
  }, [effectiveEmpresaId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = ensureUserProfilesExist(await User.me());
      setCurrentUser(user);

      // Server-side empresa filter
      const empresaIdFiltro = effectiveEmpresaId || user.empresa_id;
      const proformaFilters = {};
      if (empresaIdFiltro) proformaFilters.empresa_id = empresaIdFiltro;

      const [proformasData, companhiasData, aeroportosData] = await Promise.all([
        Proforma.filter(proformaFilters, '-data_emissao'),
        CompanhiaAerea.list(),
        empresaIdFiltro ? Aeroporto.filter({ empresa_id: empresaIdFiltro }) : Aeroporto.list(),
      ]);

      // Filtrar aeroportos por empresa/permissões do utilizador
      const aeroportosFiltrados = getAeroportosPermitidos(user, aeroportosData, effectiveEmpresaId);

      setProformas(proformasData);
      setCompanhias(companhiasData);
      setAeroportos(aeroportosFiltrados);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('proforma.error_load_title'),
        message: t('proforma.error_load_msg')
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFiltros((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFiltros({
      dataInicio: '',
      dataFim: '',
      status: 'todos',
      companhia: 'todos',
      aeroporto: 'todos',
      busca: ''
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const proformasFiltradas = useMemo(() => {
    let filtered = proformas.filter((proforma) => {
      const dataMatch = (!filtros.dataInicio || proforma.data_emissao >= filtros.dataInicio) && (
      !filtros.dataFim || proforma.data_emissao <= filtros.dataFim);
      const statusMatch = filtros.status === 'todos' || proforma.status === filtros.status;
      const companhiaMatch = filtros.companhia === 'todos' || proforma.companhia_aerea_id === filtros.companhia;
      const aeroportoMatch = filtros.aeroporto === 'todos' || proforma.aeroporto_id === filtros.aeroporto;
      const buscaMatch = !filtros.busca ||
      proforma.numero_proforma?.toLowerCase().includes(filtros.busca.toLowerCase());

      return dataMatch && statusMatch && companhiaMatch && aeroportoMatch && buscaMatch;
    });

    // Ordenação
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

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

    return filtered;
  }, [proformas, filtros, sortField, sortDirection]);

  const kpiData = useMemo(() => {
    const totalProformas = proformasFiltradas.length;
    const totalValorAOA = proformasFiltradas.reduce((sum, f) => sum + (f.valor_total_aoa || 0), 0);
    const totalValorUSD = proformasFiltradas.reduce((sum, f) => sum + (f.valor_total_usd || 0), 0);
    const proformasPagas = proformasFiltradas.filter((f) => f.status === 'paga').length;
    const proformasVencidas = proformasFiltradas.filter((f) => f.status === 'vencida').length;
    const proformasPendentes = proformasFiltradas.filter((f) => f.status === 'emitida' || f.status === 'enviada').length;

    return {
      totalProformas,
      totalValorAOA,
      totalValorUSD,
      proformasPagas,
      proformasVencidas,
      proformasPendentes
    };
  }, [proformasFiltradas]);

  const handleEditProforma = (proforma) => {
    setEditingProforma(proforma);
    setIsEditModalOpen(true);
  };

  const handleSaveProforma = async (proformaData) => {
    try {
      await Proforma.update(editingProforma.id, proformaData);
      await loadData();
      setIsEditModalOpen(false);
      setEditingProforma(null);
      setSuccessInfo({
        isOpen: true,
        title: t('proforma.success_updated_title'),
        message: t('proforma.success_updated_msg')
      });
    } catch (error) {
      console.error('Erro ao atualizar proforma:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('proforma.error_update_title'),
        message: t('proforma.error_update_msg')
      });
    }
  };

  const handleDownloadPDF = async (proforma) => {
    try {
      // Sempre regenerar o PDF para garantir layout atualizado
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: t('proforma.generating_pdf_title'),
        message: t('proforma.generating_pdf_msg'),
        showCancel: false,
        confirmText: null
      });

      const response = await base44.functions.invoke('gerarProformaPdfSimples', { proforma_id: proforma.id });

      setAlertInfo({ ...alertInfo, isOpen: false });

      if (response && response.data && response.data.pdf_url) {
        const link = document.createElement('a');
        link.href = response.data.pdf_url;
        link.download = `proforma_${proforma.numero_proforma}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        await loadData();

        setSuccessInfo({
          isOpen: true,
          title: t('proforma.pdf_generated_title'),
          message: t('proforma.pdf_generated_msg')
        });
      } else {
        throw new Error('URL do PDF não foi retornada');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('proforma.error_pdf_title'),
        message: `${t('proforma.error_pdf_msg')} ${error.message || ''}`
      });
    }
  };

  const handleConfirmarConsolidada = async (dadosProforma) => {
    try {
      // Extract items before creating the proforma record
      const items = dadosProforma._items || [];
      delete dadosProforma._items;

      // Generate sequential proforma number (per empresa)
      const anoAtual = new Date().getFullYear();
      const empId = currentUser?.empresa_id;
      const proformasAno = proformas.filter(p =>
        p.numero_proforma?.startsWith(`PF-${anoAtual}`) &&
        (!empId || p.empresa_id === empId)
      );
      let maxSeq = 0;
      proformasAno.forEach(p => {
        const parts = p.numero_proforma?.split('-');
        if (parts?.length === 3) {
          const seq = parseInt(parts[2], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      });
      const numeroProforma = `PF-${anoAtual}-${String(maxSeq + 1).padStart(6, '0')}`;

      // Create the proforma record
      const proformaData = {
        ...dadosProforma,
        numero_proforma: numeroProforma,
        status: 'emitida',
        emitida_por: currentUser?.email,
        empresa_id: empId || null,
      };

      const novaProforma = await Proforma.create(proformaData);

      // Create proforma_item records for each calculo
      await Promise.all(items.map(item =>
        ProformaItem.create({
          proforma_id: novaProforma.id,
          empresa_id: empId || null,
          calculo_tarifa_id: item.calculo_tarifa_id,
          voo_ligado_id: item.voo_ligado_id,
          voo_id: item.voo_id,
          valor_usd: item.valor_usd,
          valor_aoa: item.valor_aoa,
        })
      ));

      // Generate PDF
      try {
        await base44.functions.invoke('gerarProformaPdfSimples', { proforma_id: novaProforma.id });
      } catch (pdfError) {
        console.warn('PDF generation failed, proforma still created:', pdfError);
      }

      // Audit log
      try {
        await registarCriacao('Proforma', novaProforma, 'faturacao');
      } catch (_) {}

      await loadData();
      setIsConsolidadaModalOpen(false);

      setSuccessInfo({
        isOpen: true,
        title: t('proforma.consolidated_success_title'),
        message: `${numeroProforma} — ${items.length} voo(s)`
      });
    } catch (error) {
      console.error('Erro ao gerar proforma consolidada:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('proforma.error_consolidated_title'),
        message: `${t('proforma.error_consolidated_msg')} ${error.message}`
      });
    }
  };

  const handleExportCSV = () => {
    if (proformasFiltradas.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: t('proforma.no_data_export_title'),
        message: t('proforma.no_data_export_msg')
      });
      return;
    }

    const dataToExport = proformasFiltradas.map((f) => {
      const companhia = companhias.find((c) => c.id === f.companhia_aerea_id);
      const aeroporto = aeroportos.find((a) => a.id === f.aeroporto_id);

      return {
        'Nº Proforma': f.numero_proforma,
        'Data Emissão': f.data_emissao,
        'Data Vencimento': f.data_vencimento,
        'Companhia': companhia?.nome || 'N/A',
        'Aeroporto': aeroporto?.codigo_icao || 'N/A',
        'Valor (USD)': f.valor_total_usd,
        'Valor (AOA)': f.valor_total_aoa,
        'Taxa Câmbio': f.taxa_cambio,
        'Status': f.status,
        'Emitida Por': f.emitida_por || 'N/A'
      };
    });

    downloadAsCSV(dataToExport, `proformas_${new Date().toISOString().split('T')[0]}`);
  };

  const formatCurrency = (value, currency = 'AOA') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('pt-AO', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value || 0);
    }
    return new Intl.NumberFormat('pt-AO', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const companhiaOptions = [
  { value: 'todos', label: t('proforma.all_companies') },
  ...companhias.map((c) => ({ value: c.id, label: `${c.nome} (${c.codigo_icao})` }))];


  const aeroportoOptions = [
  { value: 'todos', label: t('proforma.all_airports') },
  ...aeroportos.map((a) => ({ value: a.id, label: `${a.nome} (${a.codigo_icao})` }))];


  const statusOptions = [
  { value: 'todos', label: t('proforma.all_statuses') },
  ...Object.entries(STATUS_CONFIG).map(([key, { labelKey }]) => ({ value: key, label: t(labelKey) }))];


  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{t('page.proforma.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.proforma.subtitle')}</p>
          </div>
          {activeTab === 'proformas' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadData} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('proforma.refresh')}
              </Button>
              <Button onClick={() => setIsConsolidadaModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Layers className="w-4 h-4 mr-2" />
                {t('proforma.generate_consolidated')}
              </Button>
              <Button onClick={() => setIsRelatorioModalOpen(true)} variant="outline" className="border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                <FileText className="w-4 h-4 mr-2" />
                {t('proforma.statement')}
              </Button>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                {t('proforma.export_csv')}
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b dark:border-slate-700">
          <button
            onClick={() => setActiveTab('proformas')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'proformas' ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {t('proforma.tab_proformas')}
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {t('proforma.tab_dashboard')}
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <DashboardFaturacao companhias={companhias} aeroportos={aeroportos} />
        ) : (<>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('proforma.kpi_total')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{kpiData.totalProformas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('proforma.kpi_total_usd')}</p>
                  <p className="text-green-700 text-sm font-bold" title={`${formatCurrency(kpiData.totalValorUSD, 'USD')} US$`}>
                    {formatCurrency(kpiData.totalValorUSD, 'USD')} US$
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('proforma.kpi_total_aoa')}</p>
                  <p className="text-emerald-700 text-sm font-bold" title={`${formatCurrency(kpiData.totalValorAOA)} Kz`}>
                    {formatCurrency(kpiData.totalValorAOA)} Kz
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('proforma.kpi_paid')}</p>
                  <p className="text-2xl font-bold text-green-700">{kpiData.proformasPagas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('proforma.kpi_pending')}</p>
                  <p className="text-2xl font-bold text-yellow-700">{kpiData.proformasPendentes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('proforma.kpi_overdue')}</p>
                  <p className="text-2xl font-bold text-red-700">{kpiData.proformasVencidas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              {t('proforma.filters')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <Label htmlFor="busca">{t('proforma.search_number')}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                  <Input
                    id="busca"
                    placeholder={t('proforma.search_placeholder')}
                    value={filtros.busca}
                    onChange={(e) => handleFilterChange('busca', e.target.value)}
                    className="pl-9" />

                </div>
              </div>

              <div>
                <Label htmlFor="data-inicio">{t('proforma.date_start')}</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => handleFilterChange('dataInicio', e.target.value)} />

              </div>

              <div>
                <Label htmlFor="data-fim">{t('proforma.date_end')}</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => handleFilterChange('dataFim', e.target.value)} />

              </div>

              <div>
                <Label htmlFor="filtro-status">{t('proforma.status')}</Label>
                <Select
                  id="filtro-status"
                  options={statusOptions}
                  value={filtros.status}
                  onValueChange={(v) => handleFilterChange('status', v)}
                  placeholder={t('proforma.select_placeholder')} />

              </div>

              <div>
                <Label htmlFor="filtro-companhia">{t('proforma.company')}</Label>
                <Select
                  id="filtro-companhia"
                  options={companhiaOptions}
                  value={filtros.companhia}
                  onValueChange={(v) => handleFilterChange('companhia', v)}
                  placeholder={t('proforma.select_placeholder')} />

              </div>

              <div>
                <Label htmlFor="filtro-aeroporto">{t('proforma.airport')}</Label>
                <Select
                  id="filtro-aeroporto"
                  options={aeroportoOptions}
                  value={filtros.aeroporto}
                  onValueChange={(v) => handleFilterChange('aeroporto', v)}
                  placeholder={t('proforma.select_placeholder')} />

              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  {t('proforma.clear_filters')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Proformas */}
        <Card>
          <CardHeader>
            <CardTitle>{t('proforma.list_title')}</CardTitle>
            <CardDescription>
              {proformasFiltradas.length} {t('proforma.found_count')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border dark:border-slate-700 rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950">
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('numero_proforma')}>
                      {t('proforma.col_number')}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('data_emissao')}>
                      {t('proforma.col_issue_date')}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('data_vencimento')}>
                      {t('proforma.col_due_date')}
                    </TableHead>
                    <TableHead>{t('proforma.col_company')}</TableHead>
                    <TableHead>{t('proforma.col_airport')}</TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('valor_total_usd')}>
                      {t('proforma.col_value_usd')}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('valor_total_aoa')}>
                      {t('proforma.col_value_aoa')}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('status')}>
                      {t('proforma.col_status')}
                    </TableHead>
                    <TableHead className="text-right">{t('proforma.col_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ?
                  Array(5).fill(0).map((_, i) =>
                  <TableRow key={i}>
                        {Array(9).fill(0).map((_, j) =>
                    <TableCell key={j}>
                            <Skeleton className="h-5 w-20" />
                          </TableCell>
                    )}
                      </TableRow>
                  ) :
                  proformasFiltradas.length === 0 ?
                  <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-slate-500 dark:text-slate-400">
                        {t('proforma.empty_state')}
                      </TableCell>
                    </TableRow> :


                  proformasFiltradas.map((proforma) => {
                    const companhia = companhias.find((c) => c.id === proforma.companhia_aerea_id);
                    const aeroporto = aeroportos.find((a) => a.id === proforma.aeroporto_id);
                    const statusConfig = STATUS_CONFIG[proforma.status] || STATUS_CONFIG.emitida;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={proforma.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                          <TableCell className="font-mono font-medium text-blue-700 dark:text-blue-400">
                            <div className="flex items-center gap-1.5">
                              {proforma.numero_proforma}
                              {proforma.tipo === 'consolidada' && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                                  {t('proforma.consolidated')}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(parseISO(proforma.data_emissao), 'dd MMM yyyy', { locale: pt })}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(proforma.data_vencimento), 'dd MMM yyyy', { locale: pt })}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900 dark:text-slate-100">{companhia?.nome || 'N/A'}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{companhia?.codigo_icao || ''}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{aeroporto?.codigo_icao || 'N/A'}</TableCell>
                          <TableCell className="font-semibold text-green-700">
                            {formatCurrency(proforma.valor_total_usd, 'USD')}
                          </TableCell>
                          <TableCell className="font-semibold text-emerald-700">
                            {formatCurrency(proforma.valor_total_aoa)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statusConfig.color} border font-medium flex items-center gap-1 w-fit`}>
                              <StatusIcon className="w-3 h-3" />
                              {t(statusConfig.labelKey)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleDownloadPDF(proforma)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  {t('proforma.download_pdf')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditProforma(proforma)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t('proforma.edit')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>);

                  })
                  }
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        </>)}
      </div>

      {/* Modals */}
      {isEditModalOpen && editingProforma &&
      <EditarFaturaModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProforma(null);
        }}
        onSave={handleSaveProforma}
        fatura={editingProforma} />

      }

      <GerarProformaConsolidadaModal
        isOpen={isConsolidadaModalOpen}
        onClose={() => setIsConsolidadaModalOpen(false)}
        onConfirm={handleConfirmarConsolidada}
        companhias={companhias}
        aeroportos={aeroportos}
      />

      <GerarRelatorioFaturacaoModal
        isOpen={isRelatorioModalOpen}
        onClose={() => setIsRelatorioModalOpen(false)}
        companhias={companhias}
        aeroportos={aeroportos}
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message} />


      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
        title={successInfo.title}
        message={successInfo.message} />

    </div>);

}