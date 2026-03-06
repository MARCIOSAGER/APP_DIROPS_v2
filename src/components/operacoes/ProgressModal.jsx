import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function ProgressModal({ 
  isOpen, 
  title = "Processando...",
  currentStep = 0,
  totalSteps = 0,
  successCount = 0,
  errorCount = 0,
  currentItem = "",
  errors = []
}) {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const isComplete = currentStep === totalSteps;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!isComplete && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
            {isComplete && errorCount === 0 && <CheckCircle className="w-5 h-5 text-green-600" />}
            {isComplete && errorCount > 0 && <AlertCircle className="w-5 h-5 text-orange-600" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Barra de progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Progresso</span>
              <span className="font-medium">{currentStep} de {totalSteps}</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Item atual sendo processado */}
          {!isComplete && currentItem && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <span className="font-medium">Processando:</span> {currentItem}
              </p>
            </div>
          )}

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-xs text-green-600 font-medium">Sucesso</p>
                  <p className="text-lg font-bold text-green-900">{successCount}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <div>
                  <p className="text-xs text-red-600 font-medium">Erros</p>
                  <p className="text-lg font-bold text-red-900">{errorCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de erros (se houver) */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-sm font-medium text-red-900 mb-2">Erros encontrados:</p>
              <ul className="space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-xs text-red-700">
                    • {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mensagem de conclusão */}
          {isComplete && (
            <div className={`${errorCount === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-3`}>
              <p className={`text-sm font-medium ${errorCount === 0 ? 'text-green-900' : 'text-orange-900'}`}>
                {errorCount === 0 
                  ? '✅ Processamento concluído com sucesso!'
                  : `⚠️ Processamento concluído com ${errorCount} erro(s).`
                }
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}