
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Plane, Send, Edit } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

const RWYCC_CONDITIONS = {
  "6": "DRY",
  "5": "WET",
  "3": "STANDING WATER",
  "2": "STANDING WATER"
};

export default function FormGRF({ isOpen, onClose, onSubmit, aeroportos, registoInicial }) {
  const { t } = useI18n();
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    aeroporto: '',
    mes: new Date().getMonth() + 1,
    dia: new Date().getDate(),
    hora_utc: '',
    pista: '',
    rwycc1: '6', perc1: 'NR', lamina1: 'NR', condicao1: 'DRY',
    rwycc2: '6', perc2: 'NR', lamina2: 'NR', condicao2: 'DRY',
    rwycc3: '6', perc3: 'NR', lamina3: 'NR', condicao3: 'DRY',
    observacoes: ''
  });

  // Função para obter o menor número da soleira
  const getMenorSoleira = (soleiras) => {
    if (!soleiras) return '';

    const numeros = soleiras.split(';').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    return numeros.length > 0 ? Math.min(...numeros).toString().padStart(2, '0') : '';
  };

  // Função para obter as opções de pista baseadas nas soleiras do aeroporto
  const getPistaOptions = () => {
    if (!formData.aeroporto) return [];

    const aeroportoSelecionado = aeroportos.find(a => a.codigo_icao === formData.aeroporto);
    if (!aeroportoSelecionado || !aeroportoSelecionado.soleiras) return [];

    return aeroportoSelecionado.soleiras.split(';').map(soleira => ({
      value: soleira.trim().padStart(2, '0'),
      label: soleira.trim().padStart(2, '0')
    }));
  };

  useEffect(() => {
    if (isOpen) {
      if (registoInicial) {
        // Modo edição - carregar dados existentes
        const initialPista = registoInicial.pista ? String(registoInicial.pista).padStart(2, '0') : '';
        setFormData({
          aeroporto: registoInicial.aeroporto || '',
          mes: registoInicial.mes || new Date().getMonth() + 1,
          dia: registoInicial.dia || new Date().getDate(),
          hora_utc: registoInicial.hora_utc || '',
          pista: initialPista,
          rwycc1: registoInicial.rwycc1 || '6',
          perc1: registoInicial.perc1 || 'NR',
          lamina1: registoInicial.lamina1 || 'NR',
          condicao1: registoInicial.condicao1 || 'DRY',
          rwycc2: registoInicial.rwycc2 || '6',
          perc2: registoInicial.perc2 || 'NR',
          lamina2: registoInicial.lamina2 || 'NR',
          condicao2: registoInicial.condicao2 || 'DRY',
          rwycc3: registoInicial.rwycc3 || '6',
          perc3: registoInicial.perc3 || 'NR',
          lamina3: registoInicial.lamina3 || 'NR',
          condicao3: registoInicial.condicao3 || 'DRY',
          observacoes: registoInicial.observacoes || ''
        });
      } else {
        // Modo criação - valores padrão
        const defaultAeroporto = aeroportos.length === 1 ? aeroportos[0].codigo_icao : '';
        const defaultPista = defaultAeroporto ? getMenorSoleira(aeroportos[0].soleiras) : '';

        setFormData({
          aeroporto: defaultAeroporto,
          mes: new Date().getMonth() + 1,
          dia: new Date().getDate(),
          hora_utc: '',
          pista: defaultPista,
          rwycc1: '6', perc1: 'NR', lamina1: 'NR', condicao1: 'DRY',
          rwycc2: '6', perc2: 'NR', lamina2: 'NR', condicao2: 'DRY',
          rwycc3: '6', perc3: 'NR', lamina3: 'NR', condicao3: 'DRY',
          observacoes: ''
        });
      }
    }
  }, [isOpen, registoInicial, aeroportos]);

  // Generic handler for input changes
  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Quando muda o aeroporto, definir automaticamente a pista com menor número
  const handleAeroportoChange = (aeroportoIcao) => {
    const aeroportoSelecionado = aeroportos.find(a => a.codigo_icao === aeroportoIcao);
    const menorSoleira = aeroportoSelecionado ? getMenorSoleira(aeroportoSelecionado.soleiras) : '';

    setFormData(prev => ({
      ...prev,
      aeroporto: aeroportoIcao,
      pista: menorSoleira
    }));
  };

  const handleRWYCCChange = (troco, value) => {
    const condicao = RWYCC_CONDITIONS[value] || 'DRY';
    setFormData(prev => ({
      ...prev,
      [`rwycc${troco}`]: value,
      [`condicao${troco}`]: condicao
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      await onSubmit(formData);
    });
  };

  const isEditing = !!registoInicial;

  const aeroportoOptions = aeroportos.map(a => ({
    value: a.codigo_icao,
    label: `${a.nome} (${a.codigo_icao})`
  }));

  const pistaOptions = getPistaOptions();

  const mesOptions = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: (i + 1).toString() }));
  const diaOptions = Array.from({ length: 31 }, (_, i) => ({ value: (i + 1).toString(), label: (i + 1).toString() }));
  const rwyccOptions = [{ value: "6", label: "6" }, { value: "5", label: "5" }, { value: "3", label: "3" }, { value: "2", label: "2" }];
  const percOptions = [{ value: "NR", label: "NR" }, { value: "25", label: "25" }, { value: "50", label: "50" }, { value: "75", label: "75" }, { value: "100", label: "100" }];
  const laminaOptions = [{ value: "NR", label: "NR" }, { value: "02", label: "02" }, { value: "03", label: "03" }, { value: "04", label: "04" }, { value: "05", label: "05" }, { value: "06", label: "06" }];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit className="w-5 h-5 text-blue-600" /> : <Plane className="w-5 h-5 text-blue-600" />}
            {isEditing ? t('page.grf.editRecord') : t('page.grf.newRecord')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aeroporto">Aeroporto *</Label>
              <Combobox
                id="aeroporto"
                options={aeroportoOptions}
                value={formData.aeroporto}
                onValueChange={handleAeroportoChange}
                placeholder="Pesquisar aeroporto..."
                searchPlaceholder="Procurar aeroporto..."
                noResultsMessage="Nenhum aeroporto encontrado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pista">Pista *</Label>
              <Select
                id="pista"
                options={pistaOptions}
                value={formData.pista}
                onValueChange={(value) => handleChange('pista', value)}
                placeholder={pistaOptions.length > 0 ? "Selecione a pista..." : "Selecione primeiro um aeroporto"}
                disabled={pistaOptions.length === 0}
              />
              <p className="text-xs text-slate-500 mt-1">
                Pista selecionada automaticamente com base no menor número das soleiras
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mês *</Label>
              <Select
                options={mesOptions}
                value={formData.mes?.toString()}
                onValueChange={(v) => handleChange('mes', parseInt(v))}
              />
            </div>

            <div className="space-y-2">
              <Label>Dia *</Label>
              <Select
                options={diaOptions}
                value={formData.dia?.toString()}
                onValueChange={(v) => handleChange('dia', parseInt(v))}
              />
            </div>

            <div className="space-y-2">
              <Label>Hora UTC *</Label>
              <Input
                type="time"
                value={formData.hora_utc}
                onChange={(e) => handleChange('hora_utc', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Troços 1, 2, 3 */}
          {[1, 2, 3].map(troco => (
            <div key={troco} className="p-4 bg-slate-50 rounded-lg border">
              <h4 className="font-semibold mb-3">Troço {troco}</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>RWYCC</Label>
                  <Select
                    options={rwyccOptions}
                    value={formData[`rwycc${troco}`]}
                    onValueChange={(v) => handleRWYCCChange(troco, v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>% Troço</Label>
                  <Select
                    options={percOptions}
                    value={formData[`perc${troco}`]}
                    onValueChange={(v) => handleChange(`perc${troco}`, v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lâmina</Label>
                  <Select
                    options={laminaOptions}
                    value={formData[`lamina${troco}`]}
                    onValueChange={(v) => handleChange(`lamina${troco}`, v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Condição</Label>
                  <Input value={formData[`condicao${troco}`]} disabled className="bg-gray-100" />
                </div>
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => handleChange('observacoes', e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t('btn.cancel')}</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-500 hover:bg-blue-600 text-white">
              {isSubmitting ? t('btn.loading') : (
                <>
                  {isEditing ? <Edit className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {isEditing ? t('btn.edit') : t('btn.submit')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
