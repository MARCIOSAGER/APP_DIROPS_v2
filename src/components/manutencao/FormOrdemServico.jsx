
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
import { useI18n } from '@/components/lib/i18n';

export default function FormOrdemServico({ isOpen, onClose, onSubmit, aeroportos, ordemInicial = null }) {
  const { t } = useI18n();
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [errors, setErrors] = useState({});
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
        aeroporto_id: aeroportos?.length === 1 ? aeroportos[0].id : '',
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

  const validate = () => {
    const newErrors = {};
    if (!formData.titulo?.trim()) newErrors.titulo = t('manutencaoForm.campoObrigatorio');
    if (!formData.descricao_problema?.trim()) newErrors.descricao_problema = t('manutencaoForm.campoObrigatorio');
    if (!formData.aeroporto_id) newErrors.aeroporto_id = t('manutencaoForm.campoObrigatorio');
    if (!formData.prioridade) newErrors.prioridade = t('manutencaoForm.campoObrigatorio');
    if (!formData.categoria_manutencao) newErrors.categoria_manutencao = t('manutencaoForm.campoObrigatorio');
    if (formData.tipo_execucao === 'terceirizado' && !formData.fornecedor?.trim()) {
      newErrors.fornecedor = t('manutencaoForm.fornecedorObrigatorio');
    }
    if (formData.custos_estimados !== '' && formData.custos_estimados !== null) {
      const custos = parseFloat(formData.custos_estimados);
      if (isNaN(custos) || custos < 0) newErrors.custos_estimados = t('manutencaoForm.valorInvalido');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
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
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const prioridadeOptions = [
    { value: 'baixa', label: t('manutencao.baixa') },
    { value: 'media', label: t('manutencao.media') },
    { value: 'alta', label: t('manutencao.alta') },
    { value: 'urgente', label: t('manutencao.urgente') }
  ];

  const categoriaOptions = [
    { value: 'infraestrutura', label: t('manutencaoForm.catInfraestrutura') },
    { value: 'equipamentos', label: t('manutencaoForm.catEquipamentos') },
    { value: 'sinalizacao', label: t('manutencaoForm.catSinalizacao') },
    { value: 'pavimento', label: t('manutencaoForm.catPavimento') },
    { value: 'drenagem', label: t('manutencaoForm.catDrenagem') },
    { value: 'iluminacao', label: t('manutencaoForm.catIluminacao') },
    { value: 'outros', label: t('manutencaoForm.catOutros') }
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
            {ordemInicial ? t('manutencaoForm.editarOS') : t('manutencaoForm.novaOS')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('manutencaoForm.titulo')}</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                placeholder={t('manutencaoForm.tituloPlaceholder')}
                className={errors.titulo ? 'border-red-500' : ''}
              />
              {errors.titulo && <p className="text-red-500 text-xs mt-1">{errors.titulo}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t('manutencaoForm.aeroporto')}</Label>
              <Select
                options={aeroportoOptions}
                value={formData.aeroporto_id}
                onValueChange={(value) => handleChange('aeroporto_id', value)}
                placeholder={t('manutencaoForm.selecionarAeroporto')}
              />
              {errors.aeroporto_id && <p className="text-red-500 text-xs mt-1">{errors.aeroporto_id}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('manutencaoForm.descricaoProblema')}</Label>
            <Textarea
              value={formData.descricao_problema}
              onChange={(e) => handleChange('descricao_problema', e.target.value)}
              placeholder={t('manutencaoForm.descricaoProblemaPlaceholder')}
              rows={3}
              className={errors.descricao_problema ? 'border-red-500' : ''}
            />
            {errors.descricao_problema && <p className="text-red-500 text-xs mt-1">{errors.descricao_problema}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('manutencaoForm.acaoCorretiva')}</Label>
            <Textarea
              value={formData.acao_corretiva_sugerida}
              onChange={(e) => handleChange('acao_corretiva_sugerida', e.target.value)}
              placeholder={t('manutencaoForm.acaoCorretivaPlaceholder')}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('manutencaoForm.prioridade')}</Label>
              <Select
                options={prioridadeOptions}
                value={formData.prioridade}
                onValueChange={(value) => handleChange('prioridade', value)}
              />
              {errors.prioridade && <p className="text-red-500 text-xs mt-1">{errors.prioridade}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t('manutencaoForm.categoria')}</Label>
              <Select
                options={categoriaOptions}
                value={formData.categoria_manutencao}
                onValueChange={(value) => handleChange('categoria_manutencao', value)}
                placeholder={t('manutencaoForm.selecionarCategoria')}
              />
              {errors.categoria_manutencao && <p className="text-red-500 text-xs mt-1">{errors.categoria_manutencao}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t('manutencaoForm.prazoEstimado')}</Label>
              <Input
                type="date"
                value={formData.prazo_estimado}
                onChange={(e) => handleChange('prazo_estimado', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('manutencaoForm.tipoExecucao')}</Label>
              <Select
                options={[
                  { value: 'interna', label: t('manutencaoForm.interna') },
                  { value: 'terceirizado', label: t('manutencaoForm.terceirizado') }
                ]}
                value={formData.tipo_execucao}
                onValueChange={(value) => handleChange('tipo_execucao', value)}
              />
            </div>

            {formData.tipo_execucao === 'terceirizado' && (
              <>
                <div className="space-y-2">
                  <Label>{t('manutencaoForm.fornecedor')}</Label>
                  <Input
                    value={formData.fornecedor}
                    onChange={(e) => handleChange('fornecedor', e.target.value)}
                    placeholder={t('manutencaoForm.fornecedorPlaceholder')}
                    className={errors.fornecedor ? 'border-red-500' : ''}
                  />
                  {errors.fornecedor && <p className="text-red-500 text-xs mt-1">{errors.fornecedor}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('manutencaoForm.contactoFornecedor')}</Label>
                  <Input
                    value={formData.contato_fornecedor}
                    onChange={(e) => handleChange('contato_fornecedor', e.target.value)}
                    placeholder={t('manutencaoForm.contactoFornecedorPlaceholder')}
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('manutencaoForm.responsavelManutencao')}</Label>
              <Input
                value={formData.responsavel_manutencao}
                onChange={(e) => handleChange('responsavel_manutencao', e.target.value)}
                placeholder={t('manutencaoForm.responsavelPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('manutencaoForm.custosEstimados')}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.custos_estimados}
                onChange={(e) => handleChange('custos_estimados', e.target.value)}
                placeholder="0.00"
                className={errors.custos_estimados ? 'border-red-500' : ''}
              />
              {errors.custos_estimados && <p className="text-red-500 text-xs mt-1">{errors.custos_estimados}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('manutencaoForm.observacoesManutencao')}</Label>
            <Textarea
              value={formData.observacoes_manutencao}
              onChange={(e) => handleChange('observacoes_manutencao', e.target.value)}
              placeholder={t('manutencaoForm.observacoesPlaceholder')}
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="aprovacao"
              checked={formData.aprovacao_necessaria}
              onCheckedChange={(checked) => handleChange('aprovacao_necessaria', checked)}
            />
            <Label htmlFor="aprovacao">{t('manutencaoForm.requerAprovacao')}</Label>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t('manutencaoForm.cancelar')}</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? t('manutencaoForm.guardar') : (ordemInicial ? t('manutencaoForm.atualizarOrdem') : t('manutencaoForm.criarOrdem'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
