import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Save } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function FormConfiguracaoSistema({ isOpen, onClose, onSubmit, configuracao }) {
  const [formData, setFormData] = useState({
    taxa_cambio_usd_aoa: 850
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (configuracao) {
      setFormData({
        taxa_cambio_usd_aoa: configuracao.taxa_cambio_usd_aoa || 850
      });
    }
  }, [configuracao]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.taxa_cambio_usd_aoa || formData.taxa_cambio_usd_aoa <= 0) {
      alert('Por favor, insira uma taxa de câmbio válida.');
      return;
    }

    guardedSubmit(async () => {
      setIsSubmitting(true);
      try {
        await onSubmit(formData);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Configurações do Sistema
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taxa_cambio">
              Taxa de Câmbio USD → AOA
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">1 USD =</span>
              <Input
                id="taxa_cambio"
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.taxa_cambio_usd_aoa}
                onChange={(e) => setFormData({ ...formData, taxa_cambio_usd_aoa: parseFloat(e.target.value) })}
                className="pl-20 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">AOA</span>
            </div>
            <p className="text-xs text-slate-500">
              Esta taxa será usada para converter valores USD em AOA em todos os cálculos de tarifas.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}