import React, { useEffect, useState } from 'react';

/**
 * Spinner de tela cheia com "escape hatch": se o carregamento passar de `timeoutMs`,
 * mostra um botão "Recarregar página" + aviso — assim o utilizador nunca fica preso
 * num spinner sem saída (antes só o F5 resolvia). Usado nos gates full-page do app
 * (carregamento de auth, permissões e chunks de rota).
 */
export default function LoadingWatchdog({ message = 'A carregar…', timeoutMs = 12000 }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 p-6 text-center">
      <div className="w-9 h-9 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {slow && (
        <div className="mt-2 max-w-xs">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            Está a demorar mais que o normal — pode ser a ligação à rede.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Recarregar página
          </button>
        </div>
      )}
    </div>
  );
}
