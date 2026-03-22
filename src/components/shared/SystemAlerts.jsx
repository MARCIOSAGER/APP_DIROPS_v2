import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { AlertTriangle, Link2, Plane, X, ChevronRight } from 'lucide-react';

const DISMISS_KEY = 'systemAlerts_dismissed';
const DISMISS_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    // Clean expired entries
    const cleaned = {};
    for (const [key, ts] of Object.entries(parsed)) {
      if (now - ts < DISMISS_TTL) cleaned[key] = ts;
    }
    return cleaned;
  } catch {
    return {};
  }
}

function dismissAlert(type) {
  const current = getDismissed();
  current[type] = Date.now();
  localStorage.setItem(DISMISS_KEY, JSON.stringify(current));
}

const ALERT_CONFIG = {
  mtow: {
    icon: AlertTriangle,
    color: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
    iconColor: 'text-red-500',
    label: (count) => `${count} aeronave${count !== 1 ? 's' : ''} sem MTOW — tarifas de pouso incompletas`,
    linkLabel: 'Corrigir',
    linkTo: createPageUrl('Operacoes'),
  },
  voos_sem_link: {
    icon: Link2,
    color: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200',
    iconColor: 'text-amber-500',
    label: (count) => `${count} voo${count !== 1 ? 's' : ''} sem link nos ultimos 30 dias`,
    linkLabel: 'Corrigir',
    linkTo: createPageUrl('Operacoes'),
  },
  fr24: {
    icon: Plane,
    color: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
    iconColor: 'text-blue-500',
    label: (count) => `${count} voo${count !== 1 ? 's' : ''} FR24 pendente${count !== 1 ? 's' : ''} para importacao`,
    linkLabel: 'Ver',
    linkTo: createPageUrl('FR24'),
  },
};

export default function SystemAlerts() {
  const { currentUser } = useAuth();
  const { effectiveEmpresaId } = useCompanyView();
  const [alerts, setAlerts] = useState({});
  const [dismissed, setDismissed] = useState(() => getDismissed());

  const empresaId = effectiveEmpresaId || currentUser?.empresa_id;
  const canView = !!empresaId;

  const fetchAlerts = useCallback(async () => {
    if (!canView || !empresaId) return;

    const results = {};

    try {
      // a) Registos sem MTOW
      const { count: mtowCount } = await supabase
        .from('registo_aeronave')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .or('mtow_kg.is.null,mtow_kg.eq.0');

      if (mtowCount > 0) results.mtow = mtowCount;
    } catch (e) {
      console.warn('SystemAlerts: mtow check failed', e);
    }

    try {
      // b) Voos sem link (via server-side RPC)
      const { data: dashStats } = await supabase.rpc('get_dashboard_stats', {
        p_empresa_id: empresaId,
        p_dias: 30,
      });

      if (dashStats && dashStats.sem_link > 0) {
        results.voos_sem_link = dashStats.sem_link;
      }
    } catch (e) {
      console.warn('SystemAlerts: voos sem link check failed', e);
    }

    try {
      // c) FR24 pendentes
      const { count: fr24Count } = await supabase
        .from('cache_voo_f_r24')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');

      if (fr24Count > 0) results.fr24 = fr24Count;
    } catch (e) {
      console.warn('SystemAlerts: fr24 check failed', e);
    }

    setAlerts(results);
  }, [canView, empresaId]);

  useEffect(() => {
    if (!canView) return;

    // Delay initial fetch to not block page load
    const initialTimeout = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => fetchAlerts());
      } else {
        fetchAlerts();
      }
    }, 2000);

    // Refresh every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [canView, fetchAlerts]);

  const handleDismiss = (type) => {
    dismissAlert(type);
    setDismissed(prev => ({ ...prev, [type]: Date.now() }));
  };

  if (!canView) return null;

  const visibleAlerts = Object.entries(alerts).filter(
    ([type, count]) => count > 0 && !dismissed[type]
  );

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-0">
      {visibleAlerts.map(([type, count]) => {
        const config = ALERT_CONFIG[type];
        if (!config) return null;
        const Icon = config.icon;

        return (
          <div
            key={type}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs border-b ${config.color}`}
          >
            <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${config.iconColor}`} />
            <span className="flex-1">{config.label(count)}</span>
            <Link
              to={config.linkTo}
              className="inline-flex items-center gap-0.5 font-medium hover:underline flex-shrink-0"
            >
              {config.linkLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
            <button
              onClick={() => handleDismiss(type)}
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0"
              aria-label="Dispensar alerta"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
