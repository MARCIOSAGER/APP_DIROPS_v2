import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
        Shield,
        Plane,
        AlertTriangle,
        Building,
        Settings,
        Plus,
        FileText,
        BarChart3,
        Filter,
        X,
        RefreshCw,
        ClipboardCheck,
        CheckCircle,
        MapPin,
        User as UserIcon,
        Calendar,
        Grid,
        List,
        ArrowUpDown,
        Edit,
        Trash2,
        } from
      'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Combobox from '@/components/ui/combobox';
import Select from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import { TipoAuditoria } from '@/entities/TipoAuditoria';
import { ItemAuditoria } from '@/entities/ItemAuditoria'; // New import
import { RespostaAuditoria } from '@/entities/RespostaAuditoria'; // New import
import { ProcessoAuditoria } from '@/entities/ProcessoAuditoria';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User';
import { PlanoAcaoCorretiva } from '@/entities/PlanoAcaoCorretiva';
import { ItemPAC } from '@/entities/ItemPAC'; // New import for ItemPAC
import { Voo } from '@/entities/Voo';

import { ensureUserProfilesExist, hasUserProfile, getAeroportosPermitidos, filtrarDadosPorAcesso, isSuperAdmin, getEmpresaLogoByUser } from '../components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { Empresa } from '@/entities/Empresa';

import FormProcessoAuditoria from '../components/auditoria/FormProcessoAuditoria';
import ConfiguracaoAuditoria from '../components/auditoria/ConfiguracaoAuditoria';
import AuditoriaDetailModal from '../components/auditoria/AuditoriaDetailModal';
import FormChecklist from '../components/auditoria/FormChecklist';
import FormPAC from '../components/auditoria/FormPAC';
import AlertModal from '../components/shared/AlertModal';

import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { createPdfDoc, addHeader, addFooter, addSectionTitle, addKeyValuePairs, checkPageBreak, loadImageAsBase64, PDF } from '@/lib/pdfTemplate';

const CATEGORIAS_CONFIG = {
  seguranca_operacional: {
    label: 'Segurança Operacional',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  seguranca_avsec: {
    label: 'Segurança AVSEC',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  resposta_emergencia: {
    label: 'Resposta a Emergência',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  infraestrutura: {
    label: 'Infraestrutura',
    icon: Building,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  operacoes: {
    label: 'Operações',
    icon: Plane,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  }
};

export default function Auditoria() {
  const { effectiveEmpresaId } = useCompanyView();
  const [currentUser, setCurrentUser] = useState(null);
  const [tiposAuditoria, setTiposAuditoria] = useState([]);
  const [itensAuditoria, setItensAuditoria] = useState([]);
  const [processosAuditoria, setProcessosAuditoria] = useState([]);
  const [aeroportos, setAeroportos] = useState([]); // All aeroportos from DB
  const [empresas, setEmpresas] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('processos');
  const [selectedCategoria, setSelectedCategoria] = useState('todos');

  const [showFormProcesso, setShowFormProcesso] = useState(false);
  const [selectedProcesso, setSelectedProcesso] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showFormPAC, setShowFormPAC] = useState(false);
  const [editingProcesso, setEditingProcesso] = useState(null);
  const [editingPAC, setEditingPAC] = useState(null); // Changed to editingPAC
  const [nonConformitiesForPAC, setNonConformitiesForPAC] = useState([]);

  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    status: 'todos',
    dataInicio: '',
    dataFim: '',
    responsavel: ''
  });

  const [gestaoPermission, setGestaoPermission] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false); // Changed to showConfigModal

  const [pacs, setPacs] = useState([]);
  const [itensPac, setItensPac] = useState([]); // Added new state for ItemPAC
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' }); // Changed from message to alertInfo
  
  // Estados para visualização e ordenação
  const [viewMode, setViewMode] = useState('list'); // 'list' ou 'grid'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' ou 'desc'
  const [sortField, setSortField] = useState('data_auditoria'); // campo de ordenação
  const [deleteProcessoInfo, setDeleteProcessoInfo] = useState({ isOpen: false, processo: null });
  
  // Estados para PACs
  const [viewModePAC, setViewModePAC] = useState('list');
  const [sortOrderPAC, setSortOrderPAC] = useState('desc');
  const [sortFieldPAC, setSortFieldPAC] = useState('data_criacao');
  const [deletePACInfo, setDeletePACInfo] = useState({ isOpen: false, pac: null });


  const showSuccess = useCallback((title, description) => {
    setAlertInfo({ isOpen: true, type: 'success', title, message: description });
  }, []);

  const showError = useCallback((title, description) => {
    setAlertInfo({ isOpen: true, type: 'error', title, message: description });
  }, []);

  // Aeroportos que o usuário tem acesso
  const aeroportosAcesso = useMemo(() => {
    if (!currentUser || !Array.isArray(aeroportos)) {
      return [];
    }
    return getAeroportosPermitidos(currentUser, aeroportos, effectiveEmpresaId);
  }, [aeroportos, currentUser, effectiveEmpresaId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(ensureUserProfilesExist(user));

      const isAdmin = user?.role === 'admin' || hasUserProfile(user, 'administrador');
      setGestaoPermission(isAdmin);

      // Server-side filter by empresa_id when applicable
      const empId = effectiveEmpresaId || user.empresa_id;
      const processoPromise = empId
        ? ProcessoAuditoria.filter({ empresa_id: empId }, '-data_auditoria')
        : ProcessoAuditoria.list('-data_auditoria');

      const [tiposData, processosData, aeroportosData, usersData, pacsData, itensData, itensPacData, empresasData] = await Promise.all([
      TipoAuditoria.list(),
      processoPromise,
      Aeroporto.filter({ pais: 'AO' }),
      User.list(),
      PlanoAcaoCorretiva.list('-data_criacao'),
      ItemAuditoria.list(),
      ItemPAC.list(),
      Empresa.list()]
      );

      const processosFiltrados = filtrarDadosPorAcesso(user, processosData || [], 'aeroporto_id', aeroportosData || [], effectiveEmpresaId);
      const pacsFiltrados = filtrarDadosPorAcesso(user, pacsData || [], 'aeroporto_id', aeroportosData || [], effectiveEmpresaId);

      setProcessosAuditoria(processosFiltrados);
      setTiposAuditoria(tiposData || []);
      setItensAuditoria(itensData || []);
      setAeroportos(aeroportosData || []); // Set all "AO" aeroportos, aeroportosAcesso memo will filter for UI
      setPacs(pacsFiltrados);
      setUsers(usersData || []);
      setItensPac(itensPacData || []);
      setEmpresas(empresasData || []);

    } catch (error) {
      console.error('Erro ao carregar dados ou verificar usuário:', error);
      setCurrentUser(null);
      setGestaoPermission(false);
      setProcessosAuditoria([]);
      setAeroportos([]);
      setTiposAuditoria([]);
      setUsers([]);
      setPacs([]);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro de Carregamento',
        message: 'Não foi possível carregar os dados. Tente novamente mais tarde.'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const estatisticas = useMemo(() => ({
    total: processosAuditoria.length,
    concluidas: processosAuditoria.filter((p) => p.status === 'concluida').length,
    emAndamento: processosAuditoria.filter((p) => p.status === 'em_andamento').length,
    conformidadeMedia: processosAuditoria.length > 0 ?
    processosAuditoria.reduce((acc, p) => acc + (p.percentual_conformidade || 0), 0) / processosAuditoria.length : 0
  }), [processosAuditoria]);

  const handleSuccess = () => {
    loadData();
    setShowFormProcesso(false); // Changed to showFormProcesso
    setShowConfigModal(false); // Changed to showConfigModal
    setShowFormPAC(false); // Changed to showFormPAC
    setEditingProcesso(null);
    setEditingPAC(null); // Clear editing PAC state
    setSelectedProcesso(null);
    setNonConformitiesForPAC([]);
    showSuccess('Operação Realizada', 'Dados atualizados com sucesso!');
  };

  const handleViewAuditoria = (processo) => {
    setSelectedProcesso(processo);
    setShowDetailModal(true); // Changed to showDetailModal
  };

  const openForm = (processo = null) => {
    setEditingProcesso(processo);
    setShowFormProcesso(true); // Changed to showFormProcesso
  };

  const handleDeleteProcesso = async () => {
    if (deleteProcessoInfo.processo) {
      try {
        await ProcessoAuditoria.delete(deleteProcessoInfo.processo.id);
        showSuccess('Auditoria Excluída', 'Auditoria excluída com sucesso!');
        loadData();
      } catch (error) {
        console.error('Erro ao excluir auditoria:', error);
        showError('Erro ao Excluir', 'Não foi possível excluir a auditoria. Tente novamente.');
      }
      setDeleteProcessoInfo({ isOpen: false, processo: null });
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const toggleSortOrderPAC = () => {
    setSortOrderPAC(sortOrderPAC === 'asc' ? 'desc' : 'asc');
  };

  const handleDeletePAC = async () => {
    if (deletePACInfo.pac) {
      try {
        await PlanoAcaoCorretiva.delete(deletePACInfo.pac.id);
        showSuccess('PAC Excluído', 'Plano de Ação Corretiva excluído com sucesso!');
        loadData();
      } catch (error) {
        console.error('Erro ao excluir PAC:', error);
        showError('Erro ao Excluir', 'Não foi possível excluir o PAC. Tente novamente.');
      }
      setDeletePACInfo({ isOpen: false, pac: null });
    }
  };

  const handleEditAuditoria = (processo) => {
    if (processo.status === 'planejada') {
      openForm(processo);
    } else if (processo.status === 'em_andamento') {
      setSelectedProcesso(processo);
      setShowChecklistModal(true); // Changed to showChecklistModal
    } else if (processo.status === 'concluida' && processo.itens_nao_conformes > 0) {
      handleCreatePAC(processo);
    } else {
      handleViewAuditoria(processo);
    }
  };

  const handleCreatePAC = async (processo) => {
    try {
      const respostasNC = await RespostaAuditoria.filter({
        processo_auditoria_id: processo.id,
        situacao_encontrada: 'NC'
      });

      if (respostasNC.length === 0) {
        showError("Sem Não Conformidades", "Não é possível criar um PAC pois não há não conformidades nesta auditoria.");
        return;
      }

      const tipoAuditoria = tiposAuditoria.find((t) => t.id === processo.tipo_auditoria_id);
      if (!tipoAuditoria) {
        showError("Erro ao preparar PAC", "Tipo de auditoria não encontrado.");
        return;
      }

      const allItems = await ItemAuditoria.filter({ tipo_auditoria_id: tipoAuditoria.id });
      const itemMap = new Map(allItems.map((item) => [item.id, item]));

      const enrichedNCs = respostasNC.map((r) => ({
        ...r,
        item: itemMap.get(r.item_auditoria_id)
      }));

      setNonConformitiesForPAC(enrichedNCs);
      setSelectedProcesso(processo);
      setShowFormPAC(true); // Changed to showFormPAC
    } catch (error) {
      showError("Erro ao preparar PAC", "Não foi possível carregar os dados das não conformidades.");
      console.error("Erro ao carregar NCs para o PAC:", error);
    }
  };

  const handleEditPAC = (pac) => {
    setEditingPAC(pac); // Changed to setEditingPAC
    setShowFormPAC(true); // Changed to showFormPAC
  };

  const handleProcessoFormSubmit = async (novoProcesso) => {
    setShowFormProcesso(false);
    setEditingProcesso(null);

    if (novoProcesso) {
      // Se foi criação nova ou se o status é "em_andamento", abre o checklist
      if (!editingProcesso || novoProcesso.status === 'em_andamento' || novoProcesso.status === 'planejada') {
        setSelectedProcesso(novoProcesso);
        setShowChecklistModal(true);
      } else {
        await loadData();
      }
    } else {
      await loadData();
    }
  };

  const handleChecklistComplete = async () => {
    await loadData();
    setShowChecklistModal(false); // Changed to showChecklistModal
    setSelectedProcesso(null);
    showSuccess('Checklist Concluído', 'Checklist da auditoria finalizado com sucesso!');
  };

  const handleExportPDF = useCallback(async (processo) => {
    setIsLoading(true);
    try {
      let logoBase64 = null;

      try {
        const logoUrl = getEmpresaLogoByUser(currentUser, empresas);
        logoBase64 = await loadImageAsBase64(logoUrl);
      } catch (logoError) {
        console.log('Logo não carregado:', logoError);
      }

      const [respostasData, tipoData] = await Promise.all([
        RespostaAuditoria.filter({ processo_auditoria_id: processo.id }),
        TipoAuditoria.filter({ id: processo.tipo_auditoria_id })
      ]);

      const tipo = tipoData[0];
      const aeroporto = aeroportos.find((a) => a.codigo_icao === processo.aeroporto_id);

      const itensData = await ItemAuditoria.filter({ tipo_auditoria_id: processo.tipo_auditoria_id });

      const doc = await createPdfDoc({ orientation: 'portrait' });

      const m = PDF.margin;
      const pageWidth = PDF.page.portrait.w;
      const contentWidth = pageWidth - m.left - m.right;

      const headerOpts = {
        title: 'Relatório de Auditoria Interna',
        logoBase64,
        date: new Date().toLocaleDateString('pt-AO'),
        meta: [
          `${tipo?.nome || 'N/A'} | ${aeroporto?.codigo_icao || 'N/A'}`,
          `Auditor: ${processo.auditor_responsavel || 'N/A'}`
        ]
      };

      let yPosition = addHeader(doc, headerOpts);

      // ─── Informações da Auditoria ───
      yPosition = checkPageBreak(doc, yPosition, 30, headerOpts);
      yPosition = addSectionTitle(doc, yPosition, 'Informações da Auditoria');

      yPosition = addKeyValuePairs(doc, yPosition, [
        { label: 'Aeroporto', value: aeroporto?.nome || 'N/A' },
        { label: 'Data', value: processo.data_auditoria ? format(new Date(processo.data_auditoria), 'dd/MM/yyyy', { locale: pt }) : 'N/A' },
        { label: 'Tipo', value: tipo?.nome || 'N/A' },
        { label: 'Auditor', value: processo.auditor_responsavel || 'N/A' },
        { label: 'Categoria', value: CATEGORIAS_CONFIG[tipo?.categoria]?.label || 'N/A' },
        { label: 'Status', value: processo.status || 'N/A' },
      ], { twoColumns: true });

      yPosition += 4;

      // ─── Resumo Executivo ───
      yPosition = checkPageBreak(doc, yPosition, 35, headerOpts);
      yPosition = addSectionTitle(doc, yPosition, 'Resumo Executivo');

      yPosition = addKeyValuePairs(doc, yPosition, [
        { label: 'Total de Itens', value: String(processo.total_itens || 0) },
        { label: 'Conformes', value: String(processo.itens_conformes || 0) },
        { label: 'Não Conformes', value: String(processo.itens_nao_conformes || 0) },
        { label: 'Conformidade', value: `${(processo.percentual_conformidade || 0).toFixed(1)}%` },
      ], { twoColumns: true });

      yPosition += 4;

      // ─── Não Conformidades ───
      const naoConformidades = respostasData.filter((r) => r.situacao_encontrada === 'NC');
      if (naoConformidades.length > 0) {
        yPosition = checkPageBreak(doc, yPosition, 25, headerOpts);
        yPosition = addSectionTitle(doc, yPosition, 'Não Conformidades Identificadas');

        const addTextWithPageBreak = (text, x, y, maxWidth, lineHeight = 5) => {
          const lines = doc.splitTextToSize(text, maxWidth);
          let currentY = y;
          for (let i = 0; i < lines.length; i++) {
            currentY = checkPageBreak(doc, currentY, lineHeight, headerOpts);
            doc.text(lines[i], x, currentY);
            currentY += lineHeight;
          }
          return currentY;
        };

        for (let index = 0; index < naoConformidades.length; index++) {
          const nc = naoConformidades[index];
          const item = itensData.find((i) => i.id === nc.item_auditoria_id);

          yPosition = checkPageBreak(doc, yPosition, 40, headerOpts);

          doc.setFontSize(PDF.font.subtitle);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...PDF.colors.danger);

          const itemTitle = `${index + 1}. Item ${item?.numero || 'N/A'}: ${item?.item || 'N/A'}`;
          yPosition = addTextWithPageBreak(itemTitle, m.left, yPosition, contentWidth, 6);
          yPosition += 3;

          doc.setTextColor(...PDF.colors.dark);

          doc.setFontSize(PDF.font.body);
          doc.setFont('helvetica', 'normal');
          yPosition = checkPageBreak(doc, yPosition, 7, headerOpts);
          doc.text(`Referência: ${item?.referencia_norma || 'N/A'}`, m.left, yPosition);
          yPosition += 8;

          if (item?.exemplo_situacao) {
            yPosition = checkPageBreak(doc, yPosition, 15, headerOpts);
            doc.setFontSize(PDF.font.body);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF.colors.muted);
            doc.text('Orientações:', m.left, yPosition);
            yPosition += 6;

            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...PDF.colors.muted);
            yPosition = addTextWithPageBreak(item.exemplo_situacao, m.left + 5, yPosition, contentWidth - 10, 5);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...PDF.colors.dark);
          }

          if (nc.observacao) {
            yPosition = checkPageBreak(doc, yPosition, 15, headerOpts);
            doc.setFontSize(PDF.font.body);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF.colors.dark);
            doc.text('Observação:', m.left, yPosition);
            yPosition += 6;

            doc.setFont('helvetica', 'normal');
            yPosition = addTextWithPageBreak(nc.observacao, m.left + 5, yPosition, contentWidth - 10, 5);
            yPosition += 6;
          }

          if (nc.acao_corretiva_recomendada) {
            yPosition = checkPageBreak(doc, yPosition, 15, headerOpts);
            doc.setFontSize(PDF.font.body);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF.colors.dark);
            doc.text('Ação Corretiva Recomendada:', m.left, yPosition);
            yPosition += 6;

            doc.setFont('helvetica', 'normal');
            yPosition = addTextWithPageBreak(nc.acao_corretiva_recomendada, m.left + 5, yPosition, contentWidth - 10, 5);
            yPosition += 6;
          }

          if (nc.evidencias && nc.evidencias.length > 0) {
            yPosition = checkPageBreak(doc, yPosition, 12, headerOpts);
            doc.setFontSize(PDF.font.body);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF.colors.dark);
            doc.text('Evidências:', m.left, yPosition);
            yPosition += 6;

            for (let evidIndex = 0; evidIndex < nc.evidencias.length; evidIndex++) {
              const evidencia = nc.evidencias[evidIndex];

              try {
                if (evidencia.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                  yPosition = checkPageBreak(doc, yPosition, 55, headerOpts);

                  try {
                    const imgDataUrl = await loadImageAsBase64(evidencia);
                    const imgWidth = 60;
                    const imgHeight = 45;

                    doc.addImage(imgDataUrl, 'PNG', m.left + 5, yPosition, imgWidth, imgHeight);
                    doc.setFontSize(PDF.font.small);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...PDF.colors.muted);
                    doc.text(`Evidência ${evidIndex + 1}`, m.left + 5, yPosition + imgHeight + 4);
                    yPosition += 52;
                  } catch (imgError) {
                    console.error('Error loading image for PDF:', imgError);
                    yPosition = checkPageBreak(doc, yPosition, 6, headerOpts);
                    doc.setFontSize(PDF.font.body);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...PDF.colors.dark);
                    doc.text(`Evidência ${evidIndex + 1}: [Imagem anexada - ${evidencia.substring(evidencia.lastIndexOf('/') + 1)}]`, m.left + 5, yPosition);
                    yPosition += 6;
                  }
                } else {
                  yPosition = checkPageBreak(doc, yPosition, 6, headerOpts);
                  doc.setFontSize(PDF.font.body);
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(...PDF.colors.dark);
                  doc.text(`Evidência ${evidIndex + 1}: ${evidencia.substring(evidencia.lastIndexOf('/') + 1)}`, m.left + 5, yPosition);
                  yPosition += 6;
                }
              } catch (error) {
                console.error(`Error processing evidence ${evidIndex + 1}:`, error);
                yPosition = checkPageBreak(doc, yPosition, 6, headerOpts);
                doc.setFontSize(PDF.font.body);
                doc.setTextColor(...PDF.colors.dark);
                doc.text(`Evidência ${evidIndex + 1}: [Arquivo anexado]`, m.left + 5, yPosition);
                yPosition += 6;
              }
            }
            yPosition += 3;
          }

          yPosition += 10;
        }
      }

      addFooter(doc, { generatedBy: processo.auditor_responsavel || undefined });

      doc.save(`relatorio_auditoria_${processo.auditor_responsavel?.replace(/\s/g, '_') || 'auditoria'}_${new Date().toISOString().split('T')[0]}.pdf`);

      showSuccess('Relatório Exportado!', 'O relatório PDF foi gerado com sucesso.');

    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      showError('Erro ao Exportar PDF', `Ocorreu um erro ao gerar o relatório PDF: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  }, [aeroportos, showSuccess, showError, itensAuditoria, tiposAuditoria]);

  const filteredProcessos = useMemo(() => {
    const filtered = processosAuditoria.filter((proc) => {
      const tipo = tiposAuditoria.find((t) => t.id === proc.tipo_auditoria_id);

      const categoriaMatch = selectedCategoria === 'todos' || tipo?.categoria === selectedCategoria;
      const aeroportoMatch = filtros.aeroporto === 'todos' || proc.aeroporto_id === filtros.aeroporto;
      const statusMatch = filtros.status === 'todos' || proc.status === filtros.status;
      const dataInicioMatch = !filtros.dataInicio || proc.data_auditoria && new Date(proc.data_auditoria) >= new Date(filtros.dataInicio);
      const dataFimMatch = !filtros.dataFim || proc.data_auditoria && new Date(proc.data_auditoria) <= new Date(filtros.dataFim);
      const responsavelMatch = !filtros.responsavel || proc.auditor_responsavel?.toLowerCase().includes(filtros.responsavel.toLowerCase());

      return categoriaMatch && aeroportoMatch && statusMatch && dataInicioMatch && dataFimMatch && responsavelMatch;
    });

    // Aplicar ordenação
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'data_auditoria':
          comparison = new Date(a.data_auditoria || 0) - new Date(b.data_auditoria || 0);
          break;
        case 'numero_auditoria':
          comparison = (a.numero_auditoria || '').localeCompare(b.numero_auditoria || '');
          break;
        case 'conformidade':
          comparison = (a.percentual_conformidade || 0) - (b.percentual_conformidade || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [processosAuditoria, filtros, selectedCategoria, tiposAuditoria, sortField, sortOrder]);

  const filteredPacs = useMemo(() => {
    const filtered = pacs.filter((pac) => {
      const aeroportoMatch = filtros.aeroporto === 'todos' || pac.aeroporto_id === filtros.aeroporto;
      const statusMatch = filtros.status === 'todos' || pac.status === filtros.status;
      const dataInicioMatch = !filtros.dataInicio || pac.data_criacao && new Date(pac.data_criacao) >= new Date(filtros.dataInicio);
      const dataFimMatch = !filtros.dataFim || pac.data_criacao && new Date(pac.data_criacao) <= new Date(filtros.dataFim);
      const responsavelMatch = !filtros.responsavel || pac.responsavel_elaboracao?.toLowerCase().includes(filtros.responsavel.toLowerCase());

      return aeroportoMatch && statusMatch && dataInicioMatch && dataFimMatch && responsavelMatch;
    });

    // Aplicar ordenação
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortFieldPAC) {
        case 'data_criacao':
          comparison = new Date(a.data_criacao || 0) - new Date(b.data_criacao || 0);
          break;
        case 'numero_pac':
          comparison = (a.numero_pac || '').localeCompare(b.numero_pac || '');
          break;
        case 'prazo_conclusao':
          comparison = new Date(a.prazo_conclusao || 0) - new Date(b.prazo_conclusao || 0);
          break;
        case 'progresso':
          comparison = (a.percentual_conclusao || 0) - (b.percentual_conclusao || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          comparison = 0;
      }
      
      return sortOrderPAC === 'asc' ? comparison : -comparison;
    });
  }, [pacs, filtros, sortFieldPAC, sortOrderPAC]);

  const clearFilters = () => {
    setFiltros({
      aeroporto: 'todos',
      status: 'todos',
      dataInicio: '',
      dataFim: '',
      responsavel: ''
    });
    setAlertInfo({ isOpen: false, type: 'info', title: '', message: '' }); // Clear messages when filters are cleared
  };

  const hasActiveFilters = filtros.aeroporto !== 'todos' || filtros.status !== 'todos' || filtros.dataInicio || filtros.dataFim || filtros.responsavel;

  const statusOptions = [
  { value: "todos", label: "Todos" },
  { value: "planejada", label: "Planejada" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "aprovada", label: "Aprovada" }];


  const pacStatusOptions = [
  { value: "todos", label: "Todos" },
  { value: "elaboracao", label: "Em Elaboração" },
  { value: "submetido", label: "Submetido" },
  { value: "aprovado", label: "Aprovado" },
  { value: "em_execucao", label: "Em Execução" },
  { value: "concluido", label: "Concluído" },
  { value: "vencido", label: "Vencido" }];


  // Options for aeroporto combobox, based on user access
  const aeroportoOptions = useMemo(() => [
  { value: 'todos', label: 'Todos os Aeroportos' },
  ...aeroportosAcesso.map((a) => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))],
  [aeroportosAcesso]);


  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Shield className="w-6 md:w-8 h-6 md:h-8 text-indigo-600" />
              Auditoria Interna
            </h1>
            <p className="text-slate-600 mt-1">Sistema de gestão de auditorias baseado em USAP e USOAP</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            {gestaoPermission &&
            <Button variant="outline" onClick={() => setShowConfigModal(true)}> {/* Changed to setShowConfigModal */}
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </Button>
            }
            <Button className="bg-blue-600 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 hover:bg-blue-700" onClick={() => openForm()}>
              <Plus className="w-4 h-4 mr-2" /> Nova Auditoria
            </Button>
          </div>
        </div>

        {currentUser === null && !isLoading &&
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não Autenticado</AlertTitle>
            <AlertDescription>
              Você não está logado ou não tem permissão para acessar algumas funcionalidades. Por favor, faça login.
            </AlertDescription>
          </Alert>
        }

        {alertInfo.isOpen &&
        <Alert variant={alertInfo.type === 'error' ? 'destructive' : 'default'} className="mb-4">
            {alertInfo.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            <AlertTitle>{alertInfo.title}</AlertTitle>
            <AlertDescription>{alertInfo.message}</AlertDescription>
          </Alert>
        }

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Auditorias</p>
                  <p className="text-2xl font-bold text-slate-900">{estatisticas.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Concluídas</p>
                  <p className="text-2xl font-bold text-green-600">{estatisticas.concluidas}</p>
                </div>
                <Shield className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Em Andamento</p>
                  <p className="text-2xl font-bold text-orange-600">{estatisticas.emAndamento}</p>
                </div>
                <Settings className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Conformidade Média</p>
                  <p className="text-2xl font-bold text-blue-600">{estatisticas.conformidadeMedia.toFixed(1)}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Button
            variant={selectedCategoria === 'todos' ? 'default' : 'outline'}
            onClick={() => setSelectedCategoria('todos')}
            className="justify-start h-auto p-3 flex-col gap-2">

            <FileText className="w-5 h-5" />
            <span className="text-xs">Todas</span>
          </Button>
          {Object.entries(CATEGORIAS_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Button
                key={key}
                variant={selectedCategoria === key ? 'default' : 'outline'}
                onClick={() => setSelectedCategoria(key)}
                className="justify-start h-auto p-3 flex-col gap-2">

                <Icon className={`w-5 h-5 ${selectedCategoria === key ? 'text-white' : config.color}`} />
                <span className="text-xs text-center leading-tight">{config.label}</span>
              </Button>);

          })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center mb-6 border-b">
            <TabsList className="grid w-full grid-cols-2 bg-transparent border-b-0 p-0 m-0">
              <TabsTrigger value="processos" className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none -mb-px">
                <ClipboardCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Processos de Auditoria</span>
              </TabsTrigger>
              <TabsTrigger value="pacs" className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none -mb-px">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Planos de Ação Corretiva (PACs)</span>
              </TabsTrigger>
            </TabsList>
            <Button onClick={loadData} variant="outline" className="ml-4 shrink-0">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <TabsContent value="processos" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500" />
                    Filtros de Pesquisa
                  </CardTitle>
                  {hasActiveFilters &&
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                      <X className="w-4 h-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  }
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="filtro-aeroporto">Aeroporto</Label>
                    <Combobox
                      options={aeroportoOptions}
                      value={filtros.aeroporto}
                      onValueChange={(value) => setFiltros((f) => ({ ...f, aeroporto: value || 'todos' }))}
                      placeholder="Todos os Aeroportos"
                      noResultsMessage="Nenhum aeroporto encontrado."
                      searchPlaceholder="Procurar aeroporto..." />

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="filtro-status">Status</Label>
                    <Select
                      id="filtro-status"
                      options={statusOptions}
                      value={filtros.status}
                      onValueChange={(value) => setFiltros((f) => ({ ...f, status: value }))}
                      placeholder="Todos" />

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="filtro-responsavel">Responsável</Label>
                    <Input
                      id="filtro-responsavel"
                      placeholder="Nome do auditor..."
                      value={filtros.responsavel}
                      onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))} />

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="filtro-data-inicio">Data Início</Label>
                    <Input
                      id="filtro-data-inicio"
                      type="date"
                      value={filtros.dataInicio}
                      onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))} />

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="filtro-data-fim">Data Fim</Label>
                    <Input
                      id="filtro-data-fim"
                      type="date"
                      value={filtros.dataFim}
                      onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))} />

                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Processos de Auditoria ({filteredProcessos.length})</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}>
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('grid')}>
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSortOrder}
                      className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      {sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
                    </Button>
                    <Select
                      options={[
                        { value: 'data_auditoria', label: 'Data' },
                        { value: 'numero_auditoria', label: 'Número' },
                        { value: 'conformidade', label: 'Conformidade' },
                        { value: 'status', label: 'Status' }
                      ]}
                      value={sortField}
                      onValueChange={setSortField}
                      placeholder="Ordenar por" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando auditorias...</p>
                  </div>
                ) : filteredProcessos.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                      Nenhuma auditoria encontrada
                    </h3>
                    <p className="text-slate-500">
                      Não há processos de auditoria que correspondam aos filtros selecionados.
                    </p>
                  </div>
                ) : (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
                    {filteredProcessos.map((processo) => {
                      const tipo = tiposAuditoria.find(t => t.id === processo.tipo_auditoria_id);
                      const aeroporto = aeroportos.find(a => a.codigo_icao === processo.aeroporto_id);
                      const categoriaConfig = tipo ? CATEGORIAS_CONFIG[tipo.categoria] : null;
                      
                      const statusConfig = {
                        planejada: { label: 'Planejada', color: 'bg-gray-100 text-gray-800' },
                        em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800' },
                        concluida: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
                        aprovada: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-800' }
                      };
                      
                      const config = statusConfig[processo.status] || statusConfig.planejada;
                      
                      return (
                        <Card
                          key={processo.id}
                          className="hover:shadow-md transition-shadow group"
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => handleViewAuditoria(processo)}>
                                <h3 className="font-semibold text-lg text-slate-900">{processo.numero_auditoria}</h3>
                                <p className="text-slate-600">{tipo?.nome || 'Tipo não encontrado'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={config.color}>{config.label}</Badge>
                                {gestaoPermission && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openForm(processo);
                                      }}
                                      className="h-8 w-8">
                                      <Edit className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteProcessoInfo({ isOpen: true, processo });
                                      }}
                                      className="h-8 w-8">
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className={viewMode === 'grid' ? 'space-y-3 mb-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'}>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm text-slate-500">Aeroporto</p>
                                  <p className="font-medium text-sm">{aeroporto?.nome || processo.aeroporto_id}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <UserIcon className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm text-slate-500">Auditor</p>
                                  <p className="font-medium text-sm">{processo.auditor_responsavel}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm text-slate-500">Data</p>
                                  <p className="font-medium text-sm">
                                    {processo.data_auditoria ? format(new Date(processo.data_auditoria), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm text-slate-500">Conformidade</p>
                                  <p className="font-medium text-sm">{(processo.percentual_conformidade || 0).toFixed(1)}%</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                              <span>{processo.total_itens || 0} itens</span>
                              <span className="text-green-600">{processo.itens_conformes || 0} conformes</span>
                              <span className="text-red-600">{processo.itens_nao_conformes || 0} NC</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="pacs" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500" />
                    Filtros de Pesquisa
                  </CardTitle>
                  {hasActiveFilters &&
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                      <X className="w-4 h-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  }
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="filtro-aeroporto-pac">Aeroporto</Label>
                    <Combobox
                      options={aeroportoOptions}
                      value={filtros.aeroporto}
                      onValueChange={(value) => setFiltros((f) => ({ ...f, aeroporto: value || 'todos' }))}
                      placeholder="Todos os Aeroportos"
                      noResultsMessage="Nenhum aeroporto encontrado."
                      searchPlaceholder="Procurar aeroporto..." />

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="filtro-status-pac">Status</Label>
                    <Select
                      id="filtro-status-pac"
                      options={pacStatusOptions}
                      value={filtros.status}
                      onValueChange={(value) => setFiltros((f) => ({ ...f, status: value }))}
                      placeholder="Todos" />

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="filtro-responsavel-pac">Responsável</Label>
                    <Input
                      id="filtro-responsavel-pac"
                      placeholder="Nome do responsável..."
                      value={filtros.responsavel}
                      onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))} />

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="filtro-data-inicio-pac">Data Criação Início</Label>
                    <Input
                      id="filtro-data-inicio-pac"
                      type="date"
                      value={filtros.dataInicio}
                      onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))} />

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="filtro-data-fim-pac">Data Criação Fim</Label>
                    <Input
                      id="filtro-data-fim-pac"
                      type="date"
                      value={filtros.dataFim}
                      onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))} />

                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Planos de Ação Corretiva ({filteredPacs.length})</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={viewModePAC === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewModePAC('list')}>
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewModePAC === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewModePAC('grid')}>
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSortOrderPAC}
                      className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      {sortOrderPAC === 'asc' ? 'Crescente' : 'Decrescente'}
                    </Button>
                    <Select
                      options={[
                        { value: 'data_criacao', label: 'Data Criação' },
                        { value: 'numero_pac', label: 'Número' },
                        { value: 'prazo_conclusao', label: 'Prazo' },
                        { value: 'progresso', label: 'Progresso' },
                        { value: 'status', label: 'Status' }
                      ]}
                      value={sortFieldPAC}
                      onValueChange={setSortFieldPAC}
                      placeholder="Ordenar por" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ?
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando PACs...</p>
                  </div> :
                filteredPacs.length === 0 ?
                <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                      Nenhum PAC encontrado
                    </h3>
                    <p className="text-slate-500">
                      Não há Planos de Ação Corretiva que correspondam aos filtros selecionados.
                    </p>
                  </div> :

                <div className={viewModePAC === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
                    {filteredPacs.map((pac) => {
                    const aeroporto = aeroportos.find((a) => a.codigo_icao === pac.aeroporto_id);
                    const processo = processosAuditoria.find((p) => p.id === pac.processo_auditoria_id);
                    const tipo = processo ? tiposAuditoria.find((t) => t.id === processo.tipo_auditoria_id) : null;

                    const statusConfig = {
                      elaboracao: { label: 'Em Elaboração', color: 'bg-gray-100 text-gray-800' },
                      submetido: { label: 'Submetido', color: 'bg-blue-100 text-blue-800' },
                      aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
                      em_execucao: { label: 'Em Execução', color: 'bg-orange-100 text-orange-800' },
                      concluido: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-800' },
                      vencido: { label: 'Vencido', color: 'bg-red-100 text-red-800' }
                    };

                    const config = statusConfig[pac.status] || statusConfig.elaboracao;

                    return (
                      <Card
                        key={pac.id}
                        className="hover:shadow-md transition-shadow group">

                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => handleEditPAC(pac)}>
                                <h3 className="font-semibold text-lg text-slate-900">{pac.numero_pac}</h3>
                                <p className="text-slate-600 capitalize">
                                  {pac.tipo === 'formal_anac' ? 'Formal ANAC' : 'Interno'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={config.color}>
                                  {config.label}
                                </Badge>
                                {gestaoPermission && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditPAC(pac);
                                      }}
                                      className="h-8 w-8">
                                      <Edit className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletePACInfo({ isOpen: true, pac });
                                      }}
                                      className="h-8 w-8">
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className={viewModePAC === 'grid' ? 'space-y-3 mb-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'}>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm text-slate-500">Aeroporto</p>
                                  <p className="font-medium text-sm">{aeroporto?.nome || pac.aeroporto_id}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <UserIcon className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm text-slate-500">Responsável</p>
                                  <p className="font-medium text-sm">{pac.responsavel_elaboracao}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm text-slate-500">Prazo</p>
                                  <p className="font-medium text-sm">
                                    {pac.prazo_conclusao ? format(new Date(pac.prazo_conclusao), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm text-slate-500">Progresso</p>
                                  <p className="font-medium text-sm">{(pac.percentual_conclusao || 0).toFixed(0)}%</p>
                                </div>
                              </div>
                            </div>

                            {tipo && processo &&
                          <div className="mb-4">
                                <p className="text-sm text-slate-500 mb-1">Auditoria Relacionada</p>
                                <p className="font-medium text-sm">{tipo.nome} ({processo.numero_auditoria})</p>
                              </div>
                          }

                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                              <span>{pac.total_nao_conformidades || 0} NC</span>
                              <span>{pac.nao_conformidades_concluidas || 0} concluídas</span>
                              <span className="text-xs">Criado em {format(new Date(pac.data_criacao), 'dd/MM/yyyy', { locale: pt })}</span>
                            </div>
                          </CardContent>
                        </Card>);

                  })}
                  </div>
                }
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {showFormProcesso &&
        <FormProcessoAuditoria
          isOpen={showFormProcesso}
          onClose={() => {
            setShowFormProcesso(false);
            setEditingProcesso(null);
          }}
          tipos={tiposAuditoria}
          aeroportos={aeroportosAcesso} // Pass filtered aeroportos
          onSubmit={handleProcessoFormSubmit}
          processoInicial={editingProcesso} />

        }

        {showDetailModal && selectedProcesso &&
        <AuditoriaDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedProcesso(null);
          }}
          processo={selectedProcesso}
          tipo={tiposAuditoria.find((t) => t.id === selectedProcesso.tipo_auditoria_id)}
          aeroporto={aeroportos.find((a) => a.codigo_icao === selectedProcesso.aeroporto_id)}
          onCreatePAC={handleCreatePAC}
          onExportPDF={handleExportPDF} />

        }

        {showChecklistModal && selectedProcesso &&
        <FormChecklist
          isOpen={showChecklistModal}
          onClose={() => {
            setShowChecklistModal(false);
            setSelectedProcesso(null);
          }}
          processo={selectedProcesso}
          onUpdate={handleChecklistComplete}
          currentUser={currentUser} />

        }

        {showFormPAC &&
        <FormPAC
          isOpen={showFormPAC}
          onClose={() => {
            setShowFormPAC(false);
            setSelectedProcesso(null);
            setEditingPAC(null);
            setNonConformitiesForPAC([]);
          }}
          processoAuditoria={selectedProcesso}
          aeroporto={aeroportos.find((a) => a.codigo_icao === (selectedProcesso?.aeroporto_id || editingPAC?.aeroporto_id))}
          onSubmit={handleSuccess}
          naoConformidades={nonConformitiesForPAC}
          pacInicial={editingPAC} />

        }

        {showConfigModal &&
        <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configurações de Auditoria</DialogTitle>
              </DialogHeader>
              <ConfiguracaoAuditoria
              tipos={tiposAuditoria}
              onUpdate={handleSuccess} />

            </DialogContent>
          </Dialog>
        }

        <AlertModal
          isOpen={deleteProcessoInfo.isOpen}
          onClose={() => setDeleteProcessoInfo({ isOpen: false, processo: null })}
          onConfirm={handleDeleteProcesso}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir a auditoria "${deleteProcessoInfo.processo?.numero_auditoria}"? Esta ação não pode ser desfeita.`}
          type="warning"
          confirmText="Excluir"
          showCancel />

        <AlertModal
          isOpen={deletePACInfo.isOpen}
          onClose={() => setDeletePACInfo({ isOpen: false, pac: null })}
          onConfirm={handleDeletePAC}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir o PAC "${deletePACInfo.pac?.numero_pac}"? Esta ação não pode ser desfeita.`}
          type="warning"
          confirmText="Excluir"
          showCancel />

      </div>
    </div>);

}