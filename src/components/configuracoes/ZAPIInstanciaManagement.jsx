import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Power, 
  QrCode, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  X,
  Phone
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ZAPIInstanciaManagement({ onError, onSuccess }) {
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

  return (
    <div className="space-y-6">
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
                  <Phone className="w-4 h-4 mr-2" />
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

      {/* Modais */}
      {showQRModal && qrCodeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-900">QR Code Z-API</h3>
              <button onClick={() => setShowQRModal(false)} className="text-slate-400 hover:text-slate-600">
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

              <Button onClick={() => setShowQRModal(false)} className="w-full bg-blue-600 hover:bg-blue-700">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}