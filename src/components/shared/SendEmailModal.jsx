import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function SendEmailModal({
  isOpen,
  onClose,
  onSend,
  isSending = false,
  defaultSubject = '',
  defaultRecipient = '',
  defaultBody = ''
}) {
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
      newErrors.to = 'O destinatário é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailData.to)) {
      newErrors.to = 'Email inválido';
    }

    if (!emailData.subject || !emailData.subject.trim()) {
      newErrors.subject = 'O assunto é obrigatório';
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
            <Mail className="w-5 h-5 text-blue-600" />
            Enviar por Email
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="to">Destinatário(s) *</Label>
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
            <p className="text-xs text-slate-500 mt-1">
              Para múltiplos destinatários, separe os emails por vírgula
            </p>
          </div>

          <div>
            <Label htmlFor="subject">Assunto *</Label>
            <Input
              id="subject"
              type="text"
              placeholder="Assunto do email"
              value={emailData.subject}
              onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
              className={errors.subject ? 'border-red-500' : ''}
              disabled={isSending} />

            {errors.subject &&
            <p className="text-sm text-red-500 mt-1">{errors.subject}</p>
            }
          </div>

          <div>
            <Label htmlFor="message">Mensagem Adicional (Opcional)</Label>
            <Textarea
              id="message"
              placeholder="Adicione uma mensagem personalizada..."
              value={emailData.message}
              onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
              rows={4}
              disabled={isSending} />

          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> O relatório será enviado em formato HTML no corpo do email.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSending}>

              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSending} className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-blue-700">


              {isSending ?
              <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </> :

              <>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar Email
                </>
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}