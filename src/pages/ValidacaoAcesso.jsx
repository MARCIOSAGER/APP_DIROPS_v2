
import React from 'react';
import { createPageUrl } from '@/utils';
import { Loader2, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserProfilesExist } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';

export default function ValidacaoAcesso() {
  const { t } = useI18n();
  const { user: authUser, isLoadingAuth, isAuthenticated, checkAppState, logout } = useAuth();
  const retriedRef = React.useRef(false);

  React.useEffect(() => {
    if (isLoadingAuth) return;

    if (!isAuthenticated) {
      console.debug('[VALIDACAO] Não autenticado, indo para login');
      window.location.href = '/login';
      return;
    }

    if (!authUser) return;

    if (authUser._profileLoadFailed) {
      if (!retriedRef.current) {
        // Auto-retry once silently
        retriedRef.current = true;
        console.debug('[VALIDACAO] Profile load failed, auto-retrying...');
        checkAppState();
      }
      // If retry also fails, stay on this page and show error UI below
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
  }, [isLoadingAuth, isAuthenticated, authUser, checkAppState]);

  // Show error UI after retry also failed
  if (!isLoadingAuth && authUser?._profileLoadFailed && retriedRef.current) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <AlertCircle className="h-12 w-12 mx-auto text-orange-500 mb-4" />
          <p className="text-lg text-slate-700 dark:text-slate-300 mb-2">Erro ao carregar o perfil</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Verifique a sua ligação e tente novamente.</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { retriedRef.current = false; checkAppState(); }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
            <button
              onClick={() => logout()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Sair e entrar novamente
            </button>
          </div>
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
