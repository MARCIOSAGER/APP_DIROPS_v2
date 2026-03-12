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
  RefreshCw } from
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
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { Aeroporto } from '@/entities/Aeroporto';
import { Voo } from '@/entities/Voo';
import { User } from '@/entities/User';
import { downloadAsCSV } from '@/components/lib/export';
import { base44 } from '@/api/base44Client';

import EditarFaturaModal from '../components/faturacao/EditarFaturaModal';
import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';

const STATUS_CONFIG = {
  emitida: { label: 'Emitida', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: FileText },
  enviada: { label: 'Enviada', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: CheckCircle },
  paga: { label: 'Paga', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  vencida: { label: 'Vencida', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: X }
};

export default function ProformaPage() {
  const [proformas, setProformas] = useState([]);
  const [calculosTarifa, setCalculosTarifa] = useState([]);
  const [companhias, setCompanhias] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [voos, setVoos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const [editingProforma, setEditingProforma] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const [sortField, setSortField] = useState('data_emissao');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const [proformasData, calculosData, companhiasData, aeroportosData, voosData] = await Promise.all([
      Proforma.list(),
      CalculoTarifa.list(),
      CompanhiaAerea.list(),
      Aeroporto.list(),
      Voo.list()]
      );

      setProformas(proformasData);
      setCalculosTarifa(calculosData);
      setCompanhias(companhiasData);
      setAeroportos(aeroportosData);
      setVoos(voosData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Carregar Dados',
        message: 'Não foi possível carregar os dados. Por favor, recarregue a página.'
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
        title: 'Proforma Atualizada!',
        message: `A proforma ${proformaData.numero_proforma} foi atualizada com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao atualizar proforma:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Atualizar',
        message: 'Não foi possível atualizar a proforma. Tente novamente.'
      });
    }
  };

  const handleDownloadPDF = async (proforma) => {
    try {
      // Sempre regenerar o PDF para garantir layout atualizado
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: 'Gerando PDF...',
        message: 'Por favor aguarde enquanto o PDF é gerado.',
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
          title: 'PDF Gerado!',
          message: 'O PDF da proforma foi gerado e o download iniciará automaticamente.'
        });
      } else {
        throw new Error('URL do PDF não foi retornada');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Gerar PDF',
        message: `Não foi possível gerar o PDF da proforma. Detalhes: ${error.message || 'Erro desconhecido'}`
      });
    }
  };

  const handleExportCSV = () => {
    if (proformasFiltradas.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'info',
        title: 'Nenhum dado para exportar',
        message: 'Não há proformas nos filtros atuais para serem exportadas.'
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
  { value: 'todos', label: 'Todas as Companhias' },
  ...companhias.map((c) => ({ value: c.id, label: `${c.nome} (${c.codigo_icao})` }))];


  const aeroportoOptions = [
  { value: 'todos', label: 'Todos os Aeroportos' },
  ...aeroportos.map((a) => ({ value: a.id, label: `${a.nome} (${a.codigo_icao})` }))];


  const statusOptions = [
  { value: 'todos', label: 'Todos os Status' },
  ...Object.entries(STATUS_CONFIG).map(([key, { label }]) => ({ value: key, label }))];


  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Gestão de Proformas</h1>
            <p className="text-slate-600 mt-1">Acompanhe e gerencie as notas proforma emitidas.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600">Total Proformas</p>
                  <p className="text-2xl font-bold text-slate-900">{kpiData.totalProformas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600">Total (USD)</p>
                  <p className="text-green-700 text-base font-bold truncate">
                    {formatCurrency(kpiData.totalValorUSD, 'USD')} US$
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600">Total (AOA)</p>
                  <p className="text-emerald-700 text-base font-bold truncate">
                    {formatCurrency(kpiData.totalValorAOA)} Kz
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600">Pagas</p>
                  <p className="text-2xl font-bold text-green-700">{kpiData.proformasPagas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-700">{kpiData.proformasPendentes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600">Vencidas</p>
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
              <Filter className="w-5 h-5 text-slate-500" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <Label htmlFor="busca">Pesquisar por Nº Proforma</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    id="busca"
                    placeholder="Ex: PF-2025-001234..."
                    value={filtros.busca}
                    onChange={(e) => handleFilterChange('busca', e.target.value)}
                    className="pl-9" />

                </div>
              </div>

              <div>
                <Label htmlFor="data-inicio">Data Início</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => handleFilterChange('dataInicio', e.target.value)} />

              </div>

              <div>
                <Label htmlFor="data-fim">Data Fim</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => handleFilterChange('dataFim', e.target.value)} />

              </div>

              <div>
                <Label htmlFor="filtro-status">Status</Label>
                <Select
                  id="filtro-status"
                  options={statusOptions}
                  value={filtros.status}
                  onValueChange={(v) => handleFilterChange('status', v)}
                  placeholder="Selecione..." />

              </div>

              <div>
                <Label htmlFor="filtro-companhia">Companhia</Label>
                <Select
                  id="filtro-companhia"
                  options={companhiaOptions}
                  value={filtros.companhia}
                  onValueChange={(v) => handleFilterChange('companhia', v)}
                  placeholder="Selecione..." />

              </div>

              <div>
                <Label htmlFor="filtro-aeroporto">Aeroporto</Label>
                <Select
                  id="filtro-aeroporto"
                  options={aeroportoOptions}
                  value={filtros.aeroporto}
                  onValueChange={(v) => handleFilterChange('aeroporto', v)}
                  placeholder="Selecione..." />

              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Proformas */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Proformas</CardTitle>
            <CardDescription>
              {proformasFiltradas.length} proforma(s) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('numero_proforma')}>
                      Nº Proforma
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('data_emissao')}>
                      Data Emissão
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('data_vencimento')}>
                      Vencimento
                    </TableHead>
                    <TableHead>Companhia</TableHead>
                    <TableHead>Aeroporto</TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('valor_total_usd')}>
                      Valor (USD)
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('valor_total_aoa')}>
                      Valor (AOA)
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                      Status
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                      <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                        Nenhuma proforma encontrada com os filtros selecionados.
                      </TableCell>
                    </TableRow> :

                  proformasFiltradas.map((proforma) => {
                    const companhia = companhias.find((c) => c.id === proforma.companhia_aerea_id);
                    const aeroporto = aeroportos.find((a) => a.id === proforma.aeroporto_id);
                    const statusConfig = STATUS_CONFIG[proforma.status] || STATUS_CONFIG.emitida;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={proforma.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono font-medium text-blue-700">
                            {proforma.numero_proforma}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(proforma.data_emissao), 'dd MMM yyyy', { locale: pt })}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(proforma.data_vencimento), 'dd MMM yyyy', { locale: pt })}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{companhia?.nome || 'N/A'}</span>
                              <span className="text-xs text-slate-500">{companhia?.codigo_icao || ''}</span>
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
                              {statusConfig.label}
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
                                  Baixar PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditProforma(proforma)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
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