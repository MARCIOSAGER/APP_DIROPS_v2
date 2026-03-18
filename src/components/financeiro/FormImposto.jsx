import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Percent } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function FormImposto({ isOpen, onClose, onSubmit, imposto, aeroportos }) {
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    tipo: '',
    valor: '',
    aeroporto_id: '',
    data_inicio_vigencia: '',
    data_fim_vigencia: '',
    descricao: '',
    status: 'ativo'
  });

  useEffect(() => {
    if (imposto) {
      setFormData({
        tipo: imposto.tipo || '',
        valor: imposto.valor || '',
        aeroporto_id: imposto.aeroporto_id || '',
        data_inicio_vigencia: imposto.data_inicio_vigencia || '',
        data_fim_vigencia: imposto.data_fim_vigencia || '',
        descricao: imposto.descricao || '',
        status: imposto.status || 'ativo'
      });
    } else {
      setFormData({
        tipo: '',
        valor: '',
        aeroporto_id: '',
        data_inicio_vigencia: new Date().toISOString().split('T')[0],
        data_fim_vigencia: '',
        descricao: '',
        status: 'ativo'
      });
    }
  }, [imposto, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      await onSubmit(formData);
    });
  };

  const aeroportoOptions = aeroportos.map(aeroporto => ({
    value: aeroporto.id,
    label: `${aeroporto.codigo_icao} - ${aeroporto.nome}`
  }));

  aeroportoOptions.unshift({ value: '', label: 'Todos os Aeroportos' });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{imposto ? 'Editar Imposto' : 'Novo Imposto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Imposto *</Label>
              <Input
                id="tipo"
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                placeholder="Ex: IVA, Imposto de Selo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Percentagem (%) *</Label>
              <div className="relative">
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="Ex: 14"
                  required
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Percentagem aplicada sobre o subtotal das tarifas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aeroporto_id">Aeroporto</Label>
              <Select
                id="aeroporto_id"
                value={formData.aeroporto_id}
                onValueChange={(value) => setFormData({ ...formData, aeroporto_id: value })}
                options={aeroportoOptions}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_inicio_vigencia">Data Início Vigência *</Label>
              <Input
                id="data_inicio_vigencia"
                type="date"
                value={formData.data_inicio_vigencia}
                onChange={(e) => setFormData({ ...formData, data_inicio_vigencia: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_fim_vigencia">Data Fim Vigência</Label>
              <Input
                id="data_fim_vigencia"
                type="date"
                value={formData.data_fim_vigencia}
                onChange={(e) => setFormData({ ...formData, data_fim_vigencia: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                options={[
                  { value: 'ativo', label: 'Ativo' },
                  { value: 'inativo', label: 'Inativo' }
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição adicional sobre este imposto"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? 'A guardar...' : `${imposto ? 'Atualizar' : 'Criar'} Imposto`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}