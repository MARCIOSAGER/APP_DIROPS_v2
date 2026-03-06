import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Loader2, Edit } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'emitida', label: 'Emitida' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'paga', label: 'Paga' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'cancelada', label: 'Cancelada' }
];

export default function EditarFaturaModal({ isOpen, onClose, onSave, fatura }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    data_emissao: '',
    data_vencimento: '',
    status: 'emitida',
    observacoes: '',
    data_pagamento: '',
    forma_pagamento: ''
  });

  useEffect(() => {
    if (isOpen && fatura) {
      setFormData({
        data_emissao: fatura.data_emissao || '',
        data_vencimento: fatura.data_vencimento || '',
        status: fatura.status || 'emitida',
        observacoes: fatura.observacoes || '',
        data_pagamento: fatura.data_pagamento || '',
        forma_pagamento: fatura.forma_pagamento || ''
      });
    }
  }, [isOpen, fatura]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSave({
        ...fatura,
        ...formData,
        numero_fatura: fatura.numero_fatura
      });
    } catch (error) {
      console.error('Erro ao atualizar proforma:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!fatura) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600" />
            Editar Proforma - {fatura.numero_fatura}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-600 font-medium">Nº Proforma:</span>
                <span className="ml-2 font-mono font-bold">{fatura.numero_fatura}</span>
              </div>
              <div>
                <span className="text-slate-600 font-medium">Valor Total (USD):</span>
                <span className="ml-2 font-semibold text-green-700">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'USD' }).format(fatura.valor_total_usd || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-600 font-medium">Valor Total (AOA):</span>
                <span className="ml-2 font-semibold text-emerald-700">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(fatura.valor_total_aoa || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-600 font-medium">Taxa de Câmbio:</span>
                <span className="ml-2">1 USD = {fatura.taxa_cambio} AOA</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_emissao">Data de Emissão</Label>
                <Input
                  id="data_emissao"
                  type="date"
                  value={formData.data_emissao}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_emissao: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_vencimento">Data de Vencimento</Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_vencimento: e.target.value }))}
                  required
                  min={formData.data_emissao}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status da Proforma</Label>
              <Select
                id="status"
                options={STATUS_OPTIONS}
                value={formData.status}
                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
              />
            </div>

            {formData.status === 'paga' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_pagamento">Data do Pagamento</Label>
                  <Input
                    id="data_pagamento"
                    type="date"
                    value={formData.data_pagamento}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_pagamento: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                  <Input
                    id="forma_pagamento"
                    placeholder="Ex: Transferência Bancária, Cheque..."
                    value={formData.forma_pagamento}
                    onChange={(e) => setFormData(prev => ({ ...prev, forma_pagamento: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações ou notas adicionais..."
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}