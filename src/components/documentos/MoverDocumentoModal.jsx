import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Home, X } from 'lucide-react';
import Select from '@/components/ui/select';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function MoverDocumentoModal({ isOpen, onClose, onMove, documento, pastas }) {
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [novaPastaId, setNovaPastaId] = useState(documento?.pasta_id || null);

  const isBulk = documento?._isBulk;
  const bulkIds = documento?._bulkIds || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      if (isBulk) {
        await onMove(novaPastaId, bulkIds);
      } else {
        await onMove(novaPastaId);
      }
    });
  };

  const pastasOptions = [
    { value: 'null', label: '🏠 Raiz (sem pasta)' },
    ...pastas.map(pasta => ({
      value: pasta.id,
      label: `📁 ${pasta.nome}`
    }))
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{isBulk ? `Mover ${bulkIds.length} Documentos` : 'Mover Documento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info do documento */}
          <div>
            <p className="text-sm text-slate-600 mb-1">{isBulk ? 'Movendo documentos:' : 'Movendo documento:'}</p>
            {isBulk ? (
              <p className="text-base font-semibold text-blue-900">{bulkIds.length} documento(s) selecionado(s)</p>
            ) : (
              <p className="text-base font-semibold text-slate-900">{documento?.titulo}</p>
            )}
          </div>

          {/* Seletor de localização */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 block">Nova Localização</label>
            <Select
              options={pastasOptions}
              value={novaPastaId || 'null'}
              onValueChange={(value) => setNovaPastaId(value === 'null' ? null : value)}
              className="w-full"
            />
          </div>

          {/* Botão */}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
              {isSubmitting ? 'A mover...' : (isBulk ? 'Mover Documentos' : 'Mover Documento')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}