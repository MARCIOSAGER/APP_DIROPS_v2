import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, MailCheck, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useQueryClient } from '@tanstack/react-query';

import { SolicitacaoAcesso } from '@/entities/SolicitacaoAcesso';
import { User as UserEntity } from '@/entities/User';
import { Aeroporto } from '@/entities/Aeroporto';
import { Empresa } from '@/entities/Empresa';
import { downloadAsCSV } from '../components/lib/export';
import { hasUserProfile, isAdminProfile } from '@/components/lib/userUtils';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/components/lib/i18n';
import { supabase } from '@/lib/supabaseClient';
import { useGestaoAcessos } from '@/hooks/useGestaoAcessos';

import AprovarAcessoModal from '../components/gestao/AprovarAcessoModal';
import EditUserModal from '../components/gestao/EditUserModal';
import AddUserModal from '../components/gestao/AddUserModal';
import AlertModal from '../components/shared/AlertModal';
import AccessDenied from '../components/shared/AccessDenied';

import AcessosStatsCards from '../components/gestao/AcessosStatsCards';
import SolicitacoesTab from '../components/gestao/SolicitacoesTab';
import UtilizadoresTab from '../components/gestao/UtilizadoresTab';
import { useGestaoModals } from '../components/gestao/useGestaoModals';

const PERFIL_LABELS = {
  administrador: 'Administrador',
  operacoes: 'Operações',
  safety: 'Safety',
  infraestrutura: 'Infraestrutura',
  credenciamento: 'Credenciamento',
  gestor_empresa: 'Gestor de Empresa',
  visualizador: 'Visualizador'
};

const STATUS_CONFIG = {
  'pendente': { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pendente' },
  'aprovado': { className: 'bg-green-100 text-green-800 border-green-200', label: 'Aprovado' },
  'aguardando_convite': { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Aguardando Convite' },
  'rejeitado': { className: 'bg-red-100 text-red-800 border-red-200', label: 'Rejeitado' },
  'ativo': { className: 'bg-green-100 text-green-800 border-green-200', label: 'Ativo' },
  'inativo': { className: 'bg-red-100 text-red-800 border-red-200', label: 'Inativo' },
  'desconhecido': { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Desconhecido' }
};

export default function GestaoAcessos() {
  const { t } = useI18n();
  const { effectiveEmpresaId } = useCompanyView();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserLoading, setCurrentUserLoading] = useState(true);
  const [aeroportos, setAeroportos] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  const [sendingInvite, setSendingInvite] = useState(null);
  const [sendingBatch, setSendingBatch] = useState(false);

  const modals = useGestaoModals();

  // Fetch currentUser first
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await UserEntity.me();
        if (!cancelled) setCurrentUser(user);
      } catch (error) {
        console.error('Erro ao carregar utilizador:', error);
      } finally {
        if (!cancelled) setCurrentUserLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isAdmin = currentUser && isAdminProfile(currentUser);

  // Primary data via useQuery
  const {
    data: primaryData,
    isLoading: primaryLoading,
    refetch: refetchPrimary,
  } = useGestaoAcessos({
    empresaId: effectiveEmpresaId,
    currentUser,
    enabled: !!isAdmin,
  });

  const solicitacoes = primaryData?.solicitacoes ?? [];
  const users = primaryData?.users ?? [];
  const isLoading = currentUserLoading || primaryLoading;

  // Secondary data: Aeroportos + Empresas (leave as useEffect)
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const empId = effectiveEmpresaId || currentUser?.empresa_id;
        const [aeroportosData, empresasData] = await Promise.all([
          empId ? Aeroporto.filter({ empresa_id: empId }) : Aeroporto.list(),
          Empresa.list(),
        ]);
        setAeroportos((aeroportosData || []).filter(a => a.pais === 'AO'));
        setEmpresas(empresasData || []);
      } catch (error) {
        console.error('Erro ao carregar dados secundários:', error);
      }
    })();
  }, [isAdmin, effectiveEmpresaId, currentUser?.empresa_id]);

  const invalidateAndRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['gestaoAcessos'] });
  }, [queryClient]);

  const getAeroportoNome = useCallback((idOuIcao) => {
    if (!idOuIcao) return null;
    const aeroporto = aeroportos.find(a => a.id === idOuIcao || a.codigo_icao === idOuIcao);
    return aeroporto ? aeroporto.codigo_icao : idOuIcao;
  }, [aeroportos]);

  const getEmpresaNome = useCallback((empresaId) => {
    const empresa = empresas.find(e => e.id === empresaId);
    return empresa ? empresa.nome : 'N/A';
  }, [empresas]);

  const solicitacoesPendentes = useMemo(() => {
    return solicitacoes.filter(s => s.status === 'pendente');
  }, [solicitacoes]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'ativo').length;
    const inactiveUsers = users.filter(u => u.status === 'inativo').length;
    const pendingUsers = users.filter(u => u.status === 'pendente').length;

    const perfilDistribution = {};
    users.forEach(user => {
      if (user.perfis && Array.isArray(user.perfis)) {
        user.perfis.forEach(perfil => {
          perfilDistribution[perfil] = (perfilDistribution[perfil] || 0) + 1;
        });
      }
    });

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

    const empresaDistribution = {};
    users.forEach(user => {
      if (user.empresa_id) {
        const empresaNome = getEmpresaNome(user.empresa_id);
        if (empresaNome !== 'N/A') {
          empresaDistribution[empresaNome] = (empresaDistribution[empresaNome] || 0) + 1;
        }
      }
    });

    const solicitacoesPendentesCount = solicitacoes.filter(s => s.status === 'pendente').length;
    const solicitacoesAprovadas = solicitacoes.filter(s => s.status === 'aprovado').length;
    const solicitacoesRejeitadas = solicitacoes.filter(s => s.status === 'rejeitado').length;

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

  // --- Handlers ---

  const handleAprovarSolicitacao = async (solicitacaoId, dadosAprovacao) => {
    const { perfis, aeroportos: aeroportosAprovados, empresa_id, observacoes } = dadosAprovacao;

    const solicitacao = solicitacoes.find(s => s.id === solicitacaoId);
    if (!solicitacao) {
      modals.showAlert('error', 'Erro', 'Solicitação não encontrada.');
      return;
    }

    try {
      const existingUsersWithSameEmail = users.filter(u => u.email === solicitacao.email);
      const activeDuplicateUser = existingUsersWithSameEmail.find(u => u.status === 'ativo' && u.id !== solicitacao.user_id);

      if (activeDuplicateUser) {
        modals.closeAprovarModal();
        modals.showAlert(
          'error',
          'Solicitação Duplicada Detectada',
          `Um utilizador ativo (${activeDuplicateUser.full_name}, ID: ${activeDuplicateUser.id}) com o mesmo e-mail (${solicitacao.email}) já existe no sistema. Não é possível ativar/criar um novo utilizador com este e-mail. Por favor, reveja a situação ou contacte o suporte.`
        );
        return;
      }

      const userUpdateData = {
        full_name: solicitacao.nome_completo,
        perfis: perfis,
        aeroportos_acesso: aeroportosAprovados,
        telefone: solicitacao.telefone || null,
        status: 'ativo'
      };

      if (empresa_id) {
        userUpdateData.empresa_id = empresa_id;
      }

      await UserEntity.update(solicitacao.user_id, userUpdateData);

      await SolicitacaoAcesso.update(solicitacaoId, {
        status: 'aprovado',
        data_resposta: new Date().toISOString(),
        perfil_aprovado: perfis,
        aeroportos_aprovados: aeroportosAprovados,
        observacoes_aprovacao: observacoes
      });

      const nomeUtilizador = solicitacao.nome_completo || solicitacao.email.split('@')[0];
      const perfisFormatados = perfis.map(p => PERFIL_LABELS[p] || p).join(', ');
      const aeroportosNomes = aeroportosAprovados.length > 0
        ? aeroportosAprovados.map(icao => getAeroportoNome(icao)).join(', ')
        : 'Todos os aeroportos';

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

      modals.closeAprovarModal();
      modals.showAlert('success', 'Acesso Concedido', 'O utilizador foi aprovado e notificado por e-mail. As suas permissões estão ativas.');
      invalidateAndRefetch();
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      modals.showAlert('error', 'Erro ao Aprovar', `Ocorreu um erro: ${error.message}`);
    }
  };

  const handleRejeitarSolicitacao = async () => {
    const { solicitacao } = modals.rejectionInfo;
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

      modals.closeRejeitarModal();
      modals.showAlert('success', 'Solicitação Rejeitada', 'A solicitação foi rejeitada e o utilizador notificado por e-mail.');
      invalidateAndRefetch();
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      modals.showAlert('error', 'Erro ao Rejeitar', `Ocorreu um erro: ${error.message}`);
    }
  };

  const handleExcluirSolicitacao = async (solicitacao) => {
    if (!solicitacao || !solicitacao.id) {
      modals.showAlert('error', 'Erro', 'Dados da solicitação inválidos. Por favor, atualize a página.');
      return;
    }

    try {
      await SolicitacaoAcesso.delete(solicitacao.id);
      modals.showAlert('success', 'Solicitação Excluída', 'A solicitação foi excluída com sucesso.');
      invalidateAndRefetch();
    } catch (error) {
      console.error('Erro ao excluir solicitação:', error);
      if (error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('not found')) {
        modals.showAlert('warning', 'Solicitação Não Encontrada', 'A solicitação que tentou excluir já não existe. A lista será atualizada.');
        invalidateAndRefetch();
      } else {
        modals.showAlert('error', 'Erro ao Excluir', `Ocorreu um erro: ${error.message || 'Erro desconhecido'}`);
      }
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      await UserEntity.update(userId, data);
      modals.closeEditUserModal();
      invalidateAndRefetch();
      modals.showAlert('success', 'Sucesso', 'Utilizador atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar utilizador:', error);
      modals.showAlert('error', 'Erro', `Erro ao salvar utilizador: ${error.message}`);
    }
  };

  const handleExcluirUser = async () => {
    const { user } = modals.userExclusionInfo;
    if (!user || !user.id) {
      modals.closeExcluirUserModal();
      modals.showAlert('error', 'Erro', 'Dados do utilizador inválidos. Por favor, atualize a página e tente novamente.');
      return;
    }

    modals.closeExcluirUserModal();

    try {
      try {
        await UserEntity.get(user.id);
      } catch (checkError) {
        if (checkError.response?.status === 404 || checkError.message?.includes('404') || checkError.message?.includes('not found')) {
          modals.showAlert('warning', 'Utilizador Já Excluído', 'Este utilizador já foi excluído do sistema. A lista será atualizada.');
          invalidateAndRefetch();
          return;
        }
        console.warn('Erro ao verificar existência do utilizador antes da exclusão:', checkError);
      }

      await UserEntity.delete(user.id);
      modals.showAlert('success', 'Utilizador Excluído', 'O utilizador foi excluído com sucesso do sistema.');
      invalidateAndRefetch();
    } catch (error) {
      console.error('Erro ao excluir utilizador:', error);
      if (error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('not found')) {
        modals.showAlert('warning', 'Utilizador Não Encontrado', 'O utilizador que tentou excluir já não existe no sistema. A lista será atualizada.');
        invalidateAndRefetch();
      } else if (error.response?.status === 403) {
        modals.showAlert('error', 'Sem Permissão', 'Você não tem permissão para excluir este utilizador.');
      } else {
        modals.showAlert('error', 'Erro ao Excluir', `Ocorreu um erro ao excluir o utilizador: ${error.message || 'Erro desconhecido'}. Por favor, atualize a página e tente novamente.`);
      }
    }
  };

  const handleEnviarConvite = async (user) => {
    if (!user?.email) return;
    setSendingInvite(user.email);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/AlterarSenha`,
      });
      if (error) throw error;

      if (user.status === 'pendente') {
        await UserEntity.update(user.id, { status: 'ativo' });
      }

      modals.showAlert('success', 'Convite Enviado', `Email de definição de senha enviado para ${user.email}.`);
      invalidateAndRefetch();
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      modals.showAlert('error', 'Erro ao Enviar Convite', `Erro: ${error.message}`);
    } finally {
      setSendingInvite(null);
    }
  };

  const handleEnviarConvitesBatch = async (filteredUsers) => {
    const usersToInvite = filteredUsers.filter(
      u => u.email && u.created_by === 'importacao_base44'
    );
    if (usersToInvite.length === 0) {
      modals.showAlert('info', 'Sem Convites', 'Nenhum utilizador importado encontrado para enviar convite.');
      return;
    }

    const confirmMsg = `Enviar convite de definição de senha para ${usersToInvite.length} utilizadores?\n\nCada um receberá um email para criar a sua senha.`;
    if (!window.confirm(confirmMsg)) return;

    setSendingBatch(true);
    let sent = 0;
    let errors = 0;

    for (const user of usersToInvite) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${window.location.origin}/AlterarSenha`,
        });
        if (error) throw error;

        if (user.status === 'pendente') {
          await UserEntity.update(user.id, { status: 'ativo' });
        }
        sent++;
      } catch (err) {
        errors++;
        console.error(`Erro convite ${user.email}:`, err.message);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    setSendingBatch(false);
    modals.showAlert(
      errors === 0 ? 'success' : 'warning',
      'Convites Enviados',
      `${sent} convites enviados com sucesso. ${errors > 0 ? `${errors} erros.` : ''}`
    );
    invalidateAndRefetch();
  };

  const handleExportUsersCSV = useCallback((filteredUsers) => {
    const dataToExport = filteredUsers.map(user => {
      const perfisText = Array.isArray(user.perfis)
        ? user.perfis.map(p => PERFIL_LABELS[p] || p).join(', ')
        : PERFIL_LABELS[user.perfil] || user.perfil || 'N/A';

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
    modals.showAlert('success', 'Exportação Concluída', 'A lista de utilizadores foi exportada para CSV com sucesso.');
  }, [getAeroportoNome, getEmpresaNome, modals.showAlert]);

  // --- Early returns ---

  if (!isLoading && currentUser && !isAdminProfile(currentUser)) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <LoadingSpinner size="xl" label={t('acessos.carregando')} />
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

        <AcessosStatsCards stats={stats} />

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
            <SolicitacoesTab
              solicitacoesPendentes={solicitacoesPendentes}
              isLoading={isLoading}
              getEmpresaNome={getEmpresaNome}
              onAprovar={modals.openAprovarModal}
              onRejeitar={modals.openRejeitarModal}
              onExcluir={modals.openExcluirModal}
            />
          </TabsContent>

          <TabsContent value="utilizadores" className="space-y-4">
            <UtilizadoresTab
              users={users}
              aeroportos={aeroportos}
              empresas={empresas}
              currentUser={currentUser}
              isLoading={isLoading}
              sendingInvite={sendingInvite}
              sendingBatch={sendingBatch}
              getAeroportoNome={getAeroportoNome}
              getEmpresaNome={getEmpresaNome}
              onEditUser={modals.openEditUserModal}
              onExcluirUser={modals.openExcluirUserModal}
              onEnviarConvite={handleEnviarConvite}
              onEnviarConvitesBatch={handleEnviarConvitesBatch}
              onExportCSV={handleExportUsersCSV}
              onAddUser={modals.openAddUserModal}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      {modals.isAprovarModalOpen && modals.selectedSolicitacao && (
        <AprovarAcessoModal
          isOpen={modals.isAprovarModalOpen}
          onClose={modals.closeAprovarModal}
          solicitacao={modals.selectedSolicitacao}
          aeroportos={aeroportos}
          empresas={empresas}
          onSuccess={(dadosAprovacao) => handleAprovarSolicitacao(modals.selectedSolicitacao.id, dadosAprovacao)}
        />
      )}

      {modals.isEditUserModalOpen && (
        <EditUserModal
          isOpen={modals.isEditUserModalOpen}
          onClose={modals.closeEditUserModal}
          user={modals.selectedUser}
          aeroportos={aeroportos}
          empresas={empresas}
          onSave={handleUpdateUser}
        />
      )}

      <AddUserModal
        isOpen={modals.isAddUserModalOpen}
        onClose={modals.closeAddUserModal}
        aeroportos={aeroportos}
        empresas={empresas}
        onSuccess={() => {
          modals.showAlert('success', 'Utilizador Criado', 'O utilizador foi criado com sucesso e receberá um email para definir a senha.');
          invalidateAndRefetch();
        }}
      />

      <AlertModal
        isOpen={modals.rejectionInfo.isOpen}
        onClose={modals.closeRejeitarModal}
        onConfirm={handleRejeitarSolicitacao}
        type="warning"
        title="Confirmar Rejeição"
        message={`Tem a certeza de que deseja rejeitar a solicitação de acesso de ${modals.rejectionInfo.solicitacao?.nome_completo}? O utilizador será notificado.`}
        confirmText="Sim, Rejeitar"
        showCancel
      />

      <AlertModal
        isOpen={modals.exclusionInfo.isOpen}
        onClose={modals.closeExcluirModal}
        onConfirm={() => {
          handleExcluirSolicitacao(modals.exclusionInfo.solicitacao);
          modals.closeExcluirModal();
        }}
        type="warning"
        title="Confirmar Exclusão"
        message={`Tem a certeza de que deseja excluir permanentemente a solicitação de acesso de ${modals.exclusionInfo.solicitacao?.nome_completo}?`}
        confirmText="Sim, Excluir"
        showCancel
      />

      <AlertModal
        isOpen={modals.userExclusionInfo.isOpen}
        onClose={modals.closeExcluirUserModal}
        onConfirm={handleExcluirUser}
        type="warning"
        title="Confirmar Exclusão de Utilizador"
        message={`Tem a certeza de que deseja excluir permanentemente o utilizador "${modals.userExclusionInfo.user?.full_name}" (${modals.userExclusionInfo.user?.email})? Esta ação não pode ser desfeita e o utilizador perderá todo o acesso ao sistema.`}
        confirmText="Sim, Excluir Utilizador"
        showCancel
      />

      <AlertModal
        isOpen={modals.alertInfo.isOpen}
        onClose={modals.closeAlert}
        type={modals.alertInfo.type}
        title={modals.alertInfo.title}
        message={modals.alertInfo.message}
      />
    </div>
  );
}
