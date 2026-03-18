import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { TipoOutraTarifa } from '@/entities/TipoOutraTarifa';
import { toast } from '@/components/ui/use-toast';

const UNIDADE_OPTIONS = [
  { value: 'passageiro', label: 'Por Passageiro' },
  { value: 'tonelada', label: 'Por Tonelada' },
  { value: 'voo', label: 'Por Voo' },
  { value: 'fixa', label: 'Taxa Fixa' },
  { value: 'balcao_hora', label: 'Por Balcão/Hora' },
  { value: 'bagagem', label: 'Por Bagagem' },
];

export default function GerirTiposOutraTarifaModal({ isOpen, onClose, onUpdated }) {
  const [tipos, setTipos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ value: '', label: '', unidade_padrao: 'passageiro' });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ value: '', label: '', unidade_padrao: 'passageiro' });

  const loadTipos = async () => {
    setIsLoading(true);
    try {
      const data = await TipoOutraTarifa.list();
      setTipos((data || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
    } catch (err) {
      console.error('Erro ao carregar tipos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadTipos();
  }, [isOpen]);

  const handleAdd = async () => {
    if (!newForm.value.trim() || !newForm.label.trim()) {
      toast({ title: 'Preencha o código e o nome', variant: 'destructive' });
      return;
    }
    try {
      await TipoOutraTarifa.create({
        value: newForm.value.trim().toLowerCase().replace(/\s+/g, '_'),
        label: newForm.label.trim(),
        unidade_padrao: newForm.unidade_padrao,
        ordem: tipos.length + 1,
        status: 'ativa'
      });
      setNewForm({ value: '', label: '', unidade_padrao: 'passageiro' });
      setIsAdding(false);
      await loadTipos();
      onUpdated?.();
      toast({ title: 'Tipo adicionado com sucesso' });
    } catch (err) {
      toast({ title: 'Erro ao adicionar', description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (tipo) => {
    setEditingId(tipo.id);
    setEditForm({ value: tipo.value, label: tipo.label, unidade_padrao: tipo.unidade_padrao || 'passageiro' });
  };

  const handleSaveEdit = async () => {
    if (!editForm.label.trim()) return;
    try {
      await TipoOutraTarifa.update(editingId, {
        label: editForm.label.trim(),
        unidade_padrao: editForm.unidade_padrao
      });
      setEditingId(null);
      await loadTipos();
      onUpdated?.();
      toast({ title: 'Tipo atualizado' });
    } catch (err) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (tipo) => {
    try {
      await TipoOutraTarifa.update(tipo.id, {
        status: tipo.status === 'ativa' ? 'inativa' : 'ativa'
      });
      await loadTipos();
      onUpdated?.();
    } catch (err) {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' });
    }
  };

  const handleDelete = async (tipo) => {
    if (!confirm(`Eliminar o tipo "${tipo.label}"? Tarifas existentes deste tipo não serão afectadas.`)) return;
    try {
      await TipoOutraTarifa.delete(tipo.id);
      await loadTipos();
      onUpdated?.();
      toast({ title: 'Tipo eliminado' });
    } catch (err) {
      toast({ title: 'Erro ao eliminar', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerir Tipos de Outra Tarifa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            {!isAdding && (
              <Button size="sm" onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Tipo
              </Button>
            )}
          </div>

          {isAdding && (
            <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
              <h4 className="font-medium text-sm">Novo Tipo de Tarifa</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Código (chave única)</Label>
                  <Input
                    value={newForm.value}
                    onChange={e => setNewForm(p => ({ ...p, value: e.target.value }))}
                    placeholder="ex: taxa_seguro"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nome (label)</Label>
                  <Input
                    value={newForm.label}
                    onChange={e => setNewForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="ex: Taxa de Seguro"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unidade Padrão</Label>
                  <select
                    value={newForm.unidade_padrao}
                    onChange={e => setNewForm(p => ({ ...p, unidade_padrao: e.target.value }))}
                    className="w-full h-9 px-3 border rounded-md text-sm bg-white border-slate-200"
                  >
                    {UNIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setNewForm({ value: '', label: '', unidade_padrao: 'passageiro' }); }}>
                  <X className="h-3 w-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleAdd}>
                  <Save className="h-3 w-3 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Unidade Padrão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">A carregar...</TableCell></TableRow>
              ) : tipos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Nenhum tipo configurado</TableCell></TableRow>
              ) : tipos.map((tipo, idx) => (
                <TableRow key={tipo.id}>
                  <TableCell className="text-slate-400 text-xs">{idx + 1}</TableCell>
                  {editingId === tipo.id ? (
                    <>
                      <TableCell><code className="text-xs bg-slate-100 px-1 rounded">{tipo.value}</code></TableCell>
                      <TableCell>
                        <Input value={editForm.label} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <select
                          value={editForm.unidade_padrao}
                          onChange={e => setEditForm(p => ({ ...p, unidade_padrao: e.target.value }))}
                          className="h-8 px-2 border rounded text-sm bg-white border-slate-200"
                        >
                          {UNIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Badge className={tipo.status === 'ativa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{tipo.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}><Save className="h-3.5 w-3.5 text-green-600" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell><code className="text-xs bg-slate-100 px-1 rounded">{tipo.value}</code></TableCell>
                      <TableCell className="font-medium">{tipo.label}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {UNIDADE_OPTIONS.find(o => o.value === tipo.unidade_padrao)?.label || tipo.unidade_padrao}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`cursor-pointer ${tipo.status === 'ativa' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                          onClick={() => handleToggleStatus(tipo)}
                        >
                          {tipo.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-slate-200" onClick={() => handleEdit(tipo)}>
                          <Pencil className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-100" onClick={() => handleDelete(tipo)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
