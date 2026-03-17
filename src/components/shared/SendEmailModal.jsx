import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

export default function SendEmailModal({
  isOpen,
  onClose,
  onSend,
  isSending = false,
  defaultSubject = '',
  defaultRecipient = '',
  defaultBody = ''
}) {
  const { t } = useI18n();
  const [emailData, setEmailData] = useState({
    to: defaultRecipient,
    subject: defaultSubject,
    message: defaultBody
  });

  useEffect(() => {
    if (isOpen) {
      setEmailData({
        to: defaultRecipient,
        subject: defaultSubject,
        message: defaultBody
      });
    }
  }, [isOpen, defaultRecipient, defaultSubject, defaultBody]);

  const [errors, setErrors] = useState({});
  const { guardedSubmit } = useSubmitGuard();

  const validateForm = () => {
    const newErrors = {};

    if (!emailData.to || !emailData.to.trim()) {
      newErrors.to = t('shared.email.destinatario_obrigatorio');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailData.to)) {
      newErrors.to = t('shared.email.email_invalido');
    }

    if (!emailData.subject || !emailData.subject.trim()) {
      newErrors.subject = t('shared.email.assunto_obrigatorio');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    guardedSubmit(async () => {
      // Passar os dados corretos para o callback
      await onSend({
        to: emailData.to.trim(),
        subject: emailData.subject.trim(),
        message: emailData.message.trim()
      });
    });
  };

  const handleClose = () => {
    setEmailData({
      to: defaultRecipient,
      subject: defaultSubject,
      message: defaultBody
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {t('shared.email.enviar_por_email')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="to">{t('shared.email.destinatarios')}</Label>
            <Input
              id="to"
              type="email"
              placeholder="exemplo@email.com"
              value={emailData.to}
              onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
              className={errors.to ? 'border-red-500' : ''}
              disabled={isSending} />

            {errors.to &&
            <p className="text-sm text-red-500 mt-1">{errors.to}</p>
            }
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('shared.email.multiplos')}
            </p>
          </div>

          <div>
            <Label htmlFor="subject">{t('shared.email.assunto')}</Label>
            <Input
              id="subject"
              type="text"
              placeholder={t('shared.email.placeholder_assunto')}
              value={emailData.subject}
              onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
              className={errors.subject ? 'border-red-500' : ''}
              disabled={isSending} />

            {errors.subject &&
            <p className="text-sm text-red-500 mt-1">{errors.subject}</p>
            }
          </div>

          <div>
            <Label htmlFor="message">{t('shared.email.mensagem_adicional')}</Label>
            <Textarea
              id="message"
              placeholder={t('shared.email.placeholder_mensagem')}
              value={emailData.message}
              onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
              rows={4}
              disabled={isSending} />

          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Nota:</strong> {t('shared.email.nota_html')}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSending}>

              {t('shared.cancelar')}
            </Button>
            <Button
              type="submit"
              disabled={isSending} className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-blue-700">


              {isSending ?
              <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('shared.email.enviando')}
                </> :

              <>
                  <Mail className="w-4 h-4 mr-2" />
                  {t('shared.email.enviar_email')}
                </>
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}
