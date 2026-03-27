import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Send, Users } from 'lucide-react';

export default function TesteNotificacaoModal({
  formData,
  testeData,
  currentUser,
  isSendingTest,
  t,
  onSetTesteData,
  onEnviarTeste,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{t('notificacoes.enviarTeste')}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {t('notificacoes.enviarTesteDesc')}
        </p>

        <div className="space-y-4 mb-6">
          {formData.canal_envio.includes('email') && (
            <div>
              <Label htmlFor="teste-email">{t('notificacoes.emailOpcional')}</Label>
              <Input
                id="teste-email"
                type="email"
                value={testeData.email}
                onChange={(e) => onSetTesteData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={currentUser?.email || 'Seu email'}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('notificacoes.emailDeixarVazio').replace('{email}', currentUser?.email || '')}
              </p>
            </div>
          )}

          {formData.canal_envio.includes('whatsapp') && (
            <div>
              <Label htmlFor="teste-whatsapp">{t('notificacoes.whatsappOpcional')}</Label>
              <Input
                id="teste-whatsapp"
                type="tel"
                value={testeData.whatsapp}
                onChange={(e) => onSetTesteData(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="whatsapp:+244..."
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('notificacoes.whatsappFormato')}
              </p>
            </div>
          )}

          {formData.canal_envio.includes('whatsapp') && formData.grupo_whatsapp_id && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-green-600" />
                <Label className="font-medium text-green-900">{t('notificacoes.grupoWhatsappOpcional')}</Label>
              </div>
              <div className="text-sm text-green-800 mb-2">
                <p><strong>{t('notificacoes.grupoIdLabel')}</strong> {formData.grupo_whatsapp_id}</p>
              </div>
              <p className="text-xs text-green-700">
                💡 {t('notificacoes.grupoDica')}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSendingTest}
          >
            {t('notificacoes.cancelar')}
          </Button>
          <Button
            onClick={() => onEnviarTeste()}
            disabled={isSendingTest}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSendingTest ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {t('notificacoes.enviando')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {t('notificacoes.enviarTeste')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
