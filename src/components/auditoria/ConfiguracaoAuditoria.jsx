
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select'; // Corrected import for custom Select component
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  AlertCircle,
  CheckCircle,
  Shield,
  AlertTriangle,
  Building,
  Plane,
  List
} from 'lucide-react';

import { TipoAuditoria } from '@/entities/TipoAuditoria';
import ManageChecklistItemsModal from './ManageChecklistItemsModal';
import useSubmitGuard from '@/hooks/useSubmitGuard';

const CATEGORIA_ICONS = {
  seguranca_operacional: Shield,
  seguranca_avsec: AlertTriangle,
  resposta_emergencia: AlertTriangle,
  infraestrutura: Building,
  operacoes: Plane
};

const CATEGORIA_LABELS = {
  seguranca_operacional: 'Segurança Operacional',
  seguranca_avsec: 'Segurança AVSEC',
  resposta_emergencia: 'Resposta a Emergência',
  infraestrutura: 'Infraestrutura',
  operacoes: 'Operações'
};

export default function ConfiguracaoAuditoria({ tipos, onUpdate }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [selectedTipoForItems, setSelectedTipoForItems] = useState(null);

  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    descricao: '',
    categoria: '',
    status: 'ativo'
  });

  const openForm = (tipo = null) => {
    if (tipo) {
      setFormData({
        nome: tipo.nome,
        codigo: tipo.codigo,
        descricao: tipo.descricao,
        categoria: tipo.categoria,
        status: tipo.status
      });
      setEditingTipo(tipo);
    } else {
      setFormData({
        nome: '',
        codigo: '',
        descricao: '',
        categoria: '',
        status: 'ativo'
      });
      setEditingTipo(null);
    }
    setIsFormOpen(true);
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.nome || !formData.codigo || !formData.categoria) {
      setMessage({
        type: 'error',
        text: 'Por favor, preencha todos os campos obrigatórios.'
      });
      return;
    }

    guardedSubmit(async () => {
    setIsLoading(true);

    try {
      if (editingTipo) {
        await TipoAuditoria.update(editingTipo.id, formData);
        setMessage({
          type: 'success',
          text: 'Tipo de auditoria atualizado com sucesso!'
        });
      } else {
        await TipoAuditoria.create(formData);
        setMessage({
          type: 'success',
          text: 'Tipo de auditoria criado com sucesso!'
        });
      }

      setTimeout(() => {
        setIsFormOpen(false);
        onUpdate();
      }, 1500);

    } catch (error) {
      console.error('Erro ao salvar tipo:', error);
      setMessage({
        type: 'error',
        text: 'Erro ao salvar tipo de auditoria. Verifique se o código é único.'
      });
    } finally {
      setIsLoading(false);
    }
    });
  };

  const handleDelete = async (tipo) => {
    if (!confirm(`Tem certeza que deseja excluir o tipo "${tipo.nome}"?`)) {
      return;
    }

    try {
      await TipoAuditoria.delete(tipo.id);
      onUpdate();
    } catch (error) {
      console.error('Erro ao excluir tipo:', error);
      alert('Erro ao excluir tipo de auditoria. Pode haver auditorias associadas.');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleManageItems = (tipo) => {
    setSelectedTipoForItems(tipo);
    setIsItemsModalOpen(true);
  };
  
  // Prepare options for the custom Select component
  const categoriaOptions = Object.entries(CATEGORIA_LABELS).map(([key, label]) => ({ value: key, label: label }));
  const statusOptions = [{value: 'ativo', label: 'Ativo'}, {value: 'inativo', label: 'Inativo'}];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Tipos de Auditoria
            </CardTitle>
            <Button onClick={() => openForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Tipo
            </Button>
          </div>
          <p className="text-slate-600 mt-1">Gerencie os tipos de auditoria e seus itens de checklist.</p>
        </CardHeader>
        <CardContent>
          {/* Formulário de Criação/Edição de Tipo */}
          {isFormOpen && (
            <Card className="mb-6 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {editingTipo ? 'Editar Tipo de Auditoria' : 'Novo Tipo de Auditoria'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {message.text && (
                  <Alert variant={message.type === 'error' ? 'destructive' : 'default'}
                        className={`mb-4 ${message.type === 'success' ? 'bg-green-50 border-green-200' : ''}`}>
                    {message.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {message.type === 'error' && <AlertCircle className="h-4 w-4" />}
                    <AlertDescription className={message.type === 'success' ? 'text-green-800' : ''}>
                      {message.text}
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        placeholder="Ex: Auditoria de Segurança Operacional"
                        value={formData.nome}
                        onChange={(e) => handleInputChange('nome', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="codigo">Código *</Label>
                      <Input
                        id="codigo"
                        placeholder="Ex: AVSEC, OPS, SGA"
                        value={formData.codigo}
                        onChange={(e) => handleInputChange('codigo', e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="categoria">Categoria *</Label>
                      <Select
                        options={categoriaOptions}
                        value={formData.categoria}
                        onValueChange={(value) => handleInputChange('categoria', value)}
                        placeholder="Selecione a categoria"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        options={statusOptions}
                        value={formData.status}
                        onValueChange={(value) => handleInputChange('status', value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      placeholder="Descrição detalhada do tipo de auditoria..."
                      value={formData.descricao}
                      onChange={(e) => handleInputChange('descricao', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading
                        ? (editingTipo ? 'Atualizando...' : 'Criando...')
                        : (editingTipo ? 'Atualizar' : 'Criar')
                      }
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Lista de Tipos */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Tipos de Auditoria Cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              {tipos.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    Nenhum tipo cadastrado
                  </h3>
                  <p className="text-slate-500 mb-4">
                    Crie o primeiro tipo de auditoria para começar.
                  </p>
                  <Button onClick={() => openForm()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Tipo
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tipos.map((tipo) => {
                        const IconComponent = CATEGORIA_ICONS[tipo.categoria];
                        return (
                          <TableRow key={tipo.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{tipo.nome}</div>
                                {tipo.descricao && (
                                  <div className="text-sm text-slate-500 mt-1">
                                    {tipo.descricao.substring(0, 100)}
                                    {tipo.descricao.length > 100 && '...'}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tipo.codigo}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {IconComponent && <IconComponent className="w-4 h-4 text-slate-500" />}
                                <span className="capitalize">
                                  {CATEGORIA_LABELS[tipo.categoria] || tipo.categoria}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                tipo.status === 'ativo'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }>
                                {tipo.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleManageItems(tipo)}
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  <List className="w-4 h-4 mr-1" />
                                  Itens
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openForm(tipo)}
                                >
                                  <Edit className="w-4 h-4 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => handleDelete(tipo)}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Excluir
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Modal de Gestão de Itens */}
      {isItemsModalOpen && selectedTipoForItems && (
        <ManageChecklistItemsModal
          isOpen={isItemsModalOpen}
          onClose={() => {
            setIsItemsModalOpen(false);
            setSelectedTipoForItems(null);
          }}
          tipoAuditoria={selectedTipoForItems}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
