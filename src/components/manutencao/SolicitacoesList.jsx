
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, ClipboardCheck, Search, FileX } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useI18n } from '@/components/lib/i18n';

const STATUS_CONFIG = {
  aberta: { labelKey: 'ssList.statusAberta', color: 'bg-yellow-100 text-yellow-800' },
  em_analise: { labelKey: 'ssList.statusEmAnalise', color: 'bg-blue-100 text-blue-800' },
  aprovada: { labelKey: 'ssList.statusAprovada', color: 'bg-green-100 text-green-800' },
  rejeitada: { labelKey: 'ssList.statusRejeitada', color: 'bg-red-100 text-red-800' },
};

const PRIORIDADE_CONFIG = {
  baixa: { labelKey: 'manutencao.baixa', color: 'bg-green-100 text-green-800' },
  media: { labelKey: 'manutencao.media', color: 'bg-yellow-100 text-yellow-800' },
  alta: { labelKey: 'manutencao.alta', color: 'bg-orange-100 text-orange-800' },
  urgente: { labelKey: 'manutencao.urgente', color: 'bg-red-100 text-red-800' },
};

const ORIGEM_CONFIG = {
  manual: { labelKey: 'ssList.origemManual', color: 'bg-slate-100 text-slate-700' },
  inspecao: { labelKey: 'ssList.origemInspecao', color: 'bg-purple-100 text-purple-700' },
};

const getStatusColor = (status) => STATUS_CONFIG[status]?.color || 'bg-gray-200 text-gray-800';
const getPrioridadeColor = (prioridade) => PRIORIDADE_CONFIG[prioridade]?.color || 'bg-gray-200 text-gray-800';
const getOrigemColor = (origem) => ORIGEM_CONFIG[origem]?.color || 'bg-slate-100 text-slate-700';

export default function SolicitacoesList({
  solicitacoes,
  aeroportos,
  isLoading,
  onAnalisar,
  onViewDetail,
  canManage,
}) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [aeroportoFilter, setAeroportoFilter] = useState('todos');

  const statusOptions = [
    { value: 'todos', label: t('ssList.todosStatus') },
    { value: 'aberta', label: t('ssList.statusAberta') },
    { value: 'em_analise', label: t('ssList.statusEmAnalise') },
    { value: 'aprovada', label: t('ssList.statusAprovada') },
    { value: 'rejeitada', label: t('ssList.statusRejeitada') },
  ];

  const aeroportoOptions = [
    { value: 'todos', label: t('ssList.todosAeroportos') },
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
            placeholder={t('ssList.pesquisarPlaceholder')}
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
                <TableHead className="font-semibold text-slate-700">{t('ssList.nSS')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('ssList.tituloCol')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('ssList.origem')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('ssList.prioridade')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('ssList.status')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('ssList.data')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('ssList.solicitante')}</TableHead>
                <TableHead className="font-semibold text-slate-700">{t('ssList.acoes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    {t('ssList.aCarregar')}
                  </TableCell>
                </TableRow>
              ) : filteredSolicitacoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <FileX className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-lg font-medium">{t('ssList.nenhumResultado')}</p>
                    <p className="text-sm mt-1">{t('ssList.ajustarFiltros')}</p>
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
                          {t(ORIGEM_CONFIG[ss.origem]?.labelKey) || ss.origem}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPrioridadeColor(ss.prioridade_sugerida)}>
                          {t(PRIORIDADE_CONFIG[ss.prioridade_sugerida]?.labelKey) || ss.prioridade_sugerida}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(ss.status)}>
                          {t(STATUS_CONFIG[ss.status]?.labelKey) || ss.status}
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
                            title={t('ssList.verDetalhes')}
                          >
                            <Eye className="w-4 h-4 text-slate-600" />
                          </Button>
                          {canManage && (ss.status === 'aberta' || ss.status === 'em_analise') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onAnalisar && onAnalisar(ss)}
                              title={t('ssList.analisar')}
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
