import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

// Aviso global de conexão. Detecta queda (evento offline do navegador OU o servidor
// ficar inalcançável) e mostra uma faixa "Sem conexão — a reconectar". Quando a rede
// volta, recarrega automaticamente os dados (invalidateQueries) — sem precisar de F5.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CHECK_INTERVAL = 8000;   // sonda o servidor a cada 8s
const FAILS_TO_OFFLINE = 2;    // 2 falhas seguidas (~16s) antes de declarar offline (evita flicker)

export default function ConnectionBanner() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const failsRef = useRef(0);
  const offlineRef = useRef(false);

  const recover = useCallback(() => {
    // Rede voltou: refetch só das queries ATIVAS (o que está no ecrã) — destrava
    // a página sem F5. Antes fazia invalidateQueries() GLOBAL (marca TODO o cache
    // como stale), que num blip de rede disparava um burst de refetch de tudo
    // (1000 voos + RPCs) e congelava a UI logo após reconectar.
    try {
      qc.refetchQueries({ type: 'active' });
    } catch { /* no-op */ }
    setReconnected(true);
    setTimeout(() => setReconnected(false), 3500);
  }, [qc]);

  const apply = useCallback((isOffline) => {
    if (offlineRef.current && !isOffline) recover(); // transição offline -> online
    offlineRef.current = isOffline;
    setOffline(isOffline);
  }, [recover]);

  const probe = useCallback(async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/aeroporto?limit=1`, {
        method: 'HEAD',
        headers: { apikey: SUPABASE_ANON_KEY },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      failsRef.current = 0;
      apply(false);
    } catch {
      failsRef.current += 1;
      if (failsRef.current >= FAILS_TO_OFFLINE) apply(true);
    }
  }, [apply]);

  useEffect(() => {
    const onOffline = () => apply(true);
    const onOnline = () => { failsRef.current = 0; probe(); };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (!navigator.onLine) apply(true);
    const id = setInterval(probe, CHECK_INTERVAL);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      clearInterval(id);
    };
  }, [probe, apply]);

  if (offline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 px-4 py-2 text-sm">
          <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>Sem conexão com o servidor — a reconectar automaticamente…</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Recarregar
          </button>
        </div>
      </div>
    );
  }

  if (reconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-600 text-white shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 px-4 py-2 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>Conexão restabelecida — dados atualizados.</span>
        </div>
      </div>
    );
  }

  return null;
}
