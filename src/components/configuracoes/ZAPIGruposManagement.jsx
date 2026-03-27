import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users,
  UserPlus,
  UserMinus,
  Edit,
  Trash2,
  Shield,
  Image as ImageIcon,
  Link as LinkIcon,
  X,
  Settings,
  Crown,
  MessageSquare
} from 'lucide-react';

export default function ZAPIGruposManagement({ onError: _onError, onSuccess: _onSuccess }) {
  const [showModal, setShowModal] = useState(null);

  const grupoOptions = [
    { id: 'criar', icon: Users, label: 'Criar grupo', color: 'blue' },
    { id: 'atualizar-foto', icon: ImageIcon, label: 'Atualizar foto do grupo', color: 'purple' },
    { id: 'atualizar-nome', icon: Edit, label: 'Atualizar nome do grupo', color: 'indigo' },
    { id: 'atualizar-descricao', icon: MessageSquare, label: 'Atualizar descrição do grupo', color: 'teal' },
    { id: 'obter-link', icon: LinkIcon, label: 'Obter link de convite', color: 'green' },
    { id: 'adicionar-participante', icon: UserPlus, label: 'Adicionar participante', color: 'emerald' },
    { id: 'remover-participante', icon: UserMinus, label: 'Remover participante', color: 'orange' },
    { id: 'promover-admin', icon: Crown, label: 'Promover participante a admin', color: 'yellow' },
    { id: 'rebaixar-admin', icon: Shield, label: 'Rebaixar admin a participante', color: 'amber' },
    { id: 'atualizar-configuracoes', icon: Settings, label: 'Atualizar configurações do grupo', color: 'slate' },
    { id: 'sair-grupo', icon: Trash2, label: 'Sair do grupo', color: 'red' }
  ];

  const renderModalContent = () => {
    const modalConfigs = {
      'criar': {
        title: 'Criar Grupo',
        fields: [
          { name: 'groupName', label: 'Nome do Grupo *', type: 'text', placeholder: 'Grupo DIROPS' },
          { name: 'participants', label: 'Participantes (números separados por vírgula) *', type: 'textarea', placeholder: '+244XXXXXXXXX, +244YYYYYYYYY' }
        ]
      },
      'atualizar-foto': {
        title: 'Atualizar Foto do Grupo',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' },
          { name: 'imageUrl', label: 'URL da Imagem *', type: 'text', placeholder: 'https://example.com/imagem.jpg' }
        ]
      },
      'atualizar-nome': {
        title: 'Atualizar Nome do Grupo',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' },
          { name: 'groupName', label: 'Novo Nome *', type: 'text', placeholder: 'Novo nome do grupo' }
        ]
      },
      'atualizar-descricao': {
        title: 'Atualizar Descrição do Grupo',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' },
          { name: 'description', label: 'Nova Descrição *', type: 'textarea', placeholder: 'Descrição do grupo' }
        ]
      },
      'obter-link': {
        title: 'Obter Link de Convite',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' }
        ]
      },
      'adicionar-participante': {
        title: 'Adicionar Participante',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' },
          { name: 'phone', label: 'Número do Participante *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'remover-participante': {
        title: 'Remover Participante',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' },
          { name: 'phone', label: 'Número do Participante *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'promover-admin': {
        title: 'Promover Participante a Admin',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' },
          { name: 'phone', label: 'Número do Participante *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'rebaixar-admin': {
        title: 'Rebaixar Admin a Participante',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' },
          { name: 'phone', label: 'Número do Admin *', type: 'text', placeholder: '+244XXXXXXXXX' }
        ]
      },
      'atualizar-configuracoes': {
        title: 'Atualizar Configurações do Grupo',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' },
          { name: 'settings', label: 'Configurações (JSON) *', type: 'textarea', placeholder: '{"onlyAdminsCanSend": true, "editMessageDuration": 15}' }
        ]
      },
      'sair-grupo': {
        title: 'Sair do Grupo',
        fields: [
          { name: 'groupId', label: 'ID do Grupo *', type: 'text', placeholder: 'ID do grupo' }
        ]
      }
    };

    if (!showModal || !modalConfigs[showModal]) return null;

    const config = modalConfigs[showModal];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-slate-900">{config.title}</h3>
            <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            {config.fields.map((field, idx) => (
              <div key={idx}>
                <Label>{field.label}</Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    placeholder={field.placeholder}
                    className="mt-1 h-24"
                  />
                ) : (
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    className="mt-1"
                  />
                )}
              </div>
            ))}

            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs text-amber-800">
                <strong>Nota:</strong> Funcionalidade em desenvolvimento. Em breve disponível.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                Cancelar
              </Button>
              <Button disabled className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
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
            <Users className="w-5 h-5" />
            Gestão de Grupos Z-API
          </CardTitle>
          <CardDescription>
            Crie e gerir grupos do WhatsApp através da API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {grupoOptions.map((option) => {
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
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Gestão de Grupos</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Crie e gerir grupos do WhatsApp diretamente pela plataforma</li>
              <li>Adicione ou remova participantes</li>
              <li>Configure permissões e administradores</li>
              <li>Todas as funcionalidades estão em desenvolvimento</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {renderModalContent()}
    </div>
  );
}