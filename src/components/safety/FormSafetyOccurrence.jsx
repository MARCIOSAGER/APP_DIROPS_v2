import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Combobox from '@/components/ui/combobox';
import Select from '@/components/ui/select';
import { ShieldAlert, Upload, X } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { UploadFile } from '@/integrations/Core';
import { useI18n } from '@/components/lib/i18n';

export default function FormSafetyOccurrence({ isOpen, onClose, onSubmit, aeroportos, occurrenceInitial = null }) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    tipo_ocorrencia: '',
    aeroporto: '',
    data_ocorrencia: new Date().toISOString().split('T')[0],
    hora_ocorrencia: '',
    local_especifico: '',
    descricao: '',
    acoes_tomadas: '',
    evidencias_fotograficas: [],
    gravidade: 'media',
    status: 'aberta'
  });

  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (occurrenceInitial) {
      setFormData({
        ...occurrenceInitial,
        evidencias_fotograficas: occurrenceInitial.evidencias_fotograficas || []
      });
    } else {
      setFormData({
        tipo_ocorrencia: '',
        aeroporto: '',
        data_ocorrencia: new Date().toISOString().split('T')[0],
        hora_ocorrencia: '',
        local_especifico: '',
        descricao: '',
        acoes_tomadas: '',
        evidencias_fotograficas: [],
        gravidade: 'media',
        status: 'aberta'
      });
    }
  }, [occurrenceInitial, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.tipo_ocorrencia) newErrors.tipo_ocorrencia = t('safety.form.tipoObrigatorio');
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    guardedSubmit(async () => {
      await onSubmit(formData);
    });
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData((prev) => ({
        ...prev,
        evidencias_fotograficas: [...prev.evidencias_fotograficas, file_url]
      }));
    } catch (error) {
      console.error('Erro no upload:', error);
      alert(t('safety.form.erroUpload'));
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      evidencias_fotograficas: prev.evidencias_fotograficas.filter((_, index) => index !== indexToRemove)
    }));
  };

  const tipoOcorrenciaOptions = [
  { value: "FOD", label: t('safety.form.tipoFOD') },
  { value: "Incursao_de_Pista", label: t('safety.form.tipoIncursaoPista') },
  { value: "Intrusao", label: t('safety.form.tipoIntrusao') },
  { value: "Avistamento", label: t('safety.form.tipoAvistamento') },
  { value: "bird_strike", label: t('safety.form.tipoBirdStrike') },
  { value: "incidente", label: t('safety.form.tipoIncidente') },
  { value: "Acidente_Aeronautico", label: t('safety.form.tipoAcidenteAeronautico') },
  { value: "desvio", label: t('safety.form.tipoDesvio') },
  { value: "outro", label: t('safety.form.tipoOutro') }];


  const aeroportoOptions = aeroportos.map((aeroporto) => ({
    value: aeroporto.codigo_icao,
    label: `${aeroporto.nome} (${aeroporto.codigo_icao})`
  }));

  const gravidadeOptions = [
  { value: "baixa", label: t('safety.form.gravidadeBaixa') },
  { value: "media", label: t('safety.form.gravidadeMedia') },
  { value: "alta", label: t('safety.form.gravidadeAlta') },
  { value: "critica", label: t('safety.form.gravidadeCritica') }];


  const statusOptions = [
  { value: "aberta", label: t('safety.form.statusAberta') },
  { value: "em_investigacao", label: t('safety.form.statusEmInvestigacao') },
  { value: "fechada", label: t('safety.form.statusFechada') }];


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            {occurrenceInitial ? t('safety.form.editTitle') : t('safety.form.newTitle')} {t('safety.form.occurrenceTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_ocorrencia">{t('safety.form.tipoESO')}</Label>
              <Select
                id="tipo_ocorrencia"
                options={tipoOcorrenciaOptions}
                value={formData.tipo_ocorrencia}
                onValueChange={(value) => handleChange('tipo_ocorrencia', value)}
                placeholder={t('safety.form.selecionarTipo')}
              />
              {errors.tipo_ocorrencia && <p className="text-sm text-red-500">{errors.tipo_ocorrencia}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aeroporto">{t('safety.form.aeroporto')}</Label>
              <Combobox
                id="aeroporto"
                options={[{ value: '', label: t('safety.form.selecionarAeroporto') }, ...aeroportoOptions]}
                value={formData.aeroporto}
                onValueChange={(value) => handleChange('aeroporto', value)}
                placeholder={t('safety.form.pesquisarAeroporto')}
                searchPlaceholder={t('safety.form.digitarIcaoNome')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('safety.form.dataOcorrencia')}</Label>
              <Input
                type="date"
                value={formData.data_ocorrencia}
                onChange={(e) => handleChange('data_ocorrencia', e.target.value)}
                required />

            </div>

            <div className="space-y-2">
              <Label>{t('safety.form.horaOcorrencia')}</Label>
              <Input
                type="time"
                value={formData.hora_ocorrencia}
                onChange={(e) => handleChange('hora_ocorrencia', e.target.value)} />

            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('safety.form.localEspecifico')}</Label>
            <Input
              value={formData.local_especifico}
              onChange={(e) => handleChange('local_especifico', e.target.value)}
              placeholder={t('safety.form.localPlaceholder')}
              required />

          </div>

          <div className="space-y-2">
            <Label>{t('safety.form.descricao')}</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder={t('safety.form.descricaoPlaceholder')}
              rows={4}
              required />

          </div>

          <div className="space-y-2">
            <Label>{t('safety.form.acoesTomadas')}</Label>
            <Textarea
              value={formData.acoes_tomadas}
              onChange={(e) => handleChange('acoes_tomadas', e.target.value)}
              placeholder={t('safety.form.acoesPlaceholder')}
              rows={3} />

          </div>

          {/* Campo de Evidências Fotográficas */}
          <div className="space-y-2">
            <Label>{t('safety.form.evidencias')}</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-2">
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      {isUploading ? t('safety.form.carregando') : t('safety.form.cliqueAdicionar')}
                    </span>
                    <input
                      id="photo-upload"
                      name="photo-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleFileUpload}
                      disabled={isUploading} />

                  </label>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF</p>
              </div>
            </div>

            {/* Mostrar fotos carregadas */}
            {formData.evidencias_fotograficas.length > 0 &&
            <div className="mt-4">
                <Label className="text-sm font-medium">{t('safety.form.fotosAdicionadas')}</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  {formData.evidencias_fotograficas.map((foto, index) =>
                <div key={index} className="relative">
                      <img
                    src={foto}
                    alt={`${t('safety.form.evidencias')} ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200" />

                      <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600">

                        <X className="w-4 h-4" />
                      </button>
                    </div>
                )}
                </div>
              </div>
            }
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gravidade">{t('safety.form.gravidade')}</Label>
              <Select
                id="gravidade"
                options={gravidadeOptions}
                value={formData.gravidade}
                onValueChange={(value) => handleChange('gravidade', value)}
                placeholder={t('safety.form.gravidade')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t('safety.form.status')}</Label>
              <Select
                id="status"
                options={statusOptions}
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
                placeholder={t('safety.form.status')}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t('safety.form.cancelar')}</Button>
            </DialogClose>
            <Button type="submit" className="bg-red-600 text-slate-50 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-red-700" disabled={isUploading || isSubmitting}>
              {isSubmitting ? t('safety.form.guardando') : isUploading ? t('safety.form.carregandoFoto') : occurrenceInitial ? t('safety.form.atualizar') : t('safety.form.registar')} {t('safety.form.ocorrencia')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}
