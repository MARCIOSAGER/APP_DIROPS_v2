import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Plane, Shield, UserCog } from 'lucide-react';
import { createPageUrl } from '@/utils';

const tabs = [
  { label: 'Dashboard', icon: Home, url: createPageUrl('Home') },
  { label: 'Operações', icon: Plane, url: createPageUrl('Operacoes') },
  { label: 'Safety', icon: Shield, url: createPageUrl('Safety') },
  { label: 'Perfil', icon: UserCog, url: createPageUrl('ConfigurarPerfil') },
];

export default function BottomTabs() {
  const location = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.url;
        return (
          <Link
            key={tab.label}
            to={tab.url}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 select-none transition-colors ${
              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}