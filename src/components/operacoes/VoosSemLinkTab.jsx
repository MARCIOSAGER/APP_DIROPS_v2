import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Unlink, Link2, Loader2, RefreshCw, Search, Filter, Trash2, ArrowRightLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

function VoosSemLinkTab({
  voosSemLink,
  voosSemLinkComputed,
  semLinkStats,
  isLoadingSemLink,
  isLinkingAuto,
  filtrosSemLink,
  semLinkLoaded,
  onLinkarAutomatico,
  onLinkarManual,
  onLoadSemLink,
  onFilterChange,
  onDeleteVoo,
  getSugestoesPar,
}) {
  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
        <div>
          <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
            <Unlink className="w-5 h-5 text-orange-500" />
            Voos Sem Link
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-2">
            Voos que ainda n&atilde;o foram vinculados (ARR + DEP). Use o link autom&aacute;tico ou vincule manualmente.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            onClick={onLinkarAutomatico}
            disabled={isLinkingAuto}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 sm:h-10 px-2 sm:px-4"
          >
            {isLinkingAuto ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            <span className="ml-2 text-sm">Linkar Autom&aacute;tico</span>
          </Button>
          <Button
            variant="outline"
            onClick={onLoadSemLink}
            disabled={isLoadingSemLink}
            className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-8 sm:h-10 px-2 sm:px-4"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoadingSemLink ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-2 text-sm">Atualizar</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">{semLinkStats.total}</div>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Total Sem Link</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{semLinkStats.arr}</div>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">ARR Sem Link</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{semLinkStats.dep}</div>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">DEP Sem Link</div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">{semLinkStats.sugestoes}</div>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Sugest&otilde;es de Pares</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4 sm:mb-6 border-slate-200 dark:border-slate-700">
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <Label className="text-xs">Data In&iacute;cio</Label>
                <Input
                  type="date"
                  value={filtrosSemLink.dataInicio}
                  onChange={(e) => onFilterChange(prev => ({ ...prev, dataInicio: e.target.value }))}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={filtrosSemLink.dataFim}
                  onChange={(e) => onFilterChange(prev => ({ ...prev, dataFim: e.target.value }))}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={filtrosSemLink.tipoMovimento}
                  onValueChange={(v) => onFilterChange(prev => ({ ...prev, tipoMovimento: v }))}
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'ARR', label: 'ARR' },
                    { value: 'DEP', label: 'DEP' }
                  ]}
                />
              </div>
              <div>
                <Label className="text-xs">Companhia</Label>
                <Select
                  value={filtrosSemLink.companhia}
                  onValueChange={(v) => onFilterChange(prev => ({ ...prev, companhia: v }))}
                  options={[
                    { value: 'todos', label: 'Todas' },
                    ...[...new Set(voosSemLink.map(v => v.companhia_aerea).filter(Boolean))].sort().map(c => ({ value: c, label: c }))
                  ]}
                />
              </div>
              <div>
                <Label className="text-xs">Registo</Label>
                <Select
                  value={filtrosSemLink.registo || 'todos'}
                  onValueChange={(v) => onFilterChange(prev => ({ ...prev, registo: v }))}
                  options={[
                    { value: 'todos', label: 'Todos' },
                    ...[...new Set(voosSemLink.map(v => v.registo_aeronave).filter(Boolean))].sort().map(r => ({ value: r, label: r }))
                  ]}
                />
              </div>
              <div>
                <Label className="text-xs">Pesquisar</Label>
                <Input
                  placeholder="Voo ou registo..."
                  value={filtrosSemLink.busca}
                  onChange={(e) => onFilterChange(prev => ({ ...prev, busca: e.target.value }))}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={onLoadSemLink}
                  disabled={isLoadingSemLink}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 sm:h-9 w-full"
                >
                  {isLoadingSemLink ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                  Buscar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading overlay */}
        {isLoadingSemLink && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3"></div>
            <span className="text-slate-500 dark:text-slate-400 text-sm">Carregando voos sem link...</span>
          </div>
        )}

        {/* Table */}
        {!isLoadingSemLink && (() => {
          const displayData = semLinkLoaded ? voosSemLink : voosSemLinkComputed;
          if (displayData.length === 0) {
            return (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Unlink className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-sm sm:text-base">
                  {semLinkLoaded ? 'Nenhum voo sem link encontrado com os filtros aplicados.' : 'Todos os voos estão vinculados ou clique em "Buscar" para filtrar.'}
                </p>
              </div>
            );
          }
          return (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Voo</TableHead>
                      <TableHead className="text-xs">Registo</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Companhia</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Rota</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Hor&aacute;rio</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Pax</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Origem</TableHead>
                      <TableHead className="text-xs text-right">A&ccedil;&otilde;es</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.map(voo => {
                      const sugestoes = getSugestoesPar(voo);
                      return (
                        <TableRow key={voo.id} className="text-xs sm:text-sm">
                          <TableCell>
                            <Badge className={`text-[10px] sm:text-xs ${voo.tipo_movimento === 'ARR' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
                              {voo.tipo_movimento}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {voo.data_operacao ? format(parseISO(voo.data_operacao), 'dd MMM yyyy', { locale: pt }) : 'N/A'}
                          </TableCell>
                          <TableCell className="font-medium text-xs">{voo.numero_voo || 'N/A'}</TableCell>
                          <TableCell className="text-xs">{voo.registo_aeronave || 'N/A'}</TableCell>
                          <TableCell className="text-xs hidden sm:table-cell">{voo.companhia_aerea || 'N/A'}</TableCell>
                          <TableCell className="text-xs hidden md:table-cell">
                            {voo.tipo_movimento === 'ARR'
                              ? `${voo.aeroporto_origem_destino || '?'} → ${voo.aeroporto_operacao || '?'}`
                              : `${voo.aeroporto_operacao || '?'} → ${voo.aeroporto_origem_destino || '?'}`}
                          </TableCell>
                          <TableCell className="text-xs hidden md:table-cell whitespace-nowrap">
                            {voo.horario_previsto || 'N/A'}{voo.horario_real ? ` / ${voo.horario_real}` : ''}
                          </TableCell>
                          <TableCell className="text-xs hidden lg:table-cell">{voo.passageiros_total ?? 'N/A'}</TableCell>
                          <TableCell className="text-xs hidden lg:table-cell">
                            {voo.created_by === 'FR24-Import' || voo.created_by === 'FlightAware-Import' || voo.created_by === 'FlightAware' ? (
                              <Badge variant="outline" className="text-[10px] border-sky-400 text-sky-600 dark:text-sky-400">FA</Badge>
                            ) : (
                              <span className="text-slate-400 truncate max-w-[80px] inline-block">{voo.created_by || 'N/A'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => onDeleteVoo(voo)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                                  disabled={sugestoes.length === 0}
                                >
                                  <ArrowRightLeft className="w-3 h-3 mr-1" />
                                  Sugerir Par
                                  {sugestoes.length > 0 && (
                                    <span className="ml-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[10px] px-1 rounded-full">{sugestoes.length}</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 sm:w-96 p-0" align="end">
                                <div className="p-3 border-b">
                                  <h4 className="text-sm font-medium">
                                    Sugest&otilde;es para {voo.numero_voo} ({voo.tipo_movimento})
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-1">Mesmo registo ({voo.registo_aeronave}), at&eacute; 7 dias</p>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                  {sugestoes.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-400">Nenhuma sugest&atilde;o encontrada</div>
                                  ) : (
                                    sugestoes.map(sug => (
                                      <div key={sug.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-0">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <Badge className={`text-[9px] ${sug.tipo_movimento === 'ARR' ? 'bg-emerald-600' : 'bg-blue-600'} text-white`}>
                                              {sug.tipo_movimento}
                                            </Badge>
                                            <span className="text-xs font-medium">{sug.numero_voo}</span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 mt-0.5">
                                            {sug.data_operacao ? format(parseISO(sug.data_operacao), 'dd MMM yyyy', { locale: pt }) : 'N/A'}
                                            {' - '}
                                            {sug.horario_previsto || 'N/A'}
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                          onClick={() => {
                                            const arrVoo = voo.tipo_movimento === 'ARR' ? voo : sug;
                                            const depVoo = voo.tipo_movimento === 'DEP' ? voo : sug;
                                            onLinkarManual(arrVoo, depVoo);
                                          }}
                                        >
                                          <Link2 className="w-3 h-3 mr-1" />
                                          Linkar
                                        </Button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

export default React.memo(VoosSemLinkTab);
