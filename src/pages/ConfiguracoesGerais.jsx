import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, RefreshCw, Settings, Tag, MessageSquare, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ConfiguracaoNotificacoes } from '@/entities/ConfiguracaoNotificacoes';
import { User } from '@/entities/User';
import AlertModal from '@/components/shared/AlertModal';
import SuccessModal from '@/components/shared/SuccessModal';
import { createPageUrl } from '@/utils';
import PlaceholderManagement from '@/components/configuracoes/PlaceholderManagement';
import ZAPIInstanciaManagement from '@/components/configuracoes/ZAPIInstanciaManagement';
import ZAPIOptInConfig from '@/components/configuracoes/ZAPIOptInConfig';

export default function ConfiguracoesGerais() {
  const [configuracao, setConfiguracao] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [formData, setFormData] = useState({
    numero_whatsapp_oficial: '',
    content_template_sid: '',
    email_notificacoes_padrao: '',
    provedor_whatsapp: 'twilio'
  });

  const [alertInfo, setAlertInfo] = useState({ 
    isOpen: false, 
    type: 'info', 
    title: '', 
    message: '' 
  });
  
  const [successInfo, setSuccessInfo] = useState({ 
    isOpen: false, 
    title: '', 
    message: '' 
  });

  const [activeTab, setActiveTab] = useState('notificacoes');
  const [zapiSubTab, setZapiSubTab] = useState('instancia');
  const [provedorAtivo, setProvedorAtivo] = useState('twilio');
  const [numeroTeste, setNumeroTeste] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Verificar se o usuário é administrador
      if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Acesso Negado',
          message: 'Apenas administradores podem aceder a esta página.'
        });
        setTimeout(() => {
          window.location.href = createPageUrl('Home');
        }, 2000);
        return;
      }

      const configs = await ConfiguracaoNotificacoes.list();
      
      if (configs.length > 0) {
        const config = configs[0];
        setConfiguracao(config);
        setProvedorAtivo(config.provedor_whatsapp || 'twilio');
        setFormData({
          numero_whatsapp_oficial: config.numero_whatsapp_oficial || '',
          content_template_sid: config.content_template_sid || '',
          email_notificacoes_padrao: config.email_notificacoes_padrao || '',
          provedor_whatsapp: config.provedor_whatsapp || 'twilio'
        });
      } else {
        // Criar configuração padrão se não existir
        const defaultConfig = {
          numero_whatsapp_oficial: 'whatsapp:+14155238886',
          content_template_sid: '',
          email_notificacoes_padrao: '',
          ativo: true
        };
        const created = await ConfiguracaoNotificacoes.create(defaultConfig);
        setConfiguracao(created);
        setProvedorAtivo(created.provedor_whatsapp || 'twilio');
        setFormData({
          numero_whatsapp_oficial: created.numero_whatsapp_oficial,
          content_template_sid: created.content_template_sid || '',
          email_notificacoes_padrao: created.email_notificacoes_padrao || '',
          provedor_whatsapp: created.provedor_whatsapp || 'twilio'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Carregar',
        message: 'Não foi possível carregar as configurações.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validação apenas para Twilio
    if (formData.provedor_whatsapp === 'twilio') {
      if (!formData.numero_whatsapp_oficial.trim()) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Campo Obrigatório',
          message: 'O número oficial do WhatsApp é obrigatório para Twilio.'
        });
        return;
      }

      if (!formData.content_template_sid.trim()) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Campo Obrigatório',
          message: 'O SID do template de conteúdo é obrigatório para Twilio.'
        });
        return;
      }

      if (!formData.numero_whatsapp_oficial.startsWith('whatsapp:+')) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Formato Inválido',
          message: 'Para Twilio, o número deve estar no formato: whatsapp:+244XXXXXXXXX'
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const updateData = {
        ...formData,
        ativo: true
      };

      if (configuracao) {
        await ConfiguracaoNotificacoes.update(configuracao.id, updateData);
      } else {
        const created = await ConfiguracaoNotificacoes.create(updateData);
        setConfiguracao(created);
      }

      setSuccessInfo({
        isOpen: true,
        title: 'Configurações Salvas!',
        message: 'As configurações de notificações foram atualizadas com sucesso.'
      });

      await loadData();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: error.message || 'Não foi possível salvar as configurações.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!numeroTeste.trim()) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Número Obrigatório',
        message: 'Por favor, insira um número de WhatsApp para o teste.'
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const response = await base44.functions.invoke('sendWhatsAppMessageZAPI', {
        to: numeroTeste,
        body: '🧪 Teste de envio via Z-API - DIROPS-SGA. Esta é uma mensagem de teste para verificar a integração.'
      });

      setSuccessInfo({
        isOpen: true,
        title: 'Mensagem Enviada!',
        message: `Mensagem de teste enviada com sucesso para ${numeroTeste}.`
      });
      setNumeroTeste('');
    } catch (error) {
      console.error('Erro ao enviar mensagem de teste:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Enviar',
        message: error.message || 'Não foi possível enviar a mensagem de teste.'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-700">A carregar configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configurações Gerais</h1>
          <p className="text-slate-600 mt-1">Gerir configurações do sistema</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-300 bg-white rounded-t-lg p-4">
          <button
            onClick={() => setActiveTab('notificacoes')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'notificacoes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Notificações
          </button>
          <button
            onClick={() => setActiveTab('placeholders')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'placeholders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <Tag className="w-4 h-4 inline mr-2" />
            Placeholders
          </button>
          <button
            onClick={() => setActiveTab('zapi')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'zapi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Z-API
          </button>
        </div>

        {/* Tab: Notificações */}
        {activeTab === 'notificacoes' && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                Configurações de Notificações
              </CardTitle>
            <CardDescription>
              Configure o número oficial do WhatsApp e outras definições para envio de notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {/* Seletor de Provedor */}
              <div>
                <Label htmlFor="provedor_whatsapp">
                  Provedor de WhatsApp <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => handleInputChange('provedor_whatsapp', 'twilio')}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      formData.provedor_whatsapp === 'twilio' 
                        ? 'border-blue-600 bg-blue-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <MessageSquare className={`w-5 h-5 ${formData.provedor_whatsapp === 'twilio' ? 'text-blue-600' : 'text-slate-500'}`} />
                      <span className={`font-medium ${formData.provedor_whatsapp === 'twilio' ? 'text-blue-900' : 'text-slate-700'}`}>
                        Twilio
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('provedor_whatsapp', 'zapi')}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      formData.provedor_whatsapp === 'zapi' 
                        ? 'border-green-600 bg-green-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <MessageSquare className={`w-5 h-5 ${formData.provedor_whatsapp === 'zapi' ? 'text-green-600' : 'text-slate-500'}`} />
                      <span className={`font-medium ${formData.provedor_whatsapp === 'zapi' ? 'text-green-900' : 'text-slate-700'}`}>
                        Z-API
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {formData.provedor_whatsapp === 'twilio' ? (
                <div>
                  <Label htmlFor="numero_whatsapp">
                    Número Oficial do WhatsApp <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="numero_whatsapp"
                    value={formData.numero_whatsapp_oficial}
                    onChange={(e) => handleInputChange('numero_whatsapp_oficial', e.target.value)}
                    placeholder="whatsapp:+244XXXXXXXXX"
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Formato Twilio: whatsapp:+244XXXXXXXXX (incluir o prefixo "whatsapp:")
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    📱 Número de Envio Z-API
                  </h4>
                  <p className="text-sm text-blue-800">
                    O número que envia as mensagens é o conectado à instância Z-API configurada no sistema.
                  </p>
                  <p className="text-sm text-blue-800 mt-2">
                    Para alterar o número, aceda à plataforma Z-API e reconecte a instância com o novo número.
                  </p>
                </div>
              )}

              {formData.provedor_whatsapp === 'twilio' && (
                <div>
                  <Label htmlFor="content_template_sid">
                    Content Template SID (Twilio) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="content_template_sid"
                    value={formData.content_template_sid}
                    onChange={(e) => handleInputChange('content_template_sid', e.target.value)}
                    placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    SID do template de conteúdo aprovado no Twilio para mensagens WhatsApp
                  </p>
                </div>
              )}

              {formData.provedor_whatsapp === 'zapi' && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                      🔗 Webhook Z-API
                    </h4>
                    <p className="text-sm text-amber-800 mb-2">
                      Configure este URL como webhook na plataforma Z-API:
                    </p>
                    <div className="bg-white border border-amber-300 rounded p-3 font-mono text-sm break-all">
                      https://dirops.base44.app/api/apps/6870dc26cbf5444a4fbe6aa9/functions/zapiWebhook
                    </div>
                    <p className="text-xs text-amber-700 mt-2">
                      Este webhook receberá eventos como mensagens recebidas e confirmações de opt-in.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      🧪 Enviar Mensagem de Teste
                    </h4>
                    <div className="flex gap-2">
                      <Input
                        value={numeroTeste}
                        onChange={(e) => setNumeroTeste(e.target.value)}
                        placeholder="+244XXXXXXXXX"
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSendTest}
                        disabled={isSendingTest}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSendingTest ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            A enviar...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Enviar Teste
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-blue-700 mt-2">
                      Envie uma mensagem de teste para verificar a integração Z-API.
                    </p>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email_notificacoes">
                  Email de Notificações (Opcional)
                </Label>
                <Input
                  id="email_notificacoes"
                  type="email"
                  value={formData.email_notificacoes_padrao}
                  onChange={(e) => handleInputChange('email_notificacoes_padrao', e.target.value)}
                  placeholder="notificacoes@sga.co.ao"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Email padrão para envio de notificações (caso seja necessário no futuro)
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Configurações
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={loadData}
                disabled={isSaving}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Recarregar
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {activeTab === 'notificacoes' && (
          <Card className="shadow-sm bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informação Importante</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Estas configurações afetam todas as notificações enviadas pelo sistema</li>
                <li><strong>Twilio:</strong> O número deve ser verificado e o Content Template SID aprovado</li>
                <li><strong>Z-API:</strong> Configure TOKEN_ZAPI e ID_INSTANCIA_ZAPI nos segredos do sistema</li>
                <li>Alterações nas configurações entram em vigor imediatamente</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Tab: Placeholders */}
        {activeTab === 'placeholders' && (
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <PlaceholderManagement
                onError={(msg) => setAlertInfo({
                  isOpen: true,
                  type: 'error',
                  title: 'Erro',
                  message: msg
                })}
                onSuccess={(msg) => setSuccessInfo({
                  isOpen: true,
                  title: 'Sucesso!',
                  message: msg
                })}
              />
            </CardContent>
          </Card>
        )}

        {/* Tab: Z-API */}
        {activeTab === 'zapi' && provedorAtivo === 'zapi' && (
          <div className="space-y-4">
            {/* Sub-tabs Z-API */}
            <div className="flex gap-2 bg-white border-b border-slate-200 p-2 rounded-lg">
              <button
                onClick={() => setZapiSubTab('instancia')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  zapiSubTab === 'instancia' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Instância
              </button>
              <button
                onClick={() => setZapiSubTab('optin')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  zapiSubTab === 'optin' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Opt-in
              </button>
            </div>

            {/* Conteúdo das sub-tabs */}
            {zapiSubTab === 'instancia' && (
              <ZAPIInstanciaManagement
                onError={(msg) => setAlertInfo({
                  isOpen: true,
                  type: 'error',
                  title: 'Erro',
                  message: msg
                })}
                onSuccess={(msg) => setSuccessInfo({
                  isOpen: true,
                  title: 'Sucesso!',
                  message: msg
                })}
              />
            )}

            {zapiSubTab === 'optin' && (
              <ZAPIOptInConfig
                onError={(msg) => setAlertInfo({
                  isOpen: true,
                  type: 'error',
                  title: 'Erro',
                  message: msg
                })}
                onSuccess={(msg) => setSuccessInfo({
                  isOpen: true,
                  title: 'Sucesso!',
                  message: msg
                })}
              />
            )}
          </div>
        )}

        {activeTab === 'zapi' && provedorAtivo !== 'zapi' && (
          <Card className="shadow-sm border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-center">
              <MessageSquare className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-amber-900 mb-2">Z-API não está ativo</h3>
              <p className="text-amber-700">
                Para configurar o Z-API, primeiro selecione Z-API como provedor de WhatsApp na aba "Notificações".
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
      />

      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
        title={successInfo.title}
        message={successInfo.message}
      />
    </div>
  );
}