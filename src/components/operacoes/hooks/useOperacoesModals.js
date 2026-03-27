import { useState, useCallback } from 'react';

/**
 * Hook that manages all modal-related state and open/close handlers for Operacoes page.
 */
export function useOperacoesModals() {
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tipoMovimentoForm, setTipoMovimentoForm] = useState('ARR');
  const [editingVoo, setEditingVoo] = useState(null);
  const [vooArrToLink, setVooArrToLink] = useState(null);

  // Tariff details modal
  const [tariffDetailsData, setTariffDetailsData] = useState(null);

  // Gerar proforma modal
  const [gerarProformaCalculo, setGerarProformaCalculo] = useState(null);
  const [isGerarProformaModalOpen, setIsGerarProformaModalOpen] = useState(false);

  // Alterar cambio modal
  const [calculoParaAlterarCambio, setCalculoParaAlterarCambio] = useState(null);
  const [isAlterarCambioModalOpen, setIsAlterarCambioModalOpen] = useState(false);

  // Upload documento modal
  const [uploadDocumentoData, setUploadDocumentoData] = useState(null);
  const [isUploadDocumentoModalOpen, setIsUploadDocumentoModalOpen] = useState(false);

  // Lixeira modal
  const [isLixeiraModalOpen, setIsLixeiraModalOpen] = useState(false);

  // Documentos voo modal
  const [documentosVooModalData, setDocumentosVooModalData] = useState(null);
  const [isDocumentosVooModalOpen, setIsDocumentosVooModalOpen] = useState(false);

  // Recursos voo modal
  const [recursosVooModalData, setRecursosVooModalData] = useState(null);
  const [isRecursosVooModalOpen, setIsRecursosVooModalOpen] = useState(false);

  // Upload multiplos modal
  const [uploadMultiplosModalData, setUploadMultiplosModalData] = useState(null);
  const [isUploadMultiplosModalOpen, setIsUploadMultiplosModalOpen] = useState(false);

  // Alert / Success / CancelarProforma / Progress modals
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [cancelarProformaModal, setCancelarProformaModal] = useState({ isOpen: false, proforma: null, descricao: '', onConfirm: null });
  const [progressModal, setProgressModal] = useState({
    isOpen: false,
    title: '',
    currentStep: 0,
    totalSteps: 0,
    successCount: 0,
    errorCount: 0,
    currentItem: '',
    errors: []
  });

  // --- Handlers ---

  const handleOpenForm = useCallback((tipo, voo = null, vooArrToLinkParam = null) => {
    setTipoMovimentoForm(tipo);
    setEditingVoo(voo);
    setVooArrToLink(vooArrToLinkParam);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingVoo(null);
    setVooArrToLink(null);
  }, []);

  const handleAlterarCambio = useCallback((calculo) => {
    setCalculoParaAlterarCambio(calculo);
    setIsAlterarCambioModalOpen(true);
  }, []);

  const handleCloseAlterarCambio = useCallback(() => {
    setIsAlterarCambioModalOpen(false);
    setCalculoParaAlterarCambio(null);
  }, []);

  const handleUploadDocumento = useCallback((vooLigado, tipoDocumento) => {
    setUploadDocumentoData({ vooLigado, tipoDocumento });
    setIsUploadDocumentoModalOpen(true);
  }, []);

  const handleCloseUploadDocumento = useCallback(() => {
    setIsUploadDocumentoModalOpen(false);
    setUploadDocumentoData(null);
  }, []);

  const handleVerDocumentosVoo = useCallback((vooLigado) => {
    setDocumentosVooModalData(vooLigado);
    setIsDocumentosVooModalOpen(true);
  }, []);

  const handleCloseDocumentosVoo = useCallback(() => {
    setIsDocumentosVooModalOpen(false);
    setDocumentosVooModalData(null);
  }, []);

  const handleRecursosVoo = useCallback((vooLigado) => {
    setRecursosVooModalData(vooLigado);
    setIsRecursosVooModalOpen(true);
  }, []);

  const handleCloseRecursosVoo = useCallback(() => {
    setIsRecursosVooModalOpen(false);
    setRecursosVooModalData(null);
  }, []);

  const handleOpenUploadFromDocumentosModal = useCallback((vooLigado) => {
    setIsDocumentosVooModalOpen(false);
    setDocumentosVooModalData(null);
    setUploadMultiplosModalData(vooLigado);
    setIsUploadMultiplosModalOpen(true);
  }, []);

  const handleOpenUploadMultiplos = useCallback((vl) => {
    setUploadMultiplosModalData(vl);
    setIsUploadMultiplosModalOpen(true);
  }, []);

  const handleCloseUploadMultiplos = useCallback(() => {
    setIsUploadMultiplosModalOpen(false);
    setUploadMultiplosModalData(null);
  }, []);

  const handleUploadMultiplosSuccess = useCallback((/* uploadedFiles */) => {
    const currentVooLigado = uploadMultiplosModalData;
    setIsUploadMultiplosModalOpen(false);
    setUploadMultiplosModalData(null);
    setDocumentosVooModalData(currentVooLigado);
    setIsDocumentosVooModalOpen(true);
  }, [uploadMultiplosModalData]);

  const handleCloseGerarProforma = useCallback(() => {
    setIsGerarProformaModalOpen(false);
    setGerarProformaCalculo(null);
  }, []);

  const handleCloseAlert = useCallback(() => {
    setAlertInfo(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleCloseSuccess = useCallback(() => {
    setSuccessInfo({ isOpen: false, title: '', message: '' });
  }, []);

  const handleCloseCancelarProforma = useCallback(() => {
    setCancelarProformaModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    // Form state
    isFormOpen,
    tipoMovimentoForm,
    editingVoo,
    setEditingVoo,
    vooArrToLink,
    handleOpenForm,
    handleCloseForm,

    // Tariff details
    tariffDetailsData,
    setTariffDetailsData,

    // Gerar proforma
    gerarProformaCalculo,
    setGerarProformaCalculo,
    isGerarProformaModalOpen,
    setIsGerarProformaModalOpen,
    handleCloseGerarProforma,

    // Alterar cambio
    calculoParaAlterarCambio,
    isAlterarCambioModalOpen,
    handleAlterarCambio,
    handleCloseAlterarCambio,

    // Upload documento
    uploadDocumentoData,
    isUploadDocumentoModalOpen,
    handleUploadDocumento,
    handleCloseUploadDocumento,

    // Lixeira
    isLixeiraModalOpen,
    setIsLixeiraModalOpen,

    // Documentos voo
    documentosVooModalData,
    isDocumentosVooModalOpen,
    handleVerDocumentosVoo,
    handleCloseDocumentosVoo,

    // Recursos voo
    recursosVooModalData,
    isRecursosVooModalOpen,
    handleRecursosVoo,
    handleCloseRecursosVoo,

    // Upload multiplos
    uploadMultiplosModalData,
    isUploadMultiplosModalOpen,
    handleOpenUploadMultiplos,
    handleCloseUploadMultiplos,
    handleUploadMultiplosSuccess,
    handleOpenUploadFromDocumentosModal,

    // Alert / Success / CancelarProforma / Progress
    alertInfo,
    setAlertInfo,
    successInfo,
    setSuccessInfo,
    cancelarProformaModal,
    setCancelarProformaModal,
    progressModal,
    setProgressModal,
    handleCloseAlert,
    handleCloseSuccess,
    handleCloseCancelarProforma,
  };
}
