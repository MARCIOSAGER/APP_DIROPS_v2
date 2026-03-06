import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  MessageCircle,
  Lock,
  Unlock,
  Archive,
  ArchiveRestore,
  Trash2,
  Star,
  StarOff,
  Eye,
  EyeOff,
  Check,
  CheckCheck,
  X
} from 'lucide-react';

export default function ZAPIChatManagement({ onError, onSuccess }) {
  const [showModal, setShowModal] = useState(null);

  const chatOptions = [
    { id: 'listar-chats', icon: MessageCircle, label: 'Listar chats', color: 'blue' },
    { id: 'obter-chat', icon: Eye, label: 'Obter chat por ID', color: 'indigo' },
    { id: 'arquivar', icon: Archive, label: 'Arquivar chat', color: 'yellow' },
    { id: 'desarquivar', icon: ArchiveRestore, label: 'Desarquivar chat', color: 'green' },
    { id: 'marcar-lido', icon: CheckCheck, label: 'Marcar como lido', color: 'teal' },
    { id: 'marcar-nao-lido', icon: Check, label: 'Marcar como não lido', color: 'slate' },
    { id: 'deletar-chat', icon: Trash2, label: 'Deletar chat', color: 'red' },
    { id: 'fixar', icon: Star, label: 'Fixar chat', color: 'amber' },
    { id: 'desfixar', icon: StarOff, label: 'Desfixar chat', color: 'orange' },
    { id: 'bloquear', icon: Lock, label: 'Bloquear contato', color: 'purple' },
    { id: 'desbloquear', icon: Unlock, label: 'Desbloquear contato', color: 'pink' },
    { id: 'presenca', icon: Eye, label: 'Obter presença', color: 'emerald' },
    { id: 'foto-perfil', icon: Eye, label: 'Obter foto do perfil', color: 'cyan' },
    { id: 'atualizar-presenca', icon: EyeOff, label: 'Atualizar presença', color: 'violet' }
  ];

  const renderModalContent = () => {
    const modalConfigs = {
      'listar-chats': {
        title: 'Listar Chats',
        description: 'Obtém a lista de todos os chats da instância',
        fields: []
      },
      'obter-chat': {
        title: 'Obter Chat por ID',
        fields: [
          { name: 'chatId', label: 'ID do Chat *', type: 'text', placeholder: '+244XXXXXXXXX@c.us' }
        ]
      },
      'arquivar': {
        title: 'Arquivar Chat',
        fields: [
          { name: 'phone', label: 'Número do Chat *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'desarquivar': {
        title: 'Desarquivar Chat',
        fields: [
          { name: 'phone', label: 'Número do Chat *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'marcar-lido': {
        title: 'Marcar Como Lido',
        fields: [
          { name: 'phone', label: 'Número do Chat *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'marcar-nao-lido': {
        title: 'Marcar Como Não Lido',
        fields: [
          { name: 'phone', label: 'Número do Chat *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'deletar-chat': {
        title: 'Deletar Chat',
        fields: [
          { name: 'phone', label: 'Número do Chat *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'fixar': {
        title: 'Fixar Chat',
        fields: [
          { name: 'phone', label: 'Número do Chat *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'desfixar': {
        title: 'Desfixar Chat',
        fields: [
          { name: 'phone', label: 'Número do Chat *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'bloquear': {
        title: 'Bloquear Contato',
        fields: [
          { name: 'phone', label: 'Número do Contato *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'desbloquear': {
        title: 'Desbloquear Contato',
        fields: [
          { name: 'phone', label: 'Número do Contato *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'presenca': {
        title: 'Obter Presença',
        description: 'Verifica se o contato está online',
        fields: [
          { name: 'phone', label: 'Número do Contato *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'foto-perfil': {
        title: 'Obter Foto do Perfil',
        fields: [
          { name: 'phone', label: 'Número do Contato *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'atualizar-presenca': {
        title: 'Atualizar Presença',
        description: 'Define o status de presença (disponível, ocupado, etc.)',
        fields: [
          { name: 'status', label: 'Status *', type: 'select', options: ['available', 'unavailable', 'composing', 'recording', 'paused'] }
        ]
      }
    };

    if (!showModal || !modalConfigs[showModal]) return null;

    const config = modalConfigs[showModal];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">{config.title}</h3>
              {config.description && (
                <p className="text-sm text-slate-600 mt-1">{config.description}</p>
              )}
            </div>
            <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            {config.fields.length > 0 ? (
              <>
                {config.fields.map((field, idx) => (
                  <div key={idx}>
                    <Label>{field.label}</Label>
                    {field.type === 'select' ? (
                      <select className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md">
                        <option value="">Selecione...</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder}
                        className="mt-1"
                      />
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded p-4">
                <p className="text-sm text-slate-700">
                  Esta ação não requer parâmetros adicionais. Clique em executar para continuar.
                </p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs text-amber-800">
                <strong>Nota:</strong> Funcionalidade em desenvolvimento. Em breve disponível.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                Cancelar
              </Button>
              <Button disabled className="flex-1 bg-blue-600 hover:bg-blue-700">
                Em breve
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Gestão de Chats Z-API
          </CardTitle>
          <CardDescription>
            Gerir conversas, presença e interações com contatos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {chatOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.id}
                  onClick={() => setShowModal(option.id)}
                  variant="outline"
                  className={`w-full justify-start border-${option.color}-600 text-${option.color}-700 hover:bg-${option.color}-50`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {option.label}
                </Button>
              );
            })}
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Gestão de Chats</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Liste e gerir todas as conversas da instância</li>
              <li>Arquive, fixe ou marque chats como lidos</li>
              <li>Bloqueie/desbloqueie contatos</li>
              <li>Verifique a presença online dos contatos</li>
              <li>Todas as funcionalidades estão em desenvolvimento</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {renderModalContent()}
    </div>
  );
}