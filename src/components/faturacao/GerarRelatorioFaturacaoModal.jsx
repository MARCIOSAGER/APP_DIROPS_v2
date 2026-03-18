import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Select from '@/components/ui/select';
import { Loader2, FileText, DollarSign, Search, AlertTriangle, Mail } from 'lucide-react';
import SendEmailModal from '@/components/shared/SendEmailModal';
import { toast } from '@/components/ui/use-toast';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { Proforma } from '@/entities/Proforma';

export default function GerarRelatorioFaturacaoModal({ isOpen, onClose, companhias, aeroportos }) {
  const { t } = useI18n();
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [pdfForEmail, setPdfForEmail] = useState(null);
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

  const handlePrepareEmail = async () => {
    if (selectedCalcItems.length === 0) return;
    setIsGenerating(true);

    try {
      const { gerarRelatorioFaturacaoPdf } = await import('@/functions/gerarProformaPdfSimples');
      const companhia = companhias.find(c => c.id === filtro.companhia_id);
      const aeroporto = filtro.aeroporto_id
        ? aeroportos.find(a => a.id === filtro.aeroporto_id)
        : null;

      const result = await gerarRelatorioFaturacaoPdf({
        calculos: selectedCalcItems,
        companhia,
        aeroporto,
        periodo_inicio: filtro.data_inicio,
        periodo_fim: filtro.data_fim,
        voos,
        voosLigados,
        proformasMap,
        returnBase64: true,
      });

      setPdfForEmail(result);
      setIsEmailModalOpen(true);
    } catch (error) {
      console.error('Erro ao gerar PDF para email:', error);
      toast({ title: 'Erro', description: 'Erro ao gerar PDF para envio.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async ({ to, subject, message }) => {
    if (!pdfForEmail) return;
    setIsSendingEmail(true);

    try {
      const { sendEmailDirect } = await import('@/functions/sendEmailDirect');
      await sendEmailDirect({
        to,
        subject,
        body: message || `Segue em anexo o Extrato de Facturação.`,
        html: `<p>${message || 'Segue em anexo o Extrato de Facturação.'}</p>`,
        attachments: [{
          filename: pdfForEmail.filename,
          content: pdfForEmail.base64,
          contentType: 'application/pdf',
        }],
      });

      toast({ title: 'Email enviado', description: `Extrato enviado para ${to}` });
      setIsEmailModalOpen(false);
      setPdfForEmail(null);
      onClose();
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast({ title: 'Erro', description: `Erro ao enviar email: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const companhiaOptions = companhias.map(c => ({ value: c.id, label: `${c.nome} (${c.codigo_icao})` }));
  const aeroportoOptions = [
    { value: '', label: t('gerarRelatorio.todosAeroportos') },
    ...aeroportos.map(a => ({ value: a.id, label: `${a.nome} (${a.codigo_icao})` }))
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl" style={{ overflow: 'visible' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            {t('gerarRelatorio.titulo')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Filters */}
          <div className="bg-slate-50 border rounded-lg p-4 space-y-4 relative z-10">
            <h3 className="font-semibold text-slate-700 text-sm">{t('gerarRelatorio.selecionarCompanhia')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('gerarRelatorio.companhia')} <span className="text-red-500">*</span></Label>
                <Select
                  options={companhiaOptions}
                  value={filtro.companhia_id}
                  onValueChange={(v) => setFiltro(prev => ({ ...prev, companhia_id: v }))}
                  placeholder="Selecionar..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('gerarRelatorio.aeroporto')}</Label>
                <Select
                  options={aeroportoOptions}
                  value={filtro.aeroporto_id}
                  onValueChange={(v) => setFiltro(prev => ({ ...prev, aeroporto_id: v }))}
                  placeholder={t('gerarRelatorio.todosAeroportos')}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('gerarRelatorio.dataInicio')}</Label>
                <Input
                  type="date"
                  value={filtro.data_inicio}
                  onChange={(e) => setFiltro(prev => ({ ...prev, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('gerarRelatorio.dataFim')}</Label>
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('gerarRelatorio.buscando')}</>
              ) : (
                <><Search className="mr-2 h-4 w-4" /> {t('gerarRelatorio.buscarVoos')}</>
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
                  <p className="font-medium">{t('gerarRelatorio.nenhumVoo')}</p>
                  <p className="text-xs mt-1">{t('gerarRelatorio.nenhumVooDesc')}</p>
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
                        <TableHead className="text-xs">{t('gerarRelatorio.colVoo')}</TableHead>
                        <TableHead className="text-xs">{t('gerarRelatorio.colData')}</TableHead>
                        <TableHead className="text-xs">{t('gerarRelatorio.colRegisto')}</TableHead>
                        <TableHead className="text-xs">{t('gerarRelatorio.colAeroporto')}</TableHead>
                        <TableHead className="text-xs">{t('gerarRelatorio.colProforma')}</TableHead>
                        <TableHead className="text-xs">{t('gerarRelatorio.colPermanencia')}</TableHead>
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
                  {t('gerarRelatorio.resumo')} — {selectedCalcItems.length} voo(s)
                </h3>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-600 font-semibold">{t('gerarRelatorio.totalUSD')}</span>
                  <span className="text-lg font-bold text-emerald-900">
                    ${formatCurrency(totais.usd)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-emerald-600 font-semibold">{t('gerarRelatorio.totalAOA')}</span>
                  <span className="text-xl font-bold text-green-700">
                    {formatCurrency(totais.aoa)} Kz
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-emerald-500">{t('gerarRelatorio.taxaCambioMedia')}</span>
                  <Badge variant="outline" className="text-xs">1 USD = {Math.round(taxaCambioMedia)} AOA</Badge>
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isGenerating}>
                  {t('gerarRelatorio.cancelar')}
                </Button>
                <Button
                  onClick={handlePrepareEmail}
                  disabled={isGenerating}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {isGenerating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('gerarRelatorio.preparando')}</>
                  ) : (
                    <><Mail className="mr-2 h-4 w-4" /> {t('gerarRelatorio.enviarPorEmail')}</>
                  )}
                </Button>
                <Button
                  onClick={handleGerarRelatorio}
                  disabled={isGenerating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isGenerating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('gerarRelatorio.gerandoPDF')}</>
                  ) : (
                    <><FileText className="mr-2 h-4 w-4" /> {t('gerarRelatorio.gerarRelatorioPDF')}</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => { setIsEmailModalOpen(false); setPdfForEmail(null); }}
        onSend={handleSendEmail}
        isSending={isSendingEmail}
        defaultSubject={`Extrato de Facturação — ${companhias.find(c => c.id === filtro.companhia_id)?.nome || ''}`}
        defaultBody="Segue em anexo o Extrato de Facturação."
      />
    </Dialog>
  );
}
