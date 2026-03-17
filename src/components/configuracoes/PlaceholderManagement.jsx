import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Save, X, Tag } from 'lucide-react';
import { Placeholder } from '@/entities/Placeholder';
import Select from '@/components/ui/select';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function PlaceholderManagement({ onError, onSuccess }) {
  const [placeholders, setPlaceholders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [editingPlaceholder, setEditingPlaceholder] = useState(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    valor_padrao: '',
    descricao: '',
    categoria: 'geral',
    ativo: true
  });

  useEffect(() => {
    loadPlaceholders();
  }, []);

  const loadPlaceholders = async () => {
    setIsLoading(true);
    try {
      const data = await Placeholder.list();
      setPlaceholders(data || []);
    } catch (error) {
      console.error('Erro ao carregar placeholders:', error);
      onError?.('Não foi possível carregar os placeholders.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (placeholder = null) => {
    if (placeholder) {
      setEditingPlaceholder(placeholder);
      setFormData({
        nome: placeholder.nome || '',
        valor_padrao: placeholder.valor_padrao || '',
        descricao: placeholder.descricao || '',
        categoria: placeholder.categoria || 'geral',
        ativo: placeholder.ativo !== undefined ? placeholder.ativo : true
      });
    } else {
      setEditingPlaceholder(null);
      setFormData({
        nome: '',
        valor_padrao: '',
        descricao: '',
        categoria: 'geral',
        ativo: true
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPlaceholder(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nome || !formData.valor_padrao || !formData.descricao) {
      onError?.('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    guardedSubmit(async () => {
    try {
      if (editingPlaceholder) {
        await Placeholder.update(editingPlaceholder.id, formData);
        onSuccess?.(`Placeholder "${formData.nome}" atualizado com sucesso!`);
      } else {
        await Placeholder.create(formData);
        onSuccess?.(`Placeholder "${formData.nome}" criado com sucesso!`);
      }

      await loadPlaceholders();
      handleCloseForm();
    } catch (error) {
      console.error('Erro ao salvar placeholder:', error);
      onError?.('Não foi possível salvar o placeholder.');
    }
    });
  };

  const handleDelete = async (placeholder) => {
    if (!confirm(`Tem certeza que deseja excluir o placeholder "${placeholder.nome}"?`)) {
      return;
    }

    try {
      await Placeholder.delete(placeholder.id);
      await loadPlaceholders();
      onSuccess?.(`Placeholder "${placeholder.nome}" excluído com sucesso!`);
    } catch (error) {
      console.error('Erro ao excluir placeholder:', error);
      onError?.('Não foi possível excluir o placeholder.');
    }
  };

  const categoriasBadge = {
    empresa: 'bg-blue-100 text-blue-700',
    contato: 'bg-green-100 text-green-700',
    geral: 'bg-slate-100 text-slate-700'
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-slate-600">A carregar placeholders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Gestão de Placeholders
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Crie placeholders globais para usar nos templates de notificação
          </p>
        </div>
        <Button onClick={() => handleOpenForm()} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Novo Placeholder
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>ℹ️ Como funciona:</strong> Os placeholders criados aqui estarão disponíveis 
          para uso em todos os templates de notificação (WhatsApp e Email). Use o formato 
          <code className="bg-blue-100 px-2 py-1 rounded ml-1">{'{{nome_placeholder}}'}</code> 
          nos seus templates.
        </p>
      </div>

      {placeholders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Tag className="w-12 h-12 mx-auto mb-4 opacity-30 text-slate-400" />
            <p className="text-slate-600">Nenhum placeholder criado.</p>
            <p className="text-sm text-slate-500 mt-1">
              Clique em "Novo Placeholder" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {placeholders.map((placeholder) => (
            <Card key={placeholder.id} className={!placeholder.ativo ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="bg-slate-100 px-3 py-1 rounded text-sm font-mono text-slate-800">
                        {`{{${placeholder.nome}}}`}
                      </code>
                      <Badge className={categoriasBadge[placeholder.categoria] || categoriasBadge.geral}>
                        {placeholder.categoria}
                      </Badge>
                      {!placeholder.ativo && (
                        <Badge variant="outline" className="text-slate-500">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{placeholder.descricao}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium">Valor padrão:</span>
                      <span className="bg-slate-50 px-2 py-1 rounded">
                        {placeholder.valor_padrao}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenForm(placeholder)}
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(placeholder)}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Formulário */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingPlaceholder ? 'Editar Placeholder' : 'Novo Placeholder'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <Label htmlFor="nome">
                  Nome do Placeholder <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="Ex: nome_empresa, telefone_suporte"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use apenas letras minúsculas, números e underscore. Será usado como: {`{{${formData.nome || 'nome'}}}`}
                </p>
              </div>

              <div>
                <Label htmlFor="valor_padrao">
                  Valor Padrão <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="valor_padrao"
                  value={formData.valor_padrao}
                  onChange={(e) => handleInputChange('valor_padrao', e.target.value)}
                  placeholder="Ex: DIROPS, +244 923 456 789"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Valor que substituirá o placeholder nos templates
                </p>
              </div>

              <div>
                <Label htmlFor="descricao">
                  Descrição <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => handleInputChange('descricao', e.target.value)}
                  placeholder="Ex: Nome oficial da empresa para usar em comunicações"
                  rows={3}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Descrição para ajudar outros utilizadores a entender o propósito
                </p>
              </div>

              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  id="categoria"
                  options={[
                    { value: 'empresa', label: 'Empresa' },
                    { value: 'contato', label: 'Contacto' },
                    { value: 'geral', label: 'Geral' }
                  ]}
                  value={formData.categoria}
                  onValueChange={(v) => handleInputChange('categoria', v)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Categoria para organizar os placeholders
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => handleInputChange('ativo', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="ativo" className="cursor-pointer">
                  Placeholder ativo (disponível para uso)
                </Label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseForm}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'A guardar...' : `${editingPlaceholder ? 'Atualizar' : 'Criar'} Placeholder`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}