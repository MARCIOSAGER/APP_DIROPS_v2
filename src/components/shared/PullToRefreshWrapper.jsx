import React from 'react';
import { usePullToRefresh } from './usePullToRefresh';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/components/lib/utils';

/**
 * Wraps children in a pull-to-refresh container.
 * onRefresh must return a Promise.
 */
export default function PullToRefreshWrapper({ onRefresh, children, className }) {
  const { containerRef, isPulling, isRefreshing, pullProgress } = usePullToRefresh(onRefresh);

  const indicatorSize = 36;
  const translateY = isPulling || isRefreshing
    ? Math.min(pullProgress * 72, 72)
    : isRefreshing ? 72 : 0;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-1/2 z-30 flex items-center justify-center rounded-full bg-white shadow-md border border-slate-200 transition-all duration-200"
        style={{
          width: indicatorSize,
          height: indicatorSize,
          top: -indicatorSize / 2,
          transform: `translateX(-50%) translateY(${translateY}px)`,
          opacity: isPulling || isRefreshing ? pullProgress : 0,
          pointerEvents: 'none',
        }}
      >
        <RefreshCw
          className={cn("w-4 h-4 text-blue-600", isRefreshing && "animate-spin")}
          style={{ transform: `rotate(${pullProgress * 360}deg)` }}
        />
      </div>

      {children}
    </div>
  );
}