import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

const ALERT_TYPES = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-700',
    iconColor: 'text-green-600 dark:text-green-400',
    titleColor: 'text-green-900 dark:text-green-100',
    buttonColor: 'bg-green-600 hover:bg-green-700'
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-700',
    iconColor: 'text-red-600 dark:text-red-400',
    titleColor: 'text-red-900 dark:text-red-100',
    buttonColor: 'bg-red-600 hover:bg-red-700'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-200 dark:border-yellow-700',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    titleColor: 'text-yellow-900 dark:text-yellow-100',
    buttonColor: 'bg-yellow-600 hover:bg-yellow-700'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-700',
    iconColor: 'text-blue-600 dark:text-blue-400',
    titleColor: 'text-blue-900 dark:text-blue-100',
    buttonColor: 'bg-blue-600 hover:bg-blue-700'
  }
};

export default function AlertModal({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  confirmText,
  showCancel = false,
  cancelText,
  onConfirm,
  children
}) {
  const { t } = useI18n();
  const config = ALERT_TYPES[type] || ALERT_TYPES.info;
  const IconComponent = config.icon;

  const displayConfirmText = confirmText || t('shared.ok');
  const displayCancelText = cancelText || t('shared.cancelar');

  const handlePrimaryAction = () => {
    // If an onConfirm function is provided, call it. Otherwise, just close the modal.
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`sm:max-w-md ${config.bgColor} ${config.borderColor} border-2`}>
        <DialogHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-slate-900 mb-4 shadow-sm">
            <IconComponent className={`h-8 w-8 ${config.iconColor}`} />
          </div>
          <DialogTitle className={`text-xl font-semibold ${config.titleColor}`}>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="text-center">
          <p className="text-gray-700 dark:text-slate-300 mb-6 whitespace-pre-line">{message}</p>
        </div>

        {children || (
          <DialogFooter className="flex gap-2 justify-center">
            {showCancel && (
              <Button variant="outline" onClick={onClose} className="min-w-20">
                {displayCancelText}
              </Button>
            )}
            {displayConfirmText && (
              <Button
                onClick={handlePrimaryAction}
                className={`${config.buttonColor} text-white min-w-20`}
              >
                {displayConfirmText}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
