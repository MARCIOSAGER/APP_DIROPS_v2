
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Filter, FileDown, FileText, Mail, Search, Loader2, X } from 'lucide-react';
import Select from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { OcorrenciaSafety } from '@/entities/OcorrenciaSafety';
import { Aeroporto } from '@/entities/Aeroporto';
import { useOcorrencias } from '@/hooks/useOcorrencias';
import SafetyOccurrencesList from '../components/safety/SafetyOccurrencesList';
import FormSafetyOccurrence from '../components/safety/FormSafetyOccurrence';
import { downloadAsCSV } from '../components/lib/export';
import { createPdfDoc, addHeader, addFooter, addTable } from '@/lib/pdfTemplate';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import SendEmailModal from '../components/shared/SendEmailModal';
import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';
import { getAeroportosPermitidos, filtrarDadosPorAcesso } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';
import { useAuth } from '@/lib/AuthContext';

export default function Safety() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Primary data via TanStack Query
  const empId = user?.empresa_id;
  const { data: ocorrenciasRaw = [], isLoading: isQueryLoading, refetch } = useOcorrencias({ empresaId: empId });

  // Secondary data: aeroportos (kept as useState per instructions)
  const [aeroportos, setAeroportos] = useState([]);
  const [aeroportosLoaded, setAeroportosLoaded] = useState(false);

  // Derive filtered ocorrencias from query data + aeroportos
  const ocorrencias_derived = useMemo(() => {
    if (!aeroportosLoaded) return [];
    const aeroportosAngola = aeroportos.filter(a => a.pais === 'AO');
    return filtrarDadosPorAcesso(user, ocorrenciasRaw, 'aeroporto', aeroportosAngola);
  }, [ocorrenciasRaw, aeroportos, aeroportosLoaded, user]);

  // State that can be overridden by server-side search (handleBuscar)
  const [searchOverride, setSearchOverride] = useState(null);
  const ocorrencias = searchOverride !== null ? searchOverride : ocorrencias_derived;
  const isLoading = isQueryLoading && !aeroportosLoaded;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOcorrencia, setEditingOcorrencia] = useState(null);
  const [selectedOcorrencias, setSelectedOcorrencias] = useState([]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'error', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    gravidade: 'todos',
    status: 'todos',
    dataInicio: '',
    dataFim: ''
  });

  // Load aeroportos on mount
  useEffect(() => {
    (async () => {
      try {
        const aeroportosData = empId
          ? await Aeroporto.filter({ empresa_id: empId })
          : await Aeroporto.list();
        const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');
        const aeroportosFiltrados = getAeroportosPermitidos(user, aeroportosAngola, user?.empresa_id);
        setAeroportos(aeroportosFiltrados);
        setAeroportosLoaded(true);
      } catch (error) {
        console.error("Erro ao carregar aeroportos:", error);
        setAlertInfo({ isOpen: true, title: t('safety.erro_carregamento'), message: t('safety.erro_carregamento_msg') });
      }
    })();
  }, []);

  const loadData = () => {
    setSearchOverride(null);
    queryClient.invalidateQueries({ queryKey: ['ocorrencias', empId] });
  };

  const handleEdit = (occurrence) => {
    setEditingOcorrencia(occurrence);
    setIsFormOpen(true);
  };
  
  const handleFormSubmit = async (data) => {
    try {
      if (editingOcorrencia) {
        await OcorrenciaSafety.update(editingOcorrencia.id, data);
      } else {
        await OcorrenciaSafety.create({ ...data, empresa_id: user?.empresa_id });
      }
      setIsFormOpen(false);
      setEditingOcorrencia(null);
      queryClient.invalidateQueries({ queryKey: ['ocorrencias', empId] });
      setSuccessInfo({ isOpen: true, title: t('safety.ocorrencia_salva'), message: t('safety.ocorrencia_salva_msg') });
    } catch (error) {
      console.error("Erro ao salvar ocorrência:", error);
      setAlertInfo({ isOpen: true, title: t('safety.erro_salvar'), message: t('safety.erro_salvar_msg') });
    }
  };

  const handleDelete = (ocorrencia) => {
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: t('safety.excluir_ocorrencia'),
      message: `⚠️ ${t('safety.atencao_irreversivel')}\n\n${t('safety.confirmar_excluir')} ${ocorrencia.tipo_ocorrencia.replace(/_/g, ' ')} ${t('safety.do_dia')} ${new Date(ocorrencia.data_ocorrencia).toLocaleDateString('pt-AO')}?\n\n${t('safety.remover_registro')}`,
      showCancel: true,
      confirmText: t('safety.excluir_permanentemente'),
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        
        try {
          await OcorrenciaSafety.delete(ocorrencia.id);
          queryClient.invalidateQueries({ queryKey: ['ocorrencias', empId] });
          setSuccessInfo({
            isOpen: true,
            title: t('safety.ocorrencia_excluida'),
            message: t('safety.ocorrencia_excluida_msg')
          });
        } catch (error) {
          console.error('Erro ao excluir ocorrência:', error);
          
          if (error.response?.status === 404) {
            queryClient.invalidateQueries({ queryKey: ['ocorrencias', empId] });
            setAlertInfo({
              isOpen: true,
              type: 'info',
              title: t('safety.ocorrencia_ja_removida'),
              message: t('safety.ocorrencia_ja_removida_msg')
            });
          } else {
            setAlertInfo({
              isOpen: true,
              type: 'error',
              title: t('safety.erro_excluir'),
              message: t('safety.erro_excluir_msg')
            });
          }
        }
      }
    });
  };

  const [isSearching, setIsSearching] = useState(false);

  const handleBuscar = async () => {
    setIsSearching(true);
    try {
      const empId = user?.empresa_id;
      const query = {};
      if (empId) query.empresa_id = empId;
      if (filtros.aeroporto !== 'todos') query.aeroporto = filtros.aeroporto;
      if (filtros.gravidade !== 'todos') query.gravidade = filtros.gravidade;
      if (filtros.status !== 'todos') query.status = filtros.status;
      if (filtros.dataInicio) query.data_ocorrencia = { ...query.data_ocorrencia, $gte: filtros.dataInicio };
      if (filtros.dataFim) query.data_ocorrencia = { ...query.data_ocorrencia, $lte: filtros.dataFim };

      const data = await OcorrenciaSafety.filter(
        Object.keys(query).length > 0 ? query : {},
        '-data_ocorrencia'
      );
      const aeroportosAngola = aeroportos.filter(a => a.pais === 'AO');
      setSearchOverride(filtrarDadosPorAcesso(user, data, 'aeroporto', aeroportosAngola));
    } catch (error) {
      console.error('Erro ao buscar:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // No client-side filtering needed — server-side handles all filters
  const ocorrenciasFiltradas = ocorrencias;

  const handleSelectOcorrencia = useCallback((ocorrenciaId, isSelected) => {
    if (isSelected) {
      setSelectedOcorrencias(prev => [...prev, ocorrenciaId]);
    } else {
      setSelectedOcorrencias(prev => prev.filter(id => id !== ocorrenciaId));
    }
  }, []);

  const handleSelectAll = useCallback((isSelected) => {
    if (isSelected) {
      setSelectedOcorrencias(ocorrenciasFiltradas.map(o => o.id));
    } else {
      setSelectedOcorrencias([]);
    }
  }, [ocorrenciasFiltradas]);
  
  const handleExportCSV = () => {
    const dataToExport = (selectedOcorrencias.length > 0
      ? ocorrencias.filter(o => selectedOcorrencias.includes(o.id))
      : ocorrenciasFiltradas
    ).map(o => ({
      [t('safety.col_tipo')]: o.tipo_ocorrencia.replace(/_/g, ' '),
      [t('safety.col_aeroporto')]: aeroportos.find(a => a.codigo_icao === o.aeroporto)?.nome || o.aeroporto,
      [t('safety.col_data')]: new Date(o.data_ocorrencia).toLocaleDateString('pt-AO'),
      [t('safety.col_hora')]: o.hora_ocorrencia,
      [t('safety.col_local')]: o.local_especifico,
      [t('safety.col_gravidade')]: o.gravidade,
      [t('safety.col_status')]: o.status.replace(/_/g, ' '),
      [t('safety.col_descricao')]: o.descricao,
      [t('safety.acoes_tomadas')]: o.acoes_tomadas
    }));

    if (dataToExport.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: t('safety.nenhum_dado'), message: t('safety.nenhum_dado_exportar') });
      return;
    }

    downloadAsCSV(dataToExport, `ocorrencias_safety_${new Date().toISOString().split('T')[0]}`);
    setSuccessInfo({ isOpen: true, title: t('safety.csv_gerado'), message: t('safety.csv_gerado_msg') });
  };

  const handleExportPDF = async () => {
    const dataToExport = selectedOcorrencias.length > 0
      ? ocorrencias.filter(o => selectedOcorrencias.includes(o.id))
      : ocorrenciasFiltradas;
      
    if (dataToExport.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: t('safety.nenhum_dado'), message: t('safety.nenhum_dado_exportar') });
      return;
    }

    try {
      const doc = await createPdfDoc();
      const today = new Date().toLocaleDateString('pt-AO');

      const headerOpts = {
        title: t('safety.relatorio_titulo'),
        subtitle: `${t('safety.total_ocorrencias_label')}: ${dataToExport.length}`,
        date: today,
      };

      let y = addHeader(doc, headerOpts);

      const columns = [
        { label: '#', width: 10, align: 'center' },
        { label: t('safety.col_tipo'), width: 30 },
        { label: t('safety.col_aeroporto'), width: 30 },
        { label: t('safety.col_data'), width: 22, align: 'center' },
        { label: t('safety.col_gravidade'), width: 22, align: 'center' },
        { label: t('safety.col_status'), width: 25 },
        { label: t('safety.col_descricao'), width: 41 },
      ];

      const rows = dataToExport.map((occ, index) => [
        String(index + 1),
        (occ.tipo_ocorrencia || '').replace(/_/g, ' '),
        aeroportos.find(a => a.codigo_icao === occ.aeroporto)?.nome || occ.aeroporto || '',
        occ.data_ocorrencia ? new Date(occ.data_ocorrencia).toLocaleDateString('pt-AO') : '',
        occ.gravidade || '',
        (occ.status || '').replace(/_/g, ' '),
        occ.descricao?.length > 60 ? occ.descricao.substring(0, 57) + '...' : (occ.descricao || ''),
      ]);

      y = addTable(doc, y, { columns, rows, headerOpts });

      addFooter(doc);

      doc.save(`relatorio_safety_${new Date().toISOString().split('T')[0]}.pdf`);
      setSuccessInfo({ isOpen: true, title: t('safety.pdf_gerado'), message: t('safety.pdf_gerado_msg') });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setAlertInfo({ isOpen: true, title: t('safety.erro_pdf'), message: t('safety.erro_pdf_msg') });
    }
  };
  
  const handleSendEmail = async (recipient, subject) => {
    const dataToSend = selectedOcorrencias.length > 0
      ? ocorrencias.filter(o => selectedOcorrencias.includes(o.id))
      : ocorrenciasFiltradas;
      
    if (dataToSend.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: t('safety.nenhum_dado'), message: t('safety.selecione_ocorrencias') });
      return false;
    }

    let body = `<h1>${subject}</h1><p>${t('safety.resumo_email')} ${dataToSend.length} ${t('safety.ocorrencias_de_safety')}:</p>`;
    body += `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;"><thead><tr><th>${t('safety.col_tipo')}</th><th>${t('safety.col_aeroporto')}</th><th>${t('safety.col_data')}</th><th>${t('safety.col_gravidade')}</th><th>${t('safety.col_status')}</th></tr></thead><tbody>`;
    dataToSend.forEach(occ => {
      body += `<tr>
        <td>${occ.tipo_ocorrencia.replace(/_/g, ' ')}</td>
        <td>${aeroportos.find(a => a.codigo_icao === occ.aeroporto)?.nome || occ.aeroporto}</td>
        <td>${new Date(occ.data_ocorrencia).toLocaleDateString('pt-AO')}</td>
        <td>${occ.gravidade}</td>
        <td>${occ.status.replace(/_/g, ' ')}</td>
      </tr>`;
    });
    body += '</tbody></table>';

    try {
      await sendEmailDirect({ to: recipient, subject, body });
      setSuccessInfo({ isOpen: true, title: t('safety.email_enviado'), message: `${t('safety.email_enviado_msg')} ${recipient}.` });
      return true;
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      setAlertInfo({ isOpen: true, title: t('safety.erro_email'), message: t('safety.erro_email_msg') });
      return false;
    }
  };

  // Calcular KPIs avançados
  const totalOcorrencias = ocorrenciasFiltradas.length;
  const ocorrenciasAbertas = ocorrenciasFiltradas.filter(o => o.status === 'aberta').length;
  const ocorrenciasCriticas = ocorrenciasFiltradas.filter(o => o.gravidade === 'critica').length;
  const ocorrenciasEsteMes = ocorrenciasFiltradas.filter(o => {
    const dataOcorrencia = new Date(o.data_ocorrencia);
    const agora = new Date();
    return dataOcorrencia.getMonth() === agora.getMonth() && dataOcorrencia.getFullYear() === agora.getFullYear();
  }).length;

  const ocorrenciasFechadas = ocorrenciasFiltradas.filter(o => o.status === 'fechada').length;
  const taxaResolucao = totalOcorrencias > 0 ? ((ocorrenciasFechadas / totalOcorrencias) * 100).toFixed(1) : 0;

  const aeroportoOptions = useMemo(() => {
    const permitidos = getAeroportosPermitidos(user, aeroportos, user?.empresa_id);
    return [
      { value: 'todos', label: t('safety.todos_aeroportos') },
      ...permitidos.map(a => ({ value: a.codigo_icao, label: a.nome }))
    ];
  }, [aeroportos, user, t]);

  const gravidadeOptions = [
    { value: 'todos', label: t('safety.todas_gravidades') },
    { value: 'critica', label: t('safety.critica') },
    { value: 'alta', label: t('safety.alta') },
    { value: 'media', label: t('safety.media') },
    { value: 'baixa', label: t('safety.baixa') }
  ];

  const statusOptions = [
    { value: 'todos', label: t('safety.todos_status') },
    { value: 'aberta', label: t('safety.aberta') },
    { value: 'em_investigacao', label: t('safety.em_investigacao') },
    { value: 'fechada', label: t('safety.fechada') }
  ];

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              {t('page.safety.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.safety.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={loadData} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('btn.refresh')}
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileDown className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            {selectedOcorrencias.length > 0 && (
              <Button variant="outline" onClick={() => setIsEmailModalOpen(true)} className="border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950">
                <Mail className="w-4 h-4 mr-2" />
                Email ({selectedOcorrencias.length})
              </Button>
            )}
            <Button onClick={() => { setEditingOcorrencia(null); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t('safety.nova_ocorrencia')}
            </Button>
          </div>
        </div>

        {/* KPIs de Safety */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.total_ocorrencias')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalOcorrencias}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.ocorrencias_filtradas')}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.ocorrencias_abertas')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{ocorrenciasAbertas}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.requerem_atencao')}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.criticas')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{ocorrenciasCriticas}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.nivel_critico')}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.este_mes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{ocorrenciasEsteMes}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.novas_ocorrencias')}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('safety.taxa_resolucao')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{taxaResolucao}%</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('safety.ocorrencias_resolvidas')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              {t('safety.filtros_pesquisa')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aeroporto" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('safety.aeroporto')}</Label>
                <Select
                  id="aeroporto"
                  options={aeroportoOptions}
                  value={filtros.aeroporto}
                  onValueChange={(v) => setFiltros({...filtros, aeroporto: v})}
                  placeholder={t('safety.todos_aeroportos')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gravidade" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('safety.gravidade')}</Label>
                <Select
                  id="gravidade"
                  options={gravidadeOptions}
                  value={filtros.gravidade}
                  onValueChange={(v) => setFiltros({...filtros, gravidade: v})}
                  placeholder={t('safety.todas_gravidades')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('label.status')}</Label>
                <Select
                  id="status"
                  options={statusOptions}
                  value={filtros.status}
                  onValueChange={(v) => setFiltros({...filtros, status: v})}
                  placeholder={t('safety.todos_status')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-inicio" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('safety.data_inicio')}</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-fim" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('safety.data_fim')}</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                />
              </div>
              <div className="flex items-end gap-2 mt-2">
                <Button onClick={handleBuscar} disabled={isSearching} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSearching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</> : <><Search className="w-4 h-4 mr-2" /> Buscar</>}
                </Button>
                <Button variant="outline" onClick={() => { setFiltros({ aeroporto: 'todos', gravidade: 'todos', status: 'todos', dataInicio: '', dataFim: '' }); setSearchOverride(null); }}>
                  <X className="w-4 h-4 mr-2" /> Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <SafetyOccurrencesList
          ocorrencias={ocorrenciasFiltradas}
          aeroportos={aeroportos}
          isLoading={isLoading}
          onReload={loadData}
          onEdit={handleEdit}
          onDelete={handleDelete}
          selectedOcorrencias={selectedOcorrencias}
          onSelectOcorrencia={handleSelectOcorrencia}
          onSelectAll={handleSelectAll}
        />
      </div>

      {isFormOpen && (
        <FormSafetyOccurrence
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingOcorrencia(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          occurrenceInitial={editingOcorrencia}
        />
      )}

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSend={handleSendEmail}
        defaultSubject={`${t('safety.relatorio_default_subject')} - ${new Date().toLocaleDateString('pt-AO')}`}
        title={t('safety.enviar_relatorio')}
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        title={alertInfo.title}
        message={alertInfo.message}
        type={alertInfo.type}
        showCancel={alertInfo.showCancel}
        confirmText={alertInfo.confirmText}
        onConfirm={alertInfo.onConfirm}
      />
      
      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ ...successInfo, isOpen: false })}
        title={successInfo.title}
        message={successInfo.message}
      />

    </div>
  );
}
