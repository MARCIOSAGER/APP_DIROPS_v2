import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users,
  Search,
  Edit,
  UserPlus,
  Download,
  Trash2,
  Filter,
  X,
  Check,
  ChevronsUpDown,
  Send,
  Loader2,
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from '@/components/lib/i18n';

const STATUS_CONFIG = {
  'pendente': { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pendente' },
  'aprovado': { className: 'bg-green-100 text-green-800 border-green-200', label: 'Aprovado' },
  'aguardando_convite': { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Aguardando Convite' },
  'rejeitado': { className: 'bg-red-100 text-red-800 border-red-200', label: 'Rejeitado' },
  'ativo': { className: 'bg-green-100 text-green-800 border-green-200', label: 'Ativo' },
  'inativo': { className: 'bg-red-100 text-red-800 border-red-200', label: 'Inativo' },
  'desconhecido': { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Desconhecido' }
};

const PERFIL_LABELS = {
  administrador: 'Administrador',
  operacoes: 'Operações',
  safety: 'Safety',
  infraestrutura: 'Infraestrutura',
  credenciamento: 'Credenciamento',
  gestor_empresa: 'Gestor de Empresa',
  visualizador: 'Visualizador'
};

export default function UtilizadoresTab({
  users,
  aeroportos,
  empresas,
  currentUser,
  isLoading,
  sendingInvite,
  sendingBatch,
  getAeroportoNome,
  getEmpresaNome,
  onEditUser,
  onExcluirUser,
  onEnviarConvite,
  onEnviarConvitesBatch,
  onExportCSV,
  onAddUser,
}) {
  const { t } = useI18n();

  const [searchTerm, setSearchTerm] = useState('');
  const [filtros, setFiltros] = useState({
    status: 'todos',
    perfil: 'todos',
    aeroporto: 'todos',
    empresa: 'todos'
  });
  const [openPopovers, setOpenPopovers] = useState({
    status: false,
    perfil: false,
    aeroporto: false,
    empresa: false
  });

  const handleFilterChange = useCallback((field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
    setOpenPopovers(prev => ({ ...prev, [field]: false }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltros({
      status: 'todos',
      perfil: 'todos',
      aeroporto: 'todos',
      empresa: 'todos'
    });
    setSearchTerm('');
  }, []);

  const filteredUsers = useMemo(() => {
    const noFiltersActive = !searchTerm &&
      filtros.status === 'todos' &&
      filtros.perfil === 'todos' &&
      filtros.aeroporto === 'todos' &&
      filtros.empresa === 'todos';

    if (noFiltersActive) {
      return users;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    return users.filter(user => {
      let perfisText = '';
      if (user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0) {
        perfisText = user.perfis.map(p => PERFIL_LABELS[p] || p).join(' ');
      } else if (user.perfil) {
        perfisText = PERFIL_LABELS[user.perfil] || user.perfil;
      }

      const textMatch = !searchTerm ||
        (user.full_name || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (user.email || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (user.telefone || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        perfisText.toLowerCase().includes(lowerCaseSearchTerm) ||
        (getEmpresaNome(user.empresa_id) || '').toLowerCase().includes(lowerCaseSearchTerm);

      let statusMatch = filtros.status === 'todos';
      if (!statusMatch) {
        const userStatus = user.status || 'desconhecido';
        statusMatch = userStatus === filtros.status;
      }

      let perfilMatch = filtros.perfil === 'todos';
      if (!perfilMatch) {
        if (user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0) {
          perfilMatch = user.perfis.includes(filtros.perfil);
        } else if (user.perfil) {
          perfilMatch = user.perfil === filtros.perfil;
        }
      }

      const aeroportoMatch = filtros.aeroporto === 'todos' ||
        (user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso) &&
          user.aeroportos_acesso.includes(filtros.aeroporto));

      const empresaMatch = filtros.empresa === 'todos' || user.empresa_id === filtros.empresa;

      return textMatch && statusMatch && perfilMatch && aeroportoMatch && empresaMatch;
    });
  }, [users, searchTerm, filtros, getEmpresaNome]);

  const statusOptions = useMemo(() => [
    { value: 'todos', label: 'Todos os Status' },
    { value: 'ativo', label: 'Ativo' },
    { value: 'inativo', label: 'Inativo' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'desconhecido', label: 'Desconhecido' }
  ], []);

  const perfilOptions = useMemo(() => [
    { value: 'todos', label: 'Todos os Perfis' },
    { value: 'administrador', label: 'Administrador' },
    { value: 'operacoes', label: 'Operações' },
    { value: 'infraestrutura', label: 'Infraestrutura' },
    { value: 'credenciamento', label: 'Credenciamento' },
    { value: 'gestor_empresa', label: 'Gestor de Empresa' },
    { value: 'visualizador', label: 'Visualizador' }
  ], []);

  const aeroportoOptions = useMemo(() => [
    { value: 'todos', label: 'Todos os Aeroportos' },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))
  ], [aeroportos]);

  const empresaOptions = useMemo(() => [
    { value: 'todos', label: 'Todas as Empresas' },
    ...empresas.map(e => ({ value: e.id, label: e.nome }))
  ], [empresas]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filtros.status !== 'todos') count++;
    if (filtros.perfil !== 'todos') count++;
    if (filtros.aeroporto !== 'todos') count++;
    if (filtros.empresa !== 'todos') count++;
    if (searchTerm) count++;
    return count;
  }, [filtros, searchTerm]);

  const handleExportCSV = useCallback(() => {
    onExportCSV(filteredUsers);
  }, [onExportCSV, filteredUsers]);

  const importedCount = useMemo(() => {
    return filteredUsers.filter(u => u.created_by === 'importacao_base44').length;
  }, [filteredUsers]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t('acessos.gerirUtilizadores')}</CardTitle>
            <CardDescription>{t('acessos.gerirUtilizadoresDesc')}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onEnviarConvitesBatch(filteredUsers)}
              disabled={sendingBatch || importedCount === 0}
              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              {sendingBatch ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Convites ({importedCount})
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={filteredUsers.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              {t('acessos.exportarCSV')}
            </Button>
            <Button
              onClick={onAddUser}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {t('acessos.adicionarUtilizador')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Seção de Filtros Avançados */}
        <Card className="mb-6 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                {t('acessos.filtrosPesquisa')}
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount} {activeFiltersCount === 1 ? t('acessos.filtroAtivo') : t('acessos.filtrosAtivos')}
                  </Badge>
                )}
              </CardTitle>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  <X className="w-4 h-4 mr-1" />
                  {t('acessos.limparFiltros')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Busca por Texto */}
              <div className="lg:col-span-2">
                <Label htmlFor="search">{t('acessos.pesquisar')}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="search"
                    placeholder={t('acessos.placeholderPesquisa')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filtro de Status com Busca */}
              <div>
                <Label htmlFor="filter-status">{t('acessos.status')}</Label>
                <Popover open={openPopovers.status} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, status: open }))}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openPopovers.status}
                      className="w-full justify-between text-left font-normal"
                    >
                      {statusOptions.find(opt => opt.value === filtros.status)?.label || t('acessos.selecionarStatus')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder={t('acessos.procurarStatus')} />
                      <CommandEmpty>{t('acessos.nenhumStatus')}</CommandEmpty>
                      <CommandGroup>
                        {statusOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => handleFilterChange('status', option.value)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                filtros.status === option.value ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Filtro de Perfil com Busca */}
              <div>
                <Label htmlFor="filter-perfil">{t('acessos.perfil')}</Label>
                <Popover open={openPopovers.perfil} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, perfil: open }))}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openPopovers.perfil}
                      className="w-full justify-between text-left font-normal"
                    >
                      {perfilOptions.find(opt => opt.value === filtros.perfil)?.label || t('acessos.selecionarPerfil')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder={t('acessos.procurarPerfil')} />
                      <CommandEmpty>{t('acessos.nenhumPerfil')}</CommandEmpty>
                      <CommandGroup>
                        {perfilOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => handleFilterChange('perfil', option.value)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                filtros.perfil === option.value ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Filtro de Aeroporto com Busca */}
              <div>
                <Label htmlFor="filter-aeroporto">{t('acessos.aeroporto')}</Label>
                <Popover open={openPopovers.aeroporto} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, aeroporto: open }))}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openPopovers.aeroporto}
                      className="w-full justify-between text-left font-normal"
                    >
                      {aeroportoOptions.find(opt => opt.value === filtros.aeroporto)?.label || t('acessos.selecionarAeroporto')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder={t('acessos.procurarAeroporto')} />
                      <CommandEmpty>{t('acessos.nenhumAeroporto')}</CommandEmpty>
                      <CommandGroup>
                        {aeroportoOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => handleFilterChange('aeroporto', option.value)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                filtros.aeroporto === option.value ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Filtro de Empresa com Busca */}
              <div className="lg:col-span-2">
                <Label htmlFor="filter-empresa">{t('acessos.empresa')}</Label>
                <Popover open={openPopovers.empresa} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, empresa: open }))}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openPopovers.empresa}
                      className="w-full justify-between text-left font-normal"
                    >
                      {empresaOptions.find(opt => opt.value === filtros.empresa)?.label || t('acessos.selecionarEmpresa')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder={t('acessos.procurarEmpresa')} />
                      <CommandEmpty>{t('acessos.nenhumaEmpresa')}</CommandEmpty>
                      <CommandGroup>
                        {empresaOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => handleFilterChange('empresa', option.value)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                filtros.empresa === option.value ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Resultado da Filtragem */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold">{filteredUsers.length}</span> {filteredUsers.length === 1 ? t('acessos.utilizadorEncontrado') : t('acessos.utilizadoresEncontrados')}
                {activeFiltersCount > 0 && <span> {t('acessos.comFiltros')}</span>}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('acessos.utilizador')}</TableHead>
                <TableHead>{t('acessos.telefone')}</TableHead>
                <TableHead>{t('acessos.perfis')}</TableHead>
                <TableHead>{t('acessos.empresa')}</TableHead>
                <TableHead>{t('acessos.status')}</TableHead>
                <TableHead>{t('acessos.aeroportosAcesso')}</TableHead>
                <TableHead className="text-right">{t('acessos.acoes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400 py-8">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="font-medium">{t('acessos.nenhumUtilizador')}</p>
                    <p className="text-sm mt-1">
                      {activeFiltersCount > 0
                        ? t('acessos.ajustarFiltros')
                        : t('acessos.semUtilizadores')}
                    </p>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.telefone || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0 ? (
                        user.perfis.map((perfil, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {PERFIL_LABELS[perfil] || perfil}
                          </Badge>
                        ))
                      ) : user.perfil ? (
                        <Badge variant="outline" className="text-xs">
                          {PERFIL_LABELS[user.perfil] || user.perfil}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {PERFIL_LABELS['visualizador']}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getEmpresaNome(user.empresa_id)}
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      STATUS_CONFIG[user.status || 'desconhecido']?.className || STATUS_CONFIG['desconhecido'].className
                    }>
                      {STATUS_CONFIG[user.status || 'desconhecido']?.label || 'Desconhecido'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso) && user.aeroportos_acesso.length > 0
                        ? [...new Set(user.aeroportos_acesso)].map(icao => getAeroportoNome(icao)).filter(Boolean).join(', ')
                        : 'Nenhum'
                      }
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEnviarConvite(user)}
                        disabled={sendingInvite === user.email}
                        className="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        title="Enviar email de definição de senha"
                      >
                        {sendingInvite === user.email ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                        Convite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditUser(user)}
                        className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        {t('acessos.editar')}
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onExcluirUser(user)}
                          className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {t('acessos.excluir')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
