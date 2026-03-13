import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Select from '@/components/ui/select';
import { Loader2, FileText, DollarSign, Search, AlertTriangle, Layers } from 'lucide-react';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { Proforma } from '@/entities/Proforma';

export default function GerarProformaConsolidadaModal({ isOpen, onClose, onConfirm, companhias, aeroportos }) {
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculos, setCalculos] = useState([]);
  const [voos, setVoos] = useState([]);
  const [voosLigados, setVoosLigados] = useState([]);
  const [proformasExistentes, setProformasExistentes] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const [filtro, setFiltro] = useState({
    companhia_id: '',
    aeroporto_id: '',
    data_inicio: '',
    data_fim: '',
  });

  const [formData, setFormData] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    observacoes: ''
  });

  useEffect(() => {
    if (isOpen) {
      setCalculos([]);
      setVoos([]);
      setVoosLigados([]);
      setSelectedIds(new Set());
      setHasSearched(false);
      setFiltro({ companhia_id: '', aeroporto_id: '', data_inicio: '', data_fim: '' });

      const dataEmissao = new Date();
      const dataVencimento = new Date(dataEmissao);
      dataVencimento.setDate(dataVencimento.getDate() + 30);
      setFormData({
        data_emissao: dataEmissao.toISOString().split('T')[0],
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        observacoes: ''
      });
    }
  }, [isOpen]);

  const handleBuscar = async () => {
    if (!filtro.companhia_id) return;
    setIsSearching(true);
    setHasSearched(true);

    try {
      // Fetch all data in parallel
      const [allCalcData, voosData, vlData, proformasData] = await Promise.all([
        CalculoTarifa.list('-data_calculo', 1000),
        Voo.list('-data_operacao', 1000),
        VooLigado.list('-created_date', 1000),
        Proforma.list(),
      ]);

      // Only non-deleted voos
      const activeVoos = voosData.filter(v => !v.deleted);
      const vooMap = new Map(activeVoos.map(v => [v.id, v]));

      // Build aeroporto lookup sets (UUID + ICAO) for empresa isolation
      const allowedAeroIds = new Set(aeroportos.map(a => a.id));
      const allowedAeroIcaos = new Set(aeroportos.map(a => a.codigo_icao).filter(Boolean));

      // Find the selected companhia's ICAO code for matching via voo.companhia_aerea
      const companhiaSelecionada = companhias.find(c => c.id === filtro.companhia_id);
      const companhiaIcao = companhiaSelecionada?.codigo_icao;

      // Filter calculos: must have a valid (non-deleted) voo + match companhia
      let filteredCalcs = allCalcData.filter(calc => {
        // Must reference a non-deleted voo
        const voo = vooMap.get(calc.voo_id);
        if (!voo) return false;

        // Match companhia via calculo.companhia_id (UUID) or voo.companhia_aerea (ICAO)
        const matchCompanhia = calc.companhia_id === filtro.companhia_id ||
          (companhiaIcao && voo.companhia_aerea === companhiaIcao);
        return matchCompanhia;
      });

      // Filter by aeroporto — empresa isolation
      // aeroporto_id can be UUID or ICAO code (inconsistent legacy data)
      if (filtro.aeroporto_id) {
        const selectedAero = aeroportos.find(a => a.id === filtro.aeroporto_id);
        const selectedIcao = selectedAero?.codigo_icao;
        filteredCalcs = filteredCalcs.filter(c => {
          if (c.aeroporto_id === filtro.aeroporto_id) return true;
          if (selectedIcao && c.aeroporto_id === selectedIcao) return true;
          // Fallback: match via voo.aeroporto_operacao
          const voo = vooMap.get(c.voo_id);
          return voo && selectedIcao && voo.aeroporto_operacao === selectedIcao;
        });
      } else if (aeroportos.length > 0) {
        filteredCalcs = filteredCalcs.filter(c => {
          // Match by UUID
          if (allowedAeroIds.has(c.aeroporto_id)) return true;
          // Match by ICAO code (legacy records)
          if (allowedAeroIcaos.has(c.aeroporto_id)) return true;
          // Fallback: match via voo.aeroporto_operacao
          const voo = vooMap.get(c.voo_id);
          return voo && allowedAeroIcaos.has(voo.aeroporto_operacao);
        });
      }

      // Filter by date range (using voo data_operacao)
      if (filtro.data_inicio || filtro.data_fim) {
        filteredCalcs = filteredCalcs.filter(calc => {
          const voo = vooMap.get(calc.voo_id);
          if (!voo) return false;
          const dataOp = voo.data_operacao;
          if (filtro.data_inicio && dataOp < filtro.data_inicio) return false;
          if (filtro.data_fim && dataOp > filtro.data_fim) return false;
          return true;
        });
      }

      // Filter out calculos that already have a proforma (individual or consolidated)
      const calcIdsComProforma = new Set();
      proformasData.forEach(p => {
        if (p.calculo_tarifa_id && p.status !== 'cancelada') {
          calcIdsComProforma.add(p.calculo_tarifa_id);
        }
      });
      filteredCalcs = filteredCalcs.filter(c => !calcIdsComProforma.has(c.id));

      // Only include calculos with values > 0
      filteredCalcs = filteredCalcs.filter(c => (c.total_tarifa_usd || 0) > 0);

      setCalculos(filteredCalcs);
      setVoos(voosData);
      setVoosLigados(vlData);
      setProformasExistentes(proformasData);
      setSelectedIds(new Set(filteredCalcs.map(c => c.id)));
    } catch (error) {
      console.error('Erro ao buscar cálculos:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === calculos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(calculos.map(c => c.id)));
    }
  };

  const selectedCalcItems = useMemo(() => {
    return calculos.filter(c => selectedIds.has(c.id));
  }, [calculos, selectedIds]);

  const totais = useMemo(() => {
    return selectedCalcItems.reduce((acc, c) => ({
      usd: acc.usd + (c.total_tarifa_usd || 0),
      aoa: acc.aoa + (c.total_tarifa || 0),
    }), { usd: 0, aoa: 0 });
  }, [selectedCalcItems]);

  const taxaCambioMedia = useMemo(() => {
    if (selectedCalcItems.length === 0) return 0;
    const soma = selectedCalcItems.reduce((acc, c) => acc + (c.taxa_cambio_usd_aoa || 0), 0);
    return soma / selectedCalcItems.length;
  }, [selectedCalcItems]);

  const getVooInfo = (calc) => {
    const vl = voosLigados.find(v => v.id === calc.voo_ligado_id);
    const vooArr = vl ? voos.find(v => v.id === vl.id_voo_arr) : null;
    const vooDep = vl ? voos.find(v => v.id === vl.id_voo_dep) : null;
    const voo = voos.find(v => v.id === calc.voo_id);
    return {
      numero: vooDep?.numero_voo || voo?.numero_voo || '-',
      data: voo?.data_operacao || vooDep?.data_operacao || vooArr?.data_operacao || '-',
      registo: voo?.registo_aeronave || vooDep?.registo_aeronave || vooArr?.registo_aeronave || '-',
      permanencia: calc.tempo_permanencia_horas ? `${calc.tempo_permanencia_horas.toFixed(1)}h` : '-',
    };
  };

  const formatCurrency = (value, currency = 'AOA') => {
    return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedCalcItems.length === 0) return;
    setIsSubmitting(true);

    try {
      const companhia = companhias.find(c => c.id === filtro.companhia_id);

      await onConfirm({
        ...formData,
        tipo: 'consolidada',
        companhia_aerea_id: filtro.companhia_id,
        aeroporto_id: filtro.aeroporto_id || selectedCalcItems[0]?.aeroporto_id,
        valor_total_usd: totais.usd,
        valor_total_aoa: totais.aoa,
        taxa_cambio: Math.round(taxaCambioMedia),
        periodo_inicio: filtro.data_inicio,
        periodo_fim: filtro.data_fim,
        // Pass selected items for creating proforma_item records
        _items: selectedCalcItems.map(c => ({
          calculo_tarifa_id: c.id,
          voo_ligado_id: c.voo_ligado_id,
          voo_id: c.voo_id,
          valor_usd: c.total_tarifa_usd || 0,
          valor_aoa: c.total_tarifa || 0,
        })),
      });
      onClose();
    } catch (error) {
      console.error('Erro ao gerar proforma consolidada:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const companhiaOptions = companhias.map(c => ({ value: c.id, label: `${c.nome} (${c.codigo_icao})` }));
  const aeroportoOptions = [
    { value: '', label: 'Todos os Aeroportos' },
    ...aeroportos.map(a => ({ value: a.id, label: `${a.nome} (${a.codigo_icao})` }))
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl"  style={{ overflow: 'visible' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Gerar Proforma Consolidada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Filters */}
          <div className="bg-slate-50 border rounded-lg p-4 space-y-4 relative z-10">
            <h3 className="font-semibold text-slate-700 text-sm">Selecionar Companhia e Período</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Companhia <span className="text-red-500">*</span></Label>
                <Select
                  options={companhiaOptions}
                  value={filtro.companhia_id}
                  onValueChange={(v) => setFiltro(prev => ({ ...prev, companhia_id: v }))}
                  placeholder="Selecionar..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aeroporto</Label>
                <Select
                  options={aeroportoOptions}
                  value={filtro.aeroporto_id}
                  onValueChange={(v) => setFiltro(prev => ({ ...prev, aeroporto_id: v }))}
                  placeholder="Todos"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Início</Label>
                <Input
                  type="date"
                  value={filtro.data_inicio}
                  onChange={(e) => setFiltro(prev => ({ ...prev, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={filtro.data_fim}
                  onChange={(e) => setFiltro(prev => ({ ...prev, data_fim: e.target.value }))}
                />
              </div>
            </div>
            <Button
              onClick={handleBuscar}
              disabled={!filtro.companhia_id || isSearching}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              {isSearching ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...</>
              ) : (
                <><Search className="mr-2 h-4 w-4" /> Buscar Voos</>
              )}
            </Button>
          </div>

          {/* Results Table */}
          {hasSearched && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-white p-3 border-b flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">
                  {calculos.length} voo(s) disponível(eis) para faturação
                </span>
                {calculos.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {selectedIds.size} selecionado(s)
                  </span>
                )}
              </div>

              {isSearching ? (
                <div className="p-4 space-y-2">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : calculos.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                  <p className="font-medium">Nenhum voo encontrado</p>
                  <p className="text-xs mt-1">Todos os voos desta companhia/período já possuem proforma ou não têm tarifas calculadas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedIds.size === calculos.length && calculos.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead className="text-xs">Voo</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Registo</TableHead>
                        <TableHead className="text-xs">Aeroporto</TableHead>
                        <TableHead className="text-xs">Permanência</TableHead>
                        <TableHead className="text-xs text-right">USD</TableHead>
                        <TableHead className="text-xs text-right">AOA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculos.map(calc => {
                        const info = getVooInfo(calc);
                        const aero = aeroportos.find(a => a.id === calc.aeroporto_id || a.codigo_icao === calc.aeroporto_id);
                        return (
                          <TableRow key={calc.id} className={selectedIds.has(calc.id) ? 'bg-blue-50' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(calc.id)}
                                onCheckedChange={() => toggleSelect(calc.id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs font-medium">{info.numero}</TableCell>
                            <TableCell className="text-xs">{info.data}</TableCell>
                            <TableCell className="font-mono text-xs">{info.registo}</TableCell>
                            <TableCell className="font-mono text-xs">{aero?.codigo_icao || '-'}</TableCell>
                            <TableCell className="text-xs">{info.permanencia}</TableCell>
                            <TableCell className="text-xs text-right font-medium">${formatCurrency(calc.total_tarifa_usd, 'USD')}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatCurrency(calc.total_tarifa)} Kz</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* Totals & Form */}
          {selectedCalcItems.length > 0 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Resumo da Consolidação — {selectedCalcItems.length} voo(s)
                </h3>
                <div className="flex justify-between items-center">
                  <span className="text-blue-600 font-semibold">Total (USD):</span>
                  <span className="text-lg font-bold text-blue-900">
                    ${formatCurrency(totais.usd, 'USD')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-blue-600 font-semibold">Total (AOA):</span>
                  <span className="text-xl font-bold text-green-700">
                    {formatCurrency(totais.aoa)} Kz
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-blue-500">Taxa de Câmbio Média:</span>
                  <Badge variant="outline" className="text-xs">1 USD = {Math.round(taxaCambioMedia)} AOA</Badge>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Data de Emissão <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.data_emissao}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_emissao: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data de Vencimento <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.data_vencimento}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_vencimento: e.target.value }))}
                    required
                    min={formData.data_emissao}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  placeholder="Observações ou notas adicionais..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800 flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">⚠️</span>
                  Será gerada uma nota proforma consolidada com {selectedCalcItems.length} voo(s). Um PDF consolidado será gerado automaticamente.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
                  ) : (
                    <><Layers className="mr-2 h-4 w-4" /> Gerar Consolidada</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
