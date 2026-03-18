import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/**
 * Shows a non-intrusive banner when a new app version is available.
 * Uses VitePWA's service worker update mechanism.
 * The user chooses when to update — no forced reloads mid-task.
 */
export default function AppUpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for updates every 5 minutes
      if (r) {
        setInterval(() => r.update(), 5 * 60 * 1000);
      }
    }
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-blue-700 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4">
      <RefreshCw className="h-4 w-4 shrink-0" />
      <span>Nova versão disponível</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="ml-2 bg-white text-blue-700 px-3 py-1 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
      >
        Atualizar agora
      </button>
    </div>
  );
}
