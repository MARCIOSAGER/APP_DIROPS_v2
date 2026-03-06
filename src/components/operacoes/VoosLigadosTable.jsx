import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, ArrowRight, Clock, Users, Package, Timer, MoreVertical, Eye, RefreshCw, DollarSign, ChevronLeft, ChevronRight, Trash2, FolderOpen
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import SortableTableHeader from '@/components/shared/SortableTableHeader';
import Select from '@/components/ui/select';

const getTipoOperacao = (voo, todosAeroportos) => {
  if (!voo || !todosAeroportos) return 'N/A';

  const aeroportoOrigem = todosAeroportos.find(
    (a) => a.codigo_icao === voo.aeroporto_origem_destino
  );
  const aeroportoOperacao = todosAeroportos.find(
    (a) => a.codigo_icao === voo.aeroporto_operacao
  );

  const isInternationalOrigin = aeroportoOrigem && aeroportoOrigem.pais !== 'AO';
  const isInternationalOperation = aeroportoOperacao && aeroportoOperacao.pais !== 'AO';

  if (isInternationalOrigin || isInternationalOperation) {
    return 'Internacional';
  }
  return 'Doméstico';
};

export default function VoosLigadosTable({
  voosLigados,
  voos,
  calculosTarifa,
  isLoading,
  onShowTariffDetails,
  onGerarProforma,
  onRecalcularTarifa,
  onRecalcularTarifaLote,
  onAlterarCambio,
  onExcluirVooLigado,
  onUploadDocumento,
  onVerDocumentosVoo,
  todosAeroportos,
  sortField,
  sortDirection,
  onSort,
  currentUser
}) {
  const [selectedVoos, setSelectedVoos] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isAdmin = currentUser?.role === 'admin' || (currentUser?.perfis && currentUser.perfis.includes('administrador'));

  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return '0,00 Kz';
    return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
  };

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}min`;
  };

  const detectarDuplicatas = () => {
    const duplicatasMap = new Map();

    voosLigados.forEach((vl) => {
      const key = `${vl.id_voo_arr}_${vl.id_voo_dep}`;

      if (!duplicatasMap.has(key)) {
        duplicatasMap.set(key, []);
      }
      duplicatasMap.get(key).push(vl.id);
    });

    const duplicataIds = new Set();
    duplicatasMap.forEach((ids) => {
      if (ids.length > 1) {
        ids.forEach(id => duplicataIds.add(id));
      }
    });

    return duplicataIds;
  };

  const duplicataIds = detectarDuplicatas();

  const handleSelectAll = (checked) => {
    if (checked) {
      const todosVoosIds = voosLigados.map((vl) => vl.id);
      setSelectedVoos(new Set(todosVoosIds));
    } else {
      setSelectedVoos(new Set());
    }
  };

  const handleSelectVoo = (vooLigadoId, checked) => {
    const newSelected = new Set(selectedVoos);
    if (checked) {
      newSelected.add(vooLigadoId);
    } else {
      newSelected.delete(vooLigadoId);
    }
    setSelectedVoos(newSelected);
  };

  const handleGerarProformasLote = () => {
    const selectedCalculos = Array.from(selectedVoos).
    map((vooLigadoId) => {
      const vl = voosLigados.find((v) => v.id === vooLigadoId);
      const depVoo = voos.find((v) => v.id === vl?.id_voo_dep);
      const calculo = calculosTarifa.find((ct) => ct.voo_id === depVoo?.id);
      return { vooLigado: vl, calculo };
    }).
    filter((item) => item.calculo && item.calculo.tipo_tarifa !== 'Voo Isento de Tarifas');

    if (selectedCalculos.length === 0) {
      alert('Nenhum voo selecionado possui cálculo válido para gerar proforma. Voos isentos não podem ter proforma.');
      return;
    }

    console.log('Gerar proformas para:', selectedCalculos);
  };

  const handleRecalcularLote = () => {
    const selectedIds = Array.from(selectedVoos);
    if (selectedIds.length > 0) {
      onRecalcularTarifaLote(selectedIds);
    }
  };

  const voosComCalculoValido = Array.from(selectedVoos).filter((vooLigadoId) => {
    const vl = voosLigados.find((v) => v.id === vooLigadoId);
    if (!vl) return false;
    const depVoo = voos.find((v) => v.id === vl.id_voo_dep);
    const calculo = calculosTarifa.find((ct) => ct.voo_id === depVoo?.id);
    return calculo && calculo.tipo_tarifa !== 'Voo Isento de Tarifas';
  }).length;

  const hasValidSelection = selectedVoos.size > 0;

  const voosComCalculo = voosLigados.filter(vl => {
    const depVoo = voos.find(v => v.id === vl.id_voo_dep);
    return depVoo && calculosTarifa.some(ct => ct.voo_id === depVoo.id);
  }).length;

  const totalPages = Math.ceil(voosLigados.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentVoosLigados = voosLigados.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setSelectedVoos(new Set());
    }
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
    setSelectedVoos(new Set());
  };

  const pageSizeOptions = [
    { value: '10', label: '10 por página' },
    { value: '25', label: '25 por página' },
    { value: '50', label: '50 por página' },
    { value: '100', label: '100 por página' }
  ];

  const getTableHeight = () => {
    switch(pageSize) {
      case 10:
        return 'max-h-[calc(100vh-350px)]';
      case 25:
        return 'max-h-[calc(100vh-250px)]';
      case 50:
        return 'max-h-[calc(100vh-200px)]';
      case 100:
        return 'max-h-[calc(100vh-180px)]';
      default:
        return 'max-h-[calc(100vh-350px)]';
    }
  };

  return (
    <div className="space-y-4">
      {hasValidSelection &&
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedVoos.size === voosLigados.length}
              onCheckedChange={handleSelectAll}
            />

            <span className="text-sm font-medium text-blue-900">
              {selectedVoos.size} voo{selectedVoos.size !== 1 ? 's' : ''} selecionado{selectedVoos.size !== 1 ? 's' : ''}
              {voosComCalculoValido < selectedVoos.size &&
                <span className="text-blue-600 ml-2">
                  ({voosComCalculoValido} com cálculo válido para proforma)
                </span>
              }
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedVoos(new Set())}
            >
              Limpar Seleção
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={handleRecalcularLote}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recalcular ({selectedVoos.size})
            </Button>
            <Button
              size="sm" className="bg-blue-600 text-slate-50 px-3 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-9 rounded-md hover:bg-blue-700"
              onClick={handleGerarProformasLote}
              disabled={voosComCalculoValido === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              Gerar Proformas ({voosComCalculoValido})
            </Button>
          </div>
        </div>
      }

      {duplicataIds.size > 0 && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded">
          <div className="flex items-center gap-2">
            <Badge className="bg-red-600 text-white">⚠️</Badge>
            <div>
              <p className="text-sm font-semibold text-red-900">
                {duplicataIds.size} vinculação(ões) duplicada(s) detectada(s)
              </p>
              <p className="text-xs text-red-700 mt-1">
                As linhas com fundo vermelho e borda vermelha são duplicatas.
                Recomendamos excluir as duplicatas para evitar cobranças incorretas.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`border rounded-lg overflow-x-auto overflow-y-auto ${getTableHeight()}`}>
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedVoos.size === voosLigados.length && voosLigados.length > 0}
                  onCheckedChange={handleSelectAll}
                  disabled={voosLigados.length === 0}
                />
              </TableHead>
              <SortableTableHeader
                field="numero_voo"
                label="Voo (ARR → DEP)"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={onSort}
              />
              <SortableTableHeader
                field="horario_arr"
                label="Horários"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={onSort}
              />
              <TableHead className="whitespace-nowrap">Rota & Tipo</TableHead>
              <SortableTableHeader
                field="registo_aeronave"
                label="Registo"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={onSort}
              />
              <SortableTableHeader
                field="companhia_aerea"
                label="Companhia"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={onSort}
              />
              <SortableTableHeader
                field="tempo_permanencia_min"
                label="Permanência"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={onSort}
              />
              <SortableTableHeader
                field="passageiros_total"
                label="PAX/Carga"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={onSort}
              />
              <SortableTableHeader
                field="total_tarifa"
                label="Tarifa Total"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={onSort}
              />
              <SortableTableHeader
                field="updated_date"
                label="Atualizado"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-right w-16">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ?
              Array(pageSize).fill(0).map((_, i) =>
                <TableRow key={i}>
                  {Array(10).fill(0).map((_, j) =>
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                  )}
                </TableRow>
              ) :
              currentVoosLigados.map((vooLigado) => {
                const arrVoo = voos.find((v) => v.id === vooLigado.id_voo_arr);
                const depVoo = voos.find((v) => v.id === vooLigado.id_voo_dep);
                const calculo = calculosTarifa.find((ct) => ct.voo_id === depVoo?.id);

                if (!arrVoo || !depVoo) return null;

                const tempoPermanenciaHoras = (vooLigado.tempo_permanencia_min / 60).toFixed(2);
                const totalPax = depVoo.passageiros_total || 0;
                const totalCarga = depVoo.carga_kg || 0;

                const isIsento = calculo?.tipo_tarifa === "Voo Isento de Tarifas";
                const canSelect = true;

                const isDuplicata = duplicataIds.has(vooLigado.id);

                return (
                  <TableRow
                    key={vooLigado.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isDuplicata ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                    }`}
                  >
                    <TableCell className="py-2">
                      {canSelect &&
                        <Checkbox
                          checked={selectedVoos.has(vooLigado.id)}
                          onCheckedChange={(checked) => handleSelectVoo(vooLigado.id, checked)}
                        />
                      }
                    </TableCell>
                    <TableCell className="min-w-[160px] py-2">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {isDuplicata && (
                          <div className="flex items-center gap-1">
                            <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 animate-pulse">
                              ⚠️ DUPLICATA
                            </Badge>
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-1.5 py-0.5">
                              ARR
                            </Badge>
                            <span className="font-mono font-medium text-slate-900 text-xs">
                              {arrVoo.numero_voo}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 ml-1">
                            {format(parseISO(arrVoo.data_operacao), 'dd MMM', { locale: pt })}
                          </div>
                        </div>

                        <ArrowRight className="h-3 w-3 text-slate-400 flex-shrink-0" />

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-1.5 py-0.5">
                              DEP
                            </Badge>
                            <span className="font-mono font-medium text-slate-900 text-xs">
                              {depVoo.numero_voo}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 ml-1">
                            {format(parseISO(depVoo.data_operacao), 'dd MMM', { locale: pt })}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap py-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="h-3 w-3 text-emerald-600" />
                          <span className="font-mono text-slate-600">
                            {arrVoo.horario_real || arrVoo.horario_previsto}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="h-3 w-3 text-blue-600" />
                          <span className="font-mono text-slate-600">
                            {depVoo.horario_real || depVoo.horario_previsto}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-2">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="text-slate-700">
                            {arrVoo.aeroporto_origem_destino}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-700 font-semibold">
                            {arrVoo.aeroporto_operacao}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-700">
                            {depVoo.aeroporto_origem_destino}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              getTipoOperacao(arrVoo, todosAeroportos) === 'Doméstico' ?
                                'bg-green-50 text-green-700 border-green-200' :
                                'bg-purple-50 text-purple-700 border-purple-200'}`
                            }>
                            {getTipoOperacao(arrVoo, todosAeroportos)}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-600">
                            {depVoo.tipo_voo || 'Regular'}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs font-medium text-slate-900 whitespace-nowrap py-2">
                      {depVoo.registo_aeronave}
                    </TableCell>

                    <TableCell className="whitespace-nowrap py-2">
                      <div className="text-xs text-slate-700">{depVoo.companhia_aerea}</div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap py-2">
                      <div className="flex items-center gap-1.5">
                        <Timer className="h-3 w-3 text-orange-500" />
                        <span className="font-semibold text-slate-900 text-xs">
                          {tempoPermanenciaHoras}h
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {vooLigado.tempo_permanencia_min} min
                      </div>
                    </TableCell>

                    <TableCell className="py-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Users className="h-3 w-3 text-blue-600" />
                          <span className="font-medium text-slate-700">
                            {totalPax} PAX
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Package className="h-3 w-3 text-amber-600" />
                          <span className="text-slate-600">{totalCarga.toFixed(0)}kg</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-2">
                       {calculo ?
                         calculo.tipo_tarifa === "Voo Isento de Tarifas" ?
                           <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 whitespace-nowrap text-[10px] px-1.5 py-0.5">
                             Isento de Tarifas
                           </Badge> :
                           <div className="flex flex-col gap-0.5">
                             <div className="font-bold text-green-700 text-sm whitespace-nowrap">
                               {formatCurrency(calculo.total_tarifa || 0)}
                             </div>
                             <div className="text-[10px] text-slate-500 whitespace-nowrap">
                               ${(calculo.total_tarifa_usd || 0).toFixed(2)}
                             </div>
                             <div className="text-[10px] text-slate-400">
                               Câmbio: {calculo.taxa_cambio_usd_aoa} AOA
                             </div>
                           </div> :
                         <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 whitespace-nowrap text-[10px] px-1.5 py-0.5">
                           Sem Cálculo
                         </Badge>
                       }
                     </TableCell>

                    <TableCell className="text-sm text-slate-600 whitespace-nowrap py-2">
                       {calculo?.updated_date ? format(parseISO(calculo.updated_date), 'dd MMM HH:mm', { locale: pt }) : 'N/A'}
                    </TableCell>

                    <TableCell className="text-right py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isDuplicata && (
                            <>
                              <div className="px-2 py-1.5 text-xs text-red-600 font-semibold bg-red-50 border-l-2 border-red-500">
                                ⚠️ DUPLICATA DETECTADA
                              </div>
                              <DropdownMenuSeparator />
                            </>
                          )}

                          {calculo ? (
                            <>
                              <DropdownMenuItem onClick={() => onShowTariffDetails(calculo)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onRecalcularTarifa(vooLigado)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Recalcular Tarifas
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onAlterarCambio(calculo)}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Alterar Câmbio
                              </DropdownMenuItem>
                              {!isIsento && (
                                <DropdownMenuItem
                                  onClick={() => onGerarProforma(calculo)}
                                  className="text-blue-600"
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Gerar Proforma
                                </DropdownMenuItem>
                              )}
                            </>
                          ) : (
                            <DropdownMenuItem disabled>
                              Sem tarifas calculadas
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onVerDocumentosVoo && onVerDocumentosVoo(vooLigado)}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Documentos
                          </DropdownMenuItem>

                          {isAdmin && onExcluirVooLigado && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onExcluirVooLigado(vooLigado)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {isDuplicata ? 'Excluir Duplicata' : 'Excluir Vinculação'}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            }
          </TableBody>
        </Table>

        {voosLigados.length === 0 && !isLoading &&
          <div className="text-center py-10 text-slate-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Nenhum voo ligado encontrado.</p>
            <p className="text-sm mt-2">Crie voos de partida vinculados aos voos de chegada para ver a análise aqui.</p>
          </div>
        }
      </div>

      {voosLigados.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">
              Mostrando {startIndex + 1} a {Math.min(endIndex, voosLigados.length)} de {voosLigados.length} voos ligados
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              options={pageSizeOptions}
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
              className="w-40"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    className="w-10"
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}