import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, FileDown, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';

import { OrdemServico } from '@/entities/OrdemServico';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { createPdfDoc, addHeader, addFooter, addTable, fetchEmpresaLogo, PDF } from '@/lib/pdfTemplate';

import ManutencaoStats from '../components/manutencao/ManutencaoStats';
import ManutencaoList from '../components/manutencao/ManutencaoList';
import FormOrdemServico from '../components/manutencao/FormOrdemServico';
import OrdemServicoDetailModal from '../components/manutencao/OrdemServicoDetailModal';
import AtribuirOSModal from '../components/manutencao/AtribuirOSModal';
import ResponderOSModal from '../components/manutencao/ResponderOSModal';
import SuccessModal from '../components/shared/SuccessModal';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { getAeroportosPermitidos, filtrarDadosPorAeroportoId } from '@/components/lib/userUtils';

export default function Manutencao() {
  const [currentUser, setCurrentUser] = useState(null); // Added state for current user
  const [ordensDeServico, setOrdensDeServico] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filtros, setFiltros] = useState({
    busca: '',
    status: 'todos',
    prioridade: 'todos',
    aeroporto: 'todos',
    categoria: 'todos'
  });

  const [selectedOrdens, setSelectedOrdens] = useState([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrdem, setEditingOrdem] = useState(null);
  const [detailOrdem, setDetailOrdem] = useState(null);
  const [atribuirOrdem, setAtribuirOrdem] = useState(null);
  const [responderOrdem, setResponderOrdem] = useState(null);
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [logoBase64, setLogoBase64] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Pre-fetch empresa logo for PDF generation
      fetchEmpresaLogo(user?.empresa_id).then(b64 => setLogoBase64(b64));

      const [ordensData, aeroportosData] = await Promise.all([
        OrdemServico.list('-data_abertura'),
        Aeroporto.list()
      ]);

      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');

      // Filtrar aeroportos pelos aeroportos de acesso do utilizador (empresa-based)
      const aeroportosFiltrados = getAeroportosPermitidos(user, aeroportosAngola);
      setAeroportos(aeroportosFiltrados);

      // Filtrar ordens de serviço pelos aeroportos de acesso do utilizador (empresa-based)
      const ordensFiltradas = filtrarDadosPorAeroportoId(user, ordensData, 'aeroporto_id', aeroportosAngola);
      setOrdensDeServico(ordensFiltradas);
      setUsers([]);
    } catch (error) {
      console.error('Erro ao carregar dados de manutenção:', error);

      // Verificar se é um erro de autenticação
      if (error.message && (error.message.includes('You must be logged in') || error.message.includes('not authenticated'))) {
        console.log('Sessão expirada, redirecionando para login...');
        try {
          await User.login();
          // After successful login attempt, retry loading data or redirect as needed
          // For now, we'll just let the user try again manually or reload
        } catch (loginError) {
          console.error('Erro ao fazer login:', loginError);
          window.location.href = createPageUrl('PaginaInicial'); // Redirect to initial page if login fails
        }
      } else if (error.response?.status === 403) {
        console.log('Acesso negado, redirecionando...');
        alert('Acesso negado. Você não tem permissão para visualizar esta página.');
        window.location.href = createPageUrl('Home'); // Redirect to Home if 403 Forbidden
      } else {
        // Para outros erros, mostrar mensagem mas continuar
        alert('Erro ao carregar dados. Tente recarregar a página.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingOrdem) {
        await OrdemServico.update(editingOrdem.id, data);
      } else {
        // Generate a new sequential number for the OS (per empresa)
        const currentYear = new Date().getFullYear();
        const empId = currentUser?.empresa_id;
        const latestOs = ordensDeServico
            .filter(os => os.numero_ordem && os.numero_ordem.startsWith(`OS-${currentYear}`) &&
              (!empId || os.empresa_id === empId))
            .sort((a, b) => {
                const numA = parseInt(a.numero_ordem.split('-')[2]);
                const numB = parseInt(b.numero_ordem.split('-')[2]);
                return numB - numA;
            })[0];

        let nextSequentialNumber = 1;
        if (latestOs) {
            nextSequentialNumber = parseInt(latestOs.numero_ordem.split('-')[2]) + 1;
        }

        const numeroOrdem = `OS-${currentYear}-${String(nextSequentialNumber).padStart(4, '0')}`;
        await OrdemServico.create({ ...data, numero_ordem: numeroOrdem, data_abertura: new Date().toISOString(), empresa_id: empId || null });
      }
      setIsFormOpen(false);
      setEditingOrdem(null);
      loadData();
      setSuccessInfo({ isOpen: true, title: 'Sucesso!', message: 'Ordem de Serviço salva com sucesso.' });
    } catch (error) {
      console.error("Erro ao salvar Ordem de Serviço:", error);
      alert(`Erro ao salvar Ordem de Serviço: ${error.message || error.toString()}`);
    }
  };

  const handleEdit = (ordem) => {
    setEditingOrdem(ordem);
    setIsFormOpen(true);
  };

  const handleSendEmail = async (recipient, subject, ordem) => {
    try {
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="/logo-dirops.png" alt="DIROPS Logo" style="height: 60px;">
            <h1 style="color: #1e40af; margin-top: 20px;">DIROPS</h1>
            <h2 style="color: #1e40af; margin: 10px 0 0 0;">Notificação de Ordem de Serviço: #${ordem.numero_ordem}</h2>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">Detalhes da Ordem de Serviço:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 150px;">Nº da Ordem:</td>
                <td style="padding: 8px;">${ordem.numero_ordem}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Título:</td>
                <td style="padding: 8px;">${ordem.titulo}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Prioridade:</td>
                <td style="padding: 8px;">${ordem.prioridade}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">Status:</td>
                <td style="padding: 8px;">${ordem.status}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Categoria:</td>
                <td style="padding: 8px;">${ordem.categoria_manutencao}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Data Abertura:</td>
                <td style="padding: 8px;">${new Date(ordem.data_abertura).toLocaleDateString('pt-AO')}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Aeroporto:</td>
                <td style="padding: 8px;">${aeroportos.find(a => a.id === ordem.aeroporto_id)?.nome || ordem.aeroporto_id}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 20px; margin-bottom: 10px;">Descrição do Problema:</h3>
            <p style="margin: 0;">${ordem.descricao_problema}</p>

            ${ordem.acao_corretiva_sugerida ? `
            <h3 style="color: #1e40af; margin-top: 20px; margin-bottom: 10px;">Ação Corretiva Sugerida:</h3>
            <p style="margin: 0;">${ordem.acao_corretiva_sugerida}</p>
            ` : ''}
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b;">
            <p><strong>Sistema DIROPS</strong><br>
            Direcção de Operações - Serviços de Gestão Aeroportuária</p>
          </div>
        </div>
      `;

      await sendEmailDirect({
        to: recipient,
        subject: subject || `DIROPS: Ordem de Serviço ${ordem.numero_ordem}`,
        body: emailBody
      });

      return true;

    } catch (error) {
      console.error("Erro ao enviar email de manutenção:", error);
      const errorMessage = error.response?.data?.detail || error.message || 'Ocorreu um erro desconhecido.';
      alert(`Erro ao enviar email: ${errorMessage}`);
      return false;
    }
  };

  const clearAllFilters = () => {
    setFiltros({
      busca: '',
      status: 'todos',
      prioridade: 'todos',
      aeroporto: 'todos',
      categoria: 'todos'
    });
  };

  const hasActiveFilters = Object.values(filtros).some(v => v !== '' && v !== 'todos');

  const filteredOrdens = useMemo(() => {
    return ordensDeServico.filter(os => {
      const searchMatch = filtros.busca === '' ||
        os.numero_ordem?.toLowerCase().includes(filtros.busca.toLowerCase()) ||
        os.titulo?.toLowerCase().includes(filtros.busca.toLowerCase());
      const statusMatch = filtros.status === 'todos' || os.status === filtros.status;
      const prioridadeMatch = filtros.prioridade === 'todos' || os.prioridade === filtros.prioridade;
      const aeroportoMatch = filtros.aeroporto === 'todos' || os.aeroporto_id === filtros.aeroporto;
      const categoriaMatch = filtros.categoria === 'todos' || os.categoria_manutencao === filtros.categoria;

      return searchMatch && statusMatch && prioridadeMatch && aeroportoMatch && categoriaMatch;
    });
  }, [ordensDeServico, filtros]);

  const handleExportPDF = async () => {
    setIsLoading(true);
    try {
      const ordensParaExportar = selectedOrdens.length > 0
        ? ordensDeServico.filter(os => selectedOrdens.includes(os.id))
        : filteredOrdens;

      if (ordensParaExportar.length === 0) {
        alert('Nenhuma Ordem de Serviço encontrada para exportar.');
        setIsLoading(false);
        return;
      }

      const doc = await createPdfDoc({ orientation: 'portrait' });

      const headerOpts = {
        title: 'Relatório de Ordens de Serviço',
        logoBase64,
        date: new Date().toLocaleDateString('pt-AO'),
        meta: [`Total de Ordens: ${ordensParaExportar.length}`],
      };

      let y = addHeader(doc, headerOpts);

      // Build table columns and rows
      const columns = [
        { label: 'Protocolo', width: 30 },
        { label: 'Título', width: 50 },
        { label: 'Status', width: 28 },
        { label: 'Prioridade', width: 25 },
        { label: 'Data', width: 22 },
        { label: 'Descrição', width: 25 },
      ];

      const rows = ordensParaExportar.map(ordem => [
        ordem.numero_ordem || 'N/A',
        ordem.titulo || 'N/A',
        ordem.status || 'N/A',
        ordem.prioridade || 'N/A',
        new Date(ordem.data_abertura || ordem.created_date).toLocaleDateString('pt-AO'),
        ordem.descricao_problema
          ? (ordem.descricao_problema.substring(0, 40) + (ordem.descricao_problema.length > 40 ? '...' : ''))
          : '',
      ]);

      y = addTable(doc, y, { columns, rows, headerOpts });

      addFooter(doc, { generatedBy: currentUser?.full_name || currentUser?.email });

      doc.save(`relatorio_manutencao_${new Date().toISOString().split('T')[0]}.pdf`);

      setSuccessInfo({
        isOpen: true,
        title: 'Relatório Exportado!',
        message: 'O seu relatório PDF foi gerado com sucesso.'
      });

    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      alert(`Ocorreu um erro ao gerar o relatório PDF: ${error.message || ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const canManage = true; // Everyone can manage now

  const statusOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'atribuida', label: 'Atribuída' },
    { value: 'em_execucao', label: 'Em Execução' },
    { value: 'aguardando_verificacao', label: 'Aguardando Verificação' },
    { value: 'concluida', label: 'Concluída' },
    { value: 'rejeitada', label: 'Rejeitada' }
  ];

  const prioridadeOptions = [
    { value: 'todos', label: 'Todas' },
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' }
  ];

  const aeroportoOptions = useMemo(() => {
    return [
      { value: 'todos', label: 'Todos' },
      ...aeroportos.map(a => ({ value: a.id, label: a.nome })) // Changed a.codigo_icao to a.id based on the filtering logic that uses a.id
    ];
  }, [aeroportos]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-900">Gestão de Manutenção</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Ordem de Serviço
            </Button>
          </div>
        </div>

        <ManutencaoStats ordens={ordensDeServico} />

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-500" />
                Filtros e Exportação
              </CardTitle>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters} className="text-red-600 border-red-200 hover:bg-red-50">
                    <X className="w-4 h-4 mr-1" />
                    Limpar Filtros
                  </Button>
                )}
                <Button variant="outline" onClick={handleExportPDF} disabled={isLoading}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportar PDF ({selectedOrdens.length > 0 ? selectedOrdens.length : filteredOrdens.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <Label>Pesquisar por Nº ou Título</Label>
                <Input
                  value={filtros.busca}
                  onChange={e => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  options={statusOptions}
                  value={filtros.status}
                  onValueChange={v => setFiltros(prev => ({ ...prev, status: v }))}
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select
                  options={prioridadeOptions}
                  value={filtros.prioridade}
                  onValueChange={v => setFiltros(prev => ({ ...prev, prioridade: v }))}
                />
              </div>
              <div>
                <Label>Aeroporto</Label>
                <Select
                  options={aeroportoOptions}
                  value={filtros.aeroporto}
                  onValueChange={v => setFiltros(prev => ({ ...prev, aeroporto: v }))}
                />
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
          onResponder={setResponderOrdem}
          onEdit={handleEdit}
          onSendEmail={handleSendEmail}
        />
      </div>

      {isFormOpen && (
        <FormOrdemServico
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingOrdem(null); }}
          onSubmit={handleFormSubmit}
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
          users={users}
        />
      )}

      {atribuirOrdem && (
        <AtribuirOSModal
          isOpen={!!atribuirOrdem}
          onClose={() => setAtribuirOrdem(null)}
          ordem={atribuirOrdem}
          users={[]}
          onSuccess={() => {
            loadData();
            setSuccessInfo({isOpen: true, title: "Sucesso", message: "Ordem de serviço atribuída com sucesso!"});
          }}
        />
      )}

      {responderOrdem && (
        <ResponderOSModal
          isOpen={!!responderOrdem}
          onClose={() => setResponderOrdem(null)}
          ordem={responderOrdem}
          onSuccess={() => {
            loadData();
            setSuccessInfo({isOpen: true, title: "Sucesso", message: "Resposta à ordem de serviço enviada com sucesso!"});
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