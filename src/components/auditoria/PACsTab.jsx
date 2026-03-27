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

export default function PACsTab({
  pacs,
  processosAuditoria,
  tiposAuditoria,
  aeroportos,
  filtros,
  setFiltros,
  aeroportoOptions,
  hasActiveFilters,
  onBuscar,
  onClear,
  isSearching,
  isLoading,
  gestaoPermission,
  onEditPAC,
  onDeletePAC
}) {
  const { t } = useI18n();

  const [viewModePAC, setViewModePAC] = useState('list');
  const [sortOrderPAC, setSortOrderPAC] = useState('desc');
  const [sortFieldPAC, setSortFieldPAC] = useState('data_criacao');

  const pacStatusOptions = [
    { value: "todos", label: t('auditoria.todasCategorias') },
    { value: "elaboracao", label: t('auditoria.elaboracao') },
    { value: "submetido", label: t('auditoria.submetido') },
    { value: "aprovado", label: t('auditoria.aprovado') },
    { value: "em_execucao", label: t('auditoria.em_execucao') },
    { value: "concluido", label: t('auditoria.concluido') },
    { value: "vencido", label: t('auditoria.vencido') }
  ];

  const filteredPacs = useMemo(() => {
    const filtered = pacs.filter((pac) => {
      const responsavelMatch = !filtros.responsavel || pac.responsavel_elaboracao?.toLowerCase().includes(filtros.responsavel.toLowerCase());
      return responsavelMatch;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortFieldPAC) {
        case 'data_criacao':
          comparison = new Date(a.data_criacao || 0) - new Date(b.data_criacao || 0);
          break;
        case 'numero_pac':
          comparison = (a.numero_pac || '').localeCompare(b.numero_pac || '');
          break;
        case 'prazo_conclusao':
          comparison = new Date(a.prazo_conclusao || 0) - new Date(b.prazo_conclusao || 0);
          break;
        case 'progresso':
          comparison = (a.percentual_conclusao || 0) - (b.percentual_conclusao || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          comparison = 0;
      }
      return sortOrderPAC === 'asc' ? comparison : -comparison;
    });
  }, [pacs, filtros.responsavel, sortFieldPAC, sortOrderPAC]);

  return (
    <div className="space-y-6">
      <AuditoriaFilters
        filtros={filtros}
        setFiltros={setFiltros}
        aeroportoOptions={aeroportoOptions}
        statusOptions={pacStatusOptions}
        hasActiveFilters={hasActiveFilters}
        onBuscar={onBuscar}
        onClear={onClear}
        isSearching={isSearching}
        responsavelPlaceholder={t('auditoria.nomeResponsavel')}
        dateStartLabel={t('auditoria.dataCriacaoInicio')}
        dateEndLabel={t('auditoria.dataCriacaoFim')}
        idPrefix="pac-"
      />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('auditoria.planosAcaoCorretiva')} ({filteredPacs.length})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewModePAC === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewModePAC('list')}>
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewModePAC === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewModePAC('grid')}>
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrderPAC(sortOrderPAC === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" />
                {sortOrderPAC === 'asc' ? t('auditoria.crescente') : t('auditoria.decrescente')}
              </Button>
              <Select
                options={[
                  { value: 'data_criacao', label: t('auditoria.ordenarPorDataCriacao') },
                  { value: 'numero_pac', label: t('auditoria.ordenarPorNumero') },
                  { value: 'prazo_conclusao', label: t('auditoria.ordenarPorPrazo') },
                  { value: 'progresso', label: t('auditoria.ordenarPorProgresso') },
                  { value: 'status', label: t('auditoria.ordenarPorStatus') }
                ]}
                value={sortFieldPAC}
                onValueChange={setSortFieldPAC}
                placeholder={t('auditoria.ordenarPor')} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ?
          <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">{t('auditoria.carregandoPACs')}</p>
            </div> :
          filteredPacs.length === 0 ?
          <div className="text-center py-8">
              <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t('auditoria.nenhumPAC')}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {t('auditoria.nenhumPACDesc')}
              </p>
            </div> :

          <div className={viewModePAC === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
              {filteredPacs.map((pac) => {
              const aeroporto = aeroportos.find((a) => a.codigo_icao === pac.aeroporto_id);
              const processo = processosAuditoria.find((p) => p.id === pac.processo_auditoria_id);
              const tipo = processo ? tiposAuditoria.find((t) => t.id === processo.tipo_auditoria_id) : null;

              const statusConfig = {
                elaboracao: { label: t('auditoria.elaboracao'), color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' },
                submetido: { label: t('auditoria.submetido'), color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' },
                aprovado: { label: t('auditoria.aprovado'), color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' },
                em_execucao: { label: t('auditoria.em_execucao'), color: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' },
                concluido: { label: t('auditoria.concluido'), color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200' },
                vencido: { label: t('auditoria.vencido'), color: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' }
              };

              const config = statusConfig[pac.status] || statusConfig.elaboracao;

              return (
                <Card
                  key={pac.id}
                  className="hover:shadow-md transition-shadow group">

                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => onEditPAC(pac)}>
                          <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">{pac.numero_pac}</h3>
                          <p className="text-slate-600 dark:text-slate-400 capitalize">
                            {pac.tipo === 'formal_anac' ? t('auditoria.formalAnac') : t('auditoria.interno')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={config.color}>
                            {config.label}
                          </Badge>
                          {gestaoPermission && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditPAC(pac);
                                }}
                                className="h-8 w-8">
                                <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeletePAC(pac);
                                }}
                                className="h-8 w-8">
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={viewModePAC === 'grid' ? 'space-y-3 mb-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'}>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('auditoria.aeroporto')}</p>
                            <p className="font-medium text-sm">{aeroporto?.nome || pac.aeroporto_id}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('auditoria.responsavel')}</p>
                            <p className="font-medium text-sm">{pac.responsavel_elaboracao}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('auditoria.prazo')}</p>
                            <p className="font-medium text-sm">
                              {pac.prazo_conclusao ? format(new Date(pac.prazo_conclusao), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('auditoria.progresso')}</p>
                            <p className="font-medium text-sm">{(pac.percentual_conclusao || 0).toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>

                      {tipo && processo &&
                    <div className="mb-4">
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('auditoria.auditoriaRelacionada')}</p>
                          <p className="font-medium text-sm">{tipo.nome} ({processo.numero_auditoria})</p>
                        </div>
                    }

                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>{pac.total_nao_conformidades || 0} NC</span>
                        <span>{pac.nao_conformidades_concluidas || 0} {t('auditoria.concluidas_items')}</span>
                        <span className="text-xs">{t('auditoria.criadoEm')} {format(new Date(pac.data_criacao), 'dd/MM/yyyy', { locale: pt })}</span>
                      </div>
                    </CardContent>
                  </Card>);

            })}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
