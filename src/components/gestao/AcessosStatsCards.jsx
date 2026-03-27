import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  UserCheck,
  Mail,
  Globe,
  Activity,
  Shield,
  CheckCircle,
} from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

const PERFIL_LABELS = {
  administrador: 'Administrador',
  operacoes: 'Operações',
  safety: 'Safety',
  infraestrutura: 'Infraestrutura',
  credenciamento: 'Credenciamento',
  gestor_empresa: 'Gestor de Empresa',
  visualizador: 'Visualizador'
};

export default function AcessosStatsCards({ stats }) {
  const { t } = useI18n();

  return (
    <>
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('acessos.totalUtilizadores')}</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.totalUsers}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stats.activeUsers} {t('acessos.ativos')} · {stats.inactiveUsers} {t('acessos.inativos')}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('acessos.utilizadoresAtivos')}</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.activeUsers}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% {t('acessos.doTotal')}
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <UserCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('acessos.solicitacoesPendentes')}</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.solicitacoesPendentes}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stats.novasSolicitacoesMes} {t('acessos.novosEsteMes')}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <Mail className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('acessos.taxaAprovacao')}</p>
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {(stats.solicitacoesAprovadas + stats.solicitacoesRejeitadas) > 0
                    ? Math.round((stats.solicitacoesAprovadas / (stats.solicitacoesAprovadas + stats.solicitacoesRejeitadas)) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stats.solicitacoesAprovadas} {t('acessos.aprovadas')} · {stats.solicitacoesRejeitadas} {t('acessos.rejeitadas')}
                </p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                <CheckCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribuição por Perfil */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              {t('acessos.distribuicaoPerfil')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.totalUsers > 0 && Object.entries(stats.perfilDistribution).length > 0 ? (
                Object.entries(stats.perfilDistribution).sort(([, countA], [, countB]) => countB - countA).map(([perfil, count]) => (
                  <div key={perfil} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                      {PERFIL_LABELS[perfil] || perfil}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t('acessos.nenhumDado')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Aeroporto */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              {t('acessos.distribuicaoAeroporto')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {stats.totalUsers > 0 && Object.entries(stats.aeroportoDistribution).length > 0 ? (
                Object.entries(stats.aeroportoDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([aeroporto, count]) => (
                    <div key={aeroporto} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{aeroporto}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t('acessos.nenhumDado')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Empresa */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              {t('acessos.topEmpresas')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {stats.totalUsers > 0 && Object.entries(stats.empresaDistribution).length > 0 ? (
                Object.entries(stats.empresaDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([empresa, count]) => (
                    <div key={empresa} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={empresa}>
                        {empresa}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t('acessos.nenhumDado')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
