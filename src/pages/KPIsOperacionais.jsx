import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Filter, X, FileDown, Search, Settings, ClipboardCheck, Download, FileText, Mail, Trash2, AlertTriangle, BarChart3, Brain, FileEdit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import { TipoKPI } from '@/entities/TipoKPI';
import { CampoKPI } from '@/entities/CampoKPI';
import { MedicaoKPI } from '@/entities/MedicaoKPI';
import { ValorCampoKPI } from '@/entities/ValorCampoKPI';
import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { User } from '@/entities/User'; // Added User import

import FormMedicaoKPI from '../components/kpis/FormMedicaoKPI';
import ConfiguracaoKPIs from '../components/kpis/ConfiguracaoKPIs';
import DiagnosticoDuplicacoesModal from '../components/kpis/DiagnosticoDuplicacoesModal';
import AnalisadorInteligente from '../components/kpis/AnalisadorInteligente';
import AssistenteRelatorio from '../components/shared/AssistenteRelatorio';
import DashboardKPIs from '../components/kpis/DashboardKPIs';
import { downloadAsExcel } from '@/components/lib/export';
import AlertModal from '@/components/shared/AlertModal';
import SuccessModal from '@/components/shared/SuccessModal';
import SendEmailModal from '@/components/shared/SendEmailModal';
import { registarExclusao, registarExportacao } from '@/components/lib/auditoria';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import SortableTableHeader from '@/components/shared/SortableTableHeader';

const CATEGORIA_COLORS = {
  operacional: 'bg-blue-100 text-blue-800',
  qualidade: 'bg-green-100 text-green-800',
  seguranca: 'bg-red-100 text-red-800',
  eficiencia: 'bg-purple-100 text-purple-800'
};

export default function KPIsOperacionais() {
  const [currentUser, setCurrentUser] = useState(null); // Added currentUser state
  const [tiposKPI, setTiposKPI] = useState([]);
  const [medicoesKPI, setMedicoesKPI] = useState([]); // Changed from medicoes to medicoesKPI
  const [aeroportos, setAeroportos] = useState([]);
  const [companhias, setCompanhias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDiagnosticoOpen, setIsDiagnosticoOpen] = useState(false);
  const [isAnalisadorOpen, setIsAnalisadorOpen] = useState(false);
  const [isAssistenteOpen, setIsAssistenteOpen] = useState(false);
  const [selectedTipoKPI, setSelectedTipoKPI] = useState(null);
  const [editingMedicao, setEditingMedicao] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, id: null });
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('medicoes');
  const [selectedMedicoes, setSelectedMedicoes] = useState([]);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // NOVO: Estado para ordenação da tabela
  const [sortField, setSortField] = useState('data_medicao');
  const [sortDirection, setSortDirection] = useState('desc');

  const [filtros, setFiltros] = useState({
    aeroporto: 'todos',
    tipoKpi: 'todos',
    dataInicio: '',
    dataFim: '',
    numeroVoo: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedMedicoes([]); // Limpar seleção ao mudar os filtros
  }, [filtros]);

  // NOVO: Função para lidar com ordenação
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc'); // Default to ascending when changing field
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const [tiposData, medicoesData, aeroportosData, companhiasData] = await Promise.all([
      TipoKPI.list(),
      MedicaoKPI.list('-data_medicao'),
      Aeroporto.list(),
      CompanhiaAerea.list()]
      );

      const aeroportosAngola = aeroportosData.filter((a) => a.pais === 'AO');

      // Filtrar aeroportos pelos aeroportos de acesso do utilizador
      let aeroportosFiltrados = aeroportosAngola;
      if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
        if (user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso) && user.aeroportos_acesso.length > 0) {
          const userIcaoCodes = new Set(user.aeroportos_acesso.map((code) => code.trim().toUpperCase()));
          aeroportosFiltrados = aeroportosAngola.filter((a) => userIcaoCodes.has(a.codigo_icao?.trim().toUpperCase()));
        } else {
          aeroportosFiltrados = [];
        }
      }

      setAeroportos(aeroportosFiltrados);
      setTiposKPI(tiposData);
      setCompanhias(companhiasData);

      // Filtrar medições pelos aeroportos de acesso do utilizador
      let medicoesFiltradas = medicoesData;
      if (user.role !== 'admin' && !(user.perfis && user.perfis.includes('administrador'))) {
        if (user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso) && user.aeroportos_acesso.length > 0) {
          const aeroportosPermitidosIcao = new Set(user.aeroportos_acesso.map((code) => code.trim().toUpperCase()));
          medicoesFiltradas = medicoesData.filter((m) => aeroportosPermitidosIcao.has(m.aeroporto_id?.trim().toUpperCase()));
        } else {
          medicoesFiltradas = [];
        }
      }

      setMedicoesKPI(medicoesFiltradas); // Set the filtered measurements
    } catch (error) {
      console.error("Erro ao carregar dados dos KPIs:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro de Carregamento',
        message: 'Não foi possível carregar os dados dos KPIs. Tente novamente.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNovaMedicao = (tipoKPI) => {
    setSelectedTipoKPI(tipoKPI);
    setEditingMedicao(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingMedicao) {
        await MedicaoKPI.update(editingMedicao.id, data.medicao);
        // Atualizar valores dos campos
        await Promise.all(data.valores.map((valor) => {
          if (valor.id) {
            return ValorCampoKPI.update(valor.id, valor);
          } else {
            return ValorCampoKPI.create({ ...valor, medicao_kpi_id: editingMedicao.id });
          }
        }));
        setSuccessInfo({ isOpen: true, title: 'Sucesso!', message: 'Medição atualizada com sucesso.' });
      } else {
        const novaMedicao = await MedicaoKPI.create(data.medicao);
        // Criar valores dos campos
        await Promise.all(data.valores.map((valor) =>
        ValorCampoKPI.create({ ...valor, medicao_kpi_id: novaMedicao.id })
        ));
        setSuccessInfo({ isOpen: true, title: 'Sucesso!', message: 'Medição registada com sucesso.' });
      }
      setIsFormOpen(false);
      setSelectedTipoKPI(null);
      setEditingMedicao(null);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar medição:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Salvar',
        message: 'Não foi possível salvar a medição. Verifique os dados e tente novamente.'
      });
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteInfo({ isOpen: true, id });
  };

  const handleDeleteConfirm = async () => {
    try {
      const medicaoParaExcluir = medicoesKPI.find((m) => m.id === deleteInfo.id); // Changed medicoes to medicoesKPI

      if (medicaoParaExcluir) {
        // Primeiro excluir os valores dos campos associados
        const valoresAssociados = await ValorCampoKPI.filter({ medicao_kpi_id: deleteInfo.id });
        await Promise.all(valoresAssociados.map((valor) => ValorCampoKPI.delete(valor.id)));

        // Depois excluir a medição
        await MedicaoKPI.delete(deleteInfo.id);

        // Registar para auditoria
        await registarExclusao('MedicaoKPI', medicaoParaExcluir, 'kpis');

        setSuccessInfo({ isOpen: true, title: 'Sucesso!', message: 'Medição excluída com sucesso.' });
        loadData();
      }
    } catch (error) {
      console.error("Erro ao excluir medição:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Excluir',
        message: 'Não foi possível excluir a medição. Tente novamente.'
      });
    } finally {
      setDeleteInfo({ isOpen: false, id: null });
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedMedicoes.length === 0) {
      setAlertInfo({ isOpen: true, type: 'warning', title: 'Nenhuma Seleção', message: 'Nenhuma medição selecionada para excluir.' });
      setIsBulkDeleteModalOpen(false);
      return;
    }

    try {
      for (const medicaoId of selectedMedicoes) {
        // Encontrar a medição completa para auditoria
        const medicaoParaExcluir = medicoesKPI.find((m) => m.id === medicaoId); // Changed medicoes to medicoesKPI

        // Excluir valores de campos associados
        const valoresAssociados = await ValorCampoKPI.filter({ medicao_kpi_id: medicaoId });
        await Promise.all(valoresAssociados.map((valor) => ValorCampoKPI.delete(valor.id)));

        // Excluir a medição principal
        await MedicaoKPI.delete(medicaoId);

        if (medicaoParaExcluir) {
          await registarExclusao('MedicaoKPI', medicaoParaExcluir, 'kpis');
        }
      }

      setSuccessInfo({ isOpen: true, title: 'Sucesso!', message: `${selectedMedicoes.length} medições foram excluídas com sucesso.` });
      setSelectedMedicoes([]);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir medições em massa:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Excluir',
        message: 'Não foi possível excluir as medições selecionadas. Tente novamente.'
      });
    } finally {
      setIsBulkDeleteModalOpen(false);
    }
  };


  const handleExportExcel = async () => {
    try {
      const dataToExport = filteredAndSortedMedicoes.map((medicao) => {
        const tipoKPI = tiposKPI.find((t) => t.id === medicao.tipo_kpi_id);
        const aeroporto = aeroportos.find((a) => a.codigo_icao === medicao.aeroporto_id);

        return {
          'Tipo KPI': tipoKPI?.nome || 'N/A',
          'Categoria': tipoKPI?.categoria || 'N/A',
          'Aeroporto': aeroporto?.nome || medicao.aeroporto_id,
          'Data': format(new Date(medicao.data_medicao), 'dd/MM/yyyy', { locale: pt }),
          'Número do Voo': medicao.numero_voo || '-',
          'Companhia': medicao.companhia_aerea_codigo_icao || '-',
          'Responsável': medicao.responsavel_medicao,
          'Turno': medicao.turno,
          'Hora Início': medicao.hora_inicio,
          'Hora Fim': medicao.hora_fim,
          'Resultado': medicao.resultado_principal || '-',
          'Unidade': tipoKPI?.unidade_medida || '',
          'Meta': tipoKPI?.meta_objetivo || '-',
          'Dentro da Meta': medicao.dentro_da_meta ? 'Sim' : 'Não',
          'Observações': medicao.observacoes_gerais || '-'
        };
      });

      await registarExportacao('MedicaoKPI', 'Excel', filtros, 'kpis');
      downloadAsExcel(dataToExport, `kpis_operacionais_${new Date().toISOString().split('T')[0]}`);

      setSuccessInfo({
        isOpen: true,
        title: 'Exportação Concluída',
        message: `Exportados ${dataToExport.length} registos para Excel.`
      });
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro na Exportação',
        message: 'Não foi possível exportar os dados. Tente novamente.'
      });
    }
  };

  const handleExportPDF = async (medicoesFiltradas = null, filtrosDashboard = null) => {
    setIsExportingPDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      
      // Usar medições filtradas se fornecidas, caso contrário usar as da página
      const medicoesParaPDF = medicoesFiltradas || filteredAndSortedMedicoes;
      const filtrosParaPDF = filtrosDashboard || filtros;
      
      // Registar exportação após importação bem-sucedida
      await registarExportacao('MedicaoKPI', 'PDF', filtrosParaPDF, 'kpis');

      const doc = new jsPDF('p', 'mm', 'a4');
      const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png';

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Função para adicionar cabeçalho
      const addHeader = () => {
        try {
          doc.addImage(logoUrl, 'PNG', 15, 10, 40, 14);
        } catch (imgError) {
          console.warn('Erro ao adicionar logo, continuando sem logo:', imgError);
        }
        doc.setFillColor(0, 74, 153);
        doc.rect(0, 0, pageWidth, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('DIROPS-SGA | Relatório de KPIs Operacionais', pageWidth / 2, 5, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      };

      // Função para adicionar rodapé
      const addFooter = (pageNum) => {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString('pt-PT')}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
      };

      // Primeira página - Sumário
      addHeader();
      yPosition = 35;

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 74, 153);
      doc.text('Relatório de Performance de KPIs', 15, yPosition);
      
      yPosition += 12;
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.setFont(undefined, 'normal');
      
      const dataInicioTexto = filtrosParaPDF.dataInicio ? format(new Date(filtrosParaPDF.dataInicio), 'dd/MM/yyyy', { locale: pt }) : 'Início';
      const dataFimTexto = filtrosParaPDF.dataFim ? format(new Date(filtrosParaPDF.dataFim), 'dd/MM/yyyy', { locale: pt }) : 'Hoje';
      doc.text(`Período: ${dataInicioTexto} - ${dataFimTexto}`, 15, yPosition);
      
      yPosition += 6;
      
      // Adicionar informação do aeroporto
      if (filtrosParaPDF.aeroporto === 'todos') {
        doc.text('Aeroportos: Todos', 15, yPosition);
      } else {
        const aeroportoSelecionado = aeroportos.find(a => a.codigo_icao === filtrosParaPDF.aeroporto);
        if (aeroportoSelecionado) {
          doc.text(`Aeroporto: ${aeroportoSelecionado.nome} (${aeroportoSelecionado.codigo_icao})`, 15, yPosition);
        }
      }
      
      yPosition += 9;

      // Cards de resumo
      const totalMedicoes = medicoesParaPDF.length;
      const dentroMeta = medicoesParaPDF.filter(m => m.dentro_da_meta).length;
      const percentualGeral = totalMedicoes > 0 ? ((dentroMeta / totalMedicoes) * 100).toFixed(1) : 0;

      // Card Total
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(15, yPosition, 58, 25, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('Total de Medições', 44, yPosition + 8, { align: 'center' });
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text(totalMedicoes.toString(), 44, yPosition + 18, { align: 'center' });

      // Card Dentro da Meta
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(78, yPosition, 58, 25, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Dentro da Meta', 107, yPosition + 8, { align: 'center' });
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text(dentroMeta.toString(), 107, yPosition + 18, { align: 'center' });

      // Card Performance
      doc.setFillColor(139, 92, 246);
      doc.roundedRect(141, yPosition, 58, 25, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Performance Geral', 170, yPosition + 8, { align: 'center' });
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text(`${percentualGeral}%`, 170, yPosition + 18, { align: 'center' });

      yPosition += 35;

      // Título da seção de KPIs
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Análise Individual dos KPIs', 15, yPosition);
      yPosition += 10;

      // Agrupar medições por tipo de KPI
      const medicoesPorTipo = {};
      tiposKPI.forEach(tipo => {
        const medicoesDoTipo = medicoesParaPDF.filter(m => m.tipo_kpi_id === tipo.id);
        if (medicoesDoTipo.length > 0) {
          const dentroDaMeta = medicoesDoTipo.filter(m => m.dentro_da_meta === true).length;
          const resultados = medicoesDoTipo
            .filter(m => m.resultado_principal !== null && m.resultado_principal !== undefined)
            .map(m => m.resultado_principal);
          const media = resultados.length > 0 ? resultados.reduce((acc, val) => acc + val, 0) / resultados.length : 0;
          
          medicoesPorTipo[tipo.id] = {
            tipo,
            total: medicoesDoTipo.length,
            dentroDaMeta,
            percentual: medicoesDoTipo.length > 0 ? ((dentroDaMeta / medicoesDoTipo.length) * 100).toFixed(0) : 0,
            mediaResultado: media
          };
        }
      });

      let pageNum = 1;
      let cardCount = 0;

      // Desenhar cards dos KPIs
      Object.values(medicoesPorTipo).sort((a, b) => a.tipo.nome.localeCompare(b.tipo.nome)).forEach((item, index) => {
        const cardWidth = 90;
        const cardHeight = 45;
        const col = cardCount % 2;
        const xPos = 15 + (col * (cardWidth + 10));

        // Nova página se necessário
        if (yPosition + cardHeight > pageHeight - 25) {
          addFooter(pageNum);
          doc.addPage();
          addHeader();
          pageNum++;
          yPosition = 35;
          cardCount = 0;
        }

        const percentual = parseFloat(item.percentual);
        const color = item.tipo.cor_identificacao || '#3B82F6';
        
        // Converter hex para RGB
        const hexToRgb = (hex) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : { r: 59, g: 130, b: 246 };
        };

        const rgb = hexToRgb(color);

        // Card background
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(xPos, yPosition, cardWidth, cardHeight, 2, 2, 'F');
        
        // Borda colorida esquerda
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(xPos, yPosition, 3, cardHeight);

        // Título do KPI
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        const kpiNome = item.tipo.nome.length > 30 ? item.tipo.nome.substring(0, 30) + '...' : item.tipo.nome;
        doc.text(kpiNome, xPos + 5, yPosition + 6);

        // Informações
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(80, 80, 80);
        
        doc.text('Total Medições:', xPos + 5, yPosition + 13);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(item.total.toString(), xPos + cardWidth - 5, yPosition + 13, { align: 'right' });

        doc.setFont(undefined, 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Dentro da Meta:', xPos + 5, yPosition + 19);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(item.dentroDaMeta.toString(), xPos + cardWidth - 5, yPosition + 19, { align: 'right' });

        doc.setFont(undefined, 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Tempo Médio:', xPos + 5, yPosition + 25);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(`${item.mediaResultado.toFixed(1)} ${item.tipo.unidade_medida || ''}`, xPos + cardWidth - 5, yPosition + 25, { align: 'right' });

        doc.setFont(undefined, 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Meta:', xPos + 5, yPosition + 31);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        const metaTexto = item.tipo.meta_objetivo !== null ? `${item.tipo.meta_objetivo} ${item.tipo.unidade_medida || ''}` : 'N/A';
        doc.text(metaTexto, xPos + cardWidth - 5, yPosition + 31, { align: 'right' });

        doc.setFont(undefined, 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Performance:', xPos + 5, yPosition + 37);
        
        // Badge de performance
        const badgeColor = percentual >= 80 ? [16, 185, 129] : percentual >= 60 ? [245, 158, 11] : [239, 68, 68];
        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.roundedRect(xPos + cardWidth - 25, yPosition + 34, 20, 6, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text(`${percentual}%`, xPos + cardWidth - 15, yPosition + 38, { align: 'center' });

        // Barra de progresso
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(xPos + 5, yPosition + 41, cardWidth - 10, 2, 1, 1, 'F');
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        const progressWidth = ((cardWidth - 10) * percentual) / 100;
        doc.roundedRect(xPos + 5, yPosition + 41, progressWidth, 2, 1, 1, 'F');

        cardCount++;
        if (col === 1) {
          yPosition += cardHeight + 5;
        }
      });

      addFooter(pageNum);

      doc.save(`relatorio_kpis_${new Date().toISOString().split('T')[0]}.pdf`);

      setSuccessInfo({
        isOpen: true,
        title: 'PDF Gerado',
        message: 'O relatório PDF profissional foi gerado com sucesso.'
      });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro na Exportação',
        message: 'Não foi possível gerar o PDF. Verifique a consola para mais detalhes.'
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleSendEmail = async (destinatario, assunto) => {
    if (selectedMedicoes.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Nenhuma Seleção',
        message: 'Por favor, selecione pelo menos uma medição para enviar por e-mail.'
      });
      return false;
    }

    try {
      const medicoesParaEnviar = medicoesKPI.filter((m) => selectedMedicoes.includes(m.id)); // Changed medicoes to medicoesKPI
      const tiposKPIMap = new Map(tiposKPI.map((t) => [t.id, t]));
      const aeroportosMap = new Map(aeroportos.map((a) => [a.codigo_icao, a]));

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; color: #333;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/563d28706_logoSGA.png" alt="SGA Logo" style="height: 60px;">
            <h1 style="color: #1e40af; margin-top: 20px;">DIROPS-SGA</h1>
            <h2 style="color: #1e40af; margin: 10px 0;">Relatório de KPIs Operacionais</h2>
            <p style="color: #64748b; margin-bottom: 10px;">Data de Geração: ${new Date().toLocaleDateString('pt-AO')}</p>
            <p style="color: #64748b;">Total de Medições: ${medicoesParaEnviar.length}</p>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">KPI</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">Aeroporto</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">Data</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">Início</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">Fim</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">Voo</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">Responsável</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">Resultado</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #e2e8f0;">Meta</th>
                </tr>
              </thead>
              <tbody>
                ${medicoesParaEnviar.map((medicao, index) => {
        const tipo = tiposKPIMap.get(medicao.tipo_kpi_id);
        const aeroporto = aeroportosMap.get(medicao.aeroporto_id);
        const resultadoTexto = medicao.resultado_inicio !== undefined && medicao.resultado_inicio !== null &&
        medicao.resultado_fim !== undefined && medicao.resultado_fim !== null ?
        `${medicao.resultado_inicio} - ${medicao.resultado_fim} ${tipo?.unidade_medida || ''}` :
        medicao.resultado_principal !== null ?
        `${medicao.resultado_principal} ${tipo?.unidade_medida || ''}` :
        '-';
        return `
                  <tr style="border-bottom: 1px solid #e2e8f0; ${index % 2 === 0 ? 'background-color: #fafafa;' : ''}">
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0;">${tipo?.nome || 'N/A'}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0;">${aeroporto?.codigo_icao || medicao.aeroporto_id}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0;">${format(new Date(medicao.data_medicao), 'dd/MM/yyyy', { locale: pt })}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0;">${medicao.hora_inicio || '-'}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0;">${medicao.hora_fim || '-'}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0;">${medicao.numero_voo || '-'}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0;">${medicao.responsavel_medicao || '-'}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${resultadoTexto}</td>
                    <td style="padding: 10px 8px; border: 1px solid #e2e8f0; color: ${medicao.dentro_da_meta ? '#16a34a' : '#dc2626'}; font-weight: bold;">${medicao.dentro_da_meta ? 'Dentro' : 'Fora'}</td>
                  </tr>`;
      }).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p><strong>Melhores Cumprimentos,</strong></p>
            <p>Sistema DIROPS-SGA<br>Direcção de Operações</p>
          </div>
        </div>
      `;

      const result = await sendEmailDirect({
        to: destinatario,
        subject: assunto,
        body: emailBody,
        from_name: 'DIROPS-SGA'
      });

      if (result.status !== 200) {
        const errorData = result.data || { error: 'Falha desconhecida no backend' };

        // Analisar o tipo de erro e criar mensagem personalizada
        let errorTitle = 'Erro ao Enviar E-mail';
        let errorMessage = '';

        if (errorData.error && errorData.error.includes('Cannot send emails to users outside the app')) {
          errorTitle = 'Destinatário Não Autorizado';
          errorMessage = `Não foi possível enviar o relatório para "${destinatario}". 

O sistema apenas permite o envio de e-mails para utilizadores registados na aplicação DIROPS-SGA.

Soluções:
• Registe o destinatário como utilizador no sistema
• Contacte o administrador para mais informações
• Use um endereço de e-mail já registado no sistema`;
        } else if (errorData.error && (errorData.error.includes('timeout') || errorData.error.includes('network'))) {
          errorTitle = 'Problema de Conectividade';
          errorMessage = `Não foi possível enviar o e-mail devido a um problema de conexão.

Por favor:
• Verifique a sua ligação à internet
• Tente novamente dentro de alguns minutos
• Se o problema persistir, contacte o suporte técnico`;
        } else if (errorData.error && errorData.error.includes('invalid email')) {
          errorTitle = 'Endereço de E-mail Inválido';
          errorMessage = `O endereço de e-mail "${destinatario}" não é válido.

Por favor:
• Verifique se o endereço está escrito correctamente
• Certifique-se de que contém @ e um domínio válido
• Tente com um endereço diferente`;
        } else {
          errorTitle = 'Erro no Envio';
          errorMessage = `Não foi possível enviar o e-mail para "${destinatario}".

Detalhes técnicos: ${errorData.error || 'Erro desconhecido'}

Por favor tente novamente ou contacte o suporte técnico se o problema persistir.`;
        }

        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: errorTitle,
          message: errorMessage
        });
        return false;
      }

      setSuccessInfo({
        isOpen: true,
        title: 'E-mail Enviado com Sucesso',
        message: `O relatório de KPIs foi enviado com sucesso para "${destinatario}".`
      });
      return true;

    } catch (error) {
      console.error("Erro detalhado ao enviar email:", error);

      // Tratamento de erros de conexão/rede
      let errorTitle = 'Erro ao Enviar E-mail';
      let errorMessage = '';

      if (error.message && error.message.includes('fetch')) {
        errorTitle = 'Problema de Conectividade';
        errorMessage = `Não foi possível estabelecer conexão com o servidor de e-mail.

Por favor:
• Verifique a sua ligação à internet
• Tente novamente dentro de alguns minutos
• Se o problema persistir, contacte o suporte técnico`;
      } else {
        errorMessage = `Ocorreu um erro inesperado ao enviar o e-mail para "${destinatario}".

Detalhes: ${error.message || 'Erro desconhecido'}

Por favor tente novamente ou contacte o suporte técnico.`;
      }

      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: errorTitle,
        message: errorMessage
      });
      return false;
    }
  };

  const handleFilterChange = (field, value) => {
    setFiltros((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFiltros({
      aeroporto: 'todos',
      tipoKpi: 'todos',
      dataInicio: '',
      dataFim: '',
      numeroVoo: ''
    });
  };

  const hasActiveFilters = useMemo(() => Object.values(filtros).some((value) => value !== '' && value !== 'todos'), [filtros]);

  const handleSelectMedicao = (id) => {
    setSelectedMedicoes((prev) =>
    prev.includes(id) ? prev.filter((medId) => medId !== id) : [...prev, id]
    );
  };

  // NOVO: Filtrar e ordenar medições
  const filteredAndSortedMedicoes = useMemo(() => {
    let result = medicoesKPI.filter((medicao) => {
      const aeroportoMatch = filtros.aeroporto === 'todos' || medicao.aeroporto_id === filtros.aeroporto;
      const tipoKpiMatch = filtros.tipoKpi === 'todos' || medicao.tipo_kpi_id === filtros.tipoKpi;
      const numeroVooMatch = filtros.numeroVoo === '' || medicao.numero_voo?.toLowerCase().includes(filtros.numeroVoo.toLowerCase());
      const dataMatch = (!filtros.dataInicio || medicao.data_medicao >= filtros.dataInicio) && (
      !filtros.dataFim || medicao.data_medicao <= filtros.dataFim);

      return aeroportoMatch && tipoKpiMatch && numeroVooMatch && dataMatch;
    });

    // Aplicar ordenação
    result.sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'data_medicao':
          aValue = new Date(a.data_medicao).getTime();
          bValue = new Date(b.data_medicao).getTime();
          break;
        case 'tipo_kpi':
          const tipoA = tiposKPI.find((t) => t.id === a.tipo_kpi_id);
          const tipoB = tiposKPI.find((t) => t.id === b.tipo_kpi_id);
          aValue = tipoA?.nome || '';
          bValue = tipoB?.nome || '';
          break;
        case 'aeroporto':
          const aeroportoA = aeroportos.find((ap) => ap.codigo_icao === a.aeroporto_id);
          const aeroportoB = aeroportos.find((ap) => ap.codigo_icao === b.aeroporto_id);
          aValue = aeroportoA?.codigo_icao || '';
          bValue = aeroportoB?.codigo_icao || '';
          break;
        case 'numero_voo':
          aValue = a.numero_voo || '';
          bValue = b.numero_voo || '';
          break;
        case 'resultado':
          // Prioritize resultado_principal, then inicio. Default to 0 for consistent comparison.
          const getNumericResult = (med) => {
            if (med.resultado_principal !== null && med.resultado_principal !== undefined) return med.resultado_principal;
            if (med.resultado_inicio !== null && med.resultado_inicio !== undefined) return med.resultado_inicio;
            return 0;
          };
          aValue = getNumericResult(a);
          bValue = getNumericResult(b);
          break;
        case 'meta':
          aValue = a.dentro_da_meta ? 1 : 0;
          bValue = b.dentro_da_meta ? 1 : 0;
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      if (sortDirection === 'asc') {
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue);
        }
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return bValue.localeCompare(aValue);
        }
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return result;
  }, [medicoesKPI, filtros, sortField, sortDirection, tiposKPI, aeroportos]);

  const allSelectedOnPage = filteredAndSortedMedicoes.length > 0 && selectedMedicoes.length === filteredAndSortedMedicoes.length;

  const aeroportoOptions = useMemo(() => [
  { value: 'todos', label: 'Todos os Aeroportos' },
  ...aeroportos.map((a) => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))],
  [aeroportos]);

  const tipoKpiOptions = useMemo(() => [
  { value: 'todos', label: 'Todos os KPIs' },
  ...tiposKPI.map((tipo) => ({ value: tipo.id, label: tipo.nome }))],
  [tiposKPI]);

  // NOVO: Ordenar tipos de KPI para a seleção (por categoria e nome)
  const sortedTiposKPI = useMemo(() => {
    return [...tiposKPI].
    filter((t) => t.status === 'ativo').
    sort((a, b) => {
      // Primeiro ordenar por categoria
      const categoriaOrder = { operacional: 1, qualidade: 2, seguranca: 3, eficiencia: 4 };
      const catA = categoriaOrder[a.categoria] || 999;
      const catB = categoriaOrder[b.categoria] || 999;

      if (catA !== catB) {
        return catA - catB;
      }

      // Depois ordenar por nome
      return a.nome.localeCompare(b.nome, 'pt');
    });
  }, [tiposKPI]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedMedicoes(filteredAndSortedMedicoes.map((m) => m.id));
    } else {
      setSelectedMedicoes([]);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              KPIs Operacionais
            </h1>
            <p className="text-slate-600 mt-1">Gestão dinâmica das medições de desempenho operacional</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button variant="outline" onClick={() => setEmailModalOpen(true)} disabled={selectedMedicoes.length === 0}>
              <Mail className="w-4 h-4 mr-2" />
              Enviar Email {selectedMedicoes.length > 0 && `(${selectedMedicoes.length})`}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={selectedMedicoes.length === 0}>

              <Trash2 className="w-4 h-4 mr-2" />
              Excluir {selectedMedicoes.length > 0 && `(${selectedMedicoes.length})`}
            </Button>
            <Button variant="outline" onClick={() => setIsAnalisadorOpen(true)} className="border-purple-300 text-purple-700 hover:bg-purple-50">
              <Brain className="w-4 h-4 mr-2" />
              Análise IA
            </Button>
            <Button variant="outline" onClick={() => setIsAssistenteOpen(true)} className="border-blue-300 text-blue-700 hover:bg-blue-50">
              <FileEdit className="w-4 h-4 mr-2" />
              Gerar Relatório
            </Button>
            <Button variant="outline" onClick={() => setIsConfigOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Configurar KPIs
            </Button>
            {(currentUser?.role === 'admin' || (currentUser?.perfis && currentUser.perfis.includes('administrador'))) && (
              <Button variant="outline" onClick={() => setIsDiagnosticoOpen(true)} className="border-orange-300 text-orange-700 hover:bg-orange-50">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Verificar Duplicações
              </Button>
            )}
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Tipos de KPI</p>
                  <p className="text-3xl font-bold text-slate-900">{tiposKPI.length}</p>
                </div>
                <Settings className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Medições Total</p>
                  <p className="text-3xl font-bold text-slate-900">{medicoesKPI.length}</p> {/* Changed medicoes to medicoesKPI */}
                </div>
                <ClipboardCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Hoje</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {medicoesKPI.filter((m) => m.data_medicao === new Date().toISOString().split('T')[0]).length} {/* Changed medicoes to medicoesKPI */}
                  </p>
                </div>
                <ClipboardCheck className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Dentro da Meta</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {medicoesKPI.filter((m) => m.dentro_da_meta).length} {/* Changed medicoes to medicoesKPI */}
                  </p>
                </div>
                <ClipboardCheck className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="medicoes" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Medições de KPI
            </TabsTrigger>
            <TabsTrigger value="nova" className="bg-blue-500 text-slate-50 px-3 py-1.5 text-sm font-medium rounded-sm justify-center whitespace-nowrap ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nova Medição
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="powerbi" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Power BI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="medicoes" className="space-y-6">
            {/* Filtros */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500" />
                    Filtros de Pesquisa
                  </CardTitle>
                  {hasActiveFilters &&
                  <Button variant="outline" size="sm" onClick={clearFilters} className="text-red-600 border-red-200 hover:bg-red-50">
                      <X className="w-4 h-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  }
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="aeroporto">Aeroporto</Label>
                    <Select
                      id="aeroporto"
                      options={aeroportoOptions}
                      value={filtros.aeroporto}
                      onValueChange={(v) => handleFilterChange('aeroporto', v)} />

                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipoKpi">Tipo de KPI</Label>
                    <Select
                      id="tipoKpi"
                      options={tipoKpiOptions}
                      value={filtros.tipoKpi}
                      onValueChange={(v) => handleFilterChange('tipoKpi', v)} />

                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataInicio">Data Início</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={filtros.dataInicio}
                      onChange={(e) => handleFilterChange('dataInicio', e.target.value)} />

                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataFim">Data Fim</Label>
                    <Input
                      id="dataFim"
                      type="date"
                      value={filtros.dataFim}
                      onChange={(e) => handleFilterChange('dataFim', e.target.value)} />

                  </div>
                  <div className="lg:col-span-4">
                    <Label htmlFor="numeroVoo">Número do Voo</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="numeroVoo"
                        placeholder="Buscar por número do voo"
                        value={filtros.numeroVoo}
                        onChange={(e) => handleFilterChange('numeroVoo', e.target.value)}
                        className="pl-10" />

                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Medições */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Medições Registadas ({filteredAndSortedMedicoes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ?
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-slate-500 mt-2">A carregar medições...</p>
                  </div> :
                filteredAndSortedMedicoes.length === 0 ?
                <div className="text-center py-8 text-slate-500">
                    <ClipboardCheck className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                      Nenhuma medição encontrada
                    </h3>
                    <p className="text-slate-500">
                      Não há medições de KPI que correspondam aos filtros selecionados.
                    </p>
                  </div> :

                <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                            checked={allSelectedOnPage}
                            onCheckedChange={handleSelectAll}
                            aria-label="Selecionar tudo" />

                          </TableHead>
                          <SortableTableHeader
                          field="tipo_kpi"
                          label="Tipo KPI"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort} />

                          <SortableTableHeader
                          field="aeroporto"
                          label="Aeroporto"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort} />

                          <SortableTableHeader
                          field="data_medicao"
                          label="Data"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort} />

                          <SortableTableHeader
                          field="numero_voo"
                          label="Voo"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort} />

                          <TableHead>Responsável</TableHead>
                          <SortableTableHeader
                          field="resultado"
                          label="Resultado"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort} />

                          <TableHead>Atualizado Por</TableHead>

                          <SortableTableHeader
                          field="meta"
                          label="Meta"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort} />

                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedMedicoes.map((medicao) => {
                        const tipoKPI = tiposKPI.find((t) => t.id === medicao.tipo_kpi_id);
                        const aeroporto = aeroportos.find((a) => a.codigo_icao === medicao.aeroporto_id);

                        return (
                          <TableRow key={medicao.id} data-state={selectedMedicoes.includes(medicao.id) ? "selected" : ""}>
                              <TableCell>
                                <Checkbox
                                checked={selectedMedicoes.includes(medicao.id)}
                                onCheckedChange={() => handleSelectMedicao(medicao.id)}
                                aria-label={`Selecionar medição ${medicao.id}`} />

                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge className={CATEGORIA_COLORS[tipoKPI?.categoria] || 'bg-gray-100 text-gray-800'}>
                                    {tipoKPI?.nome || 'N/A'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>{aeroporto?.codigo_icao || medicao.aeroporto_id}</TableCell>
                              <TableCell>{format(new Date(medicao.data_medicao), 'dd/MM/yyyy', { locale: pt })}</TableCell>
                              <TableCell>{medicao.numero_voo || '-'}</TableCell>
                              <TableCell>{medicao.responsavel_medicao}</TableCell>
                              <TableCell>
                                {medicao.resultado_inicio !== undefined && medicao.resultado_inicio !== null &&
                              medicao.resultado_fim !== undefined && medicao.resultado_fim !== null ?
                              `${medicao.resultado_inicio} - ${medicao.resultado_fim} ${tipoKPI?.unidade_medida || ''}` :
                              medicao.resultado_principal !== null ?
                              `${medicao.resultado_principal} ${tipoKPI?.unidade_medida || ''}` :
                              '-'
                              }
                              </TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  <div className="font-medium text-slate-700">{medicao.updated_by || medicao.created_by || '-'}</div>
                                  {(medicao.updated_date || medicao.created_date) && (
                                    <div className="text-slate-500">
                                      {format(new Date(medicao.updated_date || medicao.created_date), 'dd/MM/yyyy HH:mm', { locale: pt })}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={medicao.dentro_da_meta ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                  {medicao.dentro_da_meta ? 'Dentro' : 'Fora'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => {setEditingMedicao(medicao);setSelectedTipoKPI(tipoKPI);setIsFormOpen(true);}}>
                                    Ver/Editar
                                  </Button>
                                  <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(medicao.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50">

                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>);

                      })}
                      </TableBody>
                    </Table>
                  </div>
                }
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nova" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Selecione o Tipo de KPI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedTiposKPI.map((tipo) =>
                  <Card key={tipo.id} className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300"
                  onClick={() => handleNovaMedicao(tipo)}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tipo.cor_identificacao || '#3B82F6' }} />

                          {tipo.nome}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-600 text-sm mb-3">{tipo.descricao}</p>
                        <div className="flex justify-between items-center">
                          <Badge className={CATEGORIA_COLORS[tipo.categoria] || 'bg-gray-100 text-gray-800'}>
                            {tipo.categoria}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            Meta: {tipo.meta_objetivo !== null && tipo.meta_objetivo !== undefined ? `${tipo.meta_objetivo} ${tipo.unidade_medida || ''}` : 'N/A'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {sortedTiposKPI.length === 0 &&
                <div className="text-center py-8 text-slate-500">
                    <Settings className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                      Nenhum tipo de KPI configurado
                    </h3>
                    <p className="text-slate-500 mb-4">
                      Configure os tipos de KPI primeiro na secção de configurações.
                    </p>
                    <Button onClick={() => setIsConfigOpen(true)}>
                      Configurar KPIs
                    </Button>
                  </div>
                }
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardKPIs 
              medicoes={medicoesKPI} 
              tiposKPI={tiposKPI} 
              aeroportos={aeroportos}
              onExportPDF={handleExportPDF}
              isExporting={isExportingPDF}
            />
          </TabsContent>

          <TabsContent value="powerbi" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Relatório Power BI - KPIs SGA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                  <iframe 
                    title="KPIs - SGA" 
                    src="https://app.powerbi.com/view?r=eyJrIjoiYTY3NmZmMmMtZWQ3Zi00MmJlLTgwYTItNTQ2MDcyOGY4NGFhIiwidCI6IjYwMzA1NmIzLWZmNDItNDQ4Mi1iOWQzLWRjYmU5YjJkOTNiNiJ9" 
                    frameBorder="0" 
                    allowFullScreen={true}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
          </div>

      {/* Modals */}
      {isFormOpen && selectedTipoKPI &&
      <FormMedicaoKPI
        isOpen={isFormOpen}
        onClose={() => {setIsFormOpen(false);setSelectedTipoKPI(null);setEditingMedicao(null);}}
        onSubmit={handleFormSubmit}
        tipoKPI={selectedTipoKPI}
        medicaoInicial={editingMedicao}
        aeroportos={aeroportos}
        companhias={companhias} />

      }

      {isConfigOpen &&
      <ConfiguracaoKPIs
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onUpdate={loadData} />

      }

      {isDiagnosticoOpen &&
      <DiagnosticoDuplicacoesModal
        isOpen={isDiagnosticoOpen}
        onClose={() => setIsDiagnosticoOpen(false)}
        onSuccess={loadData} />

      }

      <AlertModal
        isOpen={deleteInfo.isOpen}
        onClose={() => setDeleteInfo({ isOpen: false, id: null })}
        onConfirm={handleDeleteConfirm}
        type="warning"
        title="Confirmar Exclusão"
        message="Tem a certeza que deseja excluir esta medição? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        showCancel />


      <AlertModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        type="warning"
        title={`Excluir ${selectedMedicoes.length} Medições`}
        message={`Tem a certeza que deseja excluir as ${selectedMedicoes.length} medições selecionadas? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        showCancel />


      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message} />


      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ ...successInfo, isOpen: false })}
        title={successInfo.title}
        message={successInfo.message} />


      <SendEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onSend={handleSendEmail}
        title="Enviar Relatório de KPIs"
        defaultSubject={`Relatório de Medições de KPI (${selectedMedicoes.length} itens)`} />

      <AnalisadorInteligente
        isOpen={isAnalisadorOpen}
        onClose={() => setIsAnalisadorOpen(false)}
        medicoes={filteredAndSortedMedicoes}
        tiposKPI={tiposKPI}
        aeroportos={aeroportos} />

      <AssistenteRelatorio
        isOpen={isAssistenteOpen}
        onClose={() => setIsAssistenteOpen(false)}
        dados={filteredAndSortedMedicoes.slice(0, 20)}
        contexto={`Análise de ${filteredAndSortedMedicoes.length} medições de KPI`}
        tipo="kpi" />

      </div>);

}