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
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

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
  const { t } = useI18n();
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
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

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
    
    if (!formData.aeroporto_id) newErrors.aeroporto_id = t('formMov.erroAeroporto');
    if (!formData.data) newErrors.data = t('formMov.erroData');
    if (!formData.categoria) newErrors.categoria = t('formMov.erroCategoria');
    if (!formData.descricao) newErrors.descricao = t('formMov.erroDescricao');
    if (!formData.valor_kz || formData.valor_kz <= 0) newErrors.valor_kz = t('formMov.erroValor');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    guardedSubmit(async () => {
      setIsLoading(true);
      try {
        await onSubmit(formData);
        onClose();
      } catch (error) {
        console.error('Erro ao salvar movimento:', error);
        setErrors({ submit: t('formMov.erroSalvar') });
      } finally {
        setIsLoading(false);
      }
    });
  };

  const aeroportoOptions = useMemo(() => {
    return aeroportosAcesso.map(a => ({
      value: a.id,
      label: `${a.nome} (${a.codigo_icao})`
    }));
  }, [aeroportosAcesso]);

  const tipoOptions = [
    { value: 'receita', label: t('formMov.receita') },
    { value: 'despesa', label: t('formMov.despesa') }
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
            {movimento ? t('formMov.editarMovimento') : t('formMov.novoMovimento')}
          </DialogTitle>
        </DialogHeader>

        {aeroportosAcesso.length === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('formMov.semAcesso')}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aeroporto_id">{t('formMov.aeroporto')}</Label>
              <Combobox
                id="aeroporto_id"
                options={aeroportoOptions}
                value={formData.aeroporto_id}
                onValueChange={(value) => handleInputChange('aeroporto_id', value)}
                placeholder={aeroportosAcesso.length === 0 ? t('formMov.nenhumAeroporto') : t('formMov.procurarAeroporto')}
                searchPlaceholder={t('formMov.procurarAeroporto')}
                noResultsMessage={t('formMov.nenhumEncontrado')}
                className={errors.aeroporto_id ? 'border-red-500' : ''}
                disabled={aeroportosAcesso.length === 0 || (aeroportosAcesso.length === 1 && !movimento)}
              />
              {errors.aeroporto_id && <p className="text-red-500 text-sm">{errors.aeroporto_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">{t('formMov.data')}</Label>
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
              <Label htmlFor="tipo">{t('formMov.tipo')}</Label>
              <Select
                id="tipo"
                options={tipoOptions}
                value={formData.tipo}
                onValueChange={(value) => handleInputChange('tipo', value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">{t('formMov.categoria')}</Label>
              <Select
                id="categoria"
                options={categoriaOptions}
                value={formData.categoria}
                onValueChange={(value) => handleInputChange('categoria', value)}
                placeholder={t('formMov.selecioneCategoria')}
                className={errors.categoria ? 'border-red-500' : ''}
              />
              {errors.categoria && <p className="text-red-500 text-sm">{errors.categoria}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor_kz">{t('formMov.valorKz')}</Label>
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
            <Label htmlFor="descricao">{t('formMov.descricao')}</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleInputChange('descricao', e.target.value)}
              placeholder={t('formMov.descricaoPlaceholder')}
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
            {t('formMov.cancelar')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || isSubmitting || aeroportosAcesso.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading || isSubmitting ? t('formMov.aGuardar') : (movimento ? t('formMov.atualizar') : t('formMov.criarMovimento'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}