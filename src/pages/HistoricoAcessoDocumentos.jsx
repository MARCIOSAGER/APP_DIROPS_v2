import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Eye, Search, Calendar, User, MapPin, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import Select from '@/components/ui/select';
import { useI18n } from '@/components/lib/i18n';

const TIPO_ACESSO_CONFIG_BASE = {
  visualizacao: { color: 'bg-blue-100 text-blue-800', icon: Eye, labelKey: 'historico.visualizacao' },
  download: { color: 'bg-green-100 text-green-800', icon: Download, labelKey: 'historico.download' },
  edicao: { color: 'bg-orange-100 text-orange-800', icon: FileText, labelKey: 'historico.edicao' }
};

export default function HistoricoAcessoDocumentos() {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [documentoFilter, setDocumentoFilter] = useState('todos');
  const [sortField, setSortField] = useState('data_hora_acesso');
  const [sortDirection, setSortDirection] = useState('desc');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRegistos, setTotalRegistos] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 50;

  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    loadData().then(() => setInitialLoadDone(true));
  }, []);

  // Reload logs when server-side filters change
  useEffect(() => {
    if (initialLoadDone) {
      setCurrentPage(1);
      loadLogs(1);
    }
  }, [tipoFilter, documentoFilter, dataInicio, dataFim, sortField, sortDirection]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logsResult, docsData] = await Promise.all([
        buildPaginatedQuery(1),
        base44.entities.Documento.list()
      ]);
      setLogs(logsResult.data);
      setTotalRegistos(logsResult.total);
      setTotalPages(logsResult.totalPages);
      setCurrentPage(logsResult.page);
      setDocumentos(docsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildPaginatedQuery = async (page) => {
    const serverFilters = {};
    if (tipoFilter !== 'todos') serverFilters.tipo_acesso = tipoFilter;
    if (documentoFilter !== 'todos') serverFilters.documento_id = documentoFilter;
    if (dataInicio) serverFilters.data_hora_acesso = { ...serverFilters.data_hora_acesso, $gte: dataInicio };
    if (dataFim) {
      const endDate = new Date(dataFim);
      endDate.setHours(23, 59, 59, 999);
      serverFilters.data_hora_acesso = { ...serverFilters.data_hora_acesso, $lte: endDate.toISOString() };
    }

    const orderBy = `${sortDirection === 'desc' ? '-' : ''}${sortField}`;

    return base44.entities.LogAcessoDocumento.paginate({
      filters: serverFilters,
      orderBy,
      page,
      pageSize: PAGE_SIZE,
    });
  };

  const loadLogs = async (page) => {
    try {
      const result = await buildPaginatedQuery(page);
      setLogs(result.data);
      setTotalRegistos(result.total);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadLogs(newPage);
  };

  const documentoMap = useMemo(() => {
    const map = new Map();
    documentos.forEach(d => map.set(d.id, d.titulo || d.nome || d.id));
    return map;
  }, [documentos]);

  const getDocumentoNome = (docId) => {
    return documentoMap.get(docId) || t('historico.documento_removido');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Client-side text search only; sorting and other filters are server-side
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    return logs.filter(log => {
      return (
        log.usuario_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getDocumentoNome(log.documento_id).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [logs, searchTerm, documentoMap]);

  const stats = {
    total: totalRegistos,
    visualizacoes: logs.filter(l => l.tipo_acesso === 'visualizacao').length,
    downloads: logs.filter(l => l.tipo_acesso === 'download').length,
    ultimasHoras: logs.filter(l => {
      const diff = Date.now() - new Date(l.data_hora_acesso).getTime();
      return diff < 24 * 60 * 60 * 1000;
    }).length
  };

  const tipoOptions = [
    { value: 'todos', label: t('historico.todos_tipos') },
    { value: 'visualizacao', label: t('historico.visualizacao') },
    { value: 'download', label: t('historico.download') },
    { value: 'edicao', label: t('historico.edicao') }
  ];

  const documentoOptions = [
    { value: 'todos', label: t('historico.todos_documentos') },
    ...documentos.map(doc => ({
      value: doc.id,
      label: doc.titulo
    }))
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">{t('historico.carregando')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('historico.titulo')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{t('historico.subtitulo')}</p>
        </div>
        <Button onClick={loadData} variant="outline">
          {t('historico.atualizar')}
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('historico.total_acessos')}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('historico.visualizacoes')}</p>
                <p className="text-2xl font-bold text-blue-900">{stats.visualizacoes}</p>
              </div>
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('historico.downloads')}</p>
                <p className="text-2xl font-bold text-green-900">{stats.downloads}</p>
              </div>
              <Download className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('historico.ultimas_24h')}</p>
                <p className="text-2xl font-bold text-orange-900">{stats.ultimasHoras}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">{t('historico.pesquisar')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder={t('historico.pesquisar_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('historico.tipo_acesso')}</Label>
              <Select
                options={tipoOptions}
                value={tipoFilter}
                onValueChange={setTipoFilter}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('historico.documento')}</Label>
              <Select
                options={documentoOptions}
                value={documentoFilter}
                onValueChange={setDocumentoFilter}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-inicio">{t('historico.data_inicio')}</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-fim">{t('historico.data_fim')}</Label>
              <Input
                id="data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('historico.registros_acesso')} ({totalRegistos})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t('historico.nenhum_registro')}
              </h3>
              <p>{t('historico.nenhum_registro_desc')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => handleSort('data_hora_acesso')}
                        className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                      >
                        {t('historico.col_data_hora')}
                        {sortField === 'data_hora_acesso' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('documento_id')}
                        className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                      >
                        {t('historico.col_documento')}
                        {sortField === 'documento_id' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('usuario_nome')}
                        className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                      >
                        {t('historico.col_usuario')}
                        {sortField === 'usuario_nome' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('tipo_acesso')}
                        className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                      >
                        {t('historico.tipo_acesso')}
                        {sortField === 'tipo_acesso' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const tipoConfigBase = TIPO_ACESSO_CONFIG_BASE[log.tipo_acesso] || TIPO_ACESSO_CONFIG_BASE.visualizacao;
                    const tipoConfig = { ...tipoConfigBase, label: t(tipoConfigBase.labelKey) };
                    const TipoIcon = tipoConfig.icon;

                    return (
                      <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {format(parseISO(log.data_hora_acesso), 'dd/MM/yyyy', { locale: pt })}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {format(parseISO(log.data_hora_acesso), 'HH:mm:ss', { locale: pt })}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {getDocumentoNome(log.documento_id)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {log.usuario_nome || t('historico.usuario_removido')}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {log.usuario_email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${tipoConfig.color} border flex items-center gap-1 w-fit`}>
                            <TipoIcon className="w-3 h-3" />
                            {tipoConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {log.ip_address || 'N/A'}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {t('historico.pagina') || 'Página'} {currentPage} {t('historico.de') || 'de'} {totalPages} ({totalRegistos} {t('historico.registos') || 'registos'})
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  {t('historico.anterior') || 'Anterior'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  {t('historico.seguinte') || 'Seguinte'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}