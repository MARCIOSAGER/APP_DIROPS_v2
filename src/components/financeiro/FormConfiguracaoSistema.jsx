import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Save, CalendarDays, History } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtTaxa = (n) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(Number(n) || 0);

// Registo de nova vigência da taxa de câmbio (histórico versionado).
// A taxa passa a valer para todos os voos que operarem a partir da
// data de vigência; voos já calculados não mudam automaticamente.
export default function FormConfiguracaoSistema({ isOpen, onClose, onSubmit, taxaAtual = 850, historico = [] }) {
  const [formData, setFormData] = useState({ taxa_usd_aoa: taxaAtual, data_vigencia: hojeISO() });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (isOpen) setFormData({ taxa_usd_aoa: taxaAtual || 850, data_vigencia: hojeISO() });
  }, [isOpen, taxaAtual]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.taxa_usd_aoa || formData.taxa_usd_aoa <= 0) {
      alert('Por favor, insira uma taxa de câmbio válida.');
      return;
    }
    if (!formData.data_vigencia) {
      alert('Por favor, selecione a data de vigência.');
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
            Taxa de Câmbio USD → AOA
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taxa_cambio">
              Nova Taxa <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">1 USD =</span>
              <Input
                id="taxa_cambio"
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.taxa_usd_aoa}
                onChange={(e) => setFormData({ ...formData, taxa_usd_aoa: parseFloat(e.target.value) })}
                className="pl-20 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">AOA</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_vigencia" className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> Válida a partir de <span className="text-red-500">*</span>
            </Label>
            <Input
              id="data_vigencia"
              type="date"
              required
              value={formData.data_vigencia}
              onChange={(e) => setFormData({ ...formData, data_vigencia: e.target.value })}
            />
            <p className="text-xs text-slate-500">
              A partir desta data, todos os voos que operarem passam a usar esta taxa. Voos já calculados
              não mudam automaticamente — use "Recalcular Tarifas" no voo se quiser reaplicar.
            </p>
          </div>

          {historico.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                <History className="w-3.5 h-3.5" /> Histórico de taxas
              </div>
              <ul className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {historico.map((h) => (
                  <li key={h.id || h.data_vigencia} className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>{(h.data_vigencia || '').slice(0, 10)}</span>
                    <span className="font-mono font-medium">1 USD = {fmtTaxa(h.taxa_usd_aoa)} AOA</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
