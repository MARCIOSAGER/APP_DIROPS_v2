import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus,
  RefreshCw,
  FileDown,
  FileText,
  MessageSquareWarning,
  Filter,
  X,
  Search,
  Mail,
  Settings,
  Sparkles,
  Loader2
} from 'lucide-react';

import { Reclamacao } from '@/entities/Reclamacao';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User';
import { downloadAsCSV } from '../components/lib/export';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { getAeroportosPermitidos, filtrarDadosPorAcesso, getEmpresaLogoByUser } from '@/components/lib/userUtils';
import { Empresa } from '@/entities/Empresa';
import { useI18n } from '@/components/lib/i18n';

import ReclamacoesStats from '../components/reclamacoes/ReclamacoesStats';
import ReclamacoesList from '../components/reclamacoes/ReclamacoesList';
import FormReclamacao from '../components/reclamacoes/FormReclamacao';
import ReclamacaoDetailModal from '../components/reclamacoes/ReclamacaoDetailModal';
import SendEmailModal from '../components/shared/SendEmailModal';
import ConfiguracaoReclamacoes from '../components/reclamacoes/ConfiguracaoReclamacoes';
import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';
import { classificarReclamacaoIA } from '@/functions/classificarReclamacaoIA';
import { createPdfDoc, addHeader, addFooter, addTable, loadImageAsBase64 } from '@/lib/pdfTemplate';

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'recebida', label: 'Recebida' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'em_tratamento', label: 'Em Tratamento' },
  { value: 'aguardando_feedback', label: 'Aguardando Feedback' },
  { value: 'redirecionada', label: 'Redirecionada' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'rejeitada', label: 'Rejeitada' },
];

const AREA_RESPONSAVEL_OPTIONS = [
  { value: 'todos', label: 'Todas as Áreas' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'achados_e_perdidos', label: 'Achados e Perdidos' },
  { value: 'ti', label: 'TI' },
  { value: 'seguranca_avsec', label: 'Segurança AVSEC' },
  { value: 'seguranca_operacional', label: 'Segurança Operacional' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'cia_aerea', label: 'Cia Aérea' },
  { value: 'outros_aeroportuarios', label: 'Outros Aeroportuários' },
  { value: 'sem_direcionamento', label: 'Sem Direcionamento' },
];

const PRIORIDADE_OPTIONS = [
  { value: 'todos', label: 'Todas as Prioridades' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export default function Reclamacoes() {
  const { t } = useI18n();
  const [reclamacoes, setReclamacoes] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedReclamacao, setSelectedReclamacao] = useState(null);
  const [editingReclamacao, setEditingReclamacao] = useState(null);
  const [selectedReclamacoes, setSelectedReclamacoes] = useState([]);
  const [activeTab, setActiveTab] = useState('lista');
  const [reclamacaoParaProtocolo, setReclamacaoParaProtocolo] = useState(null);
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, id: null, title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '', details: [] });
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'error', title: '', message: '' }); // New state for general alerts
  const [user, setUser] = useState(null); // New state for current user
  const [empresas, setEmpresas] = useState([]);
  const [isBuscando, setIsBuscando] = useState(false);

  const [filtros, setFiltros] = useState({
    busca: '',
    status: 'todos',
    areaResponsavel: 'todos',
    aeroporto: 'todos',
    prioridade: 'todos',
    dataInicio: '',
    dataFim: ''
  });

  const loadData = useCallback(async (serverFilters) => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Build server-side query
      const empId = currentUser.empresa_id;
      const query = {};
      if (empId) query.empresa_id = empId;

      // Apply server-side filters when provided
      if (serverFilters) {
        if (serverFilters.status && serverFilters.status !== 'todos') {
          query.status = serverFilters.status;
        }
        if (serverFilters.areaResponsavel && serverFilters.areaResponsavel !== 'todos') {
          query.area_responsavel = serverFilters.areaResponsavel;
        }
        if (serverFilters.aeroporto && serverFilters.aeroporto !== 'todos') {
          query.aeroporto_id = serverFilters.aeroporto;
        }
        if (serverFilters.prioridade && serverFilters.prioridade !== 'todos') {
          query.prioridade = serverFilters.prioridade;
        }
        if (serverFilters.dataInicio) {
          query.data_recebimento = { ...query.data_recebimento, $gte: serverFilters.dataInicio };
        }
        if (serverFilters.dataFim) {
          query.data_recebimento = { ...query.data_recebimento, $lte: serverFilters.dataFim };
        }
      }

      const hasFilters = Object.keys(query).length > 0;
      const reclamacaoPromise = hasFilters
        ? Reclamacao.filter(query, '-data_recebimento')
        : Reclamacao.list('-data_recebimento');

      const [reclamacoesData, aeroportosData, empresasData] = await Promise.all([
        reclamacaoPromise,
        empId ? Aeroporto.filter({ empresa_id: empId }) : Aeroporto.list(),
        Empresa.list()
      ]);

      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');

      // FILTRO CRÍTICO: Filtrar reclamações por aeroportos do utilizador (empresa-based)
      const reclamacoesFiltradas = filtrarDadosPorAcesso(currentUser, reclamacoesData, 'aeroporto_id', aeroportosAngola);

      const aeroportosFiltrados = getAeroportosPermitidos(currentUser, aeroportosAngola, currentUser.empresa_id);
      setReclamacoes(reclamacoesFiltradas);
      setAeroportos(aeroportosFiltrados);
      setEmpresas(empresasData || []);

    } catch (error) {
      console.error("Erro ao carregar dados de reclamações:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro de Carregamento',
        message: 'Erro ao carregar dados. Tente recarregar a página.'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = useCallback((title, message, details = []) => {
    setSuccessInfo({ isOpen: true, title, message, details });
  }, []);

  const handleSelectReclamacao = useCallback((reclamacaoId, isSelected) => {
    if (isSelected) {
      setSelectedReclamacoes(prev => [...prev, reclamacaoId]);
    } else {
      setSelectedReclamacoes(prev => prev.filter(id => id !== reclamacaoId));
    }
  }, []);

  const handleBuscar = useCallback(async () => {
    setIsBuscando(true);
    try {
      await loadData(filtros);
    } finally {
      setIsBuscando(false);
    }
  }, [loadData, filtros]);

  // Client-side: only text search (busca) since it needs OR across multiple columns
  const filteredReclamacoes = useMemo(() => {
    if (!filtros.busca) return reclamacoes;
    const termo = filtros.busca.toLowerCase();
    return reclamacoes.filter(reclamacao =>
      reclamacao.titulo?.toLowerCase().includes(termo) ||
      reclamacao.protocolo_numero?.toLowerCase().includes(termo) ||
      reclamacao.descricao?.toLowerCase().includes(termo) ||
      reclamacao.reclamante_nome?.toLowerCase().includes(termo)
    );
  }, [reclamacoes, filtros.busca]);

  const handleSelectAll = useCallback((isSelected) => {
    if (isSelected) {
      setSelectedReclamacoes(filteredReclamacoes.map(r => r.id));
    } else {
      setSelectedReclamacoes([]);
    }
  }, [filteredReclamacoes]);

  const handleDelete = useCallback((reclamacaoId) => {
    setDeleteInfo({
      isOpen: true,
      id: reclamacaoId,
      title: 'Excluir Reclamação',
      message: 'Tem certeza que deseja excluir esta reclamação? Esta ação não pode ser desfeita e irá remover permanentemente o registo.'
    });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteInfo.id) return;
    try {
      await Reclamacao.delete(deleteInfo.id);
      showSuccess('Reclamação excluída com sucesso!', 'O registo da reclamação foi removido permanentemente.');
      await loadData();
      setSelectedReclamacoes(prev => prev.filter(id => id !== deleteInfo.id));
    } catch (error) {
      console.error('Erro ao excluir reclamação:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Excluir Reclamação',
        message: 'Erro ao excluir reclamação. Tente novamente.'
      });
    } finally {
      setDeleteInfo({ isOpen: false, id: null, title: '', message: '' });
    }
  }, [deleteInfo.id, loadData, showSuccess, setSelectedReclamacoes]);

  const handleFormSubmit = useCallback(async () => {
    setIsFormOpen(false);
    setEditingReclamacao(null);
    await loadData();
    showSuccess('Reclamação salva com sucesso!', 'A reclamação foi registada/atualizada.');
  }, [loadData, showSuccess]);

  const handleOpenDetail = useCallback((reclamacao) => {
    setSelectedReclamacao(reclamacao);
    setDetailModalOpen(true);
  }, []);

  const handleEdit = useCallback((reclamacao) => {
    setEditingReclamacao(reclamacao);
    setIsFormOpen(true);
  }, []);

  const openSendProtocoloModal = useCallback((reclamacao) => {
    setReclamacaoParaProtocolo(reclamacao);
    setIsEmailModalOpen(true);
  }, []);

  // Renamed from handleSendProtocoloEmail to handleSendEmailProtocol as per outline
  const handleSendEmailProtocol = useCallback(async (recipient) => {
    if (!recipient || !reclamacaoParaProtocolo) return false;

    try {
      const aeroporto = aeroportos.find(a => a.codigo_icao === reclamacaoParaProtocolo.aeroporto_id);

      const logoUrl = getEmpresaLogoByUser(user, empresas);
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${logoUrl}" alt="DIROPS" style="height: 60px;">
            <h1 style="color: #1e40af; margin-top: 20px;">Protocolo de Reclamação</h1>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #1e40af;">
            <h2 style="color: #1e40af; margin-top: 0;">Protocolo: ${reclamacaoParaProtocolo.protocolo_numero}</h2>
            <table style="width: 100%; margin: 15px 0;">
              <tr><td style="padding: 8px 0; font-weight: bold; width: 150px;">Título:</td><td style="padding: 8px 0;">${reclamacaoParaProtocolo.titulo}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Aeroporto:</td><td style="padding: 8px 0;">${aeroporto?.nome || reclamacaoParaProtocolo.aeroporto_id}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Data:</td><td style="padding: 8px 0;">${new Date(reclamacaoParaProtocolo.data_recebimento).toLocaleDateString('pt-AO')}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Status:</td><td style="padding: 8px 0;">${reclamacaoParaProtocolo.status.replace('_', ' ').toUpperCase()}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Categoria:</td><td style="padding: 8px 0;">${reclamacaoParaProtocolo.categoria_reclamacao?.replace('_', ' ')}</td></tr>
            </table>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #1e40af;">Descrição:</h3>
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 6px; line-height: 1.6;">${reclamacaoParaProtocolo.descricao}</p>
          </div>

          ${reclamacaoParaProtocolo.solucao_aplicada ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #059669;">Solução Aplicada:</h3>
              <p style="background-color: #ecfdf5; padding: 15px; border-radius: 6px; line-height: 1.6;">${reclamacaoParaProtocolo.solucao_aplicada}</p>
            </div>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
            <p><strong>DIROPS</strong><br>Direcção de Operações - Serviços de Gestão Aeroportuária</p>
          </div>
        </div>
      `;

      const result = await sendEmailDirect({
        to: recipient,
        subject: `Protocolo de Reclamação ${reclamacaoParaProtocolo.protocolo_numero} - DIROPS`,
        body: emailBody,
        from_name: 'DIROPS'
      });

      if (result.status === 200) {
        showSuccess('E-mail de protocolo enviado!', 'O protocolo foi enviado com sucesso para o destinatário.');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Enviar Email',
        message: `Não foi possível enviar o email de protocolo. Detalhe: ${error.message}`
      });
      return false;
    }
  }, [aeroportos, reclamacaoParaProtocolo, showSuccess, setAlertInfo, user, empresas]);

  const handleExportCSV = useCallback(async () => {
    const dataToExport = (selectedReclamacoes.length > 0 ?
      reclamacoes.filter(r => selectedReclamacoes.includes(r.id)) :
      filteredReclamacoes
    ).map(rec => ({
      'Protocolo': rec.protocolo_numero,
      'Título': rec.titulo,
      'Status': rec.status,
      'Prioridade': rec.prioridade,
      'Área Responsável': rec.area_responsavel?.replace('_', ' '),
      'Aeroporto': aeroportos.find(a => a.codigo_icao === rec.aeroporto_id)?.nome || rec.aeroporto_id,
      'Canal de Entrada': rec.canal_entrada?.replace('_', ' '),
      'Data Recebimento': new Date(rec.data_recebimento).toLocaleDateString('pt-AO'),
      'Reclamante': rec.reclamante_nome || 'Não informado',
      'Contacto': rec.reclamante_contacto || 'Não informado',
      'Categoria': rec.categoria_reclamacao?.replace('_', ' '),
      'Descrição': rec.descricao,
      'Solução Aplicada': rec.solucao_aplicada || 'Pendente'
    }));

    downloadAsCSV(dataToExport, `reclamacoes_${new Date().toISOString().split('T')[0]}`);
    showSuccess('Exportação CSV concluída!', 'Os dados das reclamações foram exportados com sucesso para um arquivo CSV.');
  }, [reclamacoes, selectedReclamacoes, filteredReclamacoes, aeroportos, showSuccess]);

  const handleExportPDF = useCallback(async () => {
    setIsLoading(true);
    try {
      const reclamacoesToExport = selectedReclamacoes.length > 0 ?
        reclamacoes.filter(r => selectedReclamacoes.includes(r.id)) :
        filteredReclamacoes;

      if (reclamacoesToExport.length === 0) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Nenhuma Reclamação',
          message: 'Não há reclamações para exportar.'
        });
        setIsLoading(false);
        return;
      }

      const doc = await createPdfDoc({ orientation: 'portrait' });

      // Pre-carregar logo
      let logoBase64 = null;
      try {
        const logoUrl = getEmpresaLogoByUser(user, empresas);
        logoBase64 = await loadImageAsBase64(logoUrl);
      } catch (logoError) {
        // Logo not loaded
      }

      const headerOpts = {
        title: 'Relatório de Reclamações',
        logoBase64,
        date: new Date().toLocaleDateString('pt-AO'),
        meta: [`Total de Reclamações: ${reclamacoesToExport.length}`],
      };

      let y = addHeader(doc, headerOpts);

      // Preparar colunas e linhas para a tabela
      const columns = [
        { label: 'Protocolo', width: 28 },
        { label: 'Título', width: 40 },
        { label: 'Status', width: 24 },
        { label: 'Prior.', width: 18 },
        { label: 'Aeroporto', width: 38 },
        { label: 'Data', width: 32 },
      ];

      const rows = reclamacoesToExport.map(rec => {
        const aeroporto = aeroportos.find(a => a.codigo_icao === rec.aeroporto_id);
        return [
          rec.protocolo_numero || 'N/A',
          rec.titulo || '',
          (rec.status || '').replace('_', ' '),
          rec.prioridade || 'N/A',
          aeroporto?.nome || 'N/A',
          new Date(rec.data_recebimento).toLocaleDateString('pt-AO'),
        ];
      });

      y = addTable(doc, y, { columns, rows, headerOpts });

      addFooter(doc);

      doc.save(`relatorio_reclamacoes_${new Date().toISOString().split('T')[0]}.pdf`);

      showSuccess('Relatório Exportado!', 'O seu relatório PDF foi gerado com sucesso.');

    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Exportar PDF',
        message: `Ocorreu um erro ao gerar o relatório PDF: ${error.message || ''}`
      });
    } finally {
      setIsLoading(false);
    }
  }, [reclamacoes, selectedReclamacoes, filteredReclamacoes, aeroportos, showSuccess, setIsLoading, setAlertInfo, user, empresas]);

  const handleSendEmail = useCallback(async (recipient, subject) => {
    try {
      const reclamacoesToSend = selectedReclamacoes.length > 0 ?
        reclamacoes.filter(r => selectedReclamacoes.includes(r.id)) :
        filteredReclamacoes;

      const estatisticas = {
        total: reclamacoesToSend.length,
        abertas: reclamacoesToSend.filter(r => !['concluida', 'rejeitada'].includes(r.status)).length,
        concluidas: reclamacoesToSend.filter(r => r.status === 'concluida').length,
        rejeitadas: reclamacoesToSend.filter(r => r.status === 'rejeitada').length,
      };

      const reportLogoUrl = getEmpresaLogoByUser(user, empresas);
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${reportLogoUrl}" alt="DIROPS Logo" style="height: 60px;">
            <h1 style="color: #1e40af; margin-top: 20px;">Relatório de Reclamações</h1>
            <p style="color: #64748b; margin: 5px 0;">Data: ${new Date().toLocaleDateString('pt-AO')}</p>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">Resumo Estatístico</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">Total de Reclamações:</td>
                <td style="padding: 8px;">${estatisticas.total}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Reclamações Abertas:</td>
                <td style="padding: 8px;">${estatisticas.abertas}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Reclamações Concluídas:</td>
                <td style="padding: 8px;">${estatisticas.concluidas}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Reclamações Rejeitadas:</td>
                <td style="padding: 8px;">${estatisticas.rejeitadas}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Taxa de Resolução:</td>
                <td style="padding: 8px;">${estatisticas.total > 0 ? ((estatisticas.concluidas / estatisticas.total) * 100).toFixed(1) : 0}%</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #1e40af;">Reclamações Incluídas</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Protocolo</th>
                <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Título</th>
                <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Status</th>
                <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Aeroporto</th>
              </tr>
            </thead>
            <tbody>
              ${reclamacoesToSend.slice(0, 15).map(r => `
                <tr>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;">${r.protocolo_numero}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;">${r.titulo}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;">${r.status.replace('_', ' ').toUpperCase()}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;">${aeroportos.find(a => a.codigo_icao === r.aeroporto_id)?.nome || r.aeroporto_id}</td>
                </tr>
              `).join('')}
              ${reclamacoesToSend.length > 15 ? `
                <tr>
                  <td colspan="4" style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-style: italic;">
                    ... e mais ${reclamacoesToSend.length - 15} reclamação(ões)
                  </td>
                </tr>
              ` : ''}
            </tbody>
          </table>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b;">
            <p><strong>Sistema DIROPS</strong><br>
            Direcção de Operações - Serviços de Gestão Aeroportuária</p>
          </div>
        </div>
      `;

      const result = await sendEmailDirect({
        to: recipient,
        subject: subject || 'Relatório de Reclamações - DIROPS',
        body: emailBody,
        from_name: 'DIROPS'
      });

      if (result.status === 200) {
        showSuccess('E-mail enviado!', 'O relatório de reclamações foi enviado com sucesso para o(s) destinatário(s).');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Enviar Email',
        message: 'Falha no envio do e-mail. Verifique o endereço e tente novamente.'
      });
      return false;
    }
  }, [reclamacoes, selectedReclamacoes, filteredReclamacoes, aeroportos, showSuccess, setAlertInfo, user, empresas]);

  const clearAllFilters = useCallback(() => {
    setFiltros({
      busca: '',
      status: 'todos',
      areaResponsavel: 'todos',
      aeroporto: 'todos',
      prioridade: 'todos',
      dataInicio: '',
      dataFim: ''
    });
    setIsBuscando(true);
    loadData().finally(() => setIsBuscando(false));
  }, [loadData]);

  const aeroportoOptions = useMemo(() => {
    const permitidos = getAeroportosPermitidos(user, aeroportos, user?.empresa_id);
    return [
        { value: 'todos', label: 'Todos os Aeroportos' },
        ...permitidos.map(a => ({ value: a.codigo_icao, label: a.nome }))
    ];
  }, [aeroportos, user]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-screen-xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <MessageSquareWarning className="w-6 md:w-8 h-6 md:h-8 text-blue-600 dark:text-blue-400" />
              {t('page.reclamacoes.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.reclamacoes.subtitle')}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-2 mb-6">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('reclamacoes.tabLista')}
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('reclamacoes.tabConfiguracoes')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            <div className="space-y-6">
               <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={loadData} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('reclamacoes.atualizar')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (selectedReclamacoes.length === 0) {
                        setAlertInfo({ isOpen: true, type: 'warning', title: 'Seleção Vazia', message: 'Selecione pelo menos uma reclamação para classificar.' });
                        return;
                      }
                      setIsLoading(true);
                      try {
                        let classificadas = 0;
                        for (const recId of selectedReclamacoes) {
                          const rec = reclamacoes.find(r => r.id === recId);
                          if (rec && !rec.categoria_reclamacao) {
                            const result = await classificarReclamacaoIA({ descricao: rec.descricao, assunto: rec.titulo });
                            if (result.data?.success) {
                              await Reclamacao.update(rec.id, {
                                categoria_reclamacao: result.data.classificacao.categoria,
                                prioridade: result.data.classificacao.prioridade,
                                area_responsavel: result.data.classificacao.area_responsavel
                              });
                              classificadas++;
                            }
                          }
                        }
                        await loadData();
                        showSuccess('Classificação Concluída', `${classificadas} reclamações foram classificadas automaticamente.`);
                      } catch (error) {
                        setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao classificar reclamações.' });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={selectedReclamacoes.length === 0 || isLoading}
                    className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('reclamacoes.classificarIA')} {selectedReclamacoes.length > 0 && `(${selectedReclamacoes.length})`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={selectedReclamacoes.length === 0 && filteredReclamacoes.length === 0}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    {t('reclamacoes.exportarCSV')}
                    {selectedReclamacoes.length > 0 && ` (${selectedReclamacoes.length})`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    disabled={selectedReclamacoes.length === 0 && filteredReclamacoes.length === 0}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {t('reclamacoes.exportarPDF')}
                    {selectedReclamacoes.length > 0 && ` (${selectedReclamacoes.length})`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setReclamacaoParaProtocolo(null); setIsEmailModalOpen(true); }}
                    disabled={selectedReclamacoes.length === 0 && filteredReclamacoes.length === 0}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {t('reclamacoes.enviarRelatorio')}
                    {selectedReclamacoes.length > 0 && ` (${selectedReclamacoes.length})`}
                  </Button>
                </div>
                <Button onClick={() => { setEditingReclamacao(null); setIsFormOpen(true); }} size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('reclamacoes.novaReclamacao')}
                </Button>
              </div>

              <ReclamacoesStats reclamacoes={filteredReclamacoes} isLoading={isLoading} />

              {/* Filtros */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    {t('reclamacoes.filtrosPesquisa')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-3">
                      <Label htmlFor="busca">{t('reclamacoes.pesquisar')}</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                        <Input
                          id="busca"
                          placeholder={t('reclamacoes.placeholderPesquisa')}
                          value={filtros.busca}
                          onChange={(e) => setFiltros(prev => ({...prev, busca: e.target.value}))}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="status">{t('reclamacoes.status')}</Label>
                      <Select 
                        id="status"
                        options={STATUS_OPTIONS}
                        value={filtros.status}
                        onValueChange={(v) => setFiltros(prev => ({...prev, status: v}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="area">{t('reclamacoes.areaResponsavel')}</Label>
                      <Select 
                        id="area"
                        options={AREA_RESPONSAVEL_OPTIONS}
                        value={filtros.areaResponsavel}
                        onValueChange={(v) => setFiltros(prev => ({...prev, areaResponsavel: v}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="prioridade">{t('reclamacoes.prioridade')}</Label>
                      <Select 
                        id="prioridade"
                        options={PRIORIDADE_OPTIONS}
                        value={filtros.prioridade}
                        onValueChange={(v) => setFiltros(prev => ({...prev, prioridade: v}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="aeroporto">{t('reclamacoes.aeroporto')}</Label>
                      <Select 
                        id="aeroporto"
                        options={aeroportoOptions}
                        value={filtros.aeroporto}
                        onValueChange={(v) => setFiltros(prev => ({...prev, aeroporto: v}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="dataInicio">{t('reclamacoes.dataInicio')}</Label>
                      <Input
                        id="dataInicio"
                        type="date"
                        value={filtros.dataInicio}
                        onChange={(e) => setFiltros(prev => ({...prev, dataInicio: e.target.value}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="dataFim">{t('reclamacoes.dataFim')}</Label>
                      <Input
                        id="dataFim"
                        type="date"
                        value={filtros.dataFim}
                        onChange={(e) => setFiltros(prev => ({...prev, dataFim: e.target.value}))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={handleBuscar}
                      disabled={isBuscando}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 text-xs sm:text-sm"
                    >
                      {isBuscando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('flightaware.searching')}</> : <><Filter className="w-4 h-4 mr-2" /> {t('btn.search')}</>}
                    </Button>
                    <Button variant="outline" onClick={clearAllFilters} className="flex-1 text-xs sm:text-sm">
                      <X className="w-4 h-4 mr-2" /> {t('reclamacoes.limparFiltros')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{t('reclamacoes.reclamacoes')} ({filteredReclamacoes.length})</span>
                    {selectedReclamacoes.length > 0 && (
                      <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {selectedReclamacoes.length} {t('reclamacoes.selecionadas')}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReclamacoesList
                    reclamacoes={filteredReclamacoes}
                    aeroportos={aeroportos}
                    isLoading={isLoading}
                    onView={handleOpenDetail}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    selectedReclamacoes={selectedReclamacoes}
                    onSelectReclamacao={handleSelectReclamacao}
                    onSelectAll={handleSelectAll}
                    onSendProtocolo={openSendProtocoloModal}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="configuracoes">
            <ConfiguracaoReclamacoes />
          </TabsContent>
        </Tabs>
      </div>

      {isFormOpen && (
        <FormReclamacao
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          reclamacao={editingReclamacao}
          aeroportos={aeroportos}
          onSubmit={handleFormSubmit}
          currentUser={user}
        />
      )}

      {detailModalOpen && selectedReclamacao && (
        <ReclamacaoDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          reclamacaoId={selectedReclamacao.id}
          aeroportos={aeroportos}
          onUpdate={loadData}
          onEdit={handleEdit}
        />
      )}

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => {setIsEmailModalOpen(false); setReclamacaoParaProtocolo(null);}}
        onSend={reclamacaoParaProtocolo ? handleSendEmailProtocol : handleSendEmail}
        defaultSubject={reclamacaoParaProtocolo ? `Protocolo de Reclamação ${reclamacaoParaProtocolo.protocolo_numero}` : 'Relatório de Reclamações - DIROPS'}
        title={reclamacaoParaProtocolo ? 'Enviar Protocolo por E-mail' : 'Enviar Relatório por E-mail'}
        isProtocolo={!!reclamacaoParaProtocolo}
      />

      <AlertModal
        isOpen={deleteInfo.isOpen}
        onClose={() => setDeleteInfo({ isOpen: false, id: null, title: '', message: '' })}
        onConfirm={handleDeleteConfirm}
        title={deleteInfo.title || "Confirmar Ação"}
        message={deleteInfo.message || ""}
        type="warning"
        confirmText="Excluir"
        showCancel
      />

      {/* New AlertModal for general errors */}
      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ isOpen: false, type: 'error', title: '', message: '' })}
        title={alertInfo.title}
        message={alertInfo.message}
        type={alertInfo.type}
      />

      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '', details: [] })}
        title={successInfo.title}
        message={successInfo.message}
        details={successInfo.details}
      />
    </div>
  );
}