import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Mail, Plus, X, Save, Loader2, CheckCircle, Users, Bell,
  FileText, Wrench, UserCheck, AlertTriangle
} from 'lucide-react';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';

const CONFIG_KEY_PREFIX = 'manutencao_notificacoes';

const NOTIFICATION_TYPES = [
  {
    key: 'nova_ss',
    label: 'Nova Solicitação de Serviço (SS)',
    description: 'Quando uma nova SS é criada (manual, inspeção ou auditoria)',
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  {
    key: 'ss_aprovada',
    label: 'SS Aprovada (OS Criada)',
    description: 'Quando uma SS é aprovada e uma OS é gerada',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50'
  },
  {
    key: 'ss_rejeitada',
    label: 'SS Rejeitada',
    description: 'Quando uma SS é rejeitada (enviado ao solicitante + responsáveis)',
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50'
  },
  {
    key: 'os_atribuida',
    label: 'OS Atribuída',
    description: 'Quando uma OS é atribuída a um técnico (enviado ao técnico + responsáveis)',
    icon: UserCheck,
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  }
];

export default function ConfigNotificacoesManutencao({ currentUser, availableUsers }) {
  const [config, setConfig] = useState({});
  const [configId, setConfigId] = useState(null);
  const [newEmails, setNewEmails] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadConfig();
  }, [currentUser?.empresa_id]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const allConfigs = await ConfiguracaoSistema.list();
      const empId = currentUser?.empresa_id;
      const configKey = `${CONFIG_KEY_PREFIX}_${empId || 'global'}`;
      const existing = allConfigs.find(c => c.chave === configKey);

      if (existing) {
        setConfigId(existing.id);
        setConfig(existing.valor || {});
      } else {
        setConfigId(null);
        setConfig({});
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addEmail = (typeKey) => {
    const email = newEmails[typeKey]?.trim();
    if (!email || !email.includes('@')) return;

    const current = config[typeKey] || [];
    if (current.includes(email)) {
      setMessage({ type: 'error', text: 'Este email já está na lista.' });
      return;
    }

    setConfig(prev => ({
      ...prev,
      [typeKey]: [...current, email]
    }));
    setNewEmails(prev => ({ ...prev, [typeKey]: '' }));
    setMessage({ type: '', text: '' });
  };

  const removeEmail = (typeKey, email) => {
    setConfig(prev => ({
      ...prev,
      [typeKey]: (prev[typeKey] || []).filter(e => e !== email)
    }));
  };

  const addUserEmail = (typeKey, user) => {
    const current = config[typeKey] || [];
    if (current.includes(user.email)) return;

    setConfig(prev => ({
      ...prev,
      [typeKey]: [...current, user.email]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const empId = currentUser?.empresa_id;
      const configKey = `${CONFIG_KEY_PREFIX}_${empId || 'global'}`;

      if (configId) {
        await ConfiguracaoSistema.update(configId, { valor: config });
      } else {
        const created = await ConfiguracaoSistema.create({
          chave: configKey,
          valor: config,
          empresa_id: empId || null
        });
        setConfigId(created.id);
      }

      setMessage({ type: 'success', text: 'Configuração salva com sucesso.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configuração.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter users that could be relevant (same empresa, active)
  const filteredUsers = (availableUsers || []).filter(u => {
    if (u.status === 'inativo') return false;
    if (currentUser?.empresa_id && u.empresa_id !== currentUser.empresa_id) return false;
    return u.email;
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-3" />
        <p className="text-slate-500">A carregar configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Responsáveis por Notificações
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Configure quem recebe emails automáticos para cada tipo de evento na manutenção.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A salvar...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Salvar Configuração</>
          )}
        </Button>
      </div>

      {message.text && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {NOTIFICATION_TYPES.map(type => {
          const Icon = type.icon;
          const emails = config[type.key] || [];

          return (
            <Card key={type.key} className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${type.bg}`}>
                    <Icon className={`w-4 h-4 ${type.color}`} />
                  </div>
                  <div>
                    <span className="text-slate-900">{type.label}</span>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">{type.description}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto">
                    {emails.length} {emails.length === 1 ? 'destinatário' : 'destinatários'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Email list */}
                {emails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {emails.map(email => (
                      <Badge key={email} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                        <Mail className="w-3 h-3" />
                        {email}
                        <button
                          onClick={() => removeEmail(type.key, email)}
                          className="ml-1 hover:text-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Add email */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={newEmails[type.key] || ''}
                      onChange={(e) => setNewEmails(prev => ({ ...prev, [type.key]: e.target.value }))}
                      placeholder="email@exemplo.com"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(type.key); } }}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addEmail(type.key)}
                    className="flex-shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {/* Quick add from users */}
                {filteredUsers.length > 0 && (
                  <div>
                    <Label className="text-xs text-slate-500 flex items-center gap-1 mb-1.5">
                      <Users className="w-3 h-3" />
                      Adicionar utilizador da empresa:
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {filteredUsers
                        .filter(u => !emails.includes(u.email))
                        .slice(0, 8)
                        .map(user => (
                          <button
                            key={user.id}
                            onClick={() => addUserEmail(type.key, user)}
                            className="text-xs px-2 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            {user.full_name || user.email}
                            {user.perfis?.length > 0 && (
                              <span className="text-slate-400">({user.perfis[0]})</span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
        <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Como funciona?</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700">
            <li>Se não houver responsáveis configurados, os emails são enviados a todos os administradores e infraestrutura da empresa.</li>
            <li>O solicitante da SS recebe sempre a notificação de aprovação/rejeição, independentemente desta configuração.</li>
            <li>O técnico atribuído à OS recebe sempre o email de atribuição.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
