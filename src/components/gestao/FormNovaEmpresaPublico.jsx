import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building, Save, X, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';

export default function FormNovaEmpresaPublico({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    nome: '',
    nif: '',
    email_principal: '',
    responsavel_nome: '',
    responsavel_email: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.nif || !formData.email_principal || !formData.responsavel_nome || !formData.responsavel_email) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message || 'Ocorreu um erro ao salvar a empresa.');
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
      nif: '',
      email_principal: '',
      responsavel_nome: '',
      responsavel_email: ''
    });
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Cadastrar Nova Empresa
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da sua empresa. Após o cadastro, ela será selecionada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="nome-nova-empresa">Nome da Empresa *</Label>
            <Input
              id="nome-nova-empresa"
              value={formData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nif-nova-empresa">NIF *</Label>
              <Input
                id="nif-nova-empresa"
                value={formData.nif}
                onChange={(e) => handleChange('nif', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-nova-empresa">Email Principal *</Label>
              <Input
                id="email-nova-empresa"
                type="email"
                value={formData.email_principal}
                onChange={(e) => handleChange('email_principal', e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="responsavel-nova-empresa">Nome do Responsável *</Label>
            <Input
              id="responsavel-nova-empresa"
              value={formData.responsavel_nome}
              onChange={(e) => handleChange('responsavel_nome', e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="responsavel-email-nova-empresa">Email do Responsável *</Label>
            <Input
              id="responsavel-email-nova-empresa"
              type="email"
              value={formData.responsavel_email}
              onChange={(e) => handleChange('responsavel_email', e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              <Save className="w-4 h-4 mr-1" />
              {isLoading ? 'A Salvar...' : 'Salvar Empresa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}