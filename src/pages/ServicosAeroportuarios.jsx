import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Select from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Layers, Plus, RefreshCw, Loader2, MoreVertical, Pencil, Trash2, GraduationCap, Plane, Search, X } from 'lucide-react';
import { Cliente } from '@/entities/Cliente';
import { CobrancaServico } from '@/entities/CobrancaServico';
import { TipoServicoGeral } from '@/entities/TipoServicoGeral';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { base44 } from '@/api/base44Client';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCobrancasServico } from '@/hooks/useCobrancasServico';
import FormCobrancaServico from '@/components/servicos/FormCobrancaServico';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useI18n } from '@/components/lib/i18n';

// Tipos automáticos (calculados por tariffCalculations) — NÃO mostrar na aba de serviços avulsos
const TIPOS_AUTOMATICOS = ['embarque', 'transito_direto', 'transito_transbordo', 'carga', 'seguranca', 'iluminacao', 'cuppss'];

export default function ServicosAeroportuarios() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();

  const queryClient = useQueryClient();

  const [currentUser, setCurrentUser] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [tiposServicoGeral, setTiposServicoGeral] = useState([]);
  const [tiposOutraTarifa, setTiposOutraTarifa] = useState([]);
  const [outrasTarifas, setOutrasTarifas] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filters
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);
  const [filtroCliente, setFiltroCliente] = useState('');

  // Committed query — only updated on Buscar / initial load
  const buildInitialQuery = useCallback(() => {
    const q = {};
    if (effectiveEmpresaId) q.empresa_id = effectiveEmpresaId;
    q.data_servico = { $gte: primeiroDia, $lte: ultimoDia };
    return q;
  }, [effectiveEmpresaId, primeiroDia, ultimoDia]);

  const [committedQuery, setCommittedQuery] = useState(buildInitialQuery);
  const { data: cobrancas = [], isLoading } = useCobrancasServico({
    empresaId: effectiveEmpresaId,
    query: committedQuery,
    enabled: !!currentUser,
  });

  // Modals
  const [formCobrancaCategoria, setFormCobrancaCategoria] = useState('cursos_licencas');
  const [formCobrancaData, setFormCobrancaData] = useState(null);
  const [isFormCobrancaOpen, setIsFormCobrancaOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Load user + clientes
  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      Cliente.list(),
    ]).then(([user, cls]) => {
      setCurrentUser(user);
      setClientes(cls || []);
    }).catch(console.error);
  }, []);

  // Load tipos
  useEffect(() => {
    Promise.all([
      TipoServicoGeral.list(),
      fetchTiposOutraTarifa(),
      OutraTarifa.list(),
    ]).then(([tipos, tiposOT, ot]) => {
      setTiposServicoGeral(tipos || []);
      setTiposOutraTarifa(tiposOT || []);
      setOutrasTarifas(ot || []);
    }).catch(console.error);
  }, []);

  async function fetchTiposOutraTarifa() {
    try {
      const { data } = await (await import('@/lib/supabaseClient')).supabase
        .from('tipo_outra_tarifa')
        .select('*')
        .eq('status', 'ativa')
        .order('ordem');
      return data || [];
    } catch { return []; }
  }

  // Tipos de serviço aeroportuário (outra_tarifa excluindo automáticos)
  const tiposServicoAeroportuario = useMemo(() => {
    return (tiposOutraTarifa || [])
      .filter(t => !TIPOS_AUTOMATICOS.includes(t.value) && t.status === 'ativa')
      .map(t => ({
        ...t,
        // Buscar valor padrão da outra_tarifa (primeiro que encontrar)
        valor_padrao_usd: (() => {
          const tarifa = (outrasTarifas || []).find(ot =>
            ot.tipo === t.value && ot.status === 'ativa'
          );
          return tarifa ? Number(tarifa.valor) : 0;
        })(),
      }));
  }, [tiposOutraTarifa, outrasTarifas]);

  // Build server-side query from current filters
  const buildQuery = useCallback(() => {
    const query = {};
    if (effectiveEmpresaId) query.empresa_id = effectiveEmpresaId;
    if (dataInicio) query.data_servico = { ...query.data_servico, $gte: dataInicio };
    if (dataFim) query.data_servico = { ...query.data_servico, $lte: dataFim };
    if (filtroCliente) query.cliente_id = filtroCliente;
    return query;
  }, [effectiveEmpresaId, dataInicio, dataFim, filtroCliente]);

  // Buscar button handler — commit current filters to trigger useQuery refetch
  const handleBuscar = () => {
    setCommittedQuery(buildQuery());
  };

  // Limpar filters and reload with defaults
  const handleLimparFiltros = () => {
    setDataInicio(primeiroDia);
    setDataFim(ultimoDia);
    setFiltroCliente('');
    // Commit default query immediately (state not yet updated)
    setCommittedQuery(buildInitialQuery());
  };

  // ==================== Cobranças ====================
  // Server-side handles all filters; client-side only separates by category
  const cobrancasFiltradas = useCallback((cat) => {
    return cobrancas.filter(c => c.categoria === cat);
  }, [cobrancas]);

  const handleNovaCobranca = (cat) => {
    setFormCobrancaCategoria(cat);
    setFormCobrancaData(null);
    setIsFormCobrancaOpen(true);
  };

  const handleEditCobranca = (cobranca, cat) => {
    setFormCobrancaCategoria(cat);
    setFormCobrancaData(cobranca);
    setIsFormCobrancaOpen(true);
  };

  const invalidateCobrancas = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cobrancas-servico', effectiveEmpresaId] });
  }, [queryClient, effectiveEmpresaId]);

  const handleCobrancaSaved = () => {
    invalidateCobrancas();
  };

  const handleDeleteCobranca = async () => {
    if (!deleteTarget) return;
    try {
      await CobrancaServico.delete(deleteTarget.id);
      invalidateCobrancas();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
    setDeleteTarget(null);
  };

  const getClienteNome = (clienteId) => {
    return clientes.find(e => e.id === clienteId)?.nome || '—';
  };

  const getTotalCobrancas = (cat) => {
    return cobrancasFiltradas(cat).reduce((sum, c) => sum + Number(c.valor_total_usd || 0), 0);
  };

  // Determinar quais tipos passar ao form dependendo da categoria
  const getTiposParaCategoria = (cat) => {
    if (cat === 'servicos_aeroportuarios') return tiposServicoAeroportuario;
    return tiposServicoGeral;
  };

  // ==================== RENDER ====================
  const renderCobrancasTab = (cat, icon, titulo) => {
    const items = cobrancasFiltradas(cat);
    const total = getTotalCobrancas(cat);
    return (
      <div className="space-y-4">
        {/* Actions */}
        <div className="flex flex-wrap items-end gap-3">
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white h-9" onClick={() => handleNovaCobranca(cat)}>
            <Plus className="w-4 h-4 mr-1" /> {t('servicos.novaCobranca')}
          </Button>
          {total > 0 && (
            <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 ml-auto text-sm px-3 py-1">
              {t('servicos.total')}: {total.toFixed(2)} USD
            </Badge>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">{t('servicos.semCobrancas')}</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('servicos.data')}</TableHead>
                  <TableHead>{t('servicos.cliente')}</TableHead>
                  <TableHead>{t('servicos.servico')}</TableHead>
                  {cat === 'cursos_licencas' && <TableHead>{t('servicos.participante')}</TableHead>}
                  <TableHead className="text-right">{t('servicos.qtd')}</TableHead>
                  <TableHead className="text-right">{t('servicos.unitario')}</TableHead>
                  <TableHead className="text-right">{t('servicos.totalUSD')}</TableHead>
                  <TableHead>{t('servicos.statusCol')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{c.data_servico}</TableCell>
                    <TableCell className="text-sm font-medium">{getClienteNome(c.cliente_id)}</TableCell>
                    <TableCell className="text-sm">{c.descricao || c.tipo}</TableCell>
                    {cat === 'cursos_licencas' && <TableCell className="text-sm">{c.participante || '—'}</TableCell>}
                    <TableCell className="text-sm text-right">{Number(c.quantidade)}</TableCell>
                    <TableCell className="text-sm text-right">{Number(c.valor_unitario_usd).toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">{Number(c.valor_total_usd).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={c.status === 'facturado' ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'}>
                        {c.status === 'facturado' ? t('servicos.facturado') : t('servicos.pendente')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={t('servicos.maisOpcoes') || 'Mais opções'}><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCobranca(c, cat)}>
                            <Pencil className="mr-2 h-4 w-4" /> {t('servicos.editar')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => setDeleteTarget(c)}>
                            <Trash2 className="mr-2 h-4 w-4" /> {t('servicos.excluirCobranca')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-600" />
              {t('page.servicos_aeroportuarios.title')}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={invalidateCobrancas} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> {t('btn.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Server-side filters (shared) */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">{t('servicos.dataInicio')}</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-40 h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('servicos.dataFim')}</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-40 h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('servicos.cliente')}</Label>
              <Select
                options={[{ value: '', label: t('servicos.todos') }, ...clientes.map(e => ({ value: e.id, label: e.nome }))]}
                value={filtroCliente}
                onValueChange={setFiltroCliente}
                placeholder={t('servicos.todos')}
                className="min-w-[280px] w-auto"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleBuscar} disabled={isSearching} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
                {isSearching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</> : <><Search className="w-4 h-4 mr-2" /> Buscar</>}
              </Button>
              <Button variant="outline" className="h-9" onClick={handleLimparFiltros}>
                <X className="w-4 h-4 mr-2" /> Limpar
              </Button>
            </div>
          </div>

          <Tabs defaultValue="servicos_aeroportuarios" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="servicos_aeroportuarios" className="flex items-center gap-1">
                <Plane className="w-4 h-4" /> {t('servicos.tabServicos')}
              </TabsTrigger>
              <TabsTrigger value="cursos_licencas" className="flex items-center gap-1">
                <GraduationCap className="w-4 h-4" /> {t('servicos.tabCursos')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="servicos_aeroportuarios" className="mt-4">
              {renderCobrancasTab('servicos_aeroportuarios', Plane, 'Serviços Aeroportuários')}
            </TabsContent>

            <TabsContent value="cursos_licencas" className="mt-4">
              {renderCobrancasTab('cursos_licencas', GraduationCap, 'Cursos e Licenças')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Form Cobrança */}
      <FormCobrancaServico
        isOpen={isFormCobrancaOpen}
        onClose={() => { setIsFormCobrancaOpen(false); setFormCobrancaData(null); }}
        categoria={formCobrancaCategoria}
        tiposServico={getTiposParaCategoria(formCobrancaCategoria)}
        clientes={clientes}
        cobrancaInicial={formCobrancaData}
        onSaved={handleCobrancaSaved}
      />

      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteCobranca}
          title={t('servicos.excluirCobrancaTitle')}
          message={`${t('common.deleteConfirm')} (${deleteTarget.descricao || deleteTarget.tipo})`}
        />
      )}
    </div>
  );
}
