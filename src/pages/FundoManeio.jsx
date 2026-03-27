import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Filter, Plus, RefreshCw, FileDown, FileText, X, Trash2, Download, Pencil, Search, Loader2 } from 'lucide-react';
import Combobox from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

import SortableTableHeader from '@/components/shared/SortableTableHeader';

import { useQueryClient } from '@tanstack/react-query';
import { MovimentoFinanceiro } from '@/entities/MovimentoFinanceiro';
import { Aeroporto } from '@/entities/Aeroporto';
import { useMovimentosFinanceiros } from '@/hooks/useMovimentosFinanceiros';
const MovimentosFinanceirosChart = React.lazy(() => import('../components/financeiro/MovimentosFinanceirosChart'));
import FormMovimentoFinanceiro from '../components/financeiro/FormMovimentoFinanceiro';
import { downloadAsCSV } from '../components/lib/export';
import AlertModal from '../components/shared/AlertModal';
import SendEmailModal from '../components/shared/SendEmailModal';
import { registarExclusao, registarExportacao } from '../components/lib/auditoria';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { getAeroportosPermitidos, getEmpresaLogoByUser } from '@/components/lib/userUtils';
import { createPdfDoc, addHeader, addFooter, addTable, loadImageAsBase64 } from '@/lib/pdfTemplate';
import { Empresa } from '@/entities/Empresa';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

const RecentMovimentosFinanceiros = ({ movimentos, t }) => (
  <Card className="border-0 shadow-sm">
    <CardHeader><CardTitle className="text-lg">{t('fundo.recent_movements')}</CardTitle></CardHeader>
    <CardContent>
      {movimentos.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{t('fundo.no_recent')}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {movimentos.map((mov) => (
            <li key={mov.id} className="flex justify-between items-center border-b pb-2 last:border-b-0 last:pb-0">
              <div className="flex-1">
                <p className="font-medium">{mov.descricao}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{new Date(mov.data).toLocaleDateString('pt-AO')} - {mov.categoria}</p>
              </div>
              <span className={`font-semibold ${mov.tipo === 'receita' ? 'text-emerald-600' : 'text-red-600 dark:text-red-400'}`}>
                {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(mov.valor_kz)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

export default function FundoManeio() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const empId = currentUser?.empresa_id;

  // Primary data via TanStack Query
  const { data: movimentosRaw = [], isLoading: isQueryLoading } = useMovimentosFinanceiros({ empresaId: empId });

  // Secondary data: aeroportos, empresas (kept as useState per instructions)
  const [aeroportos, setAeroportos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);

  // Derive filtered movimentos from query data + aeroportos
  const movimentos_derived = useMemo(() => {
    if (!secondaryLoaded) return [];
    const userAccessibleAirportIds = aeroportos.map(a => a.id);
    return movimentosRaw.filter(m => userAccessibleAirportIds.includes(m.aeroporto_id));
  }, [movimentosRaw, aeroportos, secondaryLoaded]);

  // Search override for handleBuscar
  const [searchOverride, setSearchOverride] = useState(null);
  const movimentos = searchOverride !== null ? searchOverride : movimentos_derived;
  const isLoading = isQueryLoading && !secondaryLoaded;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMovimento, setEditingMovimento] = useState(null);
  const [selectedMovimentos, setSelectedMovimentos] = useState([]);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, entity: null, id: null });
  const [emailModal, setEmailModal] = useState({ isOpen: false, subject: '', data: null });

  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    dataInicio: '',
    dataFim: '',
    categoria: 'todos',
    tipo: 'todos',
    busca: ''
  });

  const [sortField, setSortField] = useState('data');
  const [sortDirection, setSortDirection] = useState('desc');

  // Load secondary data on mount
  useEffect(() => {
    (async () => {
      try {
        const [aeroportosData, empresasData] = await Promise.all([
          empId ? Aeroporto.filter({ empresa_id: empId }) : Aeroporto.list(),
          Empresa.list()
        ]);
        setEmpresas(empresasData || []);
        const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');
        const userAccessibleAeroportos = getAeroportosPermitidos(currentUser, aeroportosAngola, empId);
        setAeroportos(userAccessibleAeroportos);
        setSecondaryLoaded(true);
      } catch (error) {
        console.error("Erro ao carregar dados do fundo de maneio:", error);
        setAlertInfo({ isOpen: true, type: 'error', title: t('fundo.error_load_title'), message: t('fundo.error_load_msg') });
      }
    })();
  }, []);

  const loadData = useCallback(() => {
    setSearchOverride(null);
    queryClient.invalidateQueries({ queryKey: ['movimentos-financeiros', empId] });
  }, [empId, queryClient]);

  const [isSearching, setIsSearching] = useState(false);

  const handleBuscar = async () => {
    setIsSearching(true);
    try {
      const query = {};
      if (empId) query.empresa_id = empId;
      if (filtros.aeroporto !== 'todos') query.aeroporto_id = filtros.aeroporto;
      if (filtros.categoria !== 'todos') query.categoria = filtros.categoria;
      if (filtros.tipo !== 'todos') query.tipo = filtros.tipo;
      if (filtros.dataInicio) query.data = { ...query.data, $gte: filtros.dataInicio };
      if (filtros.dataFim) query.data = { ...query.data, $lte: filtros.dataFim };
      if (filtros.busca) query.descricao = { $ilike: `%${filtros.busca}%` };

      const data = await MovimentoFinanceiro.filter(query, '-data');

      // Still respect airport-level access
      const userAccessibleAirportIds = aeroportos.map(a => a.id);
      setSearchOverride(data.filter(m => userAccessibleAirportIds.includes(m.aeroporto_id)));
    } catch (err) {
      console.error('Erro ao buscar movimentos:', err);
      setAlertInfo({ isOpen: true, type: 'error', title: t('fundo.error_load_title'), message: t('fundo.error_load_msg') });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSort = useCallback((field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  const handleFormSubmit = async (data) => {
    try {
      if (editingMovimento) {
        await MovimentoFinanceiro.update(editingMovimento.id, data);
      } else {
        await MovimentoFinanceiro.create(data);
      }
      setIsFormOpen(false);
      setEditingMovimento(null);
      loadData();
      setAlertInfo({ isOpen: true, type: 'success', title: t('fundo.success_title'), message: t('fundo.success_save_msg') });
    } catch (error) {
      console.error('Erro ao submeter formulário:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: t('fundo.error_title'), message: t('fundo.error_save_msg') });
    }
  };

  const handleOpenForm = (item = null) => {
    setEditingMovimento(item);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id) => {
    setDeleteInfo({ isOpen: true, entity: 'MovimentoFinanceiro', id });
  };

  const handleDeleteConfirm = async () => {
    const { id } = deleteInfo;
    if (!id) return;

    try {
      const dadosParaAuditoria = movimentos.find(m => m.id === id);
      if (!dadosParaAuditoria) {
        setAlertInfo({ isOpen: true, type: 'warning', title: t('fundo.not_found_title'), message: t('fundo.not_found_msg') });
        loadData();
        setDeleteInfo({ isOpen: false, entity: null, id: null });
        return;
      }
      await MovimentoFinanceiro.delete(id);
      await registarExclusao('MovimentoFinanceiro', dadosParaAuditoria, 'financeiro');
      setAlertInfo({ isOpen: true, type: 'success', title: t('fundo.success_title'), message: t('fundo.success_delete_msg') });
      loadData();
    } catch (error) {
      console.error('Erro ao excluir movimento:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: t('fundo.error_delete_title'), message: t('fundo.error_delete_msg') });
    } finally {
      setDeleteInfo({ isOpen: false, entity: null, id: null });
    }
  };

  const handleFilterChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFiltros({ aeroporto: 'todos', dataInicio: '', dataFim: '', categoria: 'todos', tipo: 'todos', busca: '' });
    setSearchOverride(null);
  };

  const hasActiveFilters = filtros.dataInicio !== '' || filtros.dataFim !== '' ||
                          filtros.categoria !== 'todos' || filtros.tipo !== 'todos' ||
                          filtros.aeroporto !== 'todos' || filtros.busca !== '';

  const filteredMovimentos = useMemo(() => {
    const sorted = [...movimentos];
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'data') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime(); }
      else if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [movimentos, sortField, sortDirection]);

  const handleSelectMovimento = (id, checked) => {
    setSelectedMovimentos(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAllMovimentos = (checked) => {
    setSelectedMovimentos(checked ? filteredMovimentos.map(m => m.id) : []);
  };

  const movimentosParaAcao = useMemo(() => {
    return selectedMovimentos.length > 0
      ? movimentos.filter(m => selectedMovimentos.includes(m.id))
      : filteredMovimentos;
  }, [selectedMovimentos, movimentos, filteredMovimentos]);

  const handleExportCSV = async () => {
    const dataToExport = movimentosParaAcao.map(mov => ({
      [t('fundo.col_date')]: mov.data,
      [t('fundo.col_type')]: mov.tipo,
      [t('fundo.col_category')]: mov.categoria,
      [t('fundo.col_description')]: mov.descricao,
      [t('fundo.col_value')]: mov.valor_kz,
      [t('fundo.col_airport')]: aeroportos.find(a => a.id === mov.aeroporto_id)?.nome || mov.aeroporto_id
    }));
    await registarExportacao('MovimentoFinanceiro', 'CSV', filtros, 'financeiro');
    downloadAsCSV(dataToExport, `relatorio_fundo_maneio_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = async () => {
    try {
      await registarExportacao('MovimentoFinanceiro', 'PDF', filtros, 'financeiro');

      const doc = await createPdfDoc({ orientation: 'portrait' });
      const { totalReceitas, totalDespesas, saldo } = kpiData;
      const fmt = (v) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(v);

      let logoBase64 = null;
      try { logoBase64 = await loadImageAsBase64(getEmpresaLogoByUser(currentUser, empresas)); } catch {}

      const headerOpts = {
        title: t('fundo.report_title'),
        logoBase64,
        date: new Date().toLocaleDateString('pt-AO'),
        meta: [
          `${t('fundo.total_revenue')}: ${fmt(totalReceitas)}`,
          `${t('fundo.total_expenses')}: ${fmt(totalDespesas)}`,
          `${t('fundo.balance')}: ${fmt(saldo)}`,
        ],
      };
      let y = addHeader(doc, headerOpts);

      const columns = [
        { label: t('fundo.col_date'), width: 30 },
        { label: t('fundo.col_type'), width: 30 },
        { label: t('fundo.col_category'), width: 45 },
        { label: t('fundo.col_airport'), width: 40 },
        { label: t('fundo.col_value'), width: 35, align: 'right' },
      ];

      const rows = movimentosParaAcao.map((movimento) => {
        const aeroportoNome = aeroportos.find(a => a.id === movimento.aeroporto_id)?.nome || movimento.aeroporto_id;
        return [
          new Date(movimento.data).toLocaleDateString('pt-AO'),
          movimento.tipo.toUpperCase(),
          movimento.categoria,
          aeroportoNome,
          fmt(movimento.valor_kz),
        ];
      });

      addTable(doc, y, { columns, rows, headerOpts });
      addFooter(doc, { generatedBy: currentUser?.full_name || currentUser?.email });
      doc.save(`relatorio_fundo_maneio_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: t('fundo.error_export_title'), message: t('fundo.error_export_msg') });
    }
  };

  const handleSendEmail = async (to, subject) => {
    try {
      const emailData = movimentosParaAcao.map(mov => ({
        [t('fundo.col_date')]: mov.data,
        [t('fundo.col_type')]: mov.tipo,
        [t('fundo.col_category')]: mov.categoria,
        [t('fundo.col_description')]: mov.descricao,
        [t('fundo.col_value')]: new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(mov.valor_kz),
        [t('fundo.col_airport')]: aeroportos.find(a => a.id === mov.aeroporto_id)?.nome || mov.aeroporto_id
      }));

      const { totalReceitas, totalDespesas, saldo } = kpiData;

      let emailBody = `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">`;
      emailBody += `<div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">`;
      emailBody += `<h1 style="margin: 0; font-size: 28px; font-weight: bold;">${t('fundo.report_heading')}</h1>`;
      emailBody += `<p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Gerado em ${new Date().toLocaleDateString('pt-AO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`;
      emailBody += `</div>`;

      emailBody += `<div style="background: #f8fafc; padding: 25px; border-left: 4px solid #10b981;">`;
      emailBody += `<h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px;">${t('fundo.financial_summary')}</h2>`;
      emailBody += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">`;
      emailBody += `<div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;"><p style="margin: 0; font-size: 14px; color: #6b7280;">${t('fundo.total_revenue')}</p><p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #10b981;">${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totalReceitas)}</p></div>`;
      emailBody += `<div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;"><p style="margin: 0; font-size: 14px; color: #6b7280;">${t('fundo.total_expenses')}</p><p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #ef4444;">${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totalDespesas)}</p></div>`;
      emailBody += `<div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid ${saldo >= 0 ? '#3b82f6' : '#ef4444'};"><p style="margin: 0; font-size: 14px; color: #6b7280;">${t('fundo.balance')}</p><p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: ${saldo >= 0 ? '#3b82f6' : '#ef4444'};">${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(saldo)}</p></div>`;
      emailBody += `</div></div>`;

      emailBody += `<div style="background: white; padding: 25px;">`;
      emailBody += `<h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px;">Movimentos (${movimentosParaAcao.length} ${t('fundo.movements_count')})</h2>`;

      if (movimentosParaAcao.length > 0) {
        emailBody += `<table style="width: 100%; border-collapse: collapse; margin-top: 15px;">`;
        emailBody += `<thead><tr style="background: #f1f5f9;">`;
        emailBody += `<th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">${t('fundo.col_date')}</th>`;
        emailBody += `<th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">${t('fundo.col_type')}</th>`;
        emailBody += `<th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">${t('fundo.col_category')}</th>`;
        emailBody += `<th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">${t('fundo.col_airport')}</th>`;
        emailBody += `<th style="padding: 12px; text-align: right; border: 1px solid #e2e8f0;">${t('fundo.col_value')}</th>`;
        emailBody += `</tr></thead><tbody>`;
        emailData.slice(0, 50).forEach((mov, index) => {
          const bgColor = index % 2 === 0 ? 'white' : '#f8fafc';
          const tipoColor = mov[t('fundo.col_type')] === 'receita' ? '#10b981' : '#ef4444';
          emailBody += `<tr style="background: ${bgColor};">`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0;">${new Date(mov[t('fundo.col_date')]).toLocaleDateString('pt-AO')}</td>`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0;"><span style="background: ${tipoColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${mov[t('fundo.col_type')].toUpperCase()}</span></td>`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0;">${mov[t('fundo.col_category')]}</td>`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0;">${mov[t('fundo.col_airport')]}</td>`;
          emailBody += `<td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: ${tipoColor};">${mov[t('fundo.col_value')]}</td>`;
          emailBody += `</tr>`;
          if (mov[t('fundo.col_description')]) {
            emailBody += `<tr style="background: ${bgColor};"><td colspan="5" style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #6b7280; font-style: italic;">${mov[t('fundo.col_description')]}</td></tr>`;
          }
        });
        emailBody += `</tbody></table>`;
        if (movimentosParaAcao.length > 50) {
          emailBody += `<p style="margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 6px; color: #92400e; font-size: 14px;"><strong>Nota:</strong> ${t('fundo.note_first_50')} ${movimentosParaAcao.length}</p>`;
        }
      } else {
        emailBody += `<p style="text-align: center; color: #6b7280; font-style: italic;">${t('fundo.no_movements_found')}</p>`;
      }
      emailBody += `</div>`;

      emailBody += `<div style="background: #1f2937; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">`;
      emailBody += `<p style="margin: 0; font-size: 14px; opacity: 0.8;">${t('fundo.generated_by')}</p>`;
      emailBody += `</div></div>`;

      await sendEmailDirect({
        to,
        subject: subject || `Relatório Fundo de Maneio - ${new Date().toLocaleDateString('pt-AO')}`,
        body: emailBody,
        from_name: 'DIROPS'
      });
      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return false;
    }
  };

  const kpiData = useMemo(() => {
    const totalReceitas = filteredMovimentos.filter(m => m.tipo === 'receita').reduce((sum, m) => sum + m.valor_kz, 0);
    const totalDespesas = filteredMovimentos.filter(m => m.tipo === 'despesa').reduce((sum, m) => sum + m.valor_kz, 0);
    return { totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas };
  }, [filteredMovimentos]);

  const chartData = useMemo(() => {
    return Object.values(filteredMovimentos.reduce((acc, mov) => {
      const monthYear = new Date(mov.data).toISOString().slice(0, 7);
      if (!acc[monthYear]) acc[monthYear] = { mesAno: monthYear, receita: 0, despesa: 0 };
      acc[monthYear][mov.tipo] += mov.valor_kz;
      return acc;
    }, {}));
  }, [filteredMovimentos]);

  const aeroportoOptions = useMemo(() => ([
    { value: 'todos', label: t('fundo.all_airports') },
    ...aeroportos.map(a => ({ value: a.id, label: a.nome }))
  ]), [aeroportos, t]);

  const tipoOptions = [
    { value: 'todos', label: t('fundo.all_types') },
    { value: 'receita', label: t('fundo.type_revenue') },
    { value: 'despesa', label: t('fundo.type_expense') },
  ];

  const categoriaOptions = [
    { value: 'todos', label: t('fundo.all_categories') },
    { value: 'Apoio Financeiro', label: t('fundo.cat_apoio_financeiro') },
    { value: 'Engenharia/Manutenção', label: t('fundo.cat_engenharia') },
    { value: 'Operações', label: t('fundo.cat_operacoes') },
    { value: 'SGSO', label: t('fundo.cat_sgso') },
    { value: 'Segurança', label: t('fundo.cat_seguranca') },
    { value: 'Resposta a Emergência', label: t('fundo.cat_emergencia') },
  ];

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <DollarSign className="w-6 md:w-8 h-6 md:h-8 text-emerald-600" />
              {t('page.fundo_maneio.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.fundo_maneio.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('fundo.refresh')}
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Download className="w-4 h-4 mr-2" />
              {t('fundo.export_csv')}
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileText className="w-4 h-4 mr-2" />
              {t('fundo.export_pdf')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setEmailModal({ isOpen: true, subject: `Relatório Fundo de Maneio - ${new Date().toLocaleDateString('pt-AO')}`, data: filteredMovimentos })}
              className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FileDown className="w-4 h-4 mr-2" />
              {t('fundo.send_email')}
            </Button>
            <Button onClick={() => handleOpenForm()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t('fundo.new_movement')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('fundo.total_revenue')}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(kpiData.totalReceitas)}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('fundo.total_expenses')}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600 dark:text-red-400">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(kpiData.totalDespesas)}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('fundo.balance')}</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${kpiData.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(kpiData.saldo)}</div></CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                {t('fundo.filters')}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleBuscar} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                  {t('fundo.search_btn', 'Buscar')}
                </Button>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} disabled={isLoading} className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950">
                    <X className="w-4 h-4 mr-1" /> {t('fundo.clear_filters')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>{t('fundo.search')}</Label>
                <Input placeholder={t('fundo.search_placeholder')} value={filtros.busca} onChange={(e) => handleFilterChange('busca', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('fundo.airport')}</Label>
                <Combobox options={aeroportoOptions} value={filtros.aeroporto} onValueChange={(v) => handleFilterChange('aeroporto', v)} placeholder={t('fundo.airport_search')} searchPlaceholder={t('fundo.airport_search')} noResultsMessage={t('fundo.airport_no_results')} />
              </div>
              <div className="space-y-2">
                <Label>{t('fundo.type')}</Label>
                <Combobox options={tipoOptions} value={filtros.tipo} onValueChange={(v) => handleFilterChange('tipo', v)} placeholder={t('fundo.select_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('fundo.category')}</Label>
                <Combobox options={categoriaOptions} value={filtros.categoria} onValueChange={(v) => handleFilterChange('categoria', v)} placeholder={t('fundo.select_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('fundo.date_start')}</Label>
                <Input type="date" value={filtros.dataInicio} onChange={(e) => handleFilterChange('dataInicio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('fundo.date_end')}</Label>
                <Input type="date" value={filtros.dataFim} onChange={(e) => handleFilterChange('dataFim', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Movimentos */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t('fundo.movements_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedMovimentos.length === filteredMovimentos.length && filteredMovimentos.length > 0}
                        onCheckedChange={handleSelectAllMovimentos}
                      />
                    </TableHead>
                    <SortableTableHeader field="data" label={t('fundo.col_date')} currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHeader field="tipo" label={t('fundo.col_type')} currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHeader field="categoria" label={t('fundo.col_category')} currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHeader field="descricao" label={t('fundo.col_description')} currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} />
                    <TableHead>{t('fundo.col_airport')}</TableHead>
                    <SortableTableHeader field="valor_kz" label={t('fundo.col_value')} currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} className="text-right" />
                    <TableHead className="text-right">{t('fundo.col_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovimentos.map((movimento) => (
                    <TableRow key={movimento.id} data-state={selectedMovimentos.includes(movimento.id) ? "selected" : ""}>
                      <TableCell>
                        <Checkbox checked={selectedMovimentos.includes(movimento.id)} onCheckedChange={(checked) => handleSelectMovimento(movimento.id, checked)} />
                      </TableCell>
                      <TableCell>{new Date(movimento.data).toLocaleDateString('pt-AO')}</TableCell>
                      <TableCell>
                        <Badge className={movimento.tipo === 'receita' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}>
                          {movimento.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>{movimento.categoria}</TableCell>
                      <TableCell>{movimento.descricao}</TableCell>
                      <TableCell>{aeroportos.find(a => a.id === movimento.aeroporto_id)?.nome || movimento.aeroporto_id}</TableCell>
                      <TableCell className="text-right font-medium">
                        {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(movimento.valor_kz)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => handleOpenForm(movimento)}>
                            <Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900" onClick={() => handleDeleteClick(movimento.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-gray-400">Carregando gráfico...</div>}>
              <MovimentosFinanceirosChart data={chartData} />
            </Suspense>
          </div>
          <div>
            <RecentMovimentosFinanceiros movimentos={filteredMovimentos.slice(0, 10)} t={t} />
          </div>
        </div>
      </div>

      {/* Modais */}
      {isFormOpen && (
        <FormMovimentoFinanceiro
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingMovimento(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          movimentoInitial={editingMovimento}
          currentUser={currentUser}
        />
      )}

      <SendEmailModal
        isOpen={emailModal.isOpen}
        onClose={() => setEmailModal({ isOpen: false, subject: '', data: null })}
        onSend={handleSendEmail}
        defaultSubject={emailModal.subject}
        title={t('fundo.send_report_title')}
      />

      <AlertModal
        isOpen={deleteInfo.isOpen}
        onClose={() => setDeleteInfo({ isOpen: false, entity: null, id: null })}
        onConfirm={handleDeleteConfirm}
        type="warning"
        title={t('fundo.confirm_delete_title')}
        message={t('fundo.confirm_delete_msg')}
        confirmText={t('fundo.delete_btn')}
        showCancel
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
      />
    </div>
  );
}
