import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Clock, 
  User, 
  Wrench, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  Target
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_CONFIG = {
  pendente: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Pendente' },
  atribuida: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: User, label: 'Atribuída' },
  em_execucao: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Wrench, label: 'Em Execução' },
  aguardando_verificacao: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle, label: 'Aguardando Verificação' },
  concluida: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Concluída' },
  rejeitada: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Rejeitada' }
};

const PRIORIDADE_CONFIG = {
  baixa: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Baixa' },
  media: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Média' },
  alta: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Alta' },
  urgente: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Urgente' }
};

export default function OrdemServicoDetailModal({ isOpen, onClose, ordem, aeroportos }) {
  if (!ordem) return null;

  const statusConfig = STATUS_CONFIG[ordem.status] || STATUS_CONFIG.pendente;
  const prioridadeConfig = PRIORIDADE_CONFIG[ordem.prioridade] || PRIORIDADE_CONFIG.media;
  const StatusIcon = statusConfig.icon;

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos.find(a => a.id === aeroportoId);
    return aeroporto?.nome || aeroportoId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-600" />
              {ordem.numero_ordem}
            </div>
            <div className="flex gap-2">
              <Badge className={`${statusConfig.color} border`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
              <Badge className={`${prioridadeConfig.color} border`}>
                {prioridadeConfig.label}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">{ordem.titulo}</h4>
                <p className="text-slate-600">{ordem.descricao_problema}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Aeroporto:</span>
                  <span className="font-medium">{getAeroportoNome(ordem.aeroporto_id)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Criado em:</span>
                  <span className="font-medium">
                    {format(parseISO(ordem.created_date), 'dd/MM/yyyy HH:mm', { locale: pt })}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Target className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Categoria:</span>
                  <span className="font-medium capitalize">{ordem.categoria_manutencao}</span>
                </div>

                {ordem.prazo_estimado && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Prazo:</span>
                    <span className={`font-medium ${
                      new Date(ordem.prazo_estimado) < new Date() ? 'text-red-600' : 'text-slate-700'
                    }`}>
                      {format(parseISO(ordem.prazo_estimado), 'dd/MM/yyyy', { locale: pt })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ação Corretiva */}
          {ordem.acao_corretiva_sugerida && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ação Corretiva Sugerida</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">{ordem.acao_corretiva_sugerida}</p>
              </CardContent>
            </Card>
          )}

          {/* Execução */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Execução
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ordem.responsavel_manutencao && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Responsável:</span>
                  <span className="font-medium">{ordem.responsavel_manutencao}</span>
                </div>
              )}

              {ordem.observacoes_manutencao && (
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Observações da Manutenção:</h4>
                  <p className="text-slate-600">{ordem.observacoes_manutencao}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="font-medium text-slate-700">Timeline:</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Criada em {format(parseISO(ordem.created_date), 'dd/MM/yyyy HH:mm', { locale: pt })}</span>
                  </div>

                  {ordem.data_atribuicao && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span>Atribuída em {format(parseISO(ordem.data_atribuicao), 'dd/MM/yyyy HH:mm', { locale: pt })}</span>
                    </div>
                  )}

                  {ordem.data_inicio_execucao && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span>Execução iniciada em {format(parseISO(ordem.data_inicio_execucao), 'dd/MM/yyyy HH:mm', { locale: pt })}</span>
                    </div>
                  )}

                  {ordem.data_conclusao && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Concluída em {format(parseISO(ordem.data_conclusao), 'dd/MM/yyyy HH:mm', { locale: pt })}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Custos */}
          {(ordem.custos_estimados || ordem.custos_reais) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Custos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ordem.custos_estimados && (
                    <div>
                      <span className="text-slate-600">Estimado:</span>
                      <p className="text-lg font-semibold text-slate-900">
                        {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(ordem.custos_estimados)}
                      </p>
                    </div>
                  )}

                  {ordem.custos_reais && (
                    <div>
                      <span className="text-slate-600">Real:</span>
                      <p className="text-lg font-semibold text-slate-900">
                        {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(ordem.custos_reais)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end">
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}