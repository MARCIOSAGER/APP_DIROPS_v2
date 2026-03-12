import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  CalendarIcon, 
  User, 
  Settings, 
  CheckCircle, 
  XCircle, 
  FileText, 
  History, 
  Send, 
  Clock, 
  MapPin,
  Edit,
  MessageSquare,
  AlertTriangle,
  Phone,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import { Reclamacao } from '@/entities/Reclamacao';
import { HistoricoReclamacao } from '@/entities/HistoricoReclamacao';
import { base44 } from '@/api/base44Client';

const STATUS_CONFIG = {
  recebida: { label: 'Recebida', color: 'bg-blue-100 text-blue-800', icon: FileText },
  em_analise: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800', icon: Settings },
  em_tratamento: { label: 'Em Tratamento', color: 'bg-purple-100 text-purple-800', icon: Settings },
  aguardando_feedback: { label: 'Aguardando Feedback', color: 'bg-orange-100 text-orange-800', icon: Clock },
  redirecionada: { label: 'Redirecionada', color: 'bg-pink-100 text-pink-800', icon: Send },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const AREA_RESPONSAVEL_OPTIONS = [
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'achados_e_perdidos', label: 'Achados e Perdidos' },
  { value: 'ti', label: 'TI' },
  { value: 'seguranca_avsec', label: 'Segurança AVSEC' },
  { value: 'seguranca_operacional', label: 'Segurança Operacional' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'cia_aerea', label: 'Cia Aérea' },
  { value: 'outros_aeroportuarios', label: 'Outros Aeroportuários' },
  { value: 'sem_direcionamento', label: 'Sem Direcionamento' },
];

const CANAL_ENTRADA_CONFIG = {
  telefone: { label: 'Telefone', icon: Phone },
  email: { label: 'E-mail', icon: Mail },
  formulario_web: { label: 'Formulário Web', icon: FileText },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare },
  presencial: { label: 'Presencial', icon: User },
  outros: { label: 'Outros', icon: AlertTriangle },
};

export default function ReclamacaoDetailModal({ 
  isOpen, 
  onClose, 
  reclamacaoId, 
  aeroportos,
  onUpdate,
  onEdit 
}) {
  const [reclamacao, setReclamacao] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Estados para workflow
  const [novoStatus, setNovoStatus] = useState('');
  const [novaAreaResponsavel, setNovaAreaResponsavel] = useState('');
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [prazoResposta, setPrazoResposta] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [solucaoAplicada, setSolucaoAplicada] = useState('');

  useEffect(() => {
    if (isOpen && reclamacaoId) {
      loadData();
    }
  }, [isOpen, reclamacaoId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reclamacaoData, historicoData] = await Promise.all([
        Reclamacao.filter({ id: reclamacaoId }),
        HistoricoReclamacao.filter({ reclamacao_id: reclamacaoId }, 'data_evento')
      ]);
      
      setReclamacao(reclamacaoData[0]);
      setHistorico(historicoData);
      
      // Inicializar campos com dados atuais
      if (reclamacaoData[0]) {
        setNovoStatus(reclamacaoData[0].status);
        setNovaAreaResponsavel(reclamacaoData[0].area_responsavel || '');
        setNovoResponsavel(reclamacaoData[0].responsavel_atual || '');
        setSolucaoAplicada(reclamacaoData[0].solucao_aplicada || '');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar os dados da reclamação.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!novoStatus || novoStatus === reclamacao.status) return;
    
    setIsSaving(true);
    try {
      const updateData = {
        status: novoStatus,
        area_responsavel: novaAreaResponsavel,
        responsavel_atual: novoResponsavel,
        data_prazo_resposta: prazoResposta ? format(prazoResposta, 'yyyy-MM-dd') : null,
      };

      if (novoStatus === 'concluida') {
        updateData.data_conclusao = new Date().toISOString();
        updateData.solucao_aplicada = solucaoAplicada;
      }

      await Reclamacao.update(reclamacao.id, updateData);

      // Registrar no histórico
      await HistoricoReclamacao.create({
        reclamacao_id: reclamacao.id,
        data_evento: new Date().toISOString(),
        tipo_evento: 'alteracao_status',
        detalhes: `Status alterado de "${STATUS_CONFIG[reclamacao.status]?.label}" para "${STATUS_CONFIG[novoStatus]?.label}"${observacao ? `. Observação: ${observacao}` : ''}`,
        dados_alterados: {
          status_anterior: reclamacao.status,
          status_novo: novoStatus,
          area_responsavel: novaAreaResponsavel,
          responsavel_atual: novoResponsavel
        },
        usuario_email: 'sistema@sga.co.ao'
      });

      // Enviar notificação se necessário
      if (novaAreaResponsavel && novaAreaResponsavel !== 'sem_direcionamento') {
        await enviarNotificacaoArea(novaAreaResponsavel, novoStatus);
      }

      setMessage({ type: 'success', text: 'Status atualizado com sucesso!' });
      setObservacao('');
      
      await loadData();
      if (onUpdate) onUpdate();
      
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar o status.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddObservacao = async () => {
    if (!observacao.trim()) return;
    
    setIsSaving(true);
    try {
      await HistoricoReclamacao.create({
        reclamacao_id: reclamacao.id,
        data_evento: new Date().toISOString(),
        tipo_evento: 'adicao_observacao',
        detalhes: observacao,
        usuario_email: 'sistema@sga.co.ao'
      });

      setMessage({ type: 'success', text: 'Observação adicionada com sucesso!' });
      setObservacao('');
      await loadData();
      
    } catch (error) {
      console.error('Erro ao adicionar observação:', error);
      setMessage({ type: 'error', text: 'Erro ao adicionar observação.' });
    } finally {
      setIsSaving(false);
    }
  };

  const enviarNotificacaoArea = async (area, status) => {
    try {
      // Aqui você pode implementar a lógica de buscar emails da ConfiguracaoArea
      // Por enquanto, vamos usar um email padrão
      const emailDestino = `${area}@sga.co.ao`;
      
      await base44.integrations.Core.SendEmail({
        to: emailDestino,
        subject: `Reclamação ${reclamacao.protocolo_numero} - ${STATUS_CONFIG[status]?.label}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="/logo-dirops.png" alt="DIROPS" style="height: 60px;">
              <h1 style="color: #1e40af; margin-top: 20px;">Notificação de Reclamação</h1>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #1e40af; margin-top: 0;">Protocolo: ${reclamacao.protocolo_numero}</h2>
              <p><strong>Título:</strong> ${reclamacao.titulo}</p>
              <p><strong>Status:</strong> ${STATUS_CONFIG[status]?.label}</p>
              <p><strong>Área Responsável:</strong> ${AREA_RESPONSAVEL_OPTIONS.find(a => a.value === area)?.label}</p>
              <p><strong>Aeroporto:</strong> ${aeroportos.find(a => a.codigo_icao === reclamacao.aeroporto_id)?.nome}</p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p><strong>Sistema DIROPS</strong><br>
              Direcção de Operações - Serviços de Gestão Aeroportuária</p>
            </div>
          </div>
        `,
        from_name: 'DIROPS'
      });
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  };

  if (!reclamacao) return null;

  const aeroporto = aeroportos.find(a => a.codigo_icao === reclamacao.aeroporto_id);
  const statusConfig = STATUS_CONFIG[reclamacao.status];
  const canalConfig = CANAL_ENTRADA_CONFIG[reclamacao.canal_entrada];

  const statusOptions = Object.entries(STATUS_CONFIG).map(([key, config]) => ({
    value: key,
    label: config.label
  }));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            Reclamação {reclamacao.protocolo_numero}
            <Badge className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {message.text && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="detalhes" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="resolucao">Resolução</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="font-semibold">Título</Label>
                    <p className="text-sm text-slate-600">{reclamacao.titulo}</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Descrição</Label>
                    <p className="text-sm text-slate-600">{reclamacao.descricao}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-semibold">Categoria</Label>
                      <p className="text-sm text-slate-600 capitalize">{reclamacao.categoria_reclamacao?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <Label className="font-semibold">Prioridade</Label>
                      <Badge variant={reclamacao.prioridade === 'alta' ? 'destructive' : 'outline'}>
                        {reclamacao.prioridade}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações de Contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    {canalConfig.icon && <canalConfig.icon className="w-4 h-4" />}
                    <div>
                      <Label className="font-semibold">Canal de Entrada</Label>
                      <p className="text-sm text-slate-600">{canalConfig.label}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="font-semibold">Nome do Reclamante</Label>
                    <p className="text-sm text-slate-600">{reclamacao.reclamante_nome || 'Não informado'}</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Contacto</Label>
                    <p className="text-sm text-slate-600">{reclamacao.reclamante_contacto || 'Não informado'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <div>
                      <Label className="font-semibold">Aeroporto</Label>
                      <p className="text-sm text-slate-600">{aeroporto?.nome}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => onEdit(reclamacao)} variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Editar Informações
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão do Workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Novo Status</Label>
                    <Select
                      id="status"
                      options={statusOptions}
                      value={novoStatus}
                      onValueChange={setNovoStatus}
                      placeholder="Selecionar status"
                    />
                  </div>

                  <div>
                    <Label htmlFor="area">Área Responsável</Label>
                    <Select
                      id="area"
                      options={AREA_RESPONSAVEL_OPTIONS}
                      value={novaAreaResponsavel}
                      onValueChange={setNovaAreaResponsavel}
                      placeholder="Selecionar área"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="responsavel">Responsável Atual</Label>
                  <Input
                    id="responsavel"
                    value={novoResponsavel}
                    onChange={(e) => setNovoResponsavel(e.target.value)}
                    placeholder="Nome ou email do responsável"
                  />
                </div>

                <div>
                  <Label>Prazo para Resposta</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {prazoResposta ? format(prazoResposta, 'PPP', { locale: pt }) : 'Selecionar data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={prazoResposta}
                        onSelect={setPrazoResposta}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="observacao">Observação (opcional)</Label>
                  <Textarea
                    id="observacao"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Adicionar observação sobre a mudança..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleStatusChange} 
                  disabled={isSaving || novoStatus === reclamacao.status}
                  className="w-full"
                >
                  {isSaving ? 'Atualizando...' : 'Atualizar Status'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adicionar Observação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Adicionar observação..."
                  rows={3}
                />
                <Button onClick={handleAddObservacao} disabled={isSaving || !observacao.trim()}>
                  {isSaving ? 'Adicionando...' : 'Adicionar Observação'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Histórico da Reclamação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {historico.length > 0 ? (
                    historico.map((evento, index) => (
                      <div key={index} className="flex gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">
                                {evento.tipo_evento.replace('_', ' ').toUpperCase()}
                              </p>
                              <p className="text-slate-600 text-sm mt-1">{evento.detalhes}</p>
                            </div>
                            <div className="text-right text-xs text-slate-500">
                              <p>{format(new Date(evento.data_evento), 'dd/MM/yyyy HH:mm', { locale: pt })}</p>
                              <p>{evento.usuario_email}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-center py-8">Nenhum histórico disponível.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolucao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resolução da Reclamação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="solucao">Solução Aplicada</Label>
                  <Textarea
                    id="solucao"
                    value={solucaoAplicada}
                    onChange={(e) => setSolucaoAplicada(e.target.value)}
                    placeholder="Descrever a solução aplicada para resolver a reclamação..."
                    rows={5}
                  />
                </div>

                {reclamacao.status === 'concluida' && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Esta reclamação foi concluída em {format(new Date(reclamacao.data_conclusao), 'dd/MM/yyyy HH:mm', { locale: pt })}.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setNovoStatus('concluida');
                      handleStatusChange();
                    }}
                    disabled={isSaving || reclamacao.status === 'concluida'}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Concluída
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      setNovoStatus('rejeitada');
                      handleStatusChange();
                    }}
                    disabled={isSaving || reclamacao.status === 'rejeitada'}
                    variant="destructive"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar Reclamação
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}