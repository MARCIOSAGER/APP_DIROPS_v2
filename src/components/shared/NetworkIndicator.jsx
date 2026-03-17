import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/components/lib/i18n';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PING_INTERVAL = 10000; // 10 seconds
const PING_SAMPLES = 5; // median of last 5 pings — more stable than average

function getSignalInfo(latency, t) {
  if (latency === null) return { label: t('shared.network.offline'), color: 'text-red-500', barColor: 'bg-red-500', bars: 0 };
  if (latency < 150) return { label: t('shared.network.forte'), color: 'text-green-600', barColor: 'bg-green-500', bars: 4 };
  if (latency < 300) return { label: t('shared.network.bom'), color: 'text-green-500', barColor: 'bg-green-400', bars: 3 };
  if (latency < 600) return { label: t('shared.network.fraco'), color: 'text-yellow-500', barColor: 'bg-yellow-500', bars: 2 };
  return { label: t('shared.network.lento'), color: 'text-orange-500', barColor: 'bg-orange-500', bars: 1 };
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function SignalBars({ bars, barColor }) {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={`w-[3px] rounded-sm transition-colors duration-500 ${i <= bars ? barColor : 'bg-slate-200 dark:bg-slate-700'}`}
          style={{ height: `${4 + i * 3}px` }}
        />
      ))}
    </div>
  );
}

export default function NetworkIndicator() {
  const [latency, setLatency] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const intervalRef = useRef(null);
  const samplesRef = useRef([]);
  const controllerRef = useRef(null);
  const { t } = useI18n();

  const ping = useCallback(async () => {
    if (!navigator.onLine) {
      setLatency(null);
      setIsOnline(false);
      return;
    }

    // Abort any previous in-flight ping
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    try {
      const start = performance.now();
      await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        cache: 'no-store',
        signal: controllerRef.current.signal,
      });
      const ms = Math.round(performance.now() - start);

      samplesRef.current.push(ms);
      if (samplesRef.current.length > PING_SAMPLES) {
        samplesRef.current.shift();
      }

      // Use median — ignores outliers (cold starts, spikes)
      setLatency(median(samplesRef.current));
      setIsOnline(true);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setLatency(null);
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    ping();
    intervalRef.current = setInterval(ping, PING_INTERVAL);

    const handleOnline = () => { setIsOnline(true); ping(); };
    const handleOffline = () => { setIsOnline(false); setLatency(null); samplesRef.current = []; };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(intervalRef.current);
      if (controllerRef.current) controllerRef.current.abort();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [ping]);

  const signal = isOnline ? getSignalInfo(latency, t) : getSignalInfo(null, t);

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 select-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title={`Latência: ${latency !== null ? latency + ' ms' : 'N/A'} (mediana de ${samplesRef.current.length} amostras)\nClique para medir agora`}
      onClick={ping}
    >
      <SignalBars bars={signal.bars} barColor={signal.barColor} />
      <div className="flex flex-col leading-none">
        <span className={`text-[10px] font-semibold ${signal.color} transition-colors duration-500`}>{signal.label}</span>
        {latency !== null && (
          <span className="text-[9px] text-slate-400">{latency} ms</span>
        )}
      </div>
    </div>
  );
}
