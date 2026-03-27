import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import AsyncCombobox from '@/components/ui/async-combobox';
import { Plus } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

export default function ArrivalSection({
  formData,
  errors,
  onChange,
  tipoMovimentoOptions,
  statusOptions,
  tipoVooOptions,
  aeroportoOperacaoOptions,
  aeroportoOrigemDestinoOptions,
  aeroportosAcesso,
  vooInicial,
  searchCompanhias,
  getCompanhiaInicial,
  searchRegistos,
  getRegistoInicial,
  onShowCreateCompanhia,
  onShowCreateRegisto,
  onShowCreateAeroporto
}) {
  const { t } = useI18n();

  return (
    <>
      {/* --- Linha 1: Informacoes Principais --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_operacao">{t('formVoo.dataOperacao')} *</Label>
          <Input
            id="data_operacao"
            type="date"
            value={formData.data_operacao}
            onChange={(e) => onChange('data_operacao', e.target.value)}
            className={errors.data_operacao ? 'border-red-500' : ''} />
          {errors.data_operacao && <p className="text-red-500 text-sm">{errors.data_operacao}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipo_movimento">{t('formVoo.tipoMovimento')} *</Label>
          <Select
            id="tipo_movimento"
            options={tipoMovimentoOptions}
            value={formData.tipo_movimento}
            onValueChange={(value) => onChange('tipo_movimento', value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="numero_voo">{t('formVoo.numeroVoo')} *</Label>
          <Input
            id="numero_voo"
            value={formData.numero_voo}
            onChange={(e) => onChange('numero_voo', e.target.value)}
            placeholder="Ex: DT123"
            className={errors.numero_voo ? 'border-red-500' : ''} />
          {errors.numero_voo && <p className="text-red-500 text-sm">{errors.numero_voo}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">{t('formVoo.status')}</Label>
          <Select
            id="status"
            options={statusOptions}
            value={formData.status}
            onValueChange={(value) => onChange('status', value)} />
        </div>
      </div>

      {/* --- Linha 2: Companhia e Horarios --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="companhia_aerea">{t('formVoo.companhiaAerea')} *</Label>
          <AsyncCombobox
            id="companhia_aerea"
            value={formData.companhia_aerea}
            onValueChange={(value) => onChange('companhia_aerea', value)}
            placeholder={t('formVoo.pesquisarCompanhia')}
            searchPlaceholder={t('formVoo.digitarNomeCodigo')}
            noResultsMessage={t('formVoo.nenhumaCompanhia')}
            onSearch={searchCompanhias}
            getInitialOption={getCompanhiaInicial}
            minSearchLength={2}
            className={errors.companhia_aerea ? 'border-red-500' : ''} />
          <button
            type="button"
            onClick={onShowCreateCompanhia}
            className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">
            <Plus className="w-3 h-3" />
            {t('formVoo.criarNovaCompanhia')}
          </button>
          {errors.companhia_aerea && <p className="text-red-500 text-sm">{errors.companhia_aerea}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="registo_aeronave">{t('formVoo.registo')} *</Label>
          <AsyncCombobox
            id="registo_aeronave"
            value={formData.registo_aeronave}
            onValueChange={(value) => onChange('registo_aeronave', value)}
            placeholder={formData.companhia_aerea ? t('formVoo.pesquisar') : t('formVoo.selecioneCompanhia')}
            searchPlaceholder={t('formVoo.procurarRegisto')}
            noResultsMessage={t('formVoo.nenhumRegisto')}
            onSearch={searchRegistos}
            getInitialOption={getRegistoInicial}
            minSearchLength={1}
            disabled={!formData.companhia_aerea}
            className={errors.registo_aeronave ? 'border-red-500' : ''} />
          {formData.companhia_aerea &&
            <button
              type="button"
              onClick={onShowCreateRegisto}
              className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">
              <Plus className="w-3 h-3" />
              {t('formVoo.criarNovoRegisto')}
            </button>
          }
          {errors.registo_aeronave && <p className="text-red-500 text-sm">{errors.registo_aeronave}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="horario_previsto" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('formVoo.horarioSTA')} *</Label>
          <Input
            id="horario_previsto"
            type="time"
            step="300"
            value={formData.horario_previsto}
            onChange={(e) => onChange('horario_previsto', e.target.value)}
            className={errors.horario_previsto ? 'border-red-500' : ''} />
          {errors.horario_previsto && <p className="text-red-500 text-sm">{errors.horario_previsto}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="horario_real" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('formVoo.horarioReal')}</Label>
          <Input
            id="horario_real"
            type="time"
            step="60"
            value={formData.horario_real}
            onChange={(e) => onChange('horario_real', e.target.value)}
            className={errors.horario_real ? 'border-red-500' : ''} />
          {errors.horario_real && <p className="text-red-500 text-sm">{errors.horario_real}</p>}
        </div>
      </div>

      {/* --- Linha 3: Rota --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aeroporto_operacao">{t('formVoo.aeroportoOperacao')} *</Label>
          <Combobox
            id="aeroporto_operacao"
            options={aeroportoOperacaoOptions}
            value={formData.aeroporto_operacao}
            onValueChange={(value) => onChange('aeroporto_operacao', value)}
            placeholder={aeroportosAcesso.length === 0 ? t('formVoo.nenhumAeroporto') : t('formVoo.pesquisarAeroporto')}
            searchPlaceholder={t('formVoo.procurarAeroporto')}
            noResultsMessage={t('formVoo.nenhumAeroportoEncontrado')}
            className={errors.aeroporto_operacao ? 'border-red-500' : ''}
            disabled={aeroportosAcesso.length === 1 && !vooInicial} />
          {aeroportosAcesso.length === 0 &&
            <p className="text-sm text-red-500">
              ⚠️ {t('formVoo.semAcessoAeroporto')}
            </p>
          }
          {errors.aeroporto_operacao && <p className="text-red-500 text-sm">{errors.aeroporto_operacao}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="aeroporto_origem_destino">
            {formData.tipo_movimento === 'ARR' ? `${t('formVoo.origem')} *` : `${t('formVoo.destino')} *`}
          </Label>
          <Combobox
            id="aeroporto_origem_destino"
            options={aeroportoOrigemDestinoOptions}
            value={formData.aeroporto_origem_destino}
            onValueChange={(value) => onChange('aeroporto_origem_destino', value)}
            placeholder={t('formVoo.pesquisarAeroporto')}
            searchPlaceholder={t('formVoo.procurarAeroporto')}
            noResultsMessage={t('formVoo.nenhumAeroportoEncontrado')}
            className={errors.aeroporto_origem_destino ? 'border-red-500' : ''}
            useDisplayLabel={true} />
          <button
            type="button"
            onClick={onShowCreateAeroporto}
            className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">
            <Plus className="w-3 h-3" />
            {t('formVoo.naoEncontrouCriar')}
          </button>
          {errors.aeroporto_origem_destino && <p className="text-red-500 text-sm">{errors.aeroporto_origem_destino}</p>}
        </div>
      </div>

      {/* --- Linha 4: Stand + Checkboxes Especiais --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="posicao_stand">{t('formVoo.posicaoStand')}</Label>
          <Input
            id="posicao_stand"
            value={formData.posicao_stand}
            onChange={(e) => onChange('posicao_stand', e.target.value)}
            placeholder="Ex: A1"
          />
        </div>
        <div className="flex items-center space-x-2 pb-2">
          <Checkbox
            id="aeronave_no_hangar"
            checked={formData.aeronave_no_hangar}
            onCheckedChange={(checked) => onChange('aeronave_no_hangar', checked)}
          />
          <Label htmlFor="aeronave_no_hangar" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
            {t('formVoo.hangar')}
          </Label>
        </div>
        <div className="flex items-center space-x-2 pb-2">
          <Checkbox
            id="requer_iluminacao_extra"
            checked={formData.requer_iluminacao_extra}
            onCheckedChange={(checked) => onChange('requer_iluminacao_extra', checked)}
          />
          <Label htmlFor="requer_iluminacao_extra" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
            {t('formVoo.iluminacaoExtra')}
          </Label>
        </div>
      </div>

      {/* --- Linha 5: Detalhes Adicionais --- */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tipo_voo">{t('formVoo.tipoVoo')}</Label>
          <Combobox
            id="tipo_voo"
            options={tipoVooOptions}
            value={formData.tipo_voo}
            onValueChange={(value) => onChange('tipo_voo', value)}
            placeholder={t('formVoo.selecioneTipoVoo')}
            searchPlaceholder={t('formVoo.pesquisarTipoVoo')}
            noResultsMessage={t('formVoo.nenhumTipoVoo')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tripulacao">{t('formVoo.tripulacao')}</Label>
          <Input
            id="tripulacao"
            type="number"
            min="0"
            value={formData.tripulacao}
            onChange={(e) => onChange('tripulacao', parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="carga_kg">{t('formVoo.cargaKg')}</Label>
          <Input
            id="carga_kg"
            type="number"
            min="0"
            step="0.01"
            value={formData.carga_kg}
            onChange={(e) => onChange('carga_kg', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="observacoes">{t('formVoo.observacoes')}</Label>
          <Input
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => onChange('observacoes', e.target.value)}
            placeholder={t('formVoo.observacoesPlaceholder')} />
        </div>
      </div>
    </>
  );
}
