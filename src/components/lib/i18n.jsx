import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { translations } from '@/i18n';

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('language') || 'pt';
    }
    return 'pt';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', language);
    }
  }, [language]);

  // t só muda quando o idioma muda; value memoizado evita re-render global
  // (useI18n é consumido por quase todos os componentes).
  const t = useCallback((key) => {
    return translations[language]?.[key] || key;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
