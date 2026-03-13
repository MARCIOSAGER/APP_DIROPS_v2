
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Plus, Trash2, Building, Save, MapPin, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { Empresa } from '@/entities/Empresa';
import { AreaAcesso } from '@/entities/AreaAcesso';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';
// The TipoDocumento entity will be dynamically imported as per the outline for handlers
import SuccessModal from '../shared/SuccessModal';

export default function ConfiguracaoCredenciamento({ initialEmpresas, initialAreasAcesso, onUpdate }) {
  const [activeTab, setActiveTab] = useState('empresas');
  const [empresasList, setEmpresasList] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });

  const [empresaForm, setEmpresaForm] = useState({
    nome: '',
    nif: '',
    endereco: '',
    telefone: '',
    email_principal: '',
    responsavel_nome: '',
    responsavel_email: '',
    responsavel_telefone: '',
    area_atividade: '',
    status: 'ativa'
  });

  // States for Areas de Acesso
  const [areasAcesso, setAreasAcesso] = useState([]);
  const [isAreaFormOpen, setIsAreaFormOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [areaForm, setAreaForm] = useState({
    nome: '',
    descricao: '',
    status: 'ativo'
  });

  // States for Tipos de Documento
  const [tiposDocumento, setTiposDocumento] = useState([]);
  const [isTipoDocFormOpen, setIsTipoDocFormOpen] = useState(false);
  const [editingTipoDoc, setEditingTipoDoc] = useState(null);
  const [tipoDocForm, setTipoDocForm] = useState({
    nome: '',
    descricao: '',
    obrigatorio: false,
    tipo_credencial: [],
    formato_aceito: ['PDF'],
    tamanho_max_mb: 5,
    status: 'ativo',
    ordem: 1
  });

  // State for system configuration
  const [globalConfig, setGlobalConfig] = useState({ email_notificacao_acessos: '' });
  const [configId, setConfigId] = useState(null);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);

  useEffect(() => {
    setEmpresasList(initialEmpresas);
    setAreasAcesso(initialAreasAcesso);
    loadTiposDocumento();
  }, [initialEmpresas, initialAreasAcesso]);

  useEffect(() => {
    loadGlobalConfig();
  }, []);

  const loadGlobalConfig = async () => {
    try {
      const configData = await ConfiguracaoSistema.list();
      if (configData.length > 0) {
        setGlobalConfig(configData[0]);
        setConfigId(configData[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações globais:', error);
    }
  };

  const handleGlobalConfigChange = (e) => {
    setGlobalConfig(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveGlobalConfig = async () => {
    setIsSavingGlobal(true);
    setAlertMessage(null);
    try {
      if (configId) {
        await ConfiguracaoSistema.update(configId, globalConfig);
      } else {
        const newConfig = await ConfiguracaoSistema.create(globalConfig);
        setConfigId(newConfig.id);
      }
      setAlertMessage({ type: 'success', title: 'Sucesso!', message: 'Configurações globais guardadas.' });
    } catch (error) {
      console.error('Erro ao guardar configurações globais:', error);
      setAlertMessage({ type: 'error', title: 'Erro!', message: 'Não foi possível guardar as configurações.' });
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const loadTiposDocumento = async () => {
    try {
      const { TipoDocumento } = await import('@/entities/TipoDocumento');
      const tipos = await TipoDocumento.list('ordem');
      setTiposDocumento(tipos);
    } catch (error) {
      console.error('Erro ao carregar tipos de documento:', error);
    }
  };

  const handleEmpresaSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmpresa) {
        await Empresa.update(editingEmpresa.id, empresaForm);
        setSuccessInfo({
          isOpen: true,
          title: 'Empresa Atualizada!',
          message: 'Os dados da empresa foram atualizados com sucesso.'
        });
      } else {
        await Empresa.create(empresaForm);
        setSuccessInfo({
          isOpen: true,
          title: 'Empresa Criada!',
          message: 'Nova empresa foi registada com sucesso.'
        });
      }
      resetForm();
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      alert('Erro ao salvar empresa');
    }
  };

  const handleEdit = (empresa) => {
    setEditingEmpresa(empresa);
    setEmpresaForm(empresa);
    setIsFormOpen(true);
  };

  const handleDelete = async (empresaId) => {
    if (confirm('Tem certeza que deseja excluir esta empresa?')) {
      try {
        await Empresa.delete(empresaId);
        setSuccessInfo({
          isOpen: true,
          title: 'Empresa Excluída!',
          message: 'A empresa foi removida com sucesso.'
        });
        onUpdate();
      } catch (error) {
          console.error('Erro ao excluir empresa:', error);
          alert('Erro ao excluir empresa');
      }
    }
  };

  const resetForm = () => {
    setEmpresaForm({
      nome: '',
      nif: '',
      endereco: '',
      telefone: '',
      email_principal: '',
      responsavel_nome: '',
      responsavel_email: '',
      responsavel_telefone: '',
      area_atividade: '',
      status: 'ativa'
    });
    setEditingEmpresa(null);
    setIsFormOpen(false);
  };

  // Handlers for Area de Acesso
  const handleAreaSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingArea) {
        await AreaAcesso.update(editingArea.id, areaForm);
        setSuccessInfo({
          isOpen: true,
          title: 'Área Atualizada!',
          message: 'A área de acesso foi atualizada com sucesso.'
        });
      } else {
        await AreaAcesso.create(areaForm);
        setSuccessInfo({
          isOpen: true,
          title: 'Área Criada!',
          message: 'Nova área de acesso foi registada com sucesso.'
        });
      }
      resetAreaForm();
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar área de acesso:', error);
      alert('Erro ao salvar área de acesso');
    }
  };

  const handleEditArea = (area) => {
    setEditingArea(area);
    setAreaForm(area);
    setIsAreaFormOpen(true);
  };

  const handleDeleteArea = async (areaId) => {
    if (confirm('Tem certeza que deseja excluir esta área de acesso?')) {
      try {
        await AreaAcesso.delete(areaId);
        setSuccessInfo({
          isOpen: true,
          title: 'Área Excluída!',
          message: 'A área de acesso foi removida com sucesso.'
        });
        onUpdate();
      } catch (error) {
        console.error('Erro ao excluir área:', error);
        alert('Erro ao excluir área');
      }
    }
  };

  const resetAreaForm = () => {
    setAreaForm({
      nome: '',
      descricao: '',
      status: 'ativo'
    });
    setEditingArea(null);
    setIsAreaFormOpen(false);
  };

  // Handlers for Tipos de Documento
  const handleTipoDocSubmit = async (e) => {
    e.preventDefault();
    try {
      const { TipoDocumento } = await import('@/entities/TipoDocumento');
      if (editingTipoDoc) {
        await TipoDocumento.update(editingTipoDoc.id, tipoDocForm);
        setSuccessInfo({
          isOpen: true,
          title: 'Tipo de Documento Atualizado!',
          message: 'O tipo de documento foi atualizado com sucesso.'
        });
      } else {
        await TipoDocumento.create(tipoDocForm);
        setSuccessInfo({
          isOpen: true,
          title: 'Tipo de Documento Criado!',
          message: 'Novo tipo de documento foi registado com sucesso.'
        });
      }
      resetTipoDocForm();
      loadTiposDocumento();
    } catch (error) {
      console.error('Erro ao salvar tipo de documento:', error);
      alert('Erro ao salvar tipo de documento');
    }
  };

  const handleEditTipoDoc = (tipoDoc) => {
    setEditingTipoDoc(tipoDoc);
    setTipoDocForm(tipoDoc);
    setIsTipoDocFormOpen(true);
  };

  const handleDeleteTipoDoc = async (tipoDocId) => {
    if (confirm('Tem certeza que deseja excluir este tipo de documento?')) {
      try {
        const { TipoDocumento } = await import('@/entities/TipoDocumento');
        await TipoDocumento.delete(tipoDocId);
        setSuccessInfo({
          isOpen: true,
          title: 'Tipo de Documento Excluído!',
          message: 'O tipo de documento foi removido com sucesso.'
        });
        loadTiposDocumento();
      } catch (error) {
        console.error('Erro ao excluir tipo de documento:', error);
        alert('Erro ao excluir tipo de documento');
      }
    }
  };

  const resetTipoDocForm = () => {
    setTipoDocForm({
      nome: '',
      descricao: '',
      obrigatorio: false,
      tipo_credencial: [],
      formato_aceito: ['PDF'],
      tamanho_max_mb: 5,
      status: 'ativo',
      ordem: 1
    });
    setEditingTipoDoc(null);
    setIsTipoDocFormOpen(false);
  };

  return (
    <div className="space-y-6">
      {alertMessage && (
        <Alert variant={alertMessage.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{alertMessage.title}</AlertTitle>
          <AlertDescription>{alertMessage.message}</AlertDescription>
        </Alert>
      )}

      {/* New Global Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais do Sistema</CardTitle>
          <CardDescription>Defina e-mails de notificação e outros parâmetros globais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email_notificacao_acessos">E-mail para Notificação de Acessos</Label>
            <Input
              id="email_notificacao_acessos"
              name="email_notificacao_acessos"
              type="email"
              placeholder="notificacoes@sga.co.ao"
              value={globalConfig.email_notificacao_acessos || ''}
              onChange={handleGlobalConfigChange}
            />
            <p className="text-xs text-slate-500">
              Este e-mail receberá um alerta sempre que uma nova solicitação de acesso for submetida.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveGlobalConfig} disabled={isSavingGlobal}>
            {isSavingGlobal ? 'A guardar...' : 'Guardar Configurações Gerais'}
          </Button>
        </CardFooter>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="empresas">Gestão de Empresas</TabsTrigger>
          <TabsTrigger value="areas">Gestão de Áreas de Acesso</TabsTrigger>
          <TabsTrigger value="documentos">Tipos de Documento</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Lista de Empresas
                </CardTitle>
                <Button onClick={() => { setIsFormOpen(true); setEditingEmpresa(null); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Empresa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isFormOpen && (
                <div className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingEmpresa ? 'Editar' : 'Nova'} Empresa
                  </h3>
                  <form onSubmit={handleEmpresaSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Nome da Empresa *</Label>
                        <Input
                          value={empresaForm.nome}
                          onChange={(e) => setEmpresaForm(prev => ({...prev, nome: e.target.value}))}
                          required
                        />
                      </div>
                      <div>
                        <Label>NIF *</Label>
                        <Input
                          value={empresaForm.nif}
                          onChange={(e) => setEmpresaForm(prev => ({...prev, nif: e.target.value}))}
                          required
                        />
                      </div>
                      <div>
                        <Label>Email Principal *</Label>
                        <Input
                          type="email"
                          value={empresaForm.email_principal}
                          onChange={(e) => setEmpresaForm(prev => ({...prev, email_principal: e.target.value}))}
                          required
                        />
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        <Input
                          value={empresaForm.telefone}
                          onChange={(e) => setEmpresaForm(prev => ({...prev, telefone: e.target.value}))}
                        />
                      </div>
                      <div>
                        <Label>Responsável Principal *</Label>
                        <Input
                          value={empresaForm.responsavel_nome}
                          onChange={(e) => setEmpresaForm(prev => ({...prev, responsavel_nome: e.target.value}))}
                          required
                        />
                      </div>
                      <div>
                        <Label>Email do Responsável *</Label>
                        <Input
                          type="email"
                          value={empresaForm.responsavel_email}
                          onChange={(e) => setEmpresaForm(prev => ({...prev, responsavel_email: e.target.value}))}
                          required
                        />
                      </div>
                      <div>
                        <Label>Telefone do Responsável</Label>
                        <Input
                          value={empresaForm.responsavel_telefone}
                          onChange={(e) => setEmpresaForm(prev => ({...prev, responsavel_telefone: e.target.value}))}
                        />
                      </div>
                      <div>
                        <Label>Área de Atividade</Label>
                        <Input
                          value={empresaForm.area_atividade}
                          onChange={(e) => setEmpresaForm(prev => ({...prev, area_atividade: e.target.value}))}
                        />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          options={[
                            { value: 'ativa', label: 'Ativa' },
                            { value: 'suspensa', label: 'Suspensa' },
                            { value: 'inativa', label: 'Inativa' }
                          ]}
                          value={empresaForm.status}
                          onValueChange={(value) => setEmpresaForm(prev => ({...prev, status: value}))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Endereço</Label>
                      <Textarea
                        value={empresaForm.endereco}
                        onChange={(e) => setEmpresaForm(prev => ({...prev, endereco: e.target.value}))}
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        {editingEmpresa ? 'Atualizar' : 'Criar'} Empresa
                      </Button>
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 font-semibold text-slate-700">Nome</th>
                      <th className="text-left p-4 font-semibold text-slate-700">NIF</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Responsável</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Email</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Status</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresasList.map((empresa, index) => (
                      <tr key={empresa.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-4 font-medium">{empresa.nome}</td>
                        <td className="p-4">{empresa.nif}</td>
                        <td className="p-4">{empresa.responsavel_nome}</td>
                        <td className="p-4">{empresa.email_principal}</td> {/* Corrected to email_principal */}
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            empresa.status === 'ativa' ? 'bg-green-100 text-green-800' :
                            empresa.status === 'suspensa' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {empresa.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(empresa)}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(empresa.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="areas" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Lista de Áreas de Acesso
                </CardTitle>
                <Button onClick={() => { setIsAreaFormOpen(true); setEditingArea(null); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Área
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isAreaFormOpen && (
                <div className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingArea ? 'Editar' : 'Nova'} Área de Acesso
                  </h3>
                  <form onSubmit={handleAreaSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Nome da Área *</Label>
                        <Input
                          value={areaForm.nome}
                          onChange={(e) => setAreaForm(prev => ({...prev, nome: e.target.value}))}
                          required
                        />
                      </div>
                       <div>
                        <Label>Status</Label>
                        <Select
                          options={[
                            { value: 'ativo', label: 'Ativo' },
                            { value: 'inativo', label: 'Inativo' }
                          ]}
                          value={areaForm.status}
                          onValueChange={(value) => setAreaForm(prev => ({...prev, status: value}))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={areaForm.descricao}
                        onChange={(e) => setAreaForm(prev => ({...prev, descricao: e.target.value}))}
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        {editingArea ? 'Atualizar' : 'Criar'} Área
                      </Button>
                      <Button type="button" variant="outline" onClick={resetAreaForm}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 font-semibold text-slate-700">Nome</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Descrição</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Status</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areasAcesso.map((area, index) => (
                      <tr key={area.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-4 font-medium">{area.nome}</td>
                        <td className="p-4 text-sm text-slate-600">{area.descricao}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            area.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {area.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditArea(area)}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteArea(area.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Tipos de Documento
                </CardTitle>
                <Button onClick={() => { setIsTipoDocFormOpen(true); setEditingTipoDoc(null); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Tipo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isTipoDocFormOpen && (
                <div className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingTipoDoc ? 'Editar' : 'Novo'} Tipo de Documento
                  </h3>
                  <form onSubmit={handleTipoDocSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Nome do Documento *</Label>
                        <Input
                          value={tipoDocForm.nome}
                          onChange={(e) => setTipoDocForm(prev => ({...prev, nome: e.target.value}))}
                          required
                        />
                      </div>
                      <div>
                        <Label>Ordem de Exibição</Label>
                        <Input
                          type="number"
                          value={tipoDocForm.ordem}
                          onChange={(e) => setTipoDocForm(prev => ({...prev, ordem: parseInt(e.target.value)}))}
                        />
                      </div>
                      <div>
                        <Label>Tamanho Máximo (MB)</Label>
                        <Input
                          type="number"
                          value={tipoDocForm.tamanho_max_mb}
                          onChange={(e) => setTipoDocForm(prev => ({...prev, tamanho_max_mb: parseInt(e.target.value)}))}
                        />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          options={[
                            { value: 'ativo', label: 'Ativo' },
                            { value: 'inativo', label: 'Inativo' }
                          ]}
                          value={tipoDocForm.status}
                          onValueChange={(value) => setTipoDocForm(prev => ({...prev, status: value}))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={tipoDocForm.descricao}
                        onChange={(e) => setTipoDocForm(prev => ({...prev, descricao: e.target.value}))}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Aplicável a:</Label>
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="pessoa-check"
                              checked={tipoDocForm.tipo_credencial.includes('pessoa')}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setTipoDocForm(prev => ({...prev, tipo_credencial: [...prev.tipo_credencial, 'pessoa']}));
                                } else {
                                  setTipoDocForm(prev => ({...prev, tipo_credencial: prev.tipo_credencial.filter(t => t !== 'pessoa')}));
                                }
                              }}
                            />
                            <Label htmlFor="pessoa-check">Pessoa</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="viatura-check"
                              checked={tipoDocForm.tipo_credencial.includes('viatura')}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setTipoDocForm(prev => ({...prev, tipo_credencial: [...prev.tipo_credencial, 'viatura']}));
                                } else {
                                  setTipoDocForm(prev => ({...prev, tipo_credencial: prev.tipo_credencial.filter(t => t !== 'viatura')}));
                                }
                              }}
                            />
                            <Label htmlFor="viatura-check">Viatura</Label>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label>Formatos Aceitos:</Label>
                        <div className="space-y-2 mt-2">
                          {['PDF', 'JPG', 'PNG', 'JPEG'].map(format => (
                            <div key={format} className="flex items-center space-x-2">
                              <Checkbox
                                id={`format-${format}`}
                                checked={tipoDocForm.formato_aceito.includes(format)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setTipoDocForm(prev => ({...prev, formato_aceito: [...prev.formato_aceito, format]}));
                                  } else {
                                    setTipoDocForm(prev => ({...prev, formato_aceito: prev.formato_aceito.filter(f => f !== format)}));
                                  }
                                }}
                              />
                              <Label htmlFor={`format-${format}`}>{format}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="obrigatorio-check"
                        checked={tipoDocForm.obrigatorio}
                        onCheckedChange={(checked) => setTipoDocForm(prev => ({...prev, obrigatorio: checked}))}
                      />
                      <Label htmlFor="obrigatorio-check">Documento Obrigatório</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        {editingTipoDoc ? 'Atualizar' : 'Criar'} Tipo
                      </Button>
                      <Button type="button" variant="outline" onClick={resetTipoDocForm}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 font-semibold text-slate-700">Nome</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Aplicável a</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Formatos</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Obrigatório</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Status</th>
                      <th className="text-left p-4 font-semibold text-slate-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiposDocumento.map((tipoDoc, index) => (
                      <tr key={tipoDoc.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-4 font-medium">{tipoDoc.nome}</td>
                        <td className="p-4 text-sm">{tipoDoc.tipo_credencial.join(', ')}</td>
                        <td className="p-4 text-sm">{tipoDoc.formato_aceito.join(', ')}</td>
                        <td className="p-4">
                          {tipoDoc.obrigatorio ? (
                            <span className="text-red-600 font-medium">Sim</span>
                          ) : (
                            <span className="text-slate-500">Não</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tipoDoc.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {tipoDoc.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditTipoDoc(tipoDoc)}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTipoDoc(tipoDoc.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
        title={successInfo.title}
        message={successInfo.message}
      />
    </div>
  );
}
