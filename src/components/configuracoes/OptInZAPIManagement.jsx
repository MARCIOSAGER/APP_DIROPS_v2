import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Plus, X, MessageSquare, CheckCircle, XCircle, RefreshCw, Power, QrCode, Users, User } from 'lucide-react';
import { ConfiguracaoOptInZAPI } from '@/entities/ConfiguracaoOptInZAPI';
import { base44 } from '@/api/base44Client';

export default function OptInZAPIManagement({ onError, onSuccess }) {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    palavras_chave_opt_in: ['sim', 'aceito', 'yes', 'ok', 'concordo'],
    palavras_chave_opt_out: ['parar', 'cancelar', 'stop', 'sair', 'remover'],
    mensagem_confirmacao_opt_in: '✅ Confirmado! Você está inscrito para receber notificações do DIROPS via WhatsApp.',
    mensagem_confirmacao_opt_out: '✅ Você foi removido da lista de notificações. Para voltar a receber, envie SIM.',
    mensagem_boas_vindas: 'Olá! 👋 Para receber notificações operacionais do DIROPS via WhatsApp, responda com SIM.',
    enviar_resposta_automatica: true,
    ativo: true,
    grupos_palavras_registrar: ['registrar_grupo', 'registrar grupo', 'ativar_grupo', 'ativar grupo'],
    grupos_palavras_parar: ['parar_notificacoes', 'parar notificacoes', 'desativar_notificacoes', 'cancelar_notificacoes'],
    grupos_mensagem_registro_sucesso: '✅ Grupo registrado com sucesso no sistema DIROPS!\n\n📋 O registo está pendente de aprovação.\n\n⏳ Aguarde que um administrador aprove o grupo para começar a receber notificações automáticas.',
    grupos_mensagem_ja_registrado: '✅ Este grupo já está registrado no sistema DIROPS.\n\nAguarde a aprovação de um administrador para começar a receber notificações.',
    grupos_mensagem_desativacao: '🔕 Notificações desativadas com sucesso!\n\nEste grupo não receberá mais notificações automáticas do sistema DIROPS.\n\nPara reativar, envie: REGISTRAR_GRUPO',
    grupos_mensagem_nao_encontrado: '⚠️ Este grupo não está registrado no sistema.'
  });

  const [newOptInWord, setNewOptInWord] = useState('');
  const [newOptOutWord, setNewOptOutWord] = useState('');
  const [newGrupoRegistrarWord, setNewGrupoRegistrarWord] = useState('');
  const [newGrupoPararWord, setNewGrupoPararWord] = useState('');
  const [isRestarting, setIsRestarting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneData, setPhoneData] = useState(null);
  const [isLoadingPhone, setIsLoadingPhone] = useState(false);
  const [showRejectCallsModal, setShowRejectCallsModal] = useState(false);
  const [rejectCallsValue, setRejectCallsValue] = useState(false);
  const [isUpdatingRejectCalls, setIsUpdatingRejectCalls] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const configs = await ConfiguracaoOptInZAPI.list();
      if (configs.length > 0) {
        const cfg = configs[0];
        setConfig(cfg);
        setFormData({
          palavras_chave_opt_in: cfg.palavras_chave_opt_in || [],
          palavras_chave_opt_out: cfg.palavras_chave_opt_out || [],
          mensagem_confirmacao_opt_in: cfg.mensagem_confirmacao_opt_in || '',
          mensagem_confirmacao_opt_out: cfg.mensagem_confirmacao_opt_out || '',
          mensagem_boas_vindas: cfg.mensagem_boas_vindas || '',
          enviar_resposta_automatica: cfg.enviar_resposta_automatica !== false,
          ativo: cfg.ativo !== false,
          grupos_palavras_registrar: cfg.grupos_palavras_registrar || ['registrar_grupo', 'registrar grupo'],
          grupos_palavras_parar: cfg.grupos_palavras_parar || ['parar_notificacoes', 'parar notificacoes'],
          grupos_mensagem_registro_sucesso: cfg.grupos_mensagem_registro_sucesso || '',
          grupos_mensagem_ja_registrado: cfg.grupos_mensagem_ja_registrado || '',
          grupos_mensagem_desativacao: cfg.grupos_mensagem_desativacao || '',
          grupos_mensagem_nao_encontrado: cfg.grupos_mensagem_nao_encontrado || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      onError('Não foi possível carregar as configurações de opt-in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (config) {
        await ConfiguracaoOptInZAPI.update(config.id, formData);
      } else {
        const created = await ConfiguracaoOptInZAPI.create(formData);
        setConfig(created);
      }
      onSuccess('Configurações de opt-in salvas com sucesso!');
      await loadConfig();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      onError(error.message || 'Não foi possível salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const addOptInWord = () => {
    if (newOptInWord.trim() && !formData.palavras_chave_opt_in.includes(newOptInWord.toLowerCase().trim())) {
      setFormData(prev => ({
        ...prev,
        palavras_chave_opt_in: [...prev.palavras_chave_opt_in, newOptInWord.toLowerCase().trim()]
      }));
      setNewOptInWord('');
    }
  };

  const removeOptInWord = (word) => {
    setFormData(prev => ({
      ...prev,
      palavras_chave_opt_in: prev.palavras_chave_opt_in.filter(w => w !== word)
    }));
  };

  const addOptOutWord = () => {
    if (newOptOutWord.trim() && !formData.palavras_chave_opt_out.includes(newOptOutWord.toLowerCase().trim())) {
      setFormData(prev => ({
        ...prev,
        palavras_chave_opt_out: [...prev.palavras_chave_opt_out, newOptOutWord.toLowerCase().trim()]
      }));
      setNewOptOutWord('');
    }
  };

  const removeOptOutWord = (word) => {
    setFormData(prev => ({
      ...prev,
      palavras_chave_opt_out: prev.palavras_chave_opt_out.filter(w => w !== word)
    }));
  };

  const addGrupoRegistrarWord = () => {
    if (newGrupoRegistrarWord.trim() && !formData.grupos_palavras_registrar.includes(newGrupoRegistrarWord.toLowerCase().trim())) {
      setFormData(prev => ({
        ...prev,
        grupos_palavras_registrar: [...prev.grupos_palavras_registrar, newGrupoRegistrarWord.toLowerCase().trim()]
      }));
      setNewGrupoRegistrarWord('');
    }
  };

  const removeGrupoRegistrarWord = (word) => {
    setFormData(prev => ({
      ...prev,
      grupos_palavras_registrar: prev.grupos_palavras_registrar.filter(w => w !== word)
    }));
  };

  const addGrupoPararWord = () => {
    if (newGrupoPararWord.trim() && !formData.grupos_palavras_parar.includes(newGrupoPararWord.toLowerCase().trim())) {
      setFormData(prev => ({
        ...prev,
        grupos_palavras_parar: [...prev.grupos_palavras_parar, newGrupoPararWord.toLowerCase().trim()]
      }));
      setNewGrupoPararWord('');
    }
  };

  const removeGrupoPararWord = (word) => {
    setFormData(prev => ({
      ...prev,
      grupos_palavras_parar: prev.grupos_palavras_parar.filter(w => w !== word)
    }));
  };

  const handleReiniciarInstancia = async () => {
    if (!confirm('Tem certeza que deseja reiniciar a instância Z-API? Isso pode interromper temporariamente o envio de mensagens.')) {
      return;
    }

    setIsRestarting(true);
    try {
      const response = await base44.functions.invoke('zapiReiniciarInstancia');
      
      if (response.data.success) {
        onSuccess('Instância reiniciada com sucesso! Aguarde alguns segundos para reconectar.');
      } else {
        throw new Error(response.data.error || 'Erro ao reiniciar instância');
      }
    } catch (error) {
      console.error('Erro ao reiniciar instância:', error);
      onError(error.message || 'Não foi possível reiniciar a instância.');
    } finally {
      setIsRestarting(false);
    }
  };

  const handleDesconectarInstancia = async () => {
    if (!confirm('Tem certeza que deseja desconectar a instância Z-API? Você precisará ler o QR Code novamente para reconectar.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const response = await base44.functions.invoke('zapiDesconectarInstancia');
      
      if (response.data.success) {
        onSuccess('Instância desconectada com sucesso! Será necessário reconectar usando QR Code.');
      } else {
        throw new Error(response.data.error || 'Erro ao desconectar instância');
      }
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      onError(error.message || 'Não foi possível desconectar a instância.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleObterQRCode = async () => {
    setIsLoadingQR(true);
    setQrCodeData(null);
    try {
      const response = await base44.functions.invoke('zapiObterQRCode');
      console.log('Resposta obter QR Code:', response.data);

      if (response.data.success && response.data.data) {
        setQrCodeData(response.data.data);
        setShowQRModal(true);
      } else {
        throw new Error(response.data.error || 'Erro ao obter QR Code');
      }
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      onError(error.message || 'Não foi possível obter o QR Code. A instância pode já estar conectada.');
    } finally {
      setIsLoadingQR(false);
    }
  };

  const handleObterStatus = async () => {
    try {
      const response = await base44.functions.invoke('zapiStatusInstancia');

      if (response.data.success) {
        setStatusData(response.data.data);
        setShowStatusModal(true);
      } else {
        throw new Error(response.data.error || 'Erro ao obter status');
      }
    } catch (error) {
      console.error('Erro ao obter status:', error);
      onError(error.message || 'Não foi possível obter o status da instância.');
    }
  };

  const handleAtualizarNome = async () => {
    if (!newName.trim()) {
      onError('Por favor, insira um nome válido.');
      return;
    }

    setIsUpdatingName(true);
    try {
      const response = await base44.functions.invoke('zapiAtualizarNomePerfil', { name: newName });

      if (response.data.success) {
        onSuccess('Nome do perfil atualizado com sucesso!');
        setShowNameModal(false);
        setNewName('');
      } else {
        throw new Error(response.data.error || 'Erro ao atualizar nome');
      }
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      onError(error.message || 'Não foi possível atualizar o nome do perfil.');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleObterDadosCelular = async () => {
    setIsLoadingPhone(true);
    setPhoneData(null);
    try {
      const response = await base44.functions.invoke('zapiDadosCelular');

      if (response.data.success) {
        setPhoneData(response.data.data);
        setShowPhoneModal(true);
      } else {
        throw new Error(response.data.error || 'Erro ao obter dados');
      }
    } catch (error) {
      console.error('Erro ao obter dados do celular:', error);
      onError(error.message || 'Não foi possível obter os dados do celular.');
    } finally {
      setIsLoadingPhone(false);
    }
  };

  const handleRejeitarChamadas = async () => {
    setIsUpdatingRejectCalls(true);
    try {
      const response = await base44.functions.invoke('zapiRejeitarChamadas', { value: rejectCallsValue });

      if (response.data.success) {
        onSuccess(response.data.message);
        setShowRejectCallsModal(false);
      } else {
        throw new Error(response.data.error || 'Erro ao configurar rejeição de chamadas');
      }
    } catch (error) {
      console.error('Erro ao configurar rejeição de chamadas:', error);
      onError(error.message || 'Não foi possível configurar a rejeição de chamadas.');
    } finally {
      setIsUpdatingRejectCalls(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-slate-600">A carregar configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card de Gestão da Instância */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
            <Power className="w-5 h-5" />
            Gestão da Instância Z-API
          </CardTitle>
          <CardDescription className="text-blue-700">
            Controle e manutenção da sua instância conectada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={handleObterQRCode}
              disabled={isLoadingQR}
              variant="outline"
              className="w-full border-green-600 text-green-700 hover:bg-green-100"
            >
              {isLoadingQR ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  A carregar...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Pegar QRCode
                </>
              )}
            </Button>

            <Button
              onClick={handleReiniciarInstancia}
              disabled={isRestarting}
              variant="outline"
              className="w-full border-blue-600 text-blue-700 hover:bg-blue-100"
            >
              {isRestarting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  A reiniciar...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reiniciar instância
                </>
              )}
            </Button>

            <Button
              onClick={handleDesconectarInstancia}
              disabled={isDisconnecting}
              variant="outline"
              className="w-full border-red-600 text-red-700 hover:bg-red-100"
            >
              {isDisconnecting ? (
                <>
                  <Power className="w-4 h-4 mr-2 animate-spin" />
                  A desconectar...
                </>
              ) : (
                <>
                  <Power className="w-4 h-4 mr-2" />
                  Desconectar
                </>
              )}
            </Button>

            <Button
              onClick={handleObterStatus}
              variant="outline"
              className="w-full border-slate-600 text-slate-700 hover:bg-slate-100"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Status da instância
            </Button>

            <Button
              onClick={() => setShowNameModal(true)}
              variant="outline"
              className="w-full border-purple-600 text-purple-700 hover:bg-purple-100"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Atualizar nome do perfil
            </Button>

            <Button
              onClick={() => setShowRejectCallsModal(true)}
              variant="outline"
              className="w-full border-orange-600 text-orange-700 hover:bg-orange-100"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rejeitar chamadas
            </Button>

            <Button
              onClick={handleObterDadosCelular}
              disabled={isLoadingPhone}
              variant="outline"
              className="w-full border-teal-600 text-teal-700 hover:bg-teal-100"
            >
              {isLoadingPhone ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  A carregar...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Dados do celular
                </>
              )}
            </Button>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Atenção:</strong> Reiniciar pode resolver problemas temporários. Desconectar requer reconexão via QR Code.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal QR Code */}
      {showQRModal && qrCodeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-900">QR Code Z-API</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-4">
              {qrCodeData && (
                <>
                  {qrCodeData.value && (
                    <img 
                      src={qrCodeData.value} 
                      alt="QR Code Z-API" 
                      className="mx-auto border-4 border-slate-200 rounded-lg max-w-xs"
                    />
                  )}

                  {!qrCodeData.value && qrCodeData.qrcode && (
                    <img 
                      src={qrCodeData.qrcode} 
                      alt="QR Code Z-API" 
                      className="mx-auto border-4 border-slate-200 rounded-lg max-w-xs"
                    />
                  )}

                  {!qrCodeData.value && !qrCodeData.qrcode && (
                    <div className="text-xs text-slate-500 p-3 bg-slate-100 rounded">
                      <pre>{JSON.stringify(qrCodeData, null, 2)}</pre>
                    </div>
                  )}
                </>
              )}

              <p className="text-sm text-slate-600">
                Escaneie este QR Code com o WhatsApp no seu telemóvel para conectar a instância.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Como conectar:</strong><br/>
                  1. Abra o WhatsApp no telemóvel<br/>
                  2. Vá em Configurações → Aparelhos conectados<br/>
                  3. Toque em "Conectar um aparelho"<br/>
                  4. Aponte a câmera para este QR Code
                </p>
              </div>

              <Button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Status */}
      {showStatusModal && statusData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Status da Instância</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap">{JSON.stringify(statusData, null, 2)}</pre>
              </div>

              <Button onClick={() => setShowStatusModal(false)} className="w-full bg-blue-600 hover:bg-blue-700">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atualizar Nome */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Atualizar Nome do Perfil</h3>
              <button onClick={() => setShowNameModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Novo nome do perfil"
                className="w-full"
              />

              <div className="flex gap-2">
                <Button onClick={() => setShowNameModal(false)} variant="outline" className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleAtualizarNome} disabled={isUpdatingName} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  {isUpdatingName ? 'A atualizar...' : 'Atualizar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dados do Celular */}
      {showPhoneModal && phoneData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Dados do Celular</h3>
              <button onClick={() => setShowPhoneModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap">{JSON.stringify(phoneData, null, 2)}</pre>
              </div>

              <Button onClick={() => setShowPhoneModal(false)} className="w-full bg-blue-600 hover:bg-blue-700">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rejeitar Chamadas */}
      {showRejectCallsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Rejeitar Chamadas</h3>
              <button onClick={() => setShowRejectCallsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Configure se a instância deve rejeitar automaticamente chamadas de voz recebidas.
              </p>

              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <Switch
                  checked={rejectCallsValue}
                  onCheckedChange={setRejectCallsValue}
                />
                <Label>{rejectCallsValue ? 'Rejeitar chamadas' : 'Permitir chamadas'}</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setShowRejectCallsModal(false)} variant="outline" className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleRejeitarChamadas} disabled={isUpdatingRejectCalls} className="flex-1 bg-orange-600 hover:bg-orange-700">
                  {isUpdatingRejectCalls ? 'A guardar...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="usuarios" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Utilizadores
          </TabsTrigger>
          <TabsTrigger value="grupos" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Grupos
          </TabsTrigger>
        </TabsList>

        {/* Aba Utilizadores */}
        <TabsContent value="usuarios">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-green-900">
                <MessageSquare className="w-5 h-5" />
                Configuração de Opt-in - Utilizadores
              </CardTitle>
              <CardDescription className="text-green-700">
                Personalize as palavras-chave e mensagens automáticas do sistema de opt-in/opt-out para utilizadores individuais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Ativo */}
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-green-200">
                <div>
                  <Label className="text-base font-semibold text-slate-900">Sistema Ativo</Label>
                  <p className="text-sm text-slate-600 mt-1">
                    Ativar/desativar o processamento automático de opt-in e opt-out
                  </p>
                </div>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                />
              </div>

              {/* Palavras-chave Opt-in */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Palavras-chave para OPT-IN (Aceitar notificações)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={newOptInWord}
                    onChange={(e) => setNewOptInWord(e.target.value)}
                    placeholder="Nova palavra-chave..."
                    onKeyPress={(e) => e.key === 'Enter' && addOptInWord()}
                  />
                  <Button onClick={addOptInWord} variant="outline" size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.palavras_chave_opt_in.map((word) => (
                    <Badge key={word} variant="outline" className="bg-green-50 border-green-300 text-green-800">
                      {word}
                      <button
                        onClick={() => removeOptInWord(word)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Palavras-chave Opt-out */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Palavras-chave para OPT-OUT (Cancelar notificações)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={newOptOutWord}
                    onChange={(e) => setNewOptOutWord(e.target.value)}
                    placeholder="Nova palavra-chave..."
                    onKeyPress={(e) => e.key === 'Enter' && addOptOutWord()}
                  />
                  <Button onClick={addOptOutWord} variant="outline" size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.palavras_chave_opt_out.map((word) => (
                    <Badge key={word} variant="outline" className="bg-red-50 border-red-300 text-red-800">
                      {word}
                      <button
                        onClick={() => removeOptOutWord(word)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Mensagens automáticas */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Respostas Automáticas</Label>
                  <Switch
                    checked={formData.enviar_resposta_automatica}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviar_resposta_automatica: checked }))}
                  />
                </div>

                {formData.enviar_resposta_automatica && (
                  <>
                    <div>
                      <Label>Mensagem de Confirmação (Opt-in)</Label>
                      <Textarea
                        value={formData.mensagem_confirmacao_opt_in}
                        onChange={(e) => setFormData(prev => ({ ...prev, mensagem_confirmacao_opt_in: e.target.value }))}
                        placeholder="Mensagem enviada após opt-in..."
                        className="mt-2 h-20"
                      />
                    </div>

                    <div>
                      <Label>Mensagem de Confirmação (Opt-out)</Label>
                      <Textarea
                        value={formData.mensagem_confirmacao_opt_out}
                        onChange={(e) => setFormData(prev => ({ ...prev, mensagem_confirmacao_opt_out: e.target.value }))}
                        placeholder="Mensagem enviada após opt-out..."
                        className="mt-2 h-20"
                      />
                    </div>

                    <div>
                      <Label>Mensagem de Boas-vindas (Opcional)</Label>
                      <Textarea
                        value={formData.mensagem_boas_vindas}
                        onChange={(e) => setFormData(prev => ({ ...prev, mensagem_boas_vindas: e.target.value }))}
                        placeholder="Mensagem de boas-vindas ao primeiro contato..."
                        className="mt-2 h-20"
                      />
                    </div>
                  </>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'A guardar...' : 'Guardar Configurações'}
              </Button>

              {/* Instruções Utilizadores */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">ℹ️ Como funciona:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside ml-2">
                  <li>Quando um utilizador envia uma mensagem com qualquer palavra-chave de <strong>opt-in</strong>, ele será inscrito automaticamente</li>
                  <li>Quando enviar uma palavra-chave de <strong>opt-out</strong>, será removido da lista</li>
                  <li>As respostas automáticas confirmam a ação ao utilizador</li>
                  <li>As palavras-chave não são case-sensitive (maiúsculas/minúsculas ignoradas)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Grupos */}
        <TabsContent value="grupos">
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-purple-900">
                <Users className="w-5 h-5" />
                Configuração de Opt-in - Grupos WhatsApp
              </CardTitle>
              <CardDescription className="text-purple-700">
                Personalize palavras-chave e mensagens para registro e desativação de grupos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Palavras-chave Registrar Grupo */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Palavras-chave para REGISTRAR GRUPO
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={newGrupoRegistrarWord}
                    onChange={(e) => setNewGrupoRegistrarWord(e.target.value)}
                    placeholder="Nova palavra-chave..."
                    onKeyPress={(e) => e.key === 'Enter' && addGrupoRegistrarWord()}
                  />
                  <Button onClick={addGrupoRegistrarWord} variant="outline" size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.grupos_palavras_registrar?.map((word) => (
                    <Badge key={word} variant="outline" className="bg-green-50 border-green-300 text-green-800">
                      {word}
                      <button
                        onClick={() => removeGrupoRegistrarWord(word)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Palavras-chave Parar Notificações */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Palavras-chave para PARAR NOTIFICAÇÕES
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={newGrupoPararWord}
                    onChange={(e) => setNewGrupoPararWord(e.target.value)}
                    placeholder="Nova palavra-chave..."
                    onKeyPress={(e) => e.key === 'Enter' && addGrupoPararWord()}
                  />
                  <Button onClick={addGrupoPararWord} variant="outline" size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.grupos_palavras_parar?.map((word) => (
                    <Badge key={word} variant="outline" className="bg-red-50 border-red-300 text-red-800">
                      {word}
                      <button
                        onClick={() => removeGrupoPararWord(word)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Mensagens Automáticas de Grupos */}
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-base font-semibold">Mensagens Automáticas para Grupos</Label>

                <div>
                  <Label>Mensagem de Registro Bem-Sucedido</Label>
                  <Textarea
                    value={formData.grupos_mensagem_registro_sucesso}
                    onChange={(e) => setFormData(prev => ({ ...prev, grupos_mensagem_registro_sucesso: e.target.value }))}
                    placeholder="Mensagem quando grupo se registra..."
                    className="mt-2 h-24"
                  />
                </div>

                <div>
                  <Label>Mensagem - Grupo Já Registrado</Label>
                  <Textarea
                    value={formData.grupos_mensagem_ja_registrado}
                    onChange={(e) => setFormData(prev => ({ ...prev, grupos_mensagem_ja_registrado: e.target.value }))}
                    placeholder="Mensagem quando grupo já está registrado..."
                    className="mt-2 h-20"
                  />
                </div>

                <div>
                  <Label>Mensagem de Desativação</Label>
                  <Textarea
                    value={formData.grupos_mensagem_desativacao}
                    onChange={(e) => setFormData(prev => ({ ...prev, grupos_mensagem_desativacao: e.target.value }))}
                    placeholder="Mensagem quando grupo desativa notificações..."
                    className="mt-2 h-24"
                  />
                </div>

                <div>
                  <Label>Mensagem - Grupo Não Encontrado</Label>
                  <Textarea
                    value={formData.grupos_mensagem_nao_encontrado}
                    onChange={(e) => setFormData(prev => ({ ...prev, grupos_mensagem_nao_encontrado: e.target.value }))}
                    placeholder="Mensagem quando grupo não está registrado..."
                    className="mt-2 h-16"
                  />
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'A guardar...' : 'Guardar Configurações'}
              </Button>

              {/* Instruções Grupos */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">ℹ️ Como funciona:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside ml-2">
                  <li>Quando alguém envia uma palavra-chave de <strong>registrar grupo</strong>, o grupo é registrado como pendente</li>
                  <li>Um administrador precisa aprovar o grupo na página de gestão antes de receber notificações</li>
                  <li>O grupo pode desativar notificações enviando uma palavra-chave de <strong>parar notificações</strong></li>
                  <li>Para reativar, basta enviar novamente o comando de registrar grupo</li>
                  <li>As palavras-chave não são case-sensitive (maiúsculas/minúsculas ignoradas)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}