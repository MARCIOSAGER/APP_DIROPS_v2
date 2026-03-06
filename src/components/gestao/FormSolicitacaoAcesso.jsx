
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Aeroporto } from '@/entities/Aeroporto';
import { Empresa } from '@/entities/Empresa';
import { Send, Search, X } from 'lucide-react';

export default function FormSolicitacaoAcesso({ userData, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    nome_completo: userData?.full_name || '',
    telefone: userData?.telefone || '',
    perfil_solicitado: '',
    empresa_solicitante_id: '',
    aeroportos_solicitados: [],
    justificativa: ''
  });

  const [aeroportos, setAeroportos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [searchAeroporto, setSearchAeroporto] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [aeroportosData, empresasData] = await Promise.all([
        Aeroporto.list(),
        Empresa.list()
      ]);
      setAeroportos(aeroportosData.filter(a => a.pais === 'AO'));
      setEmpresas(empresasData.filter(e => e.status === 'ativa'));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Se mudou o perfil e não é mais gestor_empresa, limpar empresa_solicitante_id
      if (field === 'perfil_solicitado' && value !== 'gestor_empresa') {
        newData.empresa_solicitante_id = '';
      }
      
      return newData;
    });
  };

  const handleAeroportoChange = (codigoIcao) => {
    setFormData(prev => {
      const aeroportos = prev.aeroportos_solicitados.includes(codigoIcao)
        ? prev.aeroportos_solicitados.filter(a => a !== codigoIcao)
        : [...prev.aeroportos_solicitados, codigoIcao];
      return { ...prev, aeroportos_solicitados: aeroportos };
    });
  };

  const handleSelectAllAeroportos = (checked) => {
    if (checked) {
      const aeroportosFiltrados = aeroportos.filter(a =>
        a.nome.toLowerCase().includes(searchAeroporto.toLowerCase()) ||
        a.codigo_icao.toLowerCase().includes(searchAeroporto.toLowerCase())
      );
      const todosCodigosIcao = aeroportosFiltrados.map(a => a.codigo_icao);
      setFormData(prev => ({ ...prev, aeroportos_solicitados: todosCodigosIcao }));
    } else {
      setFormData(prev => ({ ...prev, aeroportos_solicitados: [] }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validação final antes de enviar
    if (!formData.nome_completo || !formData.telefone || !formData.perfil_solicitado || !formData.justificativa) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (formData.perfil_solicitado === 'gestor_empresa' && !formData.empresa_solicitante_id) {
      alert('Por favor, selecione a empresa que você representa.');
      return;
    }

    if (formData.perfil_solicitado !== 'gestor_empresa' && formData.aeroportos_solicitados.length === 0) {
      alert('Por favor, selecione pelo menos um aeroporto.');
      return;
    }

    onSubmit(formData);
  };

  const perfilOptions = [
    { value: '', label: 'Selecione um perfil...' },
    { value: 'operacoes', label: 'Operações' },
    { value: 'infraestrutura', label: 'Infraestrutura' },
    { value: 'credenciamento', label: 'Credenciamento' },
    { value: 'gestor_empresa', label: 'Gestor de Empresa' },
    { value: 'visualizador', label: 'Visualizador' }
  ];

  const empresaOptions = [
    { value: '', label: 'Selecione uma empresa...' },
    ...empresas.map(e => ({ value: e.id, label: e.nome }))
  ];

  const aeroportosFiltrados = aeroportos.filter(a =>
    a.nome.toLowerCase().includes(searchAeroporto.toLowerCase()) ||
    a.codigo_icao.toLowerCase().includes(searchAeroporto.toLowerCase()) ||
    a.cidade?.toLowerCase().includes(searchAeroporto.toLowerCase())
  );

  const todosAeroportosFiltradosSelecionados = aeroportosFiltrados.length > 0 &&
    aeroportosFiltrados.every(a => formData.aeroportos_solicitados.includes(a.codigo_icao));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Campos de Confirmação - Nome e Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome_completo">Nome Completo *</Label>
          <Input
            id="nome_completo"
            type="text"
            placeholder="Ex: João Silva"
            value={formData.nome_completo}
            onChange={(e) => handleInputChange('nome_completo', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={userData?.email || ''}
            disabled
            className="bg-slate-100 text-slate-600 cursor-not-allowed"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefone">Telefone de Contacto *</Label>
        <Input
          id="telefone"
          type="tel"
          placeholder="Ex: +244 912 345 678"
          value={formData.telefone}
          onChange={(e) => handleInputChange('telefone', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="perfil">Perfil Solicitado *</Label>
        <Select
          id="perfil"
          options={perfilOptions}
          value={formData.perfil_solicitado}
          onValueChange={(value) => handleInputChange('perfil_solicitado', value)}
          placeholder="Selecione um perfil..."
        />
      </div>

      {/* Campo de Empresa - Apenas para Gestor de Empresa */}
      {formData.perfil_solicitado === 'gestor_empresa' && (
        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa que Representa *</Label>
          <Select
            id="empresa"
            options={empresaOptions}
            value={formData.empresa_solicitante_id}
            onValueChange={(value) => handleInputChange('empresa_solicitante_id', value)}
            placeholder="Selecione uma empresa..."
          />
          <p className="text-xs text-slate-500">
            💼 Selecione a empresa que você representa (ex: companhia aérea, empresa de handling, etc.)
          </p>
        </div>
      )}

      {/* Aeroportos Solicitados */}
      {formData.perfil_solicitado && formData.perfil_solicitado !== 'gestor_empresa' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Aeroportos Solicitados *</Label>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>{formData.aeroportos_solicitados.length} selecionado(s)</span>
              <Checkbox
                id="select-all"
                checked={todosAeroportosFiltradosSelecionados}
                onCheckedChange={handleSelectAllAeroportos}
              />
              <label htmlFor="select-all" className="cursor-pointer">
                Selecionar Todos
              </label>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar aeroporto por nome, código ou cidade..."
              value={searchAeroporto}
              onChange={(e) => setSearchAeroporto(e.target.value)}
              className="pl-10"
            />
            {searchAeroporto && (
              <button
                type="button"
                onClick={() => setSearchAeroporto('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto bg-slate-50">
            {aeroportosFiltrados.length === 0 ? (
              <p className="text-center text-slate-500 py-4">
                Nenhum aeroporto encontrado com "{searchAeroporto}"
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aeroportosFiltrados.map((aeroporto) => (
                  <div
                    key={aeroporto.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-blue-200"
                  >
                    <Checkbox
                      id={`aeroporto-${aeroporto.id}`}
                      checked={formData.aeroportos_solicitados.includes(aeroporto.codigo_icao)}
                      onCheckedChange={() => handleAeroportoChange(aeroporto.codigo_icao)}
                    />
                    <label
                      htmlFor={`aeroporto-${aeroporto.id}`}
                      className="cursor-pointer flex-1"
                    >
                      <div className="font-medium text-slate-900">{aeroporto.nome}</div>
                      <div className="text-sm text-slate-500">
                        {aeroporto.codigo_icao} • {aeroporto.cidade}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {searchAeroporto && aeroportosFiltrados.length > 0 && (
            <p className="text-xs text-slate-500">
              Mostrando {aeroportosFiltrados.length} de {aeroportos.length} aeroportos
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="justificativa">Justificativa *</Label>
        <Textarea
          id="justificativa"
          placeholder="Explique o motivo da sua solicitação de acesso..."
          value={formData.justificativa}
          onChange={(e) => handleInputChange('justificativa', e.target.value)}
          rows={4}
          required
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        disabled={isLoading || isLoadingData} // Disable if data is still loading
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Enviando...
          </>
        ) : isLoadingData ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Carregando dados...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Enviar Solicitação
          </>
        )}
      </Button>
    </form>
  );
}
