import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Search,
  Edit,
  User,
  MailCheck,
  UserPlus,
  XCircle,
  CheckCircle,
  Download,
  Shield,
  Trash2,
  // New icons for statistics
  UserCheck, // for active users card
  Mail,      // for pending requests card
  Globe,     // for airport distribution card
  Activity,  // for company distribution card
  Filter,    // New icon for filter section
  X,         // New icon for clearing filters
  Check,     // New icon for combobox selection
  ChevronsUpDown // New icon for combobox trigger
} from 'lucide-react';

import { SolicitacaoAcesso } from '@/entities/SolicitacaoAcesso';
import { User as UserEntity } from '@/entities/User';
import { Aeroporto } from '@/entities/Aeroporto';
import { Empresa } from '@/entities/Empresa';
import { downloadAsCSV } from '../components/lib/export';
import { hasUserProfile, isAdminProfile } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/components/lib/i18n';

import AprovarAcessoModal from '../components/gestao/AprovarAcessoModal';
import EditUserModal from '../components/gestao/EditUserModal';
import AddUserModal from '../components/gestao/AddUserModal';
import AlertModal from '../components/shared/AlertModal';
import AccessDenied from '../components/shared/AccessDenied';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


const STATUS_CONFIG = {
  'pendente': { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pendente' },
  'aprovado': { className: 'bg-green-100 text-green-800 border-green-200', label: 'Aprovado' },
  'aguardando_convite': { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Aguardando Convite' },
  'rejeitado': { className: 'bg-red-100 text-red-800 border-red-200', label: 'Rejeitado' },
  'ativo': { className: 'bg-green-100 text-green-800 border-green-200', label: 'Ativo' },
  'inativo': { className: 'bg-red-100 text-red-800 border-red-200', label: 'Inativo' },
  'desconhecido': { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Desconhecido' }
};

const PERFIL_LABELS = {
  administrador: 'Administrador',
  operacoes: 'Operações',
  safety: 'Safety',
  infraestrutura: 'Infraestrutura',
  credenciamento: 'Credenciamento',
  gestor_empresa: 'Gestor de Empresa',
  visualizador: 'Visualizador'
};

export default function GestaoAcessos() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const [currentUser, setCurrentUser] = useState(null);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [users, setUsers] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('solicitacoes');

  const [isAprovarModalOpen, setIsAprovarModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModal] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  
  const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [rejectionInfo, setRejectionInfo] = useState({ isOpen: false, solicitacao: null });
  const [exclusionInfo, setExclusionInfo] = useState({ isOpen: false, solicitacao: null });
  const [userExclusionInfo, setUserExclusionInfo] = useState({ isOpen: false, user: null }); // New state for user exclusion

  const [searchTerm, setSearchTerm] = useState('');
  
  // Adicionar estados para filtros avançados
  const [filtros, setFiltros] = useState({
    status: 'todos',
    perfil: 'todos',
    aeroporto: 'todos',
    empresa: 'todos'
  });

  // Estados para controlar abertura dos popovers de filtro
  const [openPopovers, setOpenPopovers] = useState({
    status: false,
    perfil: false,
    aeroporto: false,
    empresa: false
  });

  // Define loadData here using useCallback
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await UserEntity.me();
      setCurrentUser(user);

      if (!user || !isAdminProfile(user)) {
        setIsLoading(false);
        return;
      }

      // Server-side filter solicitacoes by empresa when CompanyView is active
      const solicitacaoPromise = effectiveEmpresaId
        ? SolicitacaoAcesso.filter({ empresa_solicitante_id: effectiveEmpresaId }, '-created_date')
        : SolicitacaoAcesso.list('-created_date');

      const [solicitacoesData, usersData, aeroportosData, empresasData] = await Promise.all([
        solicitacaoPromise,
        UserEntity.list(),
        (effectiveEmpresaId || user.empresa_id) ? Aeroporto.filter({ empresa_id: effectiveEmpresaId || user.empresa_id }) : Aeroporto.list(),
        Empresa.list(),
      ]);

      const allAeroportos = aeroportosData.filter(a => a.pais === 'AO') || [];
      setAeroportos(allAeroportos);
      setEmpresas(empresasData || []);

      // Filtrar utilizadores válidos
      let validUsers = (usersData || []).filter(u => u && u.id && u.email);
      let filteredSolicitacoes = solicitacoesData || [];

      // Filtrar utilizadores por empresa quando CompanyView está ativo
      // (solicitacoes already filtered server-side above)
      if (effectiveEmpresaId) {
        const solicitacaoUserIds = new Set(filteredSolicitacoes.map(s => s.user_id).filter(Boolean));
        const solicitacaoEmails = new Set(filteredSolicitacoes.map(s => s.email?.toLowerCase()).filter(Boolean));
        // Filtrar utilizadores: da empresa OU que têm solicitação pendente para esta empresa
        validUsers = validUsers.filter(u =>
          u.empresa_id === effectiveEmpresaId ||
          solicitacaoUserIds.has(u.id) ||
          solicitacaoEmails.has(u.email?.toLowerCase())
        );
      }

      setSolicitacoes(filteredSolicitacoes);
      setUsers(validUsers);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao carregar dados. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  }, [effectiveEmpresaId]);

  // Mover funções auxiliares para useCallback para estabilizar as suas referências
  const getAeroportoNome = useCallback((idOuIcao) => {
    if (!idOuIcao) return null;
    const aeroporto = aeroportos.find(a => a.id === idOuIcao || a.codigo_icao === idOuIcao);
    return aeroporto ? aeroporto.codigo_icao : idOuIcao; // Retorna sempre o ICAO ou o valor original se não encontrar
  }, [aeroportos]);

  const getEmpresaNome = useCallback((empresaId) => {
    const empresa = empresas.find(e => e.id === empresaId);
    return empresa ? empresa.nome : 'N/A';
  }, [empresas]);

  const handleFilterChange = useCallback((field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
    setOpenPopovers(prev => ({ ...prev, [field]: false })); // Close the popover after selection
  }, []);

  const clearFilters = useCallback(() => {
    setFiltros({
      status: 'todos',
      perfil: 'todos',
      aeroporto: 'todos',
      empresa: 'todos'
    });
    setSearchTerm('');
  }, []);

  // Mover todos os useMemo e useCallback para o topo, antes de qualquer retorno condicional
  const solicitacoesPendentes = useMemo(() => {
    return solicitacoes.filter(s => s.status === 'pendente');
  }, [solicitacoes]);

  const filteredUsers = useMemo(() => {
    // Check if any filter is active
    const noFiltersActive = !searchTerm && 
                            filtros.status === 'todos' && 
                            filtros.perfil === 'todos' && 
                            filtros.aeroporto === 'todos' && 
                            filtros.empresa === 'todos';

    if (noFiltersActive) {
      return users;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    return users.filter(user => {
      // Filtro de busca por texto
      let perfisText = '';
      
      // Verificação segura para perfis - suporta tanto array quanto string
      if (user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0) {
        perfisText = user.perfis.map(p => PERFIL_LABELS[p] || p).join(' ');
      } else if (user.perfil) {
        perfisText = PERFIL_LABELS[user.perfil] || user.perfil;
      }
      
      const textMatch = !searchTerm || 
        (user.full_name || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (user.email || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (user.telefone || '').toLowerCase().includes(lowerCaseSearchTerm) || 
        perfisText.toLowerCase().includes(lowerCaseSearchTerm) ||
        (getEmpresaNome(user.empresa_id) || '').toLowerCase().includes(lowerCaseSearchTerm);

      // Filtro de status - tratar null/undefined como "desconhecido"
      let statusMatch = filtros.status === 'todos';
      if (!statusMatch) {
        const userStatus = user.status || 'desconhecido';
        statusMatch = userStatus === filtros.status;
      }

      // Filtro de perfil - suporta tanto array quanto string
      let perfilMatch = filtros.perfil === 'todos';
      if (!perfilMatch) {
        if (user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0) {
          perfilMatch = user.perfis.includes(filtros.perfil);
        } else if (user.perfil) {
          perfilMatch = user.perfil === filtros.perfil;
        }
      }

      // Filtro de aeroporto
      const aeroportoMatch = filtros.aeroporto === 'todos' || 
        (user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso) && 
         user.aeroportos_acesso.includes(filtros.aeroporto));

      // Filtro de empresa
      const empresaMatch = filtros.empresa === 'todos' || user.empresa_id === filtros.empresa;

      return textMatch && statusMatch && perfilMatch && aeroportoMatch && empresaMatch;
    });
  }, [users, searchTerm, filtros, getEmpresaNome]);

  // Opções para os dropdowns de filtro
  const statusOptions = useMemo(() => [
    { value: 'todos', label: 'Todos os Status' },
    { value: 'ativo', label: 'Ativo' },
    { value: 'inativo', label: 'Inativo' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'desconhecido', label: 'Desconhecido' }
  ], []);

  const perfilOptions = useMemo(() => [
    { value: 'todos', label: 'Todos os Perfis' },
    { value: 'administrador', label: 'Administrador' },
    { value: 'operacoes', label: 'Operações' },
    { value: 'infraestrutura', label: 'Infraestrutura' },
    { value: 'credenciamento', label: 'Credenciamento' },
    { value: 'gestor_empresa', label: 'Gestor de Empresa' },
    { value: 'visualizador', label: 'Visualizador' }
  ], []);

  const aeroportoOptions = useMemo(() => [
    { value: 'todos', label: 'Todos os Aeroportos' },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))
  ], [aeroportos]);

  const empresaOptions = useMemo(() => [
    { value: 'todos', label: 'Todas as Empresas' },
    ...empresas.map(e => ({ value: e.id, label: e.nome }))
  ], [empresas]);

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filtros.status !== 'todos') count++;
    if (filtros.perfil !== 'todos') count++;
    if (filtros.aeroporto !== 'todos') count++;
    if (filtros.empresa !== 'todos') count++;
    if (searchTerm) count++;
    return count;
  }, [filtros, searchTerm]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'ativo').length;
    const inactiveUsers = users.filter(u => u.status === 'inativo').length;
    const pendingUsers = users.filter(u => u.status === 'pendente').length;
    
    // Distribuição por perfil
    const perfilDistribution = {};
    users.forEach(user => {
      if (user.perfis && Array.isArray(user.perfis)) {
        user.perfis.forEach(perfil => {
          perfilDistribution[perfil] = (perfilDistribution[perfil] || 0) + 1;
        });
      }
    });

    // Distribuição por aeroporto
    const aeroportoDistribution = {};
    users.forEach(user => {
      if (user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso)) {
        user.aeroportos_acesso.forEach(icao => {
          const aeroporto = aeroportos.find(a => a.codigo_icao === icao);
          const nome = aeroporto ? aeroporto.codigo_icao : icao;
          if (nome) {
            aeroportoDistribution[nome] = (aeroportoDistribution[nome] || 0) + 1;
          }
        });
      }
    });

    // Distribuição por empresa
    const empresaDistribution = {};
    users.forEach(user => {
      if (user.empresa_id) {
        const empresaNome = getEmpresaNome(user.empresa_id);
        if (empresaNome !== 'N/A') {
          empresaDistribution[empresaNome] = (empresaDistribution[empresaNome] || 0) + 1;
        }
      }
    });

    // Solicitações por status
    const solicitacoesPendentesCount = solicitacoes.filter(s => s.status === 'pendente').length;
    const solicitacoesAprovadas = solicitacoes.filter(s => s.status === 'aprovado').length;
    const solicitacoesRejeitadas = solicitacoes.filter(s => s.status === 'rejeitado').length;

    // Novas solicitações este mês
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const novasSolicitacoesMes = solicitacoes.filter(s => {
      const solicitacaoDate = new Date(s.created_date);
      return solicitacaoDate.getMonth() === currentMonth && 
             solicitacaoDate.getFullYear() === currentYear;
    }).length;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      pendingUsers,
      perfilDistribution,
      aeroportoDistribution,
      empresaDistribution,
      solicitacoesPendentes: solicitacoesPendentesCount,
      solicitacoesAprovadas,
      solicitacoesRejeitadas,
      novasSolicitacoesMes
    };
  }, [users, solicitacoes, aeroportos, getEmpresaNome]);

  useEffect(() => {
    loadData();
  }, [loadData]); // Now loadData is a dependency of useEffect

  // Agora os retornos condicionais podem ser usados com segurança
  if (!isLoading && currentUser && !isAdminProfile(currentUser)) {
    return <AccessDenied />;
  }

  const handleOpenAprovarModal = (solicitacao) => {
    setSelectedSolicitacao(solicitacao);
    setIsAprovarModalOpen(true);
  };

  const handleAprovarSolicitacao = async (solicitacaoId, dadosAprovacao) => { 
    const { perfis, aeroportos, empresa_id, observacoes } = dadosAprovacao;

    const solicitacao = solicitacoes.find(s => s.id === solicitacaoId);
    if (!solicitacao) {
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: 'Solicitação não encontrada.' });
      return;
    }

    try {
      // Prevenir solicitações duplicadas: Verificar se já existe um utilizador ATIVO com o mesmo e-mail.
      const existingUsersWithSameEmail = users.filter(u => u.email === solicitacao.email);
      const activeDuplicateUser = existingUsersWithSameEmail.find(u => u.status === 'ativo' && u.id !== solicitacao.user_id);

      if (activeDuplicateUser) {
        setIsAprovarModalOpen(false);
        setSelectedSolicitacao(null);
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Solicitação Duplicada Detectada',
          message: `Um utilizador ativo (${activeDuplicateUser.full_name}, ID: ${activeDuplicateUser.id}) com o mesmo e-mail (${solicitacao.email}) já existe no sistema. Não é possível ativar/criar um novo utilizador com este e-mail. Por favor, reveja a situação ou contacte o suporte.`,
        });
        return; // Interrompe o processo de aprovação
      }

      // Atualizar o User com os perfis, aeroportos aprovados E o full_name
      const userUpdateData = {
        full_name: solicitacao.nome_completo, // CRÍTICO: Adicionar full_name da solicitação
        perfis: perfis,
        aeroportos_acesso: aeroportos,
        telefone: solicitacao.telefone || null,
        status: 'ativo'
      };

      // Adicionar empresa se fornecida
      if (empresa_id) {
        userUpdateData.empresa_id = empresa_id;
      }

      await UserEntity.update(solicitacao.user_id, userUpdateData);
      
      await SolicitacaoAcesso.update(solicitacaoId, {
        status: 'aprovado',
        data_resposta: new Date().toISOString(),
        perfil_aprovado: perfis,
        aeroportos_aprovados: aeroportos,
        observacoes_aprovacao: observacoes
      });

      // Enviar email ao solicitante
      const nomeUtilizador = solicitacao.nome_completo || solicitacao.email.split('@')[0];
      const perfisFormatados = perfis.map(p => PERFIL_LABELS[p] || p).join(', ');
      const aeroportosNomes = aeroportos.length > 0
        ? aeroportos.map(icao => getAeroportoNome(icao)).join(', ')
        : 'Todos os aeroportos'; // Ajuste conforme a lógica de "todos" aeroportos

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">✅ Solicitação de Acesso Aprovada</h2>
          <p>Olá <strong>${nomeUtilizador}</strong>,</p>
          <p>A sua solicitação de acesso ao sistema DIROPS foi <strong>aprovada</strong>!</p>
          
          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p><strong>📋 Detalhes da Aprovação:</strong></p>
            <ul style="margin: 10px 0;">
              <li><strong>Perfis Aprovados:</strong> ${perfisFormatados}</li>
              <li><strong>Aeroportos Autorizados:</strong> ${aeroportosNomes}</li>
              ${observacoes ? `<li><strong>Observações:</strong> ${observacoes}</li>` : ''}
            </ul>
          </div>
          
          <p><strong>Próximos Passos:</strong></p>
          <p>Já pode aceder ao sistema DIROPS usando o seu e-mail <strong>${solicitacao.email}</strong>.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${window.location.origin}" style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Aceder ao Sistema
            </a>
          </div>
          
          <p>Bem-vindo(a) à equipa!</p>
          <p>Atenciosamente,<br><strong>Equipa DIROPS</strong></p>
        </div>
      `;

      await base44.integrations.Core.SendEmail({
        to: solicitacao.email,
        subject: 'DIROPS: Solicitação de Acesso Aprovada ✅',
        body: emailBody,
        from_name: 'DIROPS'
      });

      setIsAprovarModalOpen(false);
      setSelectedSolicitacao(null);
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Acesso Concedido',
        message: 'O utilizador foi aprovado e notificado por e-mail. As suas permissões estão ativas.'
      });
      loadData();
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Aprovar',
        message: `Ocorreu um erro: ${error.message}`
      });
    }
  };

  const handleOpenRejeitarModal = (solicitacao) => {
    setRejectionInfo({ isOpen: true, solicitacao: solicitacao });
  };

  const handleRejeitarSolicitacao = async () => {
    const { solicitacao } = rejectionInfo;
    if (!solicitacao) return;

    try {
      await SolicitacaoAcesso.update(solicitacao.id, {
        status: 'rejeitado',
        data_resposta: new Date().toISOString()
      });

      await base44.integrations.Core.SendEmail({
        to: solicitacao.email,
        subject: "DIROPS: Solicitação de Acesso Rejeitada",
        body: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Solicitação Rejeitada</h2>
            <p>Olá ${solicitacao.nome_completo},</p>
            <p>Lamentamos informar que a sua solicitação de acesso ao sistema DIROPS foi rejeitada.</p>
            <p>Para mais informações, por favor, entre em contacto com o administrador do sistema.</p>
            <p style="margin-top: 20px; font-size: 0.9em; color: #555;">Atenciosamente,<br>Equipe DIROPS</p>
          </div>
        `,
        from_name: "DIROPS Notificações"
      });

      setRejectionInfo({ isOpen: false, solicitacao: null });
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Solicitação Rejeitada',
        message: 'A solicitação foi rejeitada e o utilizador notificado por e-mail.'
      });
      loadData();
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Rejeitar',
        message: `Ocorreu um erro: ${error.message}`
      });
    }
  };

  const handleOpenExcluirModal = (solicitacao) => {
    // Validar se a solicitação existe antes de abrir o modal
    if (!solicitacao || !solicitacao.id) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Solicitação inválida. Por favor, atualize a página.'
      });
      return;
    }
    
    setExclusionInfo({ isOpen: true, solicitacao: solicitacao });
  };

  const handleExcluirSolicitacao = async (solicitacao) => {
    if (!solicitacao || !solicitacao.id) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Dados da solicitação inválidos. Por favor, atualize a página.'
      });
      return;
    }

    try {
      await SolicitacaoAcesso.delete(solicitacao.id);
      
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Solicitação Excluída',
        message: 'A solicitação foi excluída com sucesso.'
      });
      loadData();
    } catch (error) {
      console.error('Erro ao excluir solicitação:', error);
      
      // Tratar erro 404 especificamente
      if (error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('not found')) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Solicitação Não Encontrada',
          message: 'A solicitação que tentou excluir já não existe. A lista será atualizada.'
        });
        loadData();
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Excluir',
          message: `Ocorreu um erro: ${error.message || 'Erro desconhecido'}`
        });
      }
    }
  };

  const handleOpenEditUserModal = (user) => { 
    setSelectedUser(user);
    setIsEditUserModal(true);
  };
  
  const handleUpdateUser = async (userId, data) => { 
    try {
      await UserEntity.update(userId, data);
      setIsEditUserModal(false);
      setSelectedUser(null);
      loadData();
      setAlertInfo({ isOpen: true, type: 'success', title: 'Sucesso', message: `Utilizador atualizado com sucesso.` });
    } catch (error) {
      console.error('Erro ao salvar utilizador:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro', message: `Erro ao salvar utilizador: ${error.message}` });
    }
  };

  const handleOpenExcluirUserModal = (user) => {
    // Validar se o utilizador existe antes de abrir o modal
    if (!user || !user.id) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Utilizador inválido. Por favor, atualize a página.'
      });
      return;
    }
    
    setUserExclusionInfo({ isOpen: true, user: user });
  };

  const handleExcluirUser = async () => {
    const { user } = userExclusionInfo;
    if (!user || !user.id) {
      setUserExclusionInfo({ isOpen: false, user: null }); // Close modal to avoid stale state
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Dados do utilizador inválidos. Por favor, atualize a página e tente novamente.'
      });
      return;
    }

    // Fechar o modal de confirmação primeiro
    setUserExclusionInfo({ isOpen: false, user: null });

    try {
      // Tentar buscar o utilizador primeiro para verificar se existe
      try {
        await UserEntity.get(user.id); // This will throw 404 if not found
      } catch (checkError) {
        // If not found (404), means it's already gone or never existed
        if (checkError.response?.status === 404 || checkError.message?.includes('404') || checkError.message?.includes('not found')) {
          setAlertInfo({
            isOpen: true,
            type: 'warning',
            title: 'Utilizador Já Excluído',
            message: 'Este utilizador já foi excluído do sistema. A lista será atualizada.'
          });
          loadData();
          return; // Stop further execution
        }
        // For other errors during GET, we might still want to try DELETE, so log and continue
        console.warn('Erro ao verificar existência do utilizador antes da exclusão:', checkError);
      }

      // If user exists or GET check had non-404 error, proceed with deletion
      await UserEntity.delete(user.id);
      
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Utilizador Excluído',
        message: 'O utilizador foi excluído com sucesso do sistema.'
      });
      loadData();
    } catch (error) {
      console.error('Erro ao excluir utilizador:', error);
      
      // Specific error handling for the DELETE operation
      if (error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('not found')) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Utilizador Não Encontrado',
          message: 'O utilizador que tentou excluir já não existe no sistema. A lista será atualizada.'
        });
        loadData();
      } else if (error.response?.status === 403) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Sem Permissão',
          message: 'Você não tem permissão para excluir este utilizador.'
        });
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro ao Excluir',
          message: `Ocorreu um erro ao excluir o utilizador: ${error.message || 'Erro desconhecido'}. Por favor, atualize a página e tente novamente.`
        });
      }
    }
  };

  const handleExportUsersCSV = () => {
    const dataToExport = filteredUsers.map(user => {
      const perfisText = Array.isArray(user.perfis) ? 
        user.perfis.map(p => PERFIL_LABELS[p] || p).join(', ') : 
        PERFIL_LABELS[user.perfil] || user.perfil || 'N/A';
      
      return {
        'Nome Completo': user.full_name || '',
        'Email': user.email || '',
        'Telefone': user.telefone || 'N/A',
        'Perfis': perfisText,
        'Empresa': getEmpresaNome(user.empresa_id) || 'N/A',
        'Status': STATUS_CONFIG[user.status || 'desconhecido']?.label || 'N/A',
        'Aeroportos de Acesso': (user.aeroportos_acesso || []).map(icao => getAeroportoNome(icao)).join(', ') || 'Nenhum',
      };
    });
    downloadAsCSV(dataToExport, `utilizadores_dirops_${new Date().toISOString().split('T')[0]}`);
    setAlertInfo({
        isOpen: true,
        type: 'success',
        title: 'Exportação Concluída',
        message: 'A lista de utilizadores foi exportada para CSV com sucesso.'
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-lg text-slate-700">{t('acessos.carregando')}</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 dark:text-slate-100 flex items-center gap-3">
              <Users className="w-6 md:w-8 h-6 md:h-8 text-blue-600 dark:text-blue-400" />
              {t('page.gestao_acessos.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{t('page.gestao_acessos.subtitle')}</p>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('acessos.totalUtilizadores')}</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.totalUsers}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {stats.activeUsers} {t('acessos.ativos')} · {stats.inactiveUsers} {t('acessos.inativos')}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('acessos.utilizadoresAtivos')}</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.activeUsers}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% {t('acessos.doTotal')}
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <UserCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('acessos.solicitacoesPendentes')}</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.solicitacoesPendentes}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {stats.novasSolicitacoesMes} {t('acessos.novosEsteMes')}
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <Mail className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('acessos.taxaAprovacao')}</p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {(stats.solicitacoesAprovadas + stats.solicitacoesRejeitadas) > 0 
                      ? Math.round((stats.solicitacoesAprovadas / (stats.solicitacoesAprovadas + stats.solicitacoesRejeitadas)) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {stats.solicitacoesAprovadas} {t('acessos.aprovadas')} · {stats.solicitacoesRejeitadas} {t('acessos.rejeitadas')}
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Distribuição */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Distribuição por Perfil */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                {t('acessos.distribuicaoPerfil')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.totalUsers > 0 && Object.entries(stats.perfilDistribution).length > 0 ? (
                  Object.entries(stats.perfilDistribution).sort(([, countA], [, countB]) => countB - countA).map(([perfil, count]) => (
                    <div key={perfil} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                        {PERFIL_LABELS[perfil] || perfil}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t('acessos.nenhumDado')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Distribuição por Aeroporto */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                {t('acessos.distribuicaoAeroporto')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {stats.totalUsers > 0 && Object.entries(stats.aeroportoDistribution).length > 0 ? (
                  Object.entries(stats.aeroportoDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([aeroporto, count]) => (
                      <div key={aeroporto} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{aeroporto}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t('acessos.nenhumDado')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Distribuição por Empresa */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                {t('acessos.topEmpresas')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {stats.totalUsers > 0 && Object.entries(stats.empresaDistribution).length > 0 ? (
                  Object.entries(stats.empresaDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([empresa, count]) => (
                      <div key={empresa} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={empresa}>
                          {empresa}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t('acessos.nenhumDado')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="solicitacoes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="solicitacoes">
              <MailCheck className="w-4 h-4 mr-2" />
              {t('acessos.tabSolicitacoes')} ({solicitacoesPendentes.length})
            </TabsTrigger>
            <TabsTrigger value="utilizadores">
              <User className="w-4 h-4 mr-2" />
              {t('acessos.tabUtilizadores')} ({users.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="solicitacoes" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>{t('acessos.novosPedidos')}</CardTitle>
                <CardDescription>{t('acessos.novosPedidosDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('acessos.solicitante')}</TableHead>
                        <TableHead>{t('acessos.perfilSolicitado')}</TableHead>
                        <TableHead>{t('acessos.empresa')}</TableHead>
                        <TableHead>{t('acessos.data')}</TableHead>
                        <TableHead className="text-right">{t('acessos.acoes')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array(3).fill(0).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                          </TableRow>
                        ))
                      ) : solicitacoesPendentes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                            <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                            <p className="text-lg font-medium">{t('acessos.nenhumResultado')}</p>
                            <p className="text-sm mt-1">{t('acessos.semSolicitacoes')}</p>
                          </TableCell>
                        </TableRow>
                      ) : solicitacoesPendentes.map((solicitacao) => {
                        return (
                          <TableRow key={solicitacao.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{solicitacao.nome_completo}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">{solicitacao.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {PERFIL_LABELS[solicitacao.perfil_solicitado] || solicitacao.perfil_solicitado}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-slate-500 dark:text-slate-400">
                                {solicitacao.empresa_solicitante_id ? getEmpresaNome(solicitacao.empresa_solicitante_id) : 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell>
                              {new Date(solicitacao.created_date).toLocaleDateString('pt-AO')}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenExcluirModal(solicitacao)}
                                className="text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                {t('acessos.excluir')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRejeitarModal(solicitacao)}
                                className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                {t('acessos.rejeitar')}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleOpenAprovarModal(solicitacao)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {t('acessos.aprovar')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="utilizadores" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{t('acessos.gerirUtilizadores')}</CardTitle>
                    <CardDescription>{t('acessos.gerirUtilizadoresDesc')}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleExportUsersCSV}
                      disabled={filteredUsers.length === 0}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t('acessos.exportarCSV')}
                    </Button>
                    <Button
                      onClick={() => setIsAddUserModalOpen(true)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {t('acessos.adicionarUtilizador')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Seção de Filtros Avançados */}
                <Card className="mb-6 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        {t('acessos.filtrosPesquisa')}
                        {activeFiltersCount > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {activeFiltersCount} {activeFiltersCount === 1 ? t('acessos.filtroAtivo') : t('acessos.filtrosAtivos')}
                          </Badge>
                        )}
                      </CardTitle>
                      {activeFiltersCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          <X className="w-4 h-4 mr-1" />
                          {t('acessos.limparFiltros')}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* Busca por Texto */}
                      <div className="lg:col-span-2">
                        <Label htmlFor="search">{t('acessos.pesquisar')}</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <Input
                            id="search"
                            placeholder={t('acessos.placeholderPesquisa')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>

                      {/* Filtro de Status com Busca */}
                      <div>
                        <Label htmlFor="filter-status">{t('acessos.status')}</Label>
                        <Popover open={openPopovers.status} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, status: open }))}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openPopovers.status}
                              className="w-full justify-between text-left font-normal"
                            >
                              {statusOptions.find(opt => opt.value === filtros.status)?.label || t('acessos.selecionarStatus')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder={t('acessos.procurarStatus')} />
                              <CommandEmpty>{t('acessos.nenhumStatus')}</CommandEmpty>
                              <CommandGroup>
                                {statusOptions.map((option) => (
                                  <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => handleFilterChange('status', option.value)}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        filtros.status === option.value ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    {option.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Filtro de Perfil com Busca */}
                      <div>
                        <Label htmlFor="filter-perfil">{t('acessos.perfil')}</Label>
                        <Popover open={openPopovers.perfil} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, perfil: open }))}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openPopovers.perfil}
                              className="w-full justify-between text-left font-normal"
                            >
                              {perfilOptions.find(opt => opt.value === filtros.perfil)?.label || t('acessos.selecionarPerfil')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder={t('acessos.procurarPerfil')} />
                              <CommandEmpty>{t('acessos.nenhumPerfil')}</CommandEmpty>
                              <CommandGroup>
                                {perfilOptions.map((option) => (
                                  <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => handleFilterChange('perfil', option.value)}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        filtros.perfil === option.value ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    {option.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Filtro de Aeroporto com Busca */}
                      <div>
                        <Label htmlFor="filter-aeroporto">{t('acessos.aeroporto')}</Label>
                        <Popover open={openPopovers.aeroporto} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, aeroporto: open }))}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openPopovers.aeroporto}
                              className="w-full justify-between text-left font-normal"
                            >
                              {aeroportoOptions.find(opt => opt.value === filtros.aeroporto)?.label || t('acessos.selecionarAeroporto')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder={t('acessos.procurarAeroporto')} />
                              <CommandEmpty>{t('acessos.nenhumAeroporto')}</CommandEmpty>
                              <CommandGroup>
                                {aeroportoOptions.map((option) => (
                                  <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => handleFilterChange('aeroporto', option.value)}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        filtros.aeroporto === option.value ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    {option.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Filtro de Empresa com Busca */}
                      <div className="lg:col-span-2">
                        <Label htmlFor="filter-empresa">{t('acessos.empresa')}</Label>
                        <Popover open={openPopovers.empresa} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, empresa: open }))}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openPopovers.empresa}
                              className="w-full justify-between text-left font-normal"
                            >
                              {empresaOptions.find(opt => opt.value === filtros.empresa)?.label || t('acessos.selecionarEmpresa')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder={t('acessos.procurarEmpresa')} />
                              <CommandEmpty>{t('acessos.nenhumaEmpresa')}</CommandEmpty>
                              <CommandGroup>
                                {empresaOptions.map((option) => (
                                  <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => handleFilterChange('empresa', option.value)}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        filtros.empresa === option.value ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    {option.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Resultado da Filtragem */}
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">{filteredUsers.length}</span> {filteredUsers.length === 1 ? t('acessos.utilizadorEncontrado') : t('acessos.utilizadoresEncontrados')}
                        {activeFiltersCount > 0 && <span> {t('acessos.comFiltros')}</span>}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('acessos.utilizador')}</TableHead>
                        <TableHead>{t('acessos.telefone')}</TableHead>
                        <TableHead>{t('acessos.perfis')}</TableHead>
                        <TableHead>{t('acessos.empresa')}</TableHead>
                        <TableHead>{t('acessos.status')}</TableHead>
                        <TableHead>{t('acessos.aeroportosAcesso')}</TableHead>
                        <TableHead className="text-right">{t('acessos.acoes')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array(5).fill(0).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                          </TableRow>
                        ))
                      ) : filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400 py-8">
                            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                            <p className="font-medium">{t('acessos.nenhumUtilizador')}</p>
                            <p className="text-sm mt-1">
                              {activeFiltersCount > 0
                                ? t('acessos.ajustarFiltros')
                                : t('acessos.semUtilizadores')}
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.telefone || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                                {user.perfis && Array.isArray(user.perfis) && user.perfis.length > 0 ? (
                                  user.perfis.map((perfil, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {PERFIL_LABELS[perfil] || perfil}
                                    </Badge>
                                  ))
                                ) : user.perfil ? (
                                  <Badge variant="outline" className="text-xs">
                                    {PERFIL_LABELS[user.perfil] || user.perfil}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    {PERFIL_LABELS['visualizador']}
                                  </Badge>
                                )}
                              </div>
                          </TableCell>
                          <TableCell>
                             {getEmpresaNome(user.empresa_id)}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              STATUS_CONFIG[user.status || 'desconhecido']?.className || STATUS_CONFIG['desconhecido'].className
                            }>
                              {STATUS_CONFIG[user.status || 'desconhecido']?.label || 'Desconhecido'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {user.aeroportos_acesso && Array.isArray(user.aeroportos_acesso) && user.aeroportos_acesso.length > 0
                                ? [...new Set(user.aeroportos_acesso)].map(icao => getAeroportoNome(icao)).filter(Boolean).join(', ')
                                : 'Nenhum'
                              }
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditUserModal(user)}
                                className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                {t('acessos.editar')}
                              </Button>
                              {/* Não permitir excluir o próprio utilizador */}
                              {user.id !== currentUser?.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenExcluirUserModal(user)}
                                  className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  {t('acessos.excluir')}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {isAprovarModalOpen && selectedSolicitacao && (
        <AprovarAcessoModal
          isOpen={isAprovarModalOpen}
          onClose={() => {
            setIsAprovarModalOpen(false);
            setSelectedSolicitacao(null);
          }}
          solicitacao={selectedSolicitacao}
          aeroportos={aeroportos}
          empresas={empresas}
          onSuccess={(dadosAprovacao) => handleAprovarSolicitacao(selectedSolicitacao.id, dadosAprovacao)}
        />
      )}

      {isEditUserModalOpen && (
        <EditUserModal
          isOpen={isEditUserModalOpen}
          onClose={() => { setIsEditUserModal(false); setSelectedUser(null); }}
          user={selectedUser}
          aeroportos={aeroportos}
          empresas={empresas}
          onSave={handleUpdateUser}
        />
      )}

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        aeroportos={aeroportos}
        empresas={empresas}
        onSuccess={() => {
          setAlertInfo({
            isOpen: true,
            type: 'success',
            title: 'Utilizador Criado',
            message: 'O utilizador foi criado com sucesso e receberá um email para definir a senha.'
          });
          loadData();
        }}
      />
      
      <AlertModal
        isOpen={rejectionInfo.isOpen}
        onClose={() => setRejectionInfo({ isOpen: false, solicitacao: null })}
        onConfirm={handleRejeitarSolicitacao}
        type="warning"
        title="Confirmar Rejeição"
        message={`Tem a certeza de que deseja rejeitar a solicitação de acesso de ${rejectionInfo.solicitacao?.nome_completo}? O utilizador será notificado.`}
        confirmText="Sim, Rejeitar"
        showCancel
      />

      <AlertModal
        isOpen={exclusionInfo.isOpen}
        onClose={() => setExclusionInfo({ isOpen: false, solicitacao: null })}
        onConfirm={() => {
          handleExcluirSolicitacao(exclusionInfo.solicitacao);
          setExclusionInfo({ isOpen: false, solicitacao: null });
        }}
        type="warning"
        title="Confirmar Exclusão"
        message={`Tem a certeza de que deseja excluir permanentemente a solicitação de acesso de ${exclusionInfo.solicitacao?.nome_completo}?`}
        confirmText="Sim, Excluir"
        showCancel
      />

      <AlertModal
        isOpen={userExclusionInfo.isOpen}
        onClose={() => setUserExclusionInfo({ isOpen: false, user: null })}
        onConfirm={handleExcluirUser}
        type="warning"
        title="Confirmar Exclusão de Utilizador"
        message={`Tem a certeza de que deseja excluir permanentemente o utilizador "${userExclusionInfo.user?.full_name}" (${userExclusionInfo.user?.email})? Esta ação não pode ser desfeita e o utilizador perderá todo o acesso ao sistema.`}
        confirmText="Sim, Excluir Utilizador"
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