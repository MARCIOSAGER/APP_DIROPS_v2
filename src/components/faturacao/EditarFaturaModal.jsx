import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Loader2, Edit } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

export default function EditarFaturaModal({ isOpen, onClose, onSave, fatura }) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();

  const STATUS_OPTIONS = [
    { value: 'emitida', label: t('editarFatura.emitida') },
    { value: 'enviada', label: t('editarFatura.enviada') },
    { value: 'paga', label: t('editarFatura.paga') },
    { value: 'vencida', label: t('editarFatura.vencida') },
    { value: 'cancelada', label: t('editarFatura.cancelada') }
  ];
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
    guardedSubmit(async () => {
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
    });
  };

  if (!fatura) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600" />
            {t('editarFatura.titulo')} - {fatura.numero_fatura}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-600 font-medium">{t('editarFatura.numProforma')}</span>
                <span className="ml-2 font-mono font-bold">{fatura.numero_fatura}</span>
              </div>
              <div>
                <span className="text-slate-600 font-medium">{t('editarFatura.valorTotalUSD')}</span>
                <span className="ml-2 font-semibold text-green-700">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'USD' }).format(fatura.valor_total_usd || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-600 font-medium">{t('editarFatura.valorTotalAOA')}</span>
                <span className="ml-2 font-semibold text-emerald-700">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(fatura.valor_total_aoa || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-600 font-medium">{t('editarFatura.taxaCambio')}</span>
                <span className="ml-2">1 USD = {fatura.taxa_cambio} AOA</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_emissao">{t('editarFatura.dataEmissao')}</Label>
                <Input
                  id="data_emissao"
                  type="date"
                  value={formData.data_emissao}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_emissao: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_vencimento">{t('editarFatura.dataVencimento')}</Label>
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
              <Label htmlFor="status">{t('editarFatura.statusProforma')}</Label>
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
                  <Label htmlFor="data_pagamento">{t('editarFatura.dataPagamento')}</Label>
                  <Input
                    id="data_pagamento"
                    type="date"
                    value={formData.data_pagamento}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_pagamento: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento">{t('editarFatura.formaPagamento')}</Label>
                  <Input
                    id="forma_pagamento"
                    placeholder={t('editarFatura.formaPagamentoPlaceholder')}
                    value={formData.forma_pagamento}
                    onChange={(e) => setFormData(prev => ({ ...prev, forma_pagamento: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observacoes">{t('editarFatura.observacoes')}</Label>
              <Textarea
                id="observacoes"
                placeholder={t('editarFatura.observacoesPlaceholder')}
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
              {t('editarFatura.cancelar')}
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('editarFatura.salvando')}
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  {t('editarFatura.salvarAlteracoes')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}