import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

/**
 * Modal for cancelling a proforma with a mandatory justification.
 * Used in two scenarios:
 * 1. Direct cancellation on the Proforma page
 * 2. Automatic cancellation when a voo or voo_ligado is deleted
 *
 * Props:
 * - isOpen: bool
 * - onClose: fn
 * - onConfirm: fn(motivo: string) — called with justification text
 * - proforma: object | null — proforma being cancelled (for display)
 * - descricao: string — optional extra context shown to user
 */
export default function CancelarProformaModal({ isOpen, onClose, onConfirm, proforma, descricao }) {
  const { t } = useI18n();
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!motivo.trim()) return;
    setLoading(true);
    try {
      await onConfirm(motivo.trim());
      setMotivo('');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setMotivo('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-red-50 dark:bg-red-950 border-2 border-red-200 dark:border-red-700">
        <DialogHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-slate-900 mb-4 shadow-sm">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="text-xl font-semibold text-red-900 dark:text-red-100">
            {t('proforma.cancelar_titulo')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {proforma && (
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-red-200 dark:border-red-700 text-sm">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {t('proforma.num_label')}: {proforma.numero_proforma}
              </p>
              {proforma.valor_total_aoa && (
                <p className="text-slate-600 dark:text-slate-400">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(proforma.valor_total_aoa)}
                </p>
              )}
            </div>
          )}

          {descricao && (
            <p className="text-sm text-red-700 dark:text-red-300">{descricao}</p>
          )}

          <div className="space-y-2">
            <Label className="text-red-900 dark:text-red-100 font-medium">
              {t('proforma.motivo_cancelamento_label')} <span className="text-red-600">*</span>
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={t('proforma.motivo_placeholder')}
              rows={3}
              disabled={loading}
              className="bg-white dark:bg-slate-900 border-red-200 dark:border-red-700 resize-none"
            />
            {!motivo.trim() && (
              <p className="text-xs text-red-500">{t('proforma.motivo_obrigatorio')}</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-center">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t('shared.cancelar')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!motivo.trim() || loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />{t('shared.aguarde')}</>
            ) : (
              t('proforma.confirmar_cancelamento')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
