
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select'; // Importação corrigida para default import
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClipboardCheck, UploadCloud, AlertCircle, Loader2, CheckCircle, Plane, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { Inspecao } from '@/entities/Inspecao';
import { ItemChecklist } from '@/entities/ItemChecklist';
import { RespostaInspecao } from '@/entities/RespostaInspecao';
import { UploadFile } from '@/integrations/Core';
import FormGRF from '../grf/FormGRF';
import useSubmitGuard from '@/hooks/useSubmitGuard';

export default function FormInspecao({ isOpen, onClose, tipoInspecao, aeroportos, currentUser }) {
  const [step, setStep] = useState(1); // 1: Dados Gerais, 2: Checklist, 3: Concluído
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { isSubmitting, guardedSubmit } = useSubmitGuard();

  // Step 1 State
  const [dadosGerais, setDadosGerais] = useState({
    aeroporto_id: aeroportos?.length === 1 ? aeroportos[0].id : '',
    data_inspecao: new Date().toISOString().split('T')[0],
    hora_inicio: '',
    inspetor_responsavel: currentUser?.full_name || '',
  });

  // Step 2 State
  const [currentInspecao, setCurrentInspecao] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [resumoGeral, setResumoGeral] = useState('');

  // New state variables for GRF
  const [showGRFForm, setShowGRFForm] = useState(false);
  const [grfRegistado, setGrfRegistado] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setStep(1);
      setError('');
      setDadosGerais({
        aeroporto_id: aeroportos?.length === 1 ? aeroportos[0].id : '',
        data_inspecao: new Date().toISOString().split('T')[0],
        hora_inicio: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        inspetor_responsavel: currentUser?.full_name || '',
      });
      setCurrentInspecao(null);
      setChecklistItems([]);
      setRespostas({});
      setResumoGeral('');
      setShowGRFForm(false);
      setGrfRegistado(false);
    }
  }, [isOpen]);

  const handleDadosGeraisChange = (field, value) => {
    setDadosGerais(prev => ({ ...prev, [field]: value }));
  };

  const handleNextStep = async () => {
    if (!dadosGerais.aeroporto_id || !dadosGerais.data_inspecao || !dadosGerais.hora_inicio || !dadosGerais.inspetor_responsavel) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    guardedSubmit(async () => {
    setError('');
    setIsLoading(true);

    try {
      // 1. Criar a Inspeção com os dados gerais e status 'em_andamento'
      const novaInspecao = await Inspecao.create({
        ...dadosGerais,
        tipo_inspecao_id: tipoInspecao.id,
        empresa_id: currentUser?.empresa_id || null,
        status: 'em_andamento',
      });
      setCurrentInspecao(novaInspecao);

      // 2. Carregar os itens do checklist para esta inspeção
      const items = await ItemChecklist.filter({ tipo_inspecao_id: tipoInspecao.id }, 'ordem');
      setChecklistItems(items);

      // 3. Inicializar o estado das respostas
      const respostasIniciais = {};
      items.forEach(item => {
        respostasIniciais[item.id] = {
          resultado: 'conforme',
          observacoes: '',
          fotos: [],
          acao_corretiva: '',
          prazo_correcao: '',
          responsavel_correcao: ''
        };
      });
      setRespostas(respostasIniciais);

      // 4. Mudar para a próxima etapa
      setStep(2);
    } catch (err) {
      console.error('Erro ao iniciar inspeção:', err);
      setError('Ocorreu um erro ao iniciar a inspeção. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
    });
  };

  const handleRespostaChange = (itemId, field, value) => {
    setRespostas(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleFileUpload = async (itemId, file) => {
    if (!file) return;
    setIsLoading(true);
    try {
      const { file_url } = await UploadFile({ file });
      const newFotos = [...respostas[itemId].fotos, file_url];
      handleRespostaChange(itemId, 'fotos', newFotos);
    } catch(err) {
      console.error("Erro no upload:", err);
      setError("Falha no upload do arquivo.");
    } finally {
      setIsLoading(false);
    }
  };

  // Check if it's a daily runway inspection
  const isInspecaoPistaDiaria = tipoInspecao?.codigo === 'PISTA_DIARIA' ||
                                (tipoInspecao?.nome?.toLowerCase().includes('diária') &&
                                tipoInspecao?.nome?.toLowerCase().includes('pista'));

  const handleGRFSubmit = async (grfData) => {
    try {
      const { RegistoGRF } = await import('@/entities/RegistoGRF');
      await RegistoGRF.create({
        ...grfData,
        inspecao_id: currentInspecao.id // Vincular ao ID da inspeção
      });
      setGrfRegistado(true);
      setShowGRFForm(false);
      alert('Registo GRF adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao registar GRF:', error);
      alert('Erro ao registar GRF. Tente novamente.');
    }
  };

  const handleFinalSubmit = async () => {
    // Para inspeções de pista diária, o GRF é OBRIGATÓRIO
    if (isInspecaoPistaDiaria && !grfRegistado) {
      setError('Para inspeções diárias de pista, é obrigatório registar as condições GRF antes de finalizar.');
      return;
    }

    guardedSubmit(async () => {
    setIsLoading(true);
    setError('');
    try {
      // 1. Salvar todas as respostas do checklist
      const respostasParaSalvar = Object.entries(respostas).map(([itemId, resposta]) => ({
        ...resposta,
        inspecao_id: currentInspecao.id,
        item_checklist_id: itemId,
      }));
      await RespostaInspecao.bulkCreate(respostasParaSalvar);

      // 2. Calcular estatísticas
      const total_itens = checklistItems.length;
      const itens_conformes = Object.values(respostas).filter(r => r.resultado === 'conforme').length;
      const itens_nao_conformes = Object.values(respostas).filter(r => r.resultado === 'nao_conforme').length;
      const itens_nao_aplicaveis = Object.values(respostas).filter(r => r.resultado === 'nao_aplicavel').length;
      const requer_acao_imediata = itens_nao_conformes > 0;

      // 3. Atualizar a inspeção principal com o resumo, estatísticas e novo status
      await Inspecao.update(currentInspecao.id, {
        resumo_geral: resumoGeral,
        hora_fim: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'concluida',
        total_itens,
        itens_conformes,
        itens_nao_conformes,
        itens_nao_aplicaveis,
        requer_acao_imediata,
      });

      // 4. Criar Solicitações de Serviço (SS) para itens não conformes
      const { SolicitacaoServico } = await import('@/entities/SolicitacaoServico');
      const itensNaoConformes = Object.entries(respostas).filter(([_, resposta]) =>
        resposta.resultado === 'nao_conforme'
      );

      for (const [itemId, resposta] of itensNaoConformes) {
        const item = checklistItems.find(i => i.id === itemId);
        if (item) {
          const numeroSS = `SS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;

          await SolicitacaoServico.create({
            numero_ss: numeroSS,
            titulo: `Não conformidade: ${item.item}`,
            descricao: `Item não conforme identificado durante inspeção ${tipoInspecao?.nome}.\n\nObservações: ${resposta.observacoes || 'Sem observações adicionais.'}`,
            aeroporto_id: currentInspecao.aeroporto_id,
            empresa_id: currentUser?.empresa_id || null,
            origem: 'inspecao',
            inspecao_id: currentInspecao.id,
            item_checklist_id: itemId,
            status: 'aberta',
            prioridade_sugerida: itens_nao_conformes > 5 ? 'alta' : 'media',
            solicitante_id: currentUser?.id || null,
            solicitante_nome: currentUser?.full_name || null,
            solicitante_email: currentUser?.email || null,
          });
        }
      }

      // 5. Mudar para a etapa de conclusão
      setStep(3);
    } catch (err) {
      console.error('Erro ao finalizar inspeção:', err);
      setError('Ocorreu um erro ao finalizar a inspeção. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
    });
  };

  const renderStep1 = () => {
    const aeroportoOptions = aeroportos.map(aeroporto => ({
      value: aeroporto.id,
      label: `${aeroporto.nome} (${aeroporto.codigo_icao})`
    }));

    return (
      <div className="space-y-4 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Aeroporto *</Label>
            <Select
              options={aeroportoOptions}
              value={dadosGerais.aeroporto_id}
              onValueChange={(value) => handleDadosGeraisChange('aeroporto_id', value)}
              placeholder="Selecione o aeroporto"
            />
          </div>
          <div className="space-y-2">
            <Label>Data da Inspeção *</Label>
            <Input
              type="date"
              value={dadosGerais.data_inspecao}
              onChange={(e) => handleDadosGeraisChange('data_inspecao', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Hora de Início *</Label>
            <Input
              type="time"
              value={dadosGerais.hora_inicio}
              onChange={(e) => handleDadosGeraisChange('hora_inicio', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Inspetor Responsável</Label>
            <Input
              value={dadosGerais.inspetor_responsavel}
              disabled
              className="bg-slate-100"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-6 pt-4 max-h-[65vh] overflow-y-auto pr-2">
      {/* Seção GRF OBRIGATÓRIA para inspeções diárias de pista */}
      {isInspecaoPistaDiaria && (
        <Card className="bg-red-50/50 border-red-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-red-800 flex items-center gap-2">
              <Plane className="w-5 h-5" />
              Condições da Pista (GRF) - OBRIGATÓRIO
            </CardTitle>
            <p className="text-sm text-red-600">
              Para inspeções diárias de pista, é <strong>obrigatório</strong> registar as condições GRF
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {grfRegistado ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  ✅ Condições GRF registadas com sucesso para esta inspeção.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <div className="space-y-3">
                    <p className="font-semibold">⚠️ Registo GRF pendente - obrigatório para finalizar</p>
                    <Button
                      type="button"
                      onClick={() => setShowGRFForm(true)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Registar Condições GRF (Obrigatório)
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {checklistItems.map(item => (
        <Card key={item.id} className="bg-slate-50/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">
              {item.ordem}. {item.item}
            </CardTitle>
            <p className="text-sm text-slate-500">{item.criterio}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-medium">Resultado</Label>
              <RadioGroup
                value={respostas[item.id]?.resultado}
                onValueChange={(value) => handleRespostaChange(item.id, 'resultado', value)}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center space-x-2"><RadioGroupItem value="conforme" id={`c-${item.id}`} /><Label htmlFor={`c-${item.id}`}>Conforme</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="nao_conforme" id={`nc-${item.id}`} /><Label htmlFor={`nc-${item.id}`}>Não Conforme</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="nao_aplicavel" id={`na-${item.id}`} /><Label htmlFor={`na-${item.id}`}>N/A</Label></div>
              </RadioGroup>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={respostas[item.id]?.observacoes} onChange={(e) => handleRespostaChange(item.id, 'observacoes', e.target.value)} />
            </div>

            {respostas[item.id]?.resultado === 'nao_conforme' && (
              <div className="p-3 border-l-4 border-red-500 bg-red-50 rounded">
                <p className="text-sm text-red-700 font-medium">⚠ Uma Solicitação de Serviço (SS) será criada automaticamente na Manutenção ao concluir a inspeção.</p>
              </div>
            )}

            {item.permite_fotos && (
              <div>
                <Label>Fotos</Label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                    <div className="flex text-sm text-slate-600">
                      <label htmlFor={`file-upload-${item.id}`} className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                        <span>Carregar um arquivo</span>
                        <input id={`file-upload-${item.id}`} name={`file-upload-${item.id}`} type="file" className="sr-only" onChange={(e) => handleFileUpload(item.id, e.target.files[0])} />
                      </label>
                      <p className="pl-1">ou arraste e solte</p>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, GIF até 10MB</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {respostas[item.id]?.fotos.map((fotoUrl, index) => (
                    <img key={index} src={fotoUrl} alt={`foto-${index}`} className="h-16 w-16 object-cover rounded" />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="space-y-2 pt-4">
        <Label className="text-lg font-semibold">Resumo Geral da Inspeção</Label>
        <Textarea
          value={resumoGeral}
          onChange={(e) => setResumoGeral(e.target.value)}
          placeholder="Descreva o resumo geral e conclusões da inspeção..."
          rows={5}
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
      <h3 className="text-lg font-medium">Inspeção Concluída com Sucesso!</h3>
      <p className="text-sm text-slate-500">O relatório foi gerado e está disponível na lista de inspeções.</p>
      <Button onClick={onClose} className="mt-4">Fechar</Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            {step === 1 && `Nova Inspeção: ${tipoInspecao?.nome}`}
            {step === 2 && `Preencher Checklist: ${tipoInspecao?.nome}`}
            {step === 3 && `Inspeção Concluída`}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <DialogFooter>
          {step === 1 && (
            <>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading || isSubmitting}>Cancelar</Button></DialogClose>
              <Button onClick={handleNextStep} disabled={isLoading || isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isLoading || isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Preencher Checklist'}
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isLoading || isSubmitting}>Voltar</Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={isLoading || isSubmitting || (isInspecaoPistaDiaria && !grfRegistado)}
                className={`bg-blue-600 hover:bg-blue-700 text-white ${isInspecaoPistaDiaria && !grfRegistado ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading || isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Concluir Inspeção'}
              </Button>
              {isInspecaoPistaDiaria && !grfRegistado && (
                <p className="text-xs text-red-600 ml-2">
                  * Registe as condições GRF primeiro
                </p>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* GRF Modal for runway inspections */}
      {showGRFForm && isInspecaoPistaDiaria && (
        <FormGRF
          isOpen={showGRFForm}
          onClose={() => setShowGRFForm(false)}
          onSubmit={handleGRFSubmit}
          aeroportos={aeroportos}
          registoInicial={null}
          aeroportoPreSelecionado={dadosGerais.aeroporto_id} // Passando o aeroporto pré-selecionado
        />
      )}
    </Dialog>
  );
}
