import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const FormTarifaPermanencia = ({ isOpen, onClose, onSubmit, tarifa }) => {
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    faixa_min: 0,
    faixa_max: 999999,
    tarifa_usd_por_tonelada_hora: '',
    categoria_aeroporto: 'categoria_1',
    status: 'ativa'
  });

  useEffect(() => {
    if (tarifa) {
      setFormData({
        faixa_min: tarifa.faixa_min || 0,
        faixa_max: tarifa.faixa_max || 999999,
        tarifa_usd_por_tonelada_hora: tarifa.tarifa_usd_por_tonelada_hora || '',
        categoria_aeroporto: tarifa.categoria_aeroporto || 'categoria_1',
        status: tarifa.status || 'ativa'
      });
    } else {
      setFormData({
        faixa_min: 0,
        faixa_max: 999999,
        tarifa_usd_por_tonelada_hora: '',
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
      const dataToSubmit = {
        ...formData,
        tarifa_usd_por_tonelada_hora: parseFloat(formData.tarifa_usd_por_tonelada_hora)
      };
      await onSubmit(dataToSubmit);
    });
  };

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tarifa ? 'Editar' : 'Nova'} Tarifa de Estacionamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
           <div>
              <Label htmlFor="tarifa_usd_por_tonelada_hora">Tarifa Base por Tonelada/Hora (USD)</Label>
              <Input 
                id="tarifa_usd_por_tonelada_hora"
                type="number" 
                step="0.01" 
                value={formData.tarifa_usd_por_tonelada_hora} 
                onChange={e => handleChange('tarifa_usd_por_tonelada_hora', e.target.value)} 
                required 
                placeholder="Ex: 0.25"
              />
            </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="categoria_aeroporto">Categoria do Aeroporto</Label>
              <select
                id="categoria_aeroporto"
                value={formData.categoria_aeroporto}
                onChange={e => handleChange('categoria_aeroporto', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
              >
                {categoriaOptions.map(option => 
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={e => handleChange('status', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
              >
                {statusOptions.map(option => 
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>
          </div>
          
          <div className="hidden">
             <Label>Faixa Mínima (kg)</Label>
              <Input 
                type="number" 
                value={formData.faixa_min} 
                readOnly
              />
               <Label>Faixa Máxima (kg)</Label>
              <Input 
                type="number" 
                value={formData.faixa_max} 
                readOnly
              />
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

export default FormTarifaPermanencia;