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
  Target,
  Image,
  Link as LinkIcon
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useI18n } from '@/components/lib/i18n';

const STATUS_CONFIG = {
  pendente: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, labelKey: 'osDetail.statusPendente' },
  atribuida: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: User, labelKey: 'osDetail.statusAtribuida' },
  em_execucao: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Wrench, labelKey: 'osDetail.statusEmExecucao' },
  aguardando_verificacao: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle, labelKey: 'osDetail.statusAguardandoVerificacao' },
  concluida: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, labelKey: 'osDetail.statusConcluida' },
  rejeitada: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, labelKey: 'osDetail.statusRejeitada' }
};

const PRIORIDADE_CONFIG = {
  baixa: { color: 'bg-gray-100 text-gray-800 border-gray-200', labelKey: 'manutencao.baixa' },
  media: { color: 'bg-blue-100 text-blue-800 border-blue-200', labelKey: 'manutencao.media' },
  alta: { color: 'bg-orange-100 text-orange-800 border-orange-200', labelKey: 'manutencao.alta' },
  urgente: { color: 'bg-red-100 text-red-800 border-red-200', labelKey: 'manutencao.urgente' }
};

export default function OrdemServicoDetailModal({ isOpen, onClose, ordem, aeroportos }) {
  const { t } = useI18n();
  if (!ordem) return null;

  const statusConfig = STATUS_CONFIG[ordem.status] || STATUS_CONFIG.pendente;
  const prioridadeConfig = PRIORIDADE_CONFIG[ordem.prioridade] || PRIORIDADE_CONFIG.media;
  const StatusIcon = statusConfig.icon;

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos.find(a => a.id === aeroportoId);
    return aeroporto?.nome || aeroportoId;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm', { locale: pt });
    } catch {
      return dateStr;
    }
  };

  const fotosAntes = ordem.fotos_antes || [];
  const fotosDepois = ordem.fotos_depois || [];

  const renderPhotoGallery = (fotos, title, icon) => {
    if (!fotos || fotos.length === 0) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {icon}
            {title} ({fotos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {fotos.map((foto, index) => (
              <a
                key={index}
                href={foto.file_url || foto}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-blue-400 transition-colors"
              >
                <img
                  src={foto.file_url || foto}
                  alt={`${title} ${index + 1}`}
                  className="w-full h-32 object-cover"
                />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    );
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
                {t(statusConfig.labelKey)}
              </Badge>
              <Badge className={`${prioridadeConfig.color} border`}>
                {t(prioridadeConfig.labelKey)}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* SS Vinculada */}
          {ordem.solicitacao_id && (
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-100 text-indigo-800 border border-indigo-200">
                <LinkIcon className="w-3 h-3 mr-1" />
                {t('osDetail.ssVinculada')}
              </Badge>
              <span className="text-sm text-slate-600">
                {t('osDetail.osCriadaSS')}
              </span>
            </div>
          )}

          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t('osDetail.infoBasicas')}
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
                  <span className="text-slate-600">{t('osDetail.aeroporto')}</span>
                  <span className="font-medium">{getAeroportoNome(ordem.aeroporto_id)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('osDetail.criadoEm')}</span>
                  <span className="font-medium">
                    {formatDate(ordem.created_date)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Target className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('osDetail.categoria')}</span>
                  <span className="font-medium capitalize">{ordem.categoria_manutencao}</span>
                </div>

                {ordem.prazo_estimado && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{t('osDetail.prazo')}</span>
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
                <CardTitle className="text-lg">{t('osDetail.acaoCorretivaSugerida')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">{ordem.acao_corretiva_sugerida}</p>
              </CardContent>
            </Card>
          )}

          {/* Fotos Antes */}
          {renderPhotoGallery(fotosAntes, t('osDetail.fotosAntes'), <Image className="w-5 h-5 text-orange-500" />)}

          {/* Fotos Depois */}
          {renderPhotoGallery(fotosDepois, t('osDetail.fotosDepois'), <Image className="w-5 h-5 text-green-500" />)}

          {/* Execução */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                {t('osDetail.execucao')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ordem.responsavel_manutencao && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('osDetail.responsavel')}</span>
                  <span className="font-medium">{ordem.responsavel_manutencao}</span>
                </div>
              )}

              {ordem.observacoes_atribuicao && (
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">{t('osDetail.obsAtribuicao')}</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{ordem.observacoes_atribuicao}</p>
                </div>
              )}

              {ordem.observacoes_manutencao && (
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">{t('osDetail.obsManutencao')}</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{ordem.observacoes_manutencao}</p>
                </div>
              )}

              {ordem.observacoes_conclusao && (
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">{t('osDetail.obsConclusao')}</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{ordem.observacoes_conclusao}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="font-medium text-slate-700">{t('osDetail.timeline')}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>{t('osDetail.criadaEm')} {formatDate(ordem.created_date)}</span>
                  </div>

                  {ordem.data_atribuicao && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span>{t('osDetail.atribuidaEm')} {formatDate(ordem.data_atribuicao)}</span>
                    </div>
                  )}

                  {ordem.data_inicio_execucao && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span>{t('osDetail.execucaoIniciada')} {formatDate(ordem.data_inicio_execucao)}</span>
                    </div>
                  )}

                  {ordem.data_conclusao && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>{t('osDetail.concluidaEm')} {formatDate(ordem.data_conclusao)}</span>
                    </div>
                  )}

                  {ordem.data_verificacao && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                      <span>
                        {t('osDetail.verificadaEm')} {formatDate(ordem.data_verificacao)}
                        {ordem.verificado_por && (
                          <span className="text-slate-500"> {t('osDetail.por')} {ordem.verificado_por}</span>
                        )}
                      </span>
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
                  {t('osDetail.custos')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ordem.custos_estimados && (
                    <div>
                      <span className="text-slate-600">{t('osDetail.estimado')}</span>
                      <p className="text-lg font-semibold text-slate-900">
                        {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(ordem.custos_estimados)}
                      </p>
                    </div>
                  )}

                  {ordem.custos_reais && (
                    <div>
                      <span className="text-slate-600">{t('osDetail.real')}</span>
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
            <Button variant="outline">{t('osDetail.fechar')}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
