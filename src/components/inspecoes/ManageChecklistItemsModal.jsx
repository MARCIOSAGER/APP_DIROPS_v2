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
import AlertModal from '@/components/shared/AlertModal';
import ConfirmModal from '@/components/shared/ConfirmModal';

import { ItemChecklist } from '@/entities/ItemChecklist';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

export default function ManageChecklistItemsModal({ isOpen, onClose, tipoInspecao, onUpdate }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
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
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [confirmInfo, setConfirmInfo] = useState({ isOpen: false, itemId: null });

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
    if (!formData.categoria || !formData.item) return;
    guardedSubmit(async () => {
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

      loadItems();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: t('checklist.erroSalvar'), message: t('checklist.erroSalvar') });
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
  };

  const handleDelete = async (itemId) => {
    setConfirmInfo({ isOpen: true, itemId });
  };

  const confirmDelete = async () => {
    try {
      await ItemChecklist.update(confirmInfo.itemId, { status: 'inativo' });
      loadItems();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao eliminar item:', error);
    }
    setConfirmInfo({ isOpen: false, itemId: null });
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
      ['ordem', 'item', 'criterio', 'categoria'],
      [1, 'Verificar estado do pavimento', 'Sem fissuras ou deformações visíveis', 'Pista'],
      [2, 'Verificar sinalização horizontal', 'Marcas visíveis e em conformidade', 'Sinalização']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');

    ws['!cols'] = [
      { wch: 10 },
      { wch: 45 },
      { wch: 40 },
      { wch: 20 }
    ];

    XLSX.writeFile(wb, 'modelo_checklist_inspecao.xlsx');
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
        setAlertInfo({ isOpen: true, type: 'warning', title: t('checklist.ficheiroVazio'), message: t('checklist.ficheiroVazioMsg') });
        return;
      }

      const itemsToCreate = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row[1]) continue;

        const itemData = {
          tipo_inspecao_id: tipoInspecao.id,
          ordem: parseInt(row[0]) || (i + items.length),
          item: row[1] || '',
          criterio: row[2] || '',
          categoria: row[3] || '',
          obrigatorio: true,
          permite_fotos: true,
          status: 'ativo'
        };

        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length === 0) {
        setAlertInfo({ isOpen: true, type: 'warning', title: t('checklist.semItens'), message: t('checklist.semItensMsg') });
        return;
      }

      for (const itemData of itemsToCreate) {
        await ItemChecklist.create(itemData);
      }

      setAlertInfo({ isOpen: true, type: 'success', title: t('checklist.importacaoConcluida'), message: `${itemsToCreate.length} ${t('checklist.itensImportadosSucesso')}` });
      loadItems();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao importar ficheiro:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: t('checklist.erroImportacaoTitulo'), message: t('checklist.erroImportacaoMsg') });
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {t('checklist.gerirItens')} {tipoInspecao?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden">
          {/* Formulário */}
          <div className="flex flex-col overflow-y-auto pr-4">
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">
              {editingItem ? t('checklist.editarItem') : t('checklist.novoItem')}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">{t('checklist.categoria')}</Label>
                  <Input id="categoria" value={formData.categoria} onChange={(e) => handleChange('categoria', e.target.value)} placeholder={t('checklist.categoriaPlaceholder')} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordem">{t('checklist.ordem')}</Label>
                  <Input id="ordem" type="number" value={formData.ordem} onChange={(e) => handleChange('ordem', parseInt(e.target.value))} min="1" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item">{t('checklist.itemVerificar')}</Label>
                <Textarea id="item" value={formData.item} onChange={(e) => handleChange('item', e.target.value)} placeholder={t('checklist.itemPlaceholder')} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="criterio">{t('checklist.criterio')}</Label>
                <Textarea id="criterio" value={formData.criterio} onChange={(e) => handleChange('criterio', e.target.value)} placeholder={t('checklist.criterioPlaceholder')} />
              </div>

              <div className="flex gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="obrigatorio" checked={formData.obrigatorio} onCheckedChange={(checked) => handleChange('obrigatorio', checked)} />
                  <Label htmlFor="obrigatorio">{t('checklist.obrigatorio')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="permite_fotos" checked={formData.permite_fotos} onCheckedChange={(checked) => handleChange('permite_fotos', checked)} />
                  <Label htmlFor="permite_fotos">{t('checklist.permiteFotos')}</Label>
                </div>
              </div>

              <div className="pt-4 border-t flex gap-2">
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {editingItem ? t('checklist.salvarAlteracoes') : t('checklist.adicionarItem')}
                </Button>
                {editingItem && (
                  <Button type="button" variant="outline" onClick={() => resetForm(items.length + 1)}>
                    <X className="mr-2 h-4 w-4" />
                    {t('checklist.cancelarEdicao')}
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Tabela de Itens */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold">{t('checklist.itensConfigurados')} ({items.length})</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('checklist.baixarModelo')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('checklist.uploadExcel')}
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
                      <TableHead className="w-16">{t('checklist.colOrdem')}</TableHead>
                      <TableHead>{t('checklist.colCategoria')}</TableHead>
                      <TableHead>{t('checklist.colItem')}</TableHead>
                      <TableHead>{t('checklist.colOpcoes')}</TableHead>
                      <TableHead className="text-right">{t('checklist.colAcoes')}</TableHead>
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
                            {item.obrigatorio && <Badge variant="outline">{t('checklist.badgeObrigatorio')}</Badge>}
                            {item.permite_fotos && <Badge variant="outline">{t('checklist.badgePermiteFotos')}</Badge>}
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
                <div className="text-center p-8 text-slate-500">{t('checklist.nenhumItem')}</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button variant="outline">{t('checklist.fechar')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertModal
      isOpen={alertInfo.isOpen}
      onClose={() => setAlertInfo(prev => ({ ...prev, isOpen: false }))}
      type={alertInfo.type}
      title={alertInfo.title}
      message={alertInfo.message}
    />

    <ConfirmModal
      isOpen={confirmInfo.isOpen}
      onClose={() => setConfirmInfo({ isOpen: false, itemId: null })}
      onConfirm={confirmDelete}
      title={t('checklist.eliminarItem')}
      message={t('checklist.confirmarEliminar')}
    />
    </>
  );
}
