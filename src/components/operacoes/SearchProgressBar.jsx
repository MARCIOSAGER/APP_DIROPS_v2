import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

export default function SearchProgressBar({ progress, totalFlights, elapsedTime, estimatedTime, currentPage, error, isComplete }) {
  const { t } = useI18n();
  const percentage = totalFlights > 0 ? Math.min(Math.round((progress / totalFlights) * 100), 100) : 0;

  const formatTime = (ms) => {
    if (!ms || ms <= 0) return '0s';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getStatusMessage = () => {
    if (error) return t('searchProgress.erroPesquisa');
    if (isComplete) return t('searchProgress.pesquisaConcluida');
    return `${t('searchProgress.extraindoVoos')} ${currentPage})...`;
  };

  return (
    <Card className={`${error ? 'border-red-300 bg-red-50' : isComplete ? 'border-green-300 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {error ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            )}
            <span className={`text-sm font-semibold ${error ? 'text-red-700' : isComplete ? 'text-green-700' : 'text-blue-700'}`}>
              {getStatusMessage()}
            </span>
          </div>
          <span className={`text-sm font-semibold ${error ? 'text-red-700' : isComplete ? 'text-green-700' : 'text-slate-600'}`}>
            {progress}/{totalFlights} {t('searchProgress.voos')}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                error ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-600'
              }`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <div className={`text-xs font-semibold text-right ${error ? 'text-red-700' : isComplete ? 'text-green-700' : 'text-blue-700'}`}>
            {percentage}%
          </div>
        </div>

        {/* Time Information */}
        {!error && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white rounded p-2 border border-slate-200">
              <div className="text-slate-500 text-xs">{t('searchProgress.tempoDecorrido')}</div>
              <div className="font-semibold text-slate-800">{formatTime(elapsedTime)}</div>
            </div>
            <div className="bg-white rounded p-2 border border-slate-200">
              <div className="text-slate-500 text-xs">{t('searchProgress.tempoEstimado')}</div>
              <div className="font-semibold text-slate-800">{isComplete ? t('searchProgress.completo') : formatTime(estimatedTime)}</div>
            </div>
            <div className="bg-white rounded p-2 border border-slate-200">
              <div className="text-slate-500 text-xs">{t('searchProgress.tempoRestante')}</div>
              <div className="font-semibold text-slate-800">
                {isComplete ? t('searchProgress.finalizado') : (estimatedTime > elapsedTime ? formatTime(estimatedTime - elapsedTime) : t('searchProgress.finalizando'))}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded">
            <div className="text-xs font-semibold text-red-800 mb-1">{t('searchProgress.erroBuscar')}</div>
            <div className="text-xs text-red-700 break-words">{error}</div>
          </div>
        )}

        {/* Success Message */}
        {isComplete && !error && (
          <div className="p-3 bg-green-100 border border-green-300 rounded">
            <div className="text-xs font-semibold text-green-800">{progress} {t('searchProgress.prontosImportacao')}</div>
            <div className="text-xs text-green-700 mt-1">{t('searchProgress.tabelaAtualizada')}</div>
          </div>
        )}

        {/* Rate Limit Warning */}
        {!error && !isComplete && (
          <div className="p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-700">
            {t('searchProgress.limiteRequisicoes')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}