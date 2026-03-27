import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Building2, Plus, Edit, Trash2, Search, MapPin, Users, Upload, Save, X, Eye } from 'lucide-react';
import { Empresa } from '@/entities/Empresa';
import { Aeroporto } from '@/entities/Aeroporto';
import { User as UserEntity } from '@/entities/User';
import { useAuth } from '@/lib/AuthContext';
import { isSuperAdmin } from '@/components/lib/userUtils';
import { base44 } from '@/api/base44Client';
import AccessDenied from '@/components/shared/AccessDenied';
import { useI18n } from '@/components/lib/i18n';
import { useEmpresas } from '@/hooks/useEmpresas';

const STATUS_OPTIONS = [
  { value: 'ativa', label: 'Ativa', className: 'bg-green-100 text-green-800' },
  { value: 'inativa', label: 'Inativa', className: 'bg-red-100 text-red-800' },
];

const EMPTY_FORM = {
  nome: '',
  nif: '',
  endereco: '',
  telefone: '',
  email: '',
  website: '',
  observacoes: '',
  status: 'ativa',
  logo_url: '',
};

export default function GestaoEmpresas() {
  const { t } = useI18n();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: empresas = [], isLoading: isLoadingEmpresas } = useEmpresas();
  const [aeroportos, setAeroportos] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingSecondary, setIsLoadingSecondary] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const isLoading = isLoadingEmpresas || isLoadingSecondary;

  useEffect(() => {
    loadSecondaryData();
  }, []);

  const loadSecondaryData = async () => {
    setIsLoadingSecondary(true);
    try {
      const [aeroportosData, usersData] = await Promise.all([
        Aeroporto.list(),
        UserEntity.list(),
      ]);
      setAeroportos(aeroportosData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoadingSecondary(false);
    }
  };

  if (!authUser || !isSuperAdmin(authUser)) {
    return <AccessDenied />;
  }

  const filteredEmpresas = empresas.filter(e =>
    e.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.nif?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAeroportosDaEmpresa = (empresaId) =>
    aeroportos.filter(a => a.empresa_id === empresaId);

  const getUsersDaEmpresa = (empresaId) =>
    users.filter(u => u.empresa_id === empresaId);

  const handleOpenCreate = () => {
    setEditingEmpresa(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (empresa) => {
    setEditingEmpresa(empresa);
    setFormData({
      nome: empresa.nome || '',
      nif: empresa.nif || '',
      endereco: empresa.endereco || '',
      telefone: empresa.telefone || '',
      email: empresa.email || '',
      website: empresa.website || '',
      observacoes: empresa.observacoes || '',
      status: empresa.status || 'ativa',
      logo_url: empresa.logo_url || '',
    });
    setIsModalOpen(true);
  };

  const handleOpenDetail = (empresa) => {
    setSelectedEmpresa(empresa);
    setIsDetailOpen(true);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      const uploadedUrl = result?.url || result?.file_url;
      if (uploadedUrl) {
        setFormData(prev => ({ ...prev, logo_url: uploadedUrl }));
      }
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) return;

    setIsSaving(true);
    try {
      if (editingEmpresa) {
        await Empresa.update(editingEmpresa.id, formData);
      } else {
        await Empresa.create(formData);
      }
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (empresa) => {
    const aeroportosAssociados = getAeroportosDaEmpresa(empresa.id);
    const usersAssociados = getUsersDaEmpresa(empresa.id);

    if (aeroportosAssociados.length > 0 || usersAssociados.length > 0) {
      alert(`Não é possível eliminar "${empresa.nome}" porque tem ${aeroportosAssociados.length} aeroporto(s) e ${usersAssociados.length} utilizador(es) associados.`);
      return;
    }

    if (!confirm(`Tem a certeza que deseja eliminar a empresa "${empresa.nome}"?`)) return;

    try {
      await Empresa.delete(empresa.id);
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    } catch (error) {
      console.error('Erro ao eliminar empresa:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            {t('page.gestao_empresas.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('page.gestao_empresas.subtitle')}</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          {t('btn.new_empresa')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-3">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{empresas.length}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('empresas.empresas')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 dark:bg-green-900 rounded-full p-3">
                <MapPin className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aeroportos.length}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('empresas.aeroportos')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 dark:bg-purple-900 rounded-full p-3">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('empresas.utilizadores')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
        <Input
          placeholder={t('empresas.pesquisar')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t('empresas.logo')}</TableHead>
                <TableHead>{t('empresas.nome')}</TableHead>
                <TableHead>{t('empresas.nif')}</TableHead>
                <TableHead>{t('empresas.contacto')}</TableHead>
                <TableHead className="text-center">{t('empresas.aeroportos')}</TableHead>
                <TableHead className="text-center">{t('empresas.utilizadores')}</TableHead>
                <TableHead>{t('empresas.statusCol')}</TableHead>
                <TableHead className="text-right">{t('empresas.acoesCol')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmpresas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">
                    {t('empresas.nenhumaEmpresa')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmpresas.map(empresa => {
                  const numAeroportos = getAeroportosDaEmpresa(empresa.id).length;
                  const numUsers = getUsersDaEmpresa(empresa.id).length;
                  const statusConfig = STATUS_OPTIONS.find(s => s.value === empresa.status) || STATUS_OPTIONS[0];

                  return (
                    <TableRow key={empresa.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => handleOpenDetail(empresa)}>
                      <TableCell>
                        {empresa.logo_url ? (
                          <img src={empresa.logo_url} alt={empresa.nome} className="h-8 w-auto max-w-[60px] object-contain" />
                        ) : (
                          <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{empresa.nome}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">{empresa.nif || '—'}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                        {empresa.email || empresa.telefone || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                          <MapPin className="w-3 h-3 mr-1" />
                          {numAeroportos}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">
                          <Users className="w-3 h-3 mr-1" />
                          {numUsers}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDetail(empresa)} title={t('empresas.verDetalhes')}>
                            <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(empresa)} title={t('empresas.editar')}>
                            <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(empresa)} title={t('empresas.eliminar')}>
                            <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {editingEmpresa ? t('empresas.editarEmpresa') : t('empresas.novaEmpresa')}
            </DialogTitle>
            <DialogDescription>
              {editingEmpresa ? t('empresas.editarDesc') : t('empresas.novaDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            {/* Logo Upload */}
            <div>
              <Label>{t('empresas.logoEmpresa')}</Label>
              <div className="flex items-center gap-4 mt-2">
                {formData.logo_url ? (
                  <img src={formData.logo_url} alt="Logo" className="h-12 w-auto max-w-[120px] object-contain border rounded p-1" />
                ) : (
                  <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center border dark:border-slate-700">
                    <Building2 className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <span className="inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Upload className="w-4 h-4" />
                      {isUploading ? t('empresas.carregando') : t('empresas.upload')}
                    </span>
                  </label>
                  {formData.logo_url && (
                    <Button variant="ghost" size="sm" onClick={() => handleChange('logo_url', '')}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('empresas.logoFallback')}
              </p>
            </div>

            <div>
              <Label htmlFor="nome">{t('empresas.nomeEmpresa')}</Label>
              <Input id="nome" value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} placeholder="Ex: SGA, SA" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nif">{t('empresas.nif')}</Label>
                <Input id="nif" value={formData.nif} onChange={(e) => handleChange('nif', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="status">{t('empresas.statusCol')}</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="endereco">{t('empresas.endereco')}</Label>
              <Input id="endereco" value={formData.endereco} onChange={(e) => handleChange('endereco', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telefone">{t('empresas.telefone')}</Label>
                <Input id="telefone" value={formData.telefone} onChange={(e) => handleChange('telefone', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">{t('empresas.email')}</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
              </div>
            </div>

            <div>
              <Label htmlFor="website">{t('empresas.website')}</Label>
              <Input id="website" value={formData.website} onChange={(e) => handleChange('website', e.target.value)} placeholder="https://..." />
            </div>

            <div>
              <Label htmlFor="observacoes">{t('empresas.observacoes')}</Label>
              <textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                className="w-full min-h-[80px] px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              <X className="w-4 h-4 mr-1" />
              {t('empresas.cancelar')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.nome.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? t('empresas.aSalvar') : t('empresas.salvar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedEmpresa?.logo_url ? (
                <img src={selectedEmpresa.logo_url} alt="" className="h-8 w-auto max-w-[80px] object-contain" />
              ) : (
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              )}
              {selectedEmpresa?.nome}
            </DialogTitle>
            <DialogDescription>{t('empresas.detalhes')}</DialogDescription>
          </DialogHeader>

          {selectedEmpresa && (
            <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">NIF:</span>
                  <span className="ml-2 font-medium">{selectedEmpresa.nif || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Status:</span>
                  <Badge className={`ml-2 ${STATUS_OPTIONS.find(s => s.value === selectedEmpresa.status)?.className || ''}`}>
                    {selectedEmpresa.status || 'ativa'}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Telefone:</span>
                  <span className="ml-2">{selectedEmpresa.telefone || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Email:</span>
                  <span className="ml-2">{selectedEmpresa.email || '—'}</span>
                </div>
                {selectedEmpresa.endereco && (
                  <div className="col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">Endereço:</span>
                    <span className="ml-2">{selectedEmpresa.endereco}</span>
                  </div>
                )}
                {selectedEmpresa.website && (
                  <div className="col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">Website:</span>
                    <a href={selectedEmpresa.website} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 dark:text-blue-400 hover:underline">{selectedEmpresa.website}</a>
                  </div>
                )}
              </div>

              {/* Aeroportos */}
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                  {t('empresas.aeroportos')} ({getAeroportosDaEmpresa(selectedEmpresa.id).length})
                </h3>
                <div className="space-y-2">
                  {getAeroportosDaEmpresa(selectedEmpresa.id).length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">{t('empresas.nenhumAeroporto')}</p>
                  ) : (
                    getAeroportosDaEmpresa(selectedEmpresa.id).map(aeroporto => (
                      <div key={aeroporto.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded">
                        <div>
                          <span className="font-medium text-sm">{aeroporto.nome}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{aeroporto.codigo_icao}</Badge>
                        </div>
                        <Badge className={aeroporto.status === 'operacional' ? 'bg-green-100 text-green-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}>
                          {aeroporto.status || 'operacional'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Utilizadores */}
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  {t('empresas.utilizadores')} ({getUsersDaEmpresa(selectedEmpresa.id).length})
                </h3>
                <div className="space-y-2">
                  {getUsersDaEmpresa(selectedEmpresa.id).length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">{t('empresas.nenhumUtilizador')}</p>
                  ) : (
                    getUsersDaEmpresa(selectedEmpresa.id).map(u => (
                      <div key={u.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded">
                        <div>
                          <span className="font-medium text-sm">{u.full_name || u.email}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{u.email}</span>
                        </div>
                        <div className="flex gap-1">
                          {(u.perfis || []).map(p => (
                            <Badge key={p} variant="outline" className="text-xs capitalize">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedEmpresa.observacoes && (
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('empresas.observacoes')}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{selectedEmpresa.observacoes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>{t('empresas.fechar')}</Button>
            <Button onClick={() => { setIsDetailOpen(false); handleOpenEdit(selectedEmpresa); }} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Edit className="w-4 h-4 mr-1" />
              {t('empresas.editar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
