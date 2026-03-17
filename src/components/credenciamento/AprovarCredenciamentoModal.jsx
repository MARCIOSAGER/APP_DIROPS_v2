import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserCheck, Mail, Calendar } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function AprovarCredenciamentoModal({ isOpen, onClose, credenciamento, onSuccess }) {
  const [formData, setFormData] = useState({
    observacoes: '',
    periodo_entrega: 'A partir de amanhã, das 08:00 às 15:00 horas, deverá comparecer ao Credenciamento do aeroporto para entrega dos documentos físicos e finalização do processo.'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.periodo_entrega.trim()) {
      alert('Por favor, informe o período para entrega dos documentos');
      return;
    }

    guardedSubmit(async () => {
    setIsSubmitting(true);
    try {
      await onSuccess(credenciamento.id, formData);
      onClose();
    } catch (error) {
      console.error('Erro ao aprovar credenciamento:', error);
      alert('Erro ao processar aprovação');
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  if (!credenciamento) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-600" />
            Aprovar Credenciamento - {credenciamento.protocolo_numero}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumo do Credenciamento */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <span><strong>Tipo:</strong> {credenciamento.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura'}</span>
                  <span><strong>Período:</strong> {credenciamento.periodo_validade === 'temporario' ? 'Temporário' : 'Permanente'}</span>
                </div>
                <p><strong>Nome/Matrícula:</strong> {credenciamento.nome_completo || credenciamento.matricula_viatura}</p>
                <p><strong>Empresa:</strong> {credenciamento.empresa_solicitante_id}</p>
                {credenciamento.observacoes_verificacao && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                    <p className="text-sm"><strong>Observações da Verificação:</strong></p>
                    <p className="text-sm text-blue-700">{credenciamento.observacoes_verificacao}</p>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Período para Entrega de Documentos */}
          <div className="space-y-2">
            <Label htmlFor="periodo_entrega" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Período para Entrega de Documentos Físicos *
            </Label>
            <Textarea
              id="periodo_entrega"
              placeholder="Ex: A partir de segunda-feira, das 08:00 às 15:00 horas, deverá comparecer ao Credenciamento..."
              value={formData.periodo_entrega}
              onChange={(e) => setFormData(prev => ({...prev, periodo_entrega: e.target.value}))}
              rows={3}
              required
            />
            <p className="text-xs text-slate-500">Esta informação será enviada por email para a empresa solicitante</p>
          </div>

          {/* Campo de Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações da Aprovação (opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações adicionais sobre a aprovação..."
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({...prev, observacoes: e.target.value}))}
              rows={3}
            />
          </div>

          {/* Alerta sobre próximos passos */}
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              <strong>Ao aprovar este credenciamento:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>O status será alterado para "Aprovado"</li>
                <li>Um email será enviado automaticamente para a empresa solicitante</li>
                <li>O email conterá as instruções para entrega dos documentos físicos</li>
                <li>A empresa deverá comparecer no período indicado para finalizar o processo</li>
              </ul>
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'A processar...' : 'Aprovar e Enviar Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}