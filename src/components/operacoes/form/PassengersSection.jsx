import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/lib/i18n';

export default function PassengersSection({ formData, onChange }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium pt-4 border-t">{t('formVoo.informacoesPassageiros')}</h3>
      {/* Labels com altura mínima uniforme + alinhados ao fundo: mesmo que "Trânsito /
          Transbordo" quebre em 2 linhas, todos os inputs ficam na mesma linha. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="passageiros_local" className="flex items-end min-h-[2.5rem] leading-tight">{t('formVoo.passageirosLocais')}</Label>
          <Input
            id="passageiros_local"
            type="number"
            min="0"
            value={formData.passageiros_local}
            onChange={(e) => onChange('passageiros_local', parseInt(e.target.value) || 0)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="passageiros_transito_transbordo" className="flex items-end min-h-[2.5rem] leading-tight">{t('formVoo.transitoTransbordo')}</Label>
          <Input
            id="passageiros_transito_transbordo"
            type="number"
            min="0"
            value={formData.passageiros_transito_transbordo}
            onChange={(e) => onChange('passageiros_transito_transbordo', parseInt(e.target.value) || 0)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="passageiros_transito_direto" className="flex items-end min-h-[2.5rem] leading-tight">{t('formVoo.transitoDireto')}</Label>
          <Input
            id="passageiros_transito_direto"
            type="number"
            min="0"
            value={formData.passageiros_transito_direto}
            onChange={(e) => onChange('passageiros_transito_direto', parseInt(e.target.value) || 0)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="passageiros_infant" className="flex items-end gap-1 min-h-[2.5rem] leading-tight">
            Infant <span className="text-xs text-slate-400 font-normal">(isento)</span>
          </Label>
          <Input
            id="passageiros_infant"
            type="number"
            min="0"
            value={formData.passageiros_infant ?? 0}
            onChange={(e) => onChange('passageiros_infant', parseInt(e.target.value) || 0)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="passageiros_total" className="flex items-end min-h-[2.5rem] leading-tight">{t('formVoo.totalCalculado')}</Label>
          <Input
            id="passageiros_total"
            type="number"
            value={formData.passageiros_total}
            disabled
            className="bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
