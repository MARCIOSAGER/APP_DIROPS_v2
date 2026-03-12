import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Combobox from '@/components/ui/combobox';
import Select from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { getAeroportosPermitidos } from '@/components/lib/userUtils';

const CATEGORIAS_RECEITA = [
  'Tarifas de Pouso',
  'Tarifas de Permanência', 
  'Tarifas de Passageiros',
  'Tarifas de Carga',
  'Taxas de Iluminação',
  'Credenciamentos',
  'Outras Receitas'
];

const CATEGORIAS_DESPESA = [
  'Salários e Vencimentos',
  'Manutenção de Equipamentos',
  'Energia e Utilidades',
  'Material de Escritório',
  'Combustíveis',
  'Formação e Capacitação',
  'Serviços Externos',
  'Outras Despesas'
];

export default function FormMovimentoFinanceiro({
  isOpen,
  onClose,
  onSubmit,
  movimento = null,
  aeroportos = [],
  currentUser = null
}) {
  const [formData, setFormData] = useState({
    aeroporto_id: '',
    data: new Date().toISOString().split('T')[0],
    tipo: 'receita',
    categoria: '',
    descricao: '',
    valor_kz: 0
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Filtrar aeroportos baseado no acesso do utilizador (empresa-based)
  const aeroportosAcesso = useMemo(() => {
    if (!currentUser || !Array.isArray(aeroportos)) {
      return [];
    }
    return getAeroportosPermitidos(currentUser, aeroportos);
  }, [aeroportos, currentUser]);

  useEffect(() => {
    if (movimento) {
      setFormData({
        aeroporto_id: movimento.aeroporto_id || '',
        data: movimento.data || new Date().toISOString().split('T')[0],
        tipo: movimento.tipo || 'receita',
        categoria: movimento.categoria || '',
        descricao: movimento.descricao || '',
        valor_kz: movimento.valor_kz || 0
      });
    } else {
      // Auto-selecionar aeroporto se o usuário tem acesso a apenas um
      if (aeroportosAcesso.length === 1) {
        setFormData(prev => ({
          ...prev,
          aeroporto_id: aeroportosAcesso[0].id
        }));
      }
    }
    setErrors({});
  }, [movimento, isOpen, aeroportosAcesso]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Limpar categoria quando muda o tipo
    if (field === 'tipo') {
      setFormData(prev => ({ ...prev, categoria: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.aeroporto_id) newErrors.aeroporto_id = 'Aeroporto é obrigatório';
    if (!formData.data) newErrors.data = 'Data é obrigatória';
    if (!formData.categoria) newErrors.categoria = 'Categoria é obrigatória';
    if (!formData.descricao) newErrors.descricao = 'Descrição é obrigatória';
    if (!formData.valor_kz || formData.valor_kz <= 0) newErrors.valor_kz = 'Valor deve ser maior que zero';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar movimento:', error);
      setErrors({ submit: 'Erro ao salvar o movimento. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const aeroportoOptions = useMemo(() => {
    return aeroportosAcesso.map(a => ({
      value: a.id,
      label: `${a.nome} (${a.codigo_icao})`
    }));
  }, [aeroportosAcesso]);

  const tipoOptions = [
    { value: 'receita', label: 'Receita' },
    { value: 'despesa', label: 'Despesa' }
  ];

  const categoriaOptions = useMemo(() => {
    const categorias = formData.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
    return categorias.map(c => ({ value: c, label: c }));
  }, [formData.tipo]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {movimento ? 'Editar Movimento' : 'Novo Movimento do Fundo de Maneio'}
          </DialogTitle>
        </DialogHeader>

        {aeroportosAcesso.length === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você não tem acesso a nenhum aeroporto. Contacte o administrador para obter permissões.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aeroporto_id">Aeroporto *</Label>
              <Combobox
                id="aeroporto_id"
                options={aeroportoOptions}
                value={formData.aeroporto_id}
                onValueChange={(value) => handleInputChange('aeroporto_id', value)}
                placeholder={aeroportosAcesso.length === 0 ? "Nenhum aeroporto disponível" : "Procurar aeroporto..."}
                searchPlaceholder="Procurar aeroporto..."
                noResultsMessage="Nenhum aeroporto encontrado"
                className={errors.aeroporto_id ? 'border-red-500' : ''}
                disabled={aeroportosAcesso.length === 0 || (aeroportosAcesso.length === 1 && !movimento)}
              />
              {errors.aeroporto_id && <p className="text-red-500 text-sm">{errors.aeroporto_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                value={formData.data}
                onChange={(e) => handleInputChange('data', e.target.value)}
                className={errors.data ? 'border-red-500' : ''}
              />
              {errors.data && <p className="text-red-500 text-sm">{errors.data}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                id="tipo"
                options={tipoOptions}
                value={formData.tipo}
                onValueChange={(value) => handleInputChange('tipo', value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select
                id="categoria"
                options={categoriaOptions}
                value={formData.categoria}
                onValueChange={(value) => handleInputChange('categoria', value)}
                placeholder="Selecione uma categoria"
                className={errors.categoria ? 'border-red-500' : ''}
              />
              {errors.categoria && <p className="text-red-500 text-sm">{errors.categoria}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor_kz">Valor (Kz) *</Label>
            <Input
              id="valor_kz"
              type="number"
              step="0.01"
              min="0"
              value={formData.valor_kz}
              onChange={(e) => handleInputChange('valor_kz', parseFloat(e.target.value) || 0)}
              className={errors.valor_kz ? 'border-red-500' : ''}
            />
            {errors.valor_kz && <p className="text-red-500 text-sm">{errors.valor_kz}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleInputChange('descricao', e.target.value)}
              placeholder="Descreva o movimento financeiro..."
              className={errors.descricao ? 'border-red-500' : ''}
              rows={3}
            />
            {errors.descricao && <p className="text-red-500 text-sm">{errors.descricao}</p>}
          </div>

          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || aeroportosAcesso.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? 'A guardar...' : (movimento ? 'Atualizar' : 'Criar Movimento')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}