import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sanitizeHtml } from '@/lib/sanitize';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Send, Mail, MessageSquare, AlertCircle, Sparkles } from 'lucide-react';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';

export default function RegraFormModal({
  editingRegra,
  formData,
  activeTab,
  setActiveTab,
  aeroportos,
  usuarios,
  usuariosFiltrados,
  searchUsuario,
  filtrarOptInConfirmado,
  gruposWhatsApp,
  placeholdersDoSistema,
  placeholdersGlobais,
  placeholdersDisponiveis,
  isGeneratingIA,
  isSendingTest,
  enviandoOptIn,
  eventosDisponiveis,
  canaisDisponiveis,
  perfisDisponiveis,
  aeroportosAngola,
  templatesAeroportos,
  t,
  onInputChange,
  onToggleCanal,
  onTogglePerfil,
  onToggleUsuario,
  onSubmit,
  onClose,
  onSetSearchUsuario,
  onSetFiltrarOptInConfirmado,
  onGerarComIA,
  onEnviarOptIn,
  onShowTestModal,
  renderPreview,
  getPreviewData,
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b dark:border-slate-700 z-10">
          <div className="p-6 pb-0">
            <h2 className="text-2xl font-bold mb-4">
              {editingRegra ? t('notificacoes.editarRegra') : t('notificacoes.novaRegra')}
            </h2>
          </div>

          {/* Tabs */}
          <div className="flex border-b px-6">
            <button
              type="button"
              onClick={() => setActiveTab('geral')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'geral'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('notificacoes.configuracoesGerais')}
            </button>
            {formData.evento_gatilho === 'relatorio_operacional_consolidado' && (
              <button
                type="button"
                onClick={() => setActiveTab('template')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'template'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('notificacoes.templateHtmlTab')}
              </button>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6">
          {/* Tab: Geral */}
          {activeTab === 'geral' && (
            <>
          {/* Nome */}
          <div>
            <Label htmlFor="nome">{t('notificacoes.nomeRegra')}</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => onInputChange('nome', e.target.value)}
              placeholder="Ex: Notificar operações sobre novos voos"
              required
            />
          </div>

          {/* Evento Gatilho */}
          <div>
            <Label htmlFor="evento">{t('notificacoes.evento')} *</Label>
            <Select
              id="evento"
              options={[
                { value: '', label: t('notificacoes.selecioneEvento') },
                ...eventosDisponiveis
              ]}
              value={formData.evento_gatilho}
              onValueChange={(v) => onInputChange('evento_gatilho', v)}
            />
          </div>

          {/* Aeroporto (apenas para relatórios operacionais individuais) */}
          {(formData.evento_gatilho === 'relatorio_operacional_diario' ||
            formData.evento_gatilho === 'relatorio_operacional_semanal' ||
            formData.evento_gatilho === 'relatorio_operacional_mensal') && (
            <div>
              <Label htmlFor="aeroporto">{t('notificacoes.aeroportoEspecifico')}</Label>
              <Select
                 id="aeroporto"
                 options={[
                   { value: '', label: t('notificacoes.todosAeroportos') },
                   ...aeroportos.filter(a => aeroportosAngola.includes(a.codigo_icao)).map(a => ({
                     value: a.codigo_icao,
                     label: `${a.codigo_icao} - ${a.nome}`
                   }))
                 ]}
                 value={formData.aeroporto_icao_relatorio}
                 onValueChange={(v) => onInputChange('aeroporto_icao_relatorio', v)}
               />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('notificacoes.aeroportoVazioInfo')}
              </p>
            </div>
          )}

          {/* Canais de Envio */}
          <div>
            <Label>{t('notificacoes.canais')} *</Label>
            <div className="flex gap-4 mt-2">
              {canaisDisponiveis.map(canal => {
                const Icon = canal.icon;
                const isSelected = formData.canal_envio.includes(canal.value);
                return (
                  <button
                    key={canal.value}
                    type="button"
                    onClick={() => onToggleCanal(canal.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{canal.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grupo WhatsApp (opcional) */}
          {formData.canal_envio.includes('whatsapp') && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="grupo-whatsapp">{t('notificacoes.grupoWhatsappOpcional')}</Label>
                {gruposWhatsApp.length > 0 && (
                  <Badge className="bg-green-600 text-white">{gruposWhatsApp.length} grupo(s)</Badge>
                )}
              </div>
              {gruposWhatsApp.length > 0 ? (
                <>
                  <div className="mb-3 space-y-2">
                    {gruposWhatsApp.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => onInputChange('grupo_whatsapp_id', g.chat_id)}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                          formData.grupo_whatsapp_id === g.chat_id
                            ? 'border-green-600 bg-white'
                            : 'border-green-200 hover:border-green-400 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">{g.nome_grupo}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{g.chat_id}</div>
                          </div>
                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                            {g.status}
                          </Badge>
                        </div>
                        {g.data_aprovacao && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {t('notificacoes.aprovadoEm')} {new Date(g.data_aprovacao).toLocaleDateString('pt-PT')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onInputChange('grupo_whatsapp_id', '')}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      !formData.grupo_whatsapp_id
                        ? 'border-blue-600 bg-white'
                        : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">❌ {t('notificacoes.semGrupoIndividual')}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('notificacoes.semGrupoDesc')}</div>
                  </button>
                  <p className="text-xs text-green-700 mt-3">
                    💡 {t('notificacoes.grupoAprovadoDica')}
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-2 p-4 bg-yellow-50 border border-yellow-300 rounded-lg mb-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">{t('notificacoes.nenhumGrupoAprovado')}</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          {t('notificacoes.nenhumGrupoAprovadoDesc')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-600">
                    <Label htmlFor="grupo-whatsapp-manual" className="text-xs mb-1 block">{t('notificacoes.inserirIdManual')}</Label>
                    <Input
                      id="grupo-whatsapp-manual"
                      value={formData.grupo_whatsapp_id}
                      onChange={(e) => onInputChange('grupo_whatsapp_id', e.target.value)}
                      placeholder={t('notificacoes.idGrupoPlaceholder')}
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {t('notificacoes.idGrupoInfo')}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Destinatários - Perfis */}
          <div>
            <Label>{t('notificacoes.perfis')} *</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{t('notificacoes.perfisDesc')}</p>
            <Combobox
              options={perfisDisponiveis}
              value={formData.destinatarios_perfis}
              onValueChange={(value) => onTogglePerfil(value)}
              placeholder="Selecione os perfis..."
              searchable={true}
              multiple={true}
            />
            {formData.destinatarios_perfis.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.destinatarios_perfis.map(perfilId => {
                  const perfil = perfisDisponiveis.find(p => p.value === perfilId);
                  return (
                    <Badge key={perfilId} className="bg-blue-100 text-blue-700">
                      {perfil?.label}
                      <button
                        type="button"
                        onClick={() => onTogglePerfil(perfilId)}
                        className="ml-2 hover:opacity-70"
                      >
                        ✕
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Destinatários - Utilizadores Específicos */}
          <div>
            <Label>{t('notificacoes.utilizadores')}</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{t('notificacoes.utilizadoresDesc')}</p>

            {/* Campo de Busca e Filtros */}
            <div className="space-y-2 mb-3">
              <Input
                placeholder={`🔍 ${t('notificacoes.pesquisarUtilizador')}`}
                value={searchUsuario}
                onChange={(e) => onSetSearchUsuario(e.target.value)}
              />

              {formData.canal_envio.includes('whatsapp') && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <input
                    type="checkbox"
                    id="filtrar-optin"
                    checked={filtrarOptInConfirmado}
                    onChange={(e) => onSetFiltrarOptInConfirmado(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="filtrar-optin" className="cursor-pointer text-sm">
                    {t('notificacoes.filtrarOptin')}
                  </Label>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              {usuarios.length === 0 ? (
                <p className="text-sm text-slate-500">{t('notificacoes.nenhumUtilizador')}</p>
              ) : usuariosFiltrados.length === 0 ? (
                <p className="text-sm text-slate-500">{t('notificacoes.utilizadorNaoEncontrado').replace('{search}', searchUsuario)}</p>
              ) : (
                <div className="space-y-2">
                  {usuariosFiltrados.map(user => {
                    const isSelected = formData.destinatarios_usuarios_ids.includes(user.id);
                    const optInStatus = user.whatsapp_opt_in_status;
                    const hasWhatsApp = !!user.whatsapp_number;

                    return (
                      <div
                        key={user.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleUsuario(user.id)}
                          className="flex-1 text-left"
                        >
                          <div className="font-medium">{user.full_name || user.email}</div>
                          <div className="text-xs opacity-75">{user.email}</div>
                        </button>

                        {formData.canal_envio.includes('whatsapp') && (
                          <div className="flex items-center gap-2">
                            {!hasWhatsApp ? (
                              <Badge variant="outline" className="text-slate-500 dark:text-slate-400 text-xs">
                                {t('notificacoes.semWhatsApp')}
                              </Badge>
                            ) : optInStatus === 'confirmado' ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                ✓ {t('notificacoes.optinConfirmado')}
                              </Badge>
                            ) : optInStatus === 'pendente' ? (
                              <Badge variant="outline" className="text-yellow-600 text-xs">
                                ⏳ {t('notificacoes.optinPendente')}
                              </Badge>
                            ) : optInStatus === 'rejeitado' ? (
                              <Badge variant="outline" className="text-red-600 text-xs">
                                ✗ {t('notificacoes.optinRejeitado')}
                              </Badge>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEnviarOptIn(user.id);
                                }}
                                disabled={enviandoOptIn[user.id]}
                                className="h-7 text-xs"
                              >
                                {enviandoOptIn[user.id] ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                    {t('notificacoes.enviandoOptin')}
                                  </>
                                ) : (
                                  <>
                                    <MessageSquare className="w-3 h-3 mr-1" />
                                    {t('notificacoes.pedirOptin')}
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Prompt IA Personalizado */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <Label htmlFor="prompt-ia">{t('notificacoes.instrucoes')}</Label>
            </div>
            <Textarea
              id="prompt-ia"
              value={formData.prompt_ia_personalizado}
              onChange={(e) => onInputChange('prompt_ia_personalizado', e.target.value)}
              placeholder="Ex: Usar tom formal e profissional, incluir emojis, destacar as informações mais importantes, etc."
              rows={3}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('notificacoes.instrucoesInfo')}
            </p>
          </div>

          {/* Placeholders Info */}
          {placeholdersDisponiveis.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900 mb-2">{t('notificacoes.placeholdersDisp')}</p>

                  {/* Placeholders do Sistema */}
                  {placeholdersDoSistema.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-blue-800 mb-1">📊 {t('notificacoes.placeholdersSistema')}</p>
                      <div className="flex flex-wrap gap-2">
                        {placeholdersDoSistema.map(ph => (
                          <code key={ph} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs cursor-pointer hover:bg-blue-200" title="Clique para copiar">
                            {ph}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Placeholders Globais */}
                  {placeholdersGlobais.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-blue-800 mb-1">🏷️ {t('notificacoes.placeholdersGlobais')}</p>
                      <div className="flex flex-wrap gap-2">
                        {placeholdersGlobais.map(ph => (
                          <code
                            key={ph.id}
                            className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs cursor-pointer hover:bg-green-200"
                            title={ph.descricao}
                          >
                            {`{{${ph.nome}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Templates */}
          {formData.canal_envio.includes('whatsapp') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="whatsapp-template">{t('notificacoes.templateWhatsApp')}</Label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${formData.mensagem_template_whatsapp.length > 1600 ? 'text-red-600' : formData.mensagem_template_whatsapp.length > 1400 ? 'text-yellow-600' : 'text-slate-600'}`}>
                    {formData.mensagem_template_whatsapp.length}/1600
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onGerarComIA('whatsapp')}
                    disabled={isGeneratingIA.whatsapp || !formData.evento_gatilho}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    {isGeneratingIA.whatsapp ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        {t('notificacoes.gerandoIA')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        {formData.mensagem_template_whatsapp ? t('notificacoes.gerarNovamente') : t('notificacoes.gerarComIA')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <Textarea
                id="whatsapp-template"
                value={formData.mensagem_template_whatsapp}
                onChange={(e) => onInputChange('mensagem_template_whatsapp', e.target.value)}
                placeholder="Ex: ✈️ Novo voo {{numero_voo}} em {{aeroporto}}."
                rows={4}
                className={formData.mensagem_template_whatsapp.length > 1600 ? 'border-red-500' : formData.mensagem_template_whatsapp.length > 1400 ? 'border-yellow-500' : ''}
              />
              {formData.mensagem_template_whatsapp.length > 1600 && (
                <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">
                    ⚠️ {t('notificacoes.limiteExcedido')}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {t('notificacoes.limiteReduzir').replace('{n}', formData.mensagem_template_whatsapp.length - 1600)}
                  </p>
                </div>
              )}
              {formData.mensagem_template_whatsapp.length > 1400 && formData.mensagem_template_whatsapp.length <= 1600 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <p className="text-xs text-yellow-700">
                    ⚠️ {t('notificacoes.limitePerto').replace('{n}', 1600 - formData.mensagem_template_whatsapp.length)}
                  </p>
                </div>
              )}

              {/* Preview WhatsApp */}
              {formData.mensagem_template_whatsapp && formData.evento_gatilho && (
                <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-green-700" />
                    <span className="text-sm font-medium text-green-900">{t('notificacoes.previewWhatsApp')}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg text-sm whitespace-pre-wrap">
                    {renderPreview(formData.mensagem_template_whatsapp)}
                  </div>
                </div>
              )}
            </div>
          )}

          {formData.canal_envio.includes('email') && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="email-assunto">{t('notificacoes.assuntoEmail')}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onGerarComIA('email_assunto')}
                    disabled={isGeneratingIA.email_assunto || !formData.evento_gatilho}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    {isGeneratingIA.email_assunto ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        {t('notificacoes.gerandoIA')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        {formData.mensagem_template_email_assunto ? t('notificacoes.gerarNovamente') : t('notificacoes.gerarComIA')}
                      </>
                    )}
                  </Button>
                </div>
                <Input
                  id="email-assunto"
                  value={formData.mensagem_template_email_assunto}
                  onChange={(e) => onInputChange('mensagem_template_email_assunto', e.target.value)}
                  placeholder="Ex: Novo Voo {{numero_voo}} - {{aeroporto}}"
                />

                {/* Preview Assunto */}
                {formData.mensagem_template_email_assunto && formData.evento_gatilho && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="w-4 h-4 text-blue-700" />
                      <span className="text-xs font-medium text-blue-900">{t('notificacoes.previewAssunto')}</span>
                    </div>
                    <div className="text-sm font-medium">
                      {renderPreview(formData.mensagem_template_email_assunto)}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="email-corpo">{t('notificacoes.corpoEmail')}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onGerarComIA('email_corpo')}
                    disabled={isGeneratingIA.email_corpo || !formData.evento_gatilho}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    {isGeneratingIA.email_corpo ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        {t('notificacoes.gerandoIA')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        {formData.mensagem_template_email_corpo ? t('notificacoes.gerarNovamente') : t('notificacoes.gerarComIA')}
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="email-corpo"
                  value={formData.mensagem_template_email_corpo}
                  onChange={(e) => onInputChange('mensagem_template_email_corpo', e.target.value)}
                  placeholder="Pode usar HTML. Ex: <p>Voo <strong>{{numero_voo}}</strong> foi criado.</p>"
                  rows={6}
                />

                {/* Preview Corpo */}
                {formData.mensagem_template_email_corpo && formData.evento_gatilho && (
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="w-4 h-4 text-blue-700" />
                      <span className="text-sm font-medium text-blue-900">{t('notificacoes.previewEmail')}</span>
                    </div>
                    <div
                      className="bg-white p-4 rounded-lg text-sm"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreview(formData.mensagem_template_email_corpo)) }}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Ativo */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => onInputChange('ativo', checked)}
            />
            <Label htmlFor="ativo" className="cursor-pointer">
              {t('notificacoes.regraAtiva')}
            </Label>
          </div>
            </>
          )}

          {/* Tab: Template HTML Aeroportos */}
          {activeTab === 'template' && formData.evento_gatilho === 'relatorio_operacional_consolidado' && (
            <div className="space-y-4">
              {/* Templates Predefinidos */}
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('notificacoes.modeloFormatacao')}</h4>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {Object.entries(templatesAeroportos).map(([key, template]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onInputChange('template_html_aeroportos', template.html)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.template_html_aeroportos === template.html
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{template.nome}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{template.descricao}</div>
                    </button>
                  ))}
                </div>

                {/* Preview dos Templates */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">👁️ {t('notificacoes.previewModelos')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(templatesAeroportos).map(([key, template]) => (
                      <div key={key} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{template.nome}</div>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml((template.html || '')
                              .replace(/\{\{codigo_icao\}\}/g, 'FNLU')
                              .replace(/\{\{nome\}\}/g, 'Quatro de Fevereiro')
                              .replace(/\{\{total_voos\}\}/g, '45')
                              .replace(/\{\{total_passageiros\}\}/g, '3,250')
                              .replace(/\{\{total_carga\}\}/g, '12,500')
                              .replace(/\{\{total_faturacao_usd\}\}/g, '45,250.00')
                              .replace(/\{\{total_faturacao_aoa\}\}/g, '38,462,500'))
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">ℹ️ {t('notificacoes.personalizarTemplate')}</h4>
                <p className="text-sm text-blue-800 mb-2">
                  {t('notificacoes.personalizarDesc')}
                </p>
                <div className="mt-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">{t('notificacoes.placeholdersHtml')}</p>
                  <div className="flex flex-wrap gap-1">
                     {['{{codigo_icao}}', '{{nome}}', '{{total_voos}}', '{{total_passageiros}}', '{{total_carga}}', '{{total_faturacao_usd}}', '{{total_faturacao_aoa}}'].map((ph, idx) => (
                       <code key={idx} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                         {ph}
                       </code>
                     ))}
                   </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="template-html">{t('notificacoes.templateHtmlPersonalizado')}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onGerarComIA('template_html')}
                    disabled={isGeneratingIA.template_html || !formData.evento_gatilho}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    {isGeneratingIA.template_html ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        {t('notificacoes.gerandoIA')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        {formData.template_html_aeroportos ? t('notificacoes.gerarNovamente') : t('notificacoes.gerarComIA')}
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="template-html"
                  value={formData.template_html_aeroportos || ''}
                  onChange={(e) => onInputChange('template_html_aeroportos', e.target.value)}
                  placeholder="Exemplo:\n<div style='background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;'>\n  <h3 style='color: #004A99;'>{{codigo_icao}}</h3>\n  <p>{{nome}}</p>\n  <p><strong>Movimentos:</strong> {{total_voos}}</p>\n  <p><strong>Passageiros:</strong> {{total_passageiros}}</p>\n  <p><strong>Faturação:</strong> ${{total_faturacao_usd}}</p>\n</div>"
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {t('notificacoes.templateHtmlInfo')}
                </p>
              </div>

              {/* Preview Individual */}
              {formData.template_html_aeroportos && formData.template_html_aeroportos.trim() && (
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">👁️ {t('notificacoes.previewIndividual')}</h4>
                  <div
                    className="bg-white p-4 rounded border border-slate-200"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(((formData.template_html_aeroportos || '') || '')
                        .replace(/\{\{codigo_icao\}\}/g, 'FNLU')
                        .replace(/\{\{nome\}\}/g, 'Aeroporto Quatro de Fevereiro')
                        .replace(/\{\{total_voos\}\}/g, '45')
                        .replace(/\{\{total_passageiros\}\}/g, '3,250')
                        .replace(/\{\{total_carga\}\}/g, '12,500')
                        .replace(/\{\{total_faturacao_usd\}\}/g, '45,250.00')
                        .replace(/\{\{total_faturacao_aoa\}\}/g, '38,462,500'))
                    }}
                  />
                </div>
              )}

              {/* Preview Email Completo */}
              {formData.mensagem_template_email_corpo && formData.template_html_aeroportos && formData.template_html_aeroportos.trim() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-5 h-5 text-blue-700" />
                    <h4 className="font-semibold text-blue-900">📧 {t('notificacoes.previewCompleto')}</h4>
                  </div>

                  {/* Email Preview Container */}
                  <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-hidden">
                    {/* Email Header */}
                    {formData.mensagem_template_email_assunto && (
                      <div className="bg-slate-100 px-4 py-3 border-b">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">{t('notificacoes.previewEmailAssunto')}</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {renderPreview(formData.mensagem_template_email_assunto)}
                        </div>
                      </div>
                    )}

                    {/* Email Body */}
                    <div className="p-6 max-h-96 overflow-y-auto">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: (() => {
                            const aeroportosExemplo = [
                              { codigo_icao: 'FNLU', nome: 'Aeroporto Quatro de Fevereiro', total_voos: '45', total_passageiros: '3250', total_carga: '12500', total_faturacao_usd: '45250.00', total_faturacao_aoa: '38462500' },
                              { codigo_icao: 'FNUB', nome: 'Aeroporto Internacional Catumbela', total_voos: '38', total_passageiros: '2800', total_carga: '9500', total_faturacao_usd: '38500.00', total_faturacao_aoa: '32725000' },
                              { codigo_icao: 'FNSA', nome: 'Aeroporto Internacional Agostinho Neto', total_voos: '52', total_passageiros: '4100', total_carga: '15200', total_faturacao_usd: '52800.00', total_faturacao_aoa: '44880000' }
                            ];

                            let detalhesAeroportosHtml = '';
                            aeroportosExemplo.forEach(aero => {
                              if (!aero) return;
                              let templateAeroporto = (formData.template_html_aeroportos || '')
                                  .replace(/\{\{codigo_icao\}\}/g, String(aero.codigo_icao || ''))
                                  .replace(/\{\{nome\}\}/g, String(aero.nome || ''))
                                  .replace(/\{\{total_voos\}\}/g, String(aero.total_voos || '0'))
                                  .replace(/\{\{total_passageiros\}\}/g, String(aero.total_passageiros || '0'))
                                  .replace(/\{\{total_carga\}\}/g, String(aero.total_carga || '0'))
                                  .replace(/\{\{total_faturacao_usd\}\}/g, String((aero && (aero.total_faturacao_usd !== undefined && aero.total_faturacao_usd !== null)) ? aero.total_faturacao_usd : '0.00'))
                                  .replace(/\{\{total_faturacao_aoa\}\}/g, String((aero && (aero.total_faturacao_aoa !== undefined && aero.total_faturacao_aoa !== null)) ? aero.total_faturacao_aoa : '0'));
                              detalhesAeroportosHtml += templateAeroporto;
                            });

                            const previewData = getPreviewData();
                            let emailCompleto = formData.mensagem_template_email_corpo;

                            Object.keys(previewData).forEach(key => {
                              const value = previewData[key];
                              if (value !== undefined && value !== null) {
                                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                                emailCompleto = emailCompleto.replace(regex, String(value));
                              }
                            });

                            emailCompleto = emailCompleto.replace(/\{\{detalhes_aeroportos_html\}\}/g, detalhesAeroportosHtml);

                            return sanitizeHtml(emailCompleto);
                          })()
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-blue-700 mt-2">
                    {t('notificacoes.previewEmailNota')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('notificacoes.cancelar')}
            </Button>
            {editingRegra && (
              <Button
                type="button"
                variant="outline"
                onClick={onShowTestModal}
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                <Send className="w-4 h-4 mr-2" />
                {t('notificacoes.enviarTesteBtn')}
              </Button>
            )}
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              {editingRegra ? t('notificacoes.atualizar') : t('notificacoes.criar')} {t('notificacoes.regra')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
