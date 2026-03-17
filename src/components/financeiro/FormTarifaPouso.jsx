
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

const FormTarifaPouso = ({ isOpen, onClose, onSubmit, tarifa }) => {
  const { t } = useI18n();
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    faixa_min: '',
    faixa_max: '',
    tarifa_domestica: '',
    tarifa_internacional: '',
    categoria_aeroporto: 'categoria_1',
    status: 'ativa'
  });

  useEffect(() => {
    if (tarifa) {
      setFormData(tarifa);
    } else {
      setFormData({
        faixa_min: '',
        faixa_max: '',
        tarifa_domestica: '',
        tarifa_internacional: '',
        categoria_aeroporto: 'categoria_1',
        status: 'ativa'
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

  const categoriaOptions = [
    { value: 'categoria_1', label: 'Categoria 1' },
    { value: 'categoria_2', label: 'Categoria 2' },
    { value: 'categoria_3', label: 'Categoria 3' },
    { value: 'categoria_4', label: 'Categoria 4' }
  ];

  const statusOptions = [
    { value: 'ativa', label: t('formTarifaPouso.ativa') },
    { value: 'inativa', label: t('formTarifaPouso.inativa') }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tarifa ? t('formTarifaPouso.editar') : t('formTarifaPouso.nova')} {t('formTarifaPouso.titulo')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="faixa_min">{t('formTarifaPouso.faixaMin')}</Label>
              <Input 
                id="faixa_min" 
                type="number" 
                value={formData.faixa_min} 
                onChange={e => handleChange('faixa_min', Number(e.target.value))} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="faixa_max">{t('formTarifaPouso.faixaMax')}</Label>
              <Input 
                id="faixa_max" 
                type="number" 
                value={formData.faixa_max} 
                onChange={e => handleChange('faixa_max', Number(e.target.value))} 
                required 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tarifa_domestica">{t('formTarifaPouso.tarifaDomestica')}</Label>
              <Input 
                id="tarifa_domestica" 
                type="number" 
                step="0.01" 
                value={formData.tarifa_domestica} 
                onChange={e => handleChange('tarifa_domestica', Number(e.target.value))} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="tarifa_internacional">{t('formTarifaPouso.tarifaInternacional')}</Label>
              <Input 
                id="tarifa_internacional" 
                type="number" 
                step="0.01" 
                value={formData.tarifa_internacional} 
                onChange={e => handleChange('tarifa_internacional', Number(e.target.value))} 
                required 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="categoria_aeroporto">{t('formTarifaPouso.categoriaAeroporto')}</Label>
              <select
                id="categoria_aeroporto"
                value={formData.categoria_aeroporto}
                onChange={(e) => handleChange('categoria_aeroporto', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
              >
                {categoriaOptions.map(option =>
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>
            <div>
              <Label htmlFor="status">{t('formTarifaPouso.status')}</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
              >
                {statusOptions.map(option => 
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">{isSubmitting ? 'A guardar...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FormTarifaPouso;
