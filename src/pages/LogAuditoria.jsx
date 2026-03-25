import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw,
  Filter,
  AlertTriangle,
  Shield,
  Eye,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LogAuditoria } from '@/entities/LogAuditoria';
import { hasUserProfile, isAdminProfile } from '@/components/lib/userUtils'; // Importar a função de utilitário
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

const ACTION_COLORS = {
  criar: 'bg-green-100 text-green-800',
  editar: 'bg-blue-100 text-blue-800',
  excluir: 'bg-red-100 text-red-800',
  visualizar: 'bg-gray-100 text-gray-800',
  exportar: 'bg-purple-100 text-purple-800',
  login: 'bg-emerald-100 text-emerald-800',
  logout: 'bg-orange-100 text-orange-800'
};

const MODULE_COLORS = {
  financeiro: 'bg-green-50 text-green-700',
  operacoes: 'bg-blue-50 text-blue-700',
  safety: 'bg-red-50 text-red-700',
  inspecoes: 'bg-purple-50 text-purple-700',
  manutencao: 'bg-orange-50 text-orange-700',
  documentos: 'bg-cyan-50 text-cyan-700',
  gestao: 'bg-indigo-50 text-indigo-700',
  grf: 'bg-teal-50 text-teal-700'
};

export default function LogAuditoriaPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    search: '',
    acao: '',
    modulo: '',
    usuario: '',
    dataInicio: '',
    dataFim: ''
  });

  useEffect(() => {
    checkAccessAndLoadData();
  }, []);

  const checkAccessAndLoadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Verificar se tem permissões para ver logs de auditoria
      // USAR A FUNÇÃO SEGURA hasUserProfile
      const canAccessAuditLogs = isAdminProfile(user);

      if (!canAccessAuditLogs) {
        setHasAccess(false);
        setError({
          type: 'permission',
          message: t('logAuditoria.semAcesso'),
          details: t('logAuditoria.semAcessoDesc')
        });
        return;
      }

      setHasAccess(true);
      await loadAuditLogs();

    } catch (error) {
      console.error('Erro ao verificar acesso:', error);

      if (error.message && error.message.includes('You must be logged in')) {
        setError({
          type: 'auth',
          message: t('logAuditoria.sessaoExpirada'),
          details: t('logAuditoria.sessaoExpiradaDesc')
        });
      } else if (error.response?.status === 403) {
        setError({
          type: 'permission',
          message: t('logAuditoria.semAcesso'),
          details: t('logAuditoria.semAcessoAdminDesc')
        });
      } else {
        setError({
          type: 'network',
          message: t('logAuditoria.erroCarregar'),
          details: t('logAuditoria.erroCarregarDesc')
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      // Carregar apenas os logs mais recentes para evitar sobrecarga
      const logsData = await LogAuditoria.list('-created_date', 200);
      setLogs(logsData || []);
      setFilteredLogs(logsData || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      throw error;
    }
  };

  const handleFilterChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const applyFilters = (currentFilters) => {
    let filtered = [...logs];

    if (currentFilters.search) {
      const searchLower = currentFilters.search.toLowerCase();
      filtered = filtered.filter(log =>
        log.usuario_email?.toLowerCase().includes(searchLower) ||
        log.usuario_nome?.toLowerCase().includes(searchLower) ||
        log.entidade?.toLowerCase().includes(searchLower) ||
        log.detalhes?.toLowerCase().includes(searchLower)
      );
    }

    if (currentFilters.acao) {
      filtered = filtered.filter(log => log.acao === currentFilters.acao);
    }

    if (currentFilters.modulo) {
      filtered = filtered.filter(log => log.modulo === currentFilters.modulo);
    }

    if (currentFilters.usuario) {
      const userLower = currentFilters.usuario.toLowerCase();
      filtered = filtered.filter(log =>
        log.usuario_email?.toLowerCase().includes(userLower) ||
        log.usuario_nome?.toLowerCase().includes(userLower)
      );
    }

    if (currentFilters.dataInicio) {
      filtered = filtered.filter(log =>
        new Date(log.created_date) >= new Date(currentFilters.dataInicio)
      );
    }

    if (currentFilters.dataFim) {
      const endDate = new Date(currentFilters.dataFim);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log =>
        new Date(log.created_date) <= endDate
      );
    }

    setFilteredLogs(filtered);
  };

  const clearFilters = () => {
    const emptyFilters = {
      search: '',
      acao: '',
      modulo: '',
      usuario: '',
      dataInicio: '',
      dataFim: ''
    };
    setFilters(emptyFilters);
    setFilteredLogs(logs);
  };

  const handleRetryLogin = () => {
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">{t('logAuditoria.carregando')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <Alert variant={error.type === 'permission' ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <strong>{error.message}</strong>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {error.details}
              </p>
              {error.type === 'auth' && (
                <Button onClick={handleRetryLogin} className="mt-3">
                  {t('logAuditoria.fazerLogin')}
                </Button>
              )}
              {(error.type === 'network' || error.type === 'permission') && (
                <Button onClick={checkAccessAndLoadData} variant="outline" className="mt-3">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('logAuditoria.tentarNovamente')}
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div>
              <strong>{t('logAuditoria.acessoRestrito')}</strong>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t('logAuditoria.acessoRestritoDesc')}
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {t('logAuditoria.titulo')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('logAuditoria.historicoCompleto')}
          </p>
        </div>
        <Button onClick={checkAccessAndLoadData} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('logAuditoria.atualizar')}
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {t('logAuditoria.filtros')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label>{t('logAuditoria.pesquisar')}</Label>
              <Input
                placeholder={t('logAuditoria.pesquisarPlaceholder')}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('logAuditoria.filtroAcao')}</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100"
                value={filters.acao}
                onChange={(e) => handleFilterChange('acao', e.target.value)}
              >
                <option value="">{t('logAuditoria.todasAcoes')}</option>
                <option value="criar">{t('logAuditoria.opcaoCriar')}</option>
                <option value="editar">{t('logAuditoria.opcaoEditar')}</option>
                <option value="excluir">{t('logAuditoria.opcaoExcluir')}</option>
                <option value="visualizar">{t('logAuditoria.opcaoVisualizar')}</option>
                <option value="exportar">{t('logAuditoria.opcaoExportar')}</option>
                <option value="login">{t('logAuditoria.opcaoLogin')}</option>
                <option value="logout">{t('logAuditoria.opcaoLogout')}</option>
              </select>
            </div>
            <div>
              <Label>{t('logAuditoria.filtroModulo')}</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100"
                value={filters.modulo}
                onChange={(e) => handleFilterChange('modulo', e.target.value)}
              >
                <option value="">{t('logAuditoria.todosModulos')}</option>
                <option value="financeiro">{t('logAuditoria.moduloFinanceiro')}</option>
                <option value="operacoes">{t('logAuditoria.moduloOperacoes')}</option>
                <option value="safety">{t('logAuditoria.moduloSafety')}</option>
                <option value="inspecoes">{t('logAuditoria.moduloInspecoes')}</option>
                <option value="manutencao">{t('logAuditoria.moduloManutencao')}</option>
                <option value="documentos">{t('logAuditoria.moduloDocumentos')}</option>
                <option value="gestao">{t('logAuditoria.moduloGestao')}</option>
                <option value="grf">{t('logAuditoria.moduloGRF')}</option>
              </select>
            </div>
            <div>
              <Label>{t('logAuditoria.filtroUtilizador')}</Label>
              <Input
                placeholder={t('logAuditoria.utilizadorPlaceholder')}
                value={filters.usuario}
                onChange={(e) => handleFilterChange('usuario', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('logAuditoria.dataInicio')}</Label>
              <Input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('logAuditoria.dataFim')}</Label>
              <Input
                type="date"
                value={filters.dataFim}
                onChange={(e) => handleFilterChange('dataFim', e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={clearFilters}>
              {t('logAuditoria.limparFiltros')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Logs */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('logAuditoria.logsAuditoria')} ({filteredLogs.length} {t('logAuditoria.registos')})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{t('logAuditoria.nenhum')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">{t('logAuditoria.colData')}</th>
                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">{t('logAuditoria.colAcao')}</th>
                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">{t('logAuditoria.colModulo')}</th>
                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">{t('logAuditoria.colUtilizador')}</th>
                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">{t('logAuditoria.entidade')}</th>
                    <th className="text-center p-3 font-medium text-slate-700 dark:text-slate-300">{t('logAuditoria.colDescricao')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 group">
                      <td className="p-3 text-slate-600 dark:text-slate-400 text-xs">
                        {format(new Date(log.created_date), 'dd/MM HH:mm', { locale: pt })}
                      </td>
                      <td className="p-3">
                        <Badge className={ACTION_COLORS[log.acao] || 'bg-gray-100 text-gray-800'}>
                          {log.acao}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {log.modulo && (
                          <Badge variant="outline" className={MODULE_COLORS[log.modulo] || 'bg-gray-50 text-gray-700'}>
                            {log.modulo}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 text-xs truncate max-w-32">
                        {log.usuario_nome}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 text-xs truncate max-w-32">
                        {log.entidade}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`${createPageUrl('LogAuditoriaDetalhes')}?id=${log.id}`)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        </Card>
        </div>
        );
        }