import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  Edit,
  FileText,
  Calendar,
  User,
  MapPin,
  TrendingUp,
  Trash2,
  FileDown, // For PDF export
  MoreHorizontal, // For dropdown trigger
  PlusCircle // Novo ícone
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import AlertModal from '../shared/AlertModal';
import { ProcessoAuditoria } from '@/entities/ProcessoAuditoria';
import { RespostaAuditoria } from '@/entities/RespostaAuditoria';
import { PlanoAcaoCorretiva } from '@/entities/PlanoAcaoCorretiva';
import { ItemPAC } from '@/entities/ItemPAC';

const STATUS_CONFIG = {
  planejada: { label: 'Planejada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' }
};

export default function AuditoriaList({
  processosAuditoria = [],
  tiposAuditoria = [],
  aeroportos = [],
  isLoading = false,
  onReload = () => {},
  canManage: _canManage = false, // This prop will no longer gate the edit/delete buttons
  onOpenDetail = () => {},
  onEdit = () => {},
  onCreatePAC = () => {}, // Nova prop
  onExportPDF = () => {} // New prop for PDF export
}) {
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, id: null, error: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (id) => {
    setDeleteInfo({ isOpen: true, id, error: null });
  };

  const handleDeleteConfirm = async () => {
    if (deleteInfo.id) {
      setIsDeleting(true);
      setDeleteInfo(prev => ({ ...prev, error: null }));
      try {
        const processoId = deleteInfo.id;

        // 1. Encontrar e excluir PACs e seus itens
        const pacsToDelete = await PlanoAcaoCorretiva.filter({ processo_auditoria_id: processoId });
        for (const pac of pacsToDelete) {
          const itensPacToDelete = await ItemPAC.filter({ pac_id: pac.id });
          for (const item of itensPacToDelete) {
            await ItemPAC.delete(item.id);
          }
          await PlanoAcaoCorretiva.delete(pac.id);
        }

        // 2. Encontrar e excluir Respostas
        const respostasToDelete = await RespostaAuditoria.filter({ processo_auditoria_id: processoId });
        for (const resposta of respostasToDelete) {
          await RespostaAuditoria.delete(resposta.id);
        }

        // 3. Finalmente, excluir o ProcessoAuditoria
        await ProcessoAuditoria.delete(processoId);

        setDeleteInfo({ isOpen: false, id: null, error: null });
        onReload();
      } catch (error) {
        console.error('Erro ao excluir processo e dados relacionados:', error);
        setDeleteInfo(prev => ({ ...prev, error: 'Ocorreu um erro ao excluir a auditoria. Tente novamente.' }));
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardContent className="p-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (processosAuditoria.length === 0) {
    return (
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">Auditorias (0)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Nenhuma auditoria encontrada
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Não há auditorias que correspondam aos filtros selecionados.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <Card className="hidden md:block bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">
            Auditorias ({processosAuditoria.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-700">
                  <TableHead className="text-slate-600 dark:text-slate-300">Tipo de Auditoria</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">Aeroporto</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">Data</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">Auditor</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">Conformidade</TableHead>
                  <TableHead className="text-right text-slate-600 dark:text-slate-300">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processosAuditoria.map((processo) => {
                  const tipo = tiposAuditoria.find(t => t.id === processo.tipo_auditoria_id);
                  const aeroporto = aeroportos.find(a => a.codigo_icao === processo.aeroporto_id);
                  const statusConfig = STATUS_CONFIG[processo.status];

                  return (
                    <TableRow key={processo.id} className="border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <TableCell className="text-slate-900 dark:text-slate-100">
                        <div>
                          <div className="font-medium">{tipo?.nome || 'N/A'}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                            {tipo?.categoria?.replace(/_/g, ' ') || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span>{aeroporto?.nome || processo.aeroporto_id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>
                            {processo.data_auditoria
                              ? format(new Date(processo.data_auditoria), 'dd/MM/yyyy', { locale: pt })
                              : 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span>{processo.auditor_responsavel || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig?.color || 'bg-gray-100 text-gray-800'}>
                          {statusConfig?.label || processo.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300">
                        {processo.percentual_conformidade !== null && processo.percentual_conformidade !== undefined ? (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span className="font-medium">
                              {processo.percentual_conformidade.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenDetail(processo)}>
                              <Eye className="mr-2 h-4 w-4" />
                              <span>Ver detalhes</span>
                            </DropdownMenuItem>
                            {(processo.status === 'planejada' || processo.status === 'em_andamento') && (
                              <DropdownMenuItem onClick={() => onEdit(processo)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>{processo.status === 'planejada' ? 'Editar' : 'Continuar'}</span>
                              </DropdownMenuItem>
                            )}
                            {processo.status === 'concluida' && processo.itens_nao_conformes > 0 && (
                              <DropdownMenuItem onClick={() => onCreatePAC(processo)} className="text-blue-600 focus:text-blue-600">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                <span>Criar PAC</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onExportPDF(processo)}>
                              <FileDown className="mr-2 h-4 w-4" />
                              <span>Exportar Relatório (PDF)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteClick(processo.id)} className="text-red-600 focus:text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Excluir auditoria</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Auditorias ({processosAuditoria.length})</p>
        {processosAuditoria.map((processo) => {
          const tipo = tiposAuditoria.find(t => t.id === processo.tipo_auditoria_id);
          const aeroporto = aeroportos.find(a => a.codigo_icao === processo.aeroporto_id);
          const statusConfig = STATUS_CONFIG[processo.status];
          return (
            <Card key={processo.id} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{tipo?.nome || 'N/A'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{tipo?.categoria?.replace(/_/g, ' ') || ''}</p>
                  </div>
                  <Badge className={statusConfig?.color || 'bg-gray-100 text-gray-800'}>{statusConfig?.label || processo.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /><span>{aeroporto?.nome || processo.aeroporto_id}</span></div>
                  <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span>{processo.data_auditoria ? format(new Date(processo.data_auditoria), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}</span></div>
                  <div className="flex items-center gap-1"><User className="w-3 h-3" /><span>{processo.auditor_responsavel || 'N/A'}</span></div>
                  {processo.percentual_conformidade != null && (
                    <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-500" /><span className="font-medium">{processo.percentual_conformidade.toFixed(1)}%</span></div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onOpenDetail(processo)}><Eye className="w-3 h-3 mr-1" />Ver</Button>
                  {(processo.status === 'planejada' || processo.status === 'em_andamento') && (
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onEdit(processo)}><Edit className="w-3 h-3 mr-1" />{processo.status === 'planejada' ? 'Editar' : 'Continuar'}</Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onExportPDF(processo)}><FileDown className="w-3 h-3 mr-1" />PDF</Button>
                  <Button size="sm" variant="ghost" className="text-red-600 px-2" onClick={() => handleDeleteClick(processo.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertModal
        isOpen={deleteInfo.isOpen}
        onClose={() => setDeleteInfo({ isOpen: false, id: null, error: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirmar Exclusão"
        message="Tem a certeza que deseja excluir esta auditoria e todos os seus dados relacionados (respostas, PACs, etc)? Esta ação não pode ser desfeita."
        type="warning"
        confirmText={isDeleting ? "Excluindo..." : "Excluir"}
        showCancel
        isConfirmDisabled={isDeleting}
        errorMessage={deleteInfo.error}
      />
    </>
  );
}