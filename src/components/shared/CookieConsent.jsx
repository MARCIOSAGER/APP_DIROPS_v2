import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

const COOKIE_KEY = 'dirops_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-2xl mx-auto bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 text-sm leading-relaxed">
          <p>
            {t('shared.cookie.texto')}{' '}
            <a href="/PoliticaPrivacidade" className="text-blue-400 hover:text-blue-300 underline">
              {t('shared.cookie.politica')}
            </a>
            {' '}{t('shared.cookie.e')}{' '}
            <a href="/TermosServico" className="text-blue-400 hover:text-blue-300 underline">
              {t('shared.cookie.termos')}
            </a>.
          </p>
        </div>
        <Button
          onClick={accept}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 whitespace-nowrap"
        >
          {t('shared.cookie.aceitar')}
        </Button>
      </div>
    </div>
  );
}
