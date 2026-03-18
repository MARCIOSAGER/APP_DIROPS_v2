import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, FileText, Users, LogOut, RefreshCw, Plus } from 'lucide-react';
import { User as UserEntity } from '@/entities/User';
import { Credenciamento } from '@/entities/Credenciamento';
import { Empresa } from '@/entities/Empresa';
import { Aeroporto } from '@/entities/Aeroporto';
import { getEmpresaLogoByUser } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';

const STATUS_CONFIG_BASE = {
  pendente: { color: 'bg-yellow-100 text-yellow-800', labelKey: 'portal.statusPendente' },
  em_verificacao: { color: 'bg-blue-100 text-blue-800', labelKey: 'portal.statusEmVerificacao' },
  aguardando_aprovacao_diretor: { color: 'bg-purple-100 text-purple-800', labelKey: 'portal.statusAguardandoAprovacao' },
  aprovado: { color: 'bg-green-100 text-green-800', labelKey: 'portal.statusAprovado' },
  aguardando_pagamento: { color: 'bg-orange-100 text-orange-800', labelKey: 'portal.statusAguardandoPagamento' },
  pagamento_confirmado: { color: 'bg-cyan-100 text-cyan-800', labelKey: 'portal.statusPagamentoConfirmado' },
  rejeitado: { color: 'bg-red-100 text-red-800', labelKey: 'portal.statusRejeitado' },
  credenciado: { color: 'bg-emerald-100 text-emerald-800', labelKey: 'portal.statusCredenciado' },
  expirado: { color: 'bg-gray-100 text-gray-800', labelKey: 'portal.statusExpirado' },
  inativo: { color: 'bg-slate-100 text-slate-800', labelKey: 'portal.statusInativo' }
};

export default function PortalEmpresa() {
  const { t } = useI18n();
  const STATUS_CONFIG = Object.fromEntries(
    Object.entries(STATUS_CONFIG_BASE).map(([k, v]) => [k, { ...v, label: t(v.labelKey) }])
  );
  const [user, setUser] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [credenciamentos, setCredenciamentos] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Carregar dados do utilizador atual
      const currentUser = await UserEntity.me();
      setUser(currentUser);

      if (currentUser.empresa_id) {
        // Carregar dados da empresa
        const empresaData = await Empresa.list();
        setEmpresas(empresaData || []);
        const userEmpresa = empresaData.find(e => e.id === currentUser.empresa_id);
        setEmpresa(userEmpresa);

        // Carregar credenciamentos da empresa
        const credenciamentosData = await Credenciamento.filter({ 
          empresa_solicitante_id: currentUser.empresa_id 
        }, '-data_solicitacao');
        setCredenciamentos(credenciamentosData);
      }

      // Carregar aeroportos
      const aeroportosData = await Aeroporto.list();
      setAeroportos(aeroportosData.filter(a => a.pais === 'AO'));

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await UserEntity.logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Erro durante logout:', error);
      window.location.href = '/';
    }
  };

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos.find(a => a.codigo_icao === aeroportoId);
    return aeroporto?.nome || aeroportoId;
  };

  const stats = React.useMemo(() => {
    return {
      total: credenciamentos.length,
      pendentes: credenciamentos.filter(c => c.status === 'pendente').length,
      aprovados: credenciamentos.filter(c => c.status === 'aprovado' || c.status === 'credenciado').length,
      rejeitados: credenciamentos.filter(c => c.status === 'rejeitado').length
    };
  }, [credenciamentos]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">{t('portal.carregando')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 shadow-sm border-b dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img
                src={getEmpresaLogoByUser(user, empresas)}
                alt="DIROPS Logo"
                className="h-8 mr-4"
              />
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('portal.titulo')}</h1>
                {empresa && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{empresa.nome}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.full_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                {t('portal.sair')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('portal.total')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <FileText className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('portal.pendentes')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.pendentes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('portal.aprovados')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.aprovados}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-red-100">
                  <UserCheck className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('portal.rejeitados')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.rejeitados}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {t('portal.acoesRapidas')}
              </CardTitle>
              <CardDescription>
                {t('portal.acoesDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => window.location.href = '/CredenciamentoPublico'}
                  className="h-16 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <div className="text-center">
                    <UserCheck className="w-6 h-6 mx-auto mb-1" />
                    <span>{t('portal.novaSolicitacao')}</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={loadData}
                  className="h-16"
                >
                  <div className="text-center">
                    <RefreshCw className="w-6 h-6 mx-auto mb-1" />
                    <span>{t('portal.atualizarLista')}</span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Credenciamentos List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('portal.credenciamentosEmpresa')}
            </CardTitle>
            <CardDescription>
              {t('portal.credenciamentosDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {credenciamentos.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">{t('portal.semCredenciais')}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">{t('portal.semCredenciaisDesc')}</p>
                <Button
                  onClick={() => window.location.href = '/CredenciamentoPublico'}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('portal.criarPrimeiraSolicitacao')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {credenciamentos.map((credenciamento) => (
                  <div key={credenciamento.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-bold text-blue-600">
                            {credenciamento.protocolo_numero}
                          </span>
                          <Badge className={STATUS_CONFIG[credenciamento.status]?.color}>
                            {STATUS_CONFIG[credenciamento.status]?.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {credenciamento.tipo_credencial === 'pessoa' ? t('portal.tipoPessoa') : t('portal.tipoViatura')}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">{t('portal.nomeMatricula')}:</span>
                            <p className="font-medium">{credenciamento.nome_completo || credenciamento.matricula_viatura}</p>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">{t('portal.aeroporto')}:</span>
                            <p className="font-medium">{getAeroportoNome(credenciamento.aeroporto_id)}</p>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">{t('portal.data')}:</span>
                            <p className="font-medium">
                              {new Date(credenciamento.data_solicitacao).toLocaleDateString('pt-AO')}
                            </p>
                          </div>
                        </div>
                        
                        {credenciamento.justificativa_acesso && (
                          <div className="mt-3 text-sm">
                            <span className="text-slate-600 dark:text-slate-400">{t('portal.justificativa')}:</span>
                            <p className="text-slate-700 dark:text-slate-300">{credenciamento.justificativa_acesso}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}