
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, X, Shield, FileText } from 'lucide-react';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { UploadFile } from '@/integrations/Core';
import { TipoDocumento } from '@/entities/TipoDocumento';
import { hasUserProfile } from '@/components/lib/userUtils';

export default function FormCredenciamento({ isOpen, onClose, onSubmit, empresas, aeroportos, areasAcessoDisponiveis, credenciamentoInicial = null, currentUser }) {
  const [formData, setFormData] = useState({
    empresa_solicitante_id: '',
    tipo_credencial: '',
    periodo_validade: '',
    aeroporto_id: '',
    areas_acesso: [],
    justificativa_acesso: '',
    nome_completo: '',
    numero_passaporte: '',
    nacionalidade: '',
    data_nascimento: '',
    funcao_empresa: '',
    matricula_viatura: '',
    modelo_viatura: '',
    cor_viatura: '',
    condutor_principal: '',
    data_inicio_validade: '',
    data_fim_validade: '',
    documentos_anexos: {}
  });

  const [tiposDocumento, setTiposDocumento] = useState([]);
  const [isUploading, setIsUploading] = useState({});
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  useEffect(() => {
    if (isOpen) {
      loadTiposDocumento();
    }
  }, [isOpen]);

  useEffect(() => {
    if (credenciamentoInicial) {
      setFormData({
        ...credenciamentoInicial,
        documentos_anexos: credenciamentoInicial.documentos_anexos || {}
      });
    } else {
      // Para novo credenciamento, inicializa o formulário com valores padrão
      setFormData({
        empresa_solicitante_id: '', // Inicialmente vazio
        tipo_credencial: '',
        periodo_validade: '',
        aeroporto_id: '',
        areas_acesso: [],
        justificativa_acesso: '',
        nome_completo: '',
        numero_passaporte: '',
        nacionalidade: '',
        data_nascimento: '', // Corrected typo here
        funcao_empresa: '',
        matricula_viatura: '',
        modelo_viatura: '',
        cor_viatura: '',
        condutor_principal: '',
        data_inicio_validade: '',
        data_fim_validade: '',
        documentos_anexos: {}
      });

      // Se for um novo credenciamento e o usuário for gestor de empresa, pré-preencher a empresa solicitante
      if (hasUserProfile(currentUser, 'gestor_empresa') && currentUser?.empresa_id) {
        setFormData(prev => ({
          ...prev,
          empresa_solicitante_id: currentUser.empresa_id
        }));
      }
    }
  }, [credenciamentoInicial, isOpen, currentUser]);

  const loadTiposDocumento = async () => {
    try {
      const tipos = await TipoDocumento.list('ordem');
      setTiposDocumento(tipos.filter(t => t.status === 'ativo'));
    } catch (error) {
      console.error('Erro ao carregar tipos de documento:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    guardedSubmit(async () => {
      await onSubmit(formData);
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (event, tipoDocId) => {
    const file = event.target.files[0];
    if (!file) return;

    const tipoDoc = tiposDocumento.find(t => t.id === tipoDocId);
    if (tipoDoc) {
      // Validar formato
      const fileExtension = file.name.split('.').pop().toUpperCase();
      if (!tipoDoc.formato_aceito.includes(fileExtension)) {
        alert(`Formato não aceito. Formatos aceites: ${tipoDoc.formato_aceito.join(', ')}`);
        return;
      }

      // Validar tamanho
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > tipoDoc.tamanho_max_mb) {
        alert(`Arquivo muito grande. Tamanho máximo: ${tipoDoc.tamanho_max_mb}MB`);
        return;
      }
    }

    setIsUploading(prev => ({ ...prev, [tipoDocId]: true }));
    try {
      const { file_url } = await UploadFile({ file });
      setFormData(prev => ({
        ...prev,
        documentos_anexos: {
          ...prev.documentos_anexos,
          [tipoDocId]: [...(prev.documentos_anexos[tipoDocId] || []), file_url]
        }
      }));
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload do documento. Tente novamente.');
    } finally {
      setIsUploading(prev => ({ ...prev, [tipoDocId]: false }));
    }
  };

  const removeDocument = (tipoDocId, indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      documentos_anexos: {
        ...prev.documentos_anexos,
        [tipoDocId]: prev.documentos_anexos[tipoDocId]?.filter((_, index) => index !== indexToRemove) || []
      }
    }));
  };

  const handleAreaAccessChange = (areaName, checked) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        areas_acesso: [...prev.areas_acesso, areaName]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        areas_acesso: prev.areas_acesso.filter(a => a !== areaName)
      }));
    }
  };

  const getRelevantDocuments = () => {
    return tiposDocumento.filter(doc =>
      doc.tipo_credencial.includes(formData.tipo_credencial) ||
      doc.tipo_credencial.includes('ambos')
    ).sort((a, b) => a.ordem - b.ordem);
  };

  const empresasDisponiveis = useMemo(() => {
    if (hasUserProfile(currentUser, 'gestor_empresa') && currentUser.empresa_id) {
      return empresas.filter(e => e.id === currentUser.empresa_id);
    }
    return empresas;
  }, [empresas, currentUser]);

  // New option structures for Select component
  const empresaOptions = empresasDisponiveis.map(empresa => ({
    value: empresa.id,
    label: empresa.nome
  }));

  const aeroportoOptions = aeroportos.map(aeroporto => ({
    value: aeroporto.codigo_icao,
    label: `${aeroporto.nome} (${aeroporto.codigo_icao})`
  }));

  // Verificar se é gestor de empresa para desabilitar campo empresa
  const isGestorEmpresa = hasUserProfile(currentUser, 'gestor_empresa');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            {credenciamentoInicial ? 'Editar' : 'Nova'} Solicitação de Credenciamento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Empresa Solicitante *</Label>
              <Select
                options={empresaOptions} // New prop
                value={formData.empresa_solicitante_id}
                onValueChange={(value) => handleChange('empresa_solicitante_id', value)}
                placeholder="Selecionar empresa" // New prop
                disabled={isGestorEmpresa}
              />
              {isGestorEmpresa && (
                <p className="text-sm text-slate-500">
                  Esta empresa está automaticamente selecionada com base no seu perfil.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Aeroporto *</Label>
              <Select
                options={aeroportoOptions} // New prop
                value={formData.aeroporto_id}
                onValueChange={(value) => handleChange('aeroporto_id', value)}
                placeholder="Selecionar aeroporto" // New prop
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Credencial *</Label>
              <RadioGroup
                value={formData.tipo_credencial}
                onValueChange={(value) => handleChange('tipo_credencial', value)}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pessoa" id="pessoa" />
                  <Label htmlFor="pessoa">Pessoa</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="viatura" id="viatura" />
                  <Label htmlFor="viatura">Viatura</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Período de Validade *</Label>
              <RadioGroup
                value={formData.periodo_validade}
                onValueChange={(value) => handleChange('periodo_validade', value)}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="temporario" id="temporario" />
                  <Label htmlFor="temporario">Temporário</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="permanente" id="permanente" />
                  <Label htmlFor="permanente">Permanente</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Dados da Pessoa */}
          {formData.tipo_credencial === 'pessoa' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Dados da Pessoa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    value={formData.nome_completo}
                    onChange={(e) => handleChange('nome_completo', e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Função na Empresa *</Label>
                  <Input
                    value={formData.funcao_empresa}
                    onChange={(e) => handleChange('funcao_empresa', e.target.value)}
                    placeholder="Cargo/função"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número do Passaporte/BI *</Label>
                  <Input
                    value={formData.numero_passaporte}
                    onChange={(e) => handleChange('numero_passaporte', e.target.value)}
                    placeholder="Número do documento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nacionalidade *</Label>
                  <Input
                    value={formData.nacionalidade}
                    onChange={(e) => handleChange('nacionalidade', e.target.value)}
                    placeholder="Nacionalidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento *</Label>
                  <Input
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => handleChange('data_nascimento', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dados da Viatura */}
          {formData.tipo_credencial === 'viatura' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Dados da Viatura</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matrícula da Viatura *</Label>
                  <Input
                    value={formData.matricula_viatura}
                    onChange={(e) => handleChange('matricula_viatura', e.target.value)}
                    placeholder="Matrícula"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo da Viatura *</Label>
                  <Input
                    value={formData.modelo_viatura}
                    onChange={(e) => handleChange('modelo_viatura', e.target.value)}
                    placeholder="Modelo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor da Viatura *</Label>
                  <Input
                    value={formData.cor_viatura}
                    onChange={(e) => handleChange('cor_viatura', e.target.value)}
                    placeholder="Cor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Condutor Principal *</Label>
                  <Input
                    value={formData.condutor_principal}
                    onChange={(e) => handleChange('condutor_principal', e.target.value)}
                    placeholder="Nome do condutor"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Período de Validade (se temporário) */}
          {formData.periodo_validade === 'temporario' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Período de Validade</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Início *</Label>
                  <Input
                    type="date"
                    value={formData.data_inicio_validade}
                    onChange={(e) => handleChange('data_inicio_validade', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Fim *</Label>
                  <Input
                    type="date"
                    value={formData.data_fim_validade}
                    onChange={(e) => handleChange('data_fim_validade', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Áreas de Acesso */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Áreas de Acesso Solicitadas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {areasAcessoDisponiveis && areasAcessoDisponiveis.filter(a => a.status === 'ativo').map((area) => (
                <div key={area.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={String(area.id)}
                    checked={formData.areas_acesso.includes(area.nome)}
                    onCheckedChange={(checked) => handleAreaAccessChange(area.nome, checked)}
                  />
                  <Label htmlFor={String(area.id)} className="text-sm">{area.nome}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Justificativa */}
          <div className="space-y-2">
            <Label>Justificativa do Acesso *</Label>
            <Textarea
              value={formData.justificativa_acesso}
              onChange={(e) => handleChange('justificativa_acesso', e.target.value)}
              placeholder="Descreva o motivo da solicitação de acesso..."
              rows={3}
            />
          </div>

          {/* Documentos Organizados */}
          {formData.tipo_credencial && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Documentos Necessários</h3>
              <div className="space-y-4">
                {getRelevantDocuments().map((tipoDoc) => (
                  <div key={tipoDoc.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center space-x-2 mt-1">
                        <Checkbox
                          id={`doc-${tipoDoc.id}`}
                          checked={(formData.documentos_anexos[tipoDoc.id] || []).length > 0}
                          disabled
                          className="data-[state=checked]:bg-green-600"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <Label htmlFor={`doc-${tipoDoc.id}`} className="font-medium">
                            {tipoDoc.nome}
                            {tipoDoc.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{tipoDoc.descricao}</p>
                        <p className="text-xs text-slate-500 mb-3">
                          Formatos aceites: {tipoDoc.formato_aceito.join(', ')} |
                          Tamanho máximo: {tipoDoc.tamanho_max_mb}MB
                        </p>

                        <div className="space-y-2">
                          <input
                            type="file"
                            accept={tipoDoc.formato_aceito.map(f => `.${f.toLowerCase()}`).join(',')}
                            onChange={(e) => handleFileUpload(e, tipoDoc.id)}
                            disabled={isUploading[tipoDoc.id]}
                            className="hidden"
                            id={`file-${tipoDoc.id}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isUploading[tipoDoc.id]}
                            asChild
                          >
                            <label htmlFor={`file-${tipoDoc.id}`} className="cursor-pointer">
                              <Upload className="w-4 h-4 mr-2" />
                              {isUploading[tipoDoc.id] ? 'A carregar...' : 'Selecionar Ficheiro'}
                            </label>
                          </Button>

                          {formData.documentos_anexos[tipoDoc.id] && formData.documentos_anexos[tipoDoc.id].length > 0 && (
                            <div className="space-y-1">
                              {formData.documentos_anexos[tipoDoc.id].map((url, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                                  <span className="text-sm text-green-800">✓ Documento {index + 1} carregado</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeDocument(tipoDoc.id, index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? 'A guardar...' : `${credenciamentoInicial ? 'Atualizar' : 'Criar'} Solicitação`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
