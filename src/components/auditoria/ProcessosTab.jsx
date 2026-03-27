import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Select from '@/components/ui/select';
import {
  FileText, MapPin, User as UserIcon, Calendar, BarChart3,
  Grid, List, ArrowUpDown, Edit, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useI18n } from '@/components/lib/i18n';
import AuditoriaFilters from './AuditoriaFilters';

const CATEGORIAS_CONFIG = {
  seguranca_operacional: { labelKey: 'auditoria.segurancaOperacional' },
  seguranca_avsec: { labelKey: 'auditoria.segurancaAvsec' },
  resposta_emergencia: { labelKey: 'auditoria.respostaEmergencia' },
  infraestrutura: { labelKey: 'auditoria.infraestrutura' },
  operacoes: { labelKey: 'auditoria.operacoes' }
};

export default function ProcessosTab({
  processosAuditoria,
  tiposAuditoria,
  aeroportos,
  filtros,
  setFiltros,
  aeroportoOptions,
  selectedCategoria,
  hasActiveFilters,
  onBuscar,
  onClear,
  isSearching,
  isLoading,
  gestaoPermission,
  onView,
  onEdit,
  onDelete
}) {
  const { t } = useI18n();

  const [viewMode, setViewMode] = useState('list');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortField, setSortField] = useState('data_auditoria');

  const statusOptions = [
    { value: "todos", label: t('auditoria.todasCategorias') },
    { value: "planejada", label: t('auditoria.planejada') },
    { value: "em_andamento", label: t('auditoria.em_andamento') },
    { value: "concluida", label: t('auditoria.concluidas') },
    { value: "aprovada", label: t('auditoria.aprovada') }
  ];

  const filteredProcessos = useMemo(() => {
    const filtered = processosAuditoria.filter((proc) => {
      const tipo = tiposAuditoria.find((t) => t.id === proc.tipo_auditoria_id);
      const categoriaMatch = selectedCategoria === 'todos' || tipo?.categoria === selectedCategoria;
      const responsavelMatch = !filtros.responsavel || proc.auditor_responsavel?.toLowerCase().includes(filtros.responsavel.toLowerCase());
      return categoriaMatch && responsavelMatch;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'data_auditoria':
          comparison = new Date(a.data_auditoria || 0) - new Date(b.data_auditoria || 0);
          break;
        case 'numero_auditoria':
          comparison = (a.numero_auditoria || '').localeCompare(b.numero_auditoria || '');
          break;
        case 'conformidade':
          comparison = (a.percentual_conformidade || 0) - (b.percentual_conformidade || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [processosAuditoria, filtros.responsavel, selectedCategoria, tiposAuditoria, sortField, sortOrder]);

  return (
    <div className="space-y-6">
      <AuditoriaFilters
        filtros={filtros}
        setFiltros={setFiltros}
        aeroportoOptions={aeroportoOptions}
        statusOptions={statusOptions}
        hasActiveFilters={hasActiveFilters}
        onBuscar={onBuscar}
        onClear={onClear}
        isSearching={isSearching}
        idPrefix=""
      />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('auditoria.processosAuditoria')} ({filteredProcessos.length})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}>
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}>
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" />
                {sortOrder === 'asc' ? t('auditoria.crescente') : t('auditoria.decrescente')}
              </Button>
              <Select
                options={[
                  { value: 'data_auditoria', label: t('auditoria.ordenarPorData') },
                  { value: 'numero_auditoria', label: t('auditoria.ordenarPorNumero') },
                  { value: 'conformidade', label: t('auditoria.ordenarPorConformidade') },
                  { value: 'status', label: t('auditoria.ordenarPorStatus') }
                ]}
                value={sortField}
                onValueChange={setSortField}
                placeholder={t('auditoria.ordenarPor')} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">{t('auditoria.carregandoAuditorias')}</p>
            </div>
          ) : filteredProcessos.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t('auditoria.nenhumaAuditoria')}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {t('auditoria.nenhumaAuditoriaDesc')}
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
              {filteredProcessos.map((processo) => {
                const tipo = tiposAuditoria.find(t => t.id === processo.tipo_auditoria_id);
                const aeroporto = aeroportos.find(a => a.codigo_icao === processo.aeroporto_id);

                const statusConfig = {
                  planejada: { label: t('auditoria.planejada'), color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' },
                  em_andamento: { label: t('auditoria.em_andamento'), color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' },
                  concluida: { label: t('auditoria.concluidas'), color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' },
                  aprovada: { label: t('auditoria.aprovada'), color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200' }
                };

                const config = statusConfig[processo.status] || statusConfig.planejada;

                return (
                  <Card
                    key={processo.id}
                    className="hover:shadow-md transition-shadow group"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => onView(processo)}>
                          <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">{processo.numero_auditoria}</h3>
                          <p className="text-slate-600 dark:text-slate-400">{tipo?.nome || t('auditoria.tipoNaoEncontrado')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={config.color}>{config.label}</Badge>
                          {gestaoPermission && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(processo);
                                }}
                                className="h-8 w-8">
                                <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(processo);
                                }}
                                className="h-8 w-8">
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={viewMode === 'grid' ? 'space-y-3 mb-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'}>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('auditoria.aeroporto')}</p>
                            <p className="font-medium text-sm">{aeroporto?.nome || processo.aeroporto_id}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('auditoria.auditor')}</p>
                            <p className="font-medium text-sm">{processo.auditor_responsavel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('auditoria.data')}</p>
                            <p className="font-medium text-sm">
                              {processo.data_auditoria ? format(new Date(processo.data_auditoria), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('auditoria.conformidade')}</p>
                            <p className="font-medium text-sm">{(processo.percentual_conformidade || 0).toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>{processo.total_itens || 0} {t('auditoria.itens')}</span>
                        <span className="text-green-600 dark:text-green-400">{processo.itens_conformes || 0} {t('auditoria.conformes')}</span>
                        <span className="text-red-600 dark:text-red-400">{processo.itens_nao_conformes || 0} NC</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
