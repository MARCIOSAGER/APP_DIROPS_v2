import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

const SITUACAO_OPTIONS = [
  { value: 'C', label: 'Conforme', icon: CheckCircle, color: 'text-green-600' },
  { value: 'NC', label: 'Não Conforme', icon: XCircle, color: 'text-red-600' },
  { value: 'N/A', label: 'Não Aplicável', icon: AlertCircle, color: 'text-gray-600' }
];

export default function FormChecklist({
  isOpen,
  onClose,
  processo, 
  onUpdate 
}) {
  const [itens, setItens] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [isLoading, setIsLoading] = useState(true); 
  const [isSaving, setIsSaving] = useState(false);
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
            evidencias: [],
            acao_corretiva_recomendada: '',
            prazo_correcao: '',
            responsavel_correcao: ''
          };
        }
      });

      setRespostas(respostasIniciais);
      setCurrentStep(0);
    } catch (error) {
      console.error("Erro ao carregar dados do checklist:", error);
      setMessage({ type: 'error', text: 'Não foi possível carregar os dados do checklist.' });
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
        text: 'Erro ao fazer upload dos arquivos. Tente novamente.'
      });
    }
  };

  const handleSave = async (finalizar = false) => {
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

        setMessage({ type: 'success', text: 'Auditoria finalizada com sucesso!' });

        setTimeout(() => {
          onUpdate(); // Call the onUpdate callback to refresh the main page
          onClose();
        }, 2000);
      } else {
        // Just save progress and ensure status is 'em_andamento'
        if (processo.status === 'planejada') {
            await ProcessoAuditoria.update(processo.id, { status: 'em_andamento' });
        }
        setMessage({ type: 'success', text: 'Progresso salvo com sucesso! Pode continuar depois.' });
        
        // Don't close the dialog, just reload data to get IDs for new answers
        await loadChecklistData();
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({
        type: 'error',
        text: 'Erro ao salvar as respostas. Tente novamente.'
      });
    } finally {
      setIsSaving(false);
    }
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
            Checklist de Auditoria - {processo?.tipoAuditoria?.nome || 'N/A'}
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
            <p className="text-slate-600">Carregando checklist...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progresso */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progresso da Auditoria</span>
                  <span className="text-sm text-slate-600">
                    {totalRespondidas} de {itens.length} itens
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressoPercentual}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {progressoPercentual.toFixed(0)}% concluído
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
                Anterior
              </Button>
              <span className="text-sm text-slate-600">
                Item {currentStep + 1} de {itens.length}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.min(itens.length - 1, currentStep + 1))}
                disabled={currentStep === itens.length - 1}
              >
                Próximo
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
                      <h4 className="font-medium text-blue-900 mb-2">Orientações:</h4>
                      <p className="text-blue-800 text-sm">{currentItem.exemplo_situacao}</p>
                    </div>
                  )}

                  {/* Situação Encontrada */}
                  <div className="space-y-2">
                    <Label>Situação Encontrada *</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {SITUACAO_OPTIONS.map((opcao) => {
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
                            <span className="text-sm">{opcao.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Observação */}
                  <div className="space-y-2">
                    <Label>Observação {currentResposta.situacao_encontrada === 'NC' ? '*' : ''}</Label>
                    <Textarea
                      placeholder="Descreva a situação encontrada, evidências observadas ou justificativa..."
                      value={currentResposta.observacao || ''}
                      onChange={(e) => handleRespostaChange(currentItem.id, 'observacao', e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Evidências */}
                  <div className="space-y-2">
                    <Label>Evidências (Fotos/Documentos)</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <div className="text-center">
                        <Camera className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <label htmlFor={`file-upload-${currentItem.id}`} className="cursor-pointer">
                          <span className="text-sm font-medium text-gray-900">
                            Clique para adicionar fotos ou documentos
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

                  {/* Ação Corretiva (se NC) */}
                  {currentResposta.situacao_encontrada === 'NC' && (
                    <>
                      <div className="space-y-2">
                        <Label>Ação Corretiva Recomendada</Label>
                        <Textarea
                          placeholder="Descreva a ação corretiva recomendada..."
                          value={currentResposta.acao_corretiva_recomendada || ''}
                          onChange={(e) => handleRespostaChange(currentItem.id, 'acao_corretiva_recomendada', e.target.value)}
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Responsável pela Correção</Label>
                          <Input
                            placeholder="Nome do responsável"
                            value={currentResposta.responsavel_correcao || ''}
                            onChange={(e) => handleRespostaChange(currentItem.id, 'responsavel_correcao', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Prazo para Correção</Label>
                          <Input
                            type="date"
                            value={currentResposta.prazo_correcao || ''}
                            onChange={(e) => handleRespostaChange(currentItem.id, 'prazo_correcao', e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ações */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Salvando...' : 'Salvar Progresso'}
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  disabled={isSaving || !podeFinializar}
                  title={!podeFinializar ? `Responda pelo menos ${Math.floor(itens.length * 0.8)} itens para finalizar` : ''}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Finalizar Auditoria
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}