import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { RefreshCw, Download, Filter, X, Trash2, Plus } from 'lucide-react';
import VoosTable from './VoosTable';
import { isAdminProfile } from '@/components/lib/userUtils';

export default function VoosTab({
  voosFiltrados,
  isLoadingAll,
  isFiltering,
  filtros,
  aeroportos,
  companhias,
  voos,
  voosLigados,
  sortField,
  sortDirection,
  t,
  currentUser,
  onFilterChange,
  onSort,
  onBuscar,
  onClearFilters,
  onRefresh,
  onExportCSV,
  onOpenForm,
  onLixeira,
  onEditVoo,
  onCancelarVoo,
  onExcluirVoo,
}) {
  // Filter options - computed locally from props
  const companhiaOptions = useMemo(() => {
    const options = [{ value: 'todos', label: t('operacoes.todas_companhias') }];
    const knownCompanyCodes = new Set();
    companhias.forEach(c => {
      options.push({ value: c.codigo_icao, label: `${c.nome} (${c.codigo_icao})` });
      knownCompanyCodes.add(c.codigo_icao);
    });
    const hasOtherCompanies = voos.some(voo => voo.companhia_aerea && !knownCompanyCodes.has(voo.companhia_aerea));
    if (hasOtherCompanies) {
      options.push({ value: 'outro', label: t('operacoes.outra_companhia') });
    }
    return options;
  }, [companhias, voos, t]);

  const aeroportoOptions = useMemo(() => ([
    { value: 'todos', label: t('operacoes.todos_aeroportos') },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))
  ]), [aeroportos, t]);

  const tipoMovimentoOptions = useMemo(() => [
      { value: "todos", label: t('operacoes.todos') },
      { value: "ARR", label: t('operacoes.chegada') },
      { value: "DEP", label: t('operacoes.partida') },
  ], [t]);

  const tipoVooOptions = useMemo(() => [
    { value: 'todos', label: t('operacoes.todos') },
    { value: 'Regular', label: t('operacoes.regular') },
    { value: 'Não Regular', label: t('operacoes.nao_regular') },
    { value: 'Humanitário', label: t('operacoes.humanitario') },
    { value: 'Charter', label: t('operacoes.charter') },
    { value: 'Carga', label: t('operacoes.carga') },
    { value: 'Privado', label: t('operacoes.privado') },
    { value: 'Militar', label: t('operacoes.militar') },
    { value: 'Oficial', label: t('operacoes.oficial') },
    { value: 'Técnico', label: t('operacoes.tecnico') },
    { value: 'Outro', label: t('operacoes.outro') }
  ], [t]);

  const statusOptions = useMemo(() => ([
    { value: 'todos', label: t('operacoes.todos') },
    { value: 'Programado', label: t('operacoes.programado') },
    { value: 'Realizado', label: t('operacoes.realizado') },
    { value: 'Cancelado', label: t('operacoes.cancelado') },
  ]), [t]);

  const statusVinculacaoOptions = useMemo(() => [
    { value: 'todos', label: t('operacoes.todos_voos') },
    { value: 'ligado', label: t('operacoes.apenas_ligados') },
    { value: 'sem_link', label: t('operacoes.apenas_sem_link') }
  ], [t]);

  return (
          <div className="space-y-4 sm:space-y-6">
            <Card className="shadow-sm border-0">
              <CardHeader className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
                <div>
                  <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {t('operacoes.gestao_voos')}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{t('operacoes.gestao_voos_desc')}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Button variant="outline" onClick={onRefresh} disabled={isLoadingAll} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-10 px-2 sm:px-4">
                    <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoadingAll ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline ml-2 text-sm">{t('operacoes.atualizar')}</span>
                  </Button>
                  <Button variant="outline" onClick={onExportCSV} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-10 px-2 sm:px-4">
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline ml-2 text-sm">Excel</span>
                  </Button>
                  {isAdminProfile(currentUser) && (
                    <Button variant="outline" onClick={onLixeira} className="border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950 h-8 sm:h-10 px-2 sm:px-4">
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline ml-2 text-sm">{t('operacoes.lixeira')}</span>
                    </Button>
                  )}
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white h-8 sm:h-10 px-2 sm:px-4" onClick={() => onOpenForm('ARR', null)}>
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline ml-2 text-sm">{t('operacoes.adicionar_voo')}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <Card className="mb-4 sm:mb-6 border-slate-200 dark:border-slate-700">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
                      <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400" />
                      <span className="hidden sm:inline">{t('operacoes.filtros_pesquisa')}</span>
                      <span className="sm:hidden">{t('operacoes.filtros')}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div className="sm:col-span-2 lg:col-span-4">
                        <Label htmlFor="busca" className="text-xs sm:text-sm">{t('operacoes.pesquisar')}</Label>
                        <Input
                          id="busca"
                          placeholder={t('operacoes.voo_ou_matricula')}
                          value={filtros.busca}
                          onChange={(e) => onFilterChange('busca', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="data-inicio" className="text-xs sm:text-sm">{t('operacoes.data_inicio')}</Label>
                        <Input id="data-inicio" type="date" value={filtros.dataInicio} onChange={(e) => onFilterChange('dataInicio', e.target.value)} className="text-xs sm:text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="data-fim" className="text-xs sm:text-sm">{t('operacoes.data_fim')}</Label>
                        <Input id="data-fim" type="date" value={filtros.dataFim} onChange={(e) => onFilterChange('dataFim', e.target.value)} className="text-xs sm:text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="filtro-tipo" className="text-xs sm:text-sm">{t('operacoes.tipo')}</Label>
                        <Select
                          id="filtro-tipo"
                          options={tipoMovimentoOptions}
                          value={filtros.tipoMovimento}
                          onValueChange={(v) => onFilterChange('tipoMovimento', v)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-status" className="text-xs sm:text-sm">{t('operacoes.status')}</Label>
                        <Select
                          id="filtro-status"
                          options={statusOptions}
                          value={filtros.status}
                          onValueChange={(v) => onFilterChange('status', v)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-tipo-voo" className="text-xs sm:text-sm">{t('operacoes.tipo_voo')}</Label>
                        <Combobox
                          id="filtro-tipo-voo"
                          options={tipoVooOptions}
                          value={filtros.tipoVoo}
                          onValueChange={(v) => onFilterChange('tipoVoo', v)}
                          placeholder={`${t('operacoes.todos')}...`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-companhia" className="text-xs sm:text-sm">{t('operacoes.companhia')}</Label>
                        <Combobox
                          id="filtro-companhia"
                          options={companhiaOptions}
                          value={filtros.companhia}
                          onValueChange={(v) => onFilterChange('companhia', v)}
                          placeholder={`${t('operacoes.todos')}...`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-aeroporto" className="text-xs sm:text-sm">{t('operacoes.aeroporto')}</Label>
                        <Combobox
                          id="filtro-aeroporto"
                          options={aeroportoOptions}
                          value={filtros.aeroporto}
                          onValueChange={(v) => onFilterChange('aeroporto', v)}
                          placeholder={`${t('operacoes.todos')}...`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-vinculacao" className="text-xs sm:text-sm">{t('operacoes.vinculacao')}</Label>
                        <Select
                          id="filtro-vinculacao"
                          options={statusVinculacaoOptions}
                          value={filtros.statusVinculacao}
                          onValueChange={(v) => onFilterChange('statusVinculacao', v)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="filtro-origem" className="text-xs sm:text-sm">{t('operacoes.origem') || 'Origem'}</Label>
                        <Select
                          id="filtro-origem"
                          options={[
                            { value: 'todos', label: t('operacoes.todos') || 'Todos' },
                            { value: 'flightaware', label: 'FlightAware-Import' },
                            { value: 'sistema', label: t('operacoes.sistema') || 'Sistema' },
                            { value: 'manual', label: 'Manual' }
                          ]}
                          value={filtros.origem}
                          onValueChange={(v) => onFilterChange('origem', v)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="passageiros-min" className="text-xs sm:text-sm">{t('operacoes.passageiros_min')}</Label>
                        <Input
                          id="passageiros-min"
                          type="number"
                          placeholder="0"
                          value={filtros.passageirosMin}
                          onChange={(e) => onFilterChange('passageirosMin', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="passageiros-max" className="text-xs sm:text-sm">{t('operacoes.passageiros_max')}</Label>
                        <Input
                          id="passageiros-max"
                          type="number"
                          placeholder="999"
                          value={filtros.passageirosMax}
                          onChange={(e) => onFilterChange('passageirosMax', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="carga-min" className="text-xs sm:text-sm">{t('operacoes.carga_min')}</Label>
                        <Input
                          id="carga-min"
                          type="number"
                          placeholder="0"
                          value={filtros.cargaMin}
                          onChange={(e) => onFilterChange('cargaMin', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="carga-max" className="text-xs sm:text-sm">{t('operacoes.carga_max')}</Label>
                        <Input
                          id="carga-max"
                          type="number"
                          placeholder="50000"
                          value={filtros.cargaMax}
                          onChange={(e) => onFilterChange('cargaMax', e.target.value)}
                          className="text-xs sm:text-sm"
                        />
                      </div>

                      <div className="flex items-end gap-2 sm:col-span-2">
                        <Button
                          onClick={onBuscar}
                          disabled={isFiltering}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 text-xs sm:text-sm"
                        >
                          {isFiltering ? <><RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" /> Buscando...</> : <><Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-2" /> Buscar</>}
                        </Button>
                        <Button variant="outline" onClick={onClearFilters} className="flex-1 text-xs sm:text-sm">
                          <X className="w-3 h-3 sm:w-4 sm:h-4 mr-2" /> {t('operacoes.limpar')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {isFiltering && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">{t('operacoes.carregando_voos')}</p>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <VoosTable
                      voos={voosFiltrados}
                      voosLigados={voosLigados}
                      isLoading={isLoadingAll}
                      onEditVoo={onEditVoo}
                      onCancelarVoo={onCancelarVoo}
                      onExcluirVoo={onExcluirVoo}
                      currentUser={currentUser}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={onSort}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
  );
}
