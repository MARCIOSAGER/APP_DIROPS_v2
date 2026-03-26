import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Select from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Edit, Eye, Archive, FolderInput, Lock, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, Trash2, FolderOpen, DownloadCloud, UserCog } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import DocumentViewer from './DocumentViewer';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/components/lib/i18n';

const CATEGORIA_CONFIG = {
  manual_operacoes: { color: 'bg-blue-100 text-blue-800', label: 'Manual de Operações' },
  procedimento: { color: 'bg-green-100 text-green-800', label: 'Procedimento' },
  regulamentacao: { color: 'bg-purple-100 text-purple-800', label: 'Regulamentação' },
  formulario: { color: 'bg-orange-100 text-orange-800', label: 'Formulário' },
  relatorio: { color: 'bg-indigo-100 text-indigo-800', label: 'Relatório' },
  outro: { color: 'bg-gray-100 text-gray-800', label: 'Outro' }
};

const STATUS_CONFIG = {
  ativo: { color: 'bg-green-100 text-green-800', label: 'Ativo' },
  arquivado: { color: 'bg-gray-100 text-gray-800', label: 'Arquivado' },
  revisao: { color: 'bg-yellow-100 text-yellow-800', label: 'Em Revisão' }
};

export default function DocumentosList({ documentos, aeroportos, isLoading, onReload, onEdit, onDelete, onMove, onGerenciarAcesso, user, viewMode = 'list' }) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [viewingDocument, setViewingDocument] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [sortField, setSortField] = useState('data_publicacao');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedDocs, setSelectedDocs] = useState([]);


  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredDocumentos = documentos.filter(doc => {
    const matchesSearch = doc.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoriaFilter === 'todos' || doc.categoria === categoriaFilter;
    const matchesStatus = statusFilter === 'todos' || doc.status === statusFilter;

    return matchesSearch && matchesCategoria && matchesStatus;
  }).sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Tratamento especial para campos específicos
    if (sortField === 'aeroporto') {
      aValue = getAeroportoNome(a.aeroporto);
      bValue = getAeroportoNome(b.aeroporto);
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

  const getAeroportoNome = (icao) => {
    if (!icao) return 'Geral';
    const aero = aeroportos.find(a => a.codigo_icao === icao);
    return aero?.nome || icao;
  };

  const handleViewDocument = (documento) => {
    setViewingDocument(documento);
    setIsViewerOpen(true);
  };

  const handleDownloadFile = (documento) => {
    if (documento.arquivo_url) {
      const link = document.createElement('a');
      link.href = documento.arquivo_url;
      link.download = `${documento.titulo}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const canDeleteDocument = (documento) => {
    if (!user) return false;
    if (user.role === 'admin' || (user.perfis && user.perfis.includes('administrador'))) return true;
    return documento.created_by === user.email;
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedDocs(filteredDocumentos.map(d => d.id));
    } else {
      setSelectedDocs([]);
    }
  };

  const handleSelectDoc = (docId, checked) => {
    if (checked) {
      setSelectedDocs([...selectedDocs, docId]);
    } else {
      setSelectedDocs(selectedDocs.filter(id => id !== docId));
    }
  };

  const handleBulkDownload = () => {
    selectedDocs.forEach(docId => {
      const doc = documentos.find(d => d.id === docId);
      if (doc && doc.arquivo_url) {
        const link = document.createElement('a');
        link.href = doc.arquivo_url;
        link.download = `${doc.titulo}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  const handleBulkMove = () => {
    if (selectedDocs.length === 0) return;
    const firstDoc = documentos.find(d => d.id === selectedDocs[0]);
    if (onMove && firstDoc) {
      onMove({ ...firstDoc, _isBulk: true, _bulkIds: selectedDocs });
    }
  };

  const handleBulkDelete = () => {
    if (selectedDocs.length === 0) return;
    const firstDoc = documentos.find(d => d.id === selectedDocs[0]);
    if (onDelete && firstDoc) {
      onDelete(selectedDocs[0], { isBulk: true, bulkIds: selectedDocs });
      setSelectedDocs([]);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Create options arrays for Select components
  const categoriaOptions = [
    { value: 'todos', label: t('docs.todosTipos') },
    ...Object.entries(CATEGORIA_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label
    }))
  ];

  const statusOptions = [
    { value: 'todos', label: 'Todos os Status' },
    ...Object.entries(STATUS_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label
    }))
  ];

  return (
    <div className="space-y-6">
      {/* Barra de Ações em Massa */}
      {selectedDocs.length > 0 && (
        <Card className="border-2 border-blue-500 shadow-lg bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-900">
                {selectedDocs.length} documento(s) selecionado(s)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDownload}
                  className="bg-white"
                >
                  <DownloadCloud className="w-4 h-4 mr-2" />
                  Download
                </Button>
                {onMove && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkMove}
                    className="bg-white"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Mover
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="bg-white text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDocs([])}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pesquisa e Filtros Rápidos */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pesquisa">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  id="pesquisa"
                  placeholder="Título ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select 
                options={categoriaOptions}
                value={categoriaFilter} 
                onValueChange={setCategoriaFilter}
                placeholder="Categoria"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-doc">Status</Label>
              <Select 
                options={statusOptions}
                value={statusFilter} 
                onValueChange={setStatusFilter}
                placeholder="Status"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Documentos */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Biblioteca de Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocumentos.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Nenhum documento encontrado
              </h3>
              <p className="text-slate-500">
                Não há documentos que correspondam aos filtros selecionados.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocumentos.map((documento) => {
                const categoriaConfig = CATEGORIA_CONFIG[documento.categoria] || CATEGORIA_CONFIG.outro;
                const statusConfig = STATUS_CONFIG[documento.status] || STATUS_CONFIG.ativo;
                const canDelete = canDeleteDocument(documento);
                
                return (
                  <Card key={documento.id} className="hover:shadow-lg transition-all border-slate-200 bg-white">
                    <CardContent className="p-6 space-y-4">
                      {/* Header com título e menu de ações */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 text-base truncate" title={documento.titulo}>
                            {documento.titulo}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">{categoriaConfig.label}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:text-slate-900"
                              aria-label="Mais opções"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => onEdit(documento)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar Informações
                            </DropdownMenuItem>
                            {onGerenciarAcesso && (
                              <DropdownMenuItem onClick={() => onGerenciarAcesso(documento)}>
                                <UserCog className="w-4 h-4 mr-2" />
                                Gerenciar Acesso
                              </DropdownMenuItem>
                            )}
                            {onMove && (
                              <DropdownMenuItem onClick={() => onMove(documento)}>
                                <FolderInput className="w-4 h-4 mr-2" />
                                Mover para Pasta
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => canDelete && onDelete(documento.id)}
                              disabled={!canDelete}
                              className="text-red-600"
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              {canDelete ? 'Arquivar' : 'Sem Permissão'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Badge de status */}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{statusConfig.label}</Badge>
                        <span className="text-xs text-slate-500">Por: {documento.created_by?.split('@')[0] || 'Sistema'}</span>
                      </div>

                      {/* Info do projeto/aeroporto */}
                      {documento.aeroporto && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-600 font-medium mb-1">Projecto</p>
                          <p className="text-sm text-slate-900 font-semibold">{getAeroportoNome(documento.aeroporto)}</p>
                        </div>
                      )}

                      {/* Método de carregamento */}
                      <p className="text-xs text-slate-500">Carregado via {documento.descricao?.includes('drag') ? 'drag-and-drop' : 'formulário'}</p>

                      {/* Botões de ação */}
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-xs"
                          onClick={() => handleViewDocument(documento)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Visualizar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedDocs.length === filteredDocumentos.length && filteredDocumentos.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <button 
                        onClick={() => handleSort('titulo')}
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Título
                        {sortField === 'titulo' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button 
                        onClick={() => handleSort('categoria')}
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Categoria
                        {sortField === 'categoria' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button 
                        onClick={() => handleSort('aeroporto')}
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Aeroporto
                        {sortField === 'aeroporto' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button 
                        onClick={() => handleSort('versao')}
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Versão
                        {sortField === 'versao' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button 
                        onClick={() => handleSort('data_publicacao')}
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Data Publicação
                        {sortField === 'data_publicacao' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button 
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 hover:text-slate-900 font-medium"
                      >
                        Status
                        {sortField === 'status' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocumentos.map((documento) => {
                    const categoriaConfig = CATEGORIA_CONFIG[documento.categoria] || CATEGORIA_CONFIG.outro;
                    const statusConfig = STATUS_CONFIG[documento.status] || STATUS_CONFIG.ativo;
                    const canDelete = canDeleteDocument(documento);
                    
                    return (
                      <TableRow key={documento.id} className="hover:bg-slate-50">
                        <TableCell>
                          <Checkbox
                            checked={selectedDocs.includes(documento.id)}
                            onCheckedChange={(checked) => handleSelectDoc(documento.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-slate-900">{documento.titulo}</div>
                            {documento.descricao && (
                              <div className="text-sm text-slate-500 max-w-xs truncate">
                                {documento.descricao}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${categoriaConfig.color} border`}>
                            {categoriaConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getAeroportoNome(documento.aeroporto)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{documento.versao}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {format(parseISO(documento.data_publicacao), 'dd/MM/yyyy', { locale: pt })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusConfig.color} border`}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                              onClick={() => handleViewDocument(documento)}
                              title="Visualizar documento"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50" 
                              onClick={() => onEdit(documento)}
                              title="Editar documento"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {onGerenciarAcesso && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                                onClick={() => onGerenciarAcesso(documento)}
                                title="Gerenciar acesso"
                              >
                                <UserCog className="w-4 h-4" />
                              </Button>
                            )}
                            {onMove && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50" 
                                onClick={() => onMove(documento)}
                                title="Mover documento"
                              >
                                <FolderInput className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`h-8 w-8 ${canDelete ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed'}`}
                              onClick={() => canDelete && onDelete(documento.id)}
                              title={canDelete ? "Arquivar documento" : "Sem permissão"}
                              disabled={!canDelete}
                            >
                              {canDelete ? <Archive className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </Button>
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

      {/* Visualizador de Documento */}
      <DocumentViewer
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setViewingDocument(null);
        }}
        documento={viewingDocument}
        aeroportos={aeroportos}
      />
    </div>
  );
}