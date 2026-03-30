import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import AsyncCombobox from '@/components/ui/async-combobox';
import { Plus, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/components/lib/i18n';

export default function DepartureSection({
  formData,
  errors,
  onChange,
  tipoMovimentoOptions,
  statusOptions,
  tipoVooOptions,
  voosArrOptions,
  linkedArrVooId,
  onLinkedVooChange,
  horarioMinimoDep,
  voos,
  searchRegistos,
  getRegistoInicial,
  searchAeroportos,
  getAeroportoInicial,
  onShowCreateAeroporto
}) {
  const { t } = useI18n();

  return (
    <>
      {/* --- Linha 1: Data, Tipo, Vinculacao --- */}
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
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="linked_arr_voo">{t('formVoo.vooVinculado')} *</Label>
          <Combobox
            id="linked_arr_voo"
            options={voosArrOptions}
            value={linkedArrVooId}
            onValueChange={onLinkedVooChange}
            placeholder={!formData.data_operacao ? t('formVoo.preenchaDataPrimeiro') : t('formVoo.pesquisarVoo')}
            searchPlaceholder={t('formVoo.procurarVoo')}
            noResultsMessage={t('formVoo.nenhumVooDisponivel')}
            disabled={!formData.data_operacao}
            className={`${errors.linked_arr_voo ? 'border-red-500' : ''}`}
            maxHeight="200px" />
          {errors.linked_arr_voo && <p className="text-red-500 text-sm">{errors.linked_arr_voo}</p>}
        </div>
      </div>

      {/* --- Linha 2: Detalhes do Voo e Status --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <Label htmlFor="horario_previsto" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('formVoo.horarioSTD')} *</Label>
          <Input
            id="horario_previsto"
            type="time"
            step="300"
            value={formData.horario_previsto}
            onChange={(e) => onChange('horario_previsto', e.target.value)}
            className={errors.horario_previsto ? 'border-red-500' : ''}
            min={horarioMinimoDep} />
          {errors.horario_previsto && <p className="text-red-500 text-sm">{errors.horario_previsto}</p>}
          {horarioMinimoDep &&
            <p className="text-xs text-slate-500">
              {t('formVoo.devePosteriorChegada')} ({horarioMinimoDep})
            </p>
          }
        </div>
        <div className="space-y-2">
          <Label htmlFor="horario_real" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('formVoo.horarioReal')}</Label>
          <Input
            id="horario_real"
            type="time"
            step="60"
            value={formData.horario_real}
            onChange={(e) => onChange('horario_real', e.target.value)}
            min={horarioMinimoDep}
            className={errors.horario_real ? 'border-red-500' : ''} />
          {errors.horario_real && <p className="text-red-500 text-sm">{errors.horario_real}</p>}
          {horarioMinimoDep &&
            <p className="text-xs text-slate-500">
              {t('formVoo.devePosteriorChegada')} ({horarioMinimoDep})
            </p>
          }
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

      {/* --- Linha 3: Stand + Checkboxes Especiais --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="posicao_stand_dep">{t('formVoo.posicaoStand')}</Label>
          <Input
            id="posicao_stand_dep"
            value={formData.posicao_stand}
            onChange={(e) => onChange('posicao_stand', e.target.value)}
            placeholder="Ex: A1"
          />
        </div>
        <div className="flex items-center space-x-2 pb-2">
          <Checkbox
            id="aeronave_no_hangar_dep"
            checked={formData.aeronave_no_hangar}
            onCheckedChange={(checked) => onChange('aeronave_no_hangar', checked)}
          />
          <Label htmlFor="aeronave_no_hangar_dep" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
            {t('formVoo.hangar')}
          </Label>
        </div>
        <div className="flex items-center space-x-2 pb-2">
          <Checkbox
            id="requer_iluminacao_extra_dep"
            checked={formData.requer_iluminacao_extra}
            onCheckedChange={(checked) => onChange('requer_iluminacao_extra', checked)}
          />
          <Label htmlFor="requer_iluminacao_extra_dep" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
            {t('formVoo.iluminacaoExtra')}
          </Label>
        </div>
      </div>

      {/* --- Seccao Troca de Registo (apenas DEP) --- */}
      {linkedArrVooId && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="registo_alterado"
              checked={formData.registo_alterado}
              onCheckedChange={(checked) => {
                onChange('registo_alterado', checked);
                if (!checked) {
                  const arrVoo = voos.find(v => v.id === linkedArrVooId);
                  if (arrVoo) {
                    onChange('registo_aeronave', arrVoo.registo_aeronave);
                  }
                  onChange('registo_dep', '');
                }
              }}
            />
            <Label htmlFor="registo_alterado" className="text-sm font-semibold leading-none cursor-pointer text-orange-700">
              {t('formVoo.houveAlteracaoRegisto')}
            </Label>
          </div>
          {formData.registo_alterado && (
            <div className="pl-6 space-y-3">
              <Alert className="bg-orange-50 border-orange-200">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 text-sm">
                  {t('formVoo.registoOriginalARR')} <strong>{voos.find(v => v.id === linkedArrVooId)?.registo_aeronave}</strong>.
                  {t('formVoo.indiquaRegistoDEP')}
                </AlertDescription>
              </Alert>
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 max-w-md space-y-1">
                <Label className="text-xs">{t('formVoo.registoAeronaveDEP')} *</Label>
                <AsyncCombobox
                  id="registo_dep"
                  value={formData.registo_dep}
                  onValueChange={(value) => {
                    onChange('registo_dep', value);
                    onChange('registo_aeronave', value);
                  }}
                  placeholder={t('formVoo.pesquisarRegisto')}
                  searchPlaceholder={t('formVoo.procurarRegisto')}
                  noResultsMessage={t('formVoo.nenhumRegisto')}
                  onSearch={(term) => searchRegistos(term, true)}
                  getInitialOption={getRegistoInicial}
                  minSearchLength={1}
                  className={errors.registo_dep ? 'border-red-500' : ''}
                />
                {errors.registo_dep && <p className="text-red-500 text-sm">{errors.registo_dep}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Seccao Combustivel (apenas DEP) --- */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="combustivel_utilizado"
            checked={formData.combustivel_utilizado}
            onCheckedChange={(checked) => onChange('combustivel_utilizado', checked)}
          />
          <Label htmlFor="combustivel_utilizado" className="text-sm font-semibold leading-none cursor-pointer text-amber-700">
            {t('formVoo.abastecimentoCombustivel')}
          </Label>
        </div>
        {formData.combustivel_utilizado && (
          <div className="grid grid-cols-2 gap-3 pl-6 bg-amber-50 p-3 rounded-lg border border-amber-200 max-w-md">
            <div className="space-y-1">
              <Label className="text-xs">{t('formVoo.combustivelTipo')}</Label>
              <select
                value={formData.combustivel_tipo}
                onChange={(e) => onChange('combustivel_tipo', e.target.value)}
                className="w-full h-9 px-2 py-1 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 border-slate-200"
              >
                <option value="JET-A1">JET-A1</option>
                <option value="AVGAS">AVGAS</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('formVoo.combustivelLitros')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.combustivel_litros || ''}
                onChange={(e) => onChange('combustivel_litros', parseFloat(e.target.value) || 0)}
                className="h-9"
                placeholder="0"
              />
            </div>
          </div>
        )}
      </div>

      {/* --- Linha 4: Destino e Outros --- */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aeroporto_origem_destino">
            {formData.tipo_movimento === 'ARR' ? `${t('formVoo.origem')} *` : `${t('formVoo.destino')} *`}
          </Label>
          <AsyncCombobox
            id="aeroporto_origem_destino"
            value={formData.aeroporto_origem_destino}
            onValueChange={(value) => onChange('aeroporto_origem_destino', value)}
            placeholder={t('formVoo.pesquisarAeroporto')}
            searchPlaceholder={t('formVoo.digitarNomeCodigo')}
            noResultsMessage={t('formVoo.nenhumAeroportoEncontrado')}
            onSearch={searchAeroportos}
            getInitialOption={getAeroportoInicial}
            minSearchLength={0}
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
        <div className="space-y-2">
          <Label htmlFor="observacoes">{t('formVoo.observacoes')}</Label>
          <Input
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => onChange('observacoes', e.target.value)}
            placeholder={t('formVoo.observacoesPlaceholderDEP')} />
        </div>
      </div>
    </>
  );
}
