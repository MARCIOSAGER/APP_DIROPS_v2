import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const FormOutraTarifa = ({ isOpen, onClose, onSubmit, tarifa }) => {
  const [formData, setFormData] = useState({
    tipo: 'embarque',
    tipo_operacao: 'ambos',
    valor: '',
    unidade: 'passageiro',
    categoria_aeroporto: 'categoria_1',
    descricao: '',
    status: 'ativa'
  });
  
  useEffect(() => {
    if (tarifa) {
      setFormData({
        ...tarifa,
        tipo_operacao: tarifa.tipo_operacao || 'ambos'
      });
    } else {
      setFormData({
        tipo: 'embarque',
        tipo_operacao: 'ambos',
        valor: '',
        unidade: 'passageiro',
        categoria_aeroporto: 'categoria_1',
        descricao: '',
        status: 'ativa'
      });
    }
  }, [tarifa, isOpen]);
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const tipoOptions = [
    { value: 'embarque', label: 'Embarque' },
    { value: 'transito_transbordo', label: 'Trânsito com Transbordo' },
    { value: 'transito_direto', label: 'Trânsito Direto' },
    { value: 'carga', label: 'Carga' },
    { value: 'seguranca', label: 'Segurança' },
    { value: 'iluminacao', label: 'Iluminação' },
  ];

  const tipoOperacaoOptions = [
    { value: 'ambos', label: 'Ambos (Doméstico e Internacional)' },
    { value: 'domestica', label: 'Apenas Doméstico' },
    { value: 'internacional', label: 'Apenas Internacional' }
  ];

  const unidadeOptions = [
    { value: 'passageiro', label: 'Por Passageiro' },
    { value: 'tonelada', label: 'Por Tonelada' },
    { value: 'voo', label: 'Por Voo' },
    { value: 'fixa', label: 'Taxa Fixa' },
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tarifa ? 'Editar' : 'Nova'} Outra Tarifa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo">Tipo de Tarifa</Label>
              <select
                id="tipo"
                value={formData.tipo}
                onChange={e => handleChange('tipo', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
              >
                {tipoOptions.map(option => 
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>
            <div>
              <Label htmlFor="tipo_operacao">Tipo de Operação</Label>
              <select
                id="tipo_operacao"
                value={formData.tipo_operacao}
                onChange={e => handleChange('tipo_operacao', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
              >
                {tipoOperacaoOptions.map(option => 
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor (USD)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={formData.valor} 
                onChange={e => handleChange('valor', Number(e.target.value))} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="unidade">Unidade</Label>
              <select
                id="unidade"
                value={formData.unidade}
                onChange={e => handleChange('unidade', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
              >
                {unidadeOptions.map(option => 
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>
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

          <div>
            <Label>Descrição</Label>
            <Textarea 
              value={formData.descricao} 
              onChange={e => handleChange('descricao', e.target.value)} 
              placeholder="Ex: Conforme RTA 2015..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FormOutraTarifa;