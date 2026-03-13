
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserCog, Info, AlertCircle, X, Search } from 'lucide-react';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';

import { User } from '@/entities/User';
import { SolicitacaoAcesso } from '@/entities/SolicitacaoAcesso';
import { Empresa } from '@/entities/Empresa';
import { Aeroporto } from '@/entities/Aeroporto';
import { createPageUrl } from '@/utils';

export default function SolicitacaoPerfil() {
  const [user, setUser] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Carregar utilizador atual
      const currentUser = await User.me();
      setUser(currentUser);
      
      // Verificar se já existe uma solicitação pendente
      const solicitacoesExistentes = await SolicitacaoAcesso.filter({ 
        user_id: currentUser.id,
        status: 'pendente'
      });

      // Se já existe uma solicitação pendente, redirecionar para aguardar aprovação
      if (solicitacoesExistentes && solicitacoesExistentes.length > 0) {
        console.log('Já existe uma solicitação pendente, redirecionando...');
        window.location.href = createPageUrl('AguardandoAprovacao');
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
        nome_completo: currentUser.full_name || '',
        email: currentUser.email || '',
        empresa_solicitante_id: empresasAtivas.length === 1 ? empresasAtivas[0].id : ''
      }));

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Não foi possível carregar os dados necessários.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // IMPORTANTE: Verificar novamente se já existe uma solicitação pendente
      const solicitacoesExistentes = await SolicitacaoAcesso.filter({ 
        user_id: user.id,
        status: 'pendente'
      });

      if (solicitacoesExistentes && solicitacoesExistentes.length > 0) {
        console.log('Já existe uma solicitação pendente, redirecionando...');
        window.location.href = createPageUrl('AguardandoAprovacao');
        return;
      }

      // Validações
      if (!formData.telefone) {
        throw new Error('Por favor, forneça um telefone de contacto.');
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
        user_id: user.id,
        nome_completo: formData.nome_completo,
        email: formData.email,
        telefone: formData.telefone,
        perfil_solicitado: formData.perfil_solicitado,
        empresa_solicitante_id: formData.empresa_solicitante_id || null,
        aeroportos_solicitados: formData.aeroportos_solicitados,
        justificativa: formData.justificativa || 'Não fornecida',
        status: 'pendente'
      });

      // Mostrar sucesso
      setSubmitted(true);

    } catch (error) {
      console.error('Erro ao submeter solicitação:', error);
      setError(error.message || 'Erro ao submeter a solicitação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const perfilOptions = [
    { value: 'operacoes', label: 'Operações' },
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-lg text-slate-700">A carregar...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-xl border-0">
          <CardContent className="p-8 text-center space-y-4">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
              <Info className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Solicitação Enviada!</h2>
            <p className="text-slate-600">
              A sua solicitação de acesso foi recebida com sucesso. Um administrador irá analisá-la e receberá uma notificação por e-mail quando for aprovada.
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.href = createPageUrl('AguardandoAprovacao')}
              className="mt-4"
            >
              Ver Estado da Solicitação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UserCog className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Solicitar Acesso ao Sistema</h1>
          <p className="text-lg text-slate-600">
            Olá <span className="font-semibold text-blue-600">{user?.full_name?.split(' ')[0] || 'msager'}</span>! Complete o formulário abaixo.
          </p>
        </div>

        <Alert className="mb-6 border-blue-300 bg-blue-50 shadow-sm">
          <Info className="h-5 w-5 text-blue-600" />
          <AlertDescription className="text-blue-900 ml-2">
            A sua solicitação será analisada por um administrador. Receberá uma notificação por e-mail quando for aprovada.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive" className="mb-6 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="ml-2">{error}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="text-2xl">Dados da Solicitação</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Preencha todos os campos obrigatórios (*)</p>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome Completo */}
              <div className="space-y-2">
                <Label htmlFor="nome_completo" className="text-base font-semibold text-slate-700">
                  Nome Completo *
                </Label>
                <Input
                  id="nome_completo"
                  type="text"
                  value={formData.nome_completo}
                  onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                  placeholder="Seu nome completo"
                  required
                  className="h-12 text-base"
                />
              </div>

              {/* Email (apenas visualização) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-semibold text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="h-12 text-base bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200"
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-base font-semibold text-slate-700">
                  Telefone de Contacto *
                </Label>
                <Input
                  id="telefone"
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="+244 XXX XXX XXX"
                  required
                  className="h-12 text-base"
                />
              </div>

              {/* Perfil Solicitado */}
              <div className="space-y-2">
                <Label htmlFor="perfil_solicitado" className="text-base font-semibold text-slate-700">
                  Perfil Solicitado *
                </Label>
                <Select
                  id="perfil_solicitado"
                  options={perfilOptions}
                  value={formData.perfil_solicitado}
                  onValueChange={(value) => setFormData({ ...formData, perfil_solicitado: value })}
                  placeholder="Selecione um perfil"
                  className="h-12"
                />
              </div>

              {/* Empresa */}
              <div className="space-y-2">
                <Label htmlFor="empresa_solicitante_id" className="text-base font-semibold text-slate-700">
                  Empresa *
                </Label>
                <Combobox
                  id="empresa_solicitante_id"
                  options={empresaOptions}
                  value={formData.empresa_solicitante_id}
                  onValueChange={(value) => setFormData({ ...formData, empresa_solicitante_id: value, aeroportos_solicitados: [] })}
                  placeholder="Selecione a empresa"
                  searchPlaceholder="Pesquisar empresa..."
                />
              </div>

              {/* Aeroportos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-slate-700">
                    Aeroportos Solicitados *
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelecionarTodos}
                      className="text-xs"
                    >
                      Selecionar Todos
                    </Button>
                    {formData.aeroportos_solicitados.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleLimparTodos}
                        className="text-xs"
                      >
                        Limpar Todos
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Campo de pesquisa */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Pesquisar aeroporto por código, nome ou cidade..."
                    value={searchAeroporto}
                    onChange={(e) => setSearchAeroporto(e.target.value)}
                    className="pl-10 h-12 text-base"
                  />
                </div>

                {/* Lista de aeroportos disponíveis */}
                <div className="border border-slate-300 rounded-lg p-2 max-h-60 overflow-y-auto bg-white shadow-sm">
                  {aeroportosFiltrados.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">Nenhum aeroporto encontrado</p>
                  ) : (
                    <div className="space-y-1">
                      {aeroportosFiltrados.map((aeroporto) => (
                        <button
                          key={aeroporto.codigo_icao}
                          type="button"
                          onClick={() => handleToggleAeroporto(aeroporto.codigo_icao)}
                          className={`w-full text-left px-3 py-2.5 rounded transition-colors ${
                            formData.aeroportos_solicitados.includes(aeroporto.codigo_icao)
                              ? 'bg-blue-100 border border-blue-300'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              formData.aeroportos_solicitados.includes(aeroporto.codigo_icao)
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-slate-300'
                            }`}>
                              {formData.aeroportos_solicitados.includes(aeroporto.codigo_icao) && (
                                <X className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="font-bold text-blue-600 text-base">{aeroporto.codigo_icao}</span>
                            <span className="text-slate-700 text-sm">- {aeroporto.nome}</span>
                            <span className="text-slate-500 text-xs">({aeroporto.cidade})</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aeroportos selecionados */}
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Selecionados: <span className="font-semibold text-blue-600">{formData.aeroportos_solicitados.length}</span>
                  </p>
                  {formData.aeroportos_solicitados.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
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
                    <p className="text-sm text-slate-400 italic">Nenhum aeroporto selecionado ainda</p>
                  )}
                </div>
              </div>

              {/* Justificativa (opcional) */}
              <div className="space-y-2">
                <Label htmlFor="justificativa" className="text-base font-semibold text-slate-700">
                  Justificativa <span className="text-slate-400 font-normal">(Opcional)</span>
                </Label>
                <Textarea
                  id="justificativa"
                  value={formData.justificativa}
                  onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
                  placeholder="Explique por que você precisa de acesso ao sistema (opcional)"
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
                    A enviar solicitação...
                  </>
                ) : (
                  'Enviar Solicitação'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
