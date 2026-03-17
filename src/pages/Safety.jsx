
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Filter, FileDown, FileText, Mail } from 'lucide-react';
import Select from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { OcorrenciaSafety } from '@/entities/OcorrenciaSafety';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User'; // Added User import
import SafetyOccurrencesList from '../components/safety/SafetyOccurrencesList';
import FormSafetyOccurrence from '../components/safety/FormSafetyOccurrence';
import { downloadAsCSV } from '../components/lib/export';
import { createPdfDoc, addHeader, addFooter, addTable, PDF } from '@/lib/pdfTemplate';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import SendEmailModal from '../components/shared/SendEmailModal';
import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';
import { getAeroportosPermitidos, filtrarDadosPorAcesso } from '@/components/lib/userUtils';
import { useI18n } from '@/components/lib/i18n';

export default function Safety() {
  const { t } = useI18n();
  const [ocorrencias, setOcorrencias] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOcorrencia, setEditingOcorrencia] = useState(null);
  const [selectedOcorrencias, setSelectedOcorrencias] = useState([]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'error', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [user, setUser] = useState(null); // Added user state
  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    gravidade: 'todos',
    status: 'todos',
    dataInicio: '',
    dataFim: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Server-side filter by empresa_id when applicable
      const empId = currentUser.empresa_id;
      const ocorrenciaPromise = empId
        ? OcorrenciaSafety.filter({ empresa_id: empId }, '-data_ocorrencia')
        : OcorrenciaSafety.list('-data_ocorrencia');

      const [ocorrenciasData, aeroportosData] = await Promise.all([
        ocorrenciaPromise,
        empId ? Aeroporto.filter({ empresa_id: empId }) : Aeroporto.list()
      ]);

      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');

      // FILTRO CRÍTICO: Filtrar ocorrências por aeroportos do utilizador (empresa-based)
      const filteredOcorrencias = filtrarDadosPorAcesso(currentUser, ocorrenciasData, 'aeroporto', aeroportosAngola);

      const aeroportosFiltrados = getAeroportosPermitidos(currentUser, aeroportosAngola, currentUser.empresa_id);
      setOcorrencias(filteredOcorrencias);
      setAeroportos(aeroportosFiltrados);
      
    } catch (error) {
      console.error("Erro ao carregar dados de safety:", error);
      setAlertInfo({ isOpen: true, title: 'Erro de Carregamento', message: 'Não foi possível carregar os dados de ocorrências.' });
    } finally {
      setIsLoading(false);
    }
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
        await OcorrenciaSafety.create(data);
      }
      setIsFormOpen(false);
      setEditingOcorrencia(null);
      loadData();
      setSuccessInfo({ isOpen: true, title: 'Ocorrência Salva', message: 'A ocorrência de safety foi salva com sucesso.' });
    } catch (error) {
      console.error("Erro ao salvar ocorrência:", error);
      setAlertInfo({ isOpen: true, title: 'Erro ao Salvar', message: 'Não foi possível salvar a ocorrência.' });
    }
  };

  const handleDelete = (ocorrencia) => {
    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: 'Excluir Ocorrência',
      message: `⚠️ ATENÇÃO: Esta ação é irreversível!\n\nTem certeza que deseja excluir permanentemente a ocorrência de ${ocorrencia.tipo_ocorrencia.replace(/_/g, ' ')} do dia ${new Date(ocorrencia.data_ocorrencia).toLocaleDateString('pt-AO')}?\n\nEsta ação removerá completamente o registo do sistema.`,
      showCancel: true,
      confirmText: 'Excluir Permanentemente',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        
        try {
          await OcorrenciaSafety.delete(ocorrencia.id);
          loadData();
          setSuccessInfo({
            isOpen: true,
            title: 'Ocorrência Excluída!',
            message: 'A ocorrência foi excluída permanentemente do sistema.'
          });
        } catch (error) {
          console.error('Erro ao excluir ocorrência:', error);
          
          if (error.response?.status === 404) {
            loadData();
            setAlertInfo({
              isOpen: true,
              type: 'info',
              title: 'Ocorrência Já Removida',
              message: 'A ocorrência já foi removida do sistema. A lista foi atualizada.'
            });
          } else {
            setAlertInfo({
              isOpen: true,
              type: 'error',
              title: 'Erro ao Excluir',
              message: 'Não foi possível excluir a ocorrência. Tente atualizar a página e verificar se a ocorrência ainda existe.'
            });
          }
        }
      }
    });
  };

  const ocorrenciasFiltradas = useMemo(() => {
    return ocorrencias.filter(ocorrencia => {
      const aeroportoMatch = filtros.aeroporto === 'todos' || ocorrencia.aeroporto === filtros.aeroporto;
      const gravidadeMatch = filtros.gravidade === 'todos' || ocorrencia.gravidade === filtros.gravidade;
      const statusMatch = filtros.status === 'todos' || ocorrencia.status === filtros.status;
      
      let dataMatch = true;
      if (filtros.dataInicio) {
          const dataOcorrencia = new Date(ocorrencia.data_ocorrencia + 'T00:00:00'); 
          const dataInicioFiltro = new Date(filtros.dataInicio + 'T00:00:00');
          dataMatch = dataMatch && (dataOcorrencia >= dataInicioFiltro);
      }
      if (filtros.dataFim) {
          const dataOcorrencia = new Date(ocorrencia.data_ocorrencia + 'T00:00:00');
          const dataFimFiltro = new Date(filtros.dataFim + 'T00:00:00');
          dataMatch = dataMatch && (dataOcorrencia <= dataFimFiltro);
      }
      
      return aeroportoMatch && gravidadeMatch && statusMatch && dataMatch;
    });
  }, [ocorrencias, filtros]);

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
      'Tipo': o.tipo_ocorrencia.replace(/_/g, ' '),
      'Aeroporto': aeroportos.find(a => a.codigo_icao === o.aeroporto)?.nome || o.aeroporto,
      'Data': new Date(o.data_ocorrencia).toLocaleDateString('pt-AO'),
      'Hora': o.hora_ocorrencia,
      'Local': o.local_especifico,
      'Gravidade': o.gravidade,
      'Status': o.status.replace(/_/g, ' '),
      'Descrição': o.descricao,
      'Ações Tomadas': o.acoes_tomadas
    }));

    if (dataToExport.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Nenhum Dado', message: 'Não há ocorrências para exportar.' });
      return;
    }
    
    downloadAsCSV(dataToExport, `ocorrencias_safety_${new Date().toISOString().split('T')[0]}`);
    setSuccessInfo({ isOpen: true, title: 'CSV Gerado', message: 'O arquivo CSV foi gerado e baixado com sucesso.' });
  };

  const handleExportPDF = async () => {
    const dataToExport = selectedOcorrencias.length > 0
      ? ocorrencias.filter(o => selectedOcorrencias.includes(o.id))
      : ocorrenciasFiltradas;
      
    if (dataToExport.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Nenhum Dado', message: 'Não há ocorrências para exportar.' });
      return;
    }
      
    try {
      const doc = await createPdfDoc();
      const today = new Date().toLocaleDateString('pt-AO');

      const headerOpts = {
        title: 'Relatório de Ocorrências de Safety',
        subtitle: `Total de ocorrências: ${dataToExport.length}`,
        date: today,
      };

      let y = addHeader(doc, headerOpts);

      const columns = [
        { label: '#', width: 10, align: 'center' },
        { label: 'Tipo', width: 30 },
        { label: 'Aeroporto', width: 30 },
        { label: 'Data', width: 22, align: 'center' },
        { label: 'Gravidade', width: 22, align: 'center' },
        { label: 'Status', width: 25 },
        { label: 'Descrição', width: 41 },
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
      setSuccessInfo({ isOpen: true, title: 'PDF Gerado', message: 'O relatório em PDF foi gerado com sucesso.' });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setAlertInfo({ isOpen: true, title: 'Erro de PDF', message: 'Não foi possível gerar o relatório em PDF.' });
    }
  };
  
  const handleSendEmail = async (recipient, subject) => {
    const dataToSend = selectedOcorrencias.length > 0
      ? ocorrencias.filter(o => selectedOcorrencias.includes(o.id))
      : ocorrenciasFiltradas;
      
    if (dataToSend.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Nenhum Dado', message: 'Selecione ocorrências para enviar.' });
      return false;
    }

    let body = `<h1>${subject}</h1><p>Segue abaixo o resumo de ${dataToSend.length} ocorrência(s) de safety:</p>`;
    body += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;"><thead><tr><th>Tipo</th><th>Aeroporto</th><th>Data</th><th>Gravidade</th><th>Status</th></tr></thead><tbody>';
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
      setSuccessInfo({ isOpen: true, title: 'Email Enviado', message: `Relatório enviado com sucesso para ${recipient}.` });
      return true;
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      setAlertInfo({ isOpen: true, title: 'Erro de Email', message: 'Não foi possível enviar o email.' });
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
      { value: 'todos', label: 'Todos os Aeroportos' },
      ...permitidos.map(a => ({ value: a.codigo_icao, label: a.nome }))
    ];
  }, [aeroportos, user]);

  const gravidadeOptions = [
    { value: 'todos', label: 'Todas as Gravidades' },
    { value: 'critica', label: 'Crítica' },
    { value: 'alta', label: 'Alta' },
    { value: 'media', label: 'Média' },
    { value: 'baixa', label: 'Baixa' }
  ];

  const statusOptions = [
    { value: 'todos', label: 'Todos os Status' },
    { value: 'aberta', label: 'Aberta' },
    { value: 'em_investigacao', label: 'Em Investigação' },
    { value: 'fechada', label: 'Fechada' }
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
            <Button onClick={() => { setEditingOcorrencia(null); setIsFormOpen(true); }} className="bg-red-500 hover:bg-red-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nova Ocorrência
            </Button>
          </div>
        </div>

        {/* KPIs de Safety */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total de Ocorrências</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalOcorrencias}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ocorrências filtradas</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Ocorrências Abertas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{ocorrenciasAbertas}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Requerem atenção</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Críticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{ocorrenciasCriticas}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Nível crítico</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Este Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{ocorrenciasEsteMes}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Novas ocorrências</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Taxa de Resolução</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{taxaResolucao}%</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ocorrências resolvidas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              Filtros de Pesquisa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aeroporto" className="text-sm font-medium text-slate-700 dark:text-slate-300">Aeroporto</Label>
                <Select
                  id="aeroporto"
                  options={aeroportoOptions}
                  value={filtros.aeroporto}
                  onValueChange={(v) => setFiltros({...filtros, aeroporto: v})}
                  placeholder="Todos os Aeroportos"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gravidade" className="text-sm font-medium text-slate-700 dark:text-slate-300">Gravidade</Label>
                <Select
                  id="gravidade"
                  options={gravidadeOptions}
                  value={filtros.gravidade}
                  onValueChange={(v) => setFiltros({...filtros, gravidade: v})}
                  placeholder="Todas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</Label>
                <Select
                  id="status"
                  options={statusOptions}
                  value={filtros.status}
                  onValueChange={(v) => setFiltros({...filtros, status: v})}
                  placeholder="Todos"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-inicio" className="text-sm font-medium text-slate-700 dark:text-slate-300">Data Início</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-fim" className="text-sm font-medium text-slate-700 dark:text-slate-300">Data Fim</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                />
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
        defaultSubject={`Relatório de Ocorrências de Safety - ${new Date().toLocaleDateString('pt-AO')}`}
        title="Enviar Relatório de Safety"
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
