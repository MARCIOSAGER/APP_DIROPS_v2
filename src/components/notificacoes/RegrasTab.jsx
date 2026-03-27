import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Bell, Edit, Trash2, Send, MessageSquare, Users, User, Play, Globe } from 'lucide-react';

export default function RegrasTab({
  regras,
  regrasSelecionadas,
  eventosDisponiveis,
  t,
  onToggleRegraSelection,
  onToggleAllRegras,
  onApagarSelecionadas,
  onToggleAtivo,
  onOpenRunModal,
  onOpenForm,
  onDelete,
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              {t('notificacoes.regrasNotificacao')}
              <Badge variant="outline">{regras.length} {regras.length === 1 ? t('notificacoes.regra') : t('notificacoes.regras')}</Badge>
            </CardTitle>
            <CardDescription>{t('notificacoes.listaRegrasDesc')}</CardDescription>
          </div>
          {regrasSelecionadas.size > 0 && (
            <Button
              onClick={onApagarSelecionadas}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('notificacoes.apagarSelecionadas').replace('{n}', regrasSelecionadas.size)}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {regras.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>{t('notificacoes.nenhumaRegra')}</p>
            <p className="text-sm mt-1">{t('notificacoes.nenhumaRegraDesc')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {regras.length > 0 && (
              <div className="flex items-center gap-2 pb-4 border-b">
                <input
                  type="checkbox"
                  checked={regrasSelecionadas.size === regras.length && regras.length > 0}
                  onChange={onToggleAllRegras}
                  className="rounded cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {regrasSelecionadas.size === 0 ? t('notificacoes.selecionarTodas') : `${regrasSelecionadas.size} ${t('notificacoes.de')} ${regras.length} ${t('notificacoes.selecionadas')}`}
                </span>
              </div>
            )}
            {regras.map((regra) => {
              const eventoLabel = eventosDisponiveis.find(e => e.value === regra.evento_gatilho)?.label || regra.evento_gatilho;
              const isSelected = regrasSelecionadas.has(regra.id);

              return (
                <div key={regra.id} className={`border rounded-lg p-4 ${isSelected ? 'bg-blue-50 dark:bg-blue-950 border-blue-400' : regra.ativo ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleRegraSelection(regra.id)}
                      className="mt-1 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{regra.nome}</h3>
                        <Badge variant={regra.ativo ? 'default' : 'outline'}>
                          {regra.ativo ? t('notificacoes.ativo') : t('notificacoes.inativo')}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Send className="w-4 h-4" />
                          <span><strong>{t('notificacoes.evento')}:</strong> {eventoLabel}</span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <MessageSquare className="w-4 h-4" />
                          <span><strong>{t('notificacoes.canais')}:</strong> {regra.canal_envio.map(c =>
                            c === 'whatsapp' ? 'WhatsApp' : 'E-mail'
                          ).join(', ')}</span>
                        </div>

                        {regra.destinatarios_perfis && regra.destinatarios_perfis.length > 0 && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Users className="w-4 h-4" />
                            <span><strong>{t('notificacoes.perfis')}:</strong> {regra.destinatarios_perfis.join(', ')}</span>
                          </div>
                        )}

                        {regra.destinatarios_usuarios_ids && regra.destinatarios_usuarios_ids.length > 0 && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <User className="w-4 h-4" />
                            <span><strong>{t('notificacoes.utilizadores')}:</strong> {regra.destinatarios_usuarios_ids.length} {t('notificacoes.selecionados')}</span>
                          </div>
                        )}

                        {regra.aeroporto_icao_relatorio && (
                         <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                           <Globe className="w-4 h-4" />
                           <span><strong>{t('notificacoes.aeroporto')}:</strong> {regra.aeroporto_icao_relatorio}</span>
                         </div>
                        )}

                        {regra.grupo_whatsapp_id && (
                         <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                           <MessageSquare className="w-4 h-4" />
                           <span><strong>{t('notificacoes.grupoWhatsapp')}:</strong> {regra.grupo_whatsapp_id}</span>
                         </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={regra.ativo}
                        onCheckedChange={() => onToggleAtivo(regra)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenRunModal(regra)}
                        title={t('notificacoes.executarAutomacao')}
                      >
                        <Play className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onOpenForm(regra)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(regra)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
