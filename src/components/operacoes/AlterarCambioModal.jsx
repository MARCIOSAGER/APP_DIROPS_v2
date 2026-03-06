import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AlterarCambioModal({ isOpen, onClose, calculo, onConfirm, voos }) {
  const [novaTaxaCambio, setNovaTaxaCambio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && calculo) {
      setNovaTaxaCambio(calculo.taxa_cambio_usd_aoa?.toString() || '850');
    }
  }, [isOpen, calculo]);

  if (!calculo) return null;

  const vooDep = voos.find(v => v.id === calculo.voo_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const taxaCambio = parseFloat(novaTaxaCambio);
    
    if (isNaN(taxaCambio) || taxaCambio <= 0) {
      alert('Taxa de câmbio inválida');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(calculo, taxaCambio);
      onClose();
    } catch (error) {
      console.error('Erro ao alterar taxa de câmbio:', error);
      alert('Erro ao recalcular com nova taxa de câmbio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const novoTotalAoa = calculo.total_tarifa_usd * parseFloat(novaTaxaCambio || calculo.taxa_cambio_usd_aoa);
  const diferencaAoa = novoTotalAoa - calculo.total_tarifa;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Alterar Taxa de Câmbio
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações do Voo */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Voo:</span>
                <span className="font-mono font-medium">{vooDep?.numero_voo || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total (USD):</span>
                <span className="font-bold text-green-700">${calculo.total_tarifa_usd?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Taxa de Câmbio Atual */}
          <div className="space-y-2">
            <Label>Taxa de Câmbio Atual</Label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-900">1 USD =</span>
                <Badge variant="outline" className="bg-white text-blue-900 border-blue-300 font-mono text-base">
                  {calculo.taxa_cambio_usd_aoa} AOA
                </Badge>
              </div>
              <div className="mt-2 text-xs text-blue-700">
                Total: {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(calculo.total_tarifa || 0)}
              </div>
            </div>
          </div>

          {/* Nova Taxa de Câmbio */}
          <div className="space-y-2">
            <Label htmlFor="nova-taxa">Nova Taxa de Câmbio *</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">1 USD =</span>
              <Input
                id="nova-taxa"
                type="number"
                step="0.01"
                min="1"
                placeholder="850"
                value={novaTaxaCambio}
                onChange={(e) => setNovaTaxaCambio(e.target.value)}
                required
                disabled={isSubmitting}
                className="flex-1 font-mono"
              />
              <span className="text-sm text-slate-600">AOA</span>
            </div>
          </div>

          {/* Previsão do Novo Valor */}
          {novaTaxaCambio && parseFloat(novaTaxaCambio) > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-green-900 font-medium">Novo Total (AOA):</span>
                  <span className="text-lg font-bold text-green-700">
                    {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(novoTotalAoa)}
                  </span>
                </div>
                {Math.abs(diferencaAoa) > 0.01 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span className={diferencaAoa > 0 ? 'text-green-700' : 'text-red-700'}>
                      {diferencaAoa > 0 ? 'Aumento' : 'Diminuição'} de {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(Math.abs(diferencaAoa))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting || !novaTaxaCambio || parseFloat(novaTaxaCambio) <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recalculando...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Aplicar Nova Taxa
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}