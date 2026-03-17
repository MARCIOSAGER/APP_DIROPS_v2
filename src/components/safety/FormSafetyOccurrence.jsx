import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Combobox from '@/components/ui/combobox';
import { ShieldAlert, Upload, X } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { UploadFile } from '@/integrations/Core';

export default function FormSafetyOccurrence({ isOpen, onClose, onSubmit, aeroportos, occurrenceInitial = null }) {
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
      alert('Erro ao fazer upload da imagem. Tente novamente.');
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
  { value: "FOD", label: "FOD (Foreign Object Damage)" },
  { value: "Incursao_de_Pista", label: "Incursão de pista" },
  { value: "Intrusao", label: "Intrusão em Perímerto" },
  { value: "Avistamento", label: "Avistamento" },
  { value: "bird_strike", label: "Bird Strike" },
  { value: "incidente", label: "Incidente" },
  { value: "Acidente_Aeronautico", label: "Acidente Aeronáutico" },
  { value: "desvio", label: "Desvio de Procedimento" },
  { value: "outro", label: "Outro" }];


  const aeroportoOptions = aeroportos.map((aeroporto) => ({
    value: aeroporto.codigo_icao,
    label: `${aeroporto.nome} (${aeroporto.codigo_icao})`
  }));

  const gravidadeOptions = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" }];


  const statusOptions = [
  { value: "aberta", label: "Aberta" },
  { value: "em_investigacao", label: "Em Investigação" },
  { value: "fechada", label: "Fechada" }];


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            {occurrenceInitial ? 'Editar' : 'Nova'} Ocorrência de Segurança
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_ocorrencia">Tipo de ESO *</Label>
              <select
                id="tipo_ocorrencia"
                value={formData.tipo_ocorrencia}
                onChange={(e) => handleChange('tipo_ocorrencia', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
                required>

                <option value="" disabled>Selecionar tipo</option>
                {tipoOcorrenciaOptions.map((option) =>
                <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aeroporto">Aeroporto *</Label>
              <Combobox
                id="aeroporto"
                options={[{ value: '', label: 'Selecionar aeroporto' }, ...aeroportoOptions]}
                value={formData.aeroporto}
                onValueChange={(value) => handleChange('aeroporto', value)}
                placeholder="Pesquisar aeroporto..."
                searchPlaceholder="Digite o ICAO ou nome..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data da Ocorrência *</Label>
              <Input
                type="date"
                value={formData.data_ocorrencia}
                onChange={(e) => handleChange('data_ocorrencia', e.target.value)}
                required />

            </div>

            <div className="space-y-2">
              <Label>Hora da Ocorrência</Label>
              <Input
                type="time"
                value={formData.hora_ocorrencia}
                onChange={(e) => handleChange('hora_ocorrencia', e.target.value)} />

            </div>
          </div>

          <div className="space-y-2">
            <Label>Local Específico *</Label>
            <Input
              value={formData.local_especifico}
              onChange={(e) => handleChange('local_especifico', e.target.value)}
              placeholder="Ex: Pista 05, Taxiway A, Terminal..."
              required />

          </div>

          <div className="space-y-2">
            <Label>Descrição da Ocorrência *</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Descrição detalhada da ocorrência..."
              rows={4}
              required />

          </div>

          <div className="space-y-2">
            <Label>Ações Tomadas</Label>
            <Textarea
              value={formData.acoes_tomadas}
              onChange={(e) => handleChange('acoes_tomadas', e.target.value)}
              placeholder="Ações imediatas tomadas..."
              rows={3} />

          </div>

          {/* Campo de Evidências Fotográficas */}
          <div className="space-y-2">
            <Label>Evidências Fotográficas</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-2">
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      {isUploading ? 'A carregar...' : 'Clique para adicionar fotos'}
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
                <p className="text-xs text-gray-500">PNG, JPG, GIF até 10MB</p>
              </div>
            </div>

            {/* Mostrar fotos carregadas */}
            {formData.evidencias_fotograficas.length > 0 &&
            <div className="mt-4">
                <Label className="text-sm font-medium">Fotos Adicionadas:</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  {formData.evidencias_fotograficas.map((foto, index) =>
                <div key={index} className="relative">
                      <img
                    src={foto}
                    alt={`Evidência ${index + 1}`}
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
              <Label htmlFor="gravidade">Gravidade *</Label>
              <select
                id="gravidade"
                value={formData.gravidade}
                onChange={(e) => handleChange('gravidade', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200"
                required>

                {gravidadeOptions.map((option) =>
                <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 border-slate-200">

                {statusOptions.map((option) =>
                <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </select>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" className="bg-red-600 text-slate-50 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-red-700" disabled={isUploading || isSubmitting}>
              {isSubmitting ? 'A guardar...' : isUploading ? 'A carregar...' : occurrenceInitial ? 'Atualizar' : 'Registar'} Ocorrência
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}