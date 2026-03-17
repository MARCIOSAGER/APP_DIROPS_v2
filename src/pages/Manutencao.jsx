import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, FileDown, Filter, X, ClipboardList, Wrench, BarChart3, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import { OrdemServico } from '@/entities/OrdemServico';
import { SolicitacaoServico } from '@/entities/SolicitacaoServico';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User';
import { createPageUrl } from '@/utils';
import { createPdfDoc, addHeader, addFooter, addTable, fetchEmpresaLogo } from '@/lib/pdfTemplate';

import ManutencaoStats from '../components/manutencao/ManutencaoStats';
import ManutencaoList from '../components/manutencao/ManutencaoList';
import FormOrdemServico from '../components/manutencao/FormOrdemServico';
import OrdemServicoDetailModal from '../components/manutencao/OrdemServicoDetailModal';
import AtribuirOSModal from '../components/manutencao/AtribuirOSModal';
import ResponderOSModal from '../components/manutencao/ResponderOSModal';
import FormSolicitacaoServico from '../components/manutencao/FormSolicitacaoServico';
import SolicitacoesList from '../components/manutencao/SolicitacoesList';
import AnalisarSSModal from '../components/manutencao/AnalisarSSModal';
import SolicitacaoDetailModal from '../components/manutencao/SolicitacaoDetailModal';
import ConfigNotificacoesManutencao from '../components/manutencao/ConfigNotificacoesManutencao';
import SuccessModal from '../components/shared/SuccessModal';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';
import { getAeroportosPermitidos, filtrarDadosPorAeroportoId, isSuperAdmin } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useI18n } from '@/components/lib/i18n';

export default function Manutencao() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const [currentUser, setCurrentUser] = useState(null);
  const [ordensDeServico, setOrdensDeServico] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('solicitacoes');

  // OS state
  const [filtrosOS, setFiltrosOS] = useState({ busca: '', status: 'todos', prioridade: 'todos', aeroporto: 'todos', categoria: 'todos' });
  const [selectedOrdens, setSelectedOrdens] = useState([]);
  const [isFormOSOpen, setIsFormOSOpen] = useState(false);
  const [editingOrdem, setEditingOrdem] = useState(null);
  const [detailOrdem, setDetailOrdem] = useState(null);
  const [atribuirOrdem, setAtribuirOrdem] = useState(null);
  const [responderOrdem, setResponderOrdem] = useState(null);
  const [responderAcao, setResponderAcao] = useState('aceitar');

  // SS state
  const [isFormSSOpen, setIsFormSSOpen] = useState(false);
  const [analisarSS, setAnalisarSS] = useState(null);
  const [detailSS, setDetailSS] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [logoBase64, setLogoBase64] = useState(null);

  // Permissões: administrador e infraestrutura podem gerir
  const canManage = useMemo(() => {
    if (!currentUser?.perfis) return false;
    if (isSuperAdmin(currentUser)) return true;
    return currentUser.perfis.some(p => ['administrador', 'infraestrutura'].includes(p));
  }, [currentUser]);

  useEffect(() => { loadData(); }, [effectiveEmpresaId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);
      fetchEmpresaLogo(user?.empresa_id).then(b64 => setLogoBase64(b64));

      // Server-side filter by empresa_id when applicable
      const empId = effectiveEmpresaId || user.empresa_id;
      const empFilters = empId ? { empresa_id: empId } : {};

      const [ordensData, ssData, aeroportosData, usersData] = await Promise.all([
        empId ? OrdemServico.filter(empFilters, '-data_abertura') : OrdemServico.list('-data_abertura'),
        empId ? SolicitacaoServico.filter(empFilters, '-created_date') : SolicitacaoServico.list('-created_date'),
        (empId ? Aeroporto.filter({ empresa_id: empId }) : Aeroporto.list()),
        User.list()
      ]);
      setAllUsers(usersData);

      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');
      const aeroportosFiltrados = getAeroportosPermitidos(user, aeroportosAngola, effectiveEmpresaId);
      setAeroportos(aeroportosFiltrados);

      const ordensFiltradas = filtrarDadosPorAeroportoId(user, ordensData, 'aeroporto_id', aeroportosAngola, effectiveEmpresaId);
      setOrdensDeServico(ordensFiltradas);

      const ssFiltradas = filtrarDadosPorAeroportoId(user, ssData, 'aeroporto_id', aeroportosAngola, effectiveEmpresaId);
      setSolicitacoes(ssFiltradas);
    } catch (error) {
      console.error('Erro ao carregar dados de manutenção:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Email helpers ---
  const getManagerEmails = async (notificationType) => {
    try {
      const empId = currentUser?.empresa_id;
      // Check configured recipients first
      if (notificationType) {
        const configKey = `manutencao_notificacoes_${empId || 'global'}`;
        const existing = await ConfiguracaoSistema.findOne({ chave: configKey });
        if (existing?.valor?.[notificationType]?.length > 0) {
          return existing.valor[notificationType];
        }
      }
      // Fallback: all admins/infraestrutura of the empresa
      const users = allUsers.length > 0 ? allUsers : await User.list();
      return users
        .filter(u => {
          if (empId && u.empresa_id !== empId) return false;
          if (u.status === 'inativo') return false;
          return u.perfis?.some(p => ['administrador', 'infraestrutura'].includes(p));
        })
        .map(u => u.email)
        .filter(Boolean);
    } catch (e) {
      console.error('Erro ao buscar emails de gestores:', e);
      return [];
    }
  };

  const buildEmailHtml = (title, fields) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">${title}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        ${fields.map(([label, value]) => `<tr><td style="padding: 8px 12px; font-weight: bold; color: #334155; border-bottom: 1px solid #e2e8f0; width: 35%;">${label}</td><td style="padding: 8px 12px; color: #475569; border-bottom: 1px solid #e2e8f0;">${value || '—'}</td></tr>`).join('')}
      </table>
      <p style="margin-top: 24px; color: #94a3b8; font-size: 12px;">Sistema DIROPS — Notificação automática</p>
    </div>
  `;

  const notifyNewSS = async (ss) => {
    try {
      const emails = await getManagerEmails('nova_ss');
      if (emails.length === 0) return;
      const aeroportoNome = aeroportos.find(a => a.id === ss.aeroporto_id)?.nome || '';
      const html = buildEmailHtml(`Nova Solicitação de Serviço: ${ss.numero_ss}`, [
        ['Nº SS', ss.numero_ss],
        ['Título', ss.titulo],
        ['Descrição', ss.descricao],
        ['Aeroporto', aeroportoNome],
        ['Prioridade', ss.prioridade_sugerida],
        ['Solicitante', ss.solicitante_nome],
        ['Data', new Date().toLocaleDateString('pt-PT')],
      ]);
      for (const email of emails) {
        await sendEmailDirect({ to: email, subject: `DIROPS: Nova SS ${ss.numero_ss} — ${ss.titulo}`, html });
      }
    } catch (e) {
      console.error('Erro ao enviar email nova SS:', e);
    }
  };

  const notifySSApproved = async (ss, os) => {
    try {
      const html = buildEmailHtml(`Solicitação Aprovada: ${ss.numero_ss}`, [
        ['Nº SS', ss.numero_ss],
        ['Título', ss.titulo],
        ['Status', 'Aprovada ✅'],
        ['OS Criada', os.numero_ordem],
        ['Analisado por', currentUser?.full_name],
        ['Data', new Date().toLocaleDateString('pt-PT')],
      ]);
      const subject = `DIROPS: SS ${ss.numero_ss} Aprovada — OS ${os.numero_ordem} criada`;
      const recipients = new Set();
      if (ss.solicitante_email) recipients.add(ss.solicitante_email);
      const managerEmails = await getManagerEmails('ss_aprovada');
      managerEmails.forEach(e => recipients.add(e));
      for (const email of recipients) {
        await sendEmailDirect({ to: email, subject, html });
      }
    } catch (e) {
      console.error('Erro ao enviar email SS aprovada:', e);
    }
  };

  const notifySSRejected = async (ss, motivo) => {
    try {
      const html = buildEmailHtml(`Solicitação Rejeitada: ${ss.numero_ss}`, [
        ['Nº SS', ss.numero_ss],
        ['Título', ss.titulo],
        ['Status', 'Rejeitada ❌'],
        ['Motivo', motivo],
        ['Analisado por', currentUser?.full_name],
        ['Data', new Date().toLocaleDateString('pt-PT')],
      ]);
      const subject = `DIROPS: SS ${ss.numero_ss} Rejeitada`;
      const recipients = new Set();
      if (ss.solicitante_email) recipients.add(ss.solicitante_email);
      const managerEmails = await getManagerEmails('ss_rejeitada');
      managerEmails.forEach(e => recipients.add(e));
      for (const email of recipients) {
        await sendEmailDirect({ to: email, subject, html });
      }
    } catch (e) {
      console.error('Erro ao enviar email SS rejeitada:', e);
    }
  };

  const notifyOSAssigned = async (os, assigneeEmail, assigneeName) => {
    try {
      const aeroportoNome = aeroportos.find(a => a.id === os.aeroporto_id)?.nome || '';
      const html = buildEmailHtml(`Ordem de Serviço Atribuída: ${os.numero_ordem}`, [
        ['Nº OS', os.numero_ordem],
        ['Título', os.titulo],
        ['Prioridade', os.prioridade],
        ['Aeroporto', aeroportoNome],
        ['Atribuído a', assigneeName],
        ['Descrição', os.descricao_problema],
        ['Data', new Date().toLocaleDateString('pt-PT')],
      ]);
      const subject = `DIROPS: OS ${os.numero_ordem} atribuída — ${os.titulo}`;
      const recipients = new Set();
      if (assigneeEmail) recipients.add(assigneeEmail);
      const managerEmails = await getManagerEmails('os_atribuida');
      managerEmails.forEach(e => recipients.add(e));
      for (const email of recipients) {
        await sendEmailDirect({ to: email, subject, html });
      }
    } catch (e) {
      console.error('Erro ao enviar email OS atribuída:', e);
    }
  };

  // --- OS handlers ---
  const handleFormOSSubmit = async (data) => {
    try {
      if (editingOrdem) {
        await OrdemServico.update(editingOrdem.id, data);
      } else {
        const currentYear = new Date().getFullYear();
        const empId = currentUser?.empresa_id;
        const latestOs = ordensDeServico
          .filter(os => os.numero_ordem?.startsWith(`OS-${currentYear}`) && (!empId || os.empresa_id === empId))
          .sort((a, b) => parseInt(b.numero_ordem.split('-')[2]) - parseInt(a.numero_ordem.split('-')[2]))[0];
        const nextNum = latestOs ? parseInt(latestOs.numero_ordem.split('-')[2]) + 1 : 1;
        const numeroOrdem = `OS-${currentYear}-${String(nextNum).padStart(4, '0')}`;
        await OrdemServico.create({ ...data, numero_ordem: numeroOrdem, data_abertura: new Date().toISOString(), empresa_id: empId || null });
      }
      setIsFormOSOpen(false);
      setEditingOrdem(null);
      loadData();
      setSuccessInfo({ isOpen: true, title: t('manutencao.successTitle'), message: t('manutencao.successOSSaved') });
    } catch (error) {
      console.error("Erro ao salvar OS:", error);
    }
  };

  const handleSendEmail = async (recipient, subject, ordem) => {
    try {
      const aeroportoNome = aeroportos.find(a => a.id === ordem.aeroporto_id)?.nome || '';
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">Notificação de Ordem de Serviço: #${ordem.numero_ordem}</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Título:</td><td style="padding: 8px;">${ordem.titulo}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Prioridade:</td><td style="padding: 8px;">${ordem.prioridade}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Status:</td><td style="padding: 8px;">${ordem.status}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Aeroporto:</td><td style="padding: 8px;">${aeroportoNome}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Descrição:</td><td style="padding: 8px;">${ordem.descricao_problema}</td></tr>
          </table>
          <p style="margin-top: 20px; color: #64748b;">Sistema DIROPS</p>
        </div>
      `;
      await sendEmailDirect({ to: recipient, subject: subject || `DIROPS: OS ${ordem.numero_ordem}`, body: emailBody });
      return true;
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      return false;
    }
  };

  const handleExportPDF = async () => {
    setIsLoading(true);
    try {
      const ordensParaExportar = selectedOrdens.length > 0
        ? ordensDeServico.filter(os => selectedOrdens.includes(os.id))
        : filteredOrdens;
      if (ordensParaExportar.length === 0) { setIsLoading(false); return; }
      const doc = await createPdfDoc({ orientation: 'portrait' });
      let y = addHeader(doc, { title: 'Relatório de Ordens de Serviço', logoBase64, date: new Date().toLocaleDateString('pt-AO'), meta: [`Total: ${ordensParaExportar.length}`] });
      const columns = [
        { label: 'Nº', width: 30 }, { label: 'Título', width: 50 }, { label: 'Status', width: 28 },
        { label: 'Prioridade', width: 25 }, { label: 'Data', width: 22 }, { label: 'Descrição', width: 25 }
      ];
      const rows = ordensParaExportar.map(o => [
        o.numero_ordem || 'N/A', o.titulo || 'N/A', o.status || 'N/A', o.prioridade || 'N/A',
        new Date(o.data_abertura || o.created_date).toLocaleDateString('pt-AO'),
        o.descricao_problema ? o.descricao_problema.substring(0, 40) + (o.descricao_problema.length > 40 ? '...' : '') : ''
      ]);
      y = addTable(doc, y, { columns, rows, headerOpts: { logoBase64 } });
      addFooter(doc, { generatedBy: currentUser?.full_name || currentUser?.email });
      doc.save(`relatorio_manutencao_${new Date().toISOString().split('T')[0]}.pdf`);
      setSuccessInfo({ isOpen: true, title: t('manutencao.reportExported'), message: t('manutencao.pdfSuccess') });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Filtered lists ---
  const filteredOrdens = useMemo(() => {
    return ordensDeServico.filter(os => {
      const searchMatch = filtrosOS.busca === '' || os.numero_ordem?.toLowerCase().includes(filtrosOS.busca.toLowerCase()) || os.titulo?.toLowerCase().includes(filtrosOS.busca.toLowerCase());
      return searchMatch && (filtrosOS.status === 'todos' || os.status === filtrosOS.status)
        && (filtrosOS.prioridade === 'todos' || os.prioridade === filtrosOS.prioridade)
        && (filtrosOS.aeroporto === 'todos' || os.aeroporto_id === filtrosOS.aeroporto)
        && (filtrosOS.categoria === 'todos' || os.categoria_manutencao === filtrosOS.categoria);
    });
  }, [ordensDeServico, filtrosOS]);

  // --- SS Stats ---
  const ssStats = useMemo(() => ({
    total: solicitacoes.length,
    abertas: solicitacoes.filter(s => s.status === 'aberta').length,
    em_analise: solicitacoes.filter(s => s.status === 'em_analise').length,
    aprovadas: solicitacoes.filter(s => s.status === 'aprovada').length,
    rejeitadas: solicitacoes.filter(s => s.status === 'rejeitada').length,
  }), [solicitacoes]);

  const aeroportoOptions = useMemo(() => [
    { value: 'todos', label: t('manutencao.todos') },
    ...aeroportos.map(a => ({ value: a.id, label: a.nome }))
  ], [aeroportos, t]);

  const statusOSOptions = [
    { value: 'todos', label: t('manutencao.todos') }, { value: 'pendente', label: t('manutencao.pendente') }, { value: 'atribuida', label: t('manutencao.atribuida') },
    { value: 'em_execucao', label: t('manutencao.emExecucao') }, { value: 'aguardando_verificacao', label: t('manutencao.aguardandoVerificacao') },
    { value: 'concluida', label: t('manutencao.concluida') }, { value: 'rejeitada', label: t('manutencao.rejeitada') }
  ];

  const prioridadeOptions = [
    { value: 'todos', label: t('manutencao.todas') }, { value: 'baixa', label: t('manutencao.baixa') },
    { value: 'media', label: t('manutencao.media') }, { value: 'alta', label: t('manutencao.alta') }, { value: 'urgente', label: t('manutencao.urgente') }
  ];

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('page.manutencao.title')}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('btn.refresh')}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${canManage ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="solicitacoes" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              {t('tab.solicitations')}
              {ssStats.abertas > 0 && <Badge variant="destructive" className="ml-1 text-xs">{ssStats.abertas}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="ordens" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              {t('tab.work_orders')}
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="configuracoes" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {t('tab.config')}
              </TabsTrigger>
            )}
          </TabsList>

          {/* === ABA SOLICITAÇÕES === */}
          <TabsContent value="solicitacoes" className="space-y-6">
            {/* SS Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{ssStats.total}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('manutencao.totalSS')}</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{ssStats.abertas}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('manutencao.abertas')}</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{ssStats.em_analise}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('manutencao.emAnalise')}</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-green-600 dark:text-green-400">{ssStats.aprovadas}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('manutencao.aprovadas')}</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-red-600 dark:text-red-400">{ssStats.rejeitadas}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t('manutencao.rejeitadas')}</p></CardContent></Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setIsFormSSOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                {t('manutencao.novaSolicitacao')}
              </Button>
            </div>

            <SolicitacoesList
              solicitacoes={solicitacoes}
              aeroportos={aeroportos}
              isLoading={isLoading}
              canManage={canManage}
              onAnalisar={setAnalisarSS}
              onViewDetail={setDetailSS}
            />
          </TabsContent>

          {/* === ABA ORDENS DE SERVIÇO === */}
          <TabsContent value="ordens" className="space-y-6">
            <ManutencaoStats ordens={ordensDeServico} />

            <div className="flex justify-end">
              {canManage && (
                <Button onClick={() => setIsFormOSOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('manutencao.novaOS')}
                </Button>
              )}
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    {t('manutencao.filtrosExportacao')}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isLoading}>
                    <FileDown className="w-4 h-4 mr-2" />
                    {t('manutencao.exportarPDF')} ({selectedOrdens.length > 0 ? selectedOrdens.length : filteredOrdens.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2">
                    <Label>{t('manutencao.pesquisarNumeroTitulo')}</Label>
                    <Input value={filtrosOS.busca} onChange={e => setFiltrosOS(prev => ({ ...prev, busca: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t('manutencao.status')}</Label>
                    <Select options={statusOSOptions} value={filtrosOS.status} onValueChange={v => setFiltrosOS(prev => ({ ...prev, status: v }))} />
                  </div>
                  <div>
                    <Label>{t('manutencao.prioridade')}</Label>
                    <Select options={prioridadeOptions} value={filtrosOS.prioridade} onValueChange={v => setFiltrosOS(prev => ({ ...prev, prioridade: v }))} />
                  </div>
                  <div>
                    <Label>{t('manutencao.aeroporto')}</Label>
                    <Select options={aeroportoOptions} value={filtrosOS.aeroporto} onValueChange={v => setFiltrosOS(prev => ({ ...prev, aeroporto: v }))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <ManutencaoList
              ordensServico={filteredOrdens}
              aeroportos={aeroportos}
              isLoading={isLoading}
              onReload={loadData}
              canManage={canManage}
              selectedOrdens={selectedOrdens}
              setSelectedOrdens={setSelectedOrdens}
              onOpenDetail={setDetailOrdem}
              onAtribuir={setAtribuirOrdem}
              onResponder={(ordem, acao) => { setResponderOrdem(ordem); setResponderAcao(acao || 'aceitar'); }}
              onEdit={(ordem) => { setEditingOrdem(ordem); setIsFormOSOpen(true); }}
              onSendEmail={handleSendEmail}
            />
          </TabsContent>

          {/* === ABA CONFIGURAÇÕES === */}
          {canManage && (
            <TabsContent value="configuracoes" className="space-y-6">
              <ConfigNotificacoesManutencao
                currentUser={currentUser}
                availableUsers={allUsers}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* === MODAIS === */}

      {isFormSSOpen && (
        <FormSolicitacaoServico
          isOpen={isFormSSOpen}
          onClose={() => setIsFormSSOpen(false)}
          aeroportos={aeroportos}
          currentUser={currentUser}
          onSuccess={(ssData) => { loadData(); notifyNewSS(ssData); setSuccessInfo({ isOpen: true, title: t('manutencao.successTitle'), message: t('manutencao.successSSSaved') }); }}
        />
      )}

      {analisarSS && (
        <AnalisarSSModal
          isOpen={!!analisarSS}
          onClose={() => setAnalisarSS(null)}
          solicitacao={analisarSS}
          aeroportos={aeroportos}
          currentUser={currentUser}
          onSuccess={() => { setAnalisarSS(null); loadData(); setSuccessInfo({ isOpen: true, title: t('manutencao.successTitle'), message: t('manutencao.successSSAnalyzed') }); }}
          onApproved={(ss, os) => notifySSApproved(ss, os)}
          onRejected={(ss, motivo) => notifySSRejected(ss, motivo)}
        />
      )}

      {detailSS && (
        <SolicitacaoDetailModal
          isOpen={!!detailSS}
          onClose={() => setDetailSS(null)}
          solicitacao={detailSS}
          aeroportos={aeroportos}
        />
      )}

      {isFormOSOpen && (
        <FormOrdemServico
          isOpen={isFormOSOpen}
          onClose={() => { setIsFormOSOpen(false); setEditingOrdem(null); }}
          onSubmit={handleFormOSSubmit}
          aeroportos={aeroportos}
          ordemInicial={editingOrdem}
        />
      )}

      {detailOrdem && (
        <OrdemServicoDetailModal
          isOpen={!!detailOrdem}
          onClose={() => setDetailOrdem(null)}
          ordem={detailOrdem}
          aeroportos={aeroportos}
        />
      )}

      {atribuirOrdem && (
        <AtribuirOSModal
          isOpen={!!atribuirOrdem}
          onClose={() => setAtribuirOrdem(null)}
          ordem={atribuirOrdem}
          onSuccess={() => { setAtribuirOrdem(null); loadData(); setSuccessInfo({ isOpen: true, title: t('manutencao.successTitle'), message: t('manutencao.successOSAssigned') }); }}
          onAssigned={(os, email, name) => notifyOSAssigned(os, email, name)}
        />
      )}

      {responderOrdem && (
        <ResponderOSModal
          isOpen={!!responderOrdem}
          onClose={() => { setResponderOrdem(null); setResponderAcao('aceitar'); }}
          ordem={responderOrdem}
          acao={responderAcao}
          currentUser={currentUser}
          onSubmit={async (payload) => {
            const { ordem_id, status, observacoes, ...extraFields } = payload;
            const updateData = { status };
            if (observacoes) updateData.observacoes_manutencao = observacoes;
            Object.assign(updateData, extraFields);
            // Remove non-DB fields
            delete updateData.acao;
            delete updateData.ordem_id;
            await OrdemServico.update(ordem_id, updateData);
            setResponderOrdem(null);
            setResponderAcao('aceitar');
            loadData();
            setSuccessInfo({ isOpen: true, title: t('manutencao.successTitle'), message: t('manutencao.successOSResponse') });
          }}
        />
      )}

      {successInfo.isOpen && (
        <SuccessModal
          isOpen={successInfo.isOpen}
          onClose={() => setSuccessInfo({ isOpen: false, title: '', message: '' })}
          title={successInfo.title}
          message={successInfo.message}
        />
      )}
    </div>
  );
}
