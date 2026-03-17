
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Loader2, UploadCloud, X, FileText } from 'lucide-react';

import { SolicitacaoServico } from '@/entities/SolicitacaoServico';
import { UploadFile } from '@/integrations/Core';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

export default function FormSolicitacaoServico({ isOpen, onClose, aeroportos, currentUser, onSuccess }) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    aeroporto_id: '',
    localizacao: '',
    prioridade_sugerida: 'media',
  });
  const [fotos, setFotos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        titulo: '',
        descricao: '',
        aeroporto_id: aeroportos?.length === 1 ? aeroportos[0].id : '',
        localizacao: '',
        prioridade_sugerida: 'media',
      });
      setFotos([]);
      setError('');
    }
  }, [isOpen, aeroportos]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await UploadFile({ file });
        setFotos(prev => [...prev, file_url]);
      }
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError(t('ssForm.erroUpload'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFoto = (index) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
  };

  const generateNumeroSS = async () => {
    const year = new Date().getFullYear();
    try {
      const empId = currentUser?.empresa_id;
      const existing = empId
        ? await SolicitacaoServico.filter({ empresa_id: empId })
        : await SolicitacaoServico.list();
      const thisYearSS = existing.filter(ss => ss.numero_ss?.startsWith(`SS-${year}`));
      const maxNum = thisYearSS.reduce((max, ss) => {
        const num = parseInt(ss.numero_ss?.split('-')[2]) || 0;
        return num > max ? num : max;
      }, 0);
      return `SS-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    } catch {
      return `SS-${year}-0001`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.titulo.trim()) {
      setError(t('ssForm.erroTitulo'));
      return;
    }
    if (!formData.descricao.trim()) {
      setError(t('ssForm.erroDescricao'));
      return;
    }

    guardedSubmit(async () => {
      setIsLoading(true);
      try {
        const numero_ss = await generateNumeroSS();

        const ssData = {
          numero_ss,
          titulo: formData.titulo.trim(),
          descricao: formData.descricao.trim(),
          aeroporto_id: formData.aeroporto_id || null,
          localizacao: formData.localizacao.trim() || null,
          prioridade_sugerida: formData.prioridade_sugerida,
          fotos: fotos.length > 0 ? fotos : null,
          status: 'aberta',
          origem: 'manual',
          empresa_id: currentUser.empresa_id,
          solicitante_id: currentUser.id,
          solicitante_nome: currentUser.full_name,
          solicitante_email: currentUser.email,
        };
        await SolicitacaoServico.create(ssData);

        if (onSuccess) onSuccess(ssData);
        onClose();
      } catch (err) {
        console.error('Erro ao criar solicitação:', err);
        setError(t('ssForm.erroCriar'));
      } finally {
        setIsLoading(false);
      }
    });
  };

  const prioridadeOptions = [
    { value: 'baixa', label: t('manutencao.baixa') },
    { value: 'media', label: t('manutencao.media') },
    { value: 'alta', label: t('manutencao.alta') },
    { value: 'urgente', label: t('manutencao.urgente') },
  ];

  const aeroportoOptions = (aeroportos || []).map(a => ({
    value: a.id,
    label: a.nome || a.icao_code || a.id,
  }));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {t('ssForm.titulo')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="titulo">{t('ssForm.tituloLabel')}</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => handleChange('titulo', e.target.value)}
              placeholder={t('ssForm.tituloPlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">{t('ssForm.descricao')}</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder={t('ssForm.descricaoPlaceholder')}
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aeroporto_id">{t('ssForm.aeroporto')}</Label>
            <Select
              value={formData.aeroporto_id}
              onValueChange={(value) => handleChange('aeroporto_id', value)}
              options={aeroportoOptions}
              placeholder={t('ssForm.selecionarAeroporto')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="localizacao">{t('ssForm.localizacao')}</Label>
            <Input
              id="localizacao"
              value={formData.localizacao}
              onChange={(e) => handleChange('localizacao', e.target.value)}
              placeholder={t('ssForm.localizacaoPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prioridade_sugerida">{t('ssForm.prioridadeSugerida')}</Label>
            <Select
              value={formData.prioridade_sugerida}
              onValueChange={(value) => handleChange('prioridade_sugerida', value)}
              options={prioridadeOptions}
              placeholder={t('ssForm.selecionarPrioridade')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('ssForm.fotosAnexos')}</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-sm text-slate-600">
                <UploadCloud className="w-4 h-4" />
                {isUploading ? t('ssForm.aEnviar') : t('ssForm.selecionarFicheiros')}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
            {fotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {fotos.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Foto ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFoto(index)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                {t('ssForm.cancelar')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading || isUploading || isSubmitting}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('ssForm.aCriar')}
                </>
              ) : (
                t('ssForm.criarSolicitacao')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
