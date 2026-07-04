import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext();

// Avisa os admins que um novo utilizador entrou no 1º login (perfil auto-criado
// como pendente). Sem isto, quem cria a conta e não conclui o SolicitacaoPerfil
// fica pendente e INVISÍVEL (não gera solicitação nem email). Mira os admins da
// empresa operadora SGA — todos @sga.co.ao, entregáveis; o relay SGA bloqueia
// externos (ex.: super-admin no gmail), então o servidor resolve os admins @sga.
// Fire-and-forget: não bloqueia o carregamento da sessão.
async function notifyAdminsNewUser(authUser, profile) {
  try {
    let empresaId = null;
    try {
      const { data: emp } = await supabase
        .from('empresa')
        .select('id')
        .eq('tipo', 'operadora')
        .ilike('nome', 'SGA%')
        .limit(1)
        .maybeSingle();
      empresaId = emp?.id || null;
    } catch { /* segue sem empresa (servidor cai nos admins sem empresa) */ }
    const { sendNotificationEmail } = await import('@/functions/sendNotificationEmail');
    await sendNotificationEmail({
      template: 'new_access_request',
      data: {
        full_name: profile?.full_name || authUser.email,
        email: authUser.email,
        empresa_id: empresaId,
        url: `${window.location.origin}/GestaoAcessos`,
      },
    });
  } catch (e) {
    console.warn('[AUTH] Não foi possível notificar admins do novo utilizador:', e?.message);
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  // Guarda o id do utilizador atual sem depender do closure do onAuthStateChange
  // (que captura `user` do primeiro render, sempre null → guarda de TOKEN_REFRESHED
  // falhava e recarregava o perfil a cada refresh de token).
  const userIdRef = useRef(null);

  const loadUserProfile = useCallback(async (authUser) => {
    userIdRef.current = authUser.id;
    try {
      // Auth debug logging removed for security (M-05)
      let { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

      if (error?.code === 'PGRST116') {
        // Genuine new user — auto-create profile (first login)
        // No profile found, auto-creating
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert({
            auth_id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || '',
            status: 'pendente',
            perfis: [],
            aeroportos_acesso: [],
          })
          .select()
          .single();

        if (!createError) {
          profile = newProfile;
          // 1º login: avisar os admins da SGA (background, não bloqueia a sessão).
          notifyAdminsNewUser(authUser, newProfile);
        } else {
          // Auto-create also failed (e.g. user already exists but RLS blocked SELECT)
          console.warn('[AUTH] Failed to create profile:', createError.message);
          setUser({ id: authUser.id, email: authUser.email, _profileLoadFailed: true });
          setIsAuthenticated(true);
          return;
        }
      } else if (error || !profile) {
        // Other error (network, RLS, etc.) — don't auto-create, show retry
        console.warn('[AUTH] Profile query failed (non-404):', error?.message || 'no profile returned');
        setUser({ id: authUser.id, email: authUser.email, _profileLoadFailed: true });
        setIsAuthenticated(true);
        return;
      }

      const userData = {
        id: authUser.id,
        email: authUser.email,
        ...(profile || {}),
      };
      // Derive role from perfis if not set in DB
      if (!userData.role) {
        userData.role = (Array.isArray(userData.perfis) && userData.perfis.includes('administrador')) ? 'admin' : 'user';
      }
      // Profile loaded successfully
      setUser(userData);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('[AUTH] Failed to load profile:', err);
      // Mark profileLoadFailed so ValidacaoAcesso doesn't redirect to SolicitacaoPerfil
      setUser({ id: authUser.id, email: authUser.email, _profileLoadFailed: true });
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('[AUTH] Init error:', err);
        if (!cancelled) {
          setAuthError({ type: 'unknown', message: err.message });
        }
      } finally {
        if (!cancelled) {
          // Init complete
          setIsLoadingAuth(false);
        }
      }
    };

    init();

    // Safety: never stay loading forever
    const timeout = setTimeout(() => {
      setIsLoadingAuth(prev => {
        if (prev) console.warn('[AUTH] Timeout - forcing isLoadingAuth=false');
        return false;
      });
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Auth state change handled
        if (cancelled) return;

        if (event === 'SIGNED_IN' && session?.user) {
          await loadUserProfile(session.user);
          setIsLoadingAuth(false);
        } else if (event === 'SIGNED_OUT') {
          queryClientInstance.clear();
          userIdRef.current = null;
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Guard: only reload profile if the user identity actually changed.
          // TOKEN_REFRESHED fires every ~55 minutes (Supabase token lifetime).
          // Comparamos com userIdRef (não com `user`, que aqui é o valor do
          // primeiro render = null). Sem isto, a guarda falhava e recarregava
          // o perfil a cada refresh → re-render fantasma de toda a árvore.
          if (session.user.id !== userIdRef.current) {
            await loadUserProfile(session.user);
          }
        }
      }
    );

    // Re-check session when tab becomes visible again (after hibernate/suspend)
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelled) return;
        // Só expulsar o utilizador quando a sessão está REALMENTE ausente e
        // estamos online — um blip de rede (error) ou estar offline não deve
        // atirar para /ValidacaoAcesso ("travou e me jogou fora").
        if (!session && !error && navigator.onLine) {
          console.warn('[AUTH] Session lost after hibernate, redirecting to login');
          userIdRef.current = null;
          setUser(null);
          setIsAuthenticated(false);
          window.location.href = '/ValidacaoAcesso';
        }
        // NÃO forçar refreshSession() aqui: com autoRefreshToken ligado, o
        // supabase-js já renova o token sozinho e serializa via processLock.
        // Um refresh manual incondicional ficava em fila atrás do lock e
        // pendurava sem timeout ao voltar à aba — o "spinner até F5".
      } catch (err) {
        console.warn('[AUTH] Visibility check error:', err);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadUserProfile]);

  const logout = useCallback(async (shouldRedirect = true) => {
    queryClientInstance.clear();
    setUser(null);
    setIsAuthenticated(false);
    // Best-effort server signOut com teto de 3s — NUNCA bloquear o redirect.
    // O /logout do GoTrue pode dar 500/pendurar (ex.: "operation canceled");
    // o utilizador não pode ficar preso na página.
    try {
      const timeout = new Promise(resolve => setTimeout(resolve, 3000));
      await Promise.race([supabase.auth.signOut().catch(() => {}), timeout]);
    } catch {}
    // Limpar as chaves de sessão do supabase pra não reusar sessão meio-revogada.
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.startsWith('supabase.'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    if (shouldRedirect) {
      window.location.replace('/login');
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[AUTH] checkAppState error:', error);
    } finally {
      setIsLoadingAuth(false);
    }
  }, [loadUserProfile]);

  // Value memoizado: só muda quando o estado real de auth muda (não a cada
  // render do provider), evitando re-render de toda a árvore que consome useAuth.
  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    authError,
    logout,
    navigateToLogin,
    checkAppState,
  }), [user, isAuthenticated, isLoadingAuth, authError, logout, navigateToLogin, checkAppState]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
