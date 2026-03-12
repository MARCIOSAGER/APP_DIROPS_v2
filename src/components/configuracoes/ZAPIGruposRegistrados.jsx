import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Check, X, Edit2, RefreshCw, Users, AlertCircle, Trash2 } from 'lucide-react';
import ConfirmModal from '@/components/shared/ConfirmModal';

export default function ZAPIGruposRegistrados({ onError, onSuccess }) {
  const [grupos, setGrupos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editandoGrupo, setEditandoGrupo] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, grupo: null });

  useEffect(() => {
    loadGrupos();
  }, []);

  const loadGrupos = async () => {
    setIsLoading(true);
    try {
      const gruposData = await base44.entities.GrupoWhatsApp.list('-created_date', 100);
      setGrupos(gruposData || []);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
      onError('Não foi possível carregar os grupos registrados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAprovar = async (grupo) => {
    try {
      await base44.entities.GrupoWhatsApp.update(grupo.id, {
        status: 'aprovado',
        data_aprovacao: new Date().toISOString()
      });

      // Enviar mensagem de confirmação ao grupo
      try {
        await base44.functions.invoke('sendWhatsAppMessageToGroupZAPI', {
          groupId: grupo.chat_id,
          body: `🎉 Grupo "${grupo.nome_grupo}" aprovado!\n\nVocê começará a receber notificações automáticas do sistema DIROPS.`
        });
      } catch (msgError) {
        console.error('Erro ao enviar mensagem de aprovação:', msgError);
      }

      await loadGrupos();
      onSuccess(`Grupo "${grupo.nome_grupo}" foi aprovado com sucesso!`);
    } catch (error) {
      console.error('Erro ao aprovar grupo:', error);
      onError('Não foi possível aprovar o grupo.');
    }
  };

  const handleRejeitar = async (grupo) => {
    try {
      await base44.entities.GrupoWhatsApp.update(grupo.id, {
        status: 'rejeitado',
        data_aprovacao: new Date().toISOString()
      });

      // Enviar mensagem de rejeição ao grupo
      try {
        await base44.functions.invoke('sendWhatsAppMessageToGroupZAPI', {
          groupId: grupo.chat_id,
          body: `❌ Grupo "${grupo.nome_grupo}" não foi aprovado para receber notificações.\n\nEm caso de dúvidas, entre em contato com o administrador do sistema.`
        });
      } catch (msgError) {
        console.error('Erro ao enviar mensagem de rejeição:', msgError);
      }

      await loadGrupos();
      onSuccess(`Grupo "${grupo.nome_grupo}" foi rejeitado.`);
    } catch (error) {
      console.error('Erro ao rejeitar grupo:', error);
      onError('Não foi possível rejeitar o grupo.');
    }
  };

  const handleSalvarEdicao = async (grupoId) => {
    try {
      await base44.entities.GrupoWhatsApp.update(grupoId, editandoGrupo);
      await loadGrupos();
      setEditandoGrupo(null);
      onSuccess('Grupo atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar grupo:', error);
      onError('Não foi possível atualizar o grupo.');
    }
  };

  const handleApagar = async () => {
    const grupo = confirmModal.grupo;
    setConfirmModal({ isOpen: false, grupo: null });

    try {
      await base44.entities.GrupoWhatsApp.delete(grupo.id);
      await loadGrupos();
      onSuccess(`Grupo "${grupo.nome_grupo}" foi apagado.`);
    } catch (error) {
      console.error('Erro ao apagar grupo:', error);
      onError('Não foi possível apagar o grupo.');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">A carregar grupos...</p>
        </CardContent>
      </Card>
    );
  }

  const gruposPendentes = grupos.filter(g => g.status === 'pendente');
  const gruposAprovados = grupos.filter(g => g.status === 'aprovado' && g.notificacoes_ativas !== false);
  const gruposDesativados = grupos.filter(g => g.status === 'aprovado' && g.notificacoes_ativas === false);
  const gruposRejeitados = grupos.filter(g => g.status === 'rejeitado');

  return (
    <div className="space-y-6">
      {/* Instruções */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-2">Gerenciamento de Grupos:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Adicione o número WhatsApp do sistema ao grupo</li>
                <li>Envie a mensagem <code className="bg-blue-100 px-2 py-1 rounded">REGISTRAR_GRUPO</code> no grupo</li>
                <li>O grupo aparecerá aqui como "Pendente"</li>
                <li>Aprove o grupo para que ele possa receber notificações</li>
              </ol>
              <p className="font-semibold mt-3 mb-2">Para desativar notificações:</p>
              <p className="text-blue-800">Envie <code className="bg-blue-100 px-2 py-1 rounded">PARAR_NOTIFICACOES</code> no grupo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grupos Pendentes */}
      {gruposPendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-yellow-600" />
              Grupos Pendentes de Aprovação
              <Badge variant="outline" className="text-yellow-600">
                {gruposPendentes.length}
              </Badge>
            </CardTitle>
            <CardDescription>Grupos aguardando aprovação para receber notificações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gruposPendentes.map(grupo => (
                <div key={grupo.id} className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{grupo.nome_grupo}</h4>
                      <p className="text-sm text-slate-600 mt-1">
                        <strong>ID:</strong> <code className="bg-yellow-100 px-2 py-0.5 rounded text-xs">{grupo.chat_id}</code>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Registrado em {new Date(grupo.data_registro || grupo.created_date).toLocaleString('pt-PT')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAprovar(grupo)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejeitar(grupo)}
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grupos Aprovados */}
      {gruposAprovados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Grupos Aprovados
              <Badge variant="outline" className="text-green-600">
                {gruposAprovados.length}
              </Badge>
            </CardTitle>
            <CardDescription>Grupos ativos que podem receber notificações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gruposAprovados.map(grupo => (
                <div key={grupo.id} className="border border-green-300 bg-green-50 rounded-lg p-4">
                  {editandoGrupo?.id === grupo.id ? (
                    <div className="space-y-3">
                      <div>
                        <Label>Nome do Grupo</Label>
                        <Input
                          value={editandoGrupo.nome_grupo}
                          onChange={(e) => setEditandoGrupo({ ...editandoGrupo, nome_grupo: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          value={editandoGrupo.observacoes || ''}
                          onChange={(e) => setEditandoGrupo({ ...editandoGrupo, observacoes: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditandoGrupo(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSalvarEdicao(grupo.id)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{grupo.nome_grupo}</h4>
                        <p className="text-sm text-slate-600 mt-1">
                          <strong>ID:</strong> <code className="bg-green-100 px-2 py-0.5 rounded text-xs">{grupo.chat_id}</code>
                        </p>
                        {grupo.observacoes && (
                          <p className="text-sm text-slate-600 mt-2">{grupo.observacoes}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-2">
                          Aprovado em {new Date(grupo.data_aprovacao).toLocaleString('pt-PT')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditandoGrupo(grupo)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejeitar(grupo)}
                          className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                        >
                          Desaprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmModal({ isOpen: true, grupo })}
                          className="border-red-600 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grupos Rejeitados */}
      {gruposRejeitados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-red-600" />
              Grupos Rejeitados
              <Badge variant="outline" className="text-red-600">
                {gruposRejeitados.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gruposRejeitados.map(grupo => (
                <div key={grupo.id} className="border border-red-300 bg-red-50 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{grupo.nome_grupo}</h4>
                      <p className="text-sm text-slate-600 mt-1">
                        <strong>ID:</strong> <code className="bg-red-100 px-2 py-0.5 rounded text-xs">{grupo.chat_id}</code>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAprovar(grupo)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmModal({ isOpen: true, grupo })}
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grupos Desativados (Opt-Out) */}
      {gruposDesativados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              Grupos Desativados
              <Badge variant="outline" className="text-slate-600">
                {gruposDesativados.length}
              </Badge>
            </CardTitle>
            <CardDescription>Grupos que desativaram notificações (opt-out)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gruposDesativados.map(grupo => (
                <div key={grupo.id} className="border border-slate-300 bg-slate-50 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{grupo.nome_grupo}</h4>
                      <p className="text-sm text-slate-600 mt-1">
                        <strong>ID:</strong> <code className="bg-slate-200 px-2 py-0.5 rounded text-xs">{grupo.chat_id}</code>
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        Notificações desativadas em {new Date(grupo.data_desativacao || grupo.updated_date).toLocaleString('pt-PT')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmModal({ isOpen: true, grupo })}
                      className="border-red-600 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {grupos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600">Nenhum grupo registrado ainda.</p>
            <p className="text-sm text-slate-500 mt-2">
              Siga as instruções acima para registrar um grupo.
            </p>
          </CardContent>
        </Card>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, grupo: null })}
        onConfirm={handleApagar}
        title="Apagar Grupo"
        message={`Tem certeza que deseja apagar o grupo "${confirmModal.grupo?.nome_grupo}"? Esta ação não pode ser desfeita.`}
        confirmText="Apagar"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}