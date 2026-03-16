import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Documento } from '@/entities/Documento';
import { analisarDocumento } from '@/functions/analisarDocumento';
import { sanitizeFilename } from '@/lib/sanitize';

export default function UploadMassaModal({ isOpen, onClose, onSuccess, aeroporto }) {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState([]);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setProgress(selectedFiles.map(f => ({ 
      name: f.name, 
      status: 'pending', 
      message: 'A processar' 
    })));
  };

  const processarDocumentos = async () => {
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Validar tamanho do arquivo (máx 50MB)
        if (file.size > 50 * 1024 * 1024) {
          throw new Error('Arquivo muito grande (máx. 50MB)');
        }

        // Validar tipo de arquivo
        const validTypes = ['application/pdf', 'application/msword', 
                           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                           'application/vnd.ms-excel',
                           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                           'image/png', 'image/jpeg'];
        if (!validTypes.includes(file.type)) {
          throw new Error('Tipo de arquivo não suportado');
        }

        // Atualizar status: Fazendo upload
        setProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'uploading', message: 'A iniciar upload...' } : p
        ));

        // 1. Upload do arquivo
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        
        if (!uploadResult || !uploadResult.file_url) {
          throw new Error('Falha no upload do arquivo');
        }
        
        const fileUrl = uploadResult.file_url;

        // Atualizar status: Analisando com IA
        setProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'analyzing', message: 'A fazer upload...' } : p
        ));

        // 2. Analisar documento com IA
        const analiseResult = await analisarDocumento({ 
          file_url: fileUrl, 
          titulo: sanitizeFilename(file.name)
        });

        if (analiseResult.data?.success) {
          const analise = analiseResult.data.analise;

          // Atualizar status: Salvando no banco de dados
          setProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'saving', message: 'A processar...' } : p
          ));

          // 3. Criar documento na base de dados
          await Documento.create({
            titulo: sanitizeFilename(file.name).replace(/\.[^/.]+$/, ''),
            categoria: analise.categoria_sugerida || 'outro',
            arquivo_url: fileUrl,
            versao: '1.0',
            data_publicacao: new Date().toISOString().split('T')[0],
            descricao: analise.resumo || '',
            nivel_acesso: analise.nivel_acesso_sugerido || ['visualizador'],
            status: 'ativo',
            aeroporto: aeroporto || null
          });

          // Sucesso!
          setProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'success', message: '✓ Concluído' } : p
          ));
        } else {
          throw new Error('Falha na análise do documento');
        }

      } catch (error) {
        console.error(`Erro ao processar ${file.name}:`, error);
        setProgress(prev => prev.map((p, idx) => 
          idx === i ? { 
            ...p, 
            status: 'error', 
            message: `Erro: ${error.message}` 
          } : p
        ));
      }
    }

    setIsProcessing(false);
    
    // Verificar se houve sucesso e chamar onSuccess
    setTimeout(() => {
      const hasSuccess = progress.some(p => p.status === 'success');
      if (hasSuccess && onSuccess) {
        onSuccess();
      }
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Upload em Massa com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Selecionar Documentos (PDF)</Label>
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50"
            />
            <p className="text-xs text-slate-500">
              Selecione um ou mais arquivos PDF. A IA irá analisar e categorizar automaticamente.
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">
                Arquivos Selecionados ({files.length})
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg divide-y max-h-60 overflow-y-auto">
                {progress.map((item, idx) => (
                  <div key={idx} className="p-4 flex items-center gap-3 bg-white hover:bg-slate-50 transition-colors">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                      <p className={`text-xs mt-0.5 ${
                        item.status === 'pending' ? 'text-slate-500' :
                        item.status === 'success' ? 'text-green-600' :
                        item.status === 'error' ? 'text-red-600' :
                        'text-blue-600'
                      }`}>
                        {item.message}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {item.status === 'pending' && (
                        <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
                      )}
                      {(item.status === 'uploading' || item.status === 'analyzing' || item.status === 'saving') && (
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      )}
                      {item.status === 'success' && (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      )}
                      {item.status === 'error' && (
                        <XCircle className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button 
              onClick={processarDocumentos} 
              disabled={files.length === 0 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Processar Documentos
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}