import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { safeRedirectUrl } from '@/lib/sanitize';
import { useI18n } from '@/components/lib/i18n';

export default function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  details,
  buttonText,
  redirectPath
}) {
  const { t } = useI18n();
  const displayButtonText = buttonText || t('shared.entendido');

  const handleClose = () => {
    if (redirectPath) {
      window.location.href = safeRedirectUrl(redirectPath, '/');
    } else if (onClose) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
            {title}
          </h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6">{message}</p>

          {details && (
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 space-y-3 mb-6">
              {details.map((detail, index) => (
                <div key={index} className="flex items-start gap-3 text-sm text-blue-800 dark:text-blue-200">
                  {detail.icon}
                  <span>{detail.text}</span>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleClose}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {displayButtonText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
