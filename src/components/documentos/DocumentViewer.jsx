import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, FileText, Calendar, Shield } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const CATEGORIA_CONFIG = {
  manual_operacoes: { color: 'bg-blue-100 text-blue-800', label: 'Manual de Operações' },
  procedimento: { color: 'bg-green-100 text-green-800', label: 'Procedimento' },
  regulamentacao: { color: 'bg-purple-100 text-purple-800', label: 'Regulamentação' },
  formulario: { color: 'bg-orange-100 text-orange-800', label: 'Formulário' },
  relatorio: { color: 'bg-indigo-100 text-indigo-800', label: 'Relatório' },
  outro: { color: 'bg-gray-100 text-gray-800', label: 'Outro' }
};

const STATUS_CONFIG = {
  ativo: { color: 'bg-green-100 text-green-800', label: 'Ativo' },
  arquivado: { color: 'bg-gray-100 text-gray-800', label: 'Arquivado' },
  revisao: { color: 'bg-yellow-100 text-yellow-800', label: 'Em Revisão' }
};

export default function DocumentViewer({ isOpen, onClose, documento, aeroportos }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [signedUrl, setSignedUrl] = useState(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { base44 } = await import('@/api/base44Client');
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    };
    
    if (isOpen && documento?.adicionar_marca_dagua) {
      loadUser();
    }
  }, [isOpen, documento]);

  const categoriaConfig = documento ? (CATEGORIA_CONFIG[documento.categoria] || CATEGORIA_CONFIG.outro) : null;
  const statusConfig = documento ? (STATUS_CONFIG[documento.status] || STATUS_CONFIG.ativo) : null;
  
  const getAeroportoNome = (icao) => {
    if (!icao) return 'Geral';
    const aero = aeroportos?.find(a => a.codigo_icao === icao);
    return aero?.nome || icao;
  };

  // Carregar URL assinada se necessário e registrar visualização
  useEffect(() => {
    const loadDocumentUrl = async () => {
      if (!documento || !isOpen) {
        setSignedUrl(null);
        return;
      }
      
      setIsLoadingUrl(true);
      try {
        // Registrar visualização
        await registrarAcesso('visualizacao');

        // Se tem marca d'água, NÃO carregar preview (apenas download)
        if (documento.adicionar_marca_dagua) {
          setSignedUrl(null);
          setIsLoadingUrl(false);
          return;
        }
        
        // Para visualização, SEMPRE usar arquivo_url (público)
        // Signed URLs forçam download, não servem para preview
        setSignedUrl(null);
      } catch (error) {
        console.error('Erro ao carregar documento:', error);
      } finally {
        setIsLoadingUrl(false);
      }
    };
    
    loadDocumentUrl();
  }, [documento, isOpen, user]);

  const registrarAcesso = async (tipoAcesso) => {
    if (!documento || !user) return;
    
    try {
      const { registrarAcessoDocumento } = await import('@/functions/registrarAcessoDocumento');
      await registrarAcessoDocumento({
        documento_id: documento.id,
        tipo_acesso: tipoAcesso
      });
    } catch (error) {
      console.error('Erro ao registrar acesso:', error);
    }
  };

  const handleDownload = async () => {
    if (!documento) return;

    setIsDownloading(true);
    try {
      // Registrar o download
      await registrarAcesso('download');

      if (documento.adicionar_marca_dagua) {
        // Chamar função backend para gerar PDF com marca d'água
        const { base44 } = await import('@/api/base44Client');
        
        const response = await base44.functions.invoke('downloadComMarcaDagua', { 
          documento_id: documento.id 
        });

        // A resposta já é um ArrayBuffer
        if (!response || !(response instanceof ArrayBuffer)) {
          throw new Error('Resposta inválida da função');
        }

        // Criar blob e fazer download
        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${documento.titulo}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else if (documento.arquivo_privado_uri) {
        // Arquivo privado - obter URL assinada para download
        const { obterUrlAssinadaDocumento } = await import('@/functions/obterUrlAssinadaDocumento');
        const result = await obterUrlAssinadaDocumento({ documento_id: documento.id });
        
        if (result.data?.file_url) {
          const link = document.createElement("a");
          link.href = result.data.file_url;
          link.download = `${documento.titulo}.pdf`;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          link.remove();
        } else {
          alert('Erro ao obter URL do documento');
        }
      } else {
        // Download normal de arquivo público
        const downloadUrl = documento.arquivo_url;

        if (!downloadUrl) {
          alert('URL do documento não disponível');
          return;
        }

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `${documento.titulo}.pdf`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      console.error("Erro no download:", error);
      alert(`Erro ao fazer download. Se o problema persistir, desative bloqueadores de anúncios ou extensões do navegador.\n\nDetalhes: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenInNewTab = async () => {
    // Se tem marca d'água, fazer download com marca d'água
    if (documento.adicionar_marca_dagua) {
      await handleDownload();
    } else {
      const url = signedUrl || documento.arquivo_url;
      if (url) {
        window.open(url, '_blank');
      }
    }
  };

  const displayUrl = signedUrl || documento?.arquivo_url;

  if (!documento) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-slate-900 mb-2">
                {documento.titulo}
              </DialogTitle>
              
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge variant="outline" className={`${categoriaConfig.color} border`}>
                  {categoriaConfig.label}
                </Badge>
                <Badge variant="outline" className={`${statusConfig.color} border`}>
                  {statusConfig.label}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(documento.data_publicacao), 'dd/MM/yyyy', { locale: pt })}
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <FileText className="w-4 h-4" />
                  v{documento.versao}
                </div>
              </div>

              {documento.descricao && (
                <p className="text-slate-600 text-sm mb-4">
                  {documento.descricao}
                </p>
              )}

              {/* Avisos de Segurança */}
              <div className="flex flex-wrap gap-2 mb-4">
                {documento.bloquear_download && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                    <Shield className="w-3 h-3 mr-1" />
                    Download Bloqueado
                  </Badge>
                )}
                {documento.adicionar_marca_dagua && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    <Shield className="w-3 h-3 mr-1" />
                    Download com Marca d'Água
                  </Badge>
                )}
                {(documento.nivel_confidencialidade === 'secreto' || documento.nivel_confidencialidade === 'confidencial') && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    <Shield className="w-3 h-3 mr-1" />
                    {documento.nivel_confidencialidade === 'secreto' ? 'SECRETO' : 'CONFIDENCIAL'}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span><strong>Aeroporto:</strong> {getAeroportoNome(documento.aeroporto)}</span>
                <span><strong>Criado por:</strong> {documento.created_by || 'Sistema'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              {!documento.bloquear_download && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    'Processando...'
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      {documento.adicionar_marca_dagua ? 'Download (c/ marca)' : 'Download'}
                    </>
                  )}
                </Button>
              )}
              {!documento.adicionar_marca_dagua && !documento.bloquear_download && (
                <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Nova Aba
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 p-6 pt-0">
          {isLoadingUrl ? (
            <div className="flex items-center justify-center h-full bg-slate-50 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">A carregar documento...</p>
              </div>
            </div>
          ) : documento.adicionar_marca_dagua ? (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg border-2 border-dashed border-blue-300">
              <div className="text-center p-8 max-w-md">
                <Shield className="w-20 h-20 mx-auto text-blue-600 mb-6" />
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Documento Confidencial
                </h3>
                <p className="text-slate-600 mb-4">
                  Este documento possui marca d'água de segurança e não pode ser visualizado diretamente no navegador.
                </p>
                <p className="text-slate-600 mb-6">
                  Clique no botão <strong>"Download (c/ marca)"</strong> acima para baixar o documento com a sua marca d'água personalizada.
                </p>
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">🔒 Segurança Aplicada:</p>
                  <p>O documento será marcado com o seu nome e data/hora de acesso.</p>
                </div>
              </div>
            </div>
          ) : documento.arquivo_url ? (
            <div className="w-full h-full rounded-lg overflow-hidden bg-slate-100">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(documento.arquivo_url)}&embedded=true`}
                className="w-full h-full border-0"
                style={{ minHeight: '600px' }}
                title="Visualizador de documento"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full bg-slate-50 rounded-lg">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  Documento não disponível
                </h3>
                <p className="text-slate-500">
                  O arquivo deste documento não está disponível para visualização.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}