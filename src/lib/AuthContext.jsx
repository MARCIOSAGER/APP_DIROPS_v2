import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadUserProfile = useCallback(async (authUser) => {
    try {
      console.log('[AUTH] Loading profile for:', authUser.email);
      let { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

      // Auto-create profile for new users (first login)
      if (error?.code === 'PGRST116' || !profile) {
        console.log('[AUTH] No profile found, creating one for:', authUser.email);
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
          console.warn('[AUTH] Failed to create profile:', createError.message);
        }
      } else if (error) {
        console.warn('[AUTH] Profile query error:', error.message);
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
      console.log('[AUTH] Profile loaded:', { email: userData.email, status: userData.status, perfis: userData.perfis, role: userData.role });
      setUser(userData);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('[AUTH] Failed to load profile:', err);
      setUser({ id: authUser.id, email: authUser.email });
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        console.log('[AUTH] Checking session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[AUTH] Session result:', !!session, error?.message || 'ok');

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
          console.log('[AUTH] Init complete, setting isLoadingAuth=false');
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
        console.log('[AUTH] State change:', event);
        if (cancelled) return;

        if (event === 'SIGNED_IN' && session?.user) {
          await loadUserProfile(session.user);
          setIsLoadingAuth(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          await loadUserProfile(session.user);
        }
      }
    );

    // Re-check session when tab becomes visible again (after hibernate/suspend)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        console.log('[AUTH] Tab became visible, refreshing session...');
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
