import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserCog, CheckCircle, User, Mail, Shield, Phone, Save, Edit2, X, MessageSquare, ArrowLeft, Trash2, AlertTriangle } from 'lucide-react';
import DeleteAccountModal from '@/components/shared/DeleteAccountModal';
import { User as UserEntity } from '@/entities/User';
import { Aeroporto } from '@/entities/Aeroporto';
import { base44 } from '@/api/base44Client';
import { getAeroportosPermitidos } from '@/components/lib/userUtils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useI18n } from '@/components/lib/i18n';

export default function ConfigurarPerfil() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSendingOptIn, setIsSendingOptIn] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [aeroportosPermitidos, setAeroportosPermitidos] = useState([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  
  const [formData, setFormData] = useState({
    full_name: '',
    telefone: '',
    whatsapp_number: ''
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await UserEntity.me();
      setUser(currentUser);

      // Carregar aeroportos permitidos (empresa-based)
      const allAeroportos = await Aeroporto.list();
      const permitidos = getAeroportosPermitidos(currentUser, allAeroportos);
      setAeroportosPermitidos(permitidos);

      // Preencher o formulário com os dados atuais
      // Remover prefixo "whatsapp:" para exibição
      let whatsappDisplay = currentUser.whatsapp_number || '';
      if (whatsappDisplay.startsWith('whatsapp:')) {
        whatsappDisplay = whatsappDisplay.replace('whatsapp:', '');
      }
      
      setFormData({
        full_name: currentUser.full_name || '',
        telefone: currentUser.telefone || '',
        whatsapp_number: whatsappDisplay
      });
      
      // Check MFA status
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactor = factors?.totp?.find(f => f.status === 'verified');
        setMfaEnabled(!!totpFactor);
      } catch (e) {
        console.warn('[MFA] Could not check MFA status:', e.message);
      }

    } catch (error) {
      console.error('Erro ao carregar utilizador:', error);
      setError(t('perfil.erroCarregar'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableMFA = async () => {
    setMfaLoading(true);
    setMfaError('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'DIROPS App' });
      if (error) throw error;
      setMfaSetupData(data);
    } catch (e) {
      setMfaError(e.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!mfaVerifyCode || mfaVerifyCode.length !== 6) {
      setMfaError(t('perfil.insira_codigo'));
      return;
    }
    setMfaLoading(true);
    setMfaError('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaSetupData.id });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaSetupData.id, challengeId: challenge.id, code: mfaVerifyCode });
      if (verifyError) throw verifyError;
      setMfaEnabled(true);
      setMfaSetupData(null);
      setMfaVerifyCode('');
      setSuccessMessage(t('perfil.2fa_ativada'));
    } catch (e) {
      setMfaError(e.message === 'Invalid TOTP code' ? 'Código inválido. Tente novamente.' : e.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    setMfaLoading(true);
    setMfaError('');
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find(f => f.status === 'verified');
      if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
        if (error) throw error;
      }
      setMfaEnabled(false);
      setSuccessMessage(t('perfil.2fa_desativada'));
    } catch (e) {
      setMfaError(e.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccessMessage('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setSuccessMessage('');
    // Restaurar dados originais (remover prefixo para exibição)
    let whatsappDisplay = user.whatsapp_number || '';
    if (whatsappDisplay.startsWith('whatsapp:')) {
      whatsappDisplay = whatsappDisplay.replace('whatsapp:', '');
    }
    
    setFormData({
      full_name: user.full_name || '',
      telefone: user.telefone || '',
      whatsapp_number: whatsappDisplay
    });
  };

  const handleSave = async () => {
    setError('');
    setSuccessMessage('');
    
    // Validações
    if (!formData.full_name || formData.full_name.trim() === '') {
      setError(t('perfil.nome_erro'));
      return;
    }

    setIsSaving(true);
    
    try {
      // Preparar número de WhatsApp (adicionar prefixo se necessário)
      let whatsappNumber = formData.whatsapp_number?.trim() || '';
      if (whatsappNumber && !whatsappNumber.startsWith('whatsapp:')) {
        whatsappNumber = `whatsapp:${whatsappNumber}`;
      }
      
      // Verificar se o número de WhatsApp foi alterado
      const whatsappAlterado = whatsappNumber !== user.whatsapp_number;
      
      // Preparar dados para atualização
      const updateData = {
        full_name: formData.full_name.trim(),
        telefone: formData.telefone?.trim() || '',
        whatsapp_number: whatsappNumber
      };
      
      // Se o WhatsApp foi alterado, resetar o status de opt-in E a data
      if (whatsappAlterado && whatsappNumber) {
        updateData.whatsapp_opt_in_status = null;
        updateData.whatsapp_opt_in_date = null;
      }
      
      // Atualizar apenas os campos editáveis
      await base44.auth.updateMe(updateData);

      // Recarregar dados do utilizador
      const updatedUser = await UserEntity.me();
      setUser(updatedUser);
      
      setIsEditing(false);
      setSuccessMessage(t('perfil.dados_atualizados'));
      
      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      setError(`${t('perfil.erroAtualizar')}: ${error.message || t('perfil.tenteNovamente')}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSolicitarOptIn = async () => {
    setError('');
    setSuccessMessage('');
    
    // Validar se tem WhatsApp configurado
    if (!user.whatsapp_number || user.whatsapp_number.trim() === '') {
      setError(t('perfil.optin_erro'));
      return;
    }
    
    setIsSendingOptIn(true);
    
    try {
      const response = await base44.functions.invoke('enviarOptInWhatsApp', { 
        user_id: user.id 
      });
      
      if (response.data && response.data.sucesso) {
        // Recarregar dados do utilizador
        const updatedUser = await UserEntity.me();
        setUser(updatedUser);
        
        setSuccessMessage(t('perfil.optin_enviada'));
      }
    } catch (error) {
      console.error('Erro ao enviar opt-in:', error);
      setError(`${t('perfil.erroOptin')}: ${error.message || t('perfil.tenteNovamente')}`);
    } finally {
      setIsSendingOptIn(false);
    }
  };
  
  const getPerfilLabel = (perfil) => {
    const labels = {
      'administrador': t('configPerfil.perfilAdmin'),
      'operacoes': t('configPerfil.perfilOps'),
      'safety': 'Safety',
      'infraestrutura': t('configPerfil.perfilInfra'),
      'credenciamento': t('configPerfil.perfilCred'),
      'gestor_empresa': t('configPerfil.perfilGestor'),
      'visualizador': t('configPerfil.perfilVisualizador')
    };
    return labels[perfil] || perfil;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 dark:text-blue-400" />
          <p className="mt-2 text-slate-600 dark:text-slate-400">{t('perfil.carregando')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            className="gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('perfil.voltar')}
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCog className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('perfil.titulo')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {t('perfil.subtitulo')}
          </p>
        </div>

        {/* Mensagens de Sucesso e Erro */}
        {successMessage && (
          <Alert className="mb-6 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-900 dark:text-green-100 ml-2">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Informações Editáveis */}
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              {t('perfil.info_pessoais')}
            </CardTitle>
            {!isEditing && (
              <Button
                onClick={handleEdit}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Edit2 className="w-4 h-4" />
                {t('perfil.editar')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="full_name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('perfil.nome_obrigatorio')}
                  </Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder={t('perfil.nome_placeholder')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="telefone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('perfil.telefone')}
                  </Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="+244 XXX XXX XXX"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp_number" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                    {t('perfil.whatsapp')}
                  </Label>
                  <Input
                    id="whatsapp_number"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    placeholder={t('perfil.whatsapp_placeholder')}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t('perfil.whatsapp_info')}
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('perfil.guardando')}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {t('perfil.guardar')}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    {t('perfil.cancelar')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('perfil.nome_completo')}</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{user.full_name || t('perfil.nao_informado')}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Phone className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('perfil.telefone')}</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{user.telefone || t('perfil.nao_informado')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg md:col-span-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('perfil.whatsapp_notificacoes')}</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{user.whatsapp_number || t('perfil.nao_configurado')}</p>
                    {user.whatsapp_opt_in_status && (
                      <p className="text-xs mt-1">
                        {user.whatsapp_opt_in_status === 'confirmado' && (
                          <span className="text-green-600">✓ {t('perfil.confirmado')}</span>
                        )}
                        {user.whatsapp_opt_in_status === 'pendente' && (
                          <span className="text-yellow-600">⏳ {t('perfil.aguardando')}</span>
                        )}
                        {user.whatsapp_opt_in_status === 'rejeitado' && (
                          <span className="text-red-600">✗ {t('perfil.rejeitado')}</span>
                        )}
                      </p>
                    )}
                  </div>
                  {user.whatsapp_number && user.whatsapp_opt_in_status !== 'confirmado' && (
                    <Button
                      onClick={handleSolicitarOptIn}
                      disabled={isSendingOptIn}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isSendingOptIn ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {t('perfil.enviando')}
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {user.whatsapp_opt_in_status === 'pendente' ? t('perfil.reenviar_optin') : t('perfil.enviar_optin')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações da Conta (Apenas Visualização) */}
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-600" />
              {t('perfil.info_acesso')}
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {t('perfil.info_acesso_desc')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <Mail className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('configPerfil.email')}</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('perfil.perfis_acesso')}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.perfis && user.perfis.length > 0 ? (
                      user.perfis.map((perfil, index) => (
                        <span key={index} className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                          {getPerfilLabel(perfil)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-600 dark:text-slate-400">{t('perfil.nenhum_perfil')}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg md:col-span-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('configPerfil.status')}</p>
                  <p className="font-medium text-green-700 dark:text-green-400 capitalize">{user.status || t('perfil.statusAtivo')}</p>
                </div>
              </div>
            </div>

            {aeroportosPermitidos.length > 0 && (
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-500 mb-2">{t('perfil.aeroportos_acesso')}</p>
                <div className="flex flex-wrap gap-2">
                  {aeroportosPermitidos.map(aeroporto => (
                    <span key={aeroporto.id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {aeroporto.codigo_icao} - {aeroporto.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('perfil.alteracoes_info')}
          </p>
        </div>

        {/* 2FA / MFA */}
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              {t('perfil.2fa_titulo')}
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {t('perfil.2fa_desc')}
            </p>
          </CardHeader>
          <CardContent>
            {mfaError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{mfaError}</AlertDescription>
              </Alert>
            )}

            {mfaEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">{t('perfil.2fa_ativo')}</p>
                    <p className="text-sm text-green-700 dark:text-green-300">{t('perfil.2fa_ativo_desc')}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleDisableMFA}
                  disabled={mfaLoading}
                >
                  {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('perfil.desativar_2fa')}
                </Button>
              </div>
            ) : mfaSetupData ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('perfil.2fa_instrucoes')}
                </p>
                <div className="flex justify-center p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg">
                  <img src={mfaSetupData.totp.qr_code} alt="QR Code 2FA" className="w-48 h-48" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center break-all">
                  {t('perfil.chave_manual')} <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{mfaSetupData.totp.secret}</code>
                </p>
                <div>
                  <Label className="text-sm">{t('perfil.codigo_verificacao')}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={mfaVerifyCode}
                      onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-32 text-center text-lg tracking-widest"
                    />
                    <Button
                      onClick={handleVerifyMFA}
                      disabled={mfaLoading || mfaVerifyCode.length !== 6}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {t('perfil.verificar_ativar')}
                    </Button>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setMfaSetupData(null); setMfaVerifyCode(''); setMfaError(''); }}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  {t('perfil.2fa_info')}
                </p>
                <Button
                  onClick={handleEnableMFA}
                  disabled={mfaLoading}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {t('perfil.ativar_2fa')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="shadow-lg border border-red-200 dark:border-red-800 mt-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-red-700 dark:text-red-400">
              <Trash2 className="w-5 h-5" />
              {t('perfil.eliminar_conta')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg mb-4 border border-red-100 dark:border-red-800">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{t('perfil.eliminar_permanente')}</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {t('perfil.eliminar_desc')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('perfil.eliminar_minha_conta')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userEmail={user?.email}
        onConfirm={() => {
          setShowDeleteModal(false);
          window.open(
            `mailto:suporte@sga.ao?subject=Pedido%20de%20Eliminação%20de%20Conta&body=Olá,%20confirmo%20que%20desejo%20eliminar%20a%20minha%20conta.%20Email%3A%20${encodeURIComponent(user?.email || '')}`,
            '_blank'
          );
          setSuccessMessage(t('perfil.pedidoEnviado'));
        }}
      />
    </div>
  );
}