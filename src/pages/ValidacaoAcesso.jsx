
import React from 'react';
import { createPageUrl } from '@/utils';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserProfilesExist } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';

export default function ValidacaoAcesso() {
  const { t } = useI18n();
  const { user: authUser, isLoadingAuth, isAuthenticated, checkAppState } = useAuth();

  React.useEffect(() => {
    if (isLoadingAuth) return;

    if (!isAuthenticated) {
      console.debug('[VALIDACAO] Não autenticado, indo para login');
      window.location.href = '/login';
      return;
    }

    if (!authUser) return;

    // Profile failed to load (network error) — don't redirect, show retry
    if (authUser._profileLoadFailed) {
      console.debug('[VALIDACAO] Profile load failed, showing retry');
      return;
    }

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

  // Show retry UI if profile failed to load
  if (!isLoadingAuth && authUser?._profileLoadFailed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-orange-500 mb-4" />
          <p className="text-lg text-slate-700 dark:text-slate-300 mb-2">Erro ao carregar o perfil</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Verifique a sua ligação e tente novamente.</p>
          <button
            onClick={checkAppState}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

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
