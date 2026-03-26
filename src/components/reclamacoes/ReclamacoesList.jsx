import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Eye,
  Edit,
  Clock,
  MapPin,
  User,
  Phone,
  AlertTriangle,
  Trash2,
  Mail,
  Inbox,
  Search,
  Wrench,
  MessageCircle,
  ArrowUpRight,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_CONFIG = {
  recebida: { label: 'Recebida', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Inbox },
  em_analise: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Search },
  em_tratamento: { label: 'Em Tratamento', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: Wrench },
  aguardando_feedback: { label: 'Aguardando Feedback', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: MessageCircle },
  redirecionada: { label: 'Redirecionada', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200', icon: ArrowUpRight },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
};

const PRIORIDADE_CONFIG = {
  baixa: { label: 'Baixa', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

const AREA_RESPONSAVEL_CONFIG = {
  manutencao: 'Manutenção',
  achados_e_perdidos: 'Achados e Perdidos',
  ti: 'TI',
  seguranca_avsec: 'Segurança AVSEC',
  seguranca_operacional: 'Segurança Operacional',
  operacoes: 'Operações',
  cia_aerea: 'Cia Aérea',
  outros_aeroportuarios: 'Outros Aeroportuários',
  sem_direcionamento: 'Sem Direcionamento',
};

export default function ReclamacoesList({
  reclamacoes,
  aeroportos,
  isLoading,
  onView,
  onEdit,
  onDelete,
  selectedReclamacoes,
  onSelectReclamacao,
  onSelectAll,
  onSendProtocolo,
}) {
  const { t } = useI18n();
  const canDelete = true; // Always allow deletion in public mode

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardContent className="p-6">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reclamacoes.length === 0) {
    return (
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardContent className="text-center py-12">
          <AlertTriangle className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t('recl.nenhuma_encontrada')}
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {t('recl.nenhuma_filtros')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const allSelected = reclamacoes.length > 0 && selectedReclamacoes.length === reclamacoes.length;
  const someSelected = selectedReclamacoes.length > 0 && selectedReclamacoes.length < reclamacoes.length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho com seleção */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={allSelected}
            ref={(ref) => {
              if (ref) ref.indeterminate = someSelected;
            }}
            onCheckedChange={onSelectAll}
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {selectedReclamacoes.length > 0
              ? `${selectedReclamacoes.length} ${t('recl.selecionadas')}`
              : t('recl.selecionar_todas')
            }
          </span>
        </div>

        {selectedReclamacoes.length > 0 && (
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              {selectedReclamacoes.length} {t('recl.itens_selecionados')}
            </Badge>
          </div>
        )}
      </div>

      {reclamacoes.map((reclamacao) => {
        const aeroporto = aeroportos.find(a => a.codigo_icao === reclamacao.aeroporto_id);
        const statusConfig = STATUS_CONFIG[reclamacao.status];
        const prioridadeConfig = PRIORIDADE_CONFIG[reclamacao.prioridade];
        const areaResponsavel = AREA_RESPONSAVEL_CONFIG[reclamacao.area_responsavel];

        const isPrazoProximo = reclamacao.data_prazo_resposta &&
          new Date(reclamacao.data_prazo_resposta) <= new Date(Date.now() + 24 * 60 * 60 * 1000);

        const isSelected = selectedReclamacoes.includes(reclamacao.id);

        return (
          <Card
            key={reclamacao.id}
            className={`hover:shadow-md transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
          >
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                {/* Checkbox de seleção */}
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectReclamacao(reclamacao.id, checked)}
                  className="mt-1"
                />

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                      {reclamacao.titulo}
                    </h3>
                    <Badge className={`${statusConfig.color} flex items-center gap-1`}>
                      {statusConfig.icon && <statusConfig.icon className="w-3 h-3" />}
                      {statusConfig.label}
                    </Badge>
                    {reclamacao.prioridade !== 'media' && (
                      <Badge className={prioridadeConfig.color}>
                        {prioridadeConfig.label}
                      </Badge>
                    )}
                    {isPrazoProximo && (
                      <Badge className="bg-red-100 text-red-800">
                        <Clock className="w-3 h-3 mr-1" />
                        {t('recl.prazo_proximo')}
                      </Badge>
                    )}
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3 line-clamp-2">
                    {reclamacao.descricao}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{t('recl.protocolo')}</span>
                      <span className="font-mono">{reclamacao.protocolo_numero}</span>
                    </div>

                    {aeroporto && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{aeroporto.nome}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{format(new Date(reclamacao.data_recebimento), 'dd/MM/yyyy HH:mm', { locale: pt })}</span>
                    </div>

                    {reclamacao.reclamante_nome && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{reclamacao.reclamante_nome}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span className="capitalize">{reclamacao.canal_entrada?.replace('_', ' ')}</span>
                    </div>

                    {areaResponsavel && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{t('recl.area')}</span>
                        <span>{areaResponsavel}</span>
                      </div>
                    )}

                    {reclamacao.responsavel_atual && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{t('recl.responsavel')}</span>
                        <span>{reclamacao.responsavel_atual}</span>
                      </div>
                    )}
                  </div>

                  {reclamacao.categoria_reclamacao && (
                    <div className="flex items-center gap-2 pt-3 border-t dark:border-slate-700 mt-3">
                      <span className="text-xs font-medium text-slate-500">{t('recl.categoria')}</span>
                      <Badge variant="outline" className="text-xs">
                        {reclamacao.categoria_reclamacao.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onView(reclamacao)}
                    className="w-full"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t('recl.ver_detalhes')}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        {t('recl.acoes')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(reclamacao)}>
                        <Edit className="w-4 h-4 mr-2" />
                        {t('recl.editar')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSendProtocolo(reclamacao)}>
                        <Mail className="w-4 h-4 mr-2" />
                        {t('recl.enviar_protocolo')}
                      </DropdownMenuItem>
                      {canDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(reclamacao.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('recl.excluir')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}