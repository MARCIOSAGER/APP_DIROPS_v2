import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

const FormTarifaRecurso = ({ isOpen, onClose, onSubmit, tarifa }) => {
  const { t } = useI18n();
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    tipo: 'pca',
    valor_usd: '',
    categoria_aeroporto: 'categoria_1',
    tipo_operacao: 'ambos',
    status: 'ativa',
    descricao: ''
  });

  useEffect(() => {
    if (tarifa) {
      setFormData({
        ...tarifa,
        tipo_operacao: tarifa.tipo_operacao || 'ambos'
      });
    } else {
      setFormData({
        tipo: 'pca',
        valor_usd: '',
        categoria_aeroporto: 'categoria_1',
        tipo_operacao: 'ambos',
        status: 'ativa',
        descricao: ''
      });
    }
  }, [tarifa, isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      await onSubmit(formData);
    });
  };

  const tipoOptions = [
    { value: 'pca', label: 'PCA (Ar Pré-Condicionado)' },
    { value: 'gpu', label: 'GPU (Ground Power Unit)' },
    { value: 'pbb', label: 'PBB (Ponte de Embarque)' },
    { value: 'combustivel', label: 'Combustível' },
    { value: 'checkin', label: 'Balcão de Check-in' },
  ];

  const tipoOperacaoOptions = [
    { value: 'ambos', label: 'Ambos (Doméstico e Internacional)' },
    { value: 'domestica', label: 'Apenas Doméstico' },
    { value: 'internacional', label: 'Apenas Internacional' }
  ];

  const categoriaOptions = [
    { value: 'categoria_1', label: 'Categoria 1' },
    { value: 'categoria_2', label: 'Categoria 2' },
    { value: 'categoria_3', label: 'Categoria 3' },
    { value: 'categoria_4', label: 'Categoria 4' }
  ];

  const statusOptions = [
    { value: 'ativa', label: 'Ativa' },
    { value: 'inativa', label: 'Inativa' }
  ];

  const selectClass = "w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tarifa ? 'Editar' : 'Nova'} Tarifa de Recurso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo">Tipo de Recurso</Label>
              <select id="tipo" value={formData.tipo} onChange={e => handleChange('tipo', e.target.value)} className={selectClass}>
                {tipoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="tipo_operacao">Tipo de Operação</Label>
              <select id="tipo_operacao" value={formData.tipo_operacao} onChange={e => handleChange('tipo_operacao', e.target.value)} className={selectClass}>
                {tipoOperacaoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor (USD/hora)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_usd}
                onChange={e => handleChange('valor_usd', Number(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="categoria_aeroporto">Categoria do Aeroporto</Label>
              <select id="categoria_aeroporto" value={formData.categoria_aeroporto} onChange={e => handleChange('categoria_aeroporto', e.target.value)} className={selectClass}>
                {categoriaOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* PBB special fields: primeira_hora + hora_adicional */}
          {formData.tipo === 'pbb' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <Label>1ª Hora (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.primeira_hora || ''}
                  onChange={e => handleChange('primeira_hora', Number(e.target.value) || null)}
                  placeholder="Ex: 150.00"
                />
              </div>
              <div>
                <Label>Hora Adicional (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hora_adicional || ''}
                  onChange={e => handleChange('hora_adicional', Number(e.target.value) || null)}
                  placeholder="Ex: 74.00"
                />
              </div>
              <p className="col-span-2 text-xs text-blue-600">
                Se preenchidos, a PBB será calculada como: 1ª hora + (horas adicionais x valor hora adicional). Caso contrário, usa o valor/hora linear.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" value={formData.status} onChange={e => handleChange('status', e.target.value)} className={selectClass}>
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={e => handleChange('descricao', e.target.value)}
              placeholder="Descrição opcional..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('btn.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">{isSubmitting ? t('btn.loading') : t('btn.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FormTarifaRecurso;
