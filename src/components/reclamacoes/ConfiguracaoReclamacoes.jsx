
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select'; 
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Settings, 
  Mail, 
  Users, 
  Clock, 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  AlertCircle,
  CheckCircle,
  Info,
  Eye
} from 'lucide-react';
import EmailPreviewModal from './EmailPreviewModal';

import { ConfiguracaoArea } from '@/entities/ConfiguracaoArea';
import { User } from '@/entities/User';

const AREAS_DISPONIVEIS = [
  { value: 'manutencao', label: 'Manutenção', icon: '🔧' },
  { value: 'achados_e_perdidos', label: 'Achados e Perdidos', icon: '📦' },
  { value: 'ti', label: 'TI', icon: '💻' },
  { value: 'seguranca_avsec', label: 'Segurança AVSEC', icon: '🛡️' },
  { value: 'seguranca_operacional', label: 'Segurança Operacional', icon: '⚠️' },
  { value: 'operacoes', label: 'Operações', icon: '✈️' },
  { value: 'cia_aerea', label: 'Cia Aérea', icon: '🏢' },
  { value: 'outros_aeroportuarios', label: 'Outros Aeroportuários', icon: '🏗️' },
];

export default function ConfiguracaoReclamacoes() {
  const [configuracoes, setConfiguracoes] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingArea, setEditingArea] = useState(null);
  
  // Estado para preview do email
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState({ title: '', body: '' });
  
  // Estados para configurações gerais
  const [configGerais, setConfigGerais] = useState({
    prazo_resposta_padrao: 7, // dias
    prazo_conclusao_padrao: 30, // dias
    notificar_prazo_vencimento: true,
    dias_antes_alerta: 2,
    auto_direcionar_por_categoria: false,
    email_admin_principal: '',
    template_email_recebida: '',
    template_email_conclusao: '',
    horario_funcionamento_inicio: '08:00',
    horario_funcionamento_fim: '17:00'
  });

  const [formAreaData, setFormAreaData] = useState({
    area: '',
    emails_notificacao: [''],
    responsavel_principal: '',
    prazo_resposta_especifico: '',
    auto_atribuir: false,
    nivel_escalamento: 'normal'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configData, usersData] = await Promise.all([
        ConfiguracaoArea.list(),
        User.list()
      ]);
      
      setConfiguracoes(configData);
      setUsers(usersData.filter(u => u.status === 'ativo'));
      
      // Carregar configurações gerais (poderiam estar numa entidade separada)
      // Por agora, usar valores padrão
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar configurações.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveArea = async () => {
    if (!formAreaData.area) {
      setMessage({ type: 'error', text: 'Selecione uma área.' });
      return;
    }

    if (formAreaData.emails_notificacao.filter(email => email.trim()).length === 0) {
      setMessage({ type: 'error', text: 'Adicione pelo menos um email de notificação.' });
      return;
    }

    setIsSaving(true);
    try {
      const emailsLimpos = formAreaData.emails_notificacao.filter(email => email.trim());
      
      const dadosParaSalvar = {
        area: formAreaData.area,
        emails_notificacao: emailsLimpos,
        responsavel_principal: formAreaData.responsavel_principal || null,
        configuracoes_extras: {
          prazo_resposta_especifico: formAreaData.prazo_resposta_especifico ? parseInt(formAreaData.prazo_resposta_especifico) : null,
          auto_atribuir: formAreaData.auto_atribuir,
          nivel_escalamento: formAreaData.nivel_escalamento
        }
      };

      if (editingArea) {
        await ConfiguracaoArea.update(editingArea.id, dadosParaSalvar);
        setMessage({ type: 'success', text: 'Área atualizada com sucesso!' });
      } else {
        await ConfiguracaoArea.create(dadosParaSalvar);
        setMessage({ type: 'success', text: 'Área configurada com sucesso!' });
      }

      setFormAreaData({
        area: '',
        emails_notificacao: [''],
        responsavel_principal: '',
        prazo_resposta_especifico: '',
        auto_atribuir: false,
        nivel_escalamento: 'normal'
      });
      setEditingArea(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configuração da área.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditArea = (config) => {
    setEditingArea(config);
    setFormAreaData({
      area: config.area,
      emails_notificacao: config.emails_notificacao || [''],
      responsavel_principal: config.responsavel_principal || '',
      prazo_resposta_especifico: config.configuracoes_extras?.prazo_resposta_especifico?.toString() || '',
      auto_atribuir: config.configuracoes_extras?.auto_atribuir || false,
      nivel_escalamento: config.configuracoes_extras?.nivel_escalamento || 'normal'
    });
  };

  const handleDeleteArea = async (configId) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração de área?')) return;
    
    try {
      await ConfiguracaoArea.delete(configId);
      setMessage({ type: 'success', text: 'Configuração excluída com sucesso!' });
      loadData();
    } catch (error) {
      console.error('Erro ao excluir configuração:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir configuração.' });
    }
  };

  const addEmailField = () => {
    setFormAreaData(prev => ({
      ...prev,
      emails_notificacao: [...prev.emails_notificacao, '']
    }));
  };

  const removeEmailField = (index) => {
    setFormAreaData(prev => ({
      ...prev,
      emails_notificacao: prev.emails_notificacao.filter((_, i) => i !== index)
    }));
  };

  const updateEmailField = (index, value) => {
    setFormAreaData(prev => ({
      ...prev,
      emails_notificacao: prev.emails_notificacao.map((email, i) => i === index ? value : email)
    }));
  };

  const showPreview = (type) => {
    const sampleData = {
      protocolo: 'REC-2024123456',
      titulo: 'Bagagem danificada no voo DT123',
      reclamante: 'José da Silva',
      aeroporto: 'Aeroporto Internacional 4 de Fevereiro',
      solucao: 'A companhia aérea foi notificada e irá contactar o passageiro para ressarcimento.',
      data_conclusao: new Date().toLocaleDateString('pt-AO')
    };
    
    let template;
    let title;

    if (type === 'recebida') {
      template = configGerais.template_email_recebida;
      title = 'Pré-visualização: Reclamação Recebida';
    } else {
      template = configGerais.template_email_conclusao;
      title = 'Pré-visualização: Reclamação Concluída';
    }

    let body = template
      .replace(/{protocolo}/g, sampleData.protocolo)
      .replace(/{titulo}/g, sampleData.titulo)
      .replace(/{reclamante}/g, sampleData.reclamante)
      .replace(/{aeroporto}/g, sampleData.aeroporto)
      .replace(/{solucao}/g, sampleData.solucao)
      .replace(/{data_conclusao}/g, sampleData.data_conclusao);

    setPreviewContent({ title, body });
    setIsPreviewOpen(true);
  };

  const areasConfiguradas = configuracoes.map(c => c.area);
  const areaOptions = AREAS_DISPONIVEIS.filter(area => 
    !areasConfiguradas.includes(area.value) || (editingArea && editingArea.area === area.value)
  ).map(area => ({ value: area.value, label: `${area.icon} ${area.label}` }));

  const responsaveisOptions = [
    { value: '', label: 'Nenhum gestor específico' },
    ...users.map(user => ({
      value: user.email,
      label: `${user.full_name} (${user.email})`
    }))
  ];

  const nivelEscalamentoOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'urgente', label: 'Urgente' },
    { value: 'critico', label: 'Crítico' }
  ];


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            Configurações de Reclamações
          </h2>
          <p className="text-slate-600 mt-1">Gerir responsáveis, emails e configurações do sistema</p>
        </div>
      </div>

      {message.text && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="areas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="areas" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Áreas e Responsáveis
          </TabsTrigger>
          <TabsTrigger value="emails" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Templates de Email
          </TabsTrigger>
          <TabsTrigger value="gerais" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Configurações Gerais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="areas" className="space-y-6">
          {/* Formulário para configurar área */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingArea ? 'Editar Configuração de Área' : 'Nova Configuração de Área'}
              </CardTitle>
              <CardDescription>Defina os emails de notificação e o responsável para cada área de tratamento de reclamações.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Área Responsável *</Label>
                  <Select 
                    options={areaOptions}
                    value={formAreaData.area} 
                    onValueChange={(value) => setFormAreaData(prev => ({...prev, area: value}))}
                    placeholder="Selecionar área..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Responsável Principal (Gestor)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-slate-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Selecione o gestor da área. <br/>A lista contém todos os utilizadores ativos no sistema.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Select 
                    options={responsaveisOptions}
                    value={formAreaData.responsavel_principal} 
                    onValueChange={(value) => setFormAreaData(prev => ({...prev, responsavel_principal: value}))}
                    placeholder="Selecionar gestor da área..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Emails de Notificação *</Label>
                {formAreaData.emails_notificacao.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={email}
                      onChange={(e) => updateEmailField(index, e.target.value)}
                    />
                    {formAreaData.emails_notificacao.length > 1 && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={() => removeEmailField(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addEmailField}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Email
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prazo de Resposta Específico (dias)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 5"
                    value={formAreaData.prazo_resposta_especifico}
                    onChange={(e) => setFormAreaData(prev => ({...prev, prazo_resposta_especifico: e.target.value}))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nível de Escalamento</Label>
                  <Select 
                    options={nivelEscalamentoOptions}
                    value={formAreaData.nivel_escalamento} 
                    onValueChange={(value) => setFormAreaData(prev => ({...prev, nivel_escalamento: value}))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                {editingArea && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setEditingArea(null);
                      setFormAreaData({
                        area: '',
                        emails_notificacao: [''],
                        responsavel_principal: '',
                        prazo_resposta_especifico: '',
                        auto_atribuir: false,
                        nivel_escalamento: 'normal'
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                <Button onClick={handleSaveArea} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'A guardar...' : (editingArea ? 'Atualizar' : 'Guardar')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de áreas configuradas */}
          <Card>
            <CardHeader>
              <CardTitle>Áreas Configuradas</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-slate-500 mt-2">A carregar configurações...</p>
                </div>
              ) : configuracoes.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    Nenhuma área configurada
                  </h3>
                  <p className="text-slate-500">
                    Configure as áreas responsáveis para começar a gerir reclamações.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {configuracoes.map((config) => {
                    const areaInfo = AREAS_DISPONIVEIS.find(a => a.value === config.area);
                    return (
                      <Card key={config.id} className="border border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                {areaInfo?.icon} {areaInfo?.label}
                              </h3>
                              
                              <div className="text-sm text-slate-600">
                                <p><strong>Emails:</strong> {config.emails_notificacao?.join(', ') || 'Nenhum'}</p>
                                {config.responsavel_principal && (
                                  <p><strong>Responsável:</strong> {config.responsavel_principal}</p>
                                )}
                                {config.configuracoes_extras?.prazo_resposta_especifico && (
                                  <p><strong>Prazo:</strong> {config.configuracoes_extras.prazo_resposta_especifico} dias</p>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Badge variant="outline">{config.configuracoes_extras?.nivel_escalamento || 'normal'}</Badge>
                                {config.configuracoes_extras?.auto_atribuir && (
                                  <Badge className="bg-green-100 text-green-800">Auto-atribuição</Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditArea(config)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteArea(config.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
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
        </TabsContent>

        <TabsContent value="emails" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Templates de Email
              </CardTitle>
              <CardDescription>Personalize os emails automáticos enviados pelo sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Template - Reclamação Recebida</Label>
                <Textarea
                  placeholder="Ex: Olá {reclamante}, a sua reclamação '{titulo}' com protocolo {protocolo} foi recebida..."
                  value={configGerais.template_email_recebida}
                  onChange={(e) => setConfigGerais(prev => ({...prev, template_email_recebida: e.target.value}))}
                  rows={5}
                />
                <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500">
                    Variáveis: {'{protocolo}'}, {'{titulo}'}, {'{reclamante}'}, {'{aeroporto}'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => showPreview('recebida')}>
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar
                    </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Template - Reclamação Concluída</Label>
                <Textarea
                  placeholder="Ex: A sua reclamação {protocolo} foi concluída. Solução: {solucao}"
                  value={configGerais.template_email_conclusao}
                  onChange={(e) => setConfigGerais(prev => ({...prev, template_email_conclusao: e.target.value}))}
                  rows={5}
                />
                 <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500">
                    Variáveis: {'{protocolo}'}, {'{titulo}'}, {'{solucao}'}, {'{data_conclusao}'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => showPreview('concluida')}>
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar
                    </Button>
                </div>
              </div>

              <Button className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Guardar Templates
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gerais" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Configurações Gerais do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prazo Padrão de Resposta (dias)</Label>
                  <Input
                    type="number"
                    value={configGerais.prazo_resposta_padrao}
                    onChange={(e) => setConfigGerais(prev => ({...prev, prazo_resposta_padrao: parseInt(e.target.value)}))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prazo Padrão de Conclusão (dias)</Label>
                  <Input
                    type="number"
                    value={configGerais.prazo_conclusao_padrao}
                    onChange={(e) => setConfigGerais(prev => ({...prev, prazo_conclusao_padrao: parseInt(e.target.value)}))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Alerta de Prazo (dias antes)</Label>
                  <Input
                    type="number"
                    value={configGerais.dias_antes_alerta}
                    onChange={(e) => setConfigGerais(prev => ({...prev, dias_antes_alerta: parseInt(e.target.value)}))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email do Administrador Principal</Label>
                  <Input
                    type="email"
                    value={configGerais.email_admin_principal}
                    onChange={(e) => setConfigGerais(prev => ({...prev, email_admin_principal: e.target.value}))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Horário de Funcionamento - Início</Label>
                  <Input
                    type="time"
                    value={configGerais.horario_funcionamento_inicio}
                    onChange={(e) => setConfigGerais(prev => ({...prev, horario_funcionamento_inicio: e.target.value}))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Horário de Funcionamento - Fim</Label>
                  <Input
                    type="time"
                    value={configGerais.horario_funcionamento_fim}
                    onChange={(e) => setConfigGerais(prev => ({...prev, horario_funcionamento_fim: e.target.value}))}
                  />
                </div>
              </div>

              <Button className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Guardar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={previewContent.title}
        body={previewContent.body}
      />
    </div>
  );
}
