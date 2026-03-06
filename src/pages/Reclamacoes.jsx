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
  Sparkles
} from 'lucide-react';

import { Reclamacao } from '@/entities/Reclamacao';
import { Aeroporto } from '@/entities/Aeroporto';
import { HistoricoReclamacao } from '@/entities/HistoricoReclamacao';
import { ConfiguracaoArea } from '@/entities/ConfiguracaoArea';
import { User } from '@/entities/User';
import { downloadAsCSV } from '../components/lib/export';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { base44 } from '@/api/base44Client';

import ReclamacoesStats from '../components/reclamacoes/ReclamacoesStats';
import ReclamacoesList from '../components/reclamacoes/ReclamacoesList';
import FormReclamacao from '../components/reclamacoes/FormReclamacao';
import ReclamacaoDetailModal from '../components/reclamacoes/ReclamacaoDetailModal';
import SendEmailModal from '../components/shared/SendEmailModal';
import ConfiguracaoReclamacoes from '../components/reclamacoes/ConfiguracaoReclamacoes';
import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';
import { classificarReclamacaoIA } from '@/functions/classificarReclamacaoIA';

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

  const [filtros, setFiltros] = useState({
    busca: '',
    status: 'todos',
    areaResponsavel: 'todos',
    aeroporto: 'todos',
    prioridade: 'todos',
    dataInicio: '',
    dataFim: ''
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const [reclamacoesData, aeroportosData] = await Promise.all([
        Reclamacao.list('-data_recebimento'),
        Aeroporto.list()
      ]);

      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');

      // FILTRO CRÍTICO: Filtrar reclamações por aeroportos do utilizador
      let reclamacoesFiltradas = reclamacoesData;
      
      if (currentUser.role !== 'admin' && !currentUser.perfis?.includes('administrador')) {
        if (currentUser.aeroportos_acesso && Array.isArray(currentUser.aeroportos_acesso) && currentUser.aeroportos_acesso.length > 0) {
          // Assuming reclamacao.aeroporto_id stores the ICAO code directly
          reclamacoesFiltradas = reclamacoesData.filter(r => 
            currentUser.aeroportos_acesso.includes(r.aeroporto_id)
          );
        } else {
          reclamacoesFiltradas = [];
        }
      }

      setReclamacoes(reclamacoesFiltradas);
      setAeroportos(aeroportosAngola);

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

  const filteredReclamacoes = useMemo(() => {
    return reclamacoes.filter(reclamacao => {
      const buscaMatch = !filtros.busca ||
        reclamacao.titulo.toLowerCase().includes(filtros.busca.toLowerCase()) ||
        reclamacao.protocolo_numero.toLowerCase().includes(filtros.busca.toLowerCase()) ||
        reclamacao.descricao.toLowerCase().includes(filtros.busca.toLowerCase()) ||
        (reclamacao.reclamante_nome && reclamacao.reclamante_nome.toLowerCase().includes(filtros.busca.toLowerCase()));

      const statusMatch = filtros.status === 'todos' || reclamacao.status === filtros.status;
      const areaMatch = filtros.areaResponsavel === 'todos' || reclamacao.area_responsavel === filtros.areaResponsavel;
      const aeroportoMatch = filtros.aeroporto === 'todos' || reclamacao.aeroporto_id === filtros.aeroporto;
      const prioridadeMatch = filtros.prioridade === 'todos' || reclamacao.prioridade === filtros.prioridade;

      const dataMatch = (!filtros.dataInicio || reclamacao.data_recebimento >= filtros.dataInicio) &&
                       (!filtros.dataFim || reclamacao.data_recebimento <= filtros.dataFim);

      return buscaMatch && statusMatch && areaMatch && aeroportoMatch && prioridadeMatch && dataMatch;
    });
  }, [reclamacoes, filtros]);

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

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://qtrypzzcjebvfciynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png" alt="DIROPS-SGA" style="height: 60px;">
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
            <p><strong>DIROPS-SGA</strong><br>Direcção de Operações - Serviços de Gestão Aeroportuária</p>
          </div>
        </div>
      `;

      const result = await sendEmailDirect({
        to: recipient,
        subject: `Protocolo de Reclamação ${reclamacaoParaProtocolo.protocolo_numero} - DIROPS-SGA`,
        body: emailBody,
        from_name: 'DIROPS-SGA'
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
  }, [aeroportos, reclamacaoParaProtocolo, showSuccess, setAlertInfo]);

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

      // Importar jsPDF dinamicamente
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for A4 size

      let pageNumber = 1;

      const addHeaderAndLogo = (docInstance, currentPageNumber) => {
        // Tentar adicionar logo
        try {
          if (logoBase64) {
            docInstance.addImage(logoBase64, 'PNG', 160, 10, 30, 15);
          }
        } catch (logoError) {
          console.log('Logo não adicionado:', logoError);
        }

        // Cabeçalho
        docInstance.setFontSize(18);
        docInstance.setFont(undefined, 'bold');
        docInstance.text('DIROPS-SGA', 20, 20);
        docInstance.setFontSize(16);
        docInstance.text('Relatório de Reclamações', 20, 30);

        docInstance.setFontSize(12);
        docInstance.setFont(undefined, 'normal');
        docInstance.text(`Data de Geração: ${new Date().toLocaleDateString('pt-AO')}`, 20, 40);
        docInstance.text(`Total de Reclamações: ${reclamacoesToExport.length}`, 20, 47);
        docInstance.text(`Página ${currentPageNumber}`, 180, 280);
      };

      let logoBase64 = null;
      
      // Pre-carregar logo uma vez
      try {
        const logoUrl = 'https://qtrypzzcjebvfciynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.arrayBuffer();
          const binary = Array.from(new Uint8Array(logoBlob)).map(b => String.fromCharCode(b)).join('');
          logoBase64 = `data:image/png;base64,${btoa(binary)}`;
        }
      } catch (logoError) {
        console.log('Logo não carregado:', logoError);
      }

      let yPosition = 60;
      addHeaderAndLogo(doc, pageNumber);

      // Cabeçalhos da tabela
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Protocolo', 20, yPosition);
      doc.text('Título', 50, yPosition);
      doc.text('Status', 90, yPosition);
      doc.text('Prior.', 120, yPosition);
      doc.text('Aeroporto', 140, yPosition);
      doc.text('Data', 180, yPosition);
      doc.setFont(undefined, 'normal');
      yPosition += 5;

      // Linha horizontal abaixo dos cabeçalhos
      doc.line(20, yPosition, 200, yPosition);
      yPosition += 8;

      // Dados das reclamações
      reclamacoesToExport.forEach((reclamacao, index) => {
        // Verificar se precisa de nova página (considerando espaço para descrição e reclamante)
        const espacoNecessario = 20; // Espaço para linha principal + descrição + reclamante
        if (yPosition + espacoNecessario > 270) {
          doc.addPage();
          pageNumber++;
          yPosition = 30;
          addHeaderAndLogo(doc, pageNumber);

          // Re-adicionar cabeçalhos na nova página
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text('Protocolo', 20, yPosition);
          doc.text('Título', 50, yPosition);
          doc.text('Status', 90, yPosition);
          doc.text('Prior.', 120, yPosition);
          doc.text('Aeroporto', 140, yPosition);
          doc.text('Data', 180, yPosition);
          doc.setFont(undefined, 'normal');
          yPosition += 5;
          doc.line(20, yPosition, 200, yPosition);
          yPosition += 8;
        }

        const aeroporto = aeroportos.find(a => a.codigo_icao === reclamacao.aeroporto_id);
        
        // Linha principal da reclamação
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`${reclamacao.protocolo_numero || 'N/A'}`, 20, yPosition);
        doc.text(`${(reclamacao.titulo || '').substring(0, 15)}${reclamacao.titulo && reclamacao.titulo.length > 15 ? '...' : ''}`, 50, yPosition);
        doc.text(`${(reclamacao.status || '').replace('_', ' ').substring(0, 8)}`, 90, yPosition);
        doc.text(`${(reclamacao.prioridade || 'N/A').substring(0, 5)}`, 120, yPosition);
        doc.text(`${aeroporto?.nome?.substring(0, 12) || 'N/A'}${aeroporto?.nome?.length > 12 ? '...' : ''}`, 140, yPosition);
        doc.text(`${new Date(reclamacao.data_recebimento).toLocaleDateString('pt-AO')}`, 180, yPosition);

        yPosition += 6;

        // Adicionar descrição se existir
        if (reclamacao.descricao) {
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          const descricaoTexto = `Descrição: ${reclamacao.descricao.substring(0, 90)}${reclamacao.descricao.length > 90 ? '...' : ''}`;
          doc.text(descricaoTexto, 20, yPosition);
          yPosition += 4;
        }

        // Adicionar informações do reclamante se existir
        if (reclamacao.reclamante_nome) {
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          const reclamanteTexto = `Reclamante: ${reclamacao.reclamante_nome}${reclamacao.reclamante_contacto ? ` (${reclamacao.reclamante_contacto})` : ''}`;
          doc.text(reclamanteTexto, 20, yPosition);
          doc.setTextColor(0, 0, 0);
          yPosition += 4;
        }

        // Adicionar linha separadora entre reclamações (exceto a última)
        if (index < reclamacoesToExport.length - 1) {
          yPosition += 2;
          doc.setDrawColor(220, 220, 220);
          doc.line(20, yPosition, 200, yPosition);
          doc.setDrawColor(0, 0, 0);
          yPosition += 4;
        }
      });

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
  }, [reclamacoes, selectedReclamacoes, filteredReclamacoes, aeroportos, showSuccess, setIsLoading, setAlertInfo]);

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

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://qtrypzzcjebvfciynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png" alt="DIROPS-SGA Logo" style="height: 60px;">
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
            <p><strong>Sistema DIROPS-SGA</strong><br>
            Direcção de Operações - Serviços de Gestão Aeroportuária</p>
          </div>
        </div>
      `;

      const result = await sendEmailDirect({
        to: recipient,
        subject: subject || 'Relatório de Reclamações - DIROPS-SGA',
        body: emailBody,
        from_name: 'DIROPS-SGA'
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
  }, [reclamacoes, selectedReclamacoes, filteredReclamacoes, aeroportos, showSuccess, setAlertInfo]);

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
  }, []);

  const hasActiveFilters = useMemo(() => Object.values(filtros).some(value =>
    value !== '' && value !== 'todos'
  ), [filtros]);

  const aeroportoOptions = useMemo(() => {
    return [
        { value: 'todos', label: 'Todos os Aeroportos' },
        ...aeroportos.map(a => ({ value: a.codigo_icao, label: a.nome }))
    ];
  }, [aeroportos]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-screen-xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <MessageSquareWarning className="w-6 md:w-8 h-6 md:h-8 text-blue-600" />
              Gestão de Reclamações
            </h1>
            <p className="text-slate-600 mt-1">Registo, tratamento e acompanhamento de reclamações.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-2 mb-6">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Lista de Reclamações
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            <div className="space-y-6">
               <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={loadData} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
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
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Classificar IA {selectedReclamacoes.length > 0 && `(${selectedReclamacoes.length})`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={selectedReclamacoes.length === 0 && filteredReclamacoes.length === 0}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Exportar CSV
                    {selectedReclamacoes.length > 0 && ` (${selectedReclamacoes.length})`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    disabled={selectedReclamacoes.length === 0 && filteredReclamacoes.length === 0}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Exportar PDF
                    {selectedReclamacoes.length > 0 && ` (${selectedReclamacoes.length})`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setReclamacaoParaProtocolo(null); setIsEmailModalOpen(true); }}
                    disabled={selectedReclamacoes.length === 0 && filteredReclamacoes.length === 0}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar Relatório
                    {selectedReclamacoes.length > 0 && ` (${selectedReclamacoes.length})`}
                  </Button>
                </div>
                <Button onClick={() => { setEditingReclamacao(null); setIsFormOpen(true); }} size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Reclamação
                </Button>
              </div>

              <ReclamacoesStats reclamacoes={filteredReclamacoes} isLoading={isLoading} />

              {/* Filtros */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Filter className="w-5 h-5 text-slate-500" />
                      Filtros de Pesquisa
                    </CardTitle>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Limpar Filtros
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-3">
                      <Label htmlFor="busca">Pesquisar</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                          id="busca"
                          placeholder="Pesquisar por protocolo, título, descrição ou reclamante..."
                          value={filtros.busca}
                          onChange={(e) => setFiltros(prev => ({...prev, busca: e.target.value}))}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        id="status"
                        options={STATUS_OPTIONS}
                        value={filtros.status}
                        onValueChange={(v) => setFiltros(prev => ({...prev, status: v}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="area">Área Responsável</Label>
                      <Select 
                        id="area"
                        options={AREA_RESPONSAVEL_OPTIONS}
                        value={filtros.areaResponsavel}
                        onValueChange={(v) => setFiltros(prev => ({...prev, areaResponsavel: v}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="prioridade">Prioridade</Label>
                      <Select 
                        id="prioridade"
                        options={PRIORIDADE_OPTIONS}
                        value={filtros.prioridade}
                        onValueChange={(v) => setFiltros(prev => ({...prev, prioridade: v}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="aeroporto">Aeroporto</Label>
                      <Select 
                        id="aeroporto"
                        options={aeroportoOptions}
                        value={filtros.aeroporto}
                        onValueChange={(v) => setFiltros(prev => ({...prev, aeroporto: v}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="dataInicio">Data Início</Label>
                      <Input
                        id="dataInicio"
                        type="date"
                        value={filtros.dataInicio}
                        onChange={(e) => setFiltros(prev => ({...prev, dataInicio: e.target.value}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="dataFim">Data Fim</Label>
                      <Input
                        id="dataFim"
                        type="date"
                        value={filtros.dataFim}
                        onChange={(e) => setFiltros(prev => ({...prev, dataFim: e.target.value}))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Reclamações ({filteredReclamacoes.length})</span>
                    {selectedReclamacoes.length > 0 && (
                      <Badge className="bg-blue-100 text-blue-800">
                        {selectedReclamacoes.length} selecionada(s)
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
        defaultSubject={reclamacaoParaProtocolo ? `Protocolo de Reclamação ${reclamacaoParaProtocolo.protocolo_numero}` : 'Relatório de Reclamações - DIROPS-SGA'}
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