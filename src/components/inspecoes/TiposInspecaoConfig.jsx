
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select'; // Changed to default import
import { Plus, Edit, Settings, ListChecks } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

import { TipoInspecao } from '@/entities/TipoInspecao';
import ManageChecklistItemsModal from './ManageChecklistItemsModal';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function TiposInspecaoConfig({ tiposInspecao, onUpdate }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    descricao: '',
    frequencia: 'mensal',
    status: 'ativo'
  });
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [selectedTipoForChecklist, setSelectedTipoForChecklist] = useState(null);
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  const handleOpenForm = (tipo = null) => {
    if (tipo) {
      setFormData(tipo);
      setEditingTipo(tipo);
    } else {
      setFormData({
        nome: '',
        codigo: '',
        descricao: '',
        frequencia: 'mensal',
        status: 'ativo'
      });
      setEditingTipo(null);
    }
    setIsFormOpen(true);
  };

  const handleManageChecklist = (tipo) => {
    setSelectedTipoForChecklist(tipo);
    setIsChecklistModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      if (editingTipo) {
        await TipoInspecao.update(editingTipo.id, formData);
      } else {
        await TipoInspecao.create(formData);
      }
      setIsFormOpen(false);
      onUpdate();
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getFrequenciaLabel = (freq) => {
    const labels = {
      diaria: 'Diária',
      semanal: 'Semanal',
      mensal: 'Mensal',
      trimestral: 'Trimestral',
      anual: 'Anual',
      conforme_necessario: 'Conforme Necessário'
    };
    return labels[freq] || freq;
  };

  const frequenciaOptions = [
    { value: 'diaria', label: 'Diária' },
    { value: 'semanal', label: 'Semanal' },
    { value: 'mensal', label: 'Mensal' },
    { value: 'trimestral', label: 'Trimestral' },
    { value: 'anual', label: 'Anual' },
    { value: 'conforme_necessario', label: 'Conforme Necessário' }
  ];

  const statusOptions = [
    { value: 'ativo', label: 'Ativo' },
    { value: 'inativo', label: 'Inativo' }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Configuração de Tipos de Inspeção
          </CardTitle>
          <Button onClick={() => handleOpenForm()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Tipo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {tiposInspecao.map((tipo) => (
              <Card key={tipo.id} className="border border-slate-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900">{tipo.nome}</h3>
                      <p className="text-sm text-slate-600">{tipo.descricao}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>Código: <code className="bg-slate-100 px-1 rounded">{tipo.codigo}</code></span>
                        <span>Frequência: {getFrequenciaLabel(tipo.frequencia)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleManageChecklist(tipo)}>
                        <ListChecks className="w-4 h-4 mr-1" />
                        Checklist
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenForm(tipo)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTipo ? 'Editar' : 'Novo'} Tipo de Inspeção</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} required /></div>
              <div className="space-y-2"><Label>Código</Label><Input value={formData.codigo} onChange={(e) => handleChange('codigo', e.target.value)} required /></div>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={formData.descricao} onChange={(e) => handleChange('descricao', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  options={frequenciaOptions}
                  onValueChange={(v) => handleChange('frequencia', v)}
                  value={formData.frequencia}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  options={statusOptions}
                  onValueChange={(v) => handleChange('status', v)}
                  value={formData.status}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'A guardar...' : (editingTipo ? 'Atualizar' : 'Criar')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {selectedTipoForChecklist && (
        <ManageChecklistItemsModal
          isOpen={isChecklistModalOpen}
          onClose={() => setIsChecklistModalOpen(false)}
          tipoInspecao={selectedTipoForChecklist}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
