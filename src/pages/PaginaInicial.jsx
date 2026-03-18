import React, { useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

// Página desativada - redireciona automaticamente para ValidacaoAcesso
export default function PaginaInicial() {
  const { t } = useI18n();

  useEffect(() => {
    window.location.href = createPageUrl('ValidacaoAcesso');
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 dark:text-blue-400 mb-4" />
        <p className="text-lg text-slate-700 dark:text-slate-300">{t('senha.redirecionando')}</p>
      </div>
    </div>
  );
}