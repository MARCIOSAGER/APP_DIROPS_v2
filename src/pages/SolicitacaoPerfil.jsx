
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserCog, Info, AlertCircle, X, Search, LogOut } from 'lucide-react';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';

import { SolicitacaoAcesso } from '@/entities/SolicitacaoAcesso';
import { Empresa } from '@/entities/Empresa';
import { Aeroporto } from '@/entities/Aeroporto';
import { createPageUrl } from '@/utils';
import { sendNotificationEmail } from '@/functions/sendNotificationEmail';
import useSubmitGuard from '@/hooks/useSubmitGuard';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

export default function SolicitacaoPerfil() {
  const { t } = useI18n();
  const { user: authUser, logout } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guardedSubmit } = useSubmitGuard();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [searchAeroporto, setSearchAeroporto] = useState('');
  
  const [formData, setFormData] = useState({
    nome_completo: '',
    email: '',
    telefone: '',
    perfil_solicitado: '',
    empresa_solicitante_id: '',
    aeroportos_solicitados: [],
    justificativa: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Se o contexto de auth já tem perfil ativo, redirecionar imediatamente sem queries
      if (authUser && authUser.status === 'ativo' && Array.isArray(authUser.perfis) && authUser.perfis.length > 0) {
        window.location.href = createPageUrl('Home');
        return;
      }

      // Carregar empresas e aeroportos
      const [empresasData, aeroportosData] = await Promise.all([
        Empresa.list(),
        Aeroporto.list()
      ]);

      const empresasAtivas = empresasData.filter(e => e.status === 'ativa');
      setEmpresas(empresasAtivas);

      // Filtrar apenas aeroportos de Angola
      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');
      setAeroportos(aeroportosAngola);

      // Preencher dados do utilizador
      setFormData(prev => ({
        ...prev,
        nome_completo: authUser?.full_name || '',
        email: authUser?.email || '',
        empresa_solicitante_id: empresasAtivas.length === 1 ? empresasAtivas[0].id : ''
      }));

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError(t('solic.erro_carregar'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    guardedSubmit(async () => {
    setIsSubmitting(true);

    try {
      // IMPORTANTE: Verificar novamente se já existe uma solicitação pendente
      const solicitacoesExistentes = await SolicitacaoAcesso.filter({ 
        user_id: authUser?.id,
        status: 'pendente'
      });

      if (solicitacoesExistentes && solicitacoesExistentes.length > 0) {
        window.location.href = createPageUrl('AguardandoAprovacao');
        return;
      }

      // Validações
      if (!formData.nome_completo || formData.nome_completo.trim().length < 3) {
        throw new Error('Por favor, forneça o seu nome completo (mínimo 3 caracteres).');
      }

      if (!formData.telefone || formData.telefone.trim().length < 9) {
        throw new Error('Por favor, forneça um telefone de contacto válido (mínimo 9 dígitos).');
      }

      if (!formData.perfil_solicitado) {
        throw new Error('Por favor, selecione um perfil.');
      }

      if (!formData.empresa_solicitante_id) {
        throw new Error('Por favor, selecione uma empresa.');
      }

      if (!formData.aeroportos_solicitados || formData.aeroportos_solicitados.length === 0) {
        throw new Error('Por favor, selecione pelo menos um aeroporto.');
      }

      // Criar solicitação
      await SolicitacaoAcesso.create({
        user_id: authUser?.id,
        nome_completo: formData.nome_completo,
        email: formData.email,
        telefone: formData.telefone,
        perfil_solicitado: formData.perfil_solicitado,
        empresa_solicitante_id: formData.empresa_solicitante_id || null,
        aeroportos_solicitados: formData.aeroportos_solicitados,
        justificativa: formData.justificativa || 'Não fornecida',
        status: 'pendente'
      });

      // Notificar admins por email via Edge Function (service_role, sem RLS)
      // A Edge Function auto-resolve os admins da empresa via service_role
      try {
        const gestaoUrl = `${window.location.origin}${createPageUrl('GestaoAcessos')}`;
        sendNotificationEmail({
          to: formData.email, // fallback + confirmação ao solicitante
          template: 'new_access_request',
          data: {
            full_name: formData.nome_completo,
            email: formData.email,
            empresa_id: formData.empresa_solicitante_id,
            url: gestaoUrl
          }
        }).catch(err => console.error('Erro email notificação:', err));
      } catch (emailErr) {
        console.error('Erro ao notificar:', emailErr);
      }

      // Mostrar sucesso
      setSubmitted(true);

    } catch (error) {
      console.error('Erro ao submeter solicitação:', error);
      setError(error.message || 'Erro ao submeter a solicitação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  const perfilOptions = [
    { value: 'operacoes', label: 'Operações' },
    { value: 'safety', label: 'Safety' },
    { value: 'infraestrutura', label: 'Infraestrutura' },
    { value: 'credenciamento', label: 'Credenciamento' },
    { value: 'gestor_empresa', label: 'Gestor de Empresa' }
  ];

  const empresaOptions = empresas.map(e => ({
    value: e.id,
    label: e.nome
  }));

  // Filtrar aeroportos pela empresa selecionada e pelo termo de pesquisa
  const aeroportosDaEmpresa = formData.empresa_solicitante_id
    ? aeroportos.filter(a => a.empresa_id === formData.empresa_solicitante_id)
    : aeroportos;

  const aeroportosFiltrados = aeroportosDaEmpresa.filter(a => {
    if (!searchAeroporto) return true;
    const search = searchAeroporto.toLowerCase();
    return (
      a.codigo_icao.toLowerCase().includes(search) ||
      a.nome.toLowerCase().includes(search) ||
      a.cidade.toLowerCase().includes(search)
    );
  });

  const handleAddAeroporto = (codigo) => {
    if (!formData.aeroportos_solicitados.includes(codigo)) {
      setFormData(prev => ({
        ...prev,
        aeroportos_solicitados: [...prev.aeroportos_solicitados, codigo]
      }));
    }
  };

  const handleRemoveAeroporto = (codigo) => {
    setFormData(prev => ({
      ...prev,
      aeroportos_solicitados: prev.aeroportos_solicitados.filter(c => c !== codigo)
    }));
  };

  const handleToggleAeroporto = (codigo) => {
    if (formData.aeroportos_solicitados.includes(codigo)) {
      handleRemoveAeroporto(codigo);
    } else {
      handleAddAeroporto(codigo);
    }
  };

  const handleSelecionarTodos = () => {
    const todosCodigos = aeroportosDaEmpresa.map(a => a.codigo_icao);
    setFormData(prev => ({
      ...prev,
      aeroportos_solicitados: todosCodigos
    }));
    setSearchAeroporto('');
  };

  const handleLimparTodos = () => {
    setFormData(prev => ({
      ...prev,
      aeroportos_solicitados: []
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-lg text-slate-700 dark:text-slate-300">{t('solic.carregando')}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-xl border-0">
          <CardContent className="p-8 text-center space-y-4">
            <div className="bg-green-100 dark:bg-green-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
              <Info className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('solic.enviada')}</h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('solic.enviada_msg')}
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.href = createPageUrl('AguardandoAprovacao')}
              className="mt-4"
            >
              {t('solic.ver_estado')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 py-8 px-4">
      {/* Logout button top-right */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => logout()}
          className="flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 shadow-md"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UserCog className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t('solic.titulo')}</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {authUser?.full_name ? <>{t('solic.ola')} <span className="font-semibold text-blue-600 dark:text-blue-400">{authUser.full_name.split(' ')[0]}</span>! {t('solic.complete')}</> : t('solic.complete')}
          </p>
        </div>

        <Alert className="mb-6 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 shadow-sm">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100 ml-2">
            {t('solic.info')}
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive" className="mb-6 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="ml-2 flex flex-wrap items-center gap-3">
              <span>{error}</span>
              <button
                onClick={() => window.location.href = createPageUrl('Home')}
                className="underline font-semibold"
              >
                Ir para o Dashboard
              </button>
              <button
                onClick={() => logout()}
                className="underline font-semibold flex items-center gap-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                Fazer logout
              </button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-xl border-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-b dark:border-slate-700">
            <CardTitle className="text-2xl">{t('solic.dados')}</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t('solic.campos_obrigatorios')}</p>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome Completo */}
              <div className="space-y-2">
                <Label htmlFor="nome_completo" className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  {t('solic.nome_completo')}
                </Label>
                <Input
                  id="nome_completo"
                  type="text"
                  value={formData.nome_completo}
                  onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                  placeholder={t('solic.nome_placeholder')}
                  required
                  minLength={3}
                  className="h-12 text-base"
                />
              </div>

              {/* Email (apenas visualização) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  {t('solic.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="h-12 text-base bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700"
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  {t('solic.telefone')}
                </Label>
                <Input
                  id="telefone"
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="+244 XXX XXX XXX"
                  required
                  minLength={9}
                  className="h-12 text-base"
                />
              </div>

              {/* Perfil Solicitado */}
              <div className="space-y-2">
                <Label htmlFor="perfil_solicitado" className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  {t('solic.perfil')}
                </Label>
                <Select
                  id="perfil_solicitado"
                  options={perfilOptions}
                  value={formData.perfil_solicitado}
                  onValueChange={(value) => setFormData({ ...formData, perfil_solicitado: value })}
                  placeholder={t('solic.selecione_perfil')}
                  className="h-12"
                />
                <input type="hidden" required value={formData.perfil_solicitado} />
              </div>

              {/* Empresa */}
              <div className="space-y-2">
                <Label htmlFor="empresa_solicitante_id" className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  {t('solic.empresa')}
                </Label>
                <Combobox
                  id="empresa_solicitante_id"
                  options={empresaOptions}
                  value={formData.empresa_solicitante_id}
                  onValueChange={(value) => setFormData({ ...formData, empresa_solicitante_id: value, aeroportos_solicitados: [] })}
                  placeholder={t('solic.selecione_empresa')}
                  searchPlaceholder={t('solic.pesquisar_empresa')}
                />
                <input type="hidden" required value={formData.empresa_solicitante_id} />
              </div>

              {/* Aeroportos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-slate-700 dark:text-slate-300">
                    {t('solic.aeroportos')}
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelecionarTodos}
                      className="text-xs"
                    >
                      {t('solic.selecionar_todos')}
                    </Button>
                    {formData.aeroportos_solicitados.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleLimparTodos}
                        className="text-xs"
                      >
                        {t('solic.limpar_todos')}
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Campo de pesquisa */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                  <Input
                    type="text"
                    placeholder={t('solic.pesquisar_aeroporto')}
                    value={searchAeroporto}
                    onChange={(e) => setSearchAeroporto(e.target.value)}
                    className="pl-10 h-12 text-base"
                  />
                </div>

                {/* Lista de aeroportos disponíveis */}
                <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 shadow-sm">
                  {aeroportosFiltrados.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t('solic.nenhum_aeroporto')}</p>
                  ) : (
                    <div className="space-y-1">
                      {aeroportosFiltrados.map((aeroporto) => (
                        <button
                          key={aeroporto.codigo_icao}
                          type="button"
                          onClick={() => handleToggleAeroporto(aeroporto.codigo_icao)}
                          className={`w-full text-left px-3 py-2.5 rounded transition-colors ${
                            formData.aeroportos_solicitados.includes(aeroporto.codigo_icao)
                              ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              formData.aeroportos_solicitados.includes(aeroporto.codigo_icao)
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {formData.aeroportos_solicitados.includes(aeroporto.codigo_icao) && (
                                <X className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="font-bold text-blue-600 dark:text-blue-400 text-base">{aeroporto.codigo_icao}</span>
                            <span className="text-slate-700 dark:text-slate-300 text-sm">- {aeroporto.nome}</span>
                            <span className="text-slate-500 dark:text-slate-400 text-xs">({aeroporto.cidade})</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aeroportos selecionados */}
                <input type="hidden" required value={formData.aeroportos_solicitados.length > 0 ? 'ok' : ''} />
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('solic.selecionados')} <span className="font-semibold text-blue-600 dark:text-blue-400">{formData.aeroportos_solicitados.length}</span>
                  </p>
                  {formData.aeroportos_solicitados.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      {formData.aeroportos_solicitados.map((codigo) => {
                        const aeroporto = aeroportos.find(a => a.codigo_icao === codigo);
                        return (
                          <Badge
                            key={codigo}
                            variant="secondary"
                            className="px-3 py-2 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 flex items-center gap-2"
                          >
                            <span className="font-semibold">{codigo}</span>
                            {aeroporto && <span className="text-xs">- {aeroporto.cidade}</span>}
                            <button
                              type="button"
                              onClick={() => handleRemoveAeroporto(codigo)}
                              className="ml-1 hover:text-blue-900 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">{t('solic.nenhum_selecionado')}</p>
                  )}
                </div>
              </div>

              {/* Justificativa (opcional) */}
              <div className="space-y-2">
                <Label htmlFor="justificativa" className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  {t('solic.justificativa')} <span className="text-slate-400 dark:text-slate-500 font-normal">{t('solic.opcional')}</span>
                </Label>
                <Textarea
                  id="justificativa"
                  value={formData.justificativa}
                  onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
                  placeholder={t('solic.justificativa_placeholder')}
                  rows={4}
                  className="text-base resize-none"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg font-semibold shadow-lg transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('solic.enviando')}
                  </>
                ) : (
                  t('solic.enviar')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
