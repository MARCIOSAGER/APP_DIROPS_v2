
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select'; // Corrected import
import { Home, Save, X, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';

const CATEGORIA_OPTIONS = [
  { value: 'categoria_1', label: 'Categoria 1' },
  { value: 'categoria_2', label: 'Categoria 2' },
  { value: 'categoria_3', label: 'Categoria 3' }
];

export default function FormNovoAeroportoPublico({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    nome: '',
    codigo_icao: '',
    codigo_iata: '',
    cidade: '',
    provincia: '',
    pais: 'AO',
    categoria: 'categoria_1',
    status: 'operacional'
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.codigo_icao || !formData.cidade || !formData.categoria) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      // Garantir que o tipo_operacao seja definido baseado no país
      const dataToSave = {
        ...formData,
        tipo_operacao: formData.pais === 'AO' ? 'DOM' : 'INT'
      };
      await onSave(dataToSave);
    } catch (err) {
      setError(err.message || 'Ocorreu um erro ao salvar o aeroporto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    // Reset form when closing
    setFormData({
      nome: '',
      codigo_icao: '',
      codigo_iata: '',
      cidade: '',
      provincia: '',
      pais: 'AO',
      categoria: 'categoria_1',
      status: 'operacional'
    });
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            Cadastrar Novo Aeroporto
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do aeroporto. Após o cadastro, ele será selecionado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                placeholder="Ex: Aeroporto Internacional 4 de Fevereiro"
                required
              />
            </div>
            <div>
              <Label htmlFor="codigo_icao">Código ICAO *</Label>
              <Input
                id="codigo_icao"
                value={formData.codigo_icao}
                onChange={(e) => handleChange('codigo_icao', e.target.value.toUpperCase())}
                placeholder="Ex: FNLU"
                maxLength={4}
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
                onChange={(e) => handleChange('codigo_iata', e.target.value.toUpperCase())}
                placeholder="Ex: LAD"
                maxLength={3}
              />
            </div>
            <div>
              <Label htmlFor="cidade">Cidade *</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => handleChange('cidade', e.target.value)}
                placeholder="Ex: Luanda"
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
                placeholder="Ex: Luanda"
              />
            </div>
            <div>
              <Label htmlFor="categoria">Categoria *</Label>
              <Select
                id="categoria"
                options={CATEGORIA_OPTIONS}
                value={formData.categoria}
                onValueChange={(value) => handleChange('categoria', value)}
                placeholder="Selecione a categoria"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              <Save className="w-4 h-4 mr-1" />
              {isLoading ? 'A Salvar...' : 'Salvar Aeroporto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
