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
import { useI18n } from '@/components/lib/i18n';
import { isAdminProfile } from '@/components/lib/userUtils';

export default function ConfiguracoesGerais() {
  const { t } = useI18n();
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

      if (!isAdminProfile(user)) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('configGerais.acessoNegado'),
          message: t('configGerais.apenasAdmins')
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
        title: t('configGerais.erroCarregar'),
        message: t('configGerais.erroCarregarMsg') + error.message
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
      setAlertInfo({ isOpen: true, type: 'error', title: t('configGerais.campoObrigatorio'), message: t('configGerais.smtpObrigatorio') });
      return;
    }
    if (!smtpData.smtp_from_email.trim()) {
      setAlertInfo({ isOpen: true, type: 'error', title: t('configGerais.campoObrigatorio'), message: t('configGerais.emailObrigatorio') });
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
        title: t('configGerais.salvoTitulo'),
        message: t('configGerais.salvoMsg')
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('configGerais.erroSalvarTitulo'),
        message: error.message || t('configGerais.erroSalvarMsg')
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpData.smtp_host || !smtpData.smtp_from_email) {
      setAlertInfo({ isOpen: true, type: 'error', title: t('configGerais.configIncompleta'), message: t('configGerais.configIncompletaMsg') });
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
        title: t('configGerais.emailTesteEnviado'),
        message: `${t('configGerais.emailTesteEnviadoPara')} ${smtpData.smtp_from_email}. ${t('configGerais.verificarCaixa')}`
      });
    } catch (error) {
      console.error('Erro no teste SMTP:', error);
      setSmtpTestStatus('error');
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('configGerais.falhaTesteTitle'),
        message: t('configGerais.falhaTesteMsg')
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
          <p className="text-slate-700 dark:text-slate-300">{t('configGerais.carregando')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('configGerais.titulo')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{t('configGerais.subtitulo')}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-t-lg p-4">
          <button
            onClick={() => setActiveTab('smtp')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'smtp' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            {t('configGerais.tabSMTP')}
          </button>
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'geral' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            {t('configGerais.tabGeral')}
          </button>
        </div>

        {/* Tab: SMTP */}
        {activeTab === 'smtp' && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {t('configGerais.smtp.titulo')}
              </CardTitle>
              <CardDescription>
                {t('configGerais.smtp.descricao')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Server config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('configGerais.smtp.host')} <span className="text-red-500">*</span></Label>
                  <Input
                    value={smtpData.smtp_host}
                    onChange={(e) => handleSmtpChange('smtp_host', e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('configGerais.smtp.hostEx')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('configGerais.smtp.porta')}</Label>
                  <Input
                    value={smtpData.smtp_port}
                    onChange={(e) => handleSmtpChange('smtp_port', e.target.value)}
                    placeholder="587"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('configGerais.smtp.portaInfo')}</p>
                </div>
              </div>

              {/* Auth */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('configGerais.smtp.usuario')}</Label>
                  <Input
                    value={smtpData.smtp_user}
                    onChange={(e) => handleSmtpChange('smtp_user', e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('configGerais.smtp.senhaApp')}</Label>
                  <div className="relative">
                    <Input
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={smtpData.smtp_password}
                      onChange={(e) => handleSmtpChange('smtp_password', e.target.value)}
                      placeholder={t('configGerais.smtp.senhaPlaceholder')}
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('configGerais.smtp.senhaInfo')}</p>
                </div>
              </div>

              {/* From config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('configGerais.smtp.nomeRemetente')}</Label>
                  <Input
                    value={smtpData.smtp_from_name}
                    onChange={(e) => handleSmtpChange('smtp_from_name', e.target.value)}
                    placeholder="DIROPS"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('configGerais.smtp.remetente')} <span className="text-red-500">*</span></Label>
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
                  {t('configGerais.smtp.tls')}
                </Label>
              </div>

              {/* Extra email */}
              <div className="space-y-2">
                <Label>{t('configGerais.smtp.emailNotif')}</Label>
                <Input
                  type="email"
                  value={smtpData.email_notificacoes_padrao}
                  onChange={(e) => handleSmtpChange('email_notificacoes_padrao', e.target.value)}
                  placeholder="admin@sga.co.ao"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('configGerais.smtp.emailNotifInfo')}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Button onClick={handleSaveSmtp} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSaving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {t('configGerais.smtp.salvando')}</> : <><Save className="w-4 h-4 mr-2" /> {t('configGerais.smtp.salvar')}</>}
                </Button>
                <Button variant="outline" onClick={handleTestSmtp} disabled={isTesting}>
                  {isTesting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {t('configGerais.smtp.testando')}</> : <><Mail className="w-4 h-4 mr-2" /> {t('configGerais.smtp.enviarEmailTeste')}</>}
                </Button>
                <Button variant="outline" onClick={loadData} disabled={isSaving}>
                  <RefreshCw className="w-4 h-4 mr-2" /> {t('configGerais.recarregar')}
                </Button>
              </div>

              {/* Test status */}
              {smtpTestStatus === 'success' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> {t('configGerais.smtp.emailTesteSucesso')}
                </div>
              )}
              {smtpTestStatus === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4" /> {t('configGerais.smtp.emailTesteFalhou')}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info card SMTP */}
        {activeTab === 'smtp' && (
          <Card className="shadow-sm bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">{t('configGerais.infoImportante')}</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li><strong>Gmail:</strong> {t('configGerais.infoGmail')}</li>
                <li><strong>Outlook/Office 365:</strong> {t('configGerais.infoOutlook')}</li>
                <li><strong>{t('configGerais.infoServidorTitle')}:</strong> {t('configGerais.infoServidor')}</li>
                <li>{t('configGerais.infoSenhaSegura')}</li>
                <li>{t('configGerais.infoEmailTeste')}</li>
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
                {t('configGerais.tabGeral')}
              </CardTitle>
              <CardDescription>
                {t('configGerais.geralDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('configGerais.geralVazio')}</p>
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
