import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * usePullToRefresh – attaches a pull-to-refresh gesture to a scrollable container.
 *
 * Usage:
 *   const { containerRef, isPulling, isRefreshing, pullProgress } = usePullToRefresh(onRefresh);
 *   <div ref={containerRef} className="overflow-y-auto">...</div>
 *
 * Returns:
 *   containerRef    – attach to the scrollable element
 *   isRefreshing    – true while onRefresh promise is pending
 *   isPulling       – true while the user is dragging down before threshold
 *   pullProgress    – 0..1 pull distance fraction
 */
export function usePullToRefresh(onRefresh, { threshold = 72 } = {}) {
  const containerRef = useRef(null);
  const startY = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  const handleTouchStart = useCallback((e) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY.current === null || isRefreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      startY.current = null;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }
    const el = containerRef.current;
    if (el && el.scrollTop > 0) {
      startY.current = null;
      return;
    }
    e.preventDefault();
    setPullDistance(delta);
    setIsPulling(true);
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
    startY.current = null;
  }, [isPulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, isPulling, isRefreshing, pullProgress };
}