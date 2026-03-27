import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, Trash2 } from 'lucide-react';
import Select from '@/components/ui/select';

export default function HistoricoTab({
  historico,
  historicoFiltrado,
  historicoSelecionado,
  filtrosHistorico,
  t,
  onSetFiltrosHistorico,
  onToggleHistoricoSelection,
  onToggleAllHistorico,
  onApagarHistoricoSelecionado,
  onLimparHistorico,
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              {t('notificacoes.historicoTitle')}
            </CardTitle>
            <CardDescription>{t('notificacoes.historicoDesc')}</CardDescription>
          </div>
          {historico.length > 0 && (
            <Button
              onClick={onLimparHistorico}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('notificacoes.limparHistorico')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex gap-4 pb-4 border-b">
          <div className="flex-1">
            <Label className="text-sm mb-2">{t('notificacoes.status')}</Label>
            <Select
              options={[
                { value: 'todos', label: t('notificacoes.todosStatus') },
                { value: 'sucesso', label: `✅ ${t('notificacoes.enviado')}` },
                { value: 'erro', label: `❌ ${t('apiKeys.erro')}` },
                { value: 'aguardando_confirmacao', label: `⏳ ${t('notificacoes.aguardando')}` }
              ]}
              value={filtrosHistorico.status}
              onValueChange={(v) => onSetFiltrosHistorico(prev => ({ ...prev, status: v }))}
            />
          </div>
          <div className="flex-1">
            <Label className="text-sm mb-2">{t('notificacoes.canais')}</Label>
            <Select
              options={[
                { value: 'todos', label: t('notificacoes.todosCanais') },
                { value: 'email', label: '📧 Email' },
                { value: 'whatsapp', label: '💬 WhatsApp' }
              ]}
              value={filtrosHistorico.canal}
              onValueChange={(v) => onSetFiltrosHistorico(prev => ({ ...prev, canal: v }))}
            />
          </div>
        </div>

        {/* Seleção e Apagar */}
        {historicoFiltrado.length > 0 && historicoSelecionado.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <span className="text-sm font-medium text-blue-700">
              {t('notificacoes.historicoSelecionadas').replace('{n}', historicoSelecionado.size).replace('{total}', historicoFiltrado.length)}
            </span>
            <Button
              onClick={onApagarHistoricoSelecionado}
              className="bg-red-600 hover:bg-red-700"
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('notificacoes.historicoApagar')}
            </Button>
          </div>
        )}

        {/* Tabela */}
        {historicoFiltrado.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>{t('notificacoes.nenhumaNotificacao')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium w-12">
                    <input
                      type="checkbox"
                      checked={historicoSelecionado.size === historicoFiltrado.length && historicoFiltrado.length > 0}
                      onChange={onToggleAllHistorico}
                      className="rounded cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-2 font-medium">{t('notificacoes.colUtilizador')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('notificacoes.colEmail')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('notificacoes.colTipoRelatorio')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('notificacoes.colCanais')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('notificacoes.colStatus')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('notificacoes.colData')}</th>
                </tr>
              </thead>
              <tbody>
                {historicoFiltrado.map((item) => (
                  <tr key={item.id} className={`border-b ${historicoSelecionado.has(item.id) ? 'bg-blue-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <td className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={historicoSelecionado.has(item.id)}
                        onChange={() => onToggleHistoricoSelection(item.id)}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{item.email_destinatario?.split('@')[0]}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.email_destinatario}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">
                        {item.tipo_relatorio?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {item.canais_enviados?.includes('email') && (
                          <Badge className="bg-blue-100 text-blue-700">📧 Email</Badge>
                        )}
                        {item.canais_enviados?.includes('whatsapp') && (
                          <Badge className="bg-green-100 text-green-700">💬 WhatsApp</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'sucesso' ? (
                        <Badge className="bg-green-100 text-green-700">✅ {t('notificacoes.enviado')}</Badge>
                      ) : item.status === 'erro' ? (
                        <Badge className="bg-red-100 text-red-700" title={item.motivo_erro}>
                          ❌ {t('apiKeys.erro')}
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">⏳ {t('notificacoes.aguardando')}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {item.created_date ? (
                        <>
                          <div>{new Date(item.created_date).toLocaleDateString('pt-PT')}</div>
                          <div className="text-slate-500 dark:text-slate-400">{new Date(item.created_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
