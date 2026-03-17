import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Building, Shield, Calendar, Info as InfoIcon, AlertCircle } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

const DetailItem = ({ icon, label, children, notProvidedText }) => (
  <div className="flex items-start gap-4 py-2">
    <div className="flex-shrink-0 w-6 h-6 text-slate-500 mt-1">{icon}</div>
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="text-base text-slate-800 font-semibold">{children || <span className="text-slate-400 font-normal">{notProvidedText}</span>}</div>
    </div>
  </div>
);

export default function SolicitacaoDetailModal({ isOpen, onClose, solicitacao, empresaNome, statusConfig, perfilLabel }) {
  const { t } = useI18n();

  if (!solicitacao) return null;

  const StatusIcon = statusConfig.icon || AlertCircle;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <InfoIcon className="w-6 h-6 text-blue-600" />
            {t('gestao.detalhe.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <DetailItem icon={<User />} label={t('gestao.detalhe.nomeSolicitante')} notProvidedText={t('gestao.detalhe.naoInformado')}>
            {solicitacao.nome_completo}
          </DetailItem>
          <DetailItem icon={<Shield />} label={t('gestao.detalhe.perfilSolicitado')} notProvidedText={t('gestao.detalhe.naoInformado')}>
            {perfilLabel}
          </DetailItem>
          <DetailItem icon={<Mail />} label={t('gestao.detalhe.email')} notProvidedText={t('gestao.detalhe.naoInformado')}>
            {solicitacao.email}
          </DetailItem>
          <DetailItem icon={<Phone />} label={t('gestao.detalhe.telefone')} notProvidedText={t('gestao.detalhe.naoInformado')}>
            {solicitacao.telefone}
          </DetailItem>
          <DetailItem icon={<Building />} label={t('gestao.detalhe.empresaSolicitante')} notProvidedText={t('gestao.detalhe.naoInformado')}>
            {empresaNome}
          </DetailItem>
          <DetailItem icon={<Calendar />} label={t('gestao.detalhe.dataSolicitacao')} notProvidedText={t('gestao.detalhe.naoInformado')}>
            {new Date(solicitacao.created_date).toLocaleDateString('pt-AO')}
          </DetailItem>

          <div className="md:col-span-2 mt-2">
             <div className="flex items-start gap-4 py-2">
                <div className="flex-shrink-0 w-6 h-6 text-slate-500 mt-1"><StatusIcon/></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-500">{t('gestao.detalhe.statusAtual')}</p>
                  <div className="text-base text-slate-800 font-semibold">
                     <Badge className={`${statusConfig.color} border text-sm`}>
                        <StatusIcon className="w-4 h-4 mr-2" />
                        {statusConfig.label}
                      </Badge>
                  </div>
                </div>
              </div>
          </div>

          {solicitacao.observacoes_aprovacao && (
             <div className="md:col-span-2">
                <DetailItem icon={<InfoIcon />} label={t('gestao.detalhe.observacoesAprovacao')} notProvidedText={t('gestao.detalhe.naoInformado')}>
                    {solicitacao.observacoes_aprovacao}
                </DetailItem>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">{t('gestao.detalhe.fechar')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
