import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Building, Shield, Calendar, Info as InfoIcon, AlertCircle } from 'lucide-react';

const DetailItem = ({ icon, label, children }) => (
  <div className="flex items-start gap-4 py-2">
    <div className="flex-shrink-0 w-6 h-6 text-slate-500 mt-1">{icon}</div>
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="text-base text-slate-800 font-semibold">{children || <span className="text-slate-400 font-normal">Não informado</span>}</div>
    </div>
  </div>
);

export default function SolicitacaoDetailModal({ isOpen, onClose, solicitacao, empresaNome, statusConfig, perfilLabel }) {
  if (!solicitacao) return null;
  
  const StatusIcon = statusConfig.icon || AlertCircle;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <InfoIcon className="w-6 h-6 text-blue-600" />
            Detalhes da Solicitação
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <DetailItem icon={<User />} label="Nome do Solicitante">
            {solicitacao.nome_completo}
          </DetailItem>
          <DetailItem icon={<Shield />} label="Perfil Solicitado">
            {perfilLabel}
          </DetailItem>
          <DetailItem icon={<Mail />} label="Email">
            {solicitacao.email}
          </DetailItem>
          <DetailItem icon={<Phone />} label="Telefone">
            {solicitacao.telefone}
          </DetailItem>
          <DetailItem icon={<Building />} label="Empresa Solicitante">
            {empresaNome}
          </DetailItem>
          <DetailItem icon={<Calendar />} label="Data da Solicitação">
            {new Date(solicitacao.created_date).toLocaleDateString('pt-AO')}
          </DetailItem>
          
          <div className="md:col-span-2 mt-2">
             <div className="flex items-start gap-4 py-2">
                <div className="flex-shrink-0 w-6 h-6 text-slate-500 mt-1"><StatusIcon/></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-500">Status Atual</p>
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
                <DetailItem icon={<InfoIcon />} label="Observações da Aprovação">
                    {solicitacao.observacoes_aprovacao}
                </DetailItem>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}