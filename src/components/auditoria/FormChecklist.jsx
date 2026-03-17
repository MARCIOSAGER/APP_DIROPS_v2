import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  Send,
  FileText,
  Camera
} from 'lucide-react';

import { ItemAuditoria } from '@/entities/ItemAuditoria'; 
import { RespostaAuditoria } from '@/entities/RespostaAuditoria';
import { ProcessoAuditoria } from '@/entities/ProcessoAuditoria';
import { UploadFile } from '@/integrations/Core';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';

const SITUACAO_OPTIONS_KEYS = [
  { value: 'C', labelKey: 'formChecklist.conforme', icon: CheckCircle, color: 'text-green-600' },
  { value: 'NC', labelKey: 'formChecklist.naoConforme', icon: XCircle, color: 'text-red-600' },
  { value: 'N/A', labelKey: 'formChecklist.naoAplicavel', icon: AlertCircle, color: 'text-gray-600' }
];

export default function FormChecklist({
  isOpen,
  onClose,
  processo,
  onUpdate,
  currentUser
}) {
  const { t } = useI18n();
  const [itens, setItens] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [currentStep, setCurrentStep] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadChecklistData = useCallback(async () => {
    if (!processo) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
      // 1. Fetch checklist items - either selected ones or all for backward compatibility
      let fetchedItems;
      if (processo.itens_selecionados && processo.itens_selecionados.length > 0) {
        // Load only selected items
        const promises = processo.itens_selecionados.map(itemId => 
          ItemAuditoria.filter({ id: itemId })
        );
        const results = await Promise.all(promises);
        fetchedItems = results.flat();
      } else {
        // Backward compatibility: load all items for this audit type
        fetchedItems = await ItemAuditoria.filter({ tipo_auditoria_id: processo.tipo_auditoria_id }, 'ordem', 500);
      }
      
      const sortedItems = fetchedItems.sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
      setItens(sortedItems);

      // 2. Fetch existing answers for this specific audit process
      const fetchedRespostas = await RespostaAuditoria.filter({ processo_auditoria_id: processo.id });
      
      // 3. Create a map for quick lookup of answers by item ID
      const respostasMap = new Map(fetchedRespostas.map(r => [r.item_auditoria_id, r]));

      // 4. Initialize responses state, loading existing data where available
      const respostasIniciais = {};
      sortedItems.forEach(item => {
        const savedResposta = respostasMap.get(item.id);
        if (savedResposta) {
          // If an answer exists, use it
          respostasIniciais[item.id] = {
            id: savedResposta.id, // Crucial for updates
            situacao_encontrada: savedResposta.situacao_encontrada || '',
            observacao: savedResposta.observacao || '',
            evidencias: savedResposta.evidencias || [],
            acao_corretiva_recomendada: savedResposta.acao_corretiva_recomendada || '',
            prazo_correcao: savedResposta.prazo_correcao || '',
            responsavel_correcao: savedResposta.responsavel_correcao || ''
          };
        } else {
          // If no answer exists, use the default empty state
          respostasIniciais[item.id] = {
            situacao_encontrada: '',
            observacao: '',
            evidencias: []
          };
        }
      });

      setRespostas(respostasIniciais);
      setCurrentStep(0);
    } catch (error) {
      console.error("Erro ao carregar dados do checklist:", error);
      setMessage({ type: 'error', text: t('formChecklist.erroCarregar') });
    } finally {
      setIsLoading(false);
    }
  }, [processo]);

  useEffect(() => {
    if (isOpen) {
      loadChecklistData();
    } else {
      // Reset state when dialog closes
      setItens([]);
      setRespostas({});
      setCurrentStep(0);
      setMessage({ type: '', text: '' });
      setIsLoading(true); // Reset isLoading for next open
    }
  }, [isOpen, loadChecklistData]);

  const handleRespostaChange = (itemId, field, value) => {
    setRespostas(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleFileUpload = async (itemId, event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      const uploadPromises = files.map(file => UploadFile({ file }));
      const uploadResults = await Promise.all(uploadPromises);
      const fileUrls = uploadResults.map(result => result.file_url);

      setRespostas(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          evidencias: [...(prev[itemId].evidencias || []), ...fileUrls]
        }
      }));
    } catch (error) {
      console.error('Erro no upload:', error);
      setMessage({
        type: 'error',
        text: t('formChecklist.erroUpload')
      });
    }
  };

  const handleSave = async (finalizar = false) => {
    if (finalizar) {
      // Validar mínimo 80% respondidos
      if (!podeFinializar) {
        const minimo = Math.floor(itens.length * 0.8);
        setMessage({ type: 'error', text: `É necessário responder pelo menos ${minimo} de ${itens.length} itens (80%) para finalizar a auditoria. Respondidos: ${totalRespondidas}.` });
        return;
      }
      // Validar que itens NC possuem observação
      const ncSemObs = Object.entries(respostas).filter(
        ([_, r]) => r.situacao_encontrada === 'NC' && !r.observacao?.trim()
      );
      if (ncSemObs.length > 0) {
        setMessage({ type: 'error', text: `${ncSemObs.length} item(ns) Não Conforme(s) sem observação. Preencha as observações de todos os itens NC antes de finalizar.` });
        return;
      }
    }

    guardedSubmit(async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const promises = [];
      Object.entries(respostas).forEach(([itemId, resposta]) => {
        if (resposta.situacao_encontrada) { // Only save if it has been answered
          const payload = {
            processo_auditoria_id: processo.id,
            item_auditoria_id: itemId,
            situacao_encontrada: resposta.situacao_encontrada,
            observacao: resposta.observacao,
            evidencias: resposta.evidencias,
            acao_corretiva_recomendada: resposta.acao_corretiva_recomendada,
            prazo_correcao: resposta.prazo_correcao,
            responsavel_correcao: resposta.responsavel_correcao,
          };
          
          if (resposta.id) { // If it has an ID, it's an existing answer -> UPDATE
            promises.push(RespostaAuditoria.update(resposta.id, payload));
          } else { // No ID means it's a new answer -> CREATE
            promises.push(RespostaAuditoria.create(payload));
          }
        }
      });
      
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      if (finalizar) {
        // Calculate statistics based on the current state of ALL responses
        const respostasArray = Object.values(respostas);
        const total_itens = itens.length;
        const itens_conformes = respostasArray.filter(r => r.situacao_encontrada === 'C').length;
        const itens_nao_aplicaveis = respostasArray.filter(r => r.situacao_encontrada === 'N/A').length;
        const itens_nao_conformes_calc = respostasArray.filter(r => r.situacao_encontrada === 'NC').length;

        // Calculate conformity percentage based on applicable items
        const totalItensAvaliados = total_itens - itens_nao_aplicaveis;
        const percentual_conformidade = totalItensAvaliados > 0 ? (itens_conformes / totalItensAvaliados) * 100 : 100;

        // Update process status and statistics in the database
        await ProcessoAuditoria.update(processo.id, {
          status: 'concluida',
          total_itens: total_itens,
          itens_conformes: itens_conformes,
          itens_nao_conformes: itens_nao_conformes_calc,
          itens_nao_aplicaveis: itens_nao_aplicaveis,
          percentual_conformidade: percentual_conformidade
        });

        // Criar Solicitações de Serviço (SS) para itens não conformes
        const { SolicitacaoServico } = await import('@/entities/SolicitacaoServico');
        const itensNC = Object.entries(respostas).filter(([_, r]) => r.situacao_encontrada === 'NC');

        for (const [itemId] of itensNC) {
          const item = itens.find(i => i.id === itemId);
          if (item) {
            const resp = respostas[itemId];
            const numeroSS = `SS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;

            await SolicitacaoServico.create({
              numero_ss: numeroSS,
              titulo: `Não conformidade (Auditoria): ${item.item}`,
              descricao: `Item não conforme identificado durante auditoria.\n\nObservações: ${resp.observacao || 'Sem observações adicionais.'}`,
              aeroporto_id: processo.aeroporto_id || null,
              empresa_id: currentUser?.empresa_id || null,
              origem: 'inspecao',
              status: 'aberta',
              prioridade_sugerida: itens_nao_conformes_calc > 5 ? 'alta' : 'media',
              solicitante_id: currentUser?.id || null,
              solicitante_nome: currentUser?.full_name || null,
              solicitante_email: currentUser?.email || null,
            });
          }
        }

        setMessage({ type: 'success', text: `Auditoria finalizada com sucesso!${itensNC.length > 0 ? ` ${itensNC.length} SS criada(s) na Manutenção.` : ''}` });

        setTimeout(() => {
          onUpdate();
          onClose();
        }, 2000);
      } else {
        // Just save progress and ensure status is 'em_andamento'
        if (processo.status === 'planejada') {
            await ProcessoAuditoria.update(processo.id, { status: 'em_andamento' });
        }
        setMessage({ type: 'success', text: t('formChecklist.progressoSalvo') });
        
        // Don't close the dialog, just reload data to get IDs for new answers
        await loadChecklistData();
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({
        type: 'error',
        text: t('formChecklist.erroSalvar')
      });
    } finally {
      setIsSaving(false);
    }
    });
  };

  const currentItem = itens[currentStep];
  const currentResposta = currentItem ? respostas[currentItem.id] : {};
  const totalRespondidas = Object.values(respostas).filter(r => r.situacao_encontrada).length;
  const progressoPercentual = itens.length > 0 ? (totalRespondidas / itens.length) * 100 : 0;
  
  // Determine if we can finalize (at least 80% of items answered)
  const podeFinializar = totalRespondidas >= Math.floor(itens.length * 0.8);

  if (!isOpen || !processo) return null; // Adjusted condition

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {t('formChecklist.titulo')} - {processo?.tipoAuditoria?.nome || 'N/A'}
          </DialogTitle>
        </DialogHeader>

        {message.text && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}
            className={message.type === 'success' ? 'bg-green-50 border-green-200' : ''}>
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : ''}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">{t('formChecklist.carregando')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progresso */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{t('formChecklist.progressoAuditoria')}</span>
                  <span className="text-sm text-slate-600">
                    {totalRespondidas} {t('formChecklist.de')} {itens.length} {t('formChecklist.itens')}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressoPercentual}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {progressoPercentual.toFixed(0)}% {t('formChecklist.concluido')}
                </p>
              </CardContent>
            </Card>

            {/* Navegação de Itens */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
              >
                {t('formChecklist.anterior')}
              </Button>
              <span className="text-sm text-slate-600">
                Item {currentStep + 1} {t('formChecklist.de')} {itens.length}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.min(itens.length - 1, currentStep + 1))}
                disabled={currentStep === itens.length - 1}
              >
                {t('formChecklist.proximo')}
              </Button>
            </div>

            {/* Item Atual */}
            {currentItem && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline">Item {currentItem.numero}</Badge>
                    <span className="text-lg">{currentItem.item}</span>
                  </CardTitle>
                  <p className="text-slate-600 text-sm">{currentItem.referencia_norma}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Exemplo de Situação */}
                  {currentItem.exemplo_situacao && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">{t('formChecklist.orientacoes')}</h4>
                      <p className="text-blue-800 text-sm">{currentItem.exemplo_situacao}</p>
                    </div>
                  )}

                  {/* Situação Encontrada */}
                  <div className="space-y-2">
                    <Label>{t('formChecklist.situacaoEncontrada')}</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {SITUACAO_OPTIONS_KEYS.map((opcao) => {
                        const Icon = opcao.icon;
                        const isSelected = currentResposta.situacao_encontrada === opcao.value;

                        return (
                          <Button
                            key={opcao.value}
                            variant={isSelected ? "default" : "outline"}
                            className={`h-auto p-4 flex flex-col gap-2 ${
                              isSelected ? '' : 'hover:bg-slate-50'
                            }`}
                            onClick={() => handleRespostaChange(currentItem.id, 'situacao_encontrada', opcao.value)}
                          >
                            <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : opcao.color}`} />
                            <span className="text-sm">{t(opcao.labelKey)}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Observação */}
                  <div className="space-y-2">
                    <Label>{t('formChecklist.observacao')} {currentResposta.situacao_encontrada === 'NC' ? '*' : ''}</Label>
                    <Textarea
                      placeholder={t('formChecklist.observacaoPlaceholder')}
                      value={currentResposta.observacao || ''}
                      onChange={(e) => handleRespostaChange(currentItem.id, 'observacao', e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Evidências */}
                  <div className="space-y-2">
                    <Label>{t('formChecklist.evidencias')}</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <div className="text-center">
                        <Camera className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <label htmlFor={`file-upload-${currentItem.id}`} className="cursor-pointer">
                          <span className="text-sm font-medium text-gray-900">
                            {t('formChecklist.cliqueAdicionar')}
                          </span>
                          <input
                            id={`file-upload-${currentItem.id}`}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                            className="sr-only"
                            onChange={(e) => handleFileUpload(currentItem.id, e)}
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF, DOC até 10MB cada</p>
                      </div>
                    </div>

                    {currentResposta.evidencias && currentResposta.evidencias.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                        {currentResposta.evidencias.map((evidencia, index) => (
                          <div key={index} className="relative group">
                            {evidencia.includes('image') || evidencia.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                              <img
                                src={evidencia}
                                alt={`Evidência ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75"
                                onClick={() => window.open(evidencia, '_blank')}
                              />
                            ) : (
                              <div
                                className="w-full h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-200"
                                onClick={() => window.open(evidencia, '_blank')}
                              >
                                <FileText className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const novasEvidencias = currentResposta.evidencias.filter((_, i) => i !== index);
                                handleRespostaChange(currentItem.id, 'evidencias', novasEvidencias);
                              }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Aviso NC → SS */}
                  {currentResposta.situacao_encontrada === 'NC' && (
                    <div className="space-y-2">
                      <div className="p-3 border-l-4 border-red-500 bg-red-50 rounded">
                        <p className="text-sm text-red-700 font-medium">⚠ {t('formChecklist.avisoSS')}</p>
                      </div>
                      {!currentResposta.observacao?.trim() && (
                        <div className="p-2 bg-amber-50 border border-amber-300 rounded">
                          <p className="text-sm text-amber-700 font-medium">⚠ {t('formChecklist.obsObrigatoria')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ações */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                {t('formChecklist.cancelar')}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? t('formChecklist.salvando') : t('formChecklist.salvarProgresso')}
                </Button>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    onClick={() => handleSave(true)}
                    disabled={isSaving || !podeFinializar}
                    title={!podeFinializar ? `Responda pelo menos ${Math.floor(itens.length * 0.8)} itens para finalizar` : ''}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {t('formChecklist.finalizarAuditoria')}
                  </Button>
                  {!podeFinializar && (
                    <p className="text-red-500 text-xs">
                      Mínimo {Math.floor(itens.length * 0.8)} de {itens.length} itens respondidos para finalizar
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}