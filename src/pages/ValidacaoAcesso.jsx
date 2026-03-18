
import React from 'react';
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserProfilesExist } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';

export default function ValidacaoAcesso() {
  const { t } = useI18n();
  const { user: authUser, isLoadingAuth, isAuthenticated } = useAuth();

  React.useEffect(() => {
    if (isLoadingAuth) return;

    if (!isAuthenticated) {
      console.debug('[VALIDACAO] Não autenticado, indo para login');
      window.location.href = '/login';
      return;
    }

    if (!authUser) return;

    const user = ensureUserProfilesExist({ ...authUser });
    console.debug('[VALIDACAO] User:', { email: user.email, status: user.status, perfis: user.perfis, role: user.role });

    if (user.status === 'ativo' && user.perfis && user.perfis.length > 0) {
      console.debug('[VALIDACAO] Ativo com perfis, indo para Home');
      window.location.href = createPageUrl('Home');
      return;
    }

    console.debug('[VALIDACAO] Sem perfis, indo para SolicitacaoPerfil');
    window.location.href = createPageUrl('SolicitacaoPerfil');
  }, [isLoadingAuth, isAuthenticated, authUser]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 dark:text-blue-400 mb-4" />
        <p className="text-lg text-slate-700 dark:text-slate-300">{t('validacao.validando')}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('validacao.aguarde')}</p>
      </div>
    </div>
  );
}
