import React from 'react';
import { useI18n } from '@/components/lib/i18n';

export default function GlobalLoadingModal({ isOpen, message }) {
  const { t } = useI18n();

  if (!isOpen) return null;

  const displayMessage = message || t('shared.loading');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-8 shadow-xl text-center max-w-sm">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
        <p className="text-slate-700 dark:text-slate-300 font-medium text-lg">{displayMessage}</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-3">{t('shared.por_favor_aguarde')}</p>
      </div>
    </div>
  );
}
