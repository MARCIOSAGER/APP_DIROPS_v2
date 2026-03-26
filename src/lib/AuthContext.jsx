import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadUserProfile = useCallback(async (authUser) => {
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
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Guard: only reload profile if the user identity actually changed.
          // TOKEN_REFRESHED fires every ~55 minutes (Supabase token lifetime).
          // If the user.id is the same, the profile is unchanged — skip the DB call
          // to prevent a ghost re-render mid-session.
          if (session.user.id !== user?.id) {
            await loadUserProfile(session.user);
          }
        }
      }
    );

    // Re-check session when tab becomes visible again (after hibernate/suspend)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        // Tab became visible, refreshing session
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (cancelled) return;
          if (error || !session) {
            console.warn('[AUTH] Session lost after hibernate, redirecting to login');
            setUser(null);
            setIsAuthenticated(false);
            window.location.href = '/ValidacaoAcesso';
            return;
          }
          // Session valid — refresh token proactively
          await supabase.auth.refreshSession();
        } catch (err) {
          console.warn('[AUTH] Visibility check error:', err);
        }
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

  const logout = async (shouldRedirect = true) => {
    queryClientInstance.clear();
    setUser(null);
    setIsAuthenticated(false);
    await supabase.auth.signOut();
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

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

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      logout,
      navigateToLogin,
      checkAppState
    }}>
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
