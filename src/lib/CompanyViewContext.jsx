import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { isSuperAdmin } from '@/components/lib/userUtils';

const CompanyViewContext = createContext();

const STORAGE_KEY = 'dirops_viewing_as_empresa';

export const CompanyViewProvider = ({ children }) => {
  const { user } = useAuth();
  const [viewingAsEmpresa, setViewingAsState] = useState(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setViewingAsState(JSON.parse(stored));
      }
    } catch { /* ignore */ }
  }, []);

  const setViewingAsEmpresa = useCallback((empresa) => {
    setViewingAsState(empresa);
    if (empresa) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(empresa));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearViewingAsEmpresa = useCallback(() => {
    setViewingAsState(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const isSuperAdminViewing = useMemo(() => !!(user && isSuperAdmin(user)), [user]);

  // effectiveEmpresaId: se superadmin com viewingAs → usa viewingAs, senão usa o real
  const effectiveEmpresaId = useMemo(() => {
    if (isSuperAdminViewing && viewingAsEmpresa) {
      return viewingAsEmpresa.id;
    }
    return user?.empresa_id || null;
  }, [isSuperAdminViewing, viewingAsEmpresa, user]);

  // Se o user não é superadmin, limpar viewingAs
  useEffect(() => {
    if (user && !isSuperAdmin(user) && viewingAsEmpresa) {
      clearViewingAsEmpresa();
    }
  }, [user, viewingAsEmpresa, clearViewingAsEmpresa]);

  // Value memoizado evita re-render dos consumidores a cada render do provider.
  const value = useMemo(() => ({
    viewingAsEmpresa,
    setViewingAsEmpresa,
    clearViewingAsEmpresa,
    effectiveEmpresaId,
    isSuperAdminViewing,
  }), [viewingAsEmpresa, setViewingAsEmpresa, clearViewingAsEmpresa, effectiveEmpresaId, isSuperAdminViewing]);

  return (
    <CompanyViewContext.Provider value={value}>
      {children}
    </CompanyViewContext.Provider>
  );
};

export const useCompanyView = () => {
  const ctx = useContext(CompanyViewContext);
  if (!ctx) {
    // Fallback for components outside provider
    return {
      viewingAsEmpresa: null,
      setViewingAsEmpresa: () => {},
      clearViewingAsEmpresa: () => {},
      effectiveEmpresaId: null,
      isSuperAdminViewing: false,
    };
  }
  return ctx;
};
