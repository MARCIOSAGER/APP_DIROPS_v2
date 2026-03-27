import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/lib/i18n';

export default function PassengersSection({ formData, onChange }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium pt-4 border-t">{t('formVoo.informacoesPassageiros')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="passageiros_local">{t('formVoo.passageirosLocais')}</Label>
          <Input
            id="passageiros_local"
            type="number"
            min="0"
            value={formData.passageiros_local}
            onChange={(e) => onChange('passageiros_local', parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passageiros_transito_transbordo">{t('formVoo.transitoTransbordo')}</Label>
          <Input
            id="passageiros_transito_transbordo"
            type="number"
            min="0"
            value={formData.passageiros_transito_transbordo}
            onChange={(e) => onChange('passageiros_transito_transbordo', parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passageiros_transito_direto">{t('formVoo.transitoDireto')}</Label>
          <Input
            id="passageiros_transito_direto"
            type="number"
            min="0"
            value={formData.passageiros_transito_direto}
            onChange={(e) => onChange('passageiros_transito_direto', parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passageiros_total">{t('formVoo.totalCalculado')}</Label>
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
