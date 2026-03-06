import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Eye, Search, Calendar, User, MapPin, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import Select from '@/components/ui/select';

const TIPO_ACESSO_CONFIG = {
  visualizacao: { color: 'bg-blue-100 text-blue-800', icon: Eye, label: 'Visualização' },
  download: { color: 'bg-green-100 text-green-800', icon: Download, label: 'Download' },
  edicao: { color: 'bg-orange-100 text-orange-800', icon: FileText, label: 'Edição' }
};

export default function HistoricoAcessoDocumentos() {
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logsData, docsData] = await Promise.all([
        base44.entities.LogAcessoDocumento.list('-data_hora_acesso'),
        base44.entities.Documento.list()
      ]);
      setLogs(logsData);
      setDocumentos(docsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentoNome = (docId) => {
    const doc = documentos.find(d => d.id === docId);
    return doc?.titulo || 'Documento Removido';
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredLogs = logs
    .filter(log => {
      const matchesSearch = 
        log.usuario_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getDocumentoNome(log.documento_id).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTipo = tipoFilter === 'todos' || log.tipo_acesso === tipoFilter;
      const matchesDocumento = documentoFilter === 'todos' || log.documento_id === documentoFilter;
      
      let matchesData = true;
      if (dataInicio && dataFim) {
        const logDate = new Date(log.data_hora_acesso);
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        matchesData = logDate >= inicio && logDate <= fim;
      }

      return matchesSearch && matchesTipo && matchesDocumento && matchesData;
    })
    .sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === 'documento_id') {
        aValue = getDocumentoNome(a.documento_id);
        bValue = getDocumentoNome(b.documento_id);
      }

      if (aValue === undefined || aValue === null) aValue = '';
      if (bValue === undefined || bValue === null) bValue = '';

      if (typeof aValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const stats = {
    total: logs.length,
    visualizacoes: logs.filter(l => l.tipo_acesso === 'visualizacao').length,
    downloads: logs.filter(l => l.tipo_acesso === 'download').length,
    ultimasHoras: logs.filter(l => {
      const diff = Date.now() - new Date(l.data_hora_acesso).getTime();
      return diff < 24 * 60 * 60 * 1000;
    }).length
  };

  const tipoOptions = [
    { value: 'todos', label: 'Todos os Tipos' },
    { value: 'visualizacao', label: 'Visualização' },
    { value: 'download', label: 'Download' },
    { value: 'edicao', label: 'Edição' }
  ];

  const documentoOptions = [
    { value: 'todos', label: 'Todos os Documentos' },
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
          <p className="text-slate-600">A carregar histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Histórico de Acesso a Documentos</h1>
          <p className="text-slate-600 mt-1">Auditoria completa de visualizações e downloads</p>
        </div>
        <Button onClick={loadData} variant="outline">
          Atualizar
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total de Acessos</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Visualizações</p>
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
                <p className="text-sm font-medium text-slate-600">Downloads</p>
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
                <p className="text-sm font-medium text-slate-600">Últimas 24h</p>
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
              <Label htmlFor="search">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Usuário ou documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Acesso</Label>
              <Select
                options={tipoOptions}
                value={tipoFilter}
                onValueChange={setTipoFilter}
              />
            </div>

            <div className="space-y-2">
              <Label>Documento</Label>
              <Select
                options={documentoOptions}
                value={documentoFilter}
                onValueChange={setDocumentoFilter}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data Início</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-fim">Data Fim</Label>
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
            Registros de Acesso ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Nenhum registro encontrado
              </h3>
              <p>Não há acessos que correspondam aos filtros selecionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => handleSort('data_hora_acesso')}
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Data/Hora
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
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Documento
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
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Usuário
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
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Tipo de Acesso
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
                    const tipoConfig = TIPO_ACESSO_CONFIG[log.tipo_acesso] || TIPO_ACESSO_CONFIG.visualizacao;
                    const TipoIcon = tipoConfig.icon;

                    return (
                      <TableRow key={log.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {format(parseISO(log.data_hora_acesso), 'dd/MM/yyyy', { locale: pt })}
                              </div>
                              <div className="text-xs text-slate-500">
                                {format(parseISO(log.data_hora_acesso), 'HH:mm:ss', { locale: pt })}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-slate-900">
                              {getDocumentoNome(log.documento_id)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {log.usuario_nome || 'Usuário Removido'}
                              </div>
                              <div className="text-xs text-slate-500">
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
                          <div className="flex items-center gap-1 text-xs text-slate-600">
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
        </CardContent>
      </Card>
    </div>
  );
}