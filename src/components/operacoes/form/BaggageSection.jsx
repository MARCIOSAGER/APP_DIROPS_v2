import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/lib/i18n';

export default function BaggageSection({ formData, onChange }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium pt-4 border-t">{t('formVoo.informacoesBagagem')}</h3>
      {formData.tipo_movimento === 'ARR' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bagagem_local">{t('formVoo.bagagemLocal')}</Label>
            <Input
              id="bagagem_local"
              type="number"
              min="0"
              value={formData.bagagem_local}
              onChange={(e) => onChange('bagagem_local', parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bagagem_transito_transbordo">{t('formVoo.transitoTransbordo')}</Label>
            <Input
              id="bagagem_transito_transbordo"
              type="number"
              min="0"
              value={formData.bagagem_transito_transbordo}
              onChange={(e) => onChange('bagagem_transito_transbordo', parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bagagem_transito_direto">{t('formVoo.transitoDireto')}</Label>
            <Input
              id="bagagem_transito_direto"
              type="number"
              min="0"
              value={formData.bagagem_transito_direto}
              onChange={(e) => onChange('bagagem_transito_direto', parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bagagem_total">{t('formVoo.totalCalculado')}</Label>
            <Input
              id="bagagem_total"
              type="number"
              value={formData.bagagem_total}
              disabled
              className="bg-gray-100" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bagagem_total">{t('formVoo.totalBagagens')}</Label>
            <Input
              id="bagagem_total"
              type="number"
              min="0"
              value={formData.bagagem_total}
              onChange={(e) => onChange('bagagem_total', parseInt(e.target.value) || 0)} />
          </div>
        </div>
      )}
    </div>
  );
}
