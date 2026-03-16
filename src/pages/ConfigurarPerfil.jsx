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
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

export default function ConfigurarPerfil() {
  const navigate = useNavigate();
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
      setError('Erro ao carregar dados do utilizador.');
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
      setMfaError('Insira o código de 6 dígitos.');
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
      setSuccessMessage('Autenticação de dois fatores ativada com sucesso!');
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
      setSuccessMessage('Autenticação de dois fatores desativada.');
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
      setError('O nome completo é obrigatório.');
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
      setSuccessMessage('Os seus dados foram atualizados com sucesso!');
      
      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      setError(`Erro ao atualizar os seus dados: ${error.message || 'Tente novamente.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSolicitarOptIn = async () => {
    setError('');
    setSuccessMessage('');
    
    // Validar se tem WhatsApp configurado
    if (!user.whatsapp_number || user.whatsapp_number.trim() === '') {
      setError('Configure o seu número de WhatsApp antes de solicitar o opt-in.');
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
        
        setSuccessMessage('Solicitação de opt-in enviada! Verifique o seu WhatsApp e responda SIM para confirmar.');
      }
    } catch (error) {
      console.error('Erro ao enviar opt-in:', error);
      setError(`Erro ao enviar solicitação: ${error.message || 'Tente novamente.'}`);
    } finally {
      setIsSendingOptIn(false);
    }
  };
  
  const getPerfilLabel = (perfil) => {
    const labels = {
      'administrador': 'Administrador',
      'operacoes': 'Operações',
      'infraestrutura': 'Infraestrutura', 
      'credenciamento': 'Credenciamento',
      'gestor_empresa': 'Gestor de Empresa',
      'visualizador': 'Visualizador'
    };
    return labels[perfil] || perfil;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-slate-600">A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            className="gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCog className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Configurações da Conta</h1>
          <p className="text-slate-600 mt-2">
            Consulte e atualize as suas informações pessoais.
          </p>
        </div>

        {/* Mensagens de Sucesso e Erro */}
        {successMessage && (
          <Alert className="mb-6 border-green-300 bg-green-50">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-900 ml-2">
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
              <User className="w-5 h-5 text-slate-600" />
              Informações Pessoais
            </CardTitle>
            {!isEditing && (
              <Button
                onClick={handleEdit}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="full_name" className="text-sm font-medium text-slate-700">
                    Nome Completo *
                  </Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Digite o seu nome completo"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="telefone" className="text-sm font-medium text-slate-700">
                    Telefone
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
                    WhatsApp (para notificações)
                  </Label>
                  <Input
                    id="whatsapp_number"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    placeholder="+244923456789"
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Digite apenas o número com código do país (ex: +244923456789)
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
                        A guardar...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Guardar Alterações
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
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <User className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-500">Nome Completo</p>
                    <p className="font-medium text-slate-900">{user.full_name || 'Não informado'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Phone className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-500">Telefone</p>
                    <p className="font-medium text-slate-900">{user.telefone || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg md:col-span-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-500">WhatsApp (Notificações)</p>
                    <p className="font-medium text-slate-900">{user.whatsapp_number || 'Não configurado'}</p>
                    {user.whatsapp_opt_in_status && (
                      <p className="text-xs mt-1">
                        {user.whatsapp_opt_in_status === 'confirmado' && (
                          <span className="text-green-600">✓ Confirmado para receber notificações</span>
                        )}
                        {user.whatsapp_opt_in_status === 'pendente' && (
                          <span className="text-yellow-600">⏳ Aguardando confirmação</span>
                        )}
                        {user.whatsapp_opt_in_status === 'rejeitado' && (
                          <span className="text-red-600">✗ Rejeitado</span>
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
                          A enviar...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {user.whatsapp_opt_in_status === 'pendente' ? 'Reenviar Opt-in' : 'Solicitar Opt-in'}
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
              Informações de Acesso
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Estes dados são geridos pelos administradores do sistema.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Mail className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Shield className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-500">Perfis de Acesso</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.perfis && user.perfis.length > 0 ? (
                      user.perfis.map((perfil, index) => (
                        <span key={index} className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                          {getPerfilLabel(perfil)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-600">Nenhum perfil atribuído</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg md:col-span-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <p className="font-medium text-green-700 capitalize">{user.status || 'Ativo'}</p>
                </div>
              </div>
            </div>

            {aeroportosPermitidos.length > 0 && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-2">Aeroportos com Acesso</p>
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
          <p className="text-sm text-slate-500">
            Para alterações no perfil de acesso, aeroportos ou outros dados geridos pelos administradores, por favor contacte a equipa de gestão do sistema.
          </p>
        </div>

        {/* 2FA / MFA */}
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Autenticação de Dois Fatores (2FA)
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Adicione uma camada extra de segurança à sua conta.
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
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">2FA Ativo</p>
                    <p className="text-sm text-green-700">A sua conta está protegida com autenticação de dois fatores.</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleDisableMFA}
                  disabled={mfaLoading}
                >
                  {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Desativar 2FA
                </Button>
              </div>
            ) : mfaSetupData ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Abra o seu aplicativo autenticador (Google Authenticator, Authy, etc.) e digitalize o código QR abaixo:
                </p>
                <div className="flex justify-center p-4 bg-white border rounded-lg">
                  <img src={mfaSetupData.totp.qr_code} alt="QR Code 2FA" className="w-48 h-48" />
                </div>
                <p className="text-xs text-slate-500 text-center break-all">
                  Chave manual: <code className="bg-slate-100 px-1 rounded">{mfaSetupData.totp.secret}</code>
                </p>
                <div>
                  <Label className="text-sm">Código de verificação</Label>
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
                      Verificar e Ativar
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
                  A autenticação de dois fatores adiciona segurança extra ao exigir um código do seu telemóvel além da senha.
                </p>
                <Button
                  onClick={handleEnableMFA}
                  disabled={mfaLoading}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Ativar 2FA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="shadow-lg border border-red-200 mt-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              Eliminar Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg mb-4 border border-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Esta ação é permanente e irreversível</p>
                <p className="text-sm text-red-700 mt-1">
                  Ao eliminar a sua conta, todos os seus dados pessoais serão removidos do sistema e o seu acesso será revogado imediatamente.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar a Minha Conta
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
          setSuccessMessage('Pedido enviado. Receberá uma confirmação por email em breve.');
        }}
      />
    </div>
  );
}