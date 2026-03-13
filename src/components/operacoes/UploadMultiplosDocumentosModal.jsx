import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { Upload, X, File, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DOCUMENT_TYPES = [
  { value: 'general_declaration', label: 'General Declaration' },
  { value: 'manifesto_passageiros', label: 'Manifesto de Passageiros' },
  { value: 'manifesto_carga', label: 'Manifesto de Carga' },
  { value: 'formulario_trafego', label: 'Formulário de Tráfego' },
  { value: 'proforma', label: 'Proforma Assinada' },
  { value: 'outro', label: 'Outro Documento' }
];

export default function UploadMultiplosDocumentosModal({ isOpen, onClose, vooLigado, onSuccess, voos }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    const filesWithMetadata = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      documentType: 'general_declaration',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...filesWithMetadata]);
  };

  const removeFile = (fileId) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const updateFileType = (fileId, documentType) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, documentType } : f
    ));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);

    try {
      const { Documento } = await import('@/entities/Documento');
      const arrVoo = voos?.find(v => v.id === vooLigado?.id_voo_arr);
      const depVoo = voos?.find(v => v.id === vooLigado?.id_voo_dep);

      const tiposNome = {
        'general_declaration': 'General Declaration',
        'manifesto_passageiros': 'Manifesto de Passageiros',
        'manifesto_carga': 'Manifesto de Carga',
        'formulario_trafego': 'Formulário de Tráfego',
        'proforma': 'Proforma Assinada',
        'outro': 'Outro Documento'
      };

      for (const fileItem of files) {
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'uploading' } : f
        ));

        try {
          // 1. Upload do ficheiro
          const uploadResult = await base44.integrations.Core.UploadFile({ 
            file: fileItem.file 
          });

          // 2. Criar registo do documento
          if (vooLigado && arrVoo && depVoo) {
            const documentoData = {
              titulo: `${tiposNome[fileItem.documentType]} - ${arrVoo.numero_voo} → ${depVoo.numero_voo}`,
              categoria: 'outro',
              aeroporto: arrVoo.aeroporto_operacao,
              voo_ligado_id: vooLigado.id,
              arquivo_url: uploadResult.file_url,
              data_publicacao: new Date().toISOString().split('T')[0],
              descricao: `${tiposNome[fileItem.documentType]} para voo ligado ${arrVoo.numero_voo} (ARR) → ${depVoo.numero_voo} (DEP). Registo: ${depVoo.registo_aeronave}`,
              nivel_acesso: ['administrador', 'operacoes'],
              status: 'ativo'
            };

            await Documento.create(documentoData);
          }

          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'success', url: uploadResult.file_url } : f
          ));

        } catch (error) {
          console.error('Erro ao fazer upload:', error);
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'error', error: error.message } : f
          ));
        }
      }

      const allSuccess = files.every(f => {
        const updated = files.find(uf => uf.id === f.id);
        return updated?.status === 'success';
      });

      if (allSuccess) {
        setTimeout(() => {
          onSuccess?.(files);
          handleClose();
        }, 1000);
      }

    } catch (error) {
      console.error('Erro no processo de upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      addFiles([file]);
      stopCamera();
    }, 'image/jpeg', 0.95);
  };

  const handleClose = () => {
    stopCamera();
    files.forEach(f => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview);
      }
    });
    setFiles([]);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const allUploaded = files.length > 0 && files.every(f => f.status === 'success');

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload de Documentos - Voo {vooLigado?.numero_voo_arr} → {vooLigado?.numero_voo_dep}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {showCamera ? (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto"
                />
              </div>
              <div className="flex justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCamera}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={capturePhoto}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Capturar Foto
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-300 hover:border-slate-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <p className="text-lg font-medium text-slate-700 mb-2">
                Arraste ficheiros aqui ou clique para selecionar
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Suporta múltiplos ficheiros (PDF, imagens, etc.)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Selecionar Ficheiros
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={startCamera}
                  disabled={uploading}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Tirar Foto
                </Button>
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800">
                Ficheiros Selecionados ({files.length})
              </h3>
              
              {files.map((fileItem) => (
                <div 
                  key={fileItem.id}
                  className="border border-slate-200 rounded-lg p-4 bg-white"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {fileItem.preview ? (
                        <img 
                          src={fileItem.preview} 
                          alt={fileItem.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center">
                          <File className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {fileItem.name}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatFileSize(fileItem.size)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {fileItem.status === 'success' && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                          {fileItem.status === 'error' && (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          {fileItem.status === 'uploading' && (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                          )}
                          {fileItem.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(fileItem.id)}
                              disabled={uploading}
                              className="h-8 w-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {fileItem.status === 'pending' && (
                        <div className="mt-3">
                          <Select
                            options={DOCUMENT_TYPES}
                            value={fileItem.documentType}
                            onValueChange={(value) => updateFileType(fileItem.id, value)}
                            disabled={uploading}
                            searchable={false}
                          />
                        </div>
                      )}

                      {fileItem.status === 'error' && (
                        <p className="text-sm text-red-600 mt-2">
                          Erro: {fileItem.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            {allUploaded ? 'Fechar' : 'Cancelar'}
          </Button>
          {!allUploaded && (
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  A Enviar...
                </>
              ) : (
                `Enviar ${files.length} Ficheiro${files.length !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}