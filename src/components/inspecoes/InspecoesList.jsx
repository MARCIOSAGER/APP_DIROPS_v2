import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select'; // Corrected import: now assumes default export
import {
  Search,
  Calendar,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Mail,
  FileText,
  Grid3x3,
  List,
  Trash2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import SendEmailModal from '../shared/SendEmailModal';
import InspecaoDetailModal from './InspecaoDetailModal';
import AlertModal from '../shared/AlertModal';
import { Inspecao } from '@/entities/Inspecao';
import { Empresa } from '@/entities/Empresa';
import { getEmpresaLogoByAeroporto } from '@/components/lib/userUtils';
import { createPdfDoc, addHeader, addFooter, addInfoBox, addSectionTitle, addKeyValuePairs, checkPageBreak, loadImageAsBase64, PDF } from '@/lib/pdfTemplate';
import { useI18n } from '@/components/lib/i18n';

const STATUS_CONFIG = {
  em_andamento: { color: 'bg-blue-100 text-blue-800', icon: Clock },
  concluida: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  aprovada: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  rejeitada: { color: 'bg-red-100 text-red-800', icon: XCircle }
};

export default function InspecoesList({ inspecoes, tiposInspecao, aeroportos, isLoading, onReload }) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [aeroportoFilter, setAeroportoFilter] = useState('todos');
  const [sortCriteria, setSortCriteria] = useState('data_inspecao');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('grid');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedInspecao, setSelectedInspecao] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [inspecaoToDelete, setInspecaoToDelete] = useState(null);
  const [errorInfo, setErrorInfo] = useState({ isOpen: false, title: '', message: '' });
  const [empresas, setEmpresas] = useState([]);

  useEffect(() => {
    Empresa.list().then(data => setEmpresas(data || [])).catch(() => setEmpresas([]));
  }, []);

  const filteredInspecoes = useMemo(() => {
    let filtered = inspecoes.filter(inspecao => {
      const matchesSearch = inspecao.inspetor_responsavel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           inspecao.resumo_geral?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'todos' || inspecao.status === statusFilter;
      const matchesTipo = tipoFilter === 'todos' || inspecao.tipo_inspecao_id === tipoFilter;
      const matchesAeroporto = aeroportoFilter === 'todos' || inspecao.aeroporto_id === aeroportoFilter;

      return matchesSearch && matchesStatus && matchesTipo && matchesAeroporto;
    });

    // Aplica ordenação
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortCriteria) {
        case 'data_inspecao':
          aValue = new Date(a.data_inspecao).getTime();
          bValue = new Date(b.data_inspecao).getTime();
          break;
        case 'inspetor_responsavel':
          aValue = a.inspetor_responsavel?.toLowerCase() || '';
          bValue = b.inspetor_responsavel?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.status?.toLowerCase() || '';
          bValue = b.status?.toLowerCase() || '';
          break;
        case 'conformidade':
          aValue = getConformityPercentage(a);
          bValue = getConformityPercentage(b);
          break;
        default:
          aValue = new Date(a.data_inspecao).getTime();
          bValue = new Date(b.data_inspecao).getTime();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [inspecoes, searchTerm, statusFilter, tipoFilter, aeroportoFilter, sortCriteria, sortOrder]);

  const getConformityPercentage = (inspecao) => {
    if (!inspecao.total_itens || inspecao.total_itens === 0) return 0;
    return Math.round((inspecao.itens_conformes / inspecao.total_itens) * 100);
  };

  const getTipoNome = (tipoId) => {
    const tipo = tiposInspecao.find(t => t.id === tipoId);
    return tipo?.nome || t('inspecoesList.tipoNaoEncontrado');
  };

  const getAeroportoNome = (aeroportoId) => {
    const aeroporto = aeroportos.find(a => a.id === aeroportoId);
    return aeroporto?.nome || t('inspecoesList.aeroportoNaoEncontrado');
  };

  const handleViewInspecao = (inspecao) => {
    setSelectedInspecao(inspecao);
    setIsDetailModalOpen(true);
  };

  const handleOpenEmailModal = (inspecao) => {
    setSelectedInspecao(inspecao);
    setIsEmailModalOpen(true);
  };

  const handleDeleteInspecao = (inspecao) => {
    setInspecaoToDelete(inspecao);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!inspecaoToDelete) return;

    try {
      await Inspecao.update(inspecaoToDelete.id, { status: 'cancelada' });
      setIsDeleteModalOpen(false);
      setInspecaoToDelete(null);
      onReload();
    } catch (error) {
      console.error('Erro ao excluir inspeção:', error);
      setIsDeleteModalOpen(false);
      setInspecaoToDelete(null);
      setErrorInfo({ isOpen: true, title: t('inspecoesList.erroExcluirTitulo'), message: t('inspecoesList.erroExcluirMsg') });
    }
  };

  const handleSendEmail = async (recipient, subject) => {
    if (!selectedInspecao) return false;

    try {
      const { SendEmail } = await import('@/integrations/Core');
      
      const aeroportoNome = aeroportos.find(a => a.id === selectedInspecao.aeroporto_id)?.nome || t('inspecoesList.aeroportoNaoEncontrado');
      const tipoNome = tiposInspecao.find(t => t.id === selectedInspecao.tipo_inspecao_id)?.nome || t('inspecoesList.tipoNaoEncontrado');
      
      const emailLogoUrl = getEmpresaLogoByAeroporto(selectedInspecao.aeroporto_id, aeroportos, empresas);
      const reportBody = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${emailLogoUrl}" alt="DIROPS Logo" style="height: 60px;">
            <h1 style="color: #1e40af; margin-top: 20px;">${t('inspecoesList.emailRelatorio')}</h1>
          </div>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">${t('inspecoesList.pdfInfoInspecao')}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.emailTipo')}:</td>
                <td style="padding: 8px;">${tipoNome}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.colAeroporto')}:</td>
                <td style="padding: 8px;">${aeroportoNome}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.colData')}:</td>
                <td style="padding: 8px;">${new Date(selectedInspecao.data_inspecao).toLocaleDateString('pt-AO')}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.colInspetor')}:</td>
                <td style="padding: 8px;">${selectedInspecao.inspetor_responsavel}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.colStatus')}:</td>
                <td style="padding: 8px;">${selectedInspecao.status}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af;">${t('inspecoesList.emailResultados')}</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.totalItens')}:</td>
                <td style="padding: 8px;">${selectedInspecao.total_itens || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.emailItensConformes')}:</td>
                <td style="padding: 8px; color: green;">${selectedInspecao.itens_conformes || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.emailItensNaoConformes')}:</td>
                <td style="padding: 8px; color: red;">${selectedInspecao.itens_nao_conformes || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">${t('inspecoesList.emailItensNA')}:</td>
                <td style="padding: 8px;">${selectedInspecao.itens_nao_aplicaveis || 0}</td>
              </tr>
            </table>
          </div>

          ${selectedInspecao.resumo_geral ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #1e40af;">${t('inspecoesList.pdfResumoGeral')}</h3>
              <p style="background-color: #f8fafc; padding: 15px; border-radius: 8px;">
                ${selectedInspecao.resumo_geral}
              </p>
            </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b;">
            <p><strong>Sistema DIROPS</strong><br>
            Direcção de Operações - Serviços de Gestão Aeroportária</p>
          </div>
        </div>
      `;

      await SendEmail({
        to: recipient,
        subject: subject || `${t('inspecoesList.emailRelatorio')} - ${tipoNome} - ${aeroportoNome}`,
        body: reportBody,
        from_name: 'DIROPS'
      });

      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      throw new Error(error.message || t('inspecoesList.erroEnvioEmail'));
    }
  };

  const handleExportPDF = async (inspecao) => {
    try {
      const doc = await createPdfDoc();
      const m = PDF.margin;

      // Load logo
      let logoBase64 = null;
      try {
        const logoUrl = getEmpresaLogoByAeroporto(inspecao.aeroporto_id, aeroportos, empresas);
        logoBase64 = await loadImageAsBase64(logoUrl);
      } catch (logoError) {
        console.debug('Logo não adicionado:', logoError);
      }

      const aeroportoNome = getAeroportoNome(inspecao.aeroporto_id);
      const dataFormatada = format(parseISO(inspecao.data_inspecao), 'dd/MM/yyyy');

      // Header
      let yPos = addHeader(doc, {
        title: t('inspecoesList.pdfRelatorio'),
        logoBase64,
        date: dataFormatada,
        meta: [
          `${t('inspecoesList.colAeroporto')}: ${aeroportoNome}`,
          `${t('inspecoesList.colInspetor')}: ${inspecao.inspetor_responsavel}`,
        ],
      });

      // Informações da Inspeção
      yPos = addSectionTitle(doc, yPos, t('inspecoesList.pdfInfoInspecao'));
      yPos = addInfoBox(doc, yPos, [
        { label: t('inspecoesList.colTipo'), value: getTipoNome(inspecao.tipo_inspecao_id) },
        { label: t('inspecoesList.colData'), value: dataFormatada },
        { label: t('inspecoesList.colAeroporto'), value: aeroportoNome },
        { label: t('inspecoesList.colInspetor'), value: inspecao.inspetor_responsavel },
        { label: t('inspecoesList.colStatus'), value: inspecao.status.replace(/_/g, ' ').toUpperCase() },
      ]);

      // Estatísticas
      yPos = checkPageBreak(doc, yPos, 30);
      yPos = addSectionTitle(doc, yPos, t('inspecoesList.pdfEstatisticas'));
      yPos = addKeyValuePairs(doc, yPos, [
        { label: t('inspecoesList.totalItens'), value: String(inspecao.total_itens || 0) },
        { label: t('inspecoesList.conformes'), value: String(inspecao.itens_conformes || 0) },
        { label: t('inspecoesList.naoConformes'), value: String(inspecao.itens_nao_conformes || 0) },
        { label: t('inspecoesList.conformidade'), value: `${getConformityPercentage(inspecao)}%` },
      ], { twoColumns: true });

      // Resumo Geral
      if (inspecao.resumo_geral) {
        yPos = checkPageBreak(doc, yPos, 30);
        yPos = addSectionTitle(doc, yPos, t('inspecoesList.pdfResumoGeral'));

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(PDF.font.body);
        doc.setTextColor(...PDF.colors.dark);
        const resumoLines = doc.splitTextToSize(inspecao.resumo_geral, doc.internal.pageSize.getWidth() - m.left - m.right - 8);
        const resumoBoxHeight = resumoLines.length * 4 + 8;

        doc.setFillColor(...PDF.colors.bgStripe);
        doc.setDrawColor(...PDF.colors.separator);
        doc.setLineWidth(0.3);
        doc.roundedRect(m.left, yPos, doc.internal.pageSize.getWidth() - m.left - m.right, resumoBoxHeight, 2, 2, 'FD');
        doc.text(resumoLines, m.left + 4, yPos + 6);
        yPos += resumoBoxHeight + 4;
      }

      // Alerta se requer ação imediata
      if (inspecao.requer_acao_imediata) {
        yPos = checkPageBreak(doc, yPos, 20);

        const alertW = doc.internal.pageSize.getWidth() - m.left - m.right;
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(...PDF.colors.danger);
        doc.setLineWidth(1.5);
        doc.roundedRect(m.left, yPos, alertW, 15, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(PDF.font.subtitle);
        doc.setTextColor(...PDF.colors.danger);
        doc.text(t('inspecoesList.pdfAtencao'), m.left + 4, yPos + 10);
        yPos += 25;
      }

      // Carregar evidências fotográficas
      try {
        const respostaInspecaoModule = await import('@/entities/RespostaInspecao');
        const respostas = await respostaInspecaoModule.RespostaInspecao.filter({ inspecao_id: inspecao.id });
        const respostasComFotos = respostas.filter(r => r.fotos && r.fotos.length > 0);

        if (respostasComFotos.length > 0) {
          yPos = checkPageBreak(doc, yPos, 60);
          yPos = addSectionTitle(doc, yPos, t('inspecoesList.pdfEvidencias'));

          for (const resposta of respostasComFotos) {
            yPos = checkPageBreak(doc, yPos, 55);

            // Título da resposta
            doc.setFontSize(PDF.font.body);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF.colors.dark);
            doc.text(t('inspecoesList.pdfItemInspecao'), m.left, yPos);
            yPos += 7;

            if (resposta.observacoes) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(PDF.font.body);
              const obsLines = doc.splitTextToSize(resposta.observacoes, 170);
              doc.text(obsLines, m.left, yPos);
              yPos += (obsLines.length * 4) + 5;
            }

            // Adicionar fotos
            let xPos = m.left;
            let photosInRow = 0;
            const maxPhotosPerRow = 3;
            const photoWidth = 50;
            const photoHeight = 40;

            for (const fotoUrl of resposta.fotos) {
              try {
                if (photosInRow >= maxPhotosPerRow) {
                  yPos += photoHeight + 5;
                  xPos = m.left;
                  photosInRow = 0;
                }

                yPos = checkPageBreak(doc, yPos, photoHeight + 5);
                if (photosInRow === 0) xPos = m.left;

                const imgBase64 = await loadImageAsBase64(fotoUrl);
                doc.addImage(imgBase64, 'PNG', xPos, yPos, photoWidth, photoHeight);

                // Borda da foto
                doc.setDrawColor(...PDF.colors.separator);
                doc.setLineWidth(0.5);
                doc.rect(xPos, yPos, photoWidth, photoHeight);

                xPos += photoWidth + 5;
                photosInRow++;
              } catch (imgError) {
                console.debug('Erro ao carregar imagem:', imgError);
                // Placeholder para imagem que falhou
                doc.setFillColor(240, 240, 240);
                doc.rect(xPos, yPos, photoWidth, photoHeight, 'F');
                doc.setTextColor(150, 150, 150);
                doc.setFontSize(PDF.font.caption);
                doc.text(t('inspecoesList.pdfImagemNaoCarregada'), xPos + photoWidth / 2, yPos + photoHeight / 2, { align: 'center' });

                xPos += photoWidth + 5;
                photosInRow++;
              }
            }

            yPos += photoHeight + 15;
          }
        }
      } catch (error) {
        console.debug('Erro ao carregar evidências:', error);
      }

      // Footer
      addFooter(doc);

      doc.save(`inspecao_${getTipoNome(inspecao.tipo_inspecao_id).replace(/\s+/g, '_')}_${format(parseISO(inspecao.data_inspecao), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert(t('inspecoesList.erroExportarPDF'));
    }
  };

  const statusOptions = [
    { value: 'todos', label: t('inspecoesList.todosStatus') },
    { value: 'em_andamento', label: t('inspecoesList.emAndamento') },
    { value: 'concluida', label: t('inspecoesList.concluida') },
    { value: 'aprovada', label: t('inspecoesList.aprovada') },
    { value: 'rejeitada', label: t('inspecoesList.rejeitada') }
  ];

  const tipoOptions = [
    { value: 'todos', label: t('inspecoesList.todosTipos') },
    ...tiposInspecao.map(tipo => ({ value: tipo.id, label: tipo.nome }))
  ];

  const aeroportoOptions = [
    { value: 'todos', label: t('inspecoesList.todosAeroportos') },
    ...aeroportos.map(aeroporto => ({ value: aeroporto.id, label: aeroporto.nome }))
  ];

  return (
    <div className="space-y-6">
      {/* Filtros e Ordenação */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('inspecoesList.filtrosOrdenacao')}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="w-4 h-4 mr-2" />
              {t('inspecoesList.cards')}
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-2" />
              {t('inspecoesList.tabela')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t('inspecoesList.pesquisar')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              options={statusOptions}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="Status"
            />

            <Select
              options={tipoOptions}
              value={tipoFilter}
              onValueChange={setTipoFilter}
              placeholder={t('inspecoesList.tipoInspecao')}
            />

            <Select
              options={aeroportoOptions}
              value={aeroportoFilter}
              onValueChange={setAeroportoFilter}
              placeholder="Aeroporto"
            />

            <Select
              options={[
                { value: 'data_inspecao', label: t('inspecoesList.sortData') },
                { value: 'inspetor_responsavel', label: t('inspecoesList.sortInspetor') },
                { value: 'status', label: t('inspecoesList.sortStatus') },
                { value: 'conformidade', label: t('inspecoesList.sortConformidade') }
              ]}
              value={sortCriteria}
              onValueChange={setSortCriteria}
              placeholder={t('inspecoesList.ordenarPor')}
            />

            <Select
              options={[
                { value: 'desc', label: t('inspecoesList.sortDesc') },
                { value: 'asc', label: t('inspecoesList.sortAsc') }
              ]}
              value={sortOrder}
              onValueChange={setSortOrder}
              placeholder={t('inspecoesList.ordem')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Inspeções */}
      {viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('inspecoesList.colTipo')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('inspecoesList.colData')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('inspecoesList.colAeroporto')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('inspecoesList.colInspetor')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('inspecoesList.colStatus')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">{t('inspecoesList.colConformidade')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">{t('inspecoesList.colAcoes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-slate-500 mt-2">{t('inspecoesList.aCarregar')}</p>
                      </td>
                    </tr>
                  ) : filteredInspecoes.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center">
                        <Clock className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">{t('inspecoesList.nenhumaInspecao')}</h3>
                        <p className="text-slate-500">{t('inspecoesList.nenhumaCorrespondente')}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInspecoes.map((inspecao) => {
                      const statusConfig = STATUS_CONFIG[inspecao.status] || STATUS_CONFIG.em_andamento;
                      const StatusIcon = statusConfig.icon;
                      const conformityPercentage = getConformityPercentage(inspecao);

                      return (
                        <tr key={inspecao.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900">{getTipoNome(inspecao.tipo_inspecao_id)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {format(parseISO(inspecao.data_inspecao), 'dd/MM/yyyy', { locale: pt })}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{getAeroportoNome(inspecao.aeroporto_id)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{inspecao.inspetor_responsavel}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`${statusConfig.color} border text-xs`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {(inspecao.status || '').replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              conformityPercentage >= 80 ? 'bg-green-100 text-green-800' :
                              conformityPercentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {conformityPercentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-center">
                              <Button variant="ghost" size="sm" onClick={() => handleViewInspecao(inspecao)} title={t('inspecoesList.verDetalhes')}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleExportPDF(inspecao)} title={t('inspecoesList.exportarPDF')}>
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleOpenEmailModal(inspecao)} title={t('inspecoesList.enviarEmail')}>
                                <Mail className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteInspecao(inspecao)} className="text-red-600 hover:text-red-700 hover:bg-red-50" title={t('inspecoesList.excluir')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-500 mt-2">{t('inspecoesList.aCarregar')}</p>
          </div>
        ) : filteredInspecoes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Clock className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                {t('inspecoesList.nenhumaInspecao')}
              </h3>
              <p className="text-slate-500">
                {t('inspecoesList.nenhumaCorrespondente')}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredInspecoes.map((inspecao) => {
            const statusConfig = STATUS_CONFIG[inspecao.status] || STATUS_CONFIG.em_andamento;
            const StatusIcon = statusConfig.icon;
            const conformityPercentage = getConformityPercentage(inspecao);

            return (
              <Card key={inspecao.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {getTipoNome(inspecao.tipo_inspecao_id)}
                        </h3>
                        <Badge variant="outline" className={`${statusConfig.color} border`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {(inspecao.status || '').replace(/_/g, ' ')}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(parseISO(inspecao.data_inspecao), 'dd/MM/yyyy', { locale: pt })}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {getAeroportoNome(inspecao.aeroporto_id)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {inspecao.inspetor_responsavel}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewInspecao(inspecao)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
                        <Eye className="w-4 h-4 mr-1" />
                        {t('inspecoesList.ver')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExportPDF(inspecao)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
                        <FileText className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleOpenEmailModal(inspecao)} className="border-blue-300 text-blue-600 hover:bg-blue-50">
                        <Mail className="w-4 h-4 mr-1" />
                        Email
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteInspecao(inspecao)} className="border-red-300 text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4 mr-1" />
                        {t('inspecoesList.excluir')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    {/* Estatísticas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-slate-900">
                          {inspecao.total_itens || 0}
                        </div>
                        <div className="text-xs text-slate-500">{t('inspecoesList.totalItens')}</div>
                      </div>

                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-700">
                          {inspecao.itens_conformes || 0}
                        </div>
                        <div className="text-xs text-slate-500">{t('inspecoesList.conformes')}</div>
                      </div>

                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-700">
                          {inspecao.itens_nao_conformes || 0}
                        </div>
                        <div className="text-xs text-slate-500">{t('inspecoesList.naoConformes')}</div>
                      </div>

                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-700">
                          {conformityPercentage}%
                        </div>
                        <div className="text-xs text-slate-500">{t('inspecoesList.conformidade')}</div>
                      </div>
                    </div>

                    {/* Resumo */}
                    {inspecao.resumo_geral && (
                      <div>
                        <h4 className="font-medium text-slate-700 mb-2">{t('inspecoesList.resumo')}</h4>
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {inspecao.resumo_geral}
                        </p>
                      </div>
                    )}

                    {/* Alertas */}
                    {inspecao.requer_acao_imediata && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-700 font-medium">
                          {t('inspecoesList.requerAcaoImediata')}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        </div>
      )}

      {/* Modal de Email */}
      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setSelectedInspecao(null);
        }}
        onSend={handleSendEmail}
        title={t('inspecoesList.enviarRelatorio')}
        defaultSubject={selectedInspecao ?
          `${t('inspecoesList.emailRelatorio')} - ${getTipoNome(selectedInspecao.tipo_inspecao_id)} - ${getAeroportoNome(selectedInspecao.aeroporto_id)}`
          : ''
        }
      />

      {/* Modal de Detalhes da Inspeção */}
      {selectedInspecao && (
        <InspecaoDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedInspecao(null);
          }}
          inspecao={selectedInspecao}
          tipoInspecao={tiposInspecao.find(t => t.id === selectedInspecao.tipo_inspecao_id)}
          aeroporto={aeroportos.find(a => a.id === selectedInspecao.aeroporto_id)}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      <AlertModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setInspecaoToDelete(null);
        }}
        onConfirm={confirmDelete}
        type="warning"
        title={t('inspecoesList.excluirInspecao')}
        message={inspecaoToDelete ?
          `${t('inspecoesList.confirmExcluirMsg')} "${getTipoNome(inspecaoToDelete.tipo_inspecao_id)}" - ${format(parseISO(inspecaoToDelete.data_inspecao), 'dd/MM/yyyy', { locale: pt })}?`
          : ''
        }
        confirmText={t('inspecoesList.excluir')}
        cancelText={t('inspecoesList.cancelar')}
      />

      <AlertModal
        isOpen={errorInfo.isOpen}
        onClose={() => setErrorInfo({ isOpen: false, title: '', message: '' })}
        type="error"
        title={errorInfo.title}
        message={errorInfo.message}
      />
    </div>
  );
}