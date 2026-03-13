import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
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

  // effectiveEmpresaId: se superadmin com viewingAs → usa viewingAs, senão usa o real
  const effectiveEmpresaId = (() => {
    if (user && isSuperAdmin(user) && viewingAsEmpresa) {
      return viewingAsEmpresa.id;
    }
    return user?.empresa_id || null;
  })();

  // Se o user não é superadmin, limpar viewingAs
  useEffect(() => {
    if (user && !isSuperAdmin(user) && viewingAsEmpresa) {
      clearViewingAsEmpresa();
    }
  }, [user, viewingAsEmpresa, clearViewingAsEmpresa]);

  return (
    <CompanyViewContext.Provider value={{
      viewingAsEmpresa,
      setViewingAsEmpresa,
      clearViewingAsEmpresa,
      effectiveEmpresaId,
      isSuperAdminViewing: !!(user && isSuperAdmin(user)),
    }}>
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
