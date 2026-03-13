
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  Mail
} from 'lucide-react';

import { PlanoAcaoCorretiva } from '@/entities/PlanoAcaoCorretiva';
import { ItemPAC } from '@/entities/ItemPAC';
import { RespostaAuditoria } from '@/entities/RespostaAuditoria';
import { ItemAuditoria } from '@/entities/ItemAuditoria';
import { SendEmail } from '@/integrations/Core';

import { exportPacPdf } from '@/functions/exportPacPdf';

export default function FormPAC({
  isOpen,
  onClose,
  processoAuditoria,
  aeroporto,
  naoConformidades,
  pacInicial
}) {
  const [formData, setFormData] = useState({
    tipo: pacInicial?.tipo || 'interno',
    responsavel_elaboracao: pacInicial?.responsavel_elaboracao || '',
    prazo_conclusao: pacInicial?.prazo_conclusao || '',
    observacoes_gerais: pacInicial?.observacoes_gerais || '',
    status: pacInicial?.status || 'elaboracao'
  });
  const [itensPac, setItensPac] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generalMessage, setGeneralMessage] = useState({ type: '', text: '' });

  const [isExporting, setIsExporting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');

  // Função para calcular a data de conclusão automaticamente
  const calculateDataConclusao = (items) => {
    if (!items || items.length === 0) return '';

    const datas = items
      .map(item => item.prazo_implementacao)
      .filter(data => data && data !== '');

    if (datas.length === 0) return '';

    const ultimaData = datas.reduce((latest, current) => {
      const latestDate = new Date(latest);
      const currentDate = new Date(current);
      return currentDate > latestDate ? current : latest;
    });

    return ultimaData;
  };

  // Recalcular data de conclusão sempre que os itens mudarem
  useEffect(() => {
    if (pacInicial) return; // Don't auto-calculate in edit mode unless an item date changes
    const novaDataConclusao = calculateDataConclusao(itensPac);
    setFormData(prev => ({ ...prev, prazo_conclusao: novaDataConclusao }));
  }, [itensPac, pacInicial]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      let itemsForState = [];

      if (pacInicial) {
        // Edit mode: Load existing ItemPACs and enrich them with original NC details for display
        try {
          const existingItens = await ItemPAC.filter({ pac_id: pacInicial.id });

          // Determine 'vencida' status for existing items based on current date
          const today = new Date().toISOString().split('T')[0];
          const updatedExistingItens = existingItens.map(item => {
            if (item.status !== 'concluida' && item.prazo_implementacao && item.prazo_implementacao < today) {
              return { ...item, status: 'vencida' };
            }
            return item;
          });


          const respostaIds = updatedExistingItens.map(item => item.resposta_auditoria_id).filter(Boolean);
          const uniqueRespostaIds = [...new Set(respostaIds)];

          let allRespostas = [];
          if (uniqueRespostaIds.length > 0) {
            const fetchedRespostas = await RespostaAuditoria.list();
            allRespostas = fetchedRespostas.filter(r => uniqueRespostaIds.includes(r.id));
          }

          let allItemsAuditoria = [];
          const itemAuditoriaIds = allRespostas.map(r => r.item_auditoria_id).filter(Boolean);
          if (itemAuditoriaIds.length > 0) {
             const fetchedItemsAuditoria = await ItemAuditoria.list();
             allItemsAuditoria = fetchedItemsAuditoria.filter(ia => itemAuditoriaIds.includes(ia.id));
          }

          itemsForState = updatedExistingItens.map(itemPAC => {
            const resposta = allRespostas.find(r => r.id === itemPAC.resposta_auditoria_id);
            const itemAuditoria = allItemsAuditoria.find(ia => ia.id === resposta?.item_auditoria_id);
            return {
              ...itemPAC,
              original_nc: {
                observacao: resposta?.observacao,
                item: itemAuditoria,
              }
            };
          });
        } catch (error) {
          console.error('Erro ao carregar itens do PAC para edição:', error);
          setGeneralMessage({ type: 'error', text: 'Erro ao carregar os itens do PAC.' });
        }
      } else if (naoConformidades && naoConformidades.length > 0) {
        // Create mode: Initialize from naoConformidades prop
        itemsForState = naoConformidades.map((nc) => ({
          resposta_auditoria_id: nc.id,
          item_auditoria_id: nc.item_auditoria_id,
          descricao_nao_conformidade: nc.observacao,
          acao_corretiva_proposta: nc.acao_corretiva_recomendada || '',
          responsavel: nc.responsavel_correcao || '',
          prazo_implementacao: nc.prazo_correcao || '',
          categoria_prazo: 'medio',
          observacoes: '',
          status: 'pendente', // Default status for new items
          original_nc: {
            observacao: nc.observacao,
            item: nc.item,
          }
        }));
      }
      setItensPac(itemsForState);
      setIsLoading(false);
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, pacInicial, naoConformidades]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setItensPac(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setGeneralMessage({ type: '', text: '' });

    try {
      if (pacInicial) {
        // Edit Mode: Update PAC and its items
        const concluidas = itensPac.filter(item => item.status === 'concluida').length;
        const total = itensPac.length;
        const percentual = total > 0 ? (concluidas / total) * 100 : 0;

        const updatedPacData = {
            ...formData,
            nao_conformidades_concluidas: concluidas,
            percentual_conclusao: percentual,
            status: percentual === 100 ? 'concluido' : formData.status,
        };

        await PlanoAcaoCorretiva.update(pacInicial.id, updatedPacData);

        for (const item of itensPac) {
            // Only update items that are not automatically set to 'vencida'
            if (item.id && item.status !== 'vencida') {
                const { original_nc, ...itemToUpdate } = item;
                await ItemPAC.update(item.id, itemToUpdate);
            }
        }
        setGeneralMessage({ type: 'success', text: `PAC ${pacInicial.numero_pac} atualizado com sucesso!` });

      } else {
        // Create Mode
        const numero_pac = `PAC-${processoAuditoria.aeroporto_id}-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

        const pacData = {
          ...formData,
          processo_auditoria_id: processoAuditoria.id,
          aeroporto_id: processoAuditoria.aeroporto_id,
          numero_pac,
          data_criacao: new Date().toISOString(),
          total_nao_conformidades: itensPac.length,
          nao_conformidades_concluidas: 0,
          percentual_conclusao: 0
        };

        const novoPac = await PlanoAcaoCorretiva.create(pacData);

        const itensParaCriar = itensPac.map(item => ({
          ...item,
          pac_id: novoPac.id,
          original_nc: undefined,
        }));

        await ItemPAC.bulkCreate(itensParaCriar);

        setGeneralMessage({
          type: 'success',
          text: `PAC ${numero_pac} criado com sucesso!`
        });
      }

      setTimeout(() => {
        onClose(true);
      }, 2000);

    } catch (error) {
      console.error('Erro ao salvar PAC:', error);
      setGeneralMessage({
        type: 'error',
        text: `Erro ao ${pacInicial ? 'atualizar' : 'criar'} o PAC. Tente novamente.`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setGeneralMessage({ type: '', text: '' });
    try {
      const { data: htmlContent, error } = await exportPacPdf({
        pac: formData,
        itens: itensPac,
        aeroporto,
      });

      if (error) throw new Error(error);

      // Create a Blob from the HTML content
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);

      // Create a link to download it
      const a = document.createElement('a');
      a.href = url;
      a.download = `pac_${formData.numero_pac || 'rascunho'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Erro ao gerar PDF do PAC:', error);
      setGeneralMessage({ type: 'error', text: `Erro ao exportar PDF: ${error.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      setGeneralMessage({ type: 'error', text: 'Por favor, insira um email válido.' });
      return;
    }

    setIsSendingEmail(true);
    setGeneralMessage({ type: '', text: '' });

    try {
      const { data: htmlContent, error: pdfError } = await exportPacPdf({
        pac: formData,
        itens: itensPac,
        aeroporto,
      });

      if (pdfError) throw new Error(pdfError);

      await SendEmail({
        to: emailAddress,
        subject: `Plano de Ação Corretiva (PAC) - ${formData.numero_pac || 'Em Elaboração'}`,
        body: htmlContent
      });

      setGeneralMessage({ type: 'success', text: 'Email enviado com sucesso!' });
      setShowEmailModal(false);
      setEmailAddress('');
    } catch (error) {
      console.error("Erro ao enviar email do PAC:", error);
      setGeneralMessage({ type: 'error', text: `Erro ao enviar email: ${error.message}`});
    } finally {
      setIsSendingEmail(false);
    }
  };

  const tipoPacOptions = [
    { value: 'interno', label: 'Interno' },
    { value: 'formal_anac', label: 'Formal ANAC' },
  ];

  const statusOptions = [
    { value: 'elaboracao', label: 'Elaboração' },
    { value: 'submetido', label: 'Submetido' },
    { value: 'aprovado', label: 'Aprovado' },
    { value: 'em_execucao', label: 'Em Execução' },
    { value: 'concluido', label: 'Concluído' },
    { value: 'vencido', label: 'Vencido' },
  ];

  const categoriaPrazoOptions = [
    { value: 'curto', label: 'Curto Prazo' },
    { value: 'medio', label: 'Médio Prazo' },
    { value: 'longo', label: 'Longo Prazo' },
    { value: 'mitigadora', label: 'Mitigadora até Conformação' },
  ];

  const itemStatusOptions = [
      { value: 'pendente', label: 'Pendente' },
      { value: 'em_andamento', label: 'Em Andamento' },
      { value: 'concluida', label: 'Concluída' },
  ];

  if (!isOpen || (!processoAuditoria && !pacInicial)) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => onClose(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>{pacInicial ? 'Editar Plano de Ação Corretiva (PAC)' : 'Criar Plano de Ação Corretiva (PAC)'}</span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
                  <Download className="w-4 h-4 mr-1" />
                  {isExporting ? 'A gerar...' : 'PDF'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowEmailModal(true)} disabled={isSendingEmail}>
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {generalMessage.text && (
            <Alert variant={generalMessage.type === 'error' ? 'destructive' : 'default'}
                  className={generalMessage.type === 'success' ? 'bg-green-50 border-green-200' : ''}>
              <AlertDescription className={generalMessage.type === 'success' ? 'text-green-800' : ''}>
                {generalMessage.text}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Informações Gerais do PAC</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aeroporto</Label>
                    <Input value={aeroporto?.nome} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de PAC *</Label>
                    <Select
                      options={tipoPacOptions}
                      value={formData.tipo}
                      onValueChange={(value) => handleInputChange('tipo', value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Responsável pela Elaboração *</Label>
                    <Input
                      placeholder="Nome do responsável"
                      value={formData.responsavel_elaboracao}
                      onChange={(e) => handleInputChange('responsavel_elaboracao', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo de Conclusão *</Label>
                    <Input
                      type="date"
                      value={formData.prazo_conclusao}
                      disabled={true}
                      className="bg-gray-50 cursor-not-allowed"
                      title="Calculado automaticamente baseado na última data de implementação dos itens"
                    />
                    <p className="text-xs text-gray-500">
                      Calculado automaticamente baseado na última data de implementação dos itens
                    </p>
                  </div>
                </div>

                {pacInicial && (
                  <div className="space-y-2">
                    <Label>Status do PAC</Label>
                    <Select
                      options={statusOptions}
                      value={formData.status}
                      onValueChange={value => handleInputChange('status', value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Observações Gerais</Label>
                  <Textarea
                    placeholder="Observações gerais sobre o PAC..."
                    value={formData.observacoes_gerais}
                    onChange={(e) => handleInputChange('observacoes_gerais', e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Itens do PAC ({itensPac.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {itensPac.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                    <p className="text-slate-600">Não há não conformidades para criar PAC ou itens PAC para exibir.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {itensPac.map((itemPAC, index) => {
                      const originalNC = itemPAC.original_nc;

                      return (
                        <Card key={itemPAC.id || index} className={`border-2 ${itemPAC.status === 'vencida' ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Item {originalNC?.item?.numero}</Badge>
                                <span className="font-medium">{originalNC?.item?.item}</span>
                              </div>
                              <Badge className="bg-red-100 text-red-800">Não Conforme</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="bg-red-50 p-3 rounded-lg">
                              <p className="text-sm text-red-800">{originalNC?.observacao}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Ação Corretiva Proposta *</Label>
                                <Textarea
                                  placeholder="Descreva a ação corretiva..."
                                  value={itemPAC.acao_corretiva_proposta}
                                  onChange={(e) => handleItemChange(index, 'acao_corretiva_proposta', e.target.value)}
                                  rows={2}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Observações</Label>
                                <Textarea
                                  placeholder="Observações adicionais..."
                                  value={itemPAC.observacoes}
                                  onChange={(e) => handleItemChange(index, 'observacoes', e.target.value)}
                                  rows={2}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label>Responsável *</Label>
                                <Input
                                  placeholder="Nome do responsável"
                                  value={itemPAC.responsavel}
                                  onChange={(e) => handleItemChange(index, 'responsavel', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Prazo de Implementação *</Label>
                                <Input
                                  type="date"
                                  value={itemPAC.prazo_implementacao}
                                  onChange={(e) => handleItemChange(index, 'prazo_implementacao', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Categoria do Prazo</Label>
                                <Select
                                  options={categoriaPrazoOptions}
                                  value={itemPAC.categoria_prazo}
                                  onValueChange={(value) => handleItemChange(index, 'categoria_prazo', value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Status do Item</Label>
                                {itemPAC.status === 'vencida' ? (
                                  <Badge className="bg-red-200 text-red-900 text-sm py-1.5 px-3 w-full justify-center">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Vencido
                                  </Badge>
                                ) : (
                                  <Select
                                    options={itemStatusOptions}
                                    value={itemPAC.status}
                                    onValueChange={(value) => handleItemChange(index, 'status', value)}
                                  />
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onClose(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || (pacInicial ? false : itensPac.length === 0)}>
                {isLoading ? (pacInicial ? 'Atualizando PAC...' : 'Criando PAC...') : (pacInicial ? 'Atualizar PAC' : 'Criar PAC')}
              </Button>
            </DialogFooter>
          </form>
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
                <DialogTitle>Enviar PAC por Email</DialogTitle>
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
    </>
  );
}
