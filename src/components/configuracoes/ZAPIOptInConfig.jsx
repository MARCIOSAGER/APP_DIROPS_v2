import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Plus, X, MessageSquare, CheckCircle, XCircle, Users, User } from 'lucide-react';
import { ConfiguracaoOptInZAPI } from '@/entities/ConfiguracaoOptInZAPI';

export default function ZAPIOptInConfig({ onError, onSuccess }) {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    palavras_chave_opt_in: ['sim', 'aceito', 'yes', 'ok', 'concordo'],
    palavras_chave_opt_out: ['parar', 'cancelar', 'stop', 'sair', 'remover'],
    botao_opt_in_label: '✅ SIM',
    botao_opt_out_label: '❌ NAO',
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
          botao_opt_in_label: cfg.botao_opt_in_label || '✅ SIM',
          botao_opt_out_label: cfg.botao_opt_out_label || '❌ NAO',
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

            {/* Configuração dos botões interativos */}
            <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">🔘 Botões Interativos (Principal)</h4>
              <p className="text-sm text-blue-800 mb-3">
                Personalize os textos dos botões enviados quando um utilizador é convidado para opt-in
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Botão Aceitar (Opt-in)</Label>
                  <Input
                    value={formData.botao_opt_in_label}
                    onChange={(e) => setFormData(prev => ({ ...prev, botao_opt_in_label: e.target.value }))}
                    placeholder="Ex: ✅ SIM"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Botão Rejeitar (Opt-out)</Label>
                  <Input
                    value={formData.botao_opt_out_label}
                    onChange={(e) => setFormData(prev => ({ ...prev, botao_opt_out_label: e.target.value }))}
                    placeholder="Ex: ❌ NAO"
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Palavras-chave Opt-in */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Palavras-chave para OPT-IN (Fallback - resposta por texto)
              </Label>
              <p className="text-xs text-slate-600 mb-2">
                Palavras que também ativam opt-in caso o utilizador responda por mensagem de texto em vez de clicar no botão
              </p>
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
                Palavras-chave para OPT-OUT (Fallback - resposta por texto)
              </Label>
              <p className="text-xs text-slate-600 mb-2">
                Palavras que também desativam notificações caso o utilizador responda por mensagem de texto
              </p>
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
                    <Label>Mensagem de Boas-vindas (Enviada com Botões Interativos)</Label>
                    <p className="text-xs text-slate-600 mb-2">
                      Esta mensagem é enviada junto com os botões "SIM" e "NAO" quando convida um utilizador
                    </p>
                    <Textarea
                      value={formData.mensagem_boas_vindas}
                      onChange={(e) => setFormData(prev => ({ ...prev, mensagem_boas_vindas: e.target.value }))}
                      placeholder="Ex: Olá! 👋 Para receber notificações operacionais do DIROPS via WhatsApp:"
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
                <li><strong>Método Principal:</strong> Utilizadores recebem mensagem com <strong>botões "SIM" e "NAO"</strong> para clicar</li>
                <li><strong>Método Alternativo:</strong> Podem responder por mensagem de texto usando as palavras-chave configuradas</li>
                <li>As respostas automáticas confirmam a ação ao utilizador após opt-in/opt-out</li>
                <li>A mensagem de boas-vindas é enviada com os botões interativos quando convidado</li>
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
  );
}