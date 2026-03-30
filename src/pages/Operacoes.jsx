import React, { useMemo, useCallback } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Unlink, Plane } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { supabase } from '@/lib/supabaseClient';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { isSuperAdmin } from '@/components/lib/userUtils';
import { calculateAllTariffs } from '../components/lib/tariffCalculations';
import { downloadAsExcel } from '../components/lib/export';
import { Proforma } from '@/entities/Proforma';
import { base44 } from '@/api/base44Client';
import { registarCriacao } from '../components/lib/auditoria';

import { useOperacoesData } from '../components/operacoes/hooks/useOperacoesData';
import { useOperacoesModals } from '../components/operacoes/hooks/useOperacoesModals';
import { useOperacoesFilters } from '../components/operacoes/hooks/useOperacoesFilters';

// Lazy-loaded modals and config panels
const AeroportosConfig = React.lazy(() => import('../components/operacoes/config/AeroportosConfig'));
const CompanhiasConfig = React.lazy(() => import('../components/operacoes/config/CompanhiasConfig'));
const ModelosAeronaveConfig = React.lazy(() => import('../components/operacoes/config/ModelosAeronaveConfig'));
const RegistosAeronaveConfig = React.lazy(() => import('../components/operacoes/config/RegistosAeronaveConfig'));
const TariffDetailsModal = React.lazy(() => import('../components/operacoes/TariffDetailsModal'));

import AlertModal from '../components/shared/AlertModal';
import SuccessModal from '../components/shared/SuccessModal';
const CancelarProformaModal = React.lazy(() => import('../components/shared/CancelarProformaModal'));
const ProgressModal = React.lazy(() => import('../components/operacoes/ProgressModal'));

const GerarFaturaModal = React.lazy(() => import('../components/faturacao/GerarFaturaModal'));
const AlterarCambioModal = React.lazy(() => import('../components/operacoes/AlterarCambioModal'));
const RecursosVooModal = React.lazy(() => import('../components/operacoes/RecursosVooModal'));
const UploadDocumentoVooModal = React.lazy(() => import('../components/operacoes/UploadDocumentoVooModal'));
const LixeiraVoosModal = React.lazy(() => import('../components/operacoes/LixeiraVoosModal'));
const DocumentosVooModal = React.lazy(() => import('../components/operacoes/DocumentosVooModal'));
const UploadMultiplosDocumentosModal = React.lazy(() => import('../components/operacoes/UploadMultiplosDocumentosModal'));
const FIDSPanel = React.lazy(() => import('../components/operacoes/FIDSPanel'));

import VoosTab from '../components/operacoes/VoosTab';
import VoosLigadosTab from '../components/operacoes/VoosLigadosTab';
import VoosSemLinkTab from '../components/operacoes/VoosSemLinkTab';
import FormVoo from '../components/operacoes/FormVoo';

const fmtAOA = new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' });
const formatCurrency = (value, currency = 'AOA') => {
  if (currency === 'AOA') return fmtAOA.format(value || 0);
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency }).format(value || 0);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getErrorMessage = (error) => {
  if (!error) return 'Erro';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error) return error.error;
  if (error.details) return error.details;
  try { return JSON.stringify(error); } catch { return String(error); }
};

export default function Operacoes() {
  const { t, language } = useI18n();

  // --- Data hook ---
  const data = useOperacoesData();
  const {
    user, effectiveEmpresaIdRef, empresaId, queryClient,
    isLoadingAll, loadData,
    configuracaoSistema, configuracao,
    voos, voosLigados, calculosTarifa, voosLigadosValidos,
    todosAeroportos, aeroportos, companhias, companhiasCache,
    aeronaves, modelosAeronave,
    tarifasPouso, tarifasPermanencia, outrasTarifas, impostos,
  } = data;

  // --- Modals hook ---
  const modals = useOperacoesModals();
  const {
    isFormOpen, tipoMovimentoForm, editingVoo, setEditingVoo, vooArrToLink,
    handleOpenForm, handleCloseForm,
    tariffDetailsData, setTariffDetailsData,
    gerarProformaCalculo, setGerarProformaCalculo,
    isGerarProformaModalOpen, setIsGerarProformaModalOpen,
    handleCloseGerarProforma,
    calculoParaAlterarCambio, isAlterarCambioModalOpen,
    handleAlterarCambio, handleCloseAlterarCambio,
    uploadDocumentoData, isUploadDocumentoModalOpen,
    handleUploadDocumento, handleCloseUploadDocumento,
    isLixeiraModalOpen, setIsLixeiraModalOpen,
    documentosVooModalData, isDocumentosVooModalOpen,
    handleVerDocumentosVoo, handleCloseDocumentosVoo,
    recursosVooModalData, isRecursosVooModalOpen,
    handleRecursosVoo, handleCloseRecursosVoo,
    uploadMultiplosModalData, isUploadMultiplosModalOpen,
    handleOpenUploadMultiplos, handleCloseUploadMultiplos,
    handleUploadMultiplosSuccess, handleOpenUploadFromDocumentosModal,
    alertInfo, setAlertInfo,
    successInfo, setSuccessInfo,
    cancelarProformaModal, setCancelarProformaModal,
    progressModal, setProgressModal,
    handleCloseAlert, handleCloseSuccess, handleCloseCancelarProforma,
  } = modals;

  // --- Filters hook ---
  const filters = useOperacoesFilters({
    voos, voosLigados, voosLigadosValidos, calculosTarifa,
    companhias, aeroportos, todosAeroportos,
    user, effectiveEmpresaIdRef, empresaId, queryClient,
    setAlertInfo, t,
  });
  const {
    filtros, isFiltering, handleFilterChange, handleBuscarVoos, clearFilters,
    filtrosLigados, isFilteringLigados, handleFilterChangeLigados, handleBuscarLigados, clearFiltersLigados,
    voosSemLink, voosSemLinkComputed, isLoadingSemLink, isLinkingAuto, setIsLinkingAuto,
    filtrosSemLink, semLinkLoaded, loadVoosSemLink, semLinkStats, getSugestoesPar, handleFilterChangeSemLink,
    sortField, sortDirection, handleSort,
    sortFieldLigados, sortDirectionLigados, handleSortLigados,
    voosFiltrados, voosLigadosFiltrados,
  } = filters;

  // ========================
  // BUSINESS LOGIC HANDLERS
  // ========================

  const _recalculateSingleTariff = useCallback(async (vooLigado) => {
    const { data: _d, error } = await supabase.rpc('calculate_tariff', { p_voo_ligado_id: vooLigado.id });
    if (error) throw new Error(error.message);
    return true;
  }, []);

  const calculateParkingForSwappedAircraft = (registoDep, aeroportoOperacao, depDateTime, voosArr, voosLigadosArr) => {
    try {
      const normalizeReg = (r) => r ? r.trim().toUpperCase().replace(/[\s\-_.]/g, '') : '';
      const registoNorm = normalizeReg(registoDep);
      const arrsMatch = voosArr
        .filter(v => v.tipo_movimento === 'ARR' && v.aeroporto_operacao === aeroportoOperacao && normalizeReg(v.registo_aeronave) === registoNorm)
        .map(v => ({ ...v, dateTime: new Date(`${v.data_operacao}T${v.horario_real || v.horario_previsto}`) }))
        .filter(v => v.dateTime < depDateTime)
        .sort((a, b) => b.dateTime - a.dateTime);

      for (const arrVoo of arrsMatch) {
        const linkedAsDep = voosLigadosArr.find(vl => vl.id_voo_arr === arrVoo.id);
        if (!linkedAsDep) {
          const minutes = Math.round((depDateTime.getTime() - arrVoo.dateTime.getTime()) / (1000 * 60));
          return { minutes, source: 'auto' };
        }
      }
      return { minutes: null, source: 'manual' };
    } catch (err) {
      console.error('Erro ao calcular estacionamento:', err);
      return { minutes: null, source: 'manual' };
    }
  };

  const handleSaveVoo = async ({ vooData, linkedArrVooId }) => {
    let tariffsCalculatedSuccessfully = false;

    try {
      let savedVoo;
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      const vooDataWithMeta = {
        ...vooData,
        updated_by: user?.email || 'sistema',
        ...(empId && !editingVoo ? { empresa_id: empId } : {})
      };

      if (editingVoo) {
        await Voo.update(editingVoo.id, vooDataWithMeta);
        savedVoo = { ...editingVoo, ...vooDataWithMeta, id: editingVoo.id };
      } else {
        savedVoo = await Voo.create(vooDataWithMeta);
      }

      if (savedVoo.tipo_movimento === 'DEP' && linkedArrVooId) {
        const [freshSavedVoo, freshLinkedVoo] = await Promise.all([
          Voo.filter({ id: { $eq: savedVoo.id } }).then(r => r[0]),
          Voo.filter({ id: { $eq: linkedArrVooId } }).then(r => r[0])
        ]);

        const voosAtualizadosBanco = voos.map(v => {
          if (v.id === savedVoo.id) return freshSavedVoo || { ...v, ...vooData };
          if (v.id === linkedArrVooId) return freshLinkedVoo || v;
          return v;
        });
        if (!voos.find(v => v.id === savedVoo.id) && freshSavedVoo) {
          voosAtualizadosBanco.push(freshSavedVoo);
        }

        const vooArr = voosAtualizadosBanco.find(v => v.id === linkedArrVooId);
        const vooDep = voosAtualizadosBanco.find(v => v.id === savedVoo.id);

        if (vooArr && vooDep) {
          const arrDateTime = new Date(`${vooArr.data_operacao}T${vooArr.horario_real || vooArr.horario_previsto}`);
          const depDateTime = new Date(`${vooDep.data_operacao}T${vooDep.horario_real || vooDep.horario_previsto}`);
          const tempoPermanenciaMin = Math.round((depDateTime.getTime() - arrDateTime.getTime()) / (1000 * 60));

          const existingLink = voosLigados.find(vl => vl.id_voo_arr === linkedArrVooId && vl.id_voo_dep === savedVoo.id);

          const vooLigadoData = {
            id_voo_arr: linkedArrVooId,
            id_voo_dep: savedVoo.id,
            tempo_permanencia_min: tempoPermanenciaMin,
            registo_alterado: vooData.registo_alterado || false,
            registo_dep: vooData.registo_alterado ? vooData.registo_dep : null,
            ...(empId ? { empresa_id: empId } : {})
          };

          if (vooData.registo_alterado && vooData.registo_dep) {
            const parkingResult = calculateParkingForSwappedAircraft(
              vooData.registo_dep, vooArr.aeroporto_operacao, depDateTime, voosAtualizadosBanco, voosLigados
            );
            vooLigadoData.tempo_estacionamento_min = parkingResult.minutes;
            vooLigadoData.estacionamento_origem = parkingResult.source;
          }

          let vooLigadoInstance;
          if (existingLink) {
            await VooLigado.update(existingLink.id, vooLigadoData);
            vooLigadoInstance = { ...existingLink, ...vooLigadoData };
          } else {
            vooLigadoInstance = await VooLigado.create(vooLigadoData);
          }

          try {
            const vooLigadoUpdates = [];
            if (vooArr.voo_ligado_id !== vooLigadoInstance.id) vooLigadoUpdates.push(Voo.update(linkedArrVooId, { voo_ligado_id: vooLigadoInstance.id }));
            if (vooDep.voo_ligado_id !== vooLigadoInstance.id) vooLigadoUpdates.push(Voo.update(savedVoo.id, { voo_ligado_id: vooLigadoInstance.id }));
            if (vooLigadoUpdates.length > 0) await Promise.all(vooLigadoUpdates);
          } catch (updateError) {
            console.warn('Erro ao atualizar voo_ligado_id (nao critico):', updateError);
          }

          try {
            const aeroportoOperacao = todosAeroportos.find(a => a.codigo_icao === vooArr.aeroporto_operacao);
            if (!aeroportoOperacao) throw new Error(`Aeroporto "${vooArr.aeroporto_operacao}" nao encontrado.`);

            const aeronaveDoVoo = aeronaves.find(a => a.registo === vooDep.registo_aeronave);
            if (!aeronaveDoVoo) throw new Error(`Aeronave "${vooDep.registo_aeronave}" nao encontrada.`);
            if (!aeronaveDoVoo.mtow_kg) throw new Error(`Aeronave "${aeronaveDoVoo.registo}" sem MTOW.`);

            const currentConfiguracao = {
              aeroportos: todosAeroportos, aeronaves, tarifasPouso, tarifasPermanencia, outrasTarifas,
              taxaCambio: configuracaoSistema?.taxa_cambio_usd_aoa || 850
            };

            const calculatedTariffs = await calculateAllTariffs(vooLigadoInstance, vooArr, vooDep, aeroportoOperacao, currentConfiguracao, impostos);
            if (!calculatedTariffs) throw new Error('calculateAllTariffs retornou null');

            const calculoComVooLigado = {
              ...calculatedTariffs,
              voo_ligado_id: vooLigadoInstance.id,
              empresa_id: vooLigadoInstance.empresa_id || vooDep.empresa_id
            };

            try {
              await _recalculateSingleTariff(vooLigadoInstance);
            } catch (rpcErr) {
              const existingCalcArr = await CalculoTarifa.filter({ voo_ligado_id: { $eq: vooLigadoInstance.id } });
              if (existingCalcArr.length > 0) {
                await CalculoTarifa.update(existingCalcArr[0].id, calculoComVooLigado);
              } else {
                await CalculoTarifa.create(calculoComVooLigado);
              }
            }

            tariffsCalculatedSuccessfully = true;
          } catch (calcError) {
            console.error('Erro no calculo automatico:', calcError);
            setAlertInfo({
              isOpen: true, type: 'error',
              title: t('operacoes.erro_calculo_automatico'),
              message: getErrorMessage(calcError),
              showCancel: false, confirmText: t('operacoes.entendi')
            });
          }
        }
      }

      // Recalculate when editing a linked ARR voo
      if (editingVoo && savedVoo.tipo_movimento === 'ARR') {
        const vooLigadoExistente = voosLigados.find(vl => vl.id_voo_arr === savedVoo.id);
        if (vooLigadoExistente) {
          try {
            const vooArrAtualizado = { ...savedVoo, ...vooData };
            const vooDepAtualizado = voos.find(v => v.id === vooLigadoExistente.id_voo_dep);
            const aeroportoOp = todosAeroportos.find(a => a.codigo_icao === vooArrAtualizado?.aeroporto_operacao);

            if (vooArrAtualizado && vooDepAtualizado && aeroportoOp) {
              const currentConfiguracao = {
                aeroportos: todosAeroportos, aeronaves, tarifasPouso, tarifasPermanencia, outrasTarifas,
                taxaCambio: configuracaoSistema?.taxa_cambio_usd_aoa || 850
              };
              const calculatedTariffs = await calculateAllTariffs(vooLigadoExistente, vooArrAtualizado, vooDepAtualizado, aeroportoOp, currentConfiguracao, impostos);

              if (calculatedTariffs) {
                const calculoComVooLigado = {
                  ...calculatedTariffs,
                  voo_ligado_id: vooLigadoExistente.id,
                  empresa_id: vooLigadoExistente.empresa_id || vooDepAtualizado.empresa_id
                };
                const existingCalculo = calculosTarifa.find(ct => ct.voo_ligado_id === vooLigadoExistente.id || ct.voo_id === vooDepAtualizado.id);
                if (existingCalculo) {
                  await CalculoTarifa.update(existingCalculo.id, calculoComVooLigado);
                } else {
                  await CalculoTarifa.create(calculoComVooLigado);
                }
                tariffsCalculatedSuccessfully = true;
              } else {
                throw new Error('calculateAllTariffs retornou null');
              }
            } else {
              throw new Error('Dados incompletos para recalculo');
            }
          } catch (recalcError) {
            console.error('Erro ao recalcular apos editar ARR:', recalcError);
            setAlertInfo({ isOpen: true, type: 'warning', title: t('operacoes.aviso'), message: getErrorMessage(recalcError) });
          }
        }
      }

      handleCloseForm();

      queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });

      setSuccessInfo({
        isOpen: true,
        title: editingVoo ? t('operacoes.voo_atualizado') : t('operacoes.voo_criado'),
        message: `${vooData.numero_voo}${tariffsCalculatedSuccessfully ? t(editingVoo ? 'operacoes.e_tarifas_recalculadas' : 'operacoes.e_tarifas_calculadas') : ''}.`
      });
    } catch (error) {
      console.error('Erro ao salvar voo:', error);
      setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro_salvar_voo'), message: getErrorMessage(error) || t('operacoes.erro_salvar_voo_msg') });
    }
  };

  const handleCancelarVoo = async (voo) => {
    setAlertInfo({
      isOpen: true, type: 'warning', title: t('operacoes.cancelar_voo'),
      message: `${t('operacoes.cancelar_voo')} ${voo.numero_voo}?`,
      showCancel: true, confirmText: t('operacoes.cancelar_voo'),
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          await Voo.update(voo.id, { ...voo, status: 'Cancelado', updated_by: user?.email || 'sistema' });
          queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
          setSuccessInfo({ isOpen: true, title: t('operacoes.voo_cancelado'), message: `${voo.numero_voo}` });
        } catch (error) {
          setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro_cancelar'), message: t('operacoes.erro_cancelar_msg') });
        }
      }
    });
  };

  const handleExcluirVoo = async (voo) => {
    const doMoverLixeira = async (motivo) => {
      try {
        try {
          const proformasVoo = await Proforma.filter({ voo_id: voo.id });
          for (const pf of proformasVoo) {
            if (pf.status !== 'cancelada' && pf.status !== 'paga') {
              await Proforma.update(pf.id, {
                status: 'cancelada',
                motivo_cancelamento: `Voo ${voo.numero_voo} movido para lixeira. Motivo: ${motivo}`,
                cancelado_por: user?.email || 'sistema',
                data_cancelamento: new Date().toISOString()
              });
            }
          }
        } catch (err) { console.warn('Operacao secundaria falhou:', err.message); }

        try {
          const vooLigadoAssociado = voosLigados.find(vl => vl.id_voo_arr === voo.id || vl.id_voo_dep === voo.id);
          if (vooLigadoAssociado) {
            const outroVooId = vooLigadoAssociado.id_voo_arr === voo.id ? vooLigadoAssociado.id_voo_dep : vooLigadoAssociado.id_voo_arr;
            if (outroVooId) await Voo.update(outroVooId, { voo_ligado_id: null });
            await Voo.update(voo.id, { voo_ligado_id: null });
            await VooLigado.delete(vooLigadoAssociado.id);
          }
        } catch (err) { console.warn('Operacao secundaria falhou:', err.message); }

        await Voo.update(voo.id, { deleted_at: new Date().toISOString(), deleted_by: user?.email || 'sistema' });
        queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
        setSuccessInfo({ isOpen: true, title: t('operacoes.voo_lixeira'), message: `${voo.numero_voo}` });
      } catch (error) {
        setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro_mover'), message: t('operacoes.erro_mover_msg') });
      }
    };

    let proformasAtivas = [];
    try {
      const pfs = await Proforma.filter({ voo_id: voo.id });
      proformasAtivas = pfs.filter(pf => pf.status !== 'cancelada' && pf.status !== 'paga');
    } catch (err) { console.warn('Operacao secundaria falhou:', err.message); }

    if (proformasAtivas.length > 0) {
      setCancelarProformaModal({
        isOpen: true, proforma: proformasAtivas[0], descricao: t('proforma.descricao_cancel_voo'),
        onConfirm: async (motivo) => { setCancelarProformaModal(prev => ({ ...prev, isOpen: false })); await doMoverLixeira(motivo); }
      });
    } else {
      setAlertInfo({
        isOpen: true, type: 'error', title: t('operacoes.mover_lixeira'),
        message: `${voo.numero_voo}?`, showCancel: true, confirmText: t('operacoes.mover'),
        onConfirm: async () => { setAlertInfo(prev => ({ ...prev, isOpen: false })); await doMoverLixeira('Movido para lixeira pelo utilizador.'); }
      });
    }
  };

  const handleExcluirPermanentemente = async (voo) => {
    if (!isSuperAdmin(user)) {
      setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.acesso_negado_titulo'), message: t('operacoes.acesso_negado_excluir') });
      return;
    }
    setAlertInfo({
      isOpen: true, type: 'error', title: t('operacoes.excluir_permanentemente'),
      message: `${voo.numero_voo}? ${t('operacoes.excluir_permanentemente')}`,
      showCancel: true, confirmText: t('operacoes.excluir_permanentemente'),
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        try {
          await Voo.delete(voo.id);
          queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
          setSuccessInfo({ isOpen: true, title: t('operacoes.voo_excluido'), message: `${voo.numero_voo}` });
        } catch (error) {
          setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro_excluir'), message: t('operacoes.erro_excluir_msg') });
        }
      }
    });
  };

  const handleExcluirVooLigado = async (vooLigado) => {
    const depVoo = voos.find(v => v.id === vooLigado.id_voo_dep);
    const arrVoo = voos.find(v => v.id === vooLigado.id_voo_arr);

    const doDelete = async (motivo) => {
      try {
        const calculoAssociado = calculosTarifa.find(ct => ct.voo_id === vooLigado.id_voo_dep || ct.voo_ligado_id === vooLigado.id);
        if (calculoAssociado) {
          const proformasAssociadas = await Proforma.filter({ calculo_tarifa_id: calculoAssociado.id });
          for (const pf of proformasAssociadas) {
            if (pf.status !== 'cancelada' && pf.status !== 'paga') {
              await Proforma.update(pf.id, {
                status: 'cancelada',
                motivo_cancelamento: `Vinculacao excluida: ${arrVoo?.numero_voo || 'N/A'} (ARR) -> ${depVoo?.numero_voo || 'N/A'} (DEP). Motivo: ${motivo}`,
                cancelado_por: user?.email || 'sistema',
                data_cancelamento: new Date().toISOString()
              });
            }
          }
          await CalculoTarifa.delete(calculoAssociado.id);
        }
        if (arrVoo && arrVoo.voo_ligado_id === vooLigado.id) await Voo.update(arrVoo.id, { voo_ligado_id: null });
        if (depVoo && depVoo.voo_ligado_id === vooLigado.id) await Voo.update(depVoo.id, { voo_ligado_id: null });
        await VooLigado.delete(vooLigado.id);

        queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
        setSuccessInfo({ isOpen: true, title: t('operacoes.vinculacao_excluida'), message: t('operacoes.vinculacao_excluida_msg') });
      } catch (error) {
        setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro_excluir'), message: t('operacoes.erro_excluir_vinculacao') });
      }
    };

    const calculoAssociado = calculosTarifa.find(ct => ct.voo_id === vooLigado.id_voo_dep || ct.voo_ligado_id === vooLigado.id);
    let proformasAtivas = [];
    if (calculoAssociado) {
      try {
        const pfs = await Proforma.filter({ calculo_tarifa_id: calculoAssociado.id });
        proformasAtivas = pfs.filter(pf => pf.status !== 'cancelada' && pf.status !== 'paga');
      } catch (err) { console.warn('Operacao secundaria falhou:', err.message); }
    }

    if (proformasAtivas.length > 0) {
      setCancelarProformaModal({
        isOpen: true, proforma: proformasAtivas[0], descricao: t('proforma.descricao_cancel_voo_ligado'),
        onConfirm: async (motivo) => { setCancelarProformaModal(prev => ({ ...prev, isOpen: false })); await doDelete(motivo); }
      });
    } else {
      setAlertInfo({
        isOpen: true, type: 'error', title: t('operacoes.excluir_vinculacao'),
        message: `${arrVoo?.numero_voo || 'N/A'} (ARR) / ${depVoo?.numero_voo || 'N/A'} (DEP)`,
        showCancel: true, confirmText: t('operacoes.excluir_vinculacao'),
        onConfirm: async () => { setAlertInfo(prev => ({ ...prev, isOpen: false })); await doDelete('Vinculacao excluida pelo utilizador.'); }
      });
    }
  };

  const handleRecalcularTarifaSingle = async (vooLigado) => {
    try {
      await _recalculateSingleTariff(vooLigado);
      const updatedCalculo = await CalculoTarifa.filter({ voo_ligado_id: { $eq: vooLigado.id } });
      if (updatedCalculo.length > 0) {
        queryClient.setQueryData(['calculos-tarifa', empresaId], prev => {
          const withoutOld = (prev || []).filter(ct => ct.voo_ligado_id !== vooLigado.id);
          return [...withoutOld, ...updatedCalculo];
        });
      }
      setSuccessInfo({ isOpen: true, title: t('operacoes.tarifa_recalculada'), message: t('operacoes.tarifa_recalculada_msg') });
    } catch (error) {
      setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro_recalcular'), message: error.message || t('operacoes.erro_recalcular_msg') });
    }
  };

  const handleDeleteVooSemLink = async (voo) => {
    if (!confirm(`Eliminar voo ${voo.numero_voo} ${voo.tipo_movimento} ${voo.data_operacao}?`)) return;
    await Voo.update(voo.id, { deleted_at: new Date().toISOString() });
    if (semLinkLoaded) loadVoosSemLink(); else queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
  };

  const handleLinkarAutomatico = useCallback(async () => {
    const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
    if (!empId) return;
    setIsLinkingAuto(true);
    try {
      const { data, error } = await supabase.rpc('link_and_calculate_pending', { p_empresa_id: empId });
      if (error) throw error;
      const linked = data?.linked ?? data?.[0]?.linked ?? 0;
      const calculated = data?.calculated ?? data?.[0]?.calculated ?? 0;
      setSuccessInfo({ isOpen: true, title: 'Link Automatico Concluido', message: `Linkados: ${linked}, Tarifas calculadas: ${calculated}` });
      queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
      await loadVoosSemLink();
    } catch (error) {
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro no Link Automatico', message: error.message || 'Erro ao executar link automatico' });
    } finally {
      setIsLinkingAuto(false);
    }
  }, [user, loadVoosSemLink, effectiveEmpresaIdRef, empresaId, queryClient, setAlertInfo, setSuccessInfo, setIsLinkingAuto]);

  const handleLinkarManual = useCallback(async (arrVoo, depVoo) => {
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      const arrDateTime = new Date(`${arrVoo.data_operacao}T${arrVoo.horario_real || arrVoo.horario_previsto || '00:00'}`);
      const depDateTime = new Date(`${depVoo.data_operacao}T${depVoo.horario_real || depVoo.horario_previsto || '00:00'}`);
      const tempoPermanenciaMin = Math.round((depDateTime.getTime() - arrDateTime.getTime()) / (1000 * 60));

      const vooLigadoData = { id_voo_arr: arrVoo.id, id_voo_dep: depVoo.id, tempo_permanencia_min: tempoPermanenciaMin, ...(empId ? { empresa_id: empId } : {}) };
      const newVooLigado = await VooLigado.create(vooLigadoData);
      await Promise.all([Voo.update(arrVoo.id, { voo_ligado_id: newVooLigado.id }), Voo.update(depVoo.id, { voo_ligado_id: newVooLigado.id })]);

      const { error: calcError } = await supabase.rpc('calculate_tariff', { p_voo_ligado_id: newVooLigado.id });
      if (calcError) console.warn('Aviso: Erro ao calcular tarifa:', calcError.message);

      setSuccessInfo({ isOpen: true, title: 'Voos Linkados', message: `${arrVoo.numero_voo} (ARR) linkado com ${depVoo.numero_voo} (DEP)` });
      queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
      await loadVoosSemLink();
    } catch (error) {
      setAlertInfo({ isOpen: true, type: 'error', title: 'Erro ao Linkar', message: error.message || 'Erro ao linkar voos' });
    }
  }, [user, loadVoosSemLink, effectiveEmpresaIdRef, empresaId, queryClient, setAlertInfo, setSuccessInfo]);

  const handleRecalcularTarifasLote = async (selectedVooLigadoIds = null) => {
    let targets = [];
    if (selectedVooLigadoIds && Array.isArray(selectedVooLigadoIds)) {
      targets = voosLigadosValidos.filter(vl => selectedVooLigadoIds.includes(vl.id));
    } else {
      targets = voosLigadosFiltrados;
    }

    if (targets.length === 0) {
      setAlertInfo({ isOpen: true, type: 'info', title: t('operacoes.nenhum_voo'), message: t('operacoes.nenhum_voo_recalcular') });
      return;
    }

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    const timeEstimate = Math.ceil((targets.length * 2) / 60);
    const confirmMessage = targets.length > BATCH_SIZE
      ? `Recalcular ${targets.length} voo(s) em ${totalBatches} lote(s)? Tempo: ~${timeEstimate} min.`
      : `Recalcular ${targets.length} voo(s)? Tempo: ~${timeEstimate} min.`;

    setAlertInfo({
      isOpen: true, type: 'warning', title: t('operacoes.recalcular_tarifas'),
      message: confirmMessage, showCancel: true, confirmText: t('operacoes.recalcular'),
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, targets.length);
          const batch = targets.slice(start, end);
          const batchTitle = totalBatches > 1
            ? `${t('operacoes.recalculando_tarifas')} - ${batchIndex + 1}/${totalBatches}`
            : t('operacoes.recalculando_tarifas');

          setProgressModal({ isOpen: true, title: batchTitle, currentStep: start, totalSteps: targets.length, successCount, errorCount, currentItem: '', errors });

          for (let i = 0; i < batch.length; i++) {
            const globalIndex = start + i;
            const vl = batch[i];
            const depVoo = voos.find(v => v.id === vl.id_voo_dep);
            const arrVoo = voos.find(v => v.id === vl.id_voo_arr);
            const depVooNum = depVoo?.numero_voo || 'N/A';

            setProgressModal(prev => ({ ...prev, currentStep: globalIndex, currentItem: `${t('home.voo')} ${depVooNum} (${globalIndex + 1}/${targets.length})`, successCount, errorCount }));

            try {
              await _recalculateSingleTariff(vl);
              try {
                const batchUpdates = [];
                if (arrVoo && arrVoo.voo_ligado_id !== vl.id) batchUpdates.push(Voo.update(arrVoo.id, { voo_ligado_id: vl.id }));
                if (depVoo && depVoo.voo_ligado_id !== vl.id) batchUpdates.push(Voo.update(depVoo.id, { voo_ligado_id: vl.id }));
                if (batchUpdates.length > 0) await Promise.all(batchUpdates);
              } catch (updateError) { console.warn('Erro ao atualizar voo_ligado_id:', updateError); }
              successCount++;
              if ((globalIndex + 1) % 10 === 0) await sleep(300);
            } catch (error) {
              errorCount++;
              const errorMsg = `Voo ${depVooNum}: ${error.message}`;
              errors.push(errorMsg);
              setProgressModal(prev => ({ ...prev, errorCount, errors: [...prev.errors, errorMsg] }));
              if (error.message?.includes('Rate limit') || error.response?.status === 429) await sleep(3000);
            }
          }

          if (batchIndex < totalBatches - 1) {
            setProgressModal(prev => ({ ...prev, currentItem: `Preparando proximo lote... (${successCount}/${targets.length})` }));
            await sleep(2000);
          }
        }

        setProgressModal(prev => ({ ...prev, currentStep: targets.length, currentItem: t('operacoes.finalizando'), successCount, errorCount }));
        queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
        queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });

        setTimeout(() => {
          setProgressModal(prev => ({ ...prev, isOpen: false }));
          if (errorCount === 0) {
            setSuccessInfo({ isOpen: true, title: t('operacoes.recalculo_concluido'), message: `${successCount} / ${totalBatches}` });
          } else {
            setAlertInfo({ isOpen: true, type: 'warning', title: t('operacoes.recalculo_parcial'), message: `${successCount} OK, ${errorCount} ${t('operacoes.erro')}` });
          }
        }, 2000);
      }
    });
  };

  const handleConfirmarAlterarCambio = async (calculo, novaTaxaCambio) => {
    try {
      const novoCalculoData = {
        ...calculo,
        taxa_cambio_usd_aoa: novaTaxaCambio,
        tarifa_pouso: calculo.tarifa_pouso_usd * novaTaxaCambio,
        tarifa_permanencia: calculo.tarifa_permanencia_usd * novaTaxaCambio,
        tarifa_passageiros: calculo.tarifa_passageiros_usd * novaTaxaCambio,
        tarifa_carga: calculo.tarifa_carga_usd * novaTaxaCambio,
        outras_tarifas: calculo.outras_tarifas_usd * novaTaxaCambio,
        total_tarifa: calculo.total_tarifa_usd * novaTaxaCambio,
        data_calculo: new Date().toISOString()
      };
      await CalculoTarifa.update(calculo.id, novoCalculoData);
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
      setSuccessInfo({ isOpen: true, title: t('operacoes.cambio_atualizado'), message: `${novaTaxaCambio} AOA/USD` });
    } catch (error) {
      setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro'), message: t('operacoes.erro_alterar') });
    }
  };

  const handleShowTariffDetails = async (calculo) => {
    if (!calculo.detalhes_calculo && calculo.voo_ligado_id) {
      try {
        const full = await CalculoTarifa.filter({ voo_ligado_id: { $eq: calculo.voo_ligado_id } });
        if (full.length > 0) { setTariffDetailsData(full[0]); return; }
      } catch (e) { console.error('Error fetching full calculo:', e); }
    }
    setTariffDetailsData(calculo);
  };

  const handleExportTariffPDF = async (calculo) => {
    try {
      setAlertInfo({ isOpen: true, type: 'info', title: t('operacoes.gerando_pdf'), message: t('operacoes.aguarde_pdf') });
      const { exportTariffDetailsPdf } = await import('@/functions/exportTariffDetailsPdf');
      const response = await exportTariffDetailsPdf({ calculoId: calculo.id });
      if (response.data) {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const voo = voos.find(v => v.id === calculo.voo_id);
        a.download = `calculo_tarifa_${voo?.numero_voo || 'voo'}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        setAlertInfo({ isOpen: false });
        setSuccessInfo({ isOpen: true, title: t('operacoes.pdf_exportado'), message: t('operacoes.pdf_exportado_msg') });
      }
    } catch (error) {
      setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro_exportar'), message: error.message || t('operacoes.erro_exportar_msg') });
    }
  };

  const handleGerarProforma = async (calculo) => {
    if (!calculo) {
      setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro'), message: t('operacoes.erro_dados_msg') });
      return;
    }
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      const filterQuery = { calculo_tarifa_id: calculo.id, status: { $ne: 'cancelada' } };
      if (empId) filterQuery.empresa_id = empId;
      const proformasMatch = await Proforma.filter(filterQuery);
      if (proformasMatch?.[0]) {
        setAlertInfo({ isOpen: true, type: 'warning', title: t('operacoes.ja_existe'), message: `Proforma ${proformasMatch[0].numero_proforma}` });
        return;
      }
    } catch (error) { console.error('Erro ao verificar proformas:', error); }
    setGerarProformaCalculo(calculo);
    setIsGerarProformaModalOpen(true);
  };

  const handleConfirmarGerarProforma = async (dadosProforma) => {
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      const ano = new Date().getFullYear();
      const prefixoProforma = `PF-${ano}-`;
      const filterQuery = { numero_proforma: { $like: `${prefixoProforma}%` } };
      if (empId) filterQuery.empresa_id = empId;
      const proformasDoAno = await Proforma.filter(filterQuery);
      const ultimaProformaDoAno = proformasDoAno.length > 0
        ? proformasDoAno.sort((a, b) => parseInt(b.numero_proforma.split('-')[2]) - parseInt(a.numero_proforma.split('-')[2]))[0]
        : null;

      let proximoNumero = 1;
      if (ultimaProformaDoAno) proximoNumero = parseInt(ultimaProformaDoAno.numero_proforma.split('-')[2]) + 1;
      const numeroProforma = `${prefixoProforma}${String(proximoNumero).padStart(6, '0')}`;

      const proformaData = {
        ...dadosProforma,
        numero_proforma: numeroProforma,
        status: 'emitida',
        data_emissao: new Date().toISOString().split('T')[0],
        voo_id: gerarProformaCalculo?.voo_id || null,
        emitida_por: user?.email || 'sistema',
        empresa_id: empId || null,
      };

      const novaProforma = await Proforma.create(proformaData);
      await registarCriacao('Proforma', novaProforma, 'faturacao');

      try { await base44.functions.invoke('gerarProformaPdfSimples', { proforma_id: novaProforma.id }); }
      catch (pdfError) { console.warn('Erro ao gerar PDF:', pdfError); }

      setSuccessInfo({ isOpen: true, title: t('operacoes.proforma_gerada'), message: `Proforma ${numeroProforma}` });
      handleCloseGerarProforma();
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
    } catch (error) {
      setAlertInfo({ isOpen: true, type: 'error', title: t('operacoes.erro'), message: t('operacoes.erro_proforma') });
    }
  };

  const handleResourcesSaved = async (vooLigado) => {
    handleCloseRecursosVoo();
    try {
      await _recalculateSingleTariff(vooLigado);
      queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
    } catch (err) { console.error('Erro ao recalcular apos salvar recursos:', err); }
  };

  const handleConfirmarUploadDocumento = async (file, tipoDocumento) => {
    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;
      const { Documento } = await import('@/entities/Documento');
      const arrVoo = voos.find(v => v.id === uploadDocumentoData.vooLigado.id_voo_arr);
      const depVoo = voos.find(v => v.id === uploadDocumentoData.vooLigado.id_voo_dep);

      const tiposNome = {
        'general_declaration': 'General Declaration',
        'manifesto_passageiros': 'Manifesto de Passageiros',
        'manifesto_carga': 'Manifesto de Carga',
        'formulario_trafego': 'Formulario de Trafego',
        'proforma_assinada': 'Proforma Assinada'
      };

      await Documento.create({
        titulo: `${tiposNome[tipoDocumento]} - ${arrVoo?.numero_voo} -> ${depVoo?.numero_voo}`,
        categoria: 'outro',
        empresa_id: user?.empresa_id,
        aeroporto: arrVoo?.aeroporto_operacao,
        voo_ligado_id: uploadDocumentoData.vooLigado.id,
        arquivo_url: fileUrl,
        data_publicacao: new Date().toISOString().split('T')[0],
        descricao: `${tiposNome[tipoDocumento]} para voo ligado ${arrVoo?.numero_voo} (ARR) -> ${depVoo?.numero_voo} (DEP). Registo: ${depVoo?.registo_aeronave}`,
        nivel_acesso: ['administrador', 'operacoes'],
        status: 'ativo'
      });

      setSuccessInfo({ isOpen: true, title: t('operacoes.documento_enviado'), message: `${tiposNome[tipoDocumento]} foi salvo com sucesso.` });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      throw new Error(error.message || 'Nao foi possivel fazer upload do documento.');
    }
  };

  const handleExportCSV = () => {
    if (voosFiltrados.length === 0) {
      setAlertInfo({ isOpen: true, type: 'info', title: t('operacoes.sem_dados'), message: t('operacoes.sem_voos_exportar') });
      return;
    }
    const dataToExport = voosFiltrados.map(v => {
      const companhia = companhias.find(c => c.codigo_icao === v.companhia_aerea || c.codigo_iata === v.companhia_aerea);
      const aeroportoOp = todosAeroportos.find(a => a.codigo_icao === v.aeroporto_operacao);
      const aeroportoOriDest = todosAeroportos.find(a => a.codigo_icao === v.aeroporto_origem_destino);
      return {
        'Data Operacao': v.data_operacao, 'Tipo Movimento': v.tipo_movimento, 'Numero Voo': v.numero_voo,
        'Companhia ICAO': v.companhia_aerea, 'Companhia Nome': companhia?.nome || v.companhia_aerea,
        'Registo Aeronave': v.registo_aeronave,
        'Aeroporto Operacao': v.aeroporto_operacao, 'Aeroporto Operacao Nome': aeroportoOp?.nome || v.aeroporto_operacao,
        'Aeroporto Origem/Destino': v.aeroporto_origem_destino, 'Aeroporto Origem/Destino Nome': aeroportoOriDest?.nome || v.aeroporto_origem_destino,
        'Horario Previsto (UTC)': v.horario_previsto, 'Horario Real (UTC)': v.horario_real || '',
        'Tipo de Voo': v.tipo_voo, 'Status': v.status,
        'Passageiros Locais': v.passageiros_local || 0, 'Passageiros Transito c/ Transbordo': v.passageiros_transito_transbordo || 0,
        'Passageiros Transito Direto': v.passageiros_transito_direto || 0, 'Total Passageiros': v.passageiros_total || 0,
        'Tripulacao': v.tripulacao || 0, 'Carga (kg)': v.carga_kg || 0, 'Observacoes': v.observacoes || '',
        'Atualizado Por': v.updated_by || v.created_by || '',
        'Data Criacao': v.created_date ? new Date(v.created_date).toLocaleString('pt-PT') : '',
        'Data Atualizacao': v.updated_date ? new Date(v.updated_date).toLocaleString('pt-PT') : ''
      };
    });
    downloadAsExcel(dataToExport, `voos_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportLinkedFlightsCSV = () => {
    if (voosLigadosFiltrados.length === 0) {
      setAlertInfo({ isOpen: true, type: 'info', title: t('operacoes.sem_dados'), message: t('operacoes.sem_voos_ligados_exportar') });
      return;
    }
    const dataToExport = voosLigadosFiltrados.map(vl => {
      const arrVoo = voos.find(v => v.id === vl.id_voo_arr);
      const depVoo = voos.find(v => v.id === vl.id_voo_dep);
      const calculo = calculosTarifa.find(ct => ct.voo_ligado_id === vl.id || ct.voo_id === depVoo?.id);
      const aeroportoOrigem = todosAeroportos.find(a => a.codigo_icao === arrVoo?.aeroporto_origem_destino);
      const aeroportoOperacao = todosAeroportos.find(a => a.codigo_icao === arrVoo?.aeroporto_operacao);
      const aeroportoDestino = todosAeroportos.find(a => a.codigo_icao === depVoo?.aeroporto_origem_destino);
      const isInternational = (aeroportoOrigem && aeroportoOrigem.pais !== 'AO') || (aeroportoOperacao && aeroportoOperacao.pais !== 'AO') || (aeroportoDestino && aeroportoDestino.pais !== 'AO');
      const tipoOperacao = isInternational ? 'Internacional' : 'Domestico';
      const tempoPermanenciaHoras = (vl.tempo_permanencia_min / 60).toFixed(2);
      const companhia = companhias.find(c => c.codigo_icao === depVoo?.companhia_aerea || c.codigo_iata === depVoo?.companhia_aerea);
      const aeroportoOp = todosAeroportos.find(a => a.codigo_icao === arrVoo?.aeroporto_operacao);
      return {
        'Voo ARR': arrVoo?.numero_voo || 'N/A', 'Data ARR': arrVoo?.data_operacao || 'N/A',
        'Horario Previsto ARR (UTC)': arrVoo?.horario_previsto || 'N/A', 'Horario Real ARR (UTC)': arrVoo?.horario_real || 'N/A',
        'Voo DEP': depVoo?.numero_voo || 'N/A', 'Data DEP': depVoo?.data_operacao || 'N/A',
        'Horario Previsto DEP (UTC)': depVoo?.horario_previsto || 'N/A', 'Horario Real DEP (UTC)': depVoo?.horario_real || 'N/A',
        'Aeroporto ICAO': arrVoo?.aeroporto_operacao || 'N/A', 'Aeroporto Nome': aeroportoOp?.nome || arrVoo?.aeroporto_operacao || 'N/A',
        'Rota Completa': arrVoo && depVoo ? `${arrVoo.aeroporto_origem_destino} -> ${arrVoo.aeroporto_operacao} -> ${depVoo.aeroporto_origem_destino}` : 'N/A',
        'Tipo Operacao': tipoOperacao, 'Tipo de Voo': depVoo?.tipo_voo || 'N/A',
        'Companhia ICAO': depVoo?.companhia_aerea || 'N/A', 'Companhia Nome': companhia?.nome || depVoo?.companhia_aerea || 'N/A',
        'Registo Aeronave': depVoo?.registo_aeronave || 'N/A',
        'Permanencia (horas)': tempoPermanenciaHoras, 'Permanencia (minutos)': vl.tempo_permanencia_min || 0,
        'Passageiros Locais': depVoo?.passageiros_local || 0, 'Passageiros Transito c/ Transbordo': depVoo?.passageiros_transito_transbordo || 0,
        'Passageiros Transito Direto': depVoo?.passageiros_transito_direto || 0, 'Total Passageiros': depVoo?.passageiros_total || 0,
        'Tripulacao': depVoo?.tripulacao || 0, 'Carga (kg)': depVoo?.carga_kg || 0,
        'Status Voo ARR': arrVoo?.status || 'N/A', 'Status Voo DEP': depVoo?.status || 'N/A',
        'Status Calculo': calculo ? (calculo.tipo_tarifa === 'Voo Isento de Tarifas' ? 'Isento' : 'Calculado') : 'Sem Calculo',
        'MTOW (kg)': calculo?.mtow_kg || 0,
        'Taxa Cambio (AOA/USD)': calculo?.taxa_cambio_usd_aoa || configuracaoSistema?.taxa_cambio_usd_aoa || 850,
        'Tarifa Pouso (USD)': calculo?.tarifa_pouso_usd || 0, 'Tarifa Pouso (AOA)': calculo?.tarifa_pouso || 0,
        'Tarifa Permanencia (USD)': calculo?.tarifa_permanencia_usd || 0, 'Tarifa Permanencia (AOA)': calculo?.tarifa_permanencia || 0,
        'Tarifa Passageiros (USD)': calculo?.tarifa_passageiros_usd || 0, 'Tarifa Passageiros (AOA)': calculo?.tarifa_passageiros || 0,
        'Tarifa Carga (USD)': calculo?.tarifa_carga_usd || 0, 'Tarifa Carga (AOA)': calculo?.tarifa_carga || 0,
        'Outras Tarifas (USD)': calculo?.outras_tarifas_usd || 0, 'Outras Tarifas (AOA)': calculo?.outras_tarifas || 0,
        'Total Tarifa (USD)': calculo?.total_tarifa_usd || 0, 'Total Tarifa (AOA)': calculo?.total_tarifa || 0,
        'Observacoes ARR': arrVoo?.observacoes || '', 'Observacoes DEP': depVoo?.observacoes || '',
        'Atualizado Por': depVoo?.updated_by || depVoo?.created_by || '',
        'Data Criacao': vl.created_date ? new Date(vl.created_date).toLocaleString('pt-PT') : '',
        'Data Calculo': calculo?.data_calculo ? new Date(calculo.data_calculo).toLocaleString('pt-PT') : ''
      };
    });
    downloadAsExcel(dataToExport, `voos_ligados_${new Date().toISOString().split('T')[0]}`);
    setSuccessInfo({ isOpen: true, title: t('operacoes.exportacao_concluida'), message: `${dataToExport.length} Excel` });
  };

  // ========================
  // RENDER
  // ========================

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{t('page.operacoes.title')}</h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">{t('page.operacoes.subtitle')}</p>
          </div>
        </div>

        <Tabs defaultValue="voos" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="voos" className="text-xs sm:text-sm px-2 py-2">{t('tab.all_flights')}</TabsTrigger>
            <TabsTrigger value="linkados" className="text-xs sm:text-sm px-2 py-2">
              <span className="hidden sm:inline">{t('tab.linked_flights')}</span>
              <span className="sm:hidden">{t('tab.linked')}</span>
              {voosLigadosValidos.length > 0 && (
                <span className="ml-1 sm:ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                  {voosLigadosValidos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sem_link" className="text-xs sm:text-sm px-2 py-2">
              <Unlink className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">Voos Sem Link</span>
              <span className="sm:hidden">Sem Link</span>
              {semLinkStats.total > 0 && (
                <span className="ml-1 sm:ml-2 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                  {semLinkStats.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fids" className="text-xs sm:text-sm px-2 py-2">
              <Plane className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">FIDS</span>
              <span className="sm:hidden">FIDS</span>
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="text-xs sm:text-sm px-2 py-2">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('tab.config')}</span>
              <span className="sm:hidden">{t('operacoes.config')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voos" className="space-y-4 sm:space-y-6">
            <VoosTab
              voosFiltrados={voosFiltrados}
              isLoadingAll={isLoadingAll}
              isFiltering={isFiltering}
              filtros={filtros}
              aeroportos={aeroportos}
              companhias={companhias}
              voos={voos}
              voosLigados={voosLigados}
              sortField={sortField}
              sortDirection={sortDirection}
              t={t}
              language={language}
              user={user}
              onFilterChange={handleFilterChange}
              onSort={handleSort}
              onBuscar={handleBuscarVoos}
              onClearFilters={clearFilters}
              onRefresh={loadData}
              onExportCSV={handleExportCSV}
              onOpenForm={handleOpenForm}
              onLixeira={() => setIsLixeiraModalOpen(true)}
              onEditVoo={(voo) => handleOpenForm(voo.tipo_movimento, voo)}
              onCancelarVoo={handleCancelarVoo}
              onExcluirVoo={handleExcluirVoo}
              onLinkarManual={handleLinkarManual}
              onUploadDocumento={handleUploadDocumento}
              onVerDocumentosVoo={handleVerDocumentosVoo}
              onRecursosVoo={handleRecursosVoo}
            />
          </TabsContent>

          <TabsContent value="linkados" className="space-y-4 sm:space-y-6">
            <VoosLigadosTab
              voosLigadosValidos={voosLigadosValidos}
              voosLigadosFiltrados={voosLigadosFiltrados}
              voos={voos}
              calculosTarifa={calculosTarifa}
              todosAeroportos={todosAeroportos}
              aeroportos={aeroportos}
              companhias={companhias}
              isLoadingAll={isLoadingAll}
              isFilteringLigados={isFilteringLigados}
              filtrosLigados={filtrosLigados}
              sortFieldLigados={sortFieldLigados}
              sortDirectionLigados={sortDirectionLigados}
              configuracaoSistema={configuracaoSistema}
              t={t}
              language={language}
              formatCurrency={formatCurrency}
              user={user}
              onFilterChange={handleFilterChangeLigados}
              onClearFilters={clearFiltersLigados}
              onBuscar={handleBuscarLigados}
              onSort={handleSortLigados}
              onRefresh={loadData}
              onExcluirVooLigado={handleExcluirVooLigado}
              onRecalcularTarifaSingle={handleRecalcularTarifaSingle}
              onRecalcularTarifasLote={handleRecalcularTarifasLote}
              onShowTariffDetails={handleShowTariffDetails}
              onExportTariffPDF={handleExportTariffPDF}
              onExportCSV={handleExportLinkedFlightsCSV}
              onGerarProforma={handleGerarProforma}
              onAlterarCambio={handleAlterarCambio}
              onUploadDocumento={handleUploadDocumento}
              onVerDocumentosVoo={handleVerDocumentosVoo}
              onRecursosVoo={handleRecursosVoo}
              onUploadMultiplos={handleOpenUploadMultiplos}
            />
          </TabsContent>

          <TabsContent value="sem_link" className="space-y-4 sm:space-y-6">
            <VoosSemLinkTab
              voosSemLink={voosSemLink}
              voosSemLinkComputed={voosSemLinkComputed}
              semLinkStats={semLinkStats}
              isLoadingSemLink={isLoadingSemLink}
              isLinkingAuto={isLinkingAuto}
              filtrosSemLink={filtrosSemLink}
              semLinkLoaded={semLinkLoaded}
              aeroportos={aeroportos}
              companhias={companhias}
              t={t}
              onLinkarAutomatico={handleLinkarAutomatico}
              onLinkarManual={handleLinkarManual}
              onLoadSemLink={loadVoosSemLink}
              onFilterChange={handleFilterChangeSemLink}
              onDeleteVoo={handleDeleteVooSemLink}
              getSugestoesPar={getSugestoesPar}
            />
          </TabsContent>

          <TabsContent value="fids" className="space-y-4 sm:space-y-6">
            <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
              <FIDSPanel aeroportos={todosAeroportos} />
            </React.Suspense>
          </TabsContent>

          <TabsContent value="configuracoes" className="space-y-4 sm:space-y-6">
            <Card className="shadow-sm border-0">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg md:text-xl">{t('operacoes.configuracoes')}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{t('operacoes.configuracoes_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <Tabs defaultValue="aeroportos" orientation="horizontal" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 h-auto">
                    <TabsTrigger value="aeroportos" className="text-xs sm:text-sm px-2 py-2">{t('operacoes.aeroportos')}</TabsTrigger>
                    <TabsTrigger value="companhias" className="text-xs sm:text-sm px-2 py-2">{t('operacoes.companhias')}</TabsTrigger>
                    <TabsTrigger value="modelos" className="text-xs sm:text-sm px-2 py-2">{t('operacoes.modelos')}</TabsTrigger>
                    <TabsTrigger value="registos" className="text-xs sm:text-sm px-2 py-2">{t('operacoes.registos')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="aeroportos" className="mt-4 sm:mt-6">
                    <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
                      <AeroportosConfig aeroportos={todosAeroportos} onReload={() => queryClient.invalidateQueries({ queryKey: ['aeroportos', empresaId] })} />
                    </React.Suspense>
                  </TabsContent>

                  <TabsContent value="companhias" className="mt-4 sm:mt-6">
                    <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
                      <CompanhiasConfig companhias={companhias} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['companhias', empresaId] })} />
                    </React.Suspense>
                  </TabsContent>

                  <TabsContent value="modelos" className="mt-4 sm:mt-6">
                    <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
                      <ModelosAeronaveConfig modelos={modelosAeronave} onReload={() => queryClient.invalidateQueries({ queryKey: ['modelos', empresaId] })} />
                    </React.Suspense>
                  </TabsContent>

                  <TabsContent value="registos" className="mt-4 sm:mt-6">
                    <React.Suspense fallback={<div className="p-8 text-center text-slate-400">A carregar...</div>}>
                    <RegistosAeronaveConfig
                      registos={aeronaves}
                      modelos={modelosAeronave}
                      companhias={companhiasCache.length > 0 ? companhiasCache : companhias}
                      onReload={() => queryClient.invalidateQueries({ queryKey: ['aeronaves', empresaId] })}
                    />
                    </React.Suspense>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <React.Suspense fallback={null}>
      {isFormOpen && (
        <FormVoo
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSubmit={handleSaveVoo}
          tipoMovimento={tipoMovimentoForm}
          vooInicial={editingVoo}
          aeroportos={aeroportos}
          aeroportosOrigemDestino={todosAeroportos}
          companhias={companhias}
          aeronaves={aeronaves}
          voos={voos}
          voosLigados={voosLigados}
          currentUser={user}
          linkedArrVoo={vooArrToLink}
          setAlertInfo={setAlertInfo}
          onRefreshData={() => {
            queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
            queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
          }}
          modelos={modelosAeronave}
        />
      )}

      {tariffDetailsData && (
        <TariffDetailsModal
          isOpen={!!tariffDetailsData}
          onClose={() => setTariffDetailsData(null)}
          tariffCalculation={tariffDetailsData}
          voos={voos}
          voosLigados={voosLigados}
          aeroportos={todosAeroportos}
        />
      )}

      {gerarProformaCalculo && (() => {
        const vooDoCalculo = voos.find(v => v.id === gerarProformaCalculo.voo_id);
        const companhiaDoVoo = vooDoCalculo
          ? companhias.find(c => c.codigo_icao === vooDoCalculo.companhia_aerea || c.codigo_iata === vooDoCalculo.companhia_aerea)
          : null;
        return (
          <GerarFaturaModal
            isOpen={isGerarProformaModalOpen}
            onClose={handleCloseGerarProforma}
            onConfirm={handleConfirmarGerarProforma}
            calculo={gerarProformaCalculo || {}}
            companhia={companhiaDoVoo}
            aeroporto={todosAeroportos.find(a => a.id === gerarProformaCalculo?.aeroporto_id)}
            voos={voos}
            voosLigados={voosLigados}
          />
        );
      })()}

      {calculoParaAlterarCambio && (
        <AlterarCambioModal
          isOpen={isAlterarCambioModalOpen}
          onClose={handleCloseAlterarCambio}
          calculo={calculoParaAlterarCambio}
          onConfirm={handleConfirmarAlterarCambio}
          voos={voos}
        />
      )}

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={handleCloseAlert}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
        showCancel={alertInfo.showCancel}
        onConfirm={alertInfo.onConfirm}
        confirmText={alertInfo.confirmText}
      />

      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={handleCloseSuccess}
        title={successInfo.title}
        message={successInfo.message}
      />

      <ProgressModal
        isOpen={progressModal.isOpen}
        title={progressModal.title}
        currentStep={progressModal.currentStep}
        totalSteps={progressModal.totalSteps}
        successCount={progressModal.successCount}
        errorCount={progressModal.errorCount}
        currentItem={progressModal.currentItem}
        errors={progressModal.errors}
      />

      {uploadDocumentoData && (
        <UploadDocumentoVooModal
          isOpen={isUploadDocumentoModalOpen}
          onClose={handleCloseUploadDocumento}
          onConfirm={handleConfirmarUploadDocumento}
          vooLigado={uploadDocumentoData.vooLigado}
          voos={voos}
          tipoDocumento={uploadDocumentoData.tipoDocumento}
        />
      )}

      <CancelarProformaModal
        isOpen={cancelarProformaModal.isOpen}
        onClose={handleCloseCancelarProforma}
        onConfirm={cancelarProformaModal.onConfirm || (() => {})}
        proforma={cancelarProformaModal.proforma}
        descricao={cancelarProformaModal.descricao}
      />

      <LixeiraVoosModal
        isOpen={isLixeiraModalOpen}
        onClose={() => setIsLixeiraModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
          queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
          queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
        }}
        companhias={companhias}
        aeroportos={todosAeroportos}
        voosLigados={voosLigados}
      />

      {recursosVooModalData && (
        <RecursosVooModal
          isOpen={isRecursosVooModalOpen}
          onClose={handleCloseRecursosVoo}
          vooLigado={recursosVooModalData}
          voos={voos}
          aeroportos={todosAeroportos}
          onResourcesSaved={handleResourcesSaved}
        />
      )}

      {documentosVooModalData && (
        <DocumentosVooModal
          isOpen={isDocumentosVooModalOpen}
          onClose={handleCloseDocumentosVoo}
          vooLigado={documentosVooModalData}
          voos={voos}
          onOpenUploadModal={handleOpenUploadFromDocumentosModal}
          user={user}
        />
      )}

      {uploadMultiplosModalData && (
        <UploadMultiplosDocumentosModal
          isOpen={isUploadMultiplosModalOpen}
          onClose={handleCloseUploadMultiplos}
          vooLigado={uploadMultiplosModalData}
          voos={voos}
          user={user}
          onSuccess={handleUploadMultiplosSuccess}
        />
      )}
      </React.Suspense>
    </div>
  );
}
