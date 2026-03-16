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
import { Layers, Plus, RefreshCw, Loader2, MoreVertical, Pencil, Trash2, GraduationCap, Plane, DollarSign } from 'lucide-react';
import { Cliente } from '@/entities/Cliente';
import { CobrancaServico } from '@/entities/CobrancaServico';
import { TipoServicoGeral } from '@/entities/TipoServicoGeral';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { base44 } from '@/api/base44Client';
import { isSuperAdmin, hasUserProfile } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import FormCobrancaServico from '@/components/servicos/FormCobrancaServico';
import ConfirmModal from '@/components/shared/ConfirmModal';

// Tipos automáticos (calculados por tariffCalculations) — NÃO mostrar na aba de serviços avulsos
const TIPOS_AUTOMATICOS = ['embarque', 'transito_direto', 'transito_transbordo', 'carga', 'seguranca', 'iluminacao', 'cuppss'];

export default function ServicosAeroportuarios() {
  const { effectiveEmpresaId } = useCompanyView();

  const [currentUser, setCurrentUser] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [cobrancas, setCobrancas] = useState([]);
  const [tiposServicoGeral, setTiposServicoGeral] = useState([]);
  const [tiposOutraTarifa, setTiposOutraTarifa] = useState([]);
  const [outrasTarifas, setOutrasTarifas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

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

  // Load cobrancas
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const cobrancasData = await CobrancaServico.filter({ data_servico: { $gte: dataInicio, $lte: dataFim } });
      // Quem acede a esta página vê todas as cobranças — filtro de empresa é só na UI (dropdown)
      setCobrancas(cobrancasData || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dataInicio, dataFim, currentUser, effectiveEmpresaId]);

  useEffect(() => {
    if (currentUser) loadData();
  }, [loadData, currentUser]);

  // ==================== Cobranças ====================
  const cobrancasFiltradas = useCallback((cat) => {
    let resultado = cobrancas.filter(c => c.categoria === cat);
    if (filtroEmpresa) {
      resultado = resultado.filter(c => c.cliente_id === filtroEmpresa);
    }
    return resultado.sort((a, b) => (b.data_servico || '').localeCompare(a.data_servico || ''));
  }, [cobrancas, filtroEmpresa]);

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

  const handleCobrancaSaved = async () => {
    const cobrancasData = await CobrancaServico.filter({ data_servico: { $gte: dataInicio, $lte: dataFim } });
    setCobrancas(cobrancasData || []);
  };

  const handleDeleteCobranca = async () => {
    if (!deleteTarget) return;
    try {
      await CobrancaServico.delete(deleteTarget.id);
      await handleCobrancaSaved();
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
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Cliente</Label>
            <Select
              options={[{ value: '', label: 'Todos' }, ...clientes.map(e => ({ value: e.id, label: e.nome }))]}
              value={filtroEmpresa}
              onValueChange={setFiltroEmpresa}
              placeholder="Todos"
              className="min-w-[280px] w-auto"
            />
          </div>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white h-9" onClick={() => handleNovaCobranca(cat)}>
            <Plus className="w-4 h-4 mr-1" /> Nova Cobrança
          </Button>
          {total > 0 && (
            <Badge className="bg-green-100 text-green-800 ml-auto text-sm px-3 py-1">
              Total: {total.toFixed(2)} USD
            </Badge>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nenhuma cobrança registada neste período.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  {cat === 'cursos_licencas' && <TableHead>Participante</TableHead>}
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Unit. (USD)</TableHead>
                  <TableHead className="text-right">Total (USD)</TableHead>
                  <TableHead>Status</TableHead>
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
                      <Badge variant="outline" className={c.status === 'facturado' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}>
                        {c.status === 'facturado' ? 'Facturado' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCobranca(c, cat)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(c)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
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
              Serviços Aeroportuários
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Period filters (shared) */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-40 h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-40 h-9" />
            </div>
          </div>

          <Tabs defaultValue="servicos_aeroportuarios" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="servicos_aeroportuarios" className="flex items-center gap-1">
                <Plane className="w-4 h-4" /> Serviços Aeroportuários
              </TabsTrigger>
              <TabsTrigger value="cursos_licencas" className="flex items-center gap-1">
                <GraduationCap className="w-4 h-4" /> Cursos e Licenças
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
          title="Excluir Cobrança"
          message={`Tem certeza que deseja excluir esta cobrança de ${deleteTarget.descricao || deleteTarget.tipo}?`}
        />
      )}
    </div>
  );
}
