import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

/**
 * Double-confirmation Delete Account modal.
 * Step 1 – warn the user, ask to proceed.
 * Step 2 – require typing "ELIMINAR" to confirm.
 * onConfirm() is called only after both confirmations.
 */
export default function DeleteAccountModal({ isOpen, onClose, onConfirm, userEmail }) {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const { t } = useI18n();

  if (!isOpen) return null;

  const CONFIRM_WORD = 'ELIMINAR';
  const isConfirmValid = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const handleClose = () => {
    setStep(1);
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    if (!isConfirmValid) return;
    setStep(1);
    setConfirmText('');
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={handleClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-900 rounded-full p-2">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {step === 1 ? t('shared.delete_account.titulo') : t('shared.delete_account.confirmacao_final')}
            </h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 1 ? (
          <>
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-xl mb-6 border border-red-200 dark:border-red-700">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200 space-y-1">
                <p className="font-semibold">{t('shared.delete_account.aviso')}</p>
                <ul className="list-disc ml-4 space-y-0.5 text-red-700 dark:text-red-300">
                  <li>{t('shared.delete_account.dados_eliminados')}</li>
                  <li>{t('shared.delete_account.acesso_revogado')}</li>
                  <li>{t('shared.delete_account.nao_desfazer')}</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              {t('shared.delete_account.conta_associada')} <span className="font-medium text-slate-900 dark:text-slate-100">{userEmail}</span>
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                {t('shared.cancelar')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                {t('shared.continuar')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {t('shared.delete_account.para_confirmar')}{' '}
              <span className="font-mono font-bold text-red-700 dark:text-red-400">{CONFIRM_WORD}</span>{' '}
              {t('shared.delete_account.no_campo')}
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              className="mb-6 font-mono text-center text-lg tracking-widest border-red-300 focus:border-red-500 focus:ring-red-300"
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setStep(1); setConfirmText(''); }}>
                {t('shared.voltar')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!isConfirmValid}
                onClick={handleConfirm}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('shared.delete_account.eliminar_conta')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
