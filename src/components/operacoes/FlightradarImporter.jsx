import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, AlertCircle, CheckCircle2, Clock, GripVertical, FileSpreadsheet } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getFlightradarFlights } from '@/functions/getFlightradarFlights';
import { importVooFromFR24Cache } from '@/functions/importVooFromFR24Cache';
import VooFR24ReviewModal from './VooFR24ReviewModal';
import CacheVooFR24List from './CacheVooFR24List';
import SearchProgressBar from './SearchProgressBar';
import AeroportoMultiSelect from '@/components/ui/aeroporto-multi-select';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function FlightradarImporter({ aeroportos = [], onImportSuccess }) {
  const [aeroportosSelecionados, setAeroportosSelecionados] = useState([]);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [voosFR24, setVoosFR24] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedCacheVoo, setSelectedCacheVoo] = useState(null);
  const [selectedFR24Voo, setSelectedFR24Voo] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedVoos, setSelectedVoos] = useState(new Set());
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [columnOrder, setColumnOrder] = useState([
    'data_voo_cache',
    'flight',
    'operating_as',
    'type',
    'reg',
    'orig_icao',
    'runway_takeoff',
    'datetime_takeoff',
    'dest_icao',
    'dest_icao_actual',
    'runway_landed',
    'datetime_landed',
    'flight_time',
    'actual_distance',
    'category',
    'flight_ended'
  ]);
  const [columnWidths, setColumnWidths] = useState({});
  const [resizingColumn, setResizingColumn] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [progressData, setProgressData] = useState({
    progress: 0,
    totalFlights: 0,
    elapsedTime: 0,
    estimatedTime: 0,
    currentPage: 1,
    error: null,
    isComplete: false
  });
  const [searchStartTime, setSearchStartTime] = useState(null);

  // Filtrar apenas aeroportos SGA por padrão
  const aeroportosFiltrados = aeroportos.filter(a => a.isSGA === true);

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
    data_voo_cache: 'Data Voo',
    flight: 'Flight/Callsign',
    operating_as: 'Operating',
    type: 'Tipo',
    reg: 'Registo',
    orig_icao: 'Origem ICAO/IATA',
    runway_takeoff: 'RWY Dec',
    datetime_takeoff: 'Descolagem',
    dest_icao: 'Destino ICAO/IATA',
    dest_icao_actual: 'Dest. Real ICAO/IATA',
    runway_landed: 'RWY Ater',
    datetime_landed: 'Ateragem',
    flight_time: 'Tempo',
    actual_distance: 'Distância Real/Círc',
    category: 'Cat',
    flight_ended: 'End'
  };

  const handleBuscar = async () => {
    if (aeroportosSelecionados.length === 0) {
      setError('Selecione pelo menos um aeroporto');
      return;
    }

    setIsLoading(true);
    setShowProgress(true);
    setError(null);
    setSearchStartTime(Date.now());
    setProgressData({
      progress: 0,
      totalFlights: 0,
      elapsedTime: 0,
      estimatedTime: 0,
      currentPage: 1,
      error: null,
      isComplete: false
    });

    try {
      const { base44 } = await import('@/api/base44Client');
      const allFlights = [];

      // Validar intervalo de datas (máximo 13 dias)
      const startDateObj = new Date(`${dataInicio}T00:00:00`);
      const endDateObj = new Date(`${dataFim}T23:59:59`);
      const diffDays = Math.floor((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));

      if (diffDays >= 14) {
        setError(`Intervalo de datas muito grande (${diffDays} dias). Máximo permitido é 13 dias.`);
        setIsLoading(false);
        return;
      }

      // Buscar TODOS os voos em cache para os aeroportos selecionados
      console.log('🔄 Buscando voos em cache...');
      const cacheVoos = await Promise.all(
        aeroportosSelecionados.map(aeroporto =>
          base44.entities.CacheVooFR24.filter({
            airport_icao: aeroporto,
            data_voo: { $gte: dataInicio, $lte: dataFim }
          }, null, 1000)
        )
      );

      // Adicionar voos do cache, convertendo para o formato correto
      const voosEmCache = cacheVoos.flat().map(cache => ({
        ...cache.raw_data,
        cache_id: cache.id,
        fr24_id: cache.fr24_id,
        data_voo_cache: cache.data_voo
      }));

      console.log(`✅ ${voosEmCache.length} voos encontrados em cache`);
      allFlights.push(...voosEmCache);

      // Atualizar progresso com voos do cache
      let now = Date.now();
      let elapsed = now - searchStartTime;
      setProgressData(prev => ({
        ...prev,
        progress: voosEmCache.length,
        totalFlights: voosEmCache.length,
        elapsedTime: elapsed,
        currentPage: 1
      }));

      // Buscar novos voos da API para cada aeroporto
      console.log('🔄 Buscando novos voos da API...');
      let pageCounter = 1;

      for (const aeroporto of aeroportosSelecionados) {
        try {
          const response = await getFlightradarFlights({
            airportIcao: aeroporto,
            startDate: `${dataInicio}T00:00:00`,
            endDate: `${dataFim}T23:59:59`
          });

          if (response && response.data && response.data.flights && Array.isArray(response.data.flights)) {
            console.log(`✅ ${response.data.flights.length} voos novos da API para ${aeroporto}`);
            allFlights.push(...response.data.flights);

            // Atualizar progresso
            now = Date.now();
            elapsed = now - searchStartTime;

            setProgressData(prev => ({
              ...prev,
              progress: allFlights.length,
              totalFlights: allFlights.length,
              elapsedTime: elapsed,
              currentPage: pageCounter,
              error: null
            }));
            pageCounter++;
          } else if (response && response.data && response.data.error) {
            console.error(`❌ Erro na API para ${aeroporto}:`, response.data.error);
            setProgressData(prev => ({
              ...prev,
              error: response.data.error,
              isComplete: true
            }));
            setError(response.data.error);
            setIsLoading(false);
            return;
          } else {
            console.warn(`⚠️ Nenhum voo retornado da API para ${aeroporto}`);
          }
        } catch (apiErr) {
          console.error(`❌ Exceção ao buscar ${aeroporto}:`, apiErr);
          const errorMsg = apiErr.message || 'Erro desconhecido ao buscar da API';
          setProgressData(prev => ({
            ...prev,
            error: errorMsg,
            isComplete: true
          }));
          setError(errorMsg);
          setIsLoading(false);
          return;
        }
      }

      // Remover duplicatas usando Set baseado em cache_id ou fr24_id
      const seen = new Set();
      const uniqueFlights = allFlights.filter(voo => {
        const id = voo.cache_id || voo.fr24_id || voo.id;
        if (!id) {
          console.warn('⚠️ Voo sem ID encontrado:', voo);
          return false;
        }
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      // Garantir que todos os voos têm cache_id
      const voosComCacheId = uniqueFlights.filter(voo => {
        if (!voo.cache_id) {
          console.warn('⚠️ Voo sem cache_id:', voo.fr24_id || voo.id);
          return false;
        }
        return true;
      });

      console.log(`✅ Total: ${voosComCacheId.length} voos com cache_id`);

      // Marcar como completo
      now = Date.now();
      elapsed = now - searchStartTime;
      setProgressData(prev => ({
        ...prev,
        progress: voosComCacheId.length,
        totalFlights: voosComCacheId.length,
        elapsedTime: elapsed,
        isComplete: true
      }));

      if (voosComCacheId.length > 0) {
        console.log(`📊 Definindo ${voosComCacheId.length} voos na tabela`);
        setVoosFR24(voosComCacheId);
        setError(null);
      } else {
        console.warn('⚠️ Nenhum voo encontrado no período.');
        setError('Nenhum voo encontrado no período.');
        setVoosFR24([]);
      }
      } catch (err) {
      console.error('❌ Erro ao buscar voos:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Erro ao buscar voos do Flightradar24';
      setError(errorMsg);
      setVoosFR24([]);
      setProgressData(prev => ({
        ...prev,
        error: errorMsg,
        isComplete: true
      }));
      } finally {
      setIsLoading(false);
      }
      };

  const getStatusBadge = (voo) => {
    if (voo.status_validacao === 'validado') {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Validado</Badge>;
    }
    if (voo.status_validacao === 'pendente') {
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
    return null;
  };

  const handleImportClick = async (voo) => {
    if (!voo.cache_id) {
      console.error('❌ Erro: voo.cache_id não definido', voo);
      setError('Erro ao importar: cache_id não encontrado');
      return;
    }
    console.log('✅ Abrindo modal para voo:', voo.cache_id);
    setSelectedFR24Voo(voo);
    setSelectedCacheVoo(voo.cache_id);
    setShowReviewModal(true);
  };

  const handleConfirmImport = async (suggestions, userSelections) => {
    setIsImporting(true);
    try {
      const response = await importVooFromFR24Cache({
        cacheVooId: selectedCacheVoo,
        suggestions: suggestions,
        userSelections: userSelections || {}
      });

      if (response.data.success) {
        setShowReviewModal(false);
        setSelectedCacheVoo(null);
        setSelectedFR24Voo(null);
        
        // Remover o voo da lista de FR24
        setVoosFR24(prev => prev.filter(v => v.cache_id !== selectedCacheVoo));
        
        if (onImportSuccess) {
          onImportSuccess(response.data);
        }
      }
    } catch (err) {
      console.error('Erro ao importar voo:', err);
      setError(`Erro ao importar: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSelectVoo = (cacheId) => {
    const newSelected = new Set(selectedVoos);
    if (newSelected.has(cacheId)) {
      newSelected.delete(cacheId);
    } else {
      newSelected.add(cacheId);
    }
    setSelectedVoos(newSelected);
  };

  const toggleSelectAll = (checked) => {
    console.log('toggleSelectAll:', checked, 'voosFR24:', voosFR24.length);
    if (checked) {
      const cacheIds = voosFR24.filter(v => v.cache_id).map(v => v.cache_id);
      setSelectedVoos(new Set(cacheIds));
      console.log('Selecionados:', cacheIds);
    } else {
      setSelectedVoos(new Set());
      console.log('Desmarcados todos');
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedVoos = React.useMemo(() => {
    if (!sortColumn) return voosFR24;
    
    return [...voosFR24].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [voosFR24, sortColumn, sortDirection]);

  const handleImportSelected = async () => {
    if (selectedVoos.size === 0) {
      setError('Selecione pelo menos um voo para importar');
      return;
    }

    setIsImporting(true);
    let importedCount = 0;
    
    try {
      for (const cacheId of selectedVoos) {
        try {
          const voo = voosFR24.find(v => v.cache_id === cacheId);
          if (voo) {
            await importVooFromFR24Cache({
              cacheVooId: cacheId,
              suggestions: {
                aeroporto_origem: { status: 'existente' },
                aeroporto_destino: { status: 'existente' },
                companhia_aerea: { status: 'existente' },
                modelo_aeronave: { status: 'existente' },
                registo_aeronave: { status: 'existente' }
              },
              userSelections: {
                aeroporto_origem: 'existente',
                aeroporto_destino: 'existente',
                companhia_aerea: 'existente',
                modelo_aeronave: 'existente',
                registo_aeronave: 'existente'
              }
            });
            importedCount++;
          }
        } catch (err) {
          console.error(`Erro ao importar voo ${cacheId}:`, err);
        }
      }

      setVoosFR24(prev => prev.filter(v => !selectedVoos.has(v.cache_id)));
      setSelectedVoos(new Set());

      if (importedCount > 0 && onImportSuccess) {
        onImportSuccess({ importedCount });
      }
    } catch (err) {
      console.error('Erro ao importar em massa:', err);
      setError(`Erro ao importar: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportarXLSX = async () => {
    try {
      setIsLoading(true);
      const { base44 } = await import('@/api/base44Client');
      const response = await base44.functions.invoke('exportFlightDataToXLSX', {
        tipo: 'buscar_voos',
        filtros: {
          voos: sortedVoos
        }
      });

      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `buscar_voos_fr24_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Erro ao exportar:', error);
      setError('Erro ao exportar dados para XLSX');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {showReviewModal && selectedCacheVoo && selectedFR24Voo && (
        <VooFR24ReviewModal
          cacheVooId={selectedCacheVoo}
          vooData={selectedFR24Voo}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedCacheVoo(null);
            setSelectedFR24Voo(null);
          }}
          onConfirmImport={handleConfirmImport}
        />
      )}

      <Tabs defaultValue="buscar" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="buscar">Buscar Voos</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Cache</TabsTrigger>
        </TabsList>

        <TabsContent value="buscar">
          <Card>
          <CardHeader>
            <CardTitle>Importar Voos do Flightradar24</CardTitle>
            <CardDescription>Busque e importe voos para validação antes de salvar no sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="aeroporto">Aeroportos</Label>
              <AeroportoMultiSelect
                aeroportos={aeroportosFiltrados}
                values={aeroportosSelecionados}
                onValuesChange={setAeroportosSelecionados}
                placeholder="Selecionar aeroportos..."
              />
            </div>

            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleBuscar}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Search className="w-4 h-4 mr-2" />
                {isLoading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </div>

          {showProgress && (
            <SearchProgressBar
              progress={progressData.progress}
              totalFlights={progressData.totalFlights}
              elapsedTime={progressData.elapsedTime}
              estimatedTime={progressData.estimatedTime}
              currentPage={progressData.currentPage}
              error={progressData.error}
              isComplete={progressData.isComplete}
            />
          )}

          {error && !showProgress && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {voosFR24.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {voosFR24.length} voo(s) encontrado(s)
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExportarXLSX}
                    disabled={isLoading || voosFR24.length === 0}
                    variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-50"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Exportar XLSX
                  </Button>
                  {selectedVoos.size > 0 && (
                    <Button
                      onClick={handleImportSelected}
                      disabled={isImporting}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Importar {selectedVoos.size} Selecionado(s)
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-md">
                <DragDropContext onDragEnd={handleDragEnd}>
                <table className="w-full text-[10px] whitespace-nowrap">
                  <thead className="bg-slate-100 sticky top-0 text-[9px]">
                    <Droppable droppableId="columns" direction="horizontal">
                      {(provided) => (
                        <tr ref={provided.innerRef} {...provided.droppableProps}>
                          <th className="px-0.5 py-0.5 text-left w-6">
                            <Checkbox
                              checked={selectedVoos.size === voosFR24.length && voosFR24.length > 0}
                              indeterminate={selectedVoos.size > 0 && selectedVoos.size < voosFR24.length}
                              onCheckedChange={toggleSelectAll}
                            />
                          </th>
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
                          <th className="px-0.5 py-0.5">Ação</th>
                        </tr>
                      )}
                    </Droppable>
                  </thead>
                  <tbody className="divide-y text-[10px]">
                   {sortedVoos.map((voo, idx) => {
                     const cellData = {
                       data_voo_cache: voo.data_voo_cache ? new Date(voo.data_voo_cache).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-',
                       flight: (
                         <div>
                           <div className="font-medium text-blue-600">{voo.flight || '-'}</div>
                           <div className="text-slate-500">{voo.callsign || '-'}</div>
                         </div>
                       ),
                       operating_as: voo.operating_as || '-',
                       type: voo.type || '-',
                       reg: voo.reg || '-',
                       orig_icao: (() => {
                         const origIcao = voo.orig_icao || '';
                         const origIata = voo.orig_iata || '';
                         return origIcao && origIata ? `${origIcao}/${origIata}` : origIcao || origIata || '-';
                       })(),
                       runway_takeoff: voo.runway_takeoff || '-',
                       datetime_takeoff: (() => {
                         if (voo.datetime_takeoff) {
                           const dt = new Date(voo.datetime_takeoff);
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
                       })(),
                       dest_icao: (() => {
                         const destIcao = voo.dest_icao || '';
                         const destIata = voo.dest_iata || '';
                         return destIcao && destIata ? `${destIcao}/${destIata}` : destIcao || destIata || '-';
                       })(),
                       dest_icao_actual: (() => {
                         const destIcaoActual = voo.dest_icao_actual || '';
                         const destIataActual = voo.dest_iata_actual || '';
                         return destIcaoActual && destIataActual ? `${destIcaoActual}/${destIataActual}` : destIcaoActual || destIataActual || '-';
                       })(),
                       runway_landed: voo.runway_landed || '-',
                       datetime_landed: (() => {
                         if (voo.datetime_landed) {
                           const dt = new Date(voo.datetime_landed);
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
                       })(),
                       flight_time: voo.flight_time 
                         ? `${Math.floor(voo.flight_time / 3600)}h${Math.floor((voo.flight_time % 3600) / 60)}m` 
                         : '-',
                       actual_distance: (() => {
                         const actualDist = voo.actual_distance ? Math.round(voo.actual_distance) : null;
                         const circleDist = voo.circle_distance ? Math.round(voo.circle_distance) : null;
                         return actualDist && circleDist ? `${actualDist}/${circleDist}` : actualDist || circleDist || '-';
                       })(),
                       category: voo.category || '-',
                       flight_ended: (
                         <span className={voo.flight_ended ? 'text-green-600' : 'text-slate-400'}>
                           {voo.flight_ended ? '✓' : '✗'}
                         </span>
                       )
                     };

                     return (
                       <tr key={idx} className="hover:bg-slate-50">
                         <td className="px-0.5 py-0.5 text-center w-6">
                           <Checkbox
                             checked={selectedVoos.has(voo.cache_id)}
                             onCheckedChange={() => toggleSelectVoo(voo.cache_id)}
                           />
                         </td>
                         {columnOrder.map(col => (
                           <td 
                             key={col} 
                             className={`px-0.5 py-0.5 ${
                               col === 'orig_icao' || col === 'dest_icao' ? 'font-semibold' : ''
                             } ${
                               col === 'reg' ? 'font-mono' : ''
                             } ${
                               col === 'runway_takeoff' || col === 'runway_landed' || col === 'flight_ended' ? 'text-center' : ''
                             }`}
                             style={{ width: columnWidths[col] ? `${columnWidths[col]}px` : 'auto' }}
                           >
                             {cellData[col]}
                           </td>
                         ))}
                         <td className="px-0.5 py-0.5 text-center">
                           <Button
                             size="sm"
                             variant="outline"
                             className="text-2xs px-2 py-1 h-6"
                             onClick={() => handleImportClick(voo)}
                           >
                             Import
                           </Button>
                         </td>
                       </tr>
                     );
                   })}
                  </tbody>
                </table>
                </DragDropContext>
              </div>
            </div>
          )}
          </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="historico">
          <CacheVooFR24List />
          </TabsContent>
          </Tabs>
          </>
          );
          }