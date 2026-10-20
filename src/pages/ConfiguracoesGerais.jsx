import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, RefreshCw, Settings, Mail, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import AlertModal from '@/components/shared/AlertModal';
import { useAuth } from '@/lib/AuthContext';
import SuccessModal from '@/components/shared/SuccessModal';
import { createPageUrl } from '@/utils';
import { emailTemplates } from '@/lib/emailTemplates';
import { useI18n } from '@/components/lib/i18n';
import { isAdminProfile } from '@/components/lib/userUtils';
import { useConfiguracaoSistema, useSaveConfiguracaoSistema } from '@/hooks/useConfiguracaoSistema';

export default function ConfiguracoesGerais() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('geral');

  const isAdmin = isAdminProfile(user);
  const { data: configData, isLoading, refetch } = useConfiguracaoSistema({ enabled: isAdmin });
  const saveMutation = useSaveConfiguracaoSistema();

  const configId = configData?.id || null;

  const [smtpData, setSmtpData] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from_name: 'SGA',
    smtp_from_email: '',
    smtp_secure: true,
    email_notificacoes_padrao: '',
  });

  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpTestStatus, setSmtpTestStatus] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // Emails do sistema (editáveis aqui; consumidos por server.js dos alertas,
  // scripts de relatório, função de suporte e notificacoes.jsx dos acessos).
  const [emailsData, setEmailsData] = useState({
    email_alertas: '',
    email_notificacao_acessos: '',
    email_suporte: '',
    email_notificacao_registros: '',
    notificacoes_registros: { registo: { criacao: true, edicao: true }, aeroporto: { criacao: true, edicao: true }, companhia: { criacao: true, edicao: true } },
  });

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });

  // Redirect non-admin users
  useEffect(() => {
    if (!isAdmin) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('configGerais.acessoNegado'),
        message: t('configGerais.apenasAdmins')
      });
      setTimeout(() => { window.location.href = createPageUrl('Home'); }, 2000);
    }
  }, [isAdmin]);

  // Sync query data into local form state
  useEffect(() => {
    if (configData) {
      setSmtpData({
        smtp_host: configData.smtp_host || '',
        smtp_port: configData.smtp_port || '587',
        smtp_user: configData.smtp_user || '',
        smtp_password: configData.smtp_password || '',
        smtp_from_name: configData.smtp_from_name || 'SGA',
        smtp_from_email: configData.smtp_from_email || '',
        smtp_secure: configData.smtp_secure !== false,
        email_notificacoes_padrao: configData.email_notificacoes_padrao || '',
      });
      setEmailsData({
        email_alertas: configData.email_alertas || '',
        email_notificacao_acessos: configData.email_notificacao_acessos || '',
        email_suporte: configData.email_suporte || '',
        email_notificacao_registros: configData.email_notificacao_registros || '',
        notificacoes_registros: configData.notificacoes_registros || { registo: { criacao: true, edicao: true }, aeroporto: { criacao: true, edicao: true }, companhia: { criacao: true, edicao: true } },
      });
    }
  }, [configData]);

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

    saveMutation.mutate(
      { configId, data: updateData },
      {
        onSuccess: () => {
          setSuccessInfo({
            isOpen: true,
            title: t('configGerais.salvoTitulo'),
            message: t('configGerais.salvoMsg')
          });
        },
        onError: (error) => {
          console.error('Erro ao salvar:', error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: t('configGerais.erroSalvarTitulo'),
            message: error.message || t('configGerais.erroSalvarMsg')
          });
        },
      }
    );
  };

  const handleEmailChange = (field, value) => {
    setEmailsData(prev => ({ ...prev, [field]: value }));
  };

  // Atualiza a matriz de notificações de registros (tipo × ação)
  const handleNotifChange = (entity, acao, value) => {
    setEmailsData(prev => ({
      ...prev,
      notificacoes_registros: {
        ...prev.notificacoes_registros,
        [entity]: { ...(prev.notificacoes_registros?.[entity] || {}), [acao]: value },
      },
    }));
  };

  // Todos os emails do sistema saem pelo relay SGA, que só entrega @sga.co.ao.
  // Avisa (não bloqueia) se algum destino não for @sga.co.ao.
  const emailsForaSga = Object.values(emailsData)
    .filter(v => typeof v === 'string')            // ignora toggles/booleanos — só campos de email
    .flatMap(v => v.split(','))
    .map(e => e.trim())
    .filter(Boolean)
    .filter(e => !/@sga\.co\.ao$/i.test(e));

  const handleSaveEmails = async () => {
    saveMutation.mutate(
      {
        configId,
        data: {
          email_alertas: emailsData.email_alertas.trim(),
          email_notificacao_acessos: emailsData.email_notificacao_acessos.trim(),
          email_suporte: emailsData.email_suporte.trim(),
          email_notificacao_registros: emailsData.email_notificacao_registros.trim(),
          notificacoes_registros: emailsData.notificacoes_registros,
        },
      },
      {
        onSuccess: () => setSuccessInfo({ isOpen: true, title: 'Emails guardados', message: 'As alterações entram em vigor de imediato (os alertas do servidor podem levar até 5 min pelo cache).' }),
        onError: (error) => {
          console.error('Erro ao salvar emails:', error);
          setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao guardar', message: error.message || 'Não foi possível guardar os emails.' });
        },
      }
    );
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
          subject: 'Teste SMTP - SGA',
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
          {/* Aba SMTP oculta — SGA não usa configuração de email por aqui */}
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
                    placeholder="SGA"
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
                <Button onClick={handleSaveSmtp} disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saveMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {t('configGerais.smtp.salvando')}</> : <><Save className="w-4 h-4 mr-2" /> {t('configGerais.smtp.salvar')}</>}
                </Button>
                <Button variant="outline" onClick={handleTestSmtp} disabled={isTesting}>
                  {isTesting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {t('configGerais.smtp.testando')}</> : <><Mail className="w-4 h-4 mr-2" /> {t('configGerais.smtp.enviarEmailTeste')}</>}
                </Button>
                <Button variant="outline" onClick={() => refetch()} disabled={saveMutation.isPending}>
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
                <Mail className="w-5 h-5" />
                Emails do Sistema
              </CardTitle>
              <CardDescription>
                Para onde o sistema envia alertas, avisos de novos acessos e tickets de suporte.
                Todos saem pelo relay SGA, que só entrega endereços <strong>@sga.co.ao</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email_alertas">Alertas do sistema (falhas / erros)</Label>
                <Input
                  id="email_alertas"
                  type="text"
                  value={emailsData.email_alertas}
                  onChange={(e) => handleEmailChange('email_alertas', e.target.value)}
                  placeholder="oaeroportos@sga.co.ao"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Recebe erros do servidor, do frontend e falhas nos relatórios automáticos (agrupados, no máx. 1 por tipo/hora).</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_notificacao_acessos">Notificação de novos acessos</Label>
                <Input
                  id="email_notificacao_acessos"
                  type="text"
                  value={emailsData.email_notificacao_acessos}
                  onChange={(e) => handleEmailChange('email_notificacao_acessos', e.target.value)}
                  placeholder="oaeroportos@sga.co.ao"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Avisado quando alguém solicita/cria acesso. Vários emails separados por vírgula.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_suporte">Suporte / tickets</Label>
                <Input
                  id="email_suporte"
                  type="text"
                  value={emailsData.email_suporte}
                  onChange={(e) => handleEmailChange('email_suporte', e.target.value)}
                  placeholder="oaeroportos@sga.co.ao"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Recebe cada novo ticket do formulário de Suporte e as reclamações públicas.</p>
              </div>

              {/* Campo dedicado: para onde vão as notificações de registros */}
              <div className="space-y-2">
                <Label htmlFor="email_notificacao_registros">Notificações de registros</Label>
                <Input
                  id="email_notificacao_registros"
                  type="text"
                  value={emailsData.email_notificacao_registros}
                  onChange={(e) => handleEmailChange('email_notificacao_registros', e.target.value)}
                  placeholder="oaeroportos@sga.co.ao"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Recebe os avisos de criação/edição de aeronave, aeroporto e companhia. Vários emails separados por vírgula. Vazio = usa o "Notificação de novos acessos".</p>
              </div>

              {/* Matriz: o que enviar (por tipo × ação) */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="pb-1">
                  <Label className="font-medium">O que enviar (por tipo × ação)</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Liga/desliga cada aviso enviado ao email de "Notificações de registros" acima. (Tickets e comunicados não são afetados.)
                  </p>
                </div>
                {[
                  { key: 'registo', label: 'Aeronave (registo)' },
                  { key: 'aeroporto', label: 'Aeroporto' },
                  { key: 'companhia', label: 'Companhia' },
                ].map((ent) => (
                  <div key={ent.key} className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 py-2">
                    <span className="text-sm font-medium">{ent.label}</span>
                    <div className="flex items-center gap-5">
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        Criação
                        <Switch
                          checked={emailsData.notificacoes_registros?.[ent.key]?.criacao !== false}
                          onCheckedChange={(v) => handleNotifChange(ent.key, 'criacao', v)}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        Edição
                        <Switch
                          checked={emailsData.notificacoes_registros?.[ent.key]?.edicao !== false}
                          onCheckedChange={(v) => handleNotifChange(ent.key, 'edicao', v)}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {emailsForaSga.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {emailsForaSga.join(', ')} não {emailsForaSga.length > 1 ? 'são' : 'é'} @sga.co.ao — o relay da SGA <strong>não entrega</strong> a endereços externos. Esses avisos não vão chegar.
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveEmails} disabled={saveMutation.isPending} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? 'A guardar...' : 'Guardar emails'}
                </Button>
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
