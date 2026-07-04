import React from 'react';

/**
 * PWA/Service Worker removido (app interno em LAN não precisa de cache offline;
 * o SW causava reloads/staleness e exigia F5). Este componente virou no-op —
 * mantido apenas para não quebrar o import em App.jsx. Pode ser removido depois.
 */
export default function AppUpdateBanner() {
  return null;
}
