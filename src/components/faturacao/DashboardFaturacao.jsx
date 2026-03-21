import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Select from '@/components/ui/select';
import SendEmailModal from '@/components/shared/SendEmailModal';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { Proforma } from '@/entities/Proforma';
import { downloadAsExcel } from '@/components/lib/export';
import {
  Search, Loader2, FileText, DollarSign, Plane, Clock,
  Download, Mail, AlertTriangle, BarChart3, TrendingUp,
  Filter,
} from 'lucide-react';

const fmtNum = (v, d = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

const fmtDateTime = (dateStr, timeStr) => {
  if (!dateStr) return '—';
  const d = fmtDate(dateStr);
  return timeStr ? `${d} ${timeStr.substring(0, 5)}` : d;
};

const normalizeResourceKey = (tipo) => {
  if (!tipo) return '';
  const t = tipo.toLowerCase();
  if (t.includes('pca') || t.includes('condicionado')) return 'PCA';
  if (t.includes('gpu') || t.includes('ground power')) return 'GPU';
  if (t.includes('pbb') || t.includes('ponte')) return 'PBB';
  return tipo;
};

const getOutraTarifaLabel = (tipo) => {
  if (!tipo) return '';
  const t = tipo.toLowerCase();
  if (t.includes('iluminac')) return 'Ilumin.';
  if (t.includes('check') || t.includes('chkin')) return 'ChkIn';
  if (t.includes('cuppss') || t.includes('cupps')) return 'CUPPSS';
  if (t.includes('embarque')) return 'Embarq.';
  if (t.includes('transito_direto') || t.includes('trânsito direto')) return 'Trans.D';
  if (t.includes('transito_transbordo') || t.includes('trânsito transbordo')) return 'Trans.T';
  if (t.includes('seguranca') || t.includes('segurança')) return 'Segur.';
  if (t.includes('assist') && t.includes('espec')) return 'Ass.Esp';
  if (t.includes('fast')) return 'FastTrk';
  if (t.includes('assist') && t.includes('bag')) return 'Ass.Bag';
  if (t.includes('brs')) return 'BRS';
  return tipo.substring(0, 8);
};

export default function DashboardFaturacao({ companhias, aeroportos }) {
  const { t } = useI18n();
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [pdfForEmail, setPdfForEmail] = useState(null);

  const [calculos, setCalculos] = useState([]);
  const [voos, setVoos] = useState([]);
  const [voosLigados, setVoosLigados] = useState([]);
  const [proformasMap, setProformasMap] = useState(new Map());
  const [hasSearched, setHasSearched] = useState(false);
  const [companhiasComTarifas, setCompanhiasComTarifas] = useState(new Set());
  const [isLoadingCompanhias, setIsLoadingCompanhias] = useState(true);

  const [filtro, setFiltro] = useState({
    companhia_id: '',
    aeroporto_id: '',
    data_inicio: '',
    data_fim: '',
  });

  // Load distinct companhia IDs that have tariff calculations (lightweight query)
  useEffect(() => {
    const loadCompanhiasComTarifas = async () => {
      try {
        // Single lightweight query: just get distinct companhia_ids from calculo_tarifa
        const { data, error } = await supabase
          .from('calculo_tarifa')
          .select('companhia_id')
          .not('companhia_id', 'is', null);
        if (error) throw error;

        const calcCompIds = new Set((data || []).map(c => c.companhia_id));
        setCompanhiasComTarifas(calcCompIds);
      } catch (error) {
        console.error('Erro ao carregar companhias:', error);
        // Fallback: show all companhias
        setCompanhiasComTarifas(new Set(companhias.map(c => c.id)));
      } finally {
        setIsLoadingCompanhias(false);
      }
    };
    loadCompanhiasComTarifas();
  }, [companhias]);

  const handleBuscar = async () => {
    if (!filtro.companhia_id) {
      toast({ title: t('dashFat.atencao'), description: t('dashFat.selecionarCompanhia'), variant: 'destructive' });
      return;
    }
    setIsSearching(true);
    setHasSearched(true);

    try {
      // 1. Server-side filtered query: companhia + aeroporto + date range in ONE call
      const rpcParams = {};
      if (filtro.companhia_id && filtro.companhia_id !== '_todas') rpcParams.p_companhia_id = filtro.companhia_id;
      if (filtro.aeroporto_id) rpcParams.p_aeroporto_id = filtro.aeroporto_id;
      if (filtro.data_inicio) rpcParams.p_data_inicio = filtro.data_inicio;
      if (filtro.data_fim) rpcParams.p_data_fim = filtro.data_fim;

      // If no aeroporto selected, filter by allowed aeroportos
      if (!filtro.aeroporto_id && aeroportos.length > 0 && aeroportos.length < 30) {
        // Use first aeroporto as default filter for performance
        rpcParams.p_aeroporto_id = aeroportos[0]?.id;
      }

      // Paginated RPC call (may return > 1000 rows)
      const PAGE = 1000;
      let filteredCalcs = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.rpc('get_calculos_por_periodo', rpcParams).range(from, from + PAGE - 1);
        if (error) { console.error('RPC error:', error); break; }
        if (!data || data.length === 0) break;
        filteredCalcs = filteredCalcs.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      // 2. Load voo_ligados and voos for display (only for filtered calculos)
      const vlIds = [...new Set(filteredCalcs.map(c => c.voo_ligado_id).filter(Boolean))];
      const vooIds = new Set(filteredCalcs.map(c => c.voo_id).filter(Boolean));

      // Load voo_ligados in batches
      let vlData = [];
      for (let i = 0; i < vlIds.length; i += 200) {
        const batch = vlIds.slice(i, i + 200);
        const batchData = await VooLigado.filter({ id: { $in: batch } });
        vlData = vlData.concat(batchData);
      }

      // Collect arr voo IDs from voo_ligados
      vlData.forEach(vl => {
        if (vl.id_voo_arr) vooIds.add(vl.id_voo_arr);
        if (vl.id_voo_dep) vooIds.add(vl.id_voo_dep);
      });

      // Load voos in batches
      const vooIdArray = Array.from(vooIds);
      let voosData = [];
      for (let i = 0; i < vooIdArray.length; i += 200) {
        const batch = vooIdArray.slice(i, i + 200);
        const batchData = await Voo.filter({ id: { $in: batch } });
        voosData = voosData.concat(batchData);
      }

      // Build proforma map
      const proformasData = await Proforma.list();
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
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({ title: t('shared.erro'), description: t('dashFat.erroFaturacao'), variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const isTodasCompanhias = filtro.companhia_id === '_todas';

  // Build enriched rows
  const rows = useMemo(() => {
    const vooMap = new Map(voos.map(v => [v.id, v]));
    const vlMap = new Map(voosLigados.map(vl => [vl.id, vl]));
    return calculos.filter(calc => {
      // Only show calculos with complete ARR+DEP pair
      const vl = vlMap.get(calc.voo_ligado_id);
      if (!vl) return false;
      return vooMap.has(vl.id_voo_arr) && vooMap.has(vl.id_voo_dep);
    }).map(calc => {
      const det = calc.detalhes_calculo || {};
      const vl = vlMap.get(calc.voo_ligado_id);
      const vooArr = vooMap.get(vl.id_voo_arr);
      const vooDep = vooMap.get(vl.id_voo_dep);
      const voo = vooMap.get(calc.voo_id);

      const registo = voo?.registo_aeronave || vooDep?.registo_aeronave || vooArr?.registo_aeronave || '—';
      const mtowKg = det.pouso?.mtowKg || calc.mtow_kg || 0;
      const mtowTon = mtowKg / 1000;
      const tipoVoo = det.passageiros?.tipoVoo || det.pouso?.tipoVoo || '—';
      const tipoCode = tipoVoo.toLowerCase().includes('dom') ? 'DOM' : tipoVoo.toLowerCase().includes('int') ? 'INT' : '—';

      const numArr = vooArr?.numero_voo || calc.numero_voo || '';
      const numDep = vooDep?.numero_voo || voo?.numero_voo || '';
      const vooLabel = numArr && numDep && numArr !== numDep
        ? `${numArr}/${numDep}`
        : numDep || numArr || '—';

      const aterragem = vooArr
        ? fmtDateTime(vooArr.data_operacao, vooArr.horario_real || vooArr.horario_previsto)
        : '—';
      const descolagem = vooDep
        ? fmtDateTime(vooDep.data_operacao, vooDep.horario_real || vooDep.horario_previsto)
        : (voo ? fmtDateTime(voo.data_operacao, voo.horario_real || voo.horario_previsto) : '—');

      const txAterr = calc.tarifa_pouso_usd || 0;
      const estacH = calc.tempo_permanencia_horas || det.permanencia?.tempoPermanencia || 0;
      const estacUsd = calc.tarifa_permanencia_usd || 0;
      const paxCount = det.passageiros?.totalPassageirosCobranca || det.passageiros?.passageirosDep || 0;
      const paxUsd = calc.tarifa_passageiros_usd || 0;

      // Outras tarifas
      const outrasTarifas = {};
      if (det.iluminacao && det.iluminacao.valor > 0) {
        outrasTarifas['Ilumin.'] = det.iluminacao.valor;
      }
      if (det.outras && Array.isArray(det.outras)) {
        det.outras.forEach(o => {
          if (o.valor > 0) {
            const label = getOutraTarifaLabel(o.tipo);
            outrasTarifas[label] = (outrasTarifas[label] || 0) + o.valor;
          }
        });
      }

      // Recursos (PCA, GPU, PBB)
      const recursos = {};
      if (det.recursos?.itens && Array.isArray(det.recursos.itens)) {
        det.recursos.itens.forEach(r => {
          const key = normalizeResourceKey(r.tipo);
          if (['PCA', 'GPU', 'PBB'].includes(key)) {
            recursos[key] = {
              horas: r.tempo_horas || 0,
              usd: r.valor_usd || 0,
            };
          }
        });
      }

      // Impostos
      let ivaTotal = 0;
      let ivaLabel = 'IVA';
      if (det.impostos && Array.isArray(det.impostos)) {
        det.impostos.forEach(imp => {
          ivaTotal += imp.valor_usd || 0;
          if (imp.valor_configurado) ivaLabel = `IVA ${imp.valor_configurado}%`;
        });
      }

      return {
        id: calc.id,
        calc,
        registo,
        mtowTon,
        tipoCode,
        vooLabel,
        aterragem,
        descolagem,
        txAterr,
        estacH: typeof estacH === 'string' ? parseFloat(estacH) || 0 : estacH,
        estacUsd,
        paxCount,
        paxUsd,
        outrasTarifas,
        recursos,
        ivaTotal,
        ivaLabel,
        totalUsd: calc.total_tarifa_usd || 0,
        totalAoa: calc.total_tarifa || 0,
        proforma: proformasMap.get(calc.id) || null,
        dataOp: voo?.data_operacao || vooDep?.data_operacao || '',
        companhia_id: calc.companhia_id,
        companhiaNomeRow: companhias.find(c => c.id === calc.companhia_id)?.nome || vooDep?.companhia_aerea || '—',
      };
    });
  }, [calculos, voos, voosLigados, proformasMap, companhias]);

  // Group rows by companhia (for "Todas" mode)
  const rowsByCompanhia = useMemo(() => {
    if (!isTodasCompanhias) return null;
    const groups = new Map();
    rows.forEach(r => {
      const key = r.companhia_id || '_sem';
      if (!groups.has(key)) groups.set(key, { nome: r.companhiaNomeRow, rows: [] });
      groups.get(key).rows.push(r);
    });
    return Array.from(groups.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [rows, isTodasCompanhias]);

  // Discover dynamic columns
  const dynamicCols = useMemo(() => {
    const outraKeys = new Set();
    const recursoKeys = new Set();
    rows.forEach(r => {
      Object.keys(r.outrasTarifas).forEach(k => outraKeys.add(k));
      Object.keys(r.recursos).forEach(k => recursoKeys.add(k));
    });
    return {
      outras: Array.from(outraKeys).sort(),
      recursos: ['PCA', 'GPU', 'PBB'].filter(k => recursoKeys.has(k)),
    };
  }, [rows]);

  // KPIs
  const kpis = useMemo(() => {
    if (rows.length === 0) return null;
    const totalUsd = rows.reduce((s, r) => s + r.totalUsd, 0);
    const totalAoa = rows.reduce((s, r) => s + r.totalAoa, 0);
    const totalIva = rows.reduce((s, r) => s + r.ivaTotal, 0);
    const totalPouso = rows.reduce((s, r) => s + r.txAterr, 0);
    const totalEstac = rows.reduce((s, r) => s + r.estacUsd, 0);
    const totalPax = rows.reduce((s, r) => s + r.paxUsd, 0);
    const avgCambio = rows.reduce((s, r) => s + (r.calc.taxa_cambio_usd_aoa || 0), 0) / rows.length;
    const totalPaxCount = rows.reduce((s, r) => s + r.paxCount, 0);
    return { totalUsd, totalAoa, totalIva, totalPouso, totalEstac, totalPax, avgCambio, totalPaxCount, count: rows.length };
  }, [rows]);

  // Totals row
  const totals = useMemo(() => {
    if (rows.length === 0) return null;
    const t = {
      txAterr: 0, estacUsd: 0, paxUsd: 0, ivaTotal: 0, totalUsd: 0,
      outras: {}, recursos: {},
    };
    dynamicCols.outras.forEach(k => t.outras[k] = 0);
    dynamicCols.recursos.forEach(k => t.recursos[k] = 0);

    rows.forEach(r => {
      t.txAterr += r.txAterr;
      t.estacUsd += r.estacUsd;
      t.paxUsd += r.paxUsd;
      t.ivaTotal += r.ivaTotal;
      t.totalUsd += r.totalUsd;
      dynamicCols.outras.forEach(k => t.outras[k] += (r.outrasTarifas[k] || 0));
      dynamicCols.recursos.forEach(k => t.recursos[k] += (r.recursos[k]?.usd || 0));
    });
    return t;
  }, [rows, dynamicCols]);

  // PDF export
  const handleExportPdf = async () => {
    if (rows.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const { gerarRelatorioFaturacaoPdf } = await import('@/functions/gerarProformaPdfSimples');
      const companhia = companhias.find(c => c.id === filtro.companhia_id);
      const aeroporto = filtro.aeroporto_id ? aeroportos.find(a => a.id === filtro.aeroporto_id) : null;
      const pdfParams = {
        calculos, companhia, aeroporto,
        periodo_inicio: filtro.data_inicio, periodo_fim: filtro.data_fim,
        voos, voosLigados, proformasMap,
      };
      // Grouped mode: pass groups for "Todas as Companhias"
      if (isTodasCompanhias && rowsByCompanhia) {
        pdfParams.groupedByCompanhia = rowsByCompanhia.map(g => ({
          nome: g.nome,
          companhia: companhias.find(c => c.nome === g.nome),
          calculos: g.rows.map(r => r.calc),
        }));
      }
      await gerarRelatorioFaturacaoPdf(pdfParams);
      toast({ title: t('dashFat.pdfGerado'), description: t('dashFat.pdfGeradoDesc') });
    } catch (error) {
      console.error('Erro PDF:', error);
      toast({ title: t('shared.erro'), description: t('dashFat.erroPdf'), variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // XLSX export
  const handleExportXlsx = () => {
    if (rows.length === 0) return;
    const data = rows.map((r, idx) => {
      const row = {
        'Nº': idx + 1,
        'Registo': r.registo,
        'PMD(t)': Math.round(r.mtowTon),
        'Tipo': r.tipoCode,
        'Voo (A/D)': r.vooLabel,
        'Aterragem': r.aterragem,
        'Descolagem': r.descolagem,
        'TX Aterr. (USD)': Number(r.txAterr.toFixed(2)),
        'Estac. (h)': Number((typeof r.estacH === 'number' ? r.estacH : 0).toFixed(1)),
        'Estac. (USD)': Number(r.estacUsd.toFixed(2)),
        'Emb. (pax)': r.paxCount,
        'Emb. (USD)': Number(r.paxUsd.toFixed(2)),
      };
      dynamicCols.outras.forEach(k => { row[k + ' (USD)'] = Number((r.outrasTarifas[k] || 0).toFixed(2)); });
      dynamicCols.recursos.forEach(k => {
        row[k + ' (h)'] = Number((r.recursos[k]?.horas || 0).toFixed(1));
        row[k + ' (USD)'] = Number((r.recursos[k]?.usd || 0).toFixed(2));
      });
      row[r.ivaLabel] = Number(r.ivaTotal.toFixed(2));
      row['TOTAL (USD)'] = Number(r.totalUsd.toFixed(2));
      row['Proforma'] = r.proforma || '';
      return row;
    });

    const comp = companhias.find(c => c.id === filtro.companhia_id);
    const filename = `extrato_faturacao_${comp?.codigo_icao || 'ALL'}_${new Date().toISOString().split('T')[0]}`;
    downloadAsExcel(data, filename);
    toast({ title: t('dashFat.xlsxGerado'), description: t('dashFat.xlsxGeradoDesc') });
  };

  // Email with PDF
  const handlePrepareEmail = async () => {
    if (rows.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const { gerarRelatorioFaturacaoPdf } = await import('@/functions/gerarProformaPdfSimples');
      const companhia = companhias.find(c => c.id === filtro.companhia_id);
      const aeroporto = filtro.aeroporto_id ? aeroportos.find(a => a.id === filtro.aeroporto_id) : null;
      const emailPdfParams = {
        calculos, companhia, aeroporto,
        periodo_inicio: filtro.data_inicio, periodo_fim: filtro.data_fim,
        voos, voosLigados, proformasMap,
        returnBase64: true,
      };
      if (isTodasCompanhias && rowsByCompanhia) {
        emailPdfParams.groupedByCompanhia = rowsByCompanhia.map(g => ({
          nome: g.nome,
          companhia: companhias.find(c => c.nome === g.nome),
          calculos: g.rows.map(r => r.calc),
        }));
      }
      const result = await gerarRelatorioFaturacaoPdf(emailPdfParams);
      setPdfForEmail(result);
      setIsEmailModalOpen(true);
    } catch (error) {
      console.error('Erro ao preparar email:', error);
      toast({ title: t('shared.erro'), description: t('dashFat.erroPdfEmail'), variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendEmail = async ({ to, subject, message }) => {
    if (!pdfForEmail) return;
    setIsSendingEmail(true);
    try {
      const { sendEmailDirect } = await import('@/functions/sendEmailDirect');
      await sendEmailDirect({
        to, subject,
        body: message || 'Segue em anexo o Extrato de Facturação.',
        html: `<p>${message || 'Segue em anexo o Extrato de Facturação.'}</p>`,
        attachments: [{ filename: pdfForEmail.filename, content: pdfForEmail.base64, contentType: 'application/pdf' }],
      });
      toast({ title: t('dashFat.emailEnviado'), description: `${t('dashFat.emailEnviadoPara')} ${to}` });
      setIsEmailModalOpen(false);
      setPdfForEmail(null);
    } catch (error) {
      console.error('Erro email:', error);
      toast({ title: t('shared.erro'), description: `${t('shared.erro')}: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const companhiaOptions = [
    { value: '_todas', label: '— Todas as Companhias —' },
    ...companhias
      .filter(c => companhiasComTarifas.has(c.id))
      .map(c => ({ value: c.id, label: `${c.nome} (${c.codigo_icao})` })),
  ];
  const aeroportoOptions = [
    { value: '', label: t('dashFat.todosAeroportos') },
    ...aeroportos.map(a => ({ value: a.id, label: `${a.nome} (${a.codigo_icao})` })),
  ];

  const companhiaNome = filtro.companhia_id === '_todas' ? 'Todas as Companhias' : (companhias.find(c => c.id === filtro.companhia_id)?.nome || '');

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-600" />
            {t('dashFat.filtrosExtrato')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('dashFat.companhia')} <span className="text-red-500">*</span></Label>
              <Select
                options={companhiaOptions}
                value={filtro.companhia_id}
                onValueChange={v => setFiltro(p => ({ ...p, companhia_id: v }))}
                placeholder={t('dashFat.selecionar')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('dashFat.aeroporto')}</Label>
              <Select
                options={aeroportoOptions}
                value={filtro.aeroporto_id}
                onValueChange={v => setFiltro(p => ({ ...p, aeroporto_id: v }))}
                placeholder={t('dashFat.todos')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('dashFat.dataInicio')}</Label>
              <Input type="date" value={filtro.data_inicio} onChange={e => setFiltro(p => ({ ...p, data_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('dashFat.dataFim')}</Label>
              <Input type="date" value={filtro.data_fim} onChange={e => setFiltro(p => ({ ...p, data_fim: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleBuscar}
                disabled={!filtro.companhia_id || isSearching}
                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
              >
                {isSearching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('dashFat.buscando')}</> : <><Search className="mr-2 h-4 w-4" /> {t('dashFat.buscar')}</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="bg-blue-50 p-2 rounded-lg"><Plane className="w-4 h-4 text-blue-600" /></div>
              <div><p className="text-[11px] text-slate-500">{t('dashFat.voos')}</p><p className="text-lg font-bold">{kpis.count}</p></div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="bg-green-50 p-2 rounded-lg"><DollarSign className="w-4 h-4 text-green-600" /></div>
              <div><p className="text-[11px] text-slate-500">{t('dashFat.totalUSD')}</p><p className="text-sm font-bold text-green-700">${fmtNum(kpis.totalUsd)}</p></div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-50 p-2 rounded-lg"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
              <div><p className="text-[11px] text-slate-500">{t('dashFat.totalAOA')}</p><p className="text-sm font-bold text-emerald-700">{fmtNum(kpis.totalAoa)} Kz</p></div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="bg-amber-50 p-2 rounded-lg"><TrendingUp className="w-4 h-4 text-amber-600" /></div>
              <div><p className="text-[11px] text-slate-500">{t('dashFat.txAterr')}</p><p className="text-sm font-bold text-amber-700">${fmtNum(kpis.totalPouso)}</p></div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="bg-purple-50 p-2 rounded-lg"><Clock className="w-4 h-4 text-purple-600" /></div>
              <div><p className="text-[11px] text-slate-500">{t('dashFat.estacionamento')}</p><p className="text-sm font-bold text-purple-700">${fmtNum(kpis.totalEstac)}</p></div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="bg-cyan-50 p-2 rounded-lg"><BarChart3 className="w-4 h-4 text-cyan-600" /></div>
              <div><p className="text-[11px] text-slate-500">{t('dashFat.cambioMedio')}</p><p className="text-sm font-bold text-cyan-700">{Math.round(kpis.avgCambio)} AOA</p></div>
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* Actions bar */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={handleExportXlsx} size="sm">
            <Download className="w-4 h-4 mr-1" /> {t('dashFat.exportarXLSX')}
          </Button>
          <Button variant="outline" onClick={handlePrepareEmail} disabled={isGeneratingPdf} size="sm"
            className="border-blue-300 text-blue-700 hover:bg-blue-50">
            {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
            {t('dashFat.enviarEmail')}
          </Button>
          <Button onClick={handleExportPdf} disabled={isGeneratingPdf} size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
            {t('dashFat.exportarPDF')}
          </Button>
        </div>
      )}

      {/* Table(s) */}
      {hasSearched && (isSearching ? (
        <Card><CardContent className="p-4"><div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div></CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-slate-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
          <p className="font-medium">{t('dashFat.nenhumVoo')}</p>
          <p className="text-xs mt-1">{t('dashFat.nenhumVooDesc')}</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Render grouped tables (one per companhia) or single table */}
          {(rowsByCompanhia || [{ nome: companhiaNome, rows }]).map((group, gi) => {
            // Calculate totals for this group
            const groupTotals = { txAterr: 0, estacUsd: 0, paxUsd: 0, ivaTotal: 0, totalUsd: 0, outras: {}, recursos: {} };
            dynamicCols.outras.forEach(k => groupTotals.outras[k] = 0);
            dynamicCols.recursos.forEach(k => groupTotals.recursos[k] = 0);
            group.rows.forEach(r => {
              groupTotals.txAterr += r.txAterr;
              groupTotals.estacUsd += r.estacUsd;
              groupTotals.paxUsd += r.paxUsd;
              groupTotals.ivaTotal += r.ivaTotal;
              groupTotals.totalUsd += r.totalUsd;
              dynamicCols.outras.forEach(k => groupTotals.outras[k] += (r.outrasTarifas[k] || 0));
              dynamicCols.recursos.forEach(k => groupTotals.recursos[k] += (r.recursos[k]?.usd || 0));
            });
            const fixedCols = 8; // Nº + Registo + PMD + Tipo + Voo + Aterr + Desc + TxAterr

            return (
        <Card key={gi} className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">
                {t('dashFat.extratoFaturacao')} — {group.nome}
              </CardTitle>
              <Badge variant="outline">{group.rows.length} {t('dashFat.voosCount')}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="text-[11px] w-max">
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-center w-8">Nº</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5">{t('dashFat.colRegisto')}</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">PMD(t)</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5">{t('dashFat.colTipo')}</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5">{t('dashFat.colVoo')}</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5">{t('dashFat.colAterragem')}</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5">{t('dashFat.colDescolagem')}</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">TX Aterr.</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">Estac.(h)</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">Estac.($)</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">Emb.(pax)</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">Emb.($)</TableHead>
                      {dynamicCols.outras.map(k => (
                        <TableHead key={k} className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">{k}</TableHead>
                      ))}
                      {dynamicCols.recursos.map(k => (
                        <React.Fragment key={k}>
                          <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">{k}(h)</TableHead>
                          <TableHead className="text-[10px] font-semibold whitespace-nowrap px-1.5 text-right">{k}($)</TableHead>
                        </React.Fragment>
                      ))}
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-2 text-right">IVA</TableHead>
                      <TableHead className="text-[10px] font-semibold whitespace-nowrap px-2 text-right bg-emerald-50 sticky right-0 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]">TOTAL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((r, idx) => (
                      <TableRow key={r.id} className="hover:bg-slate-50">
                        <TableCell className="px-1.5 text-center text-slate-400">{idx + 1}</TableCell>
                        <TableCell className="font-mono px-2 whitespace-nowrap">{r.registo}</TableCell>
                        <TableCell className="px-1.5 text-right">{fmtNum(r.mtowTon, 0)}</TableCell>
                        <TableCell className="px-1.5">
                          <Badge variant="outline" className={`text-[9px] px-1 ${r.tipoCode === 'INT' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'}`}>
                            {r.tipoCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono px-2 whitespace-nowrap">{r.vooLabel}</TableCell>
                        <TableCell className="px-1.5 whitespace-nowrap">{r.aterragem}</TableCell>
                        <TableCell className="px-1.5 whitespace-nowrap">{r.descolagem}</TableCell>
                        <TableCell className="px-1.5 text-right font-medium">{fmtNum(r.txAterr)}</TableCell>
                        <TableCell className="px-1.5 text-right">{fmtNum(r.estacH, 1)}</TableCell>
                        <TableCell className="px-1.5 text-right font-medium">{fmtNum(r.estacUsd)}</TableCell>
                        <TableCell className="px-1.5 text-right">{r.paxCount || '—'}</TableCell>
                        <TableCell className="px-1.5 text-right font-medium">{fmtNum(r.paxUsd)}</TableCell>
                        {dynamicCols.outras.map(k => (
                          <TableCell key={k} className="px-2 text-right">{r.outrasTarifas[k] ? fmtNum(r.outrasTarifas[k]) : '—'}</TableCell>
                        ))}
                        {dynamicCols.recursos.map(k => (
                          <React.Fragment key={k}>
                            <TableCell className="px-1.5 text-right">{r.recursos[k] ? fmtNum(r.recursos[k].horas, 1) : '—'}</TableCell>
                            <TableCell className="px-1.5 text-right font-medium">{r.recursos[k] ? fmtNum(r.recursos[k].usd) : '—'}</TableCell>
                          </React.Fragment>
                        ))}
                        <TableCell className="px-1.5 text-right">{fmtNum(r.ivaTotal)}</TableCell>
                        <TableCell className="px-1.5 text-right font-bold text-emerald-700 bg-emerald-50 sticky right-0 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]">{fmtNum(r.totalUsd)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Subtotals row */}
                    <TableRow className="bg-slate-100 font-bold border-t-2">
                        <TableCell colSpan={fixedCols} className="px-2 text-right text-xs">{t('dashFat.totais')}</TableCell>
                        <TableCell className="px-1.5" />
                        <TableCell className="px-1.5 text-right">{fmtNum(groupTotals.estacUsd)}</TableCell>
                        <TableCell className="px-1.5" />
                        <TableCell className="px-1.5 text-right">{fmtNum(groupTotals.paxUsd)}</TableCell>
                        {dynamicCols.outras.map(k => (
                          <TableCell key={k} className="px-2 text-right">{fmtNum(groupTotals.outras[k])}</TableCell>
                        ))}
                        {dynamicCols.recursos.map(k => (
                          <React.Fragment key={k}>
                            <TableCell className="px-1.5" />
                            <TableCell className="px-1.5 text-right">{fmtNum(groupTotals.recursos[k])}</TableCell>
                          </React.Fragment>
                        ))}
                        <TableCell className="px-1.5 text-right">{fmtNum(groupTotals.ivaTotal)}</TableCell>
                        <TableCell className="px-1.5 text-right text-emerald-700 bg-emerald-100 text-sm sticky right-0 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]">${fmtNum(groupTotals.totalUsd)}</TableCell>
                      </TableRow>
                  </TableBody>
                </Table>
              </div>
          </CardContent>
        </Card>
            );
          })}

          {/* Grand total for "Todas" mode */}
          {isTodasCompanhias && rowsByCompanhia && rowsByCompanhia.length > 1 && (
            <Card className="border-emerald-300 bg-emerald-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-800 text-lg">TOTAL GERAL</span>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-700">${fmtNum(totals?.totalUsd)}</p>
                    <p className="text-sm text-emerald-600">{fmtNum(totals?.totalUsd * (rows[0]?.calc?.taxa_cambio_usd_aoa || 900))} Kz</p>
                    <p className="text-xs text-slate-500">{rows.length} voos de {rowsByCompanhia.length} companhias</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ))}

      {/* Email Modal */}
      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => { setIsEmailModalOpen(false); setPdfForEmail(null); }}
        onSend={handleSendEmail}
        isSending={isSendingEmail}
        defaultSubject={`Extrato de Facturação — ${companhiaNome}`}
        defaultBody="Segue em anexo o Extrato de Facturação."
      />
    </div>
  );
}
