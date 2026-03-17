import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info, Share2, UserCheck } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

export default function InfoConviteModal({ isOpen, onClose }) {
  const { t } = useI18n();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-6 h-6 text-blue-600" />
            {t('gestao.convite.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4 text-sm text-slate-700">
          <p className="font-semibold">{t('gestao.convite.intro')}</p>

          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border">
            <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 text-blue-600">
                    <Share2 className="w-5 h-5" />
                </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-800">{t('gestao.convite.passo1Title')}</h4>
              <p>{t('gestao.convite.passo1Desc')}</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border">
            <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 text-green-600">
                    <UserCheck className="w-5 h-5" />
                </div>
            </div>
            <div>
                <h4 className="font-bold text-slate-800">{t('gestao.convite.passo2Title')}</h4>
                <p>{t('gestao.convite.passo2Desc')}</p>
            </div>
          </div>

        </div>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">{t('gestao.convite.entendido')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
