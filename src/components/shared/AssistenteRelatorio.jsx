import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Loader2, Copy, Check } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

export default function AssistenteRelatorio({ isOpen, onClose, dados, contexto, tipo }) {
  const { t } = useI18n();
  const [relatorio, setRelatorio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const gerarRelatorio = async () => {
    setIsLoading(true);

    // Geração de relatório com IA desabilitada para poupar créditos
    setTimeout(() => {
      setRelatorio(`Assistente de Relatório com IA temporariamente desabilitado.\n\nPor favor, elabore o relatório manualmente com base nos dados disponíveis.\n\nContexto: ${contexto || ''}\n\nDados:\n${JSON.stringify(dados, null, 2)}`);
      setIsLoading(false);
    }, 300);
  };

  React.useEffect(() => {
    if (isOpen && !relatorio && !isLoading) {
      gerarRelatorio();
    }
  }, [isOpen]);

  const copiarRelatorio = () => {
    navigator.clipboard.writeText(relatorio);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {t('shared.reportAssistant')}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Gerando relatório profissional...</p>
          </div>
        )}

        {relatorio && !isLoading && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Relatório Gerado</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={copiarRelatorio}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            
            <Textarea
              value={relatorio}
              onChange={(e) => setRelatorio(e.target.value)}
              className="min-h-[500px] font-mono text-sm"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={gerarRelatorio}>
                {t('btn.refresh')}
              </Button>
              <Button onClick={onClose}>{t('btn.close')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}