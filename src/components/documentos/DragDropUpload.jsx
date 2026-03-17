import React, { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { Pasta } from '@/entities/Pasta';
import { sanitizeFilename, validateFileType } from '@/lib/sanitize';

export default function DragDropUpload({ onUploadComplete, pastaAtual, documentosExistentes = [] }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showPastaModal, setShowPastaModal] = useState(false);
  const [selectedPasta, setSelectedPasta] = useState(null);
  const [pastas, setPastas] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState([]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Carregar pastas e mostrar modal de confirmação
    try {
      const pastasData = await Pasta.list();
      setPastas(pastasData);
      setPendingFiles(files);
      setSelectedPasta(pastaAtual?.id || null);
      setShowPastaModal(true);
    } catch (error) {
      console.error('Erro ao carregar pastas:', error);
    }
  };

  const checkDuplicates = () => {
    const duplicates = [];

    pendingFiles.forEach((file) => {
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      const existingDoc = documentosExistentes.find((doc) =>
      doc.titulo === fileName && (
      selectedPasta ? doc.pasta_id === selectedPasta : !doc.pasta_id)
      );

      if (existingDoc) {
        duplicates.push(fileName);
      }
    });

    setDuplicateWarning(duplicates);
    return duplicates.length > 0;
  };

  const handleConfirmUpload = async () => {
    if (pendingFiles.length === 0) return;

    // Verificar duplicatas
    if (checkDuplicates()) {
      return; // Mostra aviso mas não fecha o modal
    }

    setIsUploading(true);
    setShowPastaModal(false);

    for (const file of pendingFiles) {
      try {
        // Validar tipo de arquivo
        const validTypes = ['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/png', 'image/jpeg'];

        if (!validTypes.includes(file.type)) {
          console.warn(`Tipo não suportado: ${file.name}`);
          continue;
        }

        // Validar magic bytes do ficheiro
        const fileCheck = await validateFileType(file);
        if (!fileCheck.valid) {
          console.warn(`Ficheiro rejeitado (${fileCheck.reason}): ${file.name}`);
          continue;
        }

        // Validar tamanho (máx 50MB)
        if (file.size > 50 * 1024 * 1024) {
          console.warn(`Arquivo muito grande: ${file.name}`);
          continue;
        }

        const result = await base44.integrations.Core.UploadFile({ file });

        if (!result || !result.file_url) {
          console.error(`Falha no upload de ${file.name}`);
          continue;
        }

        const docData = {
          titulo: sanitizeFilename(file.name).replace(/\.[^/.]+$/, ''),
          arquivo_url: result.file_url,
          descricao: 'Carregado via drag-and-drop',
          pasta_id: selectedPasta
        };

        await onUploadComplete(docData);
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
      }
    }

    setPendingFiles([]);
    setDuplicateWarning([]);
    setIsUploading(false);
  };

  const handleForceUpload = async () => {
    setIsUploading(true);
    setShowPastaModal(false);
    setDuplicateWarning([]);

    for (const file of pendingFiles) {
      try {
        // Validar tipo de arquivo
        const validTypes = ['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/png', 'image/jpeg'];

        if (!validTypes.includes(file.type)) {
          console.warn(`Tipo não suportado: ${file.name}`);
          continue;
        }

        // Validar magic bytes do ficheiro
        const fileCheck = await validateFileType(file);
        if (!fileCheck.valid) {
          console.warn(`Ficheiro rejeitado (${fileCheck.reason}): ${file.name}`);
          continue;
        }

        // Validar tamanho (máx 50MB)
        if (file.size > 50 * 1024 * 1024) {
          console.warn(`Arquivo muito grande: ${file.name}`);
          continue;
        }

        const result = await base44.integrations.Core.UploadFile({ file });

        if (!result || !result.file_url) {
          console.error(`Falha no upload de ${file.name}`);
          continue;
        }

        const docData = {
          titulo: sanitizeFilename(file.name).replace(/\.[^/.]+$/, ''),
          arquivo_url: result.file_url,
          descricao: 'Carregado via drag-and-drop',
          pasta_id: selectedPasta
        };

        await onUploadComplete(docData);
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
      }
    }

    setPendingFiles([]);
    setIsUploading(false);
  };

  const pastasOptions = [
  { value: 'null', label: '🏠 Raiz (sem pasta)' },
  ...pastas.map((pasta) => ({
    value: pasta.id,
    label: `📁 ${pasta.nome}`
  }))];


  return (
    <>
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
        isDragging ?
        'border-blue-500 bg-blue-50' :
        'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'}`
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}>

        {isUploading ?
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
            <p className="text-lg font-medium text-blue-900">A carregar documentos...</p>
            <p className="text-sm text-slate-600">Aguarde enquanto processamos os arquivos</p>
          </div> :

        <>
            <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Arraste e solte seus arquivos
            </h3>
            <p className="text-slate-600 mb-4">Você poderá escolher a pasta de destino</p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <FileText className="w-4 h-4" />
              <span>Formatos aceites: PDF, DOC, DOCX, XLS, XLSX, CSV, PPT, PPTX, PNG, JPG</span>
            </div>
          </>
        }
      </div>

      {/* Modal de Confirmação de Pasta */}
      <Dialog open={showPastaModal} onOpenChange={setShowPastaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolher Pasta de Destino</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info dos arquivos */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-900">
                  {pendingFiles.length} arquivo{pendingFiles.length > 1 ? 's' : ''} selecionado{pendingFiles.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {pendingFiles.map((file, idx) =>
                <p key={idx} className="text-xs text-blue-800 pl-6">• {file.name}</p>
                )}
              </div>
            </div>

            {/* Aviso de duplicatas */}
            {duplicateWarning.length > 0 &&
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Arquivos duplicados encontrados:</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {duplicateWarning.map((name, idx) =>
                <p key={idx} className="text-xs text-yellow-800 pl-6">• {name}</p>
                )}
                </div>
                <p className="text-xs text-yellow-700 mt-2">Já existem documentos com estes nomes nesta pasta.</p>
              </div>
            }

            {/* Seletor de pasta */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Salvar em:</label>
              <Select
                options={pastasOptions}
                value={selectedPasta || 'null'}
                onValueChange={(value) => {
                  setSelectedPasta(value === 'null' ? null : value);
                  setDuplicateWarning([]);
                }} />

            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPastaModal(false);
                setPendingFiles([]);
                setDuplicateWarning([]);
              }}>

              Cancelar
            </Button>
            {duplicateWarning.length > 0 ?
            <Button
              onClick={handleForceUpload}
              className="bg-yellow-600 hover:bg-yellow-700">

                Carregar Mesmo Assim
              </Button> :

            <Button
              onClick={handleConfirmUpload} className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 hover:bg-blue-700">


                Carregar {pendingFiles.length} arquivo{pendingFiles.length > 1 ? 's' : ''}
              </Button>
            }
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);

}