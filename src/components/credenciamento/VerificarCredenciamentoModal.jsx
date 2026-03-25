
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

export default function VerificarCredenciamentoModal({ isOpen, onClose, credenciamento, onSuccess }) {
  const { t } = useI18n();
  const [observacoes, setObservacoes] = useState('');
  const [checklist, setChecklist] = useState({
    documentos: false,
    carta: false,
    dados: false,
    justificativa: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setObservacoes('');
      setChecklist({
        documentos: false,
        carta: false,
        dados: false,
        justificativa: false
      });
      setError('');
    }
  }, [isOpen]);

  const handleChecklistChange = (item) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const allChecked = Object.values(checklist).every(Boolean);

  const handleConfirmar = () => {
    if (!allChecked) {
      setError('Todos os itens da lista de verificação devem ser confirmados.');
      return;
    }
    setError('');
    onSuccess(credenciamento.id, { observacoes });
    onClose();
  };

  const checklistItems = [
    { id: 'documentos', label: 'Documentos de Identificação', description: 'Verificar se o passaporte/BI está válido e legível' },
    { id: 'carta', label: 'Carta da Empresa', description: 'Confirmar se a carta da empresa está em papel timbrado e assinada' },
    { id: 'dados', label: 'Dados Completos', description: 'Verificar se todos os campos obrigatórios estão preenchidos' },
    { id: 'justificativa', label: 'Justificativa Válida', description: 'Confirmar se a justificativa é adequada para as áreas solicitadas' }
  ];

  // Add viatura specific checklist item if credenciamento is for a vehicle
  if (credenciamento && credenciamento.tipo_credencial === 'viatura') {
    if (!checklistItems.find(item => item.id === 'viaturaDocumentos')) {
      checklistItems.push({ 
        id: 'viaturaDocumentos', 
        label: 'Documentos da Viatura', 
        description: 'Verificar livrete da viatura e carta de condução do condutor' 
      });
    }
    // Also ensure 'viaturaDocumentos' is in the checklist state
    if (!('viaturaDocumentos' in checklist)) {
      setChecklist(prev => ({ ...prev, viaturaDocumentos: false }));
    }
  } else {
    // If not viatura, ensure viaturaDocumentos is not in state
    if ('viaturaDocumentos' in checklist) {
       
      const { viaturaDocumentos, ...rest } = checklist;
      setChecklist(rest);
    }
  }


  if (!isOpen || !credenciamento) return null; // Added !credenciamento check for safety

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verificar Credenciamento - {credenciamento.protocolo_numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-slate-50 rounded-lg border">
            <p><span className="font-semibold">Tipo:</span> {credenciamento.tipo_credencial === 'pessoa' ? 'Pessoa' : 'Viatura'}</p>
            <p><span className="font-semibold">Período:</span> {credenciamento.periodo_validade === 'temporario' ? 'Temporário' : 'Permanente'}</p>
            <p><span className="font-semibold">Nome/Matrícula:</span> {credenciamento.nome_completo || credenciamento.matricula_viatura}</p>
            <p><span className="font-semibold">Justificativa:</span> {credenciamento.justificativa_acesso}</p>
            <p><span className="font-semibold">Documentos Anexados:</span> {credenciamento.documentos_anexos?.length || 0} ficheiro(s)</p>
          </div>
          
          <div>
            <Label className="font-semibold text-md">Lista de Verificação:</Label>
            <div className="space-y-2 mt-2">
              {checklistItems.map(item => (
                <div key={item.id} className="flex items-start p-3 bg-white rounded-lg border hover:bg-slate-50">
                  <Checkbox 
                    id={item.id}
                    checked={checklist[item.id]}
                    onCheckedChange={() => handleChecklistChange(item.id)}
                    className="mt-1"
                  />
                  <div className="ml-3">
                    <Label htmlFor={item.id} className="font-medium">{item.label}</Label>
                    <p className="text-sm text-slate-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label htmlFor="observacoes">Observações da Verificação</Label>
            <Textarea 
              id="observacoes"
              placeholder="Adicione observações sobre a verificação dos documentos..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="mt-1"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="font-semibold mb-1">Ao confirmar a verificação:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>O status será alterado para "Aguardando Aprovação do Diretor"</li>
              <li>A solicitação será enviada para aprovação final</li>
              <li>Um email será enviado para o diretor responsável (se configurado)</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{t('btn.cancel')}</Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirmar} disabled={!allChecked}>{t('btn.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
