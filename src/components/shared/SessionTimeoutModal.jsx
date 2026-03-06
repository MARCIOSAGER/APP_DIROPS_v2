import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

// Tempo de inatividade antes de mostrar o aviso (30 minutos em ms)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
// Tempo para o utilizador responder antes do logout automático (2 minutos em ms)
const WARNING_TIMEOUT = 2 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

export default function SessionTimeoutModal() {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(120);
  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);
  const countdownInterval = useRef(null);

  const logout = useCallback(async () => {
    clearAll();
    try {
      await base44.auth.logout(createPageUrl('ValidacaoAcesso'));
    } catch {
      window.location.href = createPageUrl('ValidacaoAcesso');
    }
  }, []);

  const clearAll = () => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(countdownInterval.current);
  };

  const resetTimer = useCallback(() => {
    if (showWarning) return; // Não resetar se o aviso está visível
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(WARNING_TIMEOUT / 1000);

      // Iniciar contagem decrescente
      countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Logout automático após WARNING_TIMEOUT
      warningTimer.current = setTimeout(() => {
        logout();
      }, WARNING_TIMEOUT);
    }, INACTIVITY_TIMEOUT);
  }, [showWarning, logout]);

  const handleKeepSession = () => {
    setShowWarning(false);
    clearAll();
    resetTimer();
  };

  useEffect(() => {
    // Iniciar timer ao montar
    resetTimer();

    // Adicionar listeners de atividade
    const handleActivity = () => resetTimer();
    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, []);

  // Quando countdown chega a 0, fazer logout
  useEffect(() => {
    if (countdown === 0 && showWarning) {
      logout();
    }
  }, [countdown, showWarning, logout]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  if (!showWarning) return null;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Clock className="w-5 h-5" />
            Sessão prestes a expirar
          </DialogTitle>
        </DialogHeader>

        <div className="text-center py-4 space-y-4">
          <p className="text-slate-600">
            A sua sessão irá expirar automaticamente por inatividade.
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-xl py-6">
            <p className="text-4xl font-bold text-orange-600 font-mono">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
            <p className="text-sm text-orange-500 mt-1">tempo restante</p>
          </div>

          <p className="text-sm text-slate-500">
            Clique em "Manter Sessão" para continuar ou será desligado automaticamente.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair agora
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={handleKeepSession}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Manter Sessão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}