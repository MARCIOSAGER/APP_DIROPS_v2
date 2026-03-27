import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Combobox from '@/components/ui/combobox';
import Select from '@/components/ui/select';
import { Filter, X, Search, Loader2 } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

/**
 * Shared filter card used by both Processos and PACs tabs.
 *
 * Props:
 * - filtros, setFiltros - filter state
 * - aeroportoOptions - combobox options for aeroporto
 * - statusOptions - select options for status
 * - hasActiveFilters - boolean
 * - onBuscar - search handler
 * - onClear - clear filters handler
 * - isSearching - boolean
 * - responsavelPlaceholder - placeholder text for responsavel input
 * - dateStartLabel - label for start date
 * - dateEndLabel - label for end date
 * - idPrefix - prefix for element ids to avoid duplicate ids when both tabs mount
 */
export default function AuditoriaFilters({
  filtros,
  setFiltros,
  aeroportoOptions,
  statusOptions,
  hasActiveFilters,
  onBuscar,
  onClear,
  isSearching,
  responsavelPlaceholder,
  dateStartLabel,
  dateEndLabel,
  idPrefix = ''
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            {t('auditoria.filtrosPesquisa')}
          </CardTitle>
          {hasActiveFilters &&
          <Button variant="ghost" size="sm" onClick={onClear} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600">
              <X className="w-4 h-4 mr-1" />
              {t('auditoria.limparFiltros')}
            </Button>
          }
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}filtro-aeroporto`}>{t('auditoria.aeroporto')}</Label>
            <Combobox
              options={aeroportoOptions}
              value={filtros.aeroporto}
              onValueChange={(value) => setFiltros((f) => ({ ...f, aeroporto: value || 'todos' }))}
              placeholder={t('auditoria.todosAeroportos')}
              noResultsMessage={t('auditoria.nenhumAeroporto')}
              searchPlaceholder={t('auditoria.procurarAeroporto')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}filtro-status`}>{t('auditoria.status')}</Label>
            <Select
              id={`${idPrefix}filtro-status`}
              options={statusOptions}
              value={filtros.status}
              onValueChange={(value) => setFiltros((f) => ({ ...f, status: value }))}
              placeholder={t('auditoria.todasCategorias')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}filtro-responsavel`}>{t('auditoria.responsavel')}</Label>
            <Input
              id={`${idPrefix}filtro-responsavel`}
              placeholder={responsavelPlaceholder || t('auditoria.nomeAuditor')}
              value={filtros.responsavel}
              onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}filtro-data-inicio`}>{dateStartLabel || t('auditoria.dataInicio')}</Label>
            <Input
              id={`${idPrefix}filtro-data-inicio`}
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}filtro-data-fim`}>{dateEndLabel || t('auditoria.dataFim')}</Label>
            <Input
              id={`${idPrefix}filtro-data-fim`}
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-end gap-2 mt-2">
          <Button onClick={onBuscar} disabled={isSearching} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isSearching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</> : <><Search className="w-4 h-4 mr-2" /> Buscar</>}
          </Button>
          <Button variant="outline" onClick={onClear}>
            <X className="w-4 h-4 mr-2" /> Limpar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
