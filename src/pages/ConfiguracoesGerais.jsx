import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, RefreshCw, Settings, Mail, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@/entities/User';
import AlertModal from '@/components/shared/AlertModal';
import SuccessModal from '@/components/shared/SuccessModal';
import { createPageUrl } from '@/utils';
import { emailTemplates } from '@/lib/emailTemplates';

export default function ConfiguracoesGerais() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [activeTab, setActiveTab] = useState('smtp');

  const [smtpData, setSmtpData] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from_name: 'DIROPS',
    smtp_from_email: '',
    smtp_secure: true,
    email_notificacoes_padrao: '',
  });

  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpTestStatus, setSmtpTestStatus] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();

      if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Acesso Negado',
          message: 'Apenas administradores podem aceder a esta pagina.'
        });
        setTimeout(() => { window.location.href = createPageUrl('Home'); }, 2000);
        return;
      }

      // Load config from configuracao_sistema table
      const { data: configs, error } = await supabase
        .from('configuracao_sistema')
        .select('*')
        .limit(1);

      if (error) {
        console.error('Erro ao carregar configuracao_sistema:', error);
        // Table might not exist or RLS blocks - just show empty form
      }

      if (configs && configs.length > 0) {
        const config = configs[0];
        setConfigId(config.id);
        setSmtpData({
          smtp_host: config.smtp_host || '',
          smtp_port: config.smtp_port || '587',
          smtp_user: config.smtp_user || '',
          smtp_password: config.smtp_password || '',
          smtp_from_name: config.smtp_from_name || 'DIROPS',
          smtp_from_email: config.smtp_from_email || '',
          smtp_secure: config.smtp_secure !== false,
          email_notificacoes_padrao: config.email_notificacoes_padrao || '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuracoes:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Carregar',
        message: 'Nao foi possivel carregar as configuracoes: ' + error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmtpChange = (field, value) => {
    setSmtpData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSmtp = async () => {
    if (!smtpData.smtp_host.trim()) {
      setAlertInfo({ isOpen: true, type: 'error', title: 'Campo Obrigatorio', message: 'O servidor SMTP e obrigatorio.' });
      return;
    }
    if (!smtpData.smtp_from_email.trim()) {
      setAlertInfo({ isOpen: true, type: 'error', title: 'Campo Obrigatorio', message: 'O email de envio e obrigatorio.' });
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        smtp_host: smtpData.smtp_host,
        smtp_port: smtpData.smtp_port,
        smtp_user: smtpData.smtp_user,
        smtp_password: smtpData.smtp_password,
        smtp_from_name: smtpData.smtp_from_name,
        smtp_from_email: smtpData.smtp_from_email,
        smtp_secure: smtpData.smtp_secure,
        email_notificacoes_padrao: smtpData.email_notificacoes_padrao,
      };

      if (configId) {
        const { error } = await supabase
          .from('configuracao_sistema')
          .update(updateData)
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('configuracao_sistema')
          .insert(updateData)
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }

      setSuccessInfo({
        isOpen: true,
        title: 'Configuracoes Salvas!',
        message: 'As configuracoes SMTP foram atualizadas com sucesso.'
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: error.message || 'Nao foi possivel salvar as configuracoes.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpData.smtp_host || !smtpData.smtp_from_email) {
      setAlertInfo({ isOpen: true, type: 'error', title: 'Configuracao Incompleta', message: 'Configure o servidor SMTP e email de envio antes de testar.' });
      return;
    }

    setIsTesting(true);
    setSmtpTestStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: smtpData.smtp_from_email,
          subject: 'Teste SMTP - DIROPS',
          html: emailTemplates.smtp_test(),
        },
      });

      if (error) throw error;
      setSmtpTestStatus('success');
      setSuccessInfo({
        isOpen: true,
        title: 'Email de Teste Enviado!',
        message: `Email de teste enviado para ${smtpData.smtp_from_email}. Verifique a caixa de entrada.`
      });
    } catch (error) {
      console.error('Erro no teste SMTP:', error);
      setSmtpTestStatus('error');
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Falha no Teste',
        message: 'Para testar o envio de email, e necessario fazer deploy da Edge Function "send-email" no Supabase. Consulte supabase/functions/send-email/index.ts'
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-700 dark:text-slate-300">A carregar configuracoes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Configuracoes Gerais</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Gerir configuracoes do sistema</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-t-lg p-4">
          <button
            onClick={() => setActiveTab('smtp')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'smtp' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            Email (SMTP)
          </button>
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'geral' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Geral
          </button>
        </div>

        {/* Tab: SMTP */}
        {activeTab === 'smtp' && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Configuracoes de Email (SMTP)
              </CardTitle>
              <CardDescription>
                Configure o servidor SMTP para envio de emails de notificacao, alertas e recuperacao de senha.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Server config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Servidor SMTP <span className="text-red-500">*</span></Label>
                  <Input
                    value={smtpData.smtp_host}
                    onChange={(e) => handleSmtpChange('smtp_host', e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ex: smtp.gmail.com, smtp.office365.com, mail.dominio.com</p>
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input
                    value={smtpData.smtp_port}
                    onChange={(e) => handleSmtpChange('smtp_port', e.target.value)}
                    placeholder="587"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">587 (TLS) ou 465 (SSL) - Recomendado: 587</p>
                </div>
              </div>

              {/* Auth */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuario / Email de Login</Label>
                  <Input
                    value={smtpData.smtp_user}
                    onChange={(e) => handleSmtpChange('smtp_user', e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha / App Password</Label>
                  <div className="relative">
                    <Input
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={smtpData.smtp_password}
                      onChange={(e) => handleSmtpChange('smtp_password', e.target.value)}
                      placeholder="Senha do SMTP"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Para Gmail, use uma "Senha de App" gerada nas configuracoes de seguranca</p>
                </div>
              </div>

              {/* From config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Remetente</Label>
                  <Input
                    value={smtpData.smtp_from_name}
                    onChange={(e) => handleSmtpChange('smtp_from_name', e.target.value)}
                    placeholder="DIROPS"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email de Envio <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={smtpData.smtp_from_email}
                    onChange={(e) => handleSmtpChange('smtp_from_email', e.target.value)}
                    placeholder="noreply@sga.co.ao"
                  />
                </div>
              </div>

              {/* TLS toggle */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <input
                  type="checkbox"
                  id="smtp_secure"
                  checked={smtpData.smtp_secure}
                  onChange={(e) => handleSmtpChange('smtp_secure', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <Label htmlFor="smtp_secure" className="cursor-pointer">
                  Usar conexao segura (TLS/SSL)
                </Label>
              </div>

              {/* Extra email */}
              <div className="space-y-2">
                <Label>Email padrao para notificacoes do sistema</Label>
                <Input
                  type="email"
                  value={smtpData.email_notificacoes_padrao}
                  onChange={(e) => handleSmtpChange('email_notificacoes_padrao', e.target.value)}
                  placeholder="admin@sga.co.ao"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Email que recebera notificacoes administrativas (novos usuarios, alertas, etc.)</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Button onClick={handleSaveSmtp} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSaving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> A guardar...</> : <><Save className="w-4 h-4 mr-2" /> Guardar Configuracoes</>}
                </Button>
                <Button variant="outline" onClick={handleTestSmtp} disabled={isTesting}>
                  {isTesting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> A testar...</> : <><Mail className="w-4 h-4 mr-2" /> Enviar Email de Teste</>}
                </Button>
                <Button variant="outline" onClick={loadData} disabled={isSaving}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Recarregar
                </Button>
              </div>

              {/* Test status */}
              {smtpTestStatus === 'success' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Email de teste enviado com sucesso!
                </div>
              )}
              {smtpTestStatus === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4" /> Falha ao enviar email de teste. Verifique as configuracoes.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info card SMTP */}
        {activeTab === 'smtp' && (
          <Card className="shadow-sm bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Informacao Importante</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li><strong>Gmail:</strong> Use smtp.gmail.com, porta 587, e gere uma "Senha de App" em myaccount.google.com</li>
                <li><strong>Outlook/Office 365:</strong> Use smtp.office365.com, porta 587</li>
                <li><strong>Servidor proprio:</strong> Consulte o administrador do seu servidor de email</li>
                <li>A senha SMTP e armazenada de forma segura no banco de dados</li>
                <li>O email de teste sera enviado para o endereco configurado como "Email de Envio"</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Tab: Geral */}
        {activeTab === 'geral' && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuracoes Gerais
              </CardTitle>
              <CardDescription>
                Outras configuracoes do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Outras configuracoes serao adicionadas aqui conforme necessario.</p>
              </div>
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
