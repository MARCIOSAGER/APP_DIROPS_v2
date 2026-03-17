
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Calendar,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Mail,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import { RespostaAuditoria } from '@/entities/RespostaAuditoria';
import { ItemAuditoria } from '@/entities/ItemAuditoria';
import { PlanoAcaoCorretiva } from '@/entities/PlanoAcaoCorretiva';
import { Empresa } from '@/entities/Empresa';
import { SendEmail } from '@/integrations/Core';
import { exportAuditoriaPdf } from '@/functions/exportAuditoriaPdf';
import { getEmpresaLogoByAeroporto } from '@/components/lib/userUtils';
import AlertModal from '../shared/AlertModal';
import FormPAC from './FormPAC';
import { Alert, AlertDescription } from '@/components/ui/alert';

const STATUS_CONFIG = {
  planejada: { label: 'Planejada', color: 'bg-gray-100 text-gray-800' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-800' }
};

const SITUACAO_CONFIG = {
  'C': { label: 'Conforme', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'NC': { label: 'Não Conforme', color: 'bg-red-100 text-red-800', icon: XCircle },
  'N/A': { label: 'Não Aplicável', color: 'bg-gray-100 text-gray-800', icon: AlertCircle }
};

export default function AuditoriaDetailModal({
  isOpen,
  onClose,
  processo,
  tipo,
  aeroporto,
}) {
  const [respostas, setRespostas] = useState([]);
  const [itens, setItens] = useState([]);
  const [pacs, setPacs] = useState([]);
  const [_isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [deletePacInfo, setDeletePacInfo] = useState({ isOpen: false, id: null });
  const [editingPac, setEditingPac] = useState(null);
  const [isPacFormOpen, setIsPacFormOpen] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [empresas, setEmpresas] = useState([]);

  useEffect(() => {
    if (processo && isOpen) {
      loadAuditoriaDetails();
      Empresa.list().then(data => setEmpresas(data || [])).catch(() => setEmpresas([]));
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [processo, isOpen]);

  const loadAuditoriaDetails = async () => {
    setIsLoading(true);
    try {
      const [respostasData, itensData, pacsData] = await Promise.all([
        RespostaAuditoria.filter({ processo_auditoria_id: processo.id }),
        ItemAuditoria.filter({ tipo_auditoria_id: processo.tipo_auditoria_id }),
        PlanoAcaoCorretiva.filter({ processo_auditoria_id: processo.id })
      ]);

      setRespostas(respostasData);
      setItens(itensData);
      setPacs(pacsData);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      setErrorMessage('Erro ao carregar os detalhes da auditoria.');
    } finally {
      setIsLoading(false);
    }
  };

  const statusConfig = STATUS_CONFIG[processo?.status];
  const naoConformidades = respostas
    .filter(r => r.situacao_encontrada === 'NC')
    .map(resposta => {
        const itemData = itens.find(i => i.id === resposta.item_auditoria_id);
        return {
            ...resposta,
            item: itemData,
        };
    });

  const handleExportPDF = async () => {
    setIsExporting(true);
    setErrorMessage('');
    try {
      const response = await exportAuditoriaPdf({
        processo,
        respostas,
        itens,
        aeroporto,
        tipo,
        pacs
      });

      if (response.data) {
        const blob = new Blob([response.data], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria_${processo.id}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error(response.error || 'Resposta inválida do servidor');
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      setErrorMessage(`Erro ao exportar: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      setErrorMessage('Por favor, insira um email válido.');
      return;
    }

    setIsSendingEmail(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const emailLogoUrl = getEmpresaLogoByAeroporto(aeroporto?.codigo_icao || aeroporto?.id, aeroporto ? [aeroporto] : [], empresas);
      await SendEmail({
        to: emailAddress,
        subject: `Relatório de Auditoria DIROPS - ${tipo?.nome || 'N/A'} - ${aeroporto?.nome || 'N/A'}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #004A99; color: white; padding: 20px; text-align: center;">
              <img src="${emailLogoUrl}" alt="DIROPS" style="max-width: 150px; height: auto; margin-bottom: 10px;">
              <h1 style="margin: 0; font-size: 24px;">DIROPS</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Sistema de Gestão Aeroportuária</p>
            </div>
            
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #004A99; margin-top: 0;">Relatório de Auditoria Interna</h2>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #009FE3;">
                <h3 style="color: #004A99; margin-top: 0;">Informações da Auditoria</h3>
                <p><strong>Aeroporto:</strong> ${aeroporto?.nome || 'N/A'}</p>
                <p><strong>Tipo:</strong> ${tipo?.nome || 'N/A'}</p>
                <p><strong>Data:</strong> ${processo?.data_auditoria ? format(new Date(processo.data_auditoria), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}</p>
                <p><strong>Auditor Responsável:</strong> ${processo?.auditor_responsavel || 'N/A'}</p>
                <p><strong>Status:</strong> ${processo?.status || 'N/A'}</p>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #004A99; margin-top: 0;">Resumo dos Resultados</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                  <div style="text-align: center; padding: 15px; background: #f0f9ff; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: #004A99;">${processo?.total_itens || 0}</div>
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Total de Itens</div>
                  </div>
                  <div style="text-align: center; padding: 15px; background: #f0fdf4; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${processo?.itens_conformes || 0}</div>
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Conformes</div>
                  </div>
                  <div style="text-align: center; padding: 15px; background: #fef2f2; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${naoConformidades.length}</div>
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Não Conformes</div>
                  </div>
                  <div style="text-align: center; padding: 15px; background: #eff6ff; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${(processo?.percentual_conformidade || 0).toFixed(1)}%</div>
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Conformidade</div>
                  </div>
                </div>
              </div>
              
              ${naoConformidades.length > 0 ? `
              <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
                <h3 style="color: #dc2626; margin-top: 0;">Não Conformidades Identificadas</h3>
                <p style="color: #64748b; margin-bottom: 15px;">Foram identificadas ${naoConformidades.length} não conformidade(s) que requerem ação corretiva:</p>
                ${naoConformidades.slice(0, 3).map((nc, _index) => `
                  <div style="margin-bottom: 15px; padding: 15px; background: #fef2f2; border-radius: 6px;">
                    <div style="font-weight: bold; color: #dc2626; margin-bottom: 5px;">Item ${nc.item?.numero || 'N/A'}</div>
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">${nc.item?.item || 'N/A'}</div>
                    <div style="font-size: 13px; color: #7f1d1d;">${nc.observacao || 'N/A'}</div>
                  </div>
                `).join('')}
                ${naoConformidades.length > 3 ? `<p style="color: #64748b; font-style: italic;">... e mais ${naoConformidades.length - 3} não conformidade(s).</p>` : ''}
              </div>
              ` : `
              <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #16a34a;">
                <h3 style="color: #16a34a; margin-top: 0;">✓ Auditoria em Conformidade</h3>
                <p style="color: #64748b;">Parabéns! Esta auditoria não apresentou não conformidades, estando em total conformidade com os requisitos avaliados.</p>
              </div>
              `}
              
              ${pacs && pacs.length > 0 ? `
              <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0ea5e9;">
                <h3 style="color: #0ea5e9; margin-top: 0;">Planos de Ação Corretiva (PAC)</h3>
                <p style="color: #64748b; margin-bottom: 15px;">Foram criados ${pacs.length} PAC(s) para tratar as não conformidades:</p>
                ${pacs.map(pac => `
                  <div style="margin-bottom: 15px; padding: 15px; background: #f0f9ff; border-radius: 6px;">
                    <div style="font-weight: bold; color: #0ea5e9; margin-bottom: 5px;">${pac.numero_pac} - ${pac.tipo === 'formal_anac' ? 'Formal ANAC' : 'Interno'}</div>
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Responsável: ${pac.responsavel_elaboracao}</div>
                    <div style="font-size: 13px; color: #0c4a6e;">Prazo: ${pac.prazo_conclusao ? new Date(pac.prazo_conclusao).toLocaleDateString('pt-BR') : 'N/A'} | Progresso: ${(pac.percentual_conclusao || 0).toFixed(1)}%</div>
                  </div>
                `).join('')}
              </div>
              ` : ''}
              
              <div style="background: #004A99; color: white; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 14px;">Este relatório foi gerado automaticamente pelo Sistema DIROPS</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Direcção de Operações - Sistema de Gestão Aeroportuária</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>
        `
      });
      setSuccessMessage('Email enviado com sucesso!');
      setShowEmailModal(false);
      setEmailAddress('');
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      setErrorMessage('Erro ao enviar email. Tente novamente.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleEditPac = (pac) => {
    setEditingPac(pac);
    setIsPacFormOpen(true);
  };

  const handleDeletePacClick = (id) => {
    setDeletePacInfo({ isOpen: true, id });
  };

  const handleDeletePacConfirm = async () => {
    if (deletePacInfo.id) {
      try {
        await PlanoAcaoCorretiva.delete(deletePacInfo.id);
        setSuccessMessage('PAC excluído com sucesso!');
        loadAuditoriaDetails();
      } catch (error) {
        console.error('Erro ao excluir PAC:', error);
        setErrorMessage('Erro ao excluir PAC. Tente novamente.');
      } finally {
        setDeletePacInfo({ isOpen: false, id: null });
      }
    }
  };

  const handlePacFormClose = () => {
    setIsPacFormOpen(false);
    setEditingPac(null);
    loadAuditoriaDetails();
  };

  if (!processo) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Detalhes da Auditoria - {tipo?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert className="bg-green-50 border-green-200">
                 <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
              </Alert>
            )}

            {/* Informações Gerais */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Informações Gerais</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPDF}
                      disabled={isExporting}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      {isExporting ? 'Gerando...' : 'Exportar'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailModal(true)}
                      disabled={isSendingEmail}
                    >
                      <Mail className="w-4 h-4 mr-1" />
                      Email
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Aeroporto</p>
                      <p className="font-medium">{aeroporto?.nome}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Data</p>
                      <p className="font-medium">
                        {processo.data_auditoria ? format(new Date(processo.data_auditoria), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}
                      </p>
                  </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Auditor</p>
                      <p className="font-medium">{processo.auditor_responsavel}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Status</p>
                    <Badge className={statusConfig?.color}>
                      {statusConfig?.label}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Itens</p>
                      <p className="text-2xl font-bold">{processo.total_itens || 0}</p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Conformes</p>
                      <p className="text-2xl font-bold text-green-600">
                        {processo.itens_conformes || 0}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Não Conformes</p>
                      <p className="text-2xl font-bold text-red-600">
                        {naoConformidades.length}
                      </p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Conformidade</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {processo.percentual_conformidade?.toFixed(1) || '0.0'}%
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-xs font-bold">%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="respostas" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="respostas">Respostas da Auditoria</TabsTrigger>
                <TabsTrigger value="nao-conformidades">
                  Não Conformidades ({naoConformidades.length})
                </TabsTrigger>
                <TabsTrigger value="pac">
                  PAC ({pacs.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="respostas" className="space-y-4">
                {respostas.map((resposta) => {
                  const item = itens.find(i => i.id === resposta.item_auditoria_id);
                  const situacaoConfig = SITUACAO_CONFIG[resposta.situacao_encontrada];
                  const Icon = situacaoConfig?.icon || AlertCircle;

                  return (
                    <Card key={resposta.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <Icon className={`w-6 h-6 ${
                              resposta.situacao_encontrada === 'C' ? 'text-green-600' :
                              resposta.situacao_encontrada === 'NC' ? 'text-red-600' : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium text-slate-900">
                                  Item {item?.numero}: {item?.item}
                                </h4>
                                <p className="text-sm text-slate-500 mt-1">
                                  {item?.referencia_norma}
                                </p>
                              </div>
                              <Badge className={situacaoConfig?.color}>
                                {situacaoConfig?.label}
                              </Badge>
                            </div>
                            {resposta.observacao && (
                              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                <p className="text-sm text-slate-700">{resposta.observacao}</p>
                              </div>
                            )}
                            {resposta.evidencias && resposta.evidencias.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-medium text-slate-700 mb-2">Evidências:</p>
                                <div className="flex flex-wrap gap-2">
                                  {resposta.evidencias.map((evidencia, index) => (
                                    <Button
                                      key={index}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(evidencia, '_blank')}
                                    >
                                      <FileText className="w-4 h-4 mr-1" />
                                      Evidência {index + 1}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="nao-conformidades" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Não Conformidades Identificadas</h3>
                  {naoConformidades.length > 0 && pacs.length === 0 && (
                    <Button onClick={() => setIsPacFormOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar PAC
                    </Button>
                  )}
                </div>

                {naoConformidades.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                      <h3 className="text-lg font-semibold text-green-700 mb-2">
                        Parabéns! Nenhuma não conformidade identificada.
                      </h3>
                      <p className="text-slate-500">
                        Esta auditoria está em total conformidade com os requisitos.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  naoConformidades.map((resposta) => {
                    const item = resposta.item;

                    return (
                      <Card key={resposta.id} className="border-red-200">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                              <h4 className="font-medium text-slate-900 mb-2">
                                Item {item?.numero}: {item?.item}
                              </h4>
                              <p className="text-sm text-slate-500 mb-3">
                                {item?.referencia_norma}
                              </p>
                              <div className="bg-red-50 p-3 rounded-lg">
                                <p className="text-sm text-red-800">{resposta.observacao}</p>
                              </div>
                              {resposta.acao_corretiva_recomendada && (
                                <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                                  <p className="text-sm font-medium text-blue-800 mb-1">
                                    Ação Corretiva Recomendada:
                                  </p>
                                  <p className="text-sm text-blue-700">
                                    {resposta.acao_corretiva_recomendada}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="pac" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Planos de Ação Corretiva</h3>
                </div>

                {pacs.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        Nenhum PAC criado
                      </h3>
                      <p className="text-slate-500">
                        {naoConformidades.length > 0
                          ? 'Crie um Plano de Ação Corretiva para as não conformidades identificadas.'
                          : 'Não há não conformidades que necessitem de PAC.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  pacs.map((pac) => (
                    <Card key={pac.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                              <CardTitle>{pac.numero_pac}</CardTitle>
                              <p className="text-sm text-slate-500 capitalize">Tipo: {pac.tipo.replace('_', ' ')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                              <Badge variant={pac.status === 'elaboracao' ? 'secondary' : 'default'} className="capitalize">{pac.status.replace('_', ' ')}</Badge>
                              <Button variant="ghost" size="icon" onClick={() => handleEditPac(pac)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-600 hover:text-red-700 hover:bg-red-50" 
                                onClick={() => handleDeletePacClick(pac.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Responsável:</span>
                            <p className="font-medium">{pac.responsavel_elaboracao}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Prazo:</span>
                            <p className="font-medium">
                              {format(new Date(pac.prazo_conclusao), 'dd/MM/yyyy', { locale: pt })}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Progresso:</span>
                            <p className="font-medium">{pac.percentual_conclusao?.toFixed(0) || 0}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal personalizado para email */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle>Enviar Relatório por Email</DialogTitle>
                <p className="text-sm text-slate-500 mt-1">Sistema DIROPS</p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email de destino</Label>
              <Input
                id="email"
                type="email"
                placeholder="exemplo@empresa.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={isSendingEmail || !emailAddress || !emailAddress.includes('@')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSendingEmail ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={deletePacInfo.isOpen}
        onClose={() => setDeletePacInfo({ isOpen: false, id: null })}
        onConfirm={handleDeletePacConfirm}
        title="Confirmar Exclusão do PAC"
        message="Tem a certeza que deseja excluir este Plano de Ação Corretiva? Esta ação é irreversível."
        type="warning"
        confirmText="Excluir"
        showCancel
      />
      {isPacFormOpen && (
        <FormPAC
          isOpen={isPacFormOpen}
          onClose={handlePacFormClose}
          processoAuditoria={processo}
          aeroporto={aeroporto}
          naoConformidades={naoConformidades}
          pacInicial={editingPac}
        />
      )}
    </>
  );
}
