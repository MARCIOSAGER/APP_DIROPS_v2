import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Upload, Sparkles, Loader2, Download, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sanitizeFilename } from '@/lib/sanitize';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { analisarDocumento } from '@/functions/analisarDocumento';

const CATEGORIA_OPTIONS = [
{ value: 'manual_operacoes', label: 'Manual de Operações' },
{ value: 'procedimento', label: 'Procedimento' },
{ value: 'regulamentacao', label: 'Regulamentação' },
{ value: 'formulario', label: 'Formulário' },
{ value: 'relatorio', label: 'Relatório' },
{ value: 'outro', label: 'Outro' }];


const PERFIL_OPTIONS = [
{ value: 'administrador', label: 'Administrador' },
{ value: 'operacoes', label: 'Operações' },
{ value: 'financeiro', label: 'Financeiro' },
{ value: 'infraestrutura', label: 'Infraestrutura' },
{ value: 'safety', label: 'Safety' },
{ value: 'avsec', label: 'AVSEC' },
{ value: 'visualizador', label: 'Visualizador' }];


const CONFIDENCIALIDADE_CONFIG = {
  publico: { color: 'bg-green-100 text-green-800', label: 'Público', icon: Eye },
  interno: { color: 'bg-blue-100 text-blue-800', label: 'Interno', icon: FileText },
  confidencial: { color: 'bg-orange-100 text-orange-800', label: 'Confidencial', icon: Shield },
  secreto: { color: 'bg-red-100 text-red-800', label: 'Secreto', icon: Lock }
};

export default function FormDocumento({ isOpen, onClose, onSubmit, aeroportos, documentoInitial = null }) {
  const [formData, setFormData] = useState({
    titulo: '',
    categoria: '',
    aeroporto: '',
    versao: '1.0',
    data_publicacao: new Date().toISOString().split('T')[0],
    descricao: '',
    nivel_acesso: [],
    nivel_confidencialidade: 'interno',
    requer_senha_adicional: false,
    senha: '',
    bloquear_download: false,
    adicionar_marca_dagua: false,
    status: 'ativo',
    arquivo_url: '',
    usar_storage_privado: false
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { isSubmitting, guardedSubmit } = useSubmitGuard();
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  useEffect(() => {
    if (documentoInitial) {
      setFormData(documentoInitial);
    } else {
      setFormData({
        titulo: '',
        categoria: '',
        aeroporto: '',
        versao: '1.0',
        data_publicacao: new Date().toISOString().split('T')[0],
        descricao: '',
        nivel_acesso: [],
        status: 'ativo',
        arquivo_url: ''
      });
    }
  }, [documentoInitial, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar senhas se o documento requer senha adicional
    if (formData.requer_senha_adicional) {
      if (!formData.senha) {
        setErroSenha('Por favor, digite uma senha');
        return;
      }
      if (formData.senha !== confirmaSenha) {
        setErroSenha('As senhas não coincidem');
        return;
      }
      if (formData.senha.length < 6) {
        setErroSenha('A senha deve ter pelo menos 6 caracteres');
        return;
      }
    }

    guardedSubmit(async () => {
      await onSubmit(formData);
    });
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNivelAcessoToggle = (perfil) => {
    setFormData((prev) => ({
      ...prev,
      nivel_acesso: prev.nivel_acesso.includes(perfil) ?
      prev.nivel_acesso.filter((p) => p !== perfil) :
      [...prev.nivel_acesso, perfil]
    }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Se marcado como storage privado, usar UploadPrivateFile
      if (formData.usar_storage_privado) {
        const result = await base44.integrations.Core.UploadPrivateFile({ file });
        handleChange('arquivo_privado_uri', result.file_uri);
        handleChange('arquivo_url', ''); // Limpar URL pública
      } else {
        const result = await base44.integrations.Core.UploadFile({ file });
        handleChange('arquivo_url', result.file_url);
        handleChange('arquivo_privado_uri', ''); // Limpar URI privada
      }

      if (!formData.titulo) {
        handleChange('titulo', sanitizeFilename(file.name).replace(/\.[^/.]+$/, ''));
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setIsUploading(false);
    }
  };

  const analisarComIA = async () => {
    if (!formData.arquivo_url) {
      alert('Faça o upload do documento primeiro');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analisarDocumento({
        file_url: formData.arquivo_url,
        titulo: formData.titulo
      });

      if (result.data?.success) {
        const analise = result.data.analise;
        setFormData((prev) => ({
          ...prev,
          categoria: analise.categoria_sugerida || prev.categoria,
          descricao: analise.resumo || prev.descricao,
          nivel_acesso: analise.nivel_acesso_sugerido || prev.nivel_acesso
        }));
        alert('Documento analisado com sucesso! Os campos foram preenchidos automaticamente.');
      }
    } catch (error) {
      console.error('Erro ao analisar documento:', error);
      alert('Erro ao analisar documento com IA');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const aeroportoOptions = [
  { value: '', label: 'Geral (Todos)' },
  ...aeroportos.map((aeroporto) => ({
    value: aeroporto.codigo_icao,
    label: `${aeroporto.nome} (${aeroporto.codigo_icao})`
  }))];


  const statusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'revisao', label: 'Em Revisão' },
  { value: 'arquivado', label: 'Arquivado' }];


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {documentoInitial ? 'Editar Documento' : 'Novo Documento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info de Projecto/Aeroporto no topo */}
          {formData.aeroporto &&
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-700 font-medium mb-1">Projecto *</p>
              <p className="text-base text-blue-900 font-semibold">
                {aeroportos.find((a) => a.codigo_icao === formData.aeroporto)?.nome || formData.aeroporto}
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Código ICAO: {formData.aeroporto}
              </p>
            </div>
          }

          {/* Seletor de Pasta */}
          <div className="space-y-2">
            <Label>Pasta</Label>
            <Select
              options={aeroportoOptions}
              value={formData.aeroporto}
              onValueChange={(value) => handleChange('aeroporto', value)} />

          </div>

          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={formData.titulo}
              onChange={(e) => handleChange('titulo', e.target.value)}
              placeholder="Ex: Manual de Operações Aeroportuárias"
              required
              className="font-medium" />

          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <Select
                options={CATEGORIA_OPTIONS}
                value={formData.categoria}
                onValueChange={(value) => handleChange('categoria', value)} />

            </div>
            <div className="space-y-2">
              <Label>Versão</Label>
              <Input
                value={formData.versao}
                onChange={(e) => handleChange('versao', e.target.value)}
                placeholder="ex: v1.0" />

            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                options={statusOptions}
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)} />

            </div>
            <div className="space-y-2">
              <Label>Data de Submissão</Label>
              <Input
                type="date"
                value={formData.data_publicacao}
                onChange={(e) => handleChange('data_publicacao', e.target.value)} />

            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <textarea
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Carregado via drag-and-drop"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />

          </div>

          {/* Segurança Avançada */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-slate-900">Segurança e Confidencialidade</h3>
            </div>

            {/* Nível de Confidencialidade */}
            <div className="space-y-2">
              <Label>Nível de Confidencialidade *</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CONFIDENCIALIDADE_CONFIG).map(([key, config]) => {
                  const IconComponent = config.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleChange('nivel_confidencialidade', key)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                      formData.nivel_confidencialidade === key ?
                      `${config.color} border-current shadow-md` :
                      'border-slate-200 hover:border-slate-300 bg-white'}`
                      }>

                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4" />
                        <span className="text-sm font-medium">{config.label}</span>
                      </div>
                    </button>);

                })}
              </div>
            </div>

            {/* Storage Privado */}
            <div className="flex items-center space-x-2 bg-purple-50 p-3 rounded-lg">
              <Checkbox
                id="storage-privado"
                checked={formData.usar_storage_privado}
                onCheckedChange={(checked) => handleChange('usar_storage_privado', checked)} />

              <label htmlFor="storage-privado" className="text-sm font-medium text-purple-900 cursor-pointer">
                <Lock className="w-4 h-4 inline mr-1" />
                Usar storage privado (URLs temporárias)
              </label>
            </div>

            {/* Bloquear Download */}
            <div className="flex items-center space-x-2 bg-orange-50 p-3 rounded-lg">
              <Checkbox
                id="bloquear-download"
                checked={formData.bloquear_download}
                onCheckedChange={(checked) => handleChange('bloquear_download', checked)} />

              <label htmlFor="bloquear-download" className="text-sm font-medium text-orange-900 cursor-pointer">
                <EyeOff className="w-4 h-4 inline mr-1" />
                Bloquear download (somente visualização)
              </label>
            </div>

            {/* Marca d'água */}
            <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-lg">
              <Checkbox
                id="marca-dagua"
                checked={formData.adicionar_marca_dagua}
                onCheckedChange={(checked) => handleChange('adicionar_marca_dagua', checked)} />

              <label htmlFor="marca-dagua" className="text-sm font-medium text-blue-900 cursor-pointer">
                <Shield className="w-4 h-4 inline mr-1" />
                Adicionar marca d'água no download
              </label>
            </div>

            {(formData.bloquear_download || formData.adicionar_marca_dagua) &&
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <strong>Informação:</strong>
                {formData.bloquear_download && ' Os usuários só poderão visualizar o documento, sem fazer download.'}
                {formData.adicionar_marca_dagua && ' O documento terá marca d\'água com nome e data de acesso do usuário.'}
              </div>
            }

            {/* Senha Adicional */}
            <div className="flex items-center space-x-2 bg-red-50 p-3 rounded-lg">
              <Checkbox
                id="senha-adicional"
                checked={formData.requer_senha_adicional}
                onCheckedChange={(checked) => handleChange('requer_senha_adicional', checked)} />

              <label htmlFor="senha-adicional" className="text-sm font-medium text-red-900 cursor-pointer">
                Requerer senha adicional para visualizar
              </label>
            </div>

            {formData.requer_senha_adicional &&
            <div className="space-y-3 pl-4 border-l-2 border-red-300">
                <div className="space-y-2">
                  <Label>Senha de Proteção *</Label>
                  <div className="relative">
                    <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={formData.senha || ''}
                    onChange={(e) => {
                      handleChange('senha', e.target.value);
                      setErroSenha('');
                    }}
                    placeholder="Digite uma senha forte"
                    required={formData.requer_senha_adicional}
                    className="pr-10" />

                    <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">

                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirmar Senha *</Label>
                  <Input
                  type={mostrarSenha ? "text" : "password"}
                  value={confirmaSenha}
                  onChange={(e) => {
                    setConfirmaSenha(e.target.value);
                    setErroSenha('');
                  }}
                  placeholder="Digite a senha novamente"
                  required={formData.requer_senha_adicional} />

                </div>

                {erroSenha &&
              <p className="text-sm text-red-600 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {erroSenha}
                  </p>
              }

                <p className="text-xs text-slate-500">
                  Esta senha será necessária além do perfil de acesso (mínimo 6 caracteres)
                </p>
              </div>
            }
          </div>

          <div className="space-y-2">
            <Label>Arquivo Atual (opcional)</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <label className="flex-1">
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="cursor-pointer"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg" />

                </label>
              </div>

              {/* Status messages */}
              {isUploading &&
              <p className="text-xs text-blue-600 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  A carregar ficheiro...
                </p>
              }
              
              {/* Current file info */}
              {formData.arquivo_url && !isUploading &&
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-green-800">✓ Arquivo carregado:</span>
                    <a
                    href={formData.arquivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:underline truncate">

                      {formData.arquivo_url.split('/').pop()}
                    </a>
                  </div>
                  <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(formData.arquivo_url, '_blank')}
                  className="h-6 w-6 text-green-600">

                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              }

              <p className="text-xs text-slate-500">
                Formatos: PDF, DOC, DOCX, XLS, XLSX, CSV, PPT, PPTX, PNG, JPG (máx. 50MB)
              </p>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              type="submit"
              disabled={isUploading || isAnalyzing || isSubmitting} className="bg-blue-600 text-slate-50 px-8 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 hover:bg-blue-700">


              {isSubmitting ? 'A guardar...' : documentoInitial ? 'Actualizar Documento' : 'Criar Documento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}