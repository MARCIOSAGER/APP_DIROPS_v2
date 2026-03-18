import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, DollarSign } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

export default function GerarFaturaModal({ isOpen, onClose, onConfirm, calculo, companhia, aeroporto }) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    observacoes: ''
  });

  useEffect(() => {
    if (isOpen && calculo) {
      // Default vencimento para 30 dias após emissão
      const dataEmissao = new Date();
      const dataVencimento = new Date(dataEmissao);
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      setFormData({
        data_emissao: dataEmissao.toISOString().split('T')[0],
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        observacoes: ''
      });
    }
  }, [isOpen, calculo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
    setIsSubmitting(true);

    try {
      await onConfirm({
        ...formData,
        calculo_tarifa_id: calculo.id,
        companhia_aerea_id: calculo.companhia_id,
        aeroporto_id: calculo.aeroporto_id,
        valor_total_usd: calculo.total_tarifa_usd || 0,
        valor_total_aoa: calculo.total_tarifa || 0,
        taxa_cambio: calculo.taxa_cambio_usd_aoa
      });
      onClose();
    } catch (error) {
      console.error('Erro ao gerar fatura:', error);
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  if (!calculo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {t('operGerarFatura.titulo')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumo do Cálculo */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t('operGerarFatura.detalhesCalculo')}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-blue-600 font-medium">{t('operGerarFatura.voo')}</span>
                <span className="ml-2">{calculo.numero_voo || 'N/A'}</span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">{t('operGerarFatura.aeroporto')}</span>
                <span className="ml-2">{aeroporto?.codigo_icao || calculo.aeroporto_codigo || 'N/A'}</span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">{t('operGerarFatura.companhia')}</span>
                <span className="ml-2">{companhia?.nome || calculo.companhia_nome || 'N/A'}</span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">{t('operGerarFatura.dataCalculo')}</span>
                <span className="ml-2">{new Date(calculo.data_calculo).toLocaleDateString('pt-AO')}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-blue-600 font-semibold">{t('operGerarFatura.valorTotalUSD')}</span>
                <span className="text-lg font-bold text-blue-900">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'USD' }).format(calculo.total_tarifa_usd || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-blue-600 font-semibold">{t('operGerarFatura.valorTotalAOA')}</span>
                <span className="text-xl font-bold text-green-700">
                  {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(calculo.total_tarifa || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-blue-500">{t('operGerarFatura.taxaCambio')}</span>
                <Badge variant="outline" className="text-xs">
                  1 USD = {calculo.taxa_cambio_usd_aoa} AOA
                </Badge>
              </div>
            </div>
          </div>

          {/* Dados da Fatura */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_emissao">{t('operGerarFatura.dataEmissao')}</Label>
                <Input
                  id="data_emissao"
                  type="date"
                  value={formData.data_emissao}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_emissao: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_vencimento">{t('operGerarFatura.dataVencimento')}</Label>
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
              <Label htmlFor="observacoes">{t('operGerarFatura.observacoes')}</Label>
              <Textarea
                id="observacoes"
                placeholder={t('operGerarFatura.observacoesPlaceholder')}
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            <p className="font-medium">⚠️ {t('operGerarFatura.atencao')}</p>
            <p className="mt-1">{t('operGerarFatura.aviso')}</p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('operGerarFatura.cancelar')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('operGerarFatura.gerando')}
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('operGerarFatura.gerarFatura')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}