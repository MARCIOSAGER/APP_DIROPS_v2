import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download } from 'lucide-react';
import VoosLigadosFilters from './VoosLigadosFilters';
import VoosLigadosTable from './VoosLigadosTable';

const VoosLigadosTab = React.memo(function VoosLigadosTab({
  voosLigadosValidos,
  voosLigadosFiltrados,
  voos,
  calculosTarifa,
  todosAeroportos,
  companhias,
  isLoadingAll,
  isFilteringLigados,
  filtrosLigados,
  sortFieldLigados,
  sortDirectionLigados,
  currentUser,
  t,
  onBuscar,
  onFilterChange,
  onClearFilters,
  onSort,
  onExcluirVooLigado,
  onRecalcularTarifaSingle,
  onRecalcularTarifasLote,
  onShowTariffDetails,
  onExportTariffPDF,
  onExportCSV,
  onGerarProforma,
  onAlterarCambio,
  onUploadDocumento,
  onVerDocumentosVoo,
  onRecursosVoo,
  onRefresh,
}) {
  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
        <div>
          <CardTitle className="text-base sm:text-lg md:text-xl flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="w-fit text-xs">
                {voosLigadosValidos.length} {t('operacoes.pares')}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-2">
            {t('operacoes.voos_ligados_desc')}
          </CardDescription>
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
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <VoosLigadosFilters
           filtros={filtrosLigados}
           onFilterChange={onFilterChange}
           onClearFilters={onClearFilters}
           onBuscar={onBuscar}
           isSearching={isFilteringLigados}
           companhias={companhias}
           aeroportos={todosAeroportos}
         />

        {isFilteringLigados && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-700 dark:text-slate-300 font-medium">{t('operacoes.carregando_ligados')}</p>
            </div>
          </div>
        )}

        {voosLigadosFiltrados.length === 0 && !isLoadingAll ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p className="text-sm sm:text-base">{t('operacoes.nenhum_voo_ligado')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <VoosLigadosTable
                voosLigados={voosLigadosFiltrados}
                voos={voos}
                calculosTarifa={calculosTarifa}
                isLoading={isLoadingAll}
                onShowTariffDetails={onShowTariffDetails}
                onExportPDF={onExportTariffPDF}
                onGerarProforma={onGerarProforma}
                onRecalcularTarifa={onRecalcularTarifaSingle}
                onRecalcularTarifaLote={onRecalcularTarifasLote}
                onAlterarCambio={onAlterarCambio}
                onExcluirVooLigado={onExcluirVooLigado}
                onUploadDocumento={onUploadDocumento}
                onVerDocumentosVoo={onVerDocumentosVoo}
                onRecursosVoo={onRecursosVoo}
                todosAeroportos={todosAeroportos}
                sortField={sortFieldLigados}
                sortDirection={sortDirectionLigados}
                onSort={onSort}
                currentUser={currentUser}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default VoosLigadosTab;
