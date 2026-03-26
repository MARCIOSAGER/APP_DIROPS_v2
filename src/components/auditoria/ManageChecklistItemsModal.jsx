import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Edit,
  Trash2,
  Download,
  FileUp,
  Upload,
  ArrowLeft,
  List
} from 'lucide-react';

import { ItemAuditoria } from '@/entities/ItemAuditoria';
// XLSX loaded dynamically (~300KB saving from initial bundle)
import AlertModal from '../shared/AlertModal';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

export default function ManageChecklistItemsModal({ isOpen, onClose, tipoAuditoria, onUpdate }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUploadView, setIsUploadView] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploadMessage, setUploadMessage] = useState({ type: '', text: '' });

  // Estados para formulário
  const [formData, setFormData] = useState({
    numero: '',
    item: '',
    referencia_norma: '',
    exemplo_situacao: '',
    categoria: '',
    status: 'ativo'
  });

  // Estados para upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [_excelData, setExcelData] = useState([]);
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  // Estados para confirmação de exclusão
  const [deleteItemInfo, setDeleteItemInfo] = useState({ isOpen: false, item: null });

  // Estados para duplicados
  const [_duplicateItems, setDuplicateItems] = useState([]);
  const [_showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setIsFormOpen(false);
      setIsUploadView(false);
      setDuplicateItems([]);
      setShowDuplicateDialog(false);
      setSelectedFile(null);
      setExcelData([]);
      setUploadProgress(0);
    }
  }, [isOpen, tipoAuditoria]);

  const loadItems = async () => {
    setIsLoading(true);
    if (tipoAuditoria) {
      const fetchedItems = await ItemAuditoria.filter({ tipo_auditoria_id: tipoAuditoria.id }, 'numero', 500);
      const sortedItems = fetchedItems.sort((a, b) => {
        const numA = parseInt(a.numero) || 0;
        const numB = parseInt(b.numero) || 0;
        return numA - numB;
      });
      setItems(sortedItems);
    }
    setIsLoading(false);
  };

  const openForm = (item = null) => {
    if (item) {
      setFormData({
        numero: item.numero,
        item: item.item,
        referencia_norma: item.referencia_norma,
        exemplo_situacao: item.exemplo_situacao || '',
        categoria: item.categoria || tipoAuditoria.categoria,
        status: item.status || 'ativo'
      });
      setEditingItem(item);
    } else {
      setFormData({
        numero: '',
        item: '',
        referencia_norma: '',
        exemplo_situacao: '',
        categoria: tipoAuditoria.categoria,
        status: 'ativo'
      });
      setEditingItem(null);
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadMessage({ type: '', text: '' });

    guardedSubmit(async () => {
    try {
      const dataToSave = {
        ...formData,
        tipo_auditoria_id: tipoAuditoria.id,
        ordem: editingItem ? editingItem.ordem : items.length + 1
      };

      if (editingItem) {
        await ItemAuditoria.update(editingItem.id, dataToSave);
        setUploadMessage({ type: 'success', text: 'Item atualizado com sucesso!' });
      } else {
        await ItemAuditoria.create(dataToSave);
        setUploadMessage({ type: 'success', text: 'Item criado com sucesso!' });
      }

      setIsFormOpen(false);
      loadItems();
      if (onUpdate) onUpdate();

      setTimeout(() => {
        setUploadMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      setUploadMessage({ type: 'error', text: 'Erro ao salvar item. Tente novamente.' });
    }
    });
  };

  const handleDeleteClick = (item) => {
    setDeleteItemInfo({ isOpen: true, item });
  };

  const handleDeleteConfirm = async () => {
    if (deleteItemInfo.item) {
      try {
        await ItemAuditoria.delete(deleteItemInfo.item.id);
        setUploadMessage({
          type: 'success',
          text: 'Item excluído com sucesso!'
        });
        loadItems();
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Erro ao excluir item:', error);
        if (error.response?.status === 404) {
          setUploadMessage({
            type: 'error',
            text: 'Item já foi excluído ou não existe. A lista será atualizada.'
          });
          loadItems();
          if (onUpdate) onUpdate();
        } else {
          setUploadMessage({
            type: 'error',
            text: 'Erro ao excluir item. Tente novamente.'
          });
        }
      }
      setDeleteItemInfo({ isOpen: false, item: null });
      
      setTimeout(() => {
        setUploadMessage({ type: '', text: '' });
      }, 3000);
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const data = [
      ['numero', 'item', 'referencia_norma', 'exemplo_situacao', 'categoria'],
      [1, 'Exemplo de item de auditoria', 'NTA 22A.903.c)', 'Exemplo de situação', 'resposta_emergencia']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');

    ws['!cols'] = [
      { wch: 10 },
      { wch: 40 },
      { wch: 20 },
      { wch: 30 },
      { wch: 20 }
    ];

    XLSX.writeFile(wb, 'modelo_itens_auditoria.xlsx');
  };

  const downloadItems = async () => {
    const XLSX = await import('xlsx');
    if (items.length === 0) {
      setUploadMessage({ type: 'error', text: 'Não há itens para descarregar.' });
      return;
    }

    const data = [
      ['numero', 'item', 'referencia_norma', 'exemplo_situacao', 'categoria'],
      ...items.map(item => [
        item.numero,
        item.item,
        item.referencia_norma,
        item.exemplo_situacao || '',
        item.categoria || ''
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Itens');

    ws['!cols'] = [
      { wch: 10 },
      { wch: 40 },
      { wch: 20 },
      { wch: 30 },
      { wch: 20 }
    ];

    XLSX.writeFile(wb, `itens_checklist_${tipoAuditoria?.nome?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);

    setUploadMessage({ type: 'success', text: 'Itens exportados com sucesso!' });
    setTimeout(() => setUploadMessage({ type: '', text: '' }), 3000);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadMessage({ type: '', text: '' });
      setExcelData([]);
    }
  };

  const handleProcessUpload = async () => {
    if (!selectedFile) {
      setUploadMessage({ type: 'error', text: 'Por favor, selecione um ficheiro primeiro.' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) {
          setUploadMessage({ type: 'error', text: 'O ficheiro Excel está vazio ou inválido.' });
          setIsUploading(false);
          return;
        }

        const itemsToProcess = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row[0] && !row[1] && !row[2] && !row[3] && !row[4]) continue;
          itemsToProcess.push({
            numero: String(row[0] || ''),
            item: String(row[1] || ''),
            referencia_norma: String(row[2] || ''),
            exemplo_situacao: String(row[3] || ''),
            categoria: String(row[4] || ''),
            status: 'ativo',
            tipo_auditoria_id: tipoAuditoria.id,
          });
        }

        if (itemsToProcess.length === 0) {
          setUploadMessage({ type: 'error', text: 'Nenhum item válido encontrado no ficheiro Excel.' });
          setIsUploading(false);
          return;
        }

        let successfulUploads = 0;
        for (const itemData of itemsToProcess) {
          await ItemAuditoria.create(itemData);
          successfulUploads++;
          setUploadProgress(Math.round((successfulUploads / itemsToProcess.length) * 100));
        }

        setUploadMessage({ type: 'success', text: `${successfulUploads} itens adicionados com sucesso!` });
        loadItems();
        if (onUpdate) onUpdate();

        setIsUploading(false);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (error) {
      console.error('Erro ao processar ficheiro Excel:', error);
      setUploadMessage({ type: 'error', text: 'Erro ao ler o ficheiro Excel. Verifique o formato.' });
      setIsUploading(false);
    }
  };

  const renderFormView = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('checklistItems.voltar')}
        </Button>
        <h3 className="text-lg font-medium">
          {editingItem ? t('checklistItems.editarItem') : t('checklistItems.novoItem')}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="numero">{t('checklistItems.numero')}</Label>
            <Input
              id="numero"
              placeholder="Ex: 1, 2, 3..."
              value={formData.numero}
              onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoria">{t('checklistItems.categoriaLabel')}</Label>
            <Select
              options={[
                { value: 'seguranca_operacional', label: t('configAuditoria.segurancaOperacional') },
                { value: 'seguranca_avsec', label: t('configAuditoria.segurancaAvsec') },
                { value: 'resposta_emergencia', label: t('configAuditoria.respostaEmergencia') },
                { value: 'infraestrutura', label: t('configAuditoria.infraestrutura') },
                { value: 'operacoes', label: t('configAuditoria.operacoes') }
              ]}
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              placeholder={t('checklistItems.selecioneCategoria')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="item">{t('checklistItems.itemLabel')}</Label>
          <Textarea
            id="item"
            placeholder={t('checklistItems.itemPlaceholder')}
            value={formData.item}
            onChange={(e) => setFormData({ ...formData, item: e.target.value })}
            rows={3}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="referencia_norma">{t('checklistItems.referenciaNorma')}</Label>
          <Input
            id="referencia_norma"
            placeholder="Ex: NTA 22A.903.c)"
            value={formData.referencia_norma}
            onChange={(e) => setFormData({ ...formData, referencia_norma: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exemplo_situacao">{t('checklistItems.exemploSituacao')}</Label>
          <Textarea
            id="exemplo_situacao"
            placeholder={t('checklistItems.exemploPlaceholder')}
            value={formData.exemplo_situacao}
            onChange={(e) => setFormData({ ...formData, exemplo_situacao: e.target.value })}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">{t('checklistItems.statusLabel')}</Label>
          <Select
            options={[
              { value: 'ativo', label: t('checklistItems.ativo') },
              { value: 'inativo', label: t('checklistItems.inativo') }
            ]}
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
            {t('checklistItems.cancelar')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('checklistItems.aGuardar') : (editingItem ? t('checklistItems.salvarItem') : t('checklistItems.criarItem'))}
          </Button>
        </div>
      </form>
    </div>
  );

  const renderMainView = () => (
    <div className="mt-6 flex-1 overflow-hidden">
      <div className="border rounded-lg h-full flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-medium">{t('checklistItems.itensChecklist')} ({items.length})</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              {t('checklistItems.baixarModelo')}
            </Button>
            <Button variant="outline" onClick={downloadItems}>
              <Download className="w-4 h-4 mr-2" />
              {t('checklistItems.descarregarItens')}
            </Button>
            <Button onClick={() => setIsUploadView(true)}>
              <FileUp className="w-4 h-4 mr-2" />
              {t('checklistItems.uploadExcel')}
            </Button>
            <Button onClick={() => openForm()}>
              <Plus className="w-4 h-4 mr-2" />
              {t('checklistItems.adicionarManual')}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50 z-10">
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead className="min-w-[300px]">{t('checklistItems.colItem')}</TableHead>
                <TableHead className="min-w-[300px]">{t('checklistItems.colExemplo')}</TableHead>
                <TableHead className="min-w-[250px]">{t('checklistItems.colNorma')}</TableHead>
                <TableHead className="min-w-[180px]">{t('checklistItems.colCategoria')}</TableHead>
                <TableHead className="min-w-[100px]">{t('checklistItems.colStatus')}</TableHead>
                <TableHead className="text-right min-w-[120px] sticky right-0 bg-slate-50">{t('checklistItems.colAcoes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t('checklistItems.carregandoItens')}
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <List className="mx-auto w-12 h-12 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">{t('checklistItems.nenhumItem')}</p>
                    <p className="text-sm text-slate-500">{t('checklistItems.adicionePrimeiro')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.numero}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{item.item}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-sm text-slate-600">{item.exemplo_situacao}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-sm text-slate-500">{item.referencia_norma}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.categoria?.replace(/_/g, ' ') || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.status === 'ativo'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right sticky right-0 bg-white">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openForm(item)}
                          className="hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteClick(item)}
                          className="hover:bg-red-50 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  const renderUploadView = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setIsUploadView(false)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('checklistItems.voltar')}
        </Button>
        <h3 className="text-lg font-medium">{t('checklistItems.uploadTitulo')}</h3>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('checklistItems.carregueExcel')}
        </h3>
        <p className="text-gray-500 mb-4">
          {t('checklistItems.uploadDesc')}
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          className="mb-4"
        >
          {t('checklistItems.selecionarFicheiro')}
        </Button>
        
        {selectedFile && (
          <div className="text-sm text-gray-600 mb-4">
            Ficheiro selecionado: {selectedFile.name}
          </div>
        )}
        
        {isUploading && (
          <div className="mb-4">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-gray-500 mt-2">{t('checklistItems.aProcessar')}</p>
          </div>
        )}
        
        <Button
          onClick={handleProcessUpload}
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? t('checklistItems.aCarregar') : t('checklistItems.processarFicheiro')}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="w-5 h-5 text-blue-600" />
            {t('checklistItems.titulo')} - {tipoAuditoria?.nome}
          </DialogTitle>
        </DialogHeader>

        {uploadMessage.text && (
          <Alert variant={uploadMessage.type === 'error' ? 'destructive' : 'default'} 
                className={uploadMessage.type === 'success' ? 'bg-green-50 border-green-200' : ''}>
            <AlertDescription className={uploadMessage.type === 'success' ? 'text-green-800' : ''}>
              {uploadMessage.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-hidden">
          {isFormOpen ? renderFormView() : isUploadView ? renderUploadView() : renderMainView()}
        </div>
      </DialogContent>

      <AlertModal
        isOpen={deleteItemInfo.isOpen}
        onClose={() => setDeleteItemInfo({ isOpen: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title={t('checklistItems.confirmarExclusao')}
        message={`Tem certeza que deseja excluir o item "${deleteItemInfo.item?.item}"?`}
        type="warning"
        confirmText={t('checklistItems.excluir')}
        showCancel
      />
    </Dialog>
  );
}