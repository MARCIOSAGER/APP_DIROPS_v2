
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select'; // Corrected import: changed from named export to default export
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, AlertCircle } from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { Reclamacao } from '@/entities/Reclamacao';
import { HistoricoReclamacao } from '@/entities/HistoricoReclamacao';
import { UploadFile } from '@/integrations/Core';

const generateProtocolo = () => `REC-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;

export default function FormReclamacao({ isOpen, onClose, reclamacao, aeroportos, onSubmit, currentUser = null }) {
  const [formData, setFormData] = useState({
    titulo: reclamacao?.titulo || '',
    descricao: reclamacao?.descricao || '',
    canal_entrada: reclamacao?.canal_entrada || '',
    reclamante_nome: reclamacao?.reclamante_nome || '',
    reclamante_contacto: reclamacao?.reclamante_contacto || '',
    aeroporto_id: reclamacao?.aeroporto_id || '',
    categoria_reclamacao: reclamacao?.categoria_reclamacao || '',
    prioridade: reclamacao?.prioridade || 'media',
    anexos: reclamacao?.anexos || [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useI18n();
  const { guardedSubmit } = useSubmitGuard();
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Filtrar aeroportos disponíveis (no longer filtered by user access)
  const aeroportosDisponiveis = aeroportos;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const uploadPromises = files.map(file => UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      setFormData(prev => ({ ...prev, anexos: [...prev.anexos, ...urls] }));
    } catch (error) {
      setMessage(t('recl_form.erro_carregar'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
    setIsLoading(true);
    setMessage('');

    try {
      let reclamacaoResult;
      if (reclamacao) {
        // Edit logic
        await Reclamacao.update(reclamacao.id, formData);
        reclamacaoResult = { ...reclamacao, ...formData };
      } else {
        // Create logic
        const protocolo_numero = generateProtocolo();
        const data_recebimento = new Date().toISOString();
        reclamacaoResult = await Reclamacao.create({
          ...formData,
          empresa_id: currentUser?.empresa_id,
          protocolo_numero,
          data_recebimento,
          status: 'recebida',
        });
        await HistoricoReclamacao.create({
          reclamacao_id: reclamacaoResult.id,
          data_evento: data_recebimento,
          tipo_evento: 'criacao',
          detalhes: `Reclamação criada com protocolo ${protocolo_numero} através do canal ${formData.canal_entrada}.`,
          usuario_email: 'sistema@sga.co.ao', // Hardcoded as user system dependency is removed
        });
      }
      onSubmit(reclamacaoResult);
    } catch (error) {
      setMessage(t('recl_form.erro_guardar'));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
    });
  };

  const aeroportoOptions = aeroportosDisponiveis.map(a => ({
    value: a.codigo_icao,
    label: a.nome
  }));

  const canalOptions = [
    { value: 'telefone', label: 'Telefone' },
    { value: 'email', label: 'E-mail' },
    { value: 'formulario_web', label: 'Formulário Web' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'presencial', label: 'Presencial' },
    { value: 'outros', label: 'Outros' }
  ];

  const categoriaOptions = [
    { value: 'infraestrutura', label: 'Infraestrutura' },
    { value: 'servico_aeroportuario', label: 'Serviço Aeroportuário' },
    { value: 'servico_cia_aerea', label: 'Serviço Cia Aérea' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'seguranca', label: 'Segurança' },
    { value: 'outros', label: 'Outros' }
  ];

  const prioridadeOptions = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            {reclamacao ? t('recl_form.editar') : t('recl_form.nova')}
          </DialogTitle>
        </DialogHeader>
        {message && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">{t('recl_form.titulo')}</Label>
                <Input id="titulo" value={formData.titulo} onChange={e => handleInputChange('titulo', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aeroporto_id">{t('recl_form.aeroporto')}</Label>
                <Select
                  options={aeroportoOptions}
                  value={formData.aeroporto_id}
                  onValueChange={value => handleInputChange('aeroporto_id', value)}
                  placeholder={t('recl_form.selecione_aeroporto')}
                />
                {aeroportosDisponiveis.length === 0 && (
                  <p className="text-sm text-red-600">{t('recl_form.nenhum_aeroporto')}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">{t('recl_form.descricao')}</Label>
              <Textarea id="descricao" value={formData.descricao} onChange={e => handleInputChange('descricao', e.target.value)} required rows={4} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="canal_entrada">{t('recl_form.canal')}</Label>
                <Select
                  options={canalOptions}
                  value={formData.canal_entrada}
                  onValueChange={value => handleInputChange('canal_entrada', value)}
                  placeholder={t('recl_form.selecione_canal')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria_reclamacao">{t('recl_form.categoria')}</Label>
                <Select
                  options={categoriaOptions}
                  value={formData.categoria_reclamacao}
                  onValueChange={value => handleInputChange('categoria_reclamacao', value)}
                  placeholder={t('recl_form.selecione_categoria')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prioridade">{t('recl_form.prioridade')}</Label>
                <Select 
                  options={prioridadeOptions}
                  value={formData.prioridade} 
                  onValueChange={value => handleInputChange('prioridade', value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="reclamante_nome">{t('recl_form.nome_reclamante')}</Label>
                    <Input id="reclamante_nome" value={formData.reclamante_nome} onChange={e => handleInputChange('reclamante_nome', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reclamante_contacto">{t('recl_form.contacto_reclamante')}</Label>
                    <Input id="reclamante_contacto" value={formData.reclamante_contacto} onChange={e => handleInputChange('reclamante_contacto', e.target.value)} placeholder={t('recl_form.contacto_placeholder')} />
                </div>
            </div>
            <div className="space-y-2">
                <Label>{t('recl_form.anexos')}</Label>
                <div className="border p-4 rounded-md space-y-2">
                    <Input id="file-upload" type="file" multiple onChange={handleFileUpload} className="mb-2" />
                    {isUploading && <p className="text-sm text-slate-500">{t('recl_form.carregando_ficheiros')}</p>}
                    <div className="flex flex-wrap gap-2">
                        {formData.anexos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">{t('recl_form.ficheiro')} {i+1}</a>
                        ))}
                    </div>
                </div>
            </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? t('recl_form.guardando') : t('recl_form.guardar')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
