import React, { useState, useEffect } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Trash2, Eye, ChevronDown, ChevronUp, X, Filter, GripVertical, FileSpreadsheet } from 'lucide-react';
import { CacheVooFlightAware } from '@/entities/CacheVooFlightAware';
import VooFlightAwareReviewModal from './VooFlightAwareReviewModal';
import VooFlightAwareMergeModal from './VooFlightAwareMergeModal';
import { importVooFromFlightAwareCache } from '@/functions/importVooFromFlightAwareCache';
import AlertModal from '@/components/shared/AlertModal';
import SuccessModal from '@/components/shared/SuccessModal';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const statusColors = {
  pendente: { bg: 'bg-yellow-50', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800' },
  importado: { bg: 'bg-green-50', text: 'text-green-800', badge: 'bg-green-100 text-green-800' },
  rejeitado: { bg: 'bg-red-50', text: 'text-red-800', badge: 'bg-red-100 text-red-800' },
  atualizado: { bg: 'bg-blue-50', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-800' }
};

export default function CacheVooFlightAwareList() {
  const { t } = useI18n();
  const [cacheVoos, setCacheVoos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroAeroporto, setFiltroAeroporto] = useState('');
  const [filtroVoosReais, setFiltroVoosReais] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCacheVoo, setSelectedCacheVoo] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '', action: null });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeData, setMergeData] = useState(null);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [columnOrder, setColumnOrder] = useState([
    'data_voo',
    'raw_data.flight',
    'raw_data.operating_as',
    'raw_data.type',
    'raw_data.reg',
    'raw_data.orig_icao',
    'raw_data.runway_takeoff',
    'raw_data.datetime_takeoff',
    'raw_data.dest_icao',
    'raw_data.dest_icao_actual',
    'raw_data.runway_landed',
    'raw_data.datetime_landed',
    'raw_data.flight_time',
    'raw_data.actual_distance',
    'raw_data.category',
    'raw_data.flight_ended',
    'confirmado',
    'status'
  ]);

  const [columnWidths, setColumnWidths] = useState({});
  const [resizingColumn, setResizingColumn] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(columnOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setColumnOrder(items);
  };

  const handleMouseDownResize = (e, column) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(column);
    setStartX(e.pageX);
    setStartWidth(columnWidths[column] || 100);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (resizingColumn) {
        e.preventDefault();
        const diff = e.pageX - startX;
        const newWidth = Math.max(50, startWidth + diff);
        setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
      }
    };

    const handleMouseUp = () => {
      if (resizingColumn) {
        setResizingColumn(null);
      }
    };

    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColumn, startX, startWidth]);

  const columnLabels = {
    'data_voo': t('cacheFA.colDataVoo'),
    'raw_data.flight': t('cacheFA.colVoo'),
    'raw_data.operating_as': t('cacheFA.colOperando'),
    'raw_data.type': t('cacheFA.colTipo'),
    'raw_data.reg': t('cacheFA.colRegisto'),
    'raw_data.orig_icao': t('cacheFA.colOrigem'),
    'raw_data.runway_takeoff': t('cacheFA.colPistaDecolagem'),
    'raw_data.datetime_takeoff': t('cacheFA.colHoraDecolagem'),
    'raw_data.dest_icao': t('cacheFA.colDestino'),
    'raw_data.dest_icao_actual': t('cacheFA.colDestinoReal'),
    'raw_data.runway_landed': t('cacheFA.colPistaPouso'),
    'raw_data.datetime_landed': t('cacheFA.colHoraPouso'),
    'raw_data.flight_time': t('cacheFA.colTempoVoo'),
    'raw_data.actual_distance': t('cacheFA.colDistancia'),
    'raw_data.category': t('cacheFA.colCategoria'),
    'raw_data.flight_ended': t('cacheFA.colFinalizado'),
    'confirmado': 'Confirmado',
    'status': t('cacheFA.status')
  };

  const carregarDados = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const voos = await CacheVooFlightAware.list('-data_expiracao', 1000);
      setCacheVoos(voos || []);
    } catch (err) {
      console.error('❌ Erro ao carregar cache:', err);
      setError(t('cacheFA.erroCarregar'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleExcluir = (id) => {
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: t('cacheFA.excluirTodosTitulo'),
      message: t('cacheFA.confirmarExcluir'),
      showCancel: true,
      confirmText: t('cacheFA.excluir'),
      action: async () => {
        setIsDeleting(true);
        try {
          await CacheVooFlightAware.delete(id);
          setCacheVoos(prev => prev.filter(v => v.id !== id));
          setSuccessInfo({
            isOpen: true,
            title: t('cacheFA.cacheExcluido'),
            message: t('cacheFA.cacheExcluidoMsg')
          });
        } catch (err) {
          console.error('Erro ao excluir:', err);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: t('cacheFA.excluirTodosTitulo'),
            message: t('cacheFA.erroExcluir')
          });
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const handleRejeitar = (id) => {
    setAlertInfo({
      isOpen: true,
      type: 'warning',
      title: t('cacheFA.rejeitado'),
      message: t('cacheFA.confirmarExcluir'),
      showCancel: true,
      confirmText: t('cacheFA.rejeitado'),
      action: async () => {
        setIsDeleting(true);
        try {
          await CacheVooFlightAware.update(id, { status: 'rejeitado' });
          setCacheVoos(prev => prev.map(v => v.id === id ? { ...v, status: 'rejeitado' } : v));
          setSuccessInfo({
            isOpen: true,
            title: t('cacheFA.rejeitado'),
            message: t('cacheFA.cacheExcluidoMsg')
          });
        } catch (err) {
          console.error('Erro ao rejeitar:', err);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: t('cacheFA.rejeitado'),
            message: t('cacheFA.erroExcluir')
          });
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const handleVerDetalhes = (voo) => {
    setSelectedCacheVoo(voo.id);
    setShowReviewModal(true);
  };

  const handleConfirmImport = async () => {
    setShowReviewModal(false);
    setSelectedCacheVoo(null);
    carregarDados();
  };

  const handleDuplicateAction = async (action, duplicateInfo) => {
    if (action === 'merge') {
      // Close review modal, open merge modal
      setShowReviewModal(false);
      setMergeData({
        existingVoo: duplicateInfo.existingVoo || duplicateInfo.dadosAPI,
        faData: duplicateInfo.faData || {},
        cacheVooId: selectedCacheVoo,
      });
      setShowMergeModal(true);
    } else if (action === 'create') {
      // Force create new flight ignoring duplicate
      try {
        await importVooFromFlightAwareCache({
          cacheVooId: selectedCacheVoo,
          forceCreate: true,
        });
        setShowReviewModal(false);
        setSelectedCacheVoo(null);
        setSuccessInfo({
          isOpen: true,
          title: 'Voo Criado',
          message: 'Novo voo criado com sucesso (duplicado ignorado).',
        });
        carregarDados();
      } catch (err) {
        console.error('Erro ao criar voo:', err);
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro',
          message: 'Erro ao criar o voo: ' + (err.message || 'Erro desconhecido'),
        });
      }
    }
  };

  const handleMergeComplete = (result) => {
    setShowMergeModal(false);
    setMergeData(null);
    setSelectedCacheVoo(null);
    setSuccessInfo({
      isOpen: true,
      title: 'Voo Atualizado',
      message: result.message || `Campos atualizados: ${result.mergedFields?.join(', ') || 'nenhum'}`,
    });
    carregarDados();
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const voosFiltratos = cacheVoos.filter(voo => {
    const rawData = voo.raw_data || {};

    // Hide cancelled flights and flights without any actual data
    if (rawData.cancelled) return false;
    if (!rawData.datetime_takeoff && !rawData.datetime_landed && !rawData.datetime_scheduled_takeoff && !rawData.datetime_scheduled_landed) return false;

    const statusMatch = filtroStatus === 'todos' || voo.status === filtroStatus;
    const buscaMatch = !filtroBusca ||
      voo.numero_voo?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      voo.fr24_id?.toLowerCase().includes(filtroBusca.toLowerCase());
    const aeroportoMatch = !filtroAeroporto || voo.airport_icao === filtroAeroporto;
    const dataInicioMatch = !filtroDataInicio || voo.data_voo >= filtroDataInicio;
    const dataFimMatch = !filtroDataFim || voo.data_voo <= filtroDataFim;
    const voosReaisMatch = !filtroVoosReais || (
      (rawData.actual_off || rawData.actual_on) && !rawData.cancelled
    );
    return statusMatch && buscaMatch && aeroportoMatch && dataInicioMatch && dataFimMatch && voosReaisMatch;
  });

  const voosOrdenados = React.useMemo(() => {
    if (!sortColumn) return voosFiltratos;
    
    return [...voosFiltratos].sort((a, b) => {
      let aVal, bVal;
      
      if (sortColumn.includes('.')) {
        const [obj, key] = sortColumn.split('.');
        aVal = a[obj]?.[key];
        bVal = b[obj]?.[key];
      } else {
        aVal = a[sortColumn];
        bVal = b[sortColumn];
      }
      
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [voosFiltratos, sortColumn, sortDirection]);

  const aeroportosUnicos = [...new Set(cacheVoos.map(v => v.airport_icao))].sort();

  const handleExportarXLSX = async () => {
    try {
      setIsLoading(true);
      const { data } = await base44.functions.invoke('exportFlightDataToXLSX', {
        tipo: 'historico_cache',
        filtros: {
          status: filtroStatus,
          busca: filtroBusca,
          aeroporto: filtroAeroporto,
          dataInicio: filtroDataInicio,
          dataFim: filtroDataFim
        }
      });

      const blob = new Blob([data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historico_cache_fr24_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setSuccessInfo({
        isOpen: true,
        title: t('cacheFA.cacheExcluido'),
        message: t('cacheFA.cacheExcluidoMsg')
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('cacheFA.erroCarregar'),
        message: t('cacheFA.erroExcluir')
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-slate-600">{t('cacheFA.titulo')}...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {showReviewModal && selectedCacheVoo && (
        <VooFlightAwareReviewModal
          cacheVooId={selectedCacheVoo}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedCacheVoo(null);
          }}
          onConfirmImport={handleConfirmImport}
          onDuplicateAction={handleDuplicateAction}
        />
      )}

      {showMergeModal && mergeData && (
        <VooFlightAwareMergeModal
          existingVoo={mergeData.existingVoo}
          faData={mergeData.faData}
          cacheVooId={mergeData.cacheVooId}
          onClose={() => {
            setShowMergeModal(false);
            setMergeData(null);
          }}
          onMergeComplete={handleMergeComplete}
        />
      )}

      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle>{t('cacheFA.titulo')}</CardTitle>
            <CardDescription>{t('cacheFA.descricao')}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
      <CardContent className="space-y-4">
        <Card className="mb-4 sm:mb-6 border-slate-200">
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
              <span>Filtros e Pesquisa</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-3 sm:gap-4">
              <div className="flex-1 min-w-48">
                <Label htmlFor="busca-cache" className="text-xs sm:text-sm">{t('cacheFA.buscar')}</Label>
                <Input
                  id="busca-cache"
                  placeholder={t('cacheFA.buscar')}...
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="w-32">
                <Label htmlFor="filtro-data-inicio" className="text-xs sm:text-sm">{t('cacheFA.dataInicio')}</Label>
                <Input
                  id="filtro-data-inicio"
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="w-32">
                <Label htmlFor="filtro-data-fim" className="text-xs sm:text-sm">{t('cacheFA.dataFim')}</Label>
                <Input
                  id="filtro-data-fim"
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="w-28">
                <Label htmlFor="filtro-aeroporto" className="text-xs sm:text-sm">{t('cacheFA.aeroporto')}</Label>
                <select
                  id="filtro-aeroporto"
                  value={filtroAeroporto}
                  onChange={(e) => setFiltroAeroporto(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md"
                >
                  <option value="">{t('cacheFA.todosFiltro')}</option>
                  {aeroportosUnicos.map(ap => (
                    <option key={ap} value={ap}>{ap}</option>
                  ))}
                </select>
              </div>

              <div className="w-24">
                <Label htmlFor="filtro-status" className="text-xs sm:text-sm">{t('cacheFA.status')}</Label>
                <select
                  id="filtro-status"
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md"
                >
                  <option value="todos">{t('cacheFA.todos')}</option>
                  <option value="pendente">{t('cacheFA.pendente')}</option>
                  <option value="importado">{t('cacheFA.importado')}</option>
                  <option value="rejeitado">{t('cacheFA.rejeitado')}</option>
                  <option value="atualizado">{t('cacheFA.atualizado') || 'Atualizado'}</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filtroVoosReais}
                    onChange={(e) => setFiltroVoosReais(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ms-2 text-xs sm:text-sm font-medium text-slate-700">Apenas voos reais</span>
                </label>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiltroBusca('');
                  setFiltroStatus('todos');
                  setFiltroDataInicio('');
                  setFiltroDataFim('');
                  setFiltroAeroporto('');
                  setFiltroVoosReais(false);
                }}
                className="text-xs sm:text-sm px-2"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarXLSX}
            disabled={isLoading || voosFiltratos.length === 0}
            className="text-green-700 border-green-300 hover:bg-green-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline ml-2 text-sm">{t('flightaware.export')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-2 text-sm">{t('cacheFA.recarregar')}</span>
          </Button>
        </div>



        {voosFiltratos.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm sm:text-base">{t('cacheFA.nenhumVoo')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-md">
            <DragDropContext onDragEnd={handleDragEnd}>
            <table className="w-full text-[10px] whitespace-nowrap">
              <thead className="bg-slate-100 sticky top-0 text-[9px]">
                <Droppable droppableId="columns-cache" direction="horizontal">
                  {(provided) => (
                    <tr ref={provided.innerRef} {...provided.droppableProps}>
                      {columnOrder.map((col, index) => (
                        <Draggable key={col} draggableId={col} index={index}>
                          {(provided, snapshot) => (
                            <th
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`px-0.5 py-0.5 text-left relative ${snapshot.isDragging ? 'bg-blue-100' : ''}`}
                              style={{ 
                                width: columnWidths[col] ? `${columnWidths[col]}px` : 'auto',
                                ...provided.draggableProps.style 
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <span 
                                  {...provided.dragHandleProps} 
                                  className="cursor-grab active:cursor-grabbing flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GripVertical className="w-3 h-3 text-slate-400" />
                                </span>
                                <span 
                                  className="whitespace-pre-line cursor-pointer hover:text-blue-600 flex-1"
                                  onClick={() => handleSort(col)}
                                >
                                  {columnLabels[col]}
                                  {sortColumn === col && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                                </span>
                              </div>
                              <div
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-transparent"
                                onMouseDown={(e) => handleMouseDownResize(e, col)}
                              />
                            </th>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      <th className="px-0.5 py-0.5 text-center">{t('cacheFA.status')}</th>
                    </tr>
                  )}
                </Droppable>
              </thead>
              <tbody className="divide-y text-[10px]">
                {voosOrdenados.map((voo) => {
                  const statusConfig = statusColors[voo.status] || statusColors.pendente;
                  const rawData = voo.raw_data || {};

                  const getCellValue = (col) => {
                    if (col === 'data_voo') return voo.data_voo ? new Date(voo.data_voo).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';
                    if (col === 'status') {
                      return (
                        <Badge className={statusConfig.badge}>
                          {voo.status === 'pendente' && t('cacheFA.pendente')}
                          {voo.status === 'importado' && t('cacheFA.importado')}
                          {voo.status === 'rejeitado' && t('cacheFA.rejeitado')}
                        </Badge>
                      );
                    }
                    if (col === 'raw_data.flight') {
                      return (
                        <div>
                          <div className="font-medium text-blue-600">{rawData.flight || voo.numero_voo || '-'}</div>
                          <div className="text-slate-500">{rawData.callsign || '-'}</div>
                        </div>
                      );
                    }
                    if (col === 'raw_data.operating_as') return rawData.operating_as || '-';
                    if (col === 'raw_data.type') return rawData.type || '-';
                    if (col === 'raw_data.reg') return rawData.reg || '-';
                    if (col === 'raw_data.orig_icao') {
                      const origIcao = rawData.orig_icao || '';
                      const origIata = rawData.orig_iata || '';
                      return origIcao && origIata ? `${origIcao}/${origIata}` : origIcao || origIata || '-';
                    }
                    if (col === 'raw_data.runway_takeoff') return rawData.runway_takeoff || '-';
                    if (col === 'raw_data.datetime_takeoff') {
                      if (rawData.datetime_takeoff) {
                        const dt = new Date(rawData.datetime_takeoff);
                        const takeoffDate = dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                        const takeoffTime = dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div>
                            <div>{takeoffDate}</div>
                            <div className="text-blue-600">{takeoffTime}</div>
                          </div>
                        );
                      }
                      return '-';
                    }
                    if (col === 'raw_data.dest_icao') {
                      const destIcao = rawData.dest_icao || '';
                      const destIata = rawData.dest_iata || '';
                      return destIcao && destIata ? `${destIcao}/${destIata}` : destIcao || destIata || '-';
                    }
                    if (col === 'raw_data.dest_icao_actual') {
                      const destIcaoActual = rawData.dest_icao_actual || '';
                      const destIataActual = rawData.dest_iata_actual || '';
                      return destIcaoActual && destIataActual ? `${destIcaoActual}/${destIataActual}` : destIcaoActual || destIataActual || '-';
                    }
                    if (col === 'raw_data.runway_landed') return rawData.runway_landed || '-';
                    if (col === 'raw_data.datetime_landed') {
                      if (rawData.datetime_landed) {
                        const dt = new Date(rawData.datetime_landed);
                        const landedDate = dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                        const landedTime = dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div>
                            <div>{landedDate}</div>
                            <div className="text-green-600">{landedTime}</div>
                          </div>
                        );
                      }
                      return '-';
                    }
                    if (col === 'raw_data.flight_time') {
                      return rawData.flight_time 
                        ? `${Math.floor(rawData.flight_time / 3600)}h${Math.floor((rawData.flight_time % 3600) / 60)}m` 
                        : '-';
                    }
                    if (col === 'raw_data.actual_distance') {
                      const actualDist = rawData.actual_distance ? Math.round(rawData.actual_distance) : null;
                      const circleDist = rawData.circle_distance ? Math.round(rawData.circle_distance) : null;
                      return actualDist && circleDist ? `${actualDist}/${circleDist}` : actualDist || circleDist || '-';
                    }
                    if (col === 'raw_data.category') return rawData.category || '-';
                    if (col === 'confirmado') {
                      const isConfirmado = rawData.flight_ended && (rawData.datetime_takeoff || rawData.datetime_landed);
                      return (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isConfirmado ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                          {isConfirmado ? 'Sim' : 'Não'}
                        </span>
                      );
                    }
                    if (col === 'raw_data.flight_ended') {
                      return (
                        <span className={rawData.flight_ended ? 'text-green-600' : 'text-slate-400'}>
                          {rawData.flight_ended ? '✓' : '✗'}
                        </span>
                      );
                    }
                    return '-';
                  };
                  
                  return (
                    <tr key={voo.id} className="hover:bg-slate-50">
                      {columnOrder.map(col => (
                        <td 
                          key={col} 
                          className={`px-0.5 py-0.5 ${
                            col === 'raw_data.orig_icao' || col === 'raw_data.dest_icao' ? 'font-semibold' : ''
                          } ${
                            col === 'raw_data.reg' ? 'font-mono' : ''
                          } ${
                            col === 'raw_data.runway_takeoff' || col === 'raw_data.runway_landed' || col === 'raw_data.flight_ended' ? 'text-center' : ''
                          }`}
                          style={{ width: columnWidths[col] ? `${columnWidths[col]}px` : 'auto' }}
                        >
                          {getCellValue(col)}
                        </td>
                      ))}
                      <td className="px-0.5 py-0.5 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:bg-blue-50 text-2xs px-2 py-1 h-6"
                            onClick={() => handleVerDetalhes(voo)}
                            title="Ver detalhes"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          {voo.status !== 'rejeitado' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-orange-600 hover:bg-orange-50 text-2xs px-2 py-1 h-6"
                              onClick={() => handleRejeitar(voo.id)}
                              disabled={isDeleting}
                              title="Rejeitar"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 text-2xs px-2 py-1 h-6"
                            onClick={() => handleExcluir(voo.id)}
                            disabled={isDeleting}
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </DragDropContext>
          </div>
        )}

        <div className="text-xs text-slate-500 pt-2">
          <p>Total: {voosFiltratos.length} {t('cacheFA.colVoo')}(s)</p>
        </div>
        </CardContent>
        )}
        </Card>

        <AlertModal
         isOpen={alertInfo.isOpen}
         onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
         type={alertInfo.type}
         title={alertInfo.title}
         message={alertInfo.message}
         showCancel={alertInfo.showCancel}
         confirmText={alertInfo.confirmText}
         onConfirm={() => {
           setAlertInfo({ ...alertInfo, isOpen: false });
           if (alertInfo.action) alertInfo.action();
         }}
        />

        <SuccessModal
         isOpen={successInfo.isOpen}
         onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
         title={successInfo.title}
         message={successInfo.message}
        />
        </>
        );
        }