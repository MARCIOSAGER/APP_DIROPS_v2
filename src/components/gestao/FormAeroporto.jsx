import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Home, Save, X } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const CATEGORIA_OPTIONS = [
  { value: 'categoria_1', label: 'Categoria 1' },
  { value: 'categoria_2', label: 'Categoria 2' },
  { value: 'categoria_3', label: 'Categoria 3' }
];

const STATUS_OPTIONS = [
  { value: 'operacional', label: 'Operacional' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'critico', label: 'Crítico' }
];

export default function FormAeroporto({ isOpen, onClose, aeroporto, onSave }) {
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    nome: '',
    codigo_icao: '',
    codigo_iata: '',
    cidade: '',
    provincia: '',
    pais: 'AO',
    tipo_operacao: 'DOM',
    categoria: 'categoria_1',
    status: 'operacional'
  });

  useEffect(() => {
    if (aeroporto && isOpen) {
      setFormData(aeroporto);
    } else if (isOpen && !aeroporto) {
      setFormData({
        nome: '',
        codigo_icao: '',
        codigo_iata: '',
        cidade: '',
        provincia: '',
        pais: 'AO',
        tipo_operacao: 'DOM',
        categoria: 'categoria_1',
        status: 'operacional'
      });
    }
  }, [aeroporto, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      await onSave(formData);
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            {aeroporto ? 'Editar Aeroporto' : 'Novo Aeroporto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="codigo_icao">Código ICAO *</Label>
              <Input
                id="codigo_icao"
                value={formData.codigo_icao}
                onChange={(e) => handleChange('codigo_icao', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="codigo_iata">Código IATA</Label>
              <Input
                id="codigo_iata"
                value={formData.codigo_iata}
                onChange={(e) => handleChange('codigo_iata', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cidade">Cidade *</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => handleChange('cidade', e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="provincia">Província</Label>
              <Input
                id="provincia"
                value={formData.provincia}
                onChange={(e) => handleChange('provincia', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pais">País *</Label>
              <Input
                id="pais"
                value={formData.pais}
                onChange={(e) => handleChange('pais', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="categoria">Categoria *</Label>
              <Select
                id="categoria"
                options={CATEGORIA_OPTIONS}
                value={formData.categoria}
                onValueChange={(value) => handleChange('categoria', value)}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                options={STATUS_OPTIONS}
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-1" />
              {isSubmitting ? 'A guardar...' : `${aeroporto ? 'Atualizar' : 'Criar'} Aeroporto`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}