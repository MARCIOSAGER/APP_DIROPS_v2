
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Edit, AlertTriangle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const GRAVIDADE_CONFIG = {
  baixa: { color: 'bg-blue-100 text-blue-800' },
  media: { color: 'bg-yellow-100 text-yellow-800' },
  alta: { color: 'bg-orange-100 text-orange-800' },
  critica: { color: 'bg-red-100 text-red-800' }
};

const STATUS_CONFIG = {
  aberta: { color: 'bg-red-100 text-red-800' },
  em_investigacao: { color: 'bg-yellow-100 text-yellow-800' },
  fechada: { color: 'bg-green-100 text-green-800' }
};

export default function SafetyOccurrencesList({ 
  ocorrencias, 
  aeroportos, 
  isLoading, 
  onReload, 
  onEdit, 
  onDelete, // Add onDelete prop
  selectedOcorrencias = [], // Default empty array
  onSelectOcorrencia,
  onSelectAll
}) {
  
  const getAeroportoNome = (codigo) => {
    if (!aeroportos || !Array.isArray(aeroportos)) return codigo || 'N/A';
    const aeroporto = aeroportos.find(a => a.codigo_icao === codigo);
    return aeroporto ? aeroporto.nome : codigo;
  };

  const allSelected = ocorrencias.length > 0 && selectedOcorrencias.length === ocorrencias.length;

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-12 px-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                aria-label="Selecionar todos"
                className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
              />
            </TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Aeroporto</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Gravidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array(8).fill(0).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : (!ocorrencias || ocorrencias.length === 0) ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                <AlertTriangle className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p>Nenhuma ocorrência encontrada</p>
              </TableCell>
            </TableRow>
          ) : (
            ocorrencias.map((ocorrencia) => {
              const isSelected = Array.isArray(selectedOcorrencias) && selectedOcorrencias.includes(ocorrencia.id);
              return (
                <TableRow key={ocorrencia.id} className={isSelected ? 'bg-red-50' : 'hover:bg-slate-50'}>
                  <TableCell className="px-4">
                    {onSelectOcorrencia && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelectOcorrencia(ocorrencia.id, checked)}
                        aria-label={`Selecionar ocorrência ${ocorrencia.id}`}
                        className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {ocorrencia.tipo_ocorrencia.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{getAeroportoNome(ocorrencia.aeroporto)}</div>
                      <div className="text-sm text-slate-500 font-mono">{ocorrencia.aeroporto}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {format(new Date(ocorrencia.data_ocorrencia), 'dd/MM/yyyy', { locale: pt })}
                      </div>
                      {ocorrencia.hora_ocorrencia && (
                        <div className="text-sm text-slate-500">{ocorrencia.hora_ocorrencia}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={ocorrencia.local_especifico}>
                      {ocorrencia.local_especifico}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${GRAVIDADE_CONFIG[ocorrencia.gravidade]?.color} border font-medium`}>
                      {ocorrencia.gravidade}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_CONFIG[ocorrencia.status]?.color} border font-medium`}>
                      {ocorrencia.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(ocorrencia)}
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Editar ocorrência"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(ocorrencia)}
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Excluir ocorrência"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
