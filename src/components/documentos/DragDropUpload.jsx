// Arrastar e largar ficheiros para o portal. A detecção de repetidos é por IMPRESSÃO DIGITAL do ficheiro
// (SHA-256, migração 152) e não pelo nome: o nome muda, o ficheiro é o mesmo. E nunca trava o carregamento —
// mostra o par e deixa carregar, porque rejeitar à entrada esconde o problema (desenho do Paperless).
import React, { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { Pasta } from '@/entities/Pasta';
import { sanitizeFilename, validateFileType } from '@/lib/sanitize';
import { impressaoDigital, documentosComMesmoFicheiro } from '@/documentos/hooks';

export default function DragDropUpload({ onUploadComplete, pastaAtual, documentosExistentes = [] }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showPastaModal, setShowPastaModal] = useState(false);
  const [selectedPasta, setSelectedPasta] = useState(null);
  const [pastas, setPastas] = useState([]);
  // Uma entrada por ficheiro largado: { nome, sha256, pares } — `pares` são os documentos que já têm este
  // ficheiro. Mostram-se; não impedem nada.
  const [impressoes, setImpressoes] = useState([]);
  const [aIdentificar, setAIdentificar] = useState(false);

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
      setImpressoes(files.map((f) => ({ nome: f.name, sha256: null, pares: [] })));
      setShowPastaModal(true);
      identificar(files);
    } catch (error) {
      console.error('Erro ao carregar pastas:', error);
    }
  };

  // Impressão digital de cada ficheiro largado, e o par que já exista no portal. Corre enquanto a pessoa escolhe
  // a pasta: quando ela clicar em carregar, a informação já está na janela.
  const identificar = async (files) => {
    setAIdentificar(true);
    try {
      const resultado = [];
      for (const file of files) {
        const sha256 = await impressaoDigital(file);
        const pares = sha256 ? await documentosComMesmoFicheiro(sha256) : [];
        resultado.push({ nome: file.name, sha256, pares });
        setImpressoes([...resultado, ...files.slice(resultado.length).map((f) => ({ nome: f.name, sha256: null, pares: [] }))]);
      }
    } catch (error) {
      console.error('Não foi possível calcular a impressão digital:', error);
    } finally {
      setAIdentificar(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (pendingFiles.length === 0) return;

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

        // storage privado: o ficheiro só é servido por URL assinada de curta duração
        const result = await base44.integrations.Core.UploadPrivateFile({ file });

        if (!result || !result.path) {
          console.error(`Falha no upload de ${file.name}`);
          continue;
        }

        // Impressão digital: a calculada quando a janela abriu, ou, se faltar, calculada agora.
        const digital = impressoes.find((i) => i.nome === file.name)?.sha256 || (await impressaoDigital(file));

        const docData = {
          titulo: sanitizeFilename(file.name).replace(/\.[^/.]+$/, ''),
          arquivo_privado_uri: result.path,
          usar_storage_privado: true,
          descricao: 'Carregado via drag-and-drop',
          pasta_id: selectedPasta,
          ...(digital ? { sha256: digital } : {})
        };

        await onUploadComplete(docData);
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
      }
    }

    setPendingFiles([]);
    setImpressoes([]);
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

            {/* Ficheiros já no portal: avisa-se, não se trava. A decisão é de uma pessoa, na gestão. */}
            {aIdentificar &&
            <p className="text-xs text-slate-600 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                A calcular a impressão digital dos ficheiros...
              </p>
            }
            {impressoes.some((i) => i.pares.length > 0) &&
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                <p className="text-sm font-semibold text-amber-900 mb-2">
                  Ficheiros que já estão no portal
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1.5">
                  {impressoes.filter((i) => i.pares.length > 0).map((i) =>
                <div key={i.nome} className="text-xs text-amber-900">
                      <p className="font-medium truncate">• {i.nome}</p>
                      <ul className="pl-4">
                        {i.pares.map((d) =>
                    <li key={d.id} className="truncate">
                            igual a {d.numero ? <span className="font-mono tabular-nums">{d.numero} · </span> : null}{d.titulo}
                          </li>
                    )}
                      </ul>
                    </div>
                )}
                </div>
                <p className="text-xs text-amber-800 mt-2">
                  O ficheiro é byte a byte o mesmo. Pode carregar: o par fica marcado em Gestão › Documentos ›
                  Repetidos, para alguém decidir se são dois exemplares legítimos.
                </p>
              </div>
            }

            {/* Seletor de pasta */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Salvar em:</label>
              <Select
                options={pastasOptions}
                value={selectedPasta || 'null'}
                onValueChange={(value) => setSelectedPasta(value === 'null' ? null : value)} />

            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPastaModal(false);
                setPendingFiles([]);
                setImpressoes([]);
              }}>

              Cancelar
            </Button>
            <Button
              onClick={handleConfirmUpload} className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 hover:bg-blue-700">


              Carregar {pendingFiles.length} arquivo{pendingFiles.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);

}