import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

const ALERT_TYPES = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
    titleColor: 'text-green-900',
    buttonColor: 'bg-green-600 hover:bg-green-700'
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    titleColor: 'text-red-900',
    buttonColor: 'bg-red-600 hover:bg-red-700'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-600',
    titleColor: 'text-yellow-900',
    buttonColor: 'bg-yellow-600 hover:bg-yellow-700'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
    buttonColor: 'bg-blue-600 hover:bg-blue-700'
  }
};

export default function AlertModal({ 
  isOpen, 
  onClose, 
  type = 'info', 
  title, 
  message, 
  confirmText = 'OK',
  showCancel = false,
  cancelText = 'Cancelar',
  onConfirm,
  children
}) {
  const config = ALERT_TYPES[type] || ALERT_TYPES.info;
  const IconComponent = config.icon;

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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white mb-4 shadow-sm">
            <IconComponent className={`h-8 w-8 ${config.iconColor}`} />
          </div>
          <DialogTitle className={`text-xl font-semibold ${config.titleColor}`}>
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center">
          <p className="text-gray-700 mb-6 whitespace-pre-line">{message}</p>
        </div>

        {children || (
          <DialogFooter className="flex gap-2 justify-center">
            {showCancel && (
              <Button variant="outline" onClick={onClose} className="min-w-20">
                {cancelText}
              </Button>
            )}
            {confirmText && (
              <Button 
                onClick={handlePrimaryAction}
                className={`${config.buttonColor} text-white min-w-20`}
              >
                {confirmText}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}