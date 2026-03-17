import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Building, Save, X } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const STATUS_OPTIONS = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'suspensa', label: 'Suspensa' },
  { value: 'inativa', label: 'Inativa' }
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;
const NIF_REGEX = /^[\dA-Za-z]{5,20}$/;

export default function FormEmpresa({ isOpen, onClose, empresa, onSave }) {
  const [formData, setFormData] = useState({
    nome: '',
    nif: '',
    endereco: '',
    telefone: '',
    email_principal: '',
    responsavel_nome: '',
    responsavel_email: '',
    responsavel_telefone: '',
    area_atividade: '',
    status: 'ativa'
  });
  const [errors, setErrors] = useState({});
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (empresa && isOpen) {
      setFormData(empresa);
    } else if (isOpen && !empresa) {
      setFormData({
        nome: '',
        nif: '',
        endereco: '',
        telefone: '',
        email_principal: '',
        responsavel_nome: '',
        responsavel_email: '',
        responsavel_telefone: '',
        area_atividade: '',
        status: 'ativa'
      });
    }
  }, [empresa, isOpen]);

  const validate = () => {
    const newErrors = {};
    if (!formData.nome?.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!formData.nif?.trim()) newErrors.nif = 'NIF é obrigatório';
    else if (!NIF_REGEX.test(formData.nif.trim())) newErrors.nif = 'NIF inválido (5-20 caracteres alfanuméricos)';
    if (!formData.email_principal?.trim()) newErrors.email_principal = 'Email é obrigatório';
    else if (!EMAIL_REGEX.test(formData.email_principal.trim())) newErrors.email_principal = 'Formato de email inválido';
    if (formData.telefone?.trim() && !PHONE_REGEX.test(formData.telefone.trim())) newErrors.telefone = 'Formato de telefone inválido';
    if (!formData.responsavel_nome?.trim()) newErrors.responsavel_nome = 'Nome do responsável é obrigatório';
    if (!formData.responsavel_email?.trim()) newErrors.responsavel_email = 'Email do responsável é obrigatório';
    else if (!EMAIL_REGEX.test(formData.responsavel_email.trim())) newErrors.responsavel_email = 'Formato de email inválido';
    if (formData.responsavel_telefone?.trim() && !PHONE_REGEX.test(formData.responsavel_telefone.trim())) newErrors.responsavel_telefone = 'Formato de telefone inválido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    guardedSubmit(async () => {
      // Trim all string fields before saving
      const cleanData = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
      );
      await onSave(cleanData);
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
            <Building className="w-5 h-5 text-green-600" />
            {empresa ? 'Editar Empresa' : 'Nova Empresa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <h3 className="font-medium text-slate-700">Informações da Empresa</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome">Nome da Empresa *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleChange('nome', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="nif">NIF *</Label>
                <Input
                  id="nif"
                  value={formData.nif}
                  onChange={(e) => handleChange('nif', e.target.value)}
                  className={errors.nif ? 'border-red-500' : ''}
                  required
                />
                {errors.nif && <p className="text-red-500 text-xs mt-1">{errors.nif}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="endereco">Endereço</Label>
              <Textarea
                id="endereco"
                value={formData.endereco}
                onChange={(e) => handleChange('endereco', e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleChange('telefone', e.target.value)}
                  className={errors.telefone ? 'border-red-500' : ''}
                />
                {errors.telefone && <p className="text-red-500 text-xs mt-1">{errors.telefone}</p>}
              </div>

              <div>
                <Label htmlFor="email_principal">Email Principal *</Label>
                <Input
                  id="email_principal"
                  type="email"
                  value={formData.email_principal}
                  onChange={(e) => handleChange('email_principal', e.target.value)}
                  className={errors.email_principal ? 'border-red-500' : ''}
                  required
                />
                {errors.email_principal && <p className="text-red-500 text-xs mt-1">{errors.email_principal}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-slate-700">Responsável Principal</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="responsavel_nome">Nome do Responsável *</Label>
                <Input
                  id="responsavel_nome"
                  value={formData.responsavel_nome}
                  onChange={(e) => handleChange('responsavel_nome', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="responsavel_email">Email do Responsável *</Label>
                <Input
                  id="responsavel_email"
                  type="email"
                  value={formData.responsavel_email}
                  onChange={(e) => handleChange('responsavel_email', e.target.value)}
                  className={errors.responsavel_email ? 'border-red-500' : ''}
                  required
                />
                {errors.responsavel_email && <p className="text-red-500 text-xs mt-1">{errors.responsavel_email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="responsavel_telefone">Telefone do Responsável</Label>
                <Input
                  id="responsavel_telefone"
                  value={formData.responsavel_telefone}
                  onChange={(e) => handleChange('responsavel_telefone', e.target.value)}
                  className={errors.responsavel_telefone ? 'border-red-500' : ''}
                />
                {errors.responsavel_telefone && <p className="text-red-500 text-xs mt-1">{errors.responsavel_telefone}</p>}
              </div>

              <div>
                <Label htmlFor="area_atividade">Área de Atividade</Label>
                <Input
                  id="area_atividade"
                  value={formData.area_atividade}
                  onChange={(e) => handleChange('area_atividade', e.target.value)}
                />
              </div>
            </div>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-1" />
              {isSubmitting ? 'A guardar...' : `${empresa ? 'Atualizar' : 'Criar'} Empresa`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}