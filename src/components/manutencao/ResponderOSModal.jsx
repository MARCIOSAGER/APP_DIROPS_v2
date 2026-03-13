import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const ACAO_CONFIG = {
  aceitar: {
    status: 'em_execucao',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    label: 'Aceitar e Iniciar Execução',
    titulo: 'Aceitar Ordem de Serviço'
  },
  rejeitar: {
    status: 'rejeitada',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    label: 'Rejeitar Ordem',
    titulo: 'Rejeitar Ordem de Serviço'
  },
  verificar: {
    status: 'aguardando_verificacao',
    color: 'bg-orange-100 text-orange-800',
    icon: AlertTriangle,
    label: 'Solicitar Verificação',
    titulo: 'Solicitar Verificação'
  },
  concluir: {
    status: 'concluida',
    color: 'bg-blue-100 text-blue-800',
    icon: CheckCircle,
    label: 'Marcar como Concluída',
    titulo: 'Concluir Ordem de Serviço'
  }
};

export default function ResponderOSModal({ isOpen, onClose, ordem, acao, onSubmit }) {
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const acaoConfig = ACAO_CONFIG[acao] || ACAO_CONFIG.aceitar;
  const AcaoIcon = acaoConfig.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (acao === 'rejeitar' && !observacoes.trim()) {
      alert('Justificativa é obrigatória para rejeição');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ordem_id: ordem.id,
        status: acaoConfig.status,
        observacoes: observacoes,
        acao: acao
      });
      onClose();
    } catch (error) {
      console.error('Erro ao responder OS:', error);
      alert('Erro ao processar resposta');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ordem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AcaoIcon className="w-5 h-5" />
            {acaoConfig.titulo} - {ordem.numero_ordem}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumo da OS */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span><strong>Título:</strong> {ordem.titulo}</span>
                  <Badge className={acaoConfig.color}>
                    {acaoConfig.label}
                  </Badge>
                </div>
                <p><strong>Descrição:</strong> {ordem.descricao_problema}</p>
                <p><strong>Prioridade:</strong> <span className="capitalize">{ordem.prioridade}</span></p>
                {ordem.prazo_estimado && (
                  <p><strong>Prazo:</strong> {new Date(ordem.prazo_estimado).toLocaleDateString('pt-AO')}</p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Campo de Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">
              {acao === 'rejeitar' ? 'Justificativa para Rejeição *' : 'Observações'}
            </Label>
            <Textarea
              id="observacoes"
              placeholder={
                acao === 'rejeitar' 
                  ? 'Por favor, informe o motivo da rejeição...' 
                  : acao === 'aceitar'
                  ? 'Descreva como pretende executar esta ordem...'
                  : acao === 'verificar'
                  ? 'Informe o que foi realizado e o que precisa ser verificado...'
                  : 'Descreva os trabalhos realizados...'
              }
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={4}
              required={acao === 'rejeitar'}
            />
          </div>

          {/* Alertas específicos por ação */}
          {acao === 'aceitar' && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                Ao aceitar, você se torna responsável por esta ordem de serviço. O status será alterado para "Em Execução".
              </AlertDescription>
            </Alert>
          )}

          {acao === 'rejeitar' && (
            <Alert>
              <XCircle className="w-4 h-4" />
              <AlertDescription>
                A ordem será rejeitada e retornará ao status "Pendente" para nova atribuição. Uma justificativa é obrigatória.
              </AlertDescription>
            </Alert>
          )}

          {acao === 'verificar' && (
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                A ordem será marcada como "Aguardando Verificação" e será enviada para aprovação do supervisor.
              </AlertDescription>
            </Alert>
          )}

          {acao === 'concluir' && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                A ordem será marcada como "Concluída" e um email de notificação será enviado para quem a criou.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className={`text-white ${
                acao === 'rejeitar' ? 'bg-red-600 hover:bg-red-700' :
                acao === 'aceitar' ? 'bg-green-600 hover:bg-green-700' :
                acao === 'verificar' ? 'bg-orange-600 hover:bg-orange-700' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Processando...' : acaoConfig.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}