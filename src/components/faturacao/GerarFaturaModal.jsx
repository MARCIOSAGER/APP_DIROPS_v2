import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, DollarSign } from 'lucide-react';

export default function GerarFaturaModal({ isOpen, onClose, onConfirm, calculo, companhia, aeroporto, voos, voosLigados }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vooInfo, setVooInfo] = useState({ numero_voo: 'N/A', data_operacao: 'N/A' });
  const [formData, setFormData] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    observacoes: ''
  });

  useEffect(() => {
    if (isOpen && calculo) {
      if (voos && calculo.voo_id) {
        const voo = voos.find(v => v.id === calculo.voo_id);
        if (voo) {
          setVooInfo({
            numero_voo: voo.numero_voo || 'N/A',
            data_operacao: voo.data_operacao || 'N/A'
          });
        }
      }

      const dataEmissao = new Date();
      const dataVencimento = new Date(dataEmissao);
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      setFormData({
        data_emissao: dataEmissao.toISOString().split('T')[0],
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        observacoes: ''
      });
    }
  }, [isOpen, calculo, voos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      console.log('📊 Gerando proforma com dados:', {
        companhia_id: companhia?.id,
        companhia_objeto: companhia,
        calculo_id: calculo.id
      });

      if (!companhia?.id) {
        throw new Error('Companhia aérea não encontrada. Por favor, verifique se a companhia está cadastrada.');
      }

      await onConfirm({
        ...formData,
        calculo_tarifa_id: calculo.id,
        companhia_aerea_id: companhia.id,
        aeroporto_id: calculo.aeroporto_id,
        valor_total_usd: calculo.total_tarifa_usd || 0,
        valor_total_aoa: calculo.total_tarifa || 0,
        taxa_cambio: calculo.taxa_cambio_usd_aoa
      });
      onClose();
    } catch (error) {
      console.error('Erro ao gerar proforma:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!calculo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Gerar Nota Proforma
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumo do Cálculo */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Detalhes do Cálculo
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-blue-600 font-medium">Voo:</span>
                <span className="ml-2 font-mono">{vooInfo.numero_voo}</span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Aeroporto:</span>
                <span className="ml-2 font-mono">{aeroporto?.codigo_icao || 'N/A'}</span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Companhia:</span>
                <span className="ml-2">{companhia?.nome || 'N/A'}</span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Data do Cálculo:</span>
                <span className="ml-2">
                  {calculo.data_calculo ? new Date(calculo.data_calculo).toLocaleDateString('pt-AO') : 'N/A'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-blue-600 font-semibold">Valor Total (USD):</span>
                <span className="text-lg font-bold text-blue-900">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'USD' }).format(calculo.total_tarifa_usd || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-blue-600 font-semibold">Valor Total (AOA):</span>
                <span className="text-xl font-bold text-green-700">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(calculo.total_tarifa || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-blue-500">Taxa de Câmbio:</span>
                <Badge variant="outline" className="text-xs">
                  1 USD = {calculo.taxa_cambio_usd_aoa} AOA
                </Badge>
              </div>
            </div>
          </div>

          {/* Dados da Proforma */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_emissao">
                  Data de Emissão <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="data_emissao"
                  type="date"
                  value={formData.data_emissao}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_emissao: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_vencimento">
                  Data de Vencimento <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_vencimento: e.target.value }))}
                  required
                  min={formData.data_emissao}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações ou notas adicionais para a proforma..."
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                rows={4}
              />
            </div>
          </div>

          {/* Aviso */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 flex items-start gap-2">
              <span className="text-yellow-600 font-bold">⚠️</span>
              <span>
                Ao gerar esta nota proforma, será criado um registo permanente no sistema e um PDF será gerado automaticamente.
              </span>
            </p>
          </div>

          <DialogFooter>
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
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar Proforma
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}