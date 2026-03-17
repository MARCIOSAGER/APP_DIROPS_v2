import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Link as LinkIcon, Edit, MoreVertical, Trash2, XCircle, ChevronLeft, ChevronRight, Users, Package, Plane } from 'lucide-react';
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
import { useI18n } from '@/components/lib/i18n';

const STATUS_CONFIG = {
  Programado: { color: 'bg-blue-100 text-blue-800 border-blue-200' },
  Realizado: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  Cancelado: { color: 'bg-red-100 text-red-800 border-red-200' }
};

export default function VoosTable({
  voos,
  voosLigados,
  isLoading,
  onEditVoo,
  onCancelarVoo,
  onExcluirVoo,
  currentUser,
  showLinkAction = false,
  onLinkVoo,
  sortField = 'data_operacao',
  sortDirection = 'desc',
  onSort
}) {
  const { t } = useI18n();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // O(1) lookup maps instead of O(n²) nested loops
  const vooIdsSet = useMemo(() => new Set(voos.map(v => v.id)), [voos]);
  const linkedVooIds = useMemo(() => {
    const set = new Set();
    for (const vl of voosLigados) {
      if (vooIdsSet.has(vl.id_voo_arr) && vooIdsSet.has(vl.id_voo_dep)) {
        set.add(vl.id_voo_arr);
        set.add(vl.id_voo_dep);
      }
    }
    return set;
  }, [voosLigados, vooIdsSet]);

  const isVooLigado = (voo) => {
    return !!voo.voo_ligado_id || linkedVooIds.has(voo.id);
  };

  const handleCancelarVoo = (voo) => {
    if (onCancelarVoo) {
      onCancelarVoo(voo);
    }
  };

  const handleExcluirVoo = (voo) => {
    if (onExcluirVoo) {
      onExcluirVoo(voo);
    }
  };

  const handleSort = (field, direction) => {
    if (onSort) {
      onSort(field, direction);
    }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.perfis?.includes('administrador');
  
  // Cálculos de paginação (memoized to avoid re-slicing on every render)
  const totalPages = Math.ceil(voos.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentVoos = useMemo(() => voos.slice(startIndex, endIndex), [voos, startIndex, endIndex]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
  };

  const pageSizeOptions = [
    { value: '10', label: t('voosTable.porPagina10') },
    { value: '25', label: t('voosTable.porPagina25') },
    { value: '50', label: t('voosTable.porPagina50') },
    { value: '100', label: t('voosTable.porPagina100') }
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
      <div className={`border rounded-lg overflow-x-auto overflow-y-auto ${getTableHeight()}`}>
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10">
            <TableRow>
              <SortableTableHeader
                field="tipo_movimento"
                label={t('voosTable.tipo')}
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                field="data_operacao"
                label={t('voosTable.data')}
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                field="numero_voo"
                label={t('voosTable.voo')}
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <TableHead>{t('voosTable.rota')}</TableHead>
              <SortableTableHeader
                field="registo_aeronave"
                label={t('voosTable.registo')}
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <TableHead>{t('voosTable.horarioPrevReal')}</TableHead>
              <SortableTableHeader
                field="passageiros_total"
                label={t('voosTable.passageiros')}
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                field="carga_kg"
                label={t('voosTable.cargaKg')}
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                field="status"
                label={t('voosTable.status')}
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                field="updated_by"
                label={t('voosTable.atualizadoPor')}
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <TableHead className="text-right">{t('voosTable.acoes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ?
              Array(pageSize).fill(0).map((_, i) =>
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ) :
              currentVoos.map((voo) => {
                const statusConfig = STATUS_CONFIG[voo.status] || STATUS_CONFIG.Programado;
                const isLinked = isVooLigado(voo);
                const podeSerCancelado = voo.status !== 'Cancelado' && voo.status !== 'Realizado';
                
                const userEmail = voo.updated_by || voo.created_by || 'N/A';
                const userName = userEmail !== 'N/A' ? userEmail.split('@')[0] : 'N/A';
                
                const updatedDate = voo.updated_date || voo.created_date;
                const formattedUpdateDate = updatedDate ? format(parseISO(updatedDate), "dd/MM/yyyy HH:mm", { locale: pt }) : '';

                return (
                  <TableRow key={voo.id} className={`${!isLinked && voo.status !== 'Cancelado' ? 'bg-red-100/70 shadow-sm' : ''} hover:bg-slate-50 transition-colors`}>
                    <TableCell>
                      <Badge variant={voo.tipo_movimento === 'ARR' ? 'default' : 'secondary'} className={`flex items-center gap-1 w-fit ${voo.tipo_movimento === 'ARR' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
                        {isLinked && <LinkIcon className="h-3 w-3" />}
                        {voo.tipo_movimento}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {format(parseISO(voo.data_operacao), "dd MMM yyyy", { locale: pt })}
                    </TableCell>
                    <TableCell>
                       <div className="font-medium text-slate-900">{voo.numero_voo}</div>
                       {/* Mostrar código da companhia ou ID se não tiver código */}
                       <div className="text-sm text-slate-500">{voo.companhia_aerea || 'N/A'}</div>
                     </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        {voo.tipo_movimento === 'ARR' ? voo.aeroporto_origem_destino : voo.aeroporto_operacao}
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        {voo.tipo_movimento === 'ARR' ? voo.aeroporto_operacao : voo.aeroporto_origem_destino}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm font-medium text-slate-900">{voo.registo_aeronave}</div>
                      <div className="text-xs text-slate-500">{voo.tipo_voo || t('voosTable.regular')}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono">{voo.horario_previsto}</div>
                      {voo.horario_real &&
                        <div className={`text-sm font-mono font-semibold ${voo.horario_real > voo.horario_previsto ? 'text-red-500' : 'text-green-600'}`}>
                          {voo.horario_real}
                        </div>
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-3 w-3 text-slate-400" />
                        <span className="font-medium">{voo.passageiros_total || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Package className="h-3 w-3 text-slate-400" />
                        <span className="font-medium">{new Intl.NumberFormat('pt-AO').format(voo.carga_kg || 0)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${statusConfig.color} border font-medium`}>{voo.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-600 max-w-[150px] truncate" title={userEmail}>
                        {userName}
                      </div>
                      {formattedUpdateDate && (
                        <div className="text-xs text-slate-400 whitespace-nowrap">
                          {formattedUpdateDate}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExcluirVoo(voo)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title={t('voosTable.moverLixeira')}
                            aria-label={t('voosTable.moverLixeira')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" aria-label={t('voosTable.maisOpcoes')}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditVoo(voo)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t('voosTable.editarVoo')}
                            </DropdownMenuItem>

                            {!isLinked && voo.tipo_movimento === 'ARR' && onLinkVoo &&
                              <DropdownMenuItem
                                className="text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                                onClick={() => onLinkVoo(voo)}>
                                <LinkIcon className="mr-2 h-4 w-4" />
                                {t('voosTable.criarVooDepLinkado')}
                              </DropdownMenuItem>
                            }

                            {podeSerCancelado &&
                              <DropdownMenuItem
                                className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                onClick={() => handleCancelarVoo(voo)}>
                                <XCircle className="mr-2 h-4 w-4" />
                                {t('voosTable.cancelarVoo')}
                              </DropdownMenuItem>
                            }
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            }
          </TableBody>
        </Table>
        {voos.length === 0 && !isLoading &&
          <div className="text-center py-12 text-muted-foreground">
            <Plane className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-lg font-medium">{t('voosTable.nenhumResultado')}</p>
            <p className="text-sm mt-1">{t('voosTable.ajustarFiltros')}</p>
          </div>
        }
      </div>

      {voos.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">
              {t('voosTable.mostrando')} {startIndex + 1} {t('voosTable.a')} {Math.min(endIndex, voos.length)} {t('voosTable.de')} {voos.length} {t('voosTable.voos')}
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
              {t('voosTable.anterior')}
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
              {t('voosTable.proxima')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}