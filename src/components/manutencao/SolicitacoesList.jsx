
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, ClipboardCheck, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_CONFIG = {
  aberta: { label: 'Aberta', color: 'bg-yellow-100 text-yellow-800' },
  em_analise: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800' },
  aprovada: { label: 'Aprovada', color: 'bg-green-100 text-green-800' },
  rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-800' },
};

const PRIORIDADE_CONFIG = {
  baixa: { label: 'Baixa', color: 'bg-green-100 text-green-800' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-800' },
};

const ORIGEM_CONFIG = {
  manual: { label: 'Manual', color: 'bg-slate-100 text-slate-700' },
  inspecao: { label: 'Inspeção', color: 'bg-purple-100 text-purple-700' },
};

const getStatusLabel = (status) => STATUS_CONFIG[status]?.label || status || 'Desconhecido';
const getStatusColor = (status) => STATUS_CONFIG[status]?.color || 'bg-gray-200 text-gray-800';
const getPrioridadeLabel = (prioridade) => PRIORIDADE_CONFIG[prioridade]?.label || prioridade || 'N/A';
const getPrioridadeColor = (prioridade) => PRIORIDADE_CONFIG[prioridade]?.color || 'bg-gray-200 text-gray-800';
const getOrigemLabel = (origem) => ORIGEM_CONFIG[origem]?.label || origem || 'Manual';
const getOrigemColor = (origem) => ORIGEM_CONFIG[origem]?.color || 'bg-slate-100 text-slate-700';

export default function SolicitacoesList({
  solicitacoes,
  aeroportos,
  isLoading,
  onAnalisar,
  onViewDetail,
  canManage,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [aeroportoFilter, setAeroportoFilter] = useState('todos');

  const statusOptions = [
    { value: 'todos', label: 'Todos os Status' },
    { value: 'aberta', label: 'Aberta' },
    { value: 'em_analise', label: 'Em Análise' },
    { value: 'aprovada', label: 'Aprovada' },
    { value: 'rejeitada', label: 'Rejeitada' },
  ];

  const aeroportoOptions = [
    { value: 'todos', label: 'Todos os Aeroportos' },
    ...(aeroportos || []).map(a => ({
      value: a.id,
      label: a.nome || a.icao_code || a.id,
    })),
  ];

  const filteredSolicitacoes = useMemo(() => {
    if (!solicitacoes) return [];

    return solicitacoes.filter(ss => {
      const matchSearch = !searchTerm ||
        (ss.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ss.solicitante_nome || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'todos' || ss.status === statusFilter;
      const matchAeroporto = aeroportoFilter === 'todos' || ss.aeroporto_id === aeroportoFilter;

      return matchSearch && matchStatus && matchAeroporto;
    });
  }, [solicitacoes, searchTerm, statusFilter, aeroportoFilter]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: pt });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Pesquisar por título ou solicitante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={statusOptions}
            placeholder="Status"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={aeroportoFilter}
            onValueChange={setAeroportoFilter}
            options={aeroportoOptions}
            placeholder="Aeroporto"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-700">N.o SS</TableHead>
                <TableHead className="font-semibold text-slate-700">Titulo</TableHead>
                <TableHead className="font-semibold text-slate-700">Origem</TableHead>
                <TableHead className="font-semibold text-slate-700">Prioridade</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700">Data</TableHead>
                <TableHead className="font-semibold text-slate-700">Solicitante</TableHead>
                <TableHead className="font-semibold text-slate-700">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    A carregar solicitacoes...
                  </TableCell>
                </TableRow>
              ) : filteredSolicitacoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    Nenhuma solicitacao encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSolicitacoes.map((ss, index) => {
                  const aeroporto = (aeroportos || []).find(a => a.id === ss.aeroporto_id);
                  return (
                    <TableRow key={ss.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <TableCell className="font-mono text-sm font-medium text-slate-900">
                        {ss.numero_ss}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{ss.titulo}</div>
                        {aeroporto && (
                          <div className="text-sm text-slate-500">{aeroporto.nome || aeroporto.icao_code}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getOrigemColor(ss.origem)}>
                          {getOrigemLabel(ss.origem)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPrioridadeColor(ss.prioridade_sugerida)}>
                          {getPrioridadeLabel(ss.prioridade_sugerida)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(ss.status)}>
                          {getStatusLabel(ss.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatDate(ss.created_date || ss.created_at)}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {ss.solicitante_nome || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewDetail && onViewDetail(ss)}
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4 text-slate-600" />
                          </Button>
                          {canManage && ss.status === 'aberta' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onAnalisar && onAnalisar(ss)}
                              title="Analisar"
                            >
                              <ClipboardCheck className="w-4 h-4 text-blue-600" />
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
      </div>
    </div>
  );
}
