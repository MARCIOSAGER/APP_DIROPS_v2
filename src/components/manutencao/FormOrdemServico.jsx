
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select'; // Changed to default import
import { Switch } from '@/components/ui/switch';
import { Wrench } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function FormOrdemServico({ isOpen, onClose, onSubmit, aeroportos, ordemInicial = null }) {
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    titulo: '',
    descricao_problema: '',
    acao_corretiva_sugerida: '',
    aeroporto_id: '',
    prioridade: 'media',
    categoria_manutencao: '',
    tipo_execucao: 'interna',
    fornecedor: '',
    contato_fornecedor: '',
    responsavel_manutencao: '',
    prazo_estimado: '',
    custos_estimados: '',
    aprovacao_necessaria: false,
    observacoes_manutencao: ''
  });

  useEffect(() => {
    if (ordemInicial) {
      setFormData({
        titulo: ordemInicial.titulo || '',
        descricao_problema: ordemInicial.descricao_problema || '',
        acao_corretiva_sugerida: ordemInicial.acao_corretiva_sugerida || '',
        aeroporto_id: ordemInicial.aeroporto_id || '',
        prioridade: ordemInicial.prioridade || 'media',
        categoria_manutencao: ordemInicial.categoria_manutencao || '',
        tipo_execucao: ordemInicial.tipo_execucao || 'interna',
        fornecedor: ordemInicial.fornecedor || '',
        contato_fornecedor: ordemInicial.contato_fornecedor || '',
        responsavel_manutencao: ordemInicial.responsavel_manutencao || '',
        prazo_estimado: ordemInicial.prazo_estimado ? ordemInicial.prazo_estimado.split('T')[0] : '',
        custos_estimados: ordemInicial.custos_estimados || '',
        aprovacao_necessaria: ordemInicial.aprovacao_necessaria || false,
        observacoes_manutencao: ordemInicial.observacoes_manutencao || ''
      });
    } else {
      setFormData({
        titulo: '',
        descricao_problema: '',
        acao_corretiva_sugerida: '',
        aeroporto_id: '',
        prioridade: 'media',
        categoria_manutencao: '',
        tipo_execucao: 'interna',
        fornecedor: '',
        contato_fornecedor: '',
        responsavel_manutencao: '',
        prazo_estimado: '',
        custos_estimados: '',
        aprovacao_necessaria: false,
        observacoes_manutencao: ''
      });
    }
  }, [ordemInicial, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      const cleanData = {
        ...formData,
        custos_estimados: formData.custos_estimados ? parseFloat(formData.custos_estimados) : null
      };

      await onSubmit(cleanData);
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const prioridadeOptions = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' }
  ];

  const categoriaOptions = [
    { value: 'infraestrutura', label: 'Infraestrutura' },
    { value: 'equipamentos', label: 'Equipamentos' },
    { value: 'sinalizacao', label: 'Sinalização' },
    { value: 'pavimento', label: 'Pavimento' },
    { value: 'drenagem', label: 'Drenagem' },
    { value: 'iluminacao', label: 'Iluminação' },
    { value: 'outros', label: 'Outros' }
  ];

  const aeroportoOptions = aeroportos.map(aeroporto => ({
    value: aeroporto.id,
    label: `${aeroporto.nome} (${aeroporto.codigo_icao})`
  }));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            {ordemInicial ? 'Editar' : 'Nova'} Ordem de Serviço
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                placeholder="Título resumido do problema..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Aeroporto *</Label>
              <Select
                options={aeroportoOptions}
                value={formData.aeroporto_id}
                onValueChange={(value) => handleChange('aeroporto_id', value)}
                placeholder="Selecionar aeroporto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição do Problema *</Label>
            <Textarea
              value={formData.descricao_problema}
              onChange={(e) => handleChange('descricao_problema', e.target.value)}
              placeholder="Descrição detalhada do problema identificado..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Ação Corretiva Sugerida</Label>
            <Textarea
              value={formData.acao_corretiva_sugerida}
              onChange={(e) => handleChange('acao_corretiva_sugerida', e.target.value)}
              placeholder="Ação corretiva recomendada..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prioridade *</Label>
              <Select
                options={prioridadeOptions}
                value={formData.prioridade}
                onValueChange={(value) => handleChange('prioridade', value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                options={categoriaOptions}
                value={formData.categoria_manutencao}
                onValueChange={(value) => handleChange('categoria_manutencao', value)}
                placeholder="Selecionar categoria"
              />
            </div>

            <div className="space-y-2">
              <Label>Prazo Estimado</Label>
              <Input
                type="date"
                value={formData.prazo_estimado}
                onChange={(e) => handleChange('prazo_estimado', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Execução *</Label>
              <Select
                options={[
                  { value: 'interna', label: 'Interna' },
                  { value: 'terceirizado', label: 'Terceirizado' }
                ]}
                value={formData.tipo_execucao}
                onValueChange={(value) => handleChange('tipo_execucao', value)}
              />
            </div>

            {formData.tipo_execucao === 'terceirizado' && (
              <>
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Input
                    value={formData.fornecedor}
                    onChange={(e) => handleChange('fornecedor', e.target.value)}
                    placeholder="Nome do fornecedor..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contacto do Fornecedor</Label>
                  <Input
                    value={formData.contato_fornecedor}
                    onChange={(e) => handleChange('contato_fornecedor', e.target.value)}
                    placeholder="Telefone ou email..."
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Responsável pela Manutenção</Label>
              <Input
                value={formData.responsavel_manutencao}
                onChange={(e) => handleChange('responsavel_manutencao', e.target.value)}
                placeholder="Email do responsável..."
              />
            </div>

            <div className="space-y-2">
              <Label>Custos Estimados (Kz)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.custos_estimados}
                onChange={(e) => handleChange('custos_estimados', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações de Manutenção</Label>
            <Textarea
              value={formData.observacoes_manutencao}
              onChange={(e) => handleChange('observacoes_manutencao', e.target.value)}
              placeholder="Observações sobre os trabalhos realizados..."
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="aprovacao"
              checked={formData.aprovacao_necessaria}
              onCheckedChange={(checked) => handleChange('aprovacao_necessaria', checked)}
            />
            <Label htmlFor="aprovacao">Requer aprovação da chefia</Label>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? 'A guardar...' : `${ordemInicial ? 'Atualizar' : 'Criar'} Ordem`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
