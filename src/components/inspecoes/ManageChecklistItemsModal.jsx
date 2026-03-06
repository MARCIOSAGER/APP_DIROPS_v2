import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Save, X, Loader2, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

import { ItemChecklist } from '@/entities/ItemChecklist';

export default function ManageChecklistItemsModal({ isOpen, onClose, tipoInspecao, onUpdate }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    categoria: '',
    item: '',
    criterio: '',
    ordem: 1,
    obrigatorio: true,
    permite_fotos: true,
    status: 'ativo'
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && tipoInspecao) {
      loadItems();
    }
  }, [isOpen, tipoInspecao]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const itemsData = await ItemChecklist.filter({ tipo_inspecao_id: tipoInspecao.id, status: 'ativo' }, 'ordem');
      setItems(itemsData);
      resetForm(itemsData.length + 1);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const itemData = {
        ...formData,
        tipo_inspecao_id: tipoInspecao.id
      };

      if (editingItem) {
        await ItemChecklist.update(editingItem.id, itemData);
      } else {
        await ItemChecklist.create(itemData);
      }
      
      loadItems(); // Recarrega e reseta o form
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao salvar item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
  };

  const handleDelete = async (itemId) => {
    if (confirm('Tem certeza que deseja eliminar este item? Esta ação não pode ser desfeita.')) {
      try {
        await ItemChecklist.update(itemId, { status: 'inativo' });
        loadItems();
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Erro ao eliminar item:', error);
      }
    }
  };

  const resetForm = (nextOrder) => {
    setEditingItem(null);
    setFormData({
      categoria: '',
      item: '',
      criterio: '',
      ordem: nextOrder,
      obrigatorio: true,
      permite_fotos: true,
      status: 'ativo'
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDownloadTemplate = () => {
    const data = [
      ['numero', 'item', 'referencia_norma', 'exemplo_situacao', 'categoria'],
      [1, 'Exemplo de item de auditoria', 'NTA 22A.903.c)', 'Exemplo de situação', 'resposta_emergencia']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');

    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 10 },
      { wch: 40 },
      { wch: 20 },
      { wch: 30 },
      { wch: 20 }
    ];

    XLSX.writeFile(wb, 'modelo_checklist_itens.xlsx');
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        alert('O ficheiro está vazio ou inválido.');
        return;
      }

      const itemsToCreate = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row[1]) continue; // Skip se não tem item

        const itemData = {
          tipo_inspecao_id: tipoInspecao.id,
          ordem: parseInt(row[0]) || (i + items.length),
          item: row[1] || '',
          criterio: row[2] || '',
          categoria: row[4] || '',
          obrigatorio: true,
          permite_fotos: true,
          status: 'ativo'
        };

        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length === 0) {
        alert('Nenhum item válido encontrado no ficheiro.');
        return;
      }

      for (const itemData of itemsToCreate) {
        await ItemChecklist.create(itemData);
      }

      alert(`${itemsToCreate.length} itens importados com sucesso!`);
      loadItems();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao importar ficheiro:', error);
      alert('Erro ao importar ficheiro. Verifique o formato do ficheiro.');
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Gerir Itens do Checklist: {tipoInspecao?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden">
          {/* Formulário */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">
              {editingItem ? 'Editar Item' : 'Novo Item do Checklist'}
            </h3>
            
            <form id="item-form" onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input id="categoria" value={formData.categoria} onChange={(e) => handleChange('categoria', e.target.value)} placeholder="Ex: Pista, Sinalização" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordem">Ordem</Label>
                  <Input id="ordem" type="number" value={formData.ordem} onChange={(e) => handleChange('ordem', parseInt(e.target.value))} min="1" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item">Item a Verificar</Label>
                <Textarea id="item" value={formData.item} onChange={(e) => handleChange('item', e.target.value)} placeholder="Descreva o que deve ser verificado..." required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="criterio">Critério de Avaliação</Label>
                <Textarea id="criterio" value={formData.criterio} onChange={(e) => handleChange('criterio', e.target.value)} placeholder="Critério ou referência normativa..." />
              </div>

              <div className="flex gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="obrigatorio" checked={formData.obrigatorio} onCheckedChange={(checked) => handleChange('obrigatorio', checked)} />
                  <Label htmlFor="obrigatorio">Item Obrigatório</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="permite_fotos" checked={formData.permite_fotos} onCheckedChange={(checked) => handleChange('permite_fotos', checked)} />
                  <Label htmlFor="permite_fotos">Permite Anexar Fotos</Label>
                </div>
              </div>
            </form>
            
            <div className="pt-4 border-t flex gap-2">
              <Button type="submit" form="item-form" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingItem ? 'Salvar Alterações' : 'Adicionar Item'}
              </Button>
              {editingItem && (
                <Button variant="outline" onClick={() => resetForm(items.length + 1)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar Edição
                </Button>
              )}
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold">Itens Configurados ({items.length})</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Modelo
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Excel
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadFile}
                  className="hidden"
                />
              </div>
            </div>
            <div className="overflow-y-auto border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-slate-400"/></div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50">
                    <TableRow>
                      <TableHead className="w-16">Ordem</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Opções</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.ordem}</TableCell>
                        <TableCell>{item.categoria}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.item}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {item.obrigatorio && <Badge variant="outline">Obrigatório</Badge>}
                            {item.permite_fotos && <Badge variant="outline">Permite Fotos</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {items.length === 0 && !isLoading && (
                <div className="text-center p-8 text-slate-500">Nenhum item configurado para este checklist.</div>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}