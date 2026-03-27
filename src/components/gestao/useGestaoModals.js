import { useState, useCallback } from 'react';

/**
 * Custom hook to manage all modal state for GestaoAcessos page.
 * Consolidates 7+ modal-related useState hooks into a single hook.
 */
export function useGestaoModals() {
  const [isAprovarModalOpen, setIsAprovarModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [rejectionInfo, setRejectionInfo] = useState({ isOpen: false, solicitacao: null });
  const [exclusionInfo, setExclusionInfo] = useState({ isOpen: false, solicitacao: null });
  const [userExclusionInfo, setUserExclusionInfo] = useState({ isOpen: false, user: null });

  const openAprovarModal = useCallback((solicitacao) => {
    setSelectedSolicitacao(solicitacao);
    setIsAprovarModalOpen(true);
  }, []);

  const closeAprovarModal = useCallback(() => {
    setIsAprovarModalOpen(false);
    setSelectedSolicitacao(null);
  }, []);

  const openEditUserModal = useCallback((user) => {
    setSelectedUser(user);
    setIsEditUserModalOpen(true);
  }, []);

  const closeEditUserModal = useCallback(() => {
    setIsEditUserModalOpen(false);
    setSelectedUser(null);
  }, []);

  const openAddUserModal = useCallback(() => {
    setIsAddUserModalOpen(true);
  }, []);

  const closeAddUserModal = useCallback(() => {
    setIsAddUserModalOpen(false);
  }, []);

  const openRejeitarModal = useCallback((solicitacao) => {
    setRejectionInfo({ isOpen: true, solicitacao });
  }, []);

  const closeRejeitarModal = useCallback(() => {
    setRejectionInfo({ isOpen: false, solicitacao: null });
  }, []);

  const openExcluirModal = useCallback((solicitacao) => {
    if (!solicitacao || !solicitacao.id) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Solicitação inválida. Por favor, atualize a página.'
      });
      return;
    }
    setExclusionInfo({ isOpen: true, solicitacao });
  }, []);

  const closeExcluirModal = useCallback(() => {
    setExclusionInfo({ isOpen: false, solicitacao: null });
  }, []);

  const openExcluirUserModal = useCallback((user) => {
    if (!user || !user.id) {
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Utilizador inválido. Por favor, atualize a página.'
      });
      return;
    }
    setUserExclusionInfo({ isOpen: true, user });
  }, []);

  const closeExcluirUserModal = useCallback(() => {
    setUserExclusionInfo({ isOpen: false, user: null });
  }, []);

  const showAlert = useCallback((type, title, message) => {
    setAlertInfo({ isOpen: true, type, title, message });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertInfo(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    // Aprovar modal
    isAprovarModalOpen,
    selectedSolicitacao,
    openAprovarModal,
    closeAprovarModal,

    // Edit user modal
    isEditUserModalOpen,
    selectedUser,
    openEditUserModal,
    closeEditUserModal,

    // Add user modal
    isAddUserModalOpen,
    openAddUserModal,
    closeAddUserModal,

    // Rejection modal
    rejectionInfo,
    openRejeitarModal,
    closeRejeitarModal,

    // Exclusion modal (solicitacao)
    exclusionInfo,
    openExcluirModal,
    closeExcluirModal,

    // Exclusion modal (user)
    userExclusionInfo,
    openExcluirUserModal,
    closeExcluirUserModal,

    // Alert
    alertInfo,
    showAlert,
    closeAlert,
  };
}
