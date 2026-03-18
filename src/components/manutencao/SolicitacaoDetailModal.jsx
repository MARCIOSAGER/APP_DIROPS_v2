import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  User,
  Calendar,
  MapPin,
  Image,
  ClipboardCheck,
  XCircle,
  Clock,
  CheckCircle,
  Search,
  Mail,
  Wrench
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { OrdemServico } from '@/entities/OrdemServico';
import { useI18n } from '@/components/lib/i18n';

const STATUS_CONFIG = {
  aberta: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, labelKey: 'ssDetail.statusAberta' },
  em_analise: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Search, labelKey: 'ssDetail.statusEmAnalise' },
  aprovada: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, labelKey: 'ssDetail.statusAprovada' },
  rejeitada: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, labelKey: 'ssDetail.statusRejeitada' }
};

const PRIORIDADE_CONFIG = {
  baixa: { color: 'bg-gray-100 text-gray-800 border-gray-200', labelKey: 'manutencao.baixa' },
  media: { color: 'bg-blue-100 text-blue-800 border-blue-200', labelKey: 'manutencao.media' },
  alta: { color: 'bg-orange-100 text-orange-800 border-orange-200', labelKey: 'manutencao.alta' },
  urgente: { color: 'bg-red-100 text-red-800 border-red-200', labelKey: 'manutencao.urgente' }
};

const ORIGEM_CONFIG = {
  interna: { color: 'bg-slate-100 text-slate-800 border-slate-200', labelKey: 'ssDetail.origemInterna' },
  externa: { color: 'bg-indigo-100 text-indigo-800 border-indigo-200', labelKey: 'ssDetail.origemExterna' },
  inspecao: { color: 'bg-cyan-100 text-cyan-800 border-cyan-200', labelKey: 'ssDetail.origemInspecao' }
};

export default function SolicitacaoDetailModal({ isOpen, onClose, solicitacao, aeroportos }) {
  const { t } = useI18n();
  const [osNumero, setOsNumero] = useState(null);
  const [loadingOS, setLoadingOS] = useState(false);

  useEffect(() => {
    if (solicitacao?.ordem_servico_id && isOpen) {
      setLoadingOS(true);
      OrdemServico.get(solicitacao.ordem_servico_id)
        .then(os => {
          setOsNumero(os?.numero_ordem || null);
        })
        .catch(err => {
          console.error('Erro ao buscar OS vinculada:', err);
          setOsNumero(null);
        })
        .finally(() => setLoadingOS(false));
    } else {
      setOsNumero(null);
    }
  }, [solicitacao?.ordem_servico_id, isOpen]);

  if (!solicitacao) return null;

  const statusConfig = STATUS_CONFIG[solicitacao.status] || STATUS_CONFIG.aberta;
  const prioridadeConfig = PRIORIDADE_CONFIG[solicitacao.prioridade_sugerida] || PRIORIDADE_CONFIG.media;
  const origemConfig = ORIGEM_CONFIG[solicitacao.origem] || ORIGEM_CONFIG.interna;
  const StatusIcon = statusConfig.icon;

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos?.find(a => a.id === aeroportoId);
    return aeroporto?.nome || aeroportoId || '-';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm', { locale: pt });
    } catch {
      return dateStr;
    }
  };

  const fotos = solicitacao.fotos || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {solicitacao.numero_ss || t('ssDetail.solicitacaoServico')}
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
          {/* Informações da Solicitação */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t('ssDetail.informacoes')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {solicitacao.numero_ss && (
                <div className="text-sm">
                  <span className="text-slate-600">{t('ssDetail.nSS')}</span>{' '}
                  <span className="font-medium">{solicitacao.numero_ss}</span>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">{solicitacao.titulo}</h4>
                <p className="text-slate-600 whitespace-pre-wrap">{solicitacao.descricao}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('ssDetail.aeroporto')}</span>
                  <span className="font-medium">{getAeroportoNome(solicitacao.aeroporto_id)}</span>
                </div>

                {solicitacao.localizacao && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{t('ssDetail.localizacao')}</span>
                    <span className="font-medium">{solicitacao.localizacao}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('ssDetail.data')}</span>
                  <span className="font-medium">{formatDate(solicitacao.created_date)}</span>
                </div>

                {solicitacao.origem && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-600">{t('ssDetail.origem')}</span>
                    <Badge className={`${origemConfig.color} border text-xs`}>
                      {t(origemConfig.labelKey)}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Solicitante */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                {t('ssDetail.solicitante')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {solicitacao.solicitante_nome && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('ssDetail.nome')}</span>
                  <span className="font-medium">{solicitacao.solicitante_nome}</span>
                </div>
              )}
              {solicitacao.solicitante_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{t('ssDetail.email')}</span>
                  <span className="font-medium">{solicitacao.solicitante_email}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fotos */}
          {fotos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Image className="w-5 h-5" />
                  {t('ssDetail.fotos')} ({fotos.length})
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
                        alt={`Foto ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Análise */}
          {solicitacao.status !== 'aberta' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  {t('ssDetail.analise')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {solicitacao.analisado_por && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{t('ssDetail.analisadoPor')}</span>
                    <span className="font-medium">{solicitacao.analisado_por}</span>
                  </div>
                )}

                {solicitacao.data_analise && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{t('ssDetail.dataAnalise')}</span>
                    <span className="font-medium">{formatDate(solicitacao.data_analise)}</span>
                  </div>
                )}

                {solicitacao.status === 'rejeitada' && solicitacao.motivo_rejeicao && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-1">
                      <XCircle className="w-4 h-4" />
                      {t('ssDetail.motivoRejeicao')}
                    </div>
                    <p className="text-sm text-red-700 whitespace-pre-wrap">{solicitacao.motivo_rejeicao}</p>
                  </div>
                )}

                {solicitacao.status === 'aprovada' && solicitacao.ordem_servico_id && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                      <Wrench className="w-4 h-4" />
                      <span>{t('ssDetail.osGerada')}</span>
                      <Badge className="bg-green-100 text-green-800 border border-green-300 font-mono">
                        {loadingOS ? t('ssDetail.carregando') : osNumero || solicitacao.ordem_servico_id}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end">
          <DialogClose asChild>
            <Button variant="outline">{t('ssDetail.fechar')}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
