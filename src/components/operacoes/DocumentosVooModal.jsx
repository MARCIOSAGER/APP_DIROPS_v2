import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Download, Eye, Upload, RefreshCw, Calendar, User, FolderOpen, Mail, Trash2 } from 'lucide-react';
import { Documento } from '@/entities/Documento';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import AlertModal from '@/components/shared/AlertModal';
import SuccessModal from '@/components/shared/SuccessModal';
import SendEmailModal from '@/components/shared/SendEmailModal';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/components/lib/i18n';

export default function DocumentosVooModal({ isOpen, onClose, vooLigado, voos, onOpenUploadModal, currentUser }) {
  const { t } = useI18n();
  const [documentos, setDocumentos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [documentoParaEmail, setDocumentoParaEmail] = useState(null);

  const arrVoo = voos.find(v => v.id === vooLigado?.id_voo_arr);
  const depVoo = voos.find(v => v.id === vooLigado?.id_voo_dep);

  useEffect(() => {
    if (isOpen && vooLigado) {
      loadDocumentos();
    }
  }, [isOpen, vooLigado]);

  useEffect(() => {
    if (isOpen && vooLigado) {
      const timer = setTimeout(() => {
        loadDocumentos();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const loadDocumentos = async () => {
    setIsLoading(true);
    try {
      const allDocumentos = await Documento.list('-data_publicacao');
      const filteredDocs = allDocumentos.filter(doc => doc.voo_ligado_id === vooLigado.id);
      setDocumentos(filteredDocs);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (doc) => {
    window.open(doc.arquivo_url, '_blank');
  };

  const handleView = (doc) => {
    window.open(doc.arquivo_url, '_blank');
  };

  const handleDelete = (doc) => {
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: t('docVoo.excluirDocumento'),
      message: `${t('docVoo.confirmarExcluir')} "${doc.titulo}"? ${t('docVoo.acaoIrreversivel')}`,
      showCancel: true,
      confirmText: 'Excluir',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          await Documento.delete(doc.id);
          loadDocumentos();
          setSuccessInfo({
            isOpen: true,
            title: t('docVoo.documentoExcluido'),
            message: `"${doc.titulo}" ${t('docVoo.documentoExcluidoMsg')}`
          });
        } catch (error) {
          console.error('Erro ao excluir documento:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: t('docVoo.erroExcluir'),
            message: t('docVoo.erroExcluirMsg')
          });
        }
      }
    });
  };

  const handleSendEmail = (doc) => {
    setDocumentoParaEmail(doc);
    setIsEmailModalOpen(true);
  };

  const getErrorMessage = (error) => {
    if (!error) return 'Erro desconhecido';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.error) return error.error;
    if (error.details) return error.details;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  };

  const handleConfirmSendEmail = async (emailData) => {
    try {
      const emailBody = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #004A99; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
              .section { background: white; padding: 15px; margin-bottom: 15px; border-radius: 6px; border-left: 4px solid #004A99; }
              .label { font-weight: bold; color: #495057; }
              .value { color: #212529; }
              .footer { text-align: center; padding: 15px; color: #6c757d; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; }
              td { padding: 8px 0; }
              .download-btn { display: inline-block; background: #004A99; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin: 0;">📄 ${documentoParaEmail.titulo}</h2>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Sistema DIROPS</p>
              </div>
              
              <div class="content">
                ${emailData.message ? `
                <div class="section">
                  <p>${emailData.message.replace(/\n/g, '<br>')}</p>
                </div>
                ` : ''}

                <div class="section">
                  <h3 style="margin-top: 0; color: #004A99;">✈️ Informações do Voo</h3>
                  <table>
                    <tr>
                      <td class="label">Voo ARR:</td>
                      <td class="value">${arrVoo.numero_voo}</td>
                    </tr>
                    <tr>
                      <td class="label">Voo DEP:</td>
                      <td class="value">${depVoo.numero_voo}</td>
                    </tr>
                    <tr>
                      <td class="label">Rota Completa:</td>
                      <td class="value">${arrVoo.aeroporto_origem_destino} → ${arrVoo.aeroporto_operacao} → ${depVoo.aeroporto_origem_destino}</td>
                    </tr>
                    <tr>
                      <td class="label">Companhia Aérea:</td>
                      <td class="value">${depVoo.companhia_aerea}</td>
                    </tr>
                    <tr>
                      <td class="label">Registo Aeronave:</td>
                      <td class="value">${depVoo.registo_aeronave}</td>
                    </tr>
                    <tr>
                      <td class="label">Tipo de Voo:</td>
                      <td class="value">${depVoo.tipo_voo || 'Regular'}</td>
                    </tr>
                    <tr>
                      <td class="label">Data Operação:</td>
                      <td class="value">${format(new Date(arrVoo.data_operacao), 'dd/MM/yyyy', { locale: pt })}</td>
                    </tr>
                  </table>
                </div>

                <div class="section" style="text-align: center;">
                  <p style="margin-bottom: 10px;"><strong>Documento:</strong> ${documentoParaEmail.titulo}</p>
                  <a href="${documentoParaEmail.arquivo_url}" class="download-btn" target="_blank">
                    📥 Ver/Download Documento
                  </a>
                </div>
              </div>
              
              <div class="footer">
                <p>Este é um email automático do sistema DIROPS.</p>
                <p>Data de envio: ${new Date().toLocaleString('pt-AO')}</p>
              </div>
            </div>
          </body>
        </html>
      `;

      await base44.integrations.Core.SendEmail({
        to: emailData.to,
        subject: emailData.subject,
        body: emailBody
      });
      
      setSuccessInfo({
        isOpen: true,
        title: t('docVoo.emailEnviado'),
        message: `"${documentoParaEmail.titulo}" ${t('docVoo.emailEnviadoMsg')}`
      });
      setIsEmailModalOpen(false);
      setDocumentoParaEmail(null);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('docVoo.erroEmail'),
        message: `${t('docVoo.erroEmailMsg')} ${getErrorMessage(error)}`
      });
    }
  };

  const getCategoriaLabel = (categoria) => {
    const labels = {
      'manual_operacoes': t('docVoo.manualOperacoes'),
      'procedimento': t('docVoo.procedimento'),
      'regulamentacao': t('docVoo.regulamentacao'),
      'formulario': t('docVoo.formulario'),
      'relatorio': t('docVoo.relatorio'),
      'outro': t('docVoo.outro')
    };
    return labels[categoria] || categoria;
  };

  if (!vooLigado || !arrVoo || !depVoo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {t('docVoo.documentos')} - {arrVoo.numero_voo} → {depVoo.numero_voo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-slate-900">
                {documentos.length} {documentos.length !== 1 ? t('docVoo.documentosEncontrados') : t('docVoo.documentoEncontrado')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDocumentos}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('docVoo.atualizar')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  if (onOpenUploadModal) {
                    onOpenUploadModal(vooLigado);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                {t('docVoo.carregarDocumento')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : documentos.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 font-medium mb-2">
                {t('docVoo.nenhumDocumento')}
              </p>
              <p className="text-sm text-slate-500 mb-4">
                {t('docVoo.carreguePeloBtn')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {documentos.map((doc) => {
                const isAdmin = currentUser?.role === 'admin' || currentUser?.perfis?.includes('administrador');
                const isOwner = doc.created_by === currentUser?.email;
                const canDelete = isAdmin || isOwner;

                return (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 mb-1">
                                {doc.titulo}
                              </h3>
                              {doc.descricao && (
                                <p className="text-sm text-slate-600 line-clamp-2">
                                  {doc.descricao}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="bg-slate-50">
                              {getCategoriaLabel(doc.categoria)}
                            </Badge>
                            {doc.versao && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                v{doc.versao}
                              </Badge>
                            )}
                            <Badge 
                              variant="outline" 
                              className={
                                doc.status === 'ativo' 
                                  ? 'bg-green-50 text-green-700'
                                  : doc.status === 'arquivado'
                                  ? 'bg-yellow-50 text-yellow-700'
                                  : 'bg-slate-50 text-slate-700'
                              }
                            >
                              {doc.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {doc.data_publicacao 
                                  ? format(new Date(doc.data_publicacao), "dd MMM yyyy", { locale: pt })
                                  : 'N/A'
                                }
                              </span>
                            </div>
                            {doc.created_by && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{doc.created_by}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleView(doc)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendEmail(doc)}
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(doc)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <AlertModal
          isOpen={alertInfo.isOpen}
          onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
          type={alertInfo.type}
          title={alertInfo.title}
          message={alertInfo.message}
          showCancel={alertInfo.showCancel}
          onConfirm={alertInfo.onConfirm}
          confirmText={alertInfo.confirmText}
        />

        <SuccessModal
          isOpen={successInfo.isOpen}
          onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
          title={successInfo.title}
          message={successInfo.message}
        />

        {documentoParaEmail && (
          <SendEmailModal
            isOpen={isEmailModalOpen}
            onClose={() => {
              setIsEmailModalOpen(false);
              setDocumentoParaEmail(null);
            }}
            onSend={handleConfirmSendEmail}
            defaultSubject={`Documento: ${documentoParaEmail.titulo}`}
            defaultBody={`Olá,\n\nEm anexo, o documento "${documentoParaEmail.titulo}" relacionado ao voo ${arrVoo.numero_voo} → ${depVoo.numero_voo}.`}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}