import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export const LoadingSpinner = React.memo(function LoadingSpinner({ size = 'md', className, label }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn(SIZES[size] || SIZES.md, 'animate-spin text-blue-600 dark:text-blue-400')} />
      {label && <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">{label}</span>}
    </div>
  );
});

export const PageLoading = React.memo(function PageLoading({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <LoadingSpinner size="lg" />
      {label && <p className="mt-4 text-slate-600 dark:text-slate-400">{label}</p>}
    </div>
  );
});

export const ButtonSpinner = React.memo(function ButtonSpinner() {
  return <Loader2 className="w-4 h-4 animate-spin" />;
});
