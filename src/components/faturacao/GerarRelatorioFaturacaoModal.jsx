import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Select from '@/components/ui/select';
import { Loader2, FileText, DollarSign, Search, AlertTriangle } from 'lucide-react';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { Proforma } from '@/entities/Proforma';

export default function GerarRelatorioFaturacaoModal({ isOpen, onClose, companhias, aeroportos }) {
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [calculos, setCalculos] = useState([]);
  const [voos, setVoos] = useState([]);
  const [voosLigados, setVoosLigados] = useState([]);
  const [proformasMap, setProformasMap] = useState(new Map());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const [filtro, setFiltro] = useState({
    companhia_id: '',
    aeroporto_id: '',
    data_inicio: '',
    data_fim: '',
  });

  useEffect(() => {
    if (isOpen) {
      setCalculos([]);
      setVoos([]);
      setVoosLigados([]);
      setProformasMap(new Map());
      setSelectedIds(new Set());
      setHasSearched(false);
      setFiltro({ companhia_id: '', aeroporto_id: '', data_inicio: '', data_fim: '' });
    }
  }, [isOpen]);

  const handleBuscar = async () => {
    if (!filtro.companhia_id) return;
    setIsSearching(true);
    setHasSearched(true);

    try {
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

      const companhiaSelecionada = companhias.find(c => c.id === filtro.companhia_id);
      const companhiaIcao = companhiaSelecionada?.codigo_icao;

      // Filter calculos: must have a valid (non-deleted) voo + match companhia
      let filteredCalcs = allCalcData.filter(calc => {
        const voo = vooMap.get(calc.voo_id);
        if (!voo) return false;
        const matchCompanhia = calc.companhia_id === filtro.companhia_id ||
          (companhiaIcao && voo.companhia_aerea === companhiaIcao);
        return matchCompanhia;
      });

      // Filter by aeroporto — empresa isolation
      if (filtro.aeroporto_id) {
        const selectedAero = aeroportos.find(a => a.id === filtro.aeroporto_id);
        const selectedIcao = selectedAero?.codigo_icao;
        filteredCalcs = filteredCalcs.filter(c => {
          if (c.aeroporto_id === filtro.aeroporto_id) return true;
          if (selectedIcao && c.aeroporto_id === selectedIcao) return true;
          const voo = vooMap.get(c.voo_id);
          return voo && selectedIcao && voo.aeroporto_operacao === selectedIcao;
        });
      } else if (aeroportos.length > 0) {
        filteredCalcs = filteredCalcs.filter(c => {
          if (allowedAeroIds.has(c.aeroporto_id)) return true;
          if (allowedAeroIcaos.has(c.aeroporto_id)) return true;
          const voo = vooMap.get(c.voo_id);
          return voo && allowedAeroIcaos.has(voo.aeroporto_operacao);
        });
      }

      // Filter by date range
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

      // NO proforma exclusion filter — include ALL flights with tariffs
      // Only include calculos with values > 0
      filteredCalcs = filteredCalcs.filter(c => (c.total_tarifa_usd || 0) > 0);

      // Build proforma map: calculo_tarifa_id -> proforma numero
      const pfMap = new Map();
      proformasData.forEach(p => {
        if (p.calculo_tarifa_id && p.status !== 'cancelada' && p.numero_proforma) {
          pfMap.set(p.calculo_tarifa_id, p.numero_proforma);
        }
      });

      setCalculos(filteredCalcs);
      setVoos(voosData);
      setVoosLigados(vlData);
      setProformasMap(pfMap);
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  const handleGerarRelatorio = async () => {
    if (selectedCalcItems.length === 0) return;
    setIsGenerating(true);

    try {
      const { gerarRelatorioFaturacaoPdf } = await import('@/functions/gerarProformaPdfSimples');
      const companhia = companhias.find(c => c.id === filtro.companhia_id);
      const aeroporto = filtro.aeroporto_id
        ? aeroportos.find(a => a.id === filtro.aeroporto_id)
        : null;

      await gerarRelatorioFaturacaoPdf({
        calculos: selectedCalcItems,
        companhia,
        aeroporto,
        periodo_inicio: filtro.data_inicio,
        periodo_fim: filtro.data_fim,
        voos,
        voosLigados,
        proformasMap,
      });

      onClose();
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const companhiaOptions = companhias.map(c => ({ value: c.id, label: `${c.nome} (${c.codigo_icao})` }));
  const aeroportoOptions = [
    { value: '', label: 'Todos os Aeroportos' },
    ...aeroportos.map(a => ({ value: a.id, label: `${a.nome} (${a.codigo_icao})` }))
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl" style={{ overflow: 'visible' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Extrato de Faturação
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
                  {calculos.length} voo(s) encontrado(s)
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
                  <p className="text-xs mt-1">Não existem voos com tarifas calculadas para esta companhia/período.</p>
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
                        <TableHead className="text-xs">Proforma</TableHead>
                        <TableHead className="text-xs">Permanência</TableHead>
                        <TableHead className="text-xs text-right">USD</TableHead>
                        <TableHead className="text-xs text-right">AOA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculos.map(calc => {
                        const info = getVooInfo(calc);
                        const aero = aeroportos.find(a => a.id === calc.aeroporto_id || a.codigo_icao === calc.aeroporto_id);
                        const pfNumero = proformasMap.get(calc.id);
                        return (
                          <TableRow key={calc.id} className={selectedIds.has(calc.id) ? 'bg-emerald-50' : ''}>
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
                            <TableCell className="text-xs">
                              {pfNumero ? (
                                <Badge variant="outline" className="text-[10px] font-mono">{pfNumero}</Badge>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{info.permanencia}</TableCell>
                            <TableCell className="text-xs text-right font-medium">${formatCurrency(calc.total_tarifa_usd)}</TableCell>
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

          {/* Totals & Generate Button */}
          {selectedCalcItems.length > 0 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Resumo — {selectedCalcItems.length} voo(s) selecionado(s)
                </h3>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-600 font-semibold">Total (USD):</span>
                  <span className="text-lg font-bold text-emerald-900">
                    ${formatCurrency(totais.usd)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-emerald-600 font-semibold">Total (AOA):</span>
                  <span className="text-xl font-bold text-green-700">
                    {formatCurrency(totais.aoa)} Kz
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-emerald-500">Taxa de Câmbio Média:</span>
                  <Badge variant="outline" className="text-xs">1 USD = {Math.round(taxaCambioMedia)} AOA</Badge>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isGenerating}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleGerarRelatorio}
                  disabled={isGenerating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isGenerating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PDF...</>
                  ) : (
                    <><FileText className="mr-2 h-4 w-4" /> Gerar Relatório PDF</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
