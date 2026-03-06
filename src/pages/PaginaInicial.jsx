import React, { useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';

// Página desativada - redireciona automaticamente para ValidacaoAcesso
export default function PaginaInicial() {
  useEffect(() => {
    window.location.href = createPageUrl('ValidacaoAcesso');
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
        <p className="text-lg text-slate-700">A redirecionar...</p>
      </div>
    </div>
  );
}