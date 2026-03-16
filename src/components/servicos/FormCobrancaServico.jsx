import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { CobrancaServico } from '@/entities/CobrancaServico';

export default function FormCobrancaServico({ isOpen, onClose, categoria, tiposServico, clientes, cobrancaInicial, onSaved }) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    cliente_id: '',
    tipo: '',
    tipo_servico_geral_id: '',
    quantidade: 1,
    valor_unitario_usd: 0,
    data_servico: new Date().toISOString().split('T')[0],
    horario_inicio: '',
    horario_fim: '',
    participante: '',
    observacoes: '',
  });

  const tiposFiltrados = useMemo(() => {
    if (categoria === 'servicos_aeroportuarios') {
      return tiposServico || [];
    }
    return (tiposServico || []).filter(t => t.categoria === categoria && t.status === 'ativa');
  }, [tiposServico, categoria]);

  const isCheckin = formData.tipo === 'checkin';

  useEffect(() => {
    if (cobrancaInicial) {
      setFormData({
        cliente_id: cobrancaInicial.cliente_id || cobrancaInicial.empresa_id || '',
        tipo: cobrancaInicial.tipo || '',
        tipo_servico_geral_id: cobrancaInicial.tipo_servico_geral_id || '',
        quantidade: Number(cobrancaInicial.quantidade) || 1,
        valor_unitario_usd: Number(cobrancaInicial.valor_unitario_usd) || 0,
        data_servico: cobrancaInicial.data_servico || new Date().toISOString().split('T')[0],
        horario_inicio: cobrancaInicial.horario_inicio ? cobrancaInicial.horario_inicio.slice(0, 16) : '',
        horario_fim: cobrancaInicial.horario_fim ? cobrancaInicial.horario_fim.slice(0, 16) : '',
        participante: cobrancaInicial.participante || '',
        observacoes: cobrancaInicial.observacoes || '',
      });
    } else {
      setFormData({
        cliente_id: '',
        tipo: '',
        tipo_servico_geral_id: '',
        quantidade: 1,
        valor_unitario_usd: 0,
        data_servico: new Date().toISOString().split('T')[0],
        horario_inicio: '',
        horario_fim: '',
        participante: '',
        observacoes: '',
      });
    }
  }, [cobrancaInicial, isOpen]);

  const handleTipoChange = (tipoValue) => {
    const tipoObj = tiposFiltrados.find(t => t.value === tipoValue);
    setFormData(prev => ({
      ...prev,
      tipo: tipoValue,
      // Só gravar tipo_servico_geral_id se NÃO for servicos_aeroportuarios (esses vêm de tipo_outra_tarifa)
      tipo_servico_geral_id: categoria === 'servicos_aeroportuarios' ? '' : (tipoObj?.id || ''),
      valor_unitario_usd: tipoObj ? Number(tipoObj.valor_padrao_usd) : 0,
    }));
  };

  // Para checkin: calcular horas entre início e fim → quantidade
  const horasCheckin = useMemo(() => {
    if (!isCheckin || !formData.horario_inicio || !formData.horario_fim) return 0;
    const inicio = new Date(formData.horario_inicio);
    const fim = new Date(formData.horario_fim);
    const diffMs = fim - inicio;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60)); // arredonda para cima
  }, [isCheckin, formData.horario_inicio, formData.horario_fim]);

  // Quando checkin, quantidade = horas × balcões (quantidade do input)
  const quantidadeEfetiva = isCheckin ? formData.quantidade : formData.quantidade;
  const valorTotal = isCheckin
    ? parseFloat(((formData.quantidade || 0) * horasCheckin * (formData.valor_unitario_usd || 0)).toFixed(2))
    : parseFloat(((formData.quantidade || 0) * (formData.valor_unitario_usd || 0)).toFixed(2));

  const handleSave = async () => {
    if (!formData.cliente_id || !formData.tipo) return;
    setIsSaving(true);
    try {
      const tipoObj = tiposFiltrados.find(t => t.value === formData.tipo);
      const payload = {
        cliente_id: formData.cliente_id,
        tipo: formData.tipo,
        tipo_servico_geral_id: formData.tipo_servico_geral_id || null,
        categoria,
        descricao: tipoObj?.label || formData.tipo,
        quantidade: formData.quantidade,
        valor_unitario_usd: formData.valor_unitario_usd,
        valor_total_usd: valorTotal,
        data_servico: formData.data_servico,
        horario_inicio: isCheckin && formData.horario_inicio ? formData.horario_inicio : null,
        horario_fim: isCheckin && formData.horario_fim ? formData.horario_fim : null,
        participante: formData.participante || null,
        observacoes: formData.observacoes,
        status: 'pendente',
      };
      if (cobrancaInicial?.id) {
        await CobrancaServico.update(cobrancaInicial.id, payload);
      } else {
        await CobrancaServico.create(payload);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar cobrança:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const tituloCategoria = categoria === 'bombeiros' ? 'Serviço de Bombeiros'
    : categoria === 'servicos_aeroportuarios' ? 'Serviço Aeroportuário'
    : 'Curso / Licença';

  const clienteOptions = (clientes || []).map(e => ({ value: e.id, label: e.nome }));
  const tipoOptions = tiposFiltrados.map(t => ({ value: t.value, label: t.label }));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cobrancaInicial ? 'Editar' : 'Nova'} Cobrança — {tituloCategoria}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select
              options={clienteOptions}
              value={formData.cliente_id}
              onValueChange={(v) => setFormData(prev => ({ ...prev, cliente_id: v }))}
              placeholder="Selecionar cliente..."
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Serviço *</Label>
            <Select
              options={tipoOptions}
              value={formData.tipo}
              onValueChange={handleTipoChange}
              placeholder="Selecionar tipo..."
            />
          </div>

          {isCheckin ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.horario_inicio}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        horario_inicio: val,
                        data_servico: val ? val.split('T')[0] : prev.data_servico,
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.horario_fim}
                    onChange={(e) => setFormData(prev => ({ ...prev, horario_fim: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nº de Balcões</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantidade: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data do Serviço</Label>
                  <Input
                    type="date"
                    value={formData.data_servico}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_servico: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantidade}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantidade: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

            </>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações opcionais..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.cliente_id || !formData.tipo} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
