import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Key, Plus, Copy, CheckCircle, XCircle,
  Shield, Activity, AlertTriangle, RefreshCw, Loader2, Search
} from 'lucide-react';
import { ApiKey } from '@/entities/ApiKey';
import { ApiAccessLog } from '@/entities/ApiAccessLog';
import { isSuperAdmin } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

const AVAILABLE_ENTITIES = [
  { value: 'voo', label: 'Voos' },
  { value: 'ordem_servico', label: 'Ordens de Serviço' },
  { value: 'solicitacao_servico', label: 'Solicitações de Serviço' },
  { value: 'inspecao', label: 'Inspeções' },
  { value: 'proforma', label: 'Proformas' },
  { value: 'proforma_item', label: 'Itens de Proforma' },
  { value: 'ocorrencia_safety', label: 'Ocorrências Safety' },
  { value: 'aeroporto', label: 'Aeroportos' },
  { value: 'medicao_kpi', label: 'Medições KPI' },
  { value: 'movimento_financeiro', label: 'Movimentos Financeiros' },
  { value: 'calculo_tarifa', label: 'Cálculos de Tarifa' },
  { value: 'credenciamento', label: 'Credenciamentos' },
  { value: 'reclamacao', label: 'Reclamações' },
  { value: 'auditoria', label: 'Auditorias' },
  { value: 'cliente', label: 'Clientes' },
  { value: 'servico_aeroportuario', label: 'Serviços Aeroportuários' },
  { value: 'companhia_aerea', label: 'Companhias Aéreas' },
  { value: 'modelo_aeronave', label: 'Modelos de Aeronave' },
  { value: 'registo_aeronave', label: 'Registos de Aeronave' },
  { value: 'tarifa_pouso', label: 'Tarifas de Pouso' },
  { value: 'tarifa_permanencia', label: 'Tarifas de Permanência' },
  { value: 'outra_tarifa', label: 'Outras Tarifas' },
  { value: 'tarifa_recurso', label: 'Tarifas de Recurso' },
  { value: 'tipo_auditoria', label: 'Tipos de Auditoria' },
  { value: 'processo_auditoria', label: 'Processos de Auditoria' },
  { value: 'plano_acao_corretiva', label: 'Planos de Ação Corretiva' },
];

async function generateApiKey() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const rawKey = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  const apiKey = `dk_${rawKey}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  const keyPrefix = apiKey.substring(0, 11);
  return { apiKey, keyHash, keyPrefix };
}

export default function GestaoAPIKeys() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const { user: currentUser } = useAuth();
  const [keys, setKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('keys');

  // Create key modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState({ name: '', scopes: [], rate_limit_per_minute: 60, expires_days: '', allowed_ips: '' });
  const [createdKey, setCreatedKey] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Revoke modal
  const [revokeKey, setRevokeKey] = useState(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Logs filter
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('todos');
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(0);
  const LOG_PAGE_SIZE = 50;

  // Access is controlled by regra_permissao (Layout already checks paginas_permitidas)
  // If the user reached this page, they have permission via GerirPermissoes
  const canAccess = useMemo(() => {
    if (!currentUser?.perfis) return false;
    return true; // Layout already enforces access via regra_permissao
  }, [currentUser]);

  useEffect(() => { loadData(); }, [effectiveEmpresaId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const empId = effectiveEmpresaId || currentUser?.empresa_id;
      const useFilter = !(isSuperAdmin(currentUser) && !effectiveEmpresaId) && empId;

      const logFilters = useFilter ? { empresa_id: { $eq: empId } } : {};
      const [keysData, logsResult] = await Promise.all([
        useFilter
          ? ApiKey.filter({ empresa_id: { $eq: empId } }, '-created_date')
          : ApiKey.list('-created_date'),
        ApiAccessLog.paginate({
          filters: logFilters,
          orderBy: '-created_at',
          page: 1,
          pageSize: LOG_PAGE_SIZE,
        }),
      ]);

      setKeys(keysData);
      setLogs(logsResult.data);
      setLogTotal(logsResult.total);
      setLogTotalPages(logsResult.totalPages);
      setLogPage(logsResult.page);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyData.name.trim()) return;
    setIsCreating(true);
    try {
      const { apiKey, keyHash, keyPrefix } = await generateApiKey();
      const empId = effectiveEmpresaId || currentUser?.empresa_id;

      const keyRecord = {
        empresa_id: empId,
        name: newKeyData.name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: newKeyData.scopes.length > 0 ? newKeyData.scopes : [],
        rate_limit_per_minute: newKeyData.rate_limit_per_minute || 60,
        is_active: true,
        created_by: currentUser?.email,
        allowed_ips: newKeyData.allowed_ips.trim()
          ? newKeyData.allowed_ips.split(',').map(ip => ip.trim()).filter(Boolean)
          : null,
      };

      if (newKeyData.expires_days && parseInt(newKeyData.expires_days) > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(newKeyData.expires_days));
        keyRecord.expires_at = expiresAt.toISOString();
      }

      await ApiKey.create(keyRecord);
      setCreatedKey(apiKey);
      loadData();
    } catch (error) {
      console.error('Erro ao criar API key:', error);
      alert(t('apiKeys.erroCriar'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!revokeKey) return;
    setIsRevoking(true);
    try {
      await ApiKey.update(revokeKey.id, {
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: currentUser?.email,
      });
      setRevokeKey(null);
      loadData();
    } catch (error) {
      console.error('Erro ao revogar key:', error);
      alert(t('apiKeys.erroRevogar'));
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope) => {
    setNewKeyData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (logSearch && !log.endpoint?.toLowerCase().includes(logSearch.toLowerCase()) &&
          !log.ip_address?.includes(logSearch)) return false;
      if (logStatusFilter === 'sucesso' && log.status_code !== 200) return false;
      if (logStatusFilter === 'erro' && log.status_code === 200) return false;
      return true;
    });
  }, [logs, logSearch, logStatusFilter]);

  const handleLogPageChange = async (newPage) => {
    if (newPage < 1 || newPage > logTotalPages) return;
    try {
      const empId = effectiveEmpresaId || currentUser?.empresa_id;
      const useFilter = !(isSuperAdmin(currentUser) && !effectiveEmpresaId) && empId;
      const logFilters = useFilter ? { empresa_id: { $eq: empId } } : {};
      const result = await ApiAccessLog.paginate({
        filters: logFilters,
        orderBy: '-created_at',
        page: newPage,
        pageSize: LOG_PAGE_SIZE,
      });
      setLogs(result.data);
      setLogTotal(result.total);
      setLogTotalPages(result.totalPages);
      setLogPage(result.page);
    } catch (error) {
      console.error('Erro ao carregar página de logs:', error);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    totalKeys: keys.length,
    activeKeys: keys.filter(k => k.is_active && !k.revoked_at).length,
    totalRequests: logTotal,
    successRate: logs.length > 0
      ? Math.round((logs.filter(l => l.status_code === 200).length / logs.length) * 100)
      : 0,
  }), [keys, logs, logTotal]);

  if (!canAccess) {
    return (
      <div className="p-6 text-center">
        <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">{t('apiKeys.acessoRestrito')}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">{t('apiKeys.acessoRestritoDesc')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <Key className="w-8 h-8 text-blue-600" />
              {t('apiKeys.titulo')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{t('apiKeys.subtitulo')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('apiKeys.atualizar')}
            </Button>
            <Button onClick={() => {
              setIsCreateOpen(true);
              setCreatedKey(null);
              setNewKeyData({ name: '', scopes: [], rate_limit_per_minute: 60, expires_days: '', allowed_ips: '' });
            }} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t('apiKeys.novaKey')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{stats.totalKeys}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('apiKeys.totalKeys')}</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-green-600">{stats.activeKeys}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('apiKeys.ativas')}</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-blue-600">{stats.totalRequests}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('apiKeys.requisicoes')}</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.successRate}%</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('apiKeys.taxaSucesso')}</p></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="keys" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {t('apiKeys.logAcessos')}
            </TabsTrigger>
          </TabsList>

          {/* === ABA KEYS === */}
          <TabsContent value="keys" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              </div>
            ) : keys.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Key className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">{t('apiKeys.nenhumaKey')}</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t('apiKeys.nenhumaKeyDesc')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {keys.map(k => {
                  const isActive = k.is_active && !k.revoked_at;
                  const isExpired = k.expires_at && new Date(k.expires_at) < new Date();
                  return (
                    <Card key={k.id} className={`border ${!isActive || isExpired ? 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isActive && !isExpired ? 'bg-green-100' : 'bg-red-100'}`}>
                              <Key className={`w-5 h-5 ${isActive && !isExpired ? 'text-green-600' : 'text-red-600'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{k.name}</span>
                                {isActive && !isExpired ? (
                                  <Badge className="bg-green-100 text-green-700 text-xs">{t('apiKeys.ativa')}</Badge>
                                ) : isExpired ? (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">{t('apiKeys.expirada')}</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700 text-xs">{t('apiKeys.revogada')}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{k.key_prefix}...</span>
                                <span>{t('apiKeys.criada')}: {format(new Date(k.created_date), 'dd/MM/yyyy HH:mm', { locale: pt })}</span>
                                {k.last_used_at && (
                                  <span>{t('apiKeys.ultimoUso')}: {format(new Date(k.last_used_at), 'dd/MM/yyyy HH:mm', { locale: pt })}</span>
                                )}
                                {k.expires_at && (
                                  <span>{t('apiKeys.expira')}: {format(new Date(k.expires_at), 'dd/MM/yyyy', { locale: pt })}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                {(k.scopes || []).length === 0 ? (
                                  <Badge variant="outline" className="text-xs">{t('apiKeys.todasEntidades')}</Badge>
                                ) : (
                                  k.scopes.slice(0, 5).map(s => (
                                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                                  ))
                                )}
                                {(k.scopes || []).length > 5 && (
                                  <Badge variant="outline" className="text-xs">+{k.scopes.length - 5}</Badge>
                                )}
                                <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">{k.rate_limit_per_minute} req/min</span>
                                {k.allowed_ips?.length > 0 && (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">IPs: {k.allowed_ips.join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isActive && !isExpired && (
                            <Button variant="outline" size="sm" onClick={() => setRevokeKey(k)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              <XCircle className="w-4 h-4 mr-1" />
                              {t('apiKeys.revogar')}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Info box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {t('apiKeys.segurancaTitle')}
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>{t('apiKeys.seguranca1')}</li>
                <li>{t('apiKeys.seguranca2')}</li>
                <li>{t('apiKeys.seguranca3')}</li>
                <li>{t('apiKeys.seguranca4')}</li>
                <li>{t('apiKeys.seguranca5')}</li>
              </ul>
            </div>

            {/* Power BI instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('apiKeys.powerBiTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                  <strong>Importante:</strong> O Power BI usa o Power Query (linguagem M) para fazer requisições POST com body JSON. Siga os passos abaixo.
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Passo 1 — Abrir o Editor</p>
                  <p>No Power BI Desktop: <strong>Página Inicial → Obter dados → Consulta em Branco</strong></p>
                  <p className="mt-1">Na barra de ferramentas do Power Query, clique em <strong>Editor Avançado</strong></p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Passo 2 — Colar o código</p>
                  <p className="mb-2">Apague tudo e cole o código abaixo. Substitua <code>dk_SUA_KEY_AQUI</code> pela sua API key.</p>
                  <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre">{`let
    url = "https://glernwcsuwcyzwsnelad.supabase.co/functions/v1/data-api",
    body = Json.FromValue([entity = "voo", limit = 10000]),
    Source = Json.Document(Web.Contents(url, [
        Headers = [
            #"Authorization" = "Bearer dk_SUA_KEY_AQUI",
            #"Content-Type" = "application/json"
        ],
        Content = body
    ])),
    data = Source[data],
    toTable = Table.FromList(data, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    expanded = Table.ExpandRecordColumn(toTable, "Column1", Record.FieldNames(toTable{0}[Column1]))
in
    expanded`}</pre>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Passo 3 — Concluir e Renomear</p>
                  <p>Clique <strong>Concluído</strong>. Os dados aparecerão em tabela.</p>
                  <p className="mt-1">Renomeie a consulta para o nome da entidade (ex: "Voos").</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Passo 4 — Adicionar mais entidades</p>
                  <p>Repita os passos 1-3 mudando o <code>entity</code> no código:</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      ['voo', 'Voos'],
                      ['ordem_servico', 'Ordens de Serviço'],
                      ['solicitacao_servico', 'Solicitações'],
                      ['inspecao', 'Inspeções'],
                      ['proforma', 'Proformas'],
                      ['ocorrencia_safety', 'Ocorrências Safety'],
                      ['aeroporto', 'Aeroportos'],
                      ['movimento_financeiro', 'Mov. Financeiros'],
                    ].map(([entity, label]) => (
                      <div key={entity} className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-mono">
                        <span className="text-blue-600">entity</span> = "{entity}" → <span className="text-slate-700 dark:text-slate-300 font-sans">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Passo 5 — Filtros (opcional)</p>
                  <p>Para filtrar dados, adicione <code>filters</code> ao body:</p>
                  <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto whitespace-pre">{`// Só voos de 2026 em diante
body = Json.FromValue([
    entity = "voo",
    limit = 10000,
    filters = [data_voo = [#"$gte" = "2026-01-01"]]
]),`}</pre>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Entidades disponíveis</p>
                  <p className="mb-2">Use o valor da coluna <code>entity</code> no código M:</p>
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">entity</th>
                          <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['voo', 'Voos'],
                          ['ordem_servico', 'Ordens de Serviço'],
                          ['solicitacao_servico', 'Solicitações de Serviço'],
                          ['inspecao', 'Inspeções'],
                          ['proforma', 'Proformas'],
                          ['proforma_item', 'Itens de Proforma'],
                          ['ocorrencia_safety', 'Ocorrências Safety'],
                          ['aeroporto', 'Aeroportos'],
                          ['medicao_kpi', 'Medições KPI'],
                          ['movimento_financeiro', 'Movimentos Financeiros'],
                          ['calculo_tarifa', 'Cálculos de Tarifa'],
                          ['credenciamento', 'Credenciamentos'],
                          ['reclamacao', 'Reclamações'],
                          ['auditoria', 'Auditorias'],
                          ['cliente', 'Clientes'],
                          ['servico_aeroportuario', 'Serviços Aeroportuários'],
                          ['companhia_aerea', 'Companhias Aéreas'],
                          ['modelo_aeronave', 'Modelos de Aeronave'],
                          ['registo_aeronave', 'Registos de Aeronave'],
                          ['tarifa_pouso', 'Tarifas de Pouso'],
                          ['tarifa_permanencia', 'Tarifas de Permanência'],
                          ['outra_tarifa', 'Outras Tarifas'],
                          ['tarifa_recurso', 'Tarifas de Recurso'],
                          ['tipo_auditoria', 'Tipos de Auditoria'],
                          ['tipo_inspecao', 'Tipos de Inspeção'],
                          ['processo_auditoria', 'Processos de Auditoria'],
                          ['plano_acao_corretiva', 'Planos de Ação Corretiva'],
                          ['item_checklist', 'Itens de Checklist'],
                        ].map(([entity, label]) => (
                          <tr key={entity} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="p-2 font-mono text-blue-600">{entity}</td>
                            <td className="p-2 text-slate-700 dark:text-slate-300">{label}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Passo 6 — Publicar e Agendar Refresh</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Publique no Power BI Service (<strong>Publicar</strong>)</li>
                    <li>No Service: <strong>Configurações do dataset → Credenciais da fonte de dados</strong></li>
                    <li>Tipo de autenticação: <strong>Anónimo</strong> (a key vai no header do código M)</li>
                    <li>Nível de privacidade: <strong>Organizacional</strong></li>
                    <li>Configure <strong>Atualização agendada</strong> (ex: a cada 1 hora)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ABA LOGS === */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder={t('apiKeys.pesquisarPlaceholder')}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {['todos', 'sucesso', 'erro'].map(f => (
                  <Button
                    key={f}
                    variant={logStatusFilter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLogStatusFilter(f)}
                  >
                    {f === 'todos' ? t('apiKeys.todos') : f === 'sucesso' ? t('apiKeys.sucesso') : t('apiKeys.erro')}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">{t('apiKeys.nenhumAcesso')}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                          <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">{t('apiKeys.colDataHora')}</th>
                          <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">{t('apiKeys.colEndpoint')}</th>
                          <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">{t('apiKeys.colStatus')}</th>
                          <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">{t('apiKeys.colLinhas')}</th>
                          <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">{t('apiKeys.colTempo')}</th>
                          <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">{t('apiKeys.colIP')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.map(log => (
                          <tr key={log.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="p-3 text-xs text-slate-500 dark:text-slate-400">
                              {log.created_at ? format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: pt }) : '—'}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs font-mono">{log.endpoint}</Badge>
                            </td>
                            <td className="p-3">
                              {log.status_code === 200 ? (
                                <Badge className="bg-green-100 text-green-700 text-xs">200</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 text-xs">{log.status_code}</Badge>
                              )}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{log.rows_returned ?? '—'}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{log.response_time_ms ? `${log.response_time_ms}ms` : '—'}</td>
                            <td className="p-3 text-xs text-slate-400 dark:text-slate-500 font-mono">{log.ip_address || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {logTotalPages > 1 && (
                    <div className="flex items-center justify-between px-3 py-3 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {t('apiKeys.pagina') || 'Página'} {logPage} {t('apiKeys.de') || 'de'} {logTotalPages} ({logTotal} {t('apiKeys.registos') || 'registos'})
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLogPageChange(logPage - 1)}
                          disabled={logPage <= 1}
                        >
                          {t('apiKeys.anterior') || 'Anterior'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLogPageChange(logPage + 1)}
                          disabled={logPage >= logTotalPages}
                        >
                          {t('apiKeys.seguinte') || 'Seguinte'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* === MODAL CRIAR KEY === */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) setIsCreateOpen(false); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              {createdKey ? t('apiKeys.keyCriada') : t('apiKeys.novaKey')}
            </DialogTitle>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-yellow-800">{t('apiKeys.copieAgora')}</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      {t('apiKeys.copieAgoraDesc')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <Input
                  readOnly
                  value={createdKey}
                  className="font-mono text-sm pr-12 bg-slate-50 dark:bg-slate-900"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => handleCopy(createdKey)}
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <DialogFooter>
                <Button onClick={() => setIsCreateOpen(false)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {t('apiKeys.entendidoCopiei')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">{t('apiKeys.nomeKey')}</Label>
                <Input
                  id="key-name"
                  value={newKeyData.name}
                  onChange={(e) => setNewKeyData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Power BI Produção, Dashboard Interno"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('apiKeys.scopes')}</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('apiKeys.scopesDesc')}</p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border rounded-lg">
                  {AVAILABLE_ENTITIES.map(e => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => toggleScope(e.value)}
                      className={`text-xs px-2 py-1 rounded-md transition-colors ${
                        newKeyData.scopes.includes(e.value)
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate-limit">{t('apiKeys.limiteReqMin')}</Label>
                  <Input
                    id="rate-limit"
                    type="number"
                    min={1}
                    max={1000}
                    value={newKeyData.rate_limit_per_minute}
                    onChange={(e) => setNewKeyData(prev => ({ ...prev, rate_limit_per_minute: parseInt(e.target.value) || 60 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires-days">{t('apiKeys.expirarEmDias')}</Label>
                  <Input
                    id="expires-days"
                    type="number"
                    min={1}
                    placeholder={t('apiKeys.semExpiracao')}
                    value={newKeyData.expires_days}
                    onChange={(e) => setNewKeyData(prev => ({ ...prev, expires_days: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowed-ips">{t('apiKeys.ipsPermitidos')}</Label>
                <Input
                  id="allowed-ips"
                  value={newKeyData.allowed_ips}
                  onChange={(e) => setNewKeyData(prev => ({ ...prev, allowed_ips: e.target.value }))}
                  placeholder="Ex: 192.168.1.100, 10.0.0.1 (vazio = qualquer IP)"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('apiKeys.separeIPs')}</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('apiKeys.cancelar')}</Button>
                <Button
                  onClick={handleCreateKey}
                  disabled={isCreating || !newKeyData.name.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isCreating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('apiKeys.criando')}</>
                  ) : (
                    <><Key className="w-4 h-4 mr-2" /> {t('apiKeys.gerarKey')}</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === MODAL REVOGAR KEY === */}
      <Dialog open={!!revokeKey} onOpenChange={(open) => { if (!open) setRevokeKey(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('apiKeys.revogarKey')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('apiKeys.confirmarRevogar').replace('{name}', revokeKey?.name || '')}
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <p className="font-medium">{t('apiKeys.acaoIrreversivel')}</p>
              <p className="mt-1">{t('apiKeys.revogarDesc')}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeKey(null)} disabled={isRevoking}>
                {t('apiKeys.cancelar')}
              </Button>
              <Button
                onClick={handleRevokeKey}
                disabled={isRevoking}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isRevoking ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('apiKeys.revogando')}</>
                ) : (
                  <><XCircle className="w-4 h-4 mr-2" /> {t('apiKeys.revogarKey')}</>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
