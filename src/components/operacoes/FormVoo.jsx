import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { normalizeAircraftRegistration, normalizeFlightNumber, createDateTime } from '@/components/lib/utils';
import { getAeroportosPermitidos, isSuperAdmin } from '@/components/lib/userUtils';
import { differenceInMinutes } from 'date-fns';
import { useI18n } from '@/components/lib/i18n';
import { Voo } from '@/entities/Voo';

// Importar os formularios COMPLETOS
import { FormAeroporto } from './config/AeroportosConfig';
import { FormCompanhia } from './config/CompanhiasConfig';
import { FormRegisto } from './config/RegistosAeronaveConfig';

// Importar sub-componentes de seccao
import ArrivalSection from './form/ArrivalSection';
import DepartureSection from './form/DepartureSection';
import PassengersSection from './form/PassengersSection';
import BaggageSection from './form/BaggageSection';

// Importar hooks auxiliares
import useFormVooCreation from './form/useFormVooCreation';
import useFormVooSearch, { loadCompanhiasCache } from './form/useFormVooSearch';

// Intervalo de tolerancia para considerar voos duplicados (em minutos)
const DUPLICATE_TOLERANCE_MINUTES = 15;

// Pure filter helper — exported for testability (BUG-02 fix)
export function filterVoosArr(voos, formData, voosLigados, vooInicial) {
  if (formData.tipo_movimento !== 'DEP') return [];
  if (!formData.data_operacao) return [];

  const depDate = new Date(formData.data_operacao);
  const depTime = formData.horario_real || formData.horario_previsto;

  let filteredVoos = voos.filter((voo) => {
    if (voo.tipo_movimento !== 'ARR' || voo.status === 'Cancelado') {
      return false;
    }

    const arrDate = new Date(voo.data_operacao);
    const diffDays = Math.floor((depDate.getTime() - arrDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return false;

    if (diffDays === 0 && depTime) {
      const arrTime = voo.horario_real || voo.horario_previsto;
      if (arrTime >= depTime) return false;
    }

    if (formData.registo_aeronave && voo.registo_aeronave !== formData.registo_aeronave) {
      return false;
    }

    return true;
  });

  const currentLinkedArrId = vooInicial?.id
    ? voosLigados.find((vl) => vl.id_voo_dep === vooInicial.id)?.id_voo_arr
    : null;

  const voosJaLigadosExcludingCurrent = new Set(
    voosLigados
      .filter((vl) => vl.id_voo_dep !== vooInicial?.id)
      .map((vl) => vl.id_voo_arr)
  );

  return filteredVoos
    .filter((voo) => !voosJaLigadosExcludingCurrent.has(voo.id) || voo.id === currentLinkedArrId)
    .sort((a, b) => {
      const dateA = `${a.data_operacao}T${a.horario_real || a.horario_previsto}`;
      const dateB = `${b.data_operacao}T${b.horario_real || b.horario_previsto}`;
      return dateB.localeCompare(dateA);
    });
}

export default function FormVoo({
  isOpen,
  onClose,
  onSubmit,
  tipoMovimento = 'ARR',
  vooInicial = null,
  aeroportos = [],
  aeroportosOrigemDestino = [],
  companhias = [],
  aeronaves = [],
  voos = [],
  voosLigados = [],
  setAlertInfo,
  onRefreshData,
  modelos = [],
  currentUser = null
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    tipo_movimento: 'ARR',
    numero_voo: '',
    data_operacao: new Date().toISOString().split('T')[0],
    horario_previsto: '',
    horario_real: '',
    aeroporto_operacao: '',
    registo_aeronave: '',
    companhia_aerea: '',
    aeroporto_origem_destino: '',
    tipo_voo: 'Regular',
    status: 'Programado',
    passageiros_local: 0,
    passageiros_transito_transbordo: 0,
    passageiros_transito_direto: 0,
    passageiros_infant: 0,
    passageiros_total: 0,
    tripulacao: 0,
    carga_kg: 0,
    observacoes: '',
    posicao_stand: '',
    aeronave_no_hangar: false,
    requer_iluminacao_extra: false,
    registo_alterado: false,
    registo_dep: '',
    combustivel_utilizado: false,
    combustivel_tipo: 'JET-A1',
    combustivel_litros: 0,
    bagagem_local: 0,
    bagagem_transito_transbordo: 0,
    bagagem_transito_direto: 0,
    bagagem_total: 0
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [militaryWarning, setMilitaryWarning] = useState(null);
  const [serverArrVoos, setServerArrVoos] = useState([]);

  // States para modais de criacao rapida
  const [showCreateAeroporto, setShowCreateAeroporto] = useState(false);
  const [showCreateCompanhia, setShowCreateCompanhia] = useState(false);
  const [showCreateRegisto, setShowCreateRegisto] = useState(false);

  const [linkedArrVooId, setLinkedArrVooId] = useState('');

  // Lista de companhias militares/oficiais
  const MILITARY_COMPANIES = ['FANA', 'MINDEF'];

  const isMilitaryCompany = (companhiaIcao) => {
    return MILITARY_COMPANIES.includes(companhiaIcao?.toUpperCase());
  };

  // --- Hooks auxiliares ---
  const { handleCreateAeroporto, handleCreateCompanhia, handleCreateRegisto } = useFormVooCreation({
    aeroportosOrigemDestino,
    companhias,
    aeronaves,
    currentUser,
    formData,
    setFormData,
    setAlertInfo,
    onRefreshData,
    setShowCreateAeroporto,
    setShowCreateCompanhia,
    setShowCreateRegisto
  });

  const {
    searchCompanhias, getCompanhiaInicial,
    searchAeroportos, getAeroportoInicial,
    searchRegistos, getRegistoInicial
  } = useFormVooSearch({
    formData,
    companhias,
    aeronaves,
    aeroportosOrigemDestino
  });

  // --- Military consistency check ---
  const checkMilitaryConsistency = useCallback(() => {
    if (!formData.companhia_aerea || !formData.tipo_voo) {
      setMilitaryWarning(null);
      return;
    }

    const isCompanyMilitary = isMilitaryCompany(formData.companhia_aerea);
    const isFlightTypeMilitary = formData.tipo_voo === 'Militar' || formData.tipo_voo === 'Oficial';

    if (isCompanyMilitary && !isFlightTypeMilitary) {
      setMilitaryWarning({
        type: 'warning',
        message: `⚠️ ${t('formVoo.avisoCompanhiaMilitar1')} ${formData.companhia_aerea} ${t('formVoo.avisoCompanhiaMilitar2')}`
      });
    } else if (!isCompanyMilitary && isFlightTypeMilitary) {
      setMilitaryWarning({
        type: 'info',
        message: `ℹ️ ${t('formVoo.avisoTipoVooIsento1')} "${formData.tipo_voo}" ${t('formVoo.avisoTipoVooIsento2')}`
      });
    } else {
      setMilitaryWarning(null);
    }
  }, [formData.companhia_aerea, formData.tipo_voo]);

  useEffect(() => {
    checkMilitaryConsistency();
  }, [checkMilitaryConsistency]);

  // --- Aeroportos de acesso ---
  const aeroportosAcesso = useMemo(() => {
    if (!currentUser || !Array.isArray(aeroportos)) return [];

    const permitidos = getAeroportosPermitidos(currentUser, aeroportos);
    if (isSuperAdmin(currentUser) || (currentUser.role === 'admin' || (currentUser.perfis && currentUser.perfis.includes('administrador')))) {
      const sgaAeroportos = permitidos.filter((a) => a.isSGA === true);
      const baseList = sgaAeroportos.length > 0 ? sgaAeroportos : permitidos;
      if (vooInicial?.aeroporto_operacao) {
        const jaInclui = baseList.some(a => a.codigo_icao === vooInicial.aeroporto_operacao);
        if (!jaInclui) {
          const aeroVoo = permitidos.find(a => a.codigo_icao === vooInicial.aeroporto_operacao);
          if (aeroVoo) baseList.push(aeroVoo);
        }
      }
      return baseList;
    }
    return permitidos;
  }, [aeroportos, currentUser, vooInicial]);

  // Auto-selecionar aeroporto se o usuario tem acesso a apenas um
  useEffect(() => {
    if (aeroportosAcesso.length === 1 && !formData.aeroporto_operacao) {
      setFormData((prev) => ({ ...prev, aeroporto_operacao: aeroportosAcesso[0].codigo_icao }));
    }
  }, [aeroportosAcesso, formData.aeroporto_operacao]);

  // --- Duplicate check ---
  const checkDuplicateVoo = useCallback(() => {
    if (!formData.registo_aeronave || !formData.data_operacao || !formData.aeroporto_operacao || !formData.horario_previsto) {
      setDuplicateWarning(null);
      return;
    }

    const horarioParaComparar = formData.horario_real || formData.horario_previsto;
    const dateTimeAtual = createDateTime(formData.data_operacao, horarioParaComparar, formData.horario_previsto);

    if (!dateTimeAtual) {
      setDuplicateWarning(null);
      return;
    }

    const potentialDuplicates = voos.filter(voo => {
      if (vooInicial && voo.id === vooInicial.id) return false;

      if (
        voo.registo_aeronave === formData.registo_aeronave &&
        voo.tipo_movimento === formData.tipo_movimento &&
        voo.aeroporto_operacao === formData.aeroporto_operacao
      ) {
        const vooHorario = voo.horario_real || voo.horario_previsto;
        try {
          const dateTimeVooExistente = createDateTime(voo.data_operacao, vooHorario, voo.horario_previsto);
          if (!dateTimeVooExistente) return false;
          const diffMinutos = Math.abs(differenceInMinutes(dateTimeAtual, dateTimeVooExistente));
          return diffMinutos <= DUPLICATE_TOLERANCE_MINUTES;
        } catch (error) {
          console.error('Erro ao comparar horarios:', error);
          return false;
        }
      }
      return false;
    });

    if (potentialDuplicates.length > 0) {
      const d = potentialDuplicates[0];
      setDuplicateWarning({
        voo: d,
        message: `${t('formVoo.avisoVooDuplicado1')} ${d.tipo_movimento} ${t('formVoo.avisoVooDuplicado2')} ${d.registo_aeronave} ${t('formVoo.avisoVooDuplicado3')} ${d.aeroporto_operacao} ${t('formVoo.avisoVooDuplicado4')} ${d.data_operacao} ${t('formVoo.avisoVooDuplicado5')} ${d.horario_real || d.horario_previsto} (${t('formVoo.avisoVooDuplicado6')} ${d.numero_voo}). ${t('formVoo.avisoVooDuplicado7')}`
      });
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.registo_aeronave, formData.data_operacao, formData.tipo_movimento, formData.aeroporto_operacao, formData.horario_previsto, formData.horario_real, voos, vooInicial]);

  useEffect(() => {
    checkDuplicateVoo();
  }, [checkDuplicateVoo]);

  // Pre-warm companhias cache when form opens
  useEffect(() => {
    if (isOpen) loadCompanhiasCache();
  }, [isOpen]);

  // Load data when editing or reset for new flight
  useEffect(() => {
    if (vooInicial && isOpen) {
      let tipoVooAjustado = vooInicial.tipo_voo || 'Regular';
      if (vooInicial.companhia_aerea && isMilitaryCompany(vooInicial.companhia_aerea)) {
        tipoVooAjustado = 'Militar';
      }

      setFormData({
        tipo_movimento: vooInicial.tipo_movimento || 'ARR',
        numero_voo: vooInicial.numero_voo || '',
        data_operacao: vooInicial.data_operacao || new Date().toISOString().split('T')[0],
        horario_previsto: vooInicial.horario_previsto || '',
        horario_real: vooInicial.horario_real || '',
        aeroporto_operacao: vooInicial.aeroporto_operacao || '',
        registo_aeronave: vooInicial.registo_aeronave || '',
        companhia_aerea: vooInicial.companhia_aerea || '',
        aeroporto_origem_destino: vooInicial.aeroporto_origem_destino || '',
        tipo_voo: tipoVooAjustado,
        status: vooInicial.status || 'Programado',
        passageiros_local: vooInicial.passageiros_local || 0,
        passageiros_transito_transbordo: vooInicial.passageiros_transito_transbordo || 0,
        passageiros_transito_direto: vooInicial.passageiros_transito_direto || 0,
        passageiros_infant: vooInicial.passageiros_infant || 0,
        passageiros_total: vooInicial.passageiros_total || 0,
        tripulacao: vooInicial.tripulacao || 0,
        carga_kg: vooInicial.carga_kg || 0,
        observacoes: vooInicial.observacoes || '',
        posicao_stand: vooInicial.posicao_stand || '',
        aeronave_no_hangar: vooInicial.aeronave_no_hangar || false,
        requer_iluminacao_extra: vooInicial.requer_iluminacao_extra || false,
        registo_alterado: false,
        registo_dep: '',
        combustivel_utilizado: vooInicial.combustivel_utilizado || false,
        combustivel_tipo: vooInicial.combustivel_tipo || 'JET-A1',
        combustivel_litros: vooInicial.combustivel_litros || 0,
        // Recarregar bagagem ao editar (senao zera os valores ja gravados).
        bagagem_local: vooInicial.bagagem_local || 0,
        bagagem_transito_transbordo: vooInicial.bagagem_transito_transbordo || 0,
        bagagem_transito_direto: vooInicial.bagagem_transito_direto || 0,
        bagagem_total: vooInicial.bagagem_total || 0
      });

      if (vooInicial.tipo_movimento === 'DEP') {
        const existingLink = voosLigados.find((vl) => vl.id_voo_dep === vooInicial.id);
        if (existingLink) {
          setLinkedArrVooId(existingLink.id_voo_arr);
          if (existingLink.registo_alterado) {
            setFormData(prev => ({
              ...prev,
              registo_alterado: true,
              registo_dep: existingLink.registo_dep || ''
            }));
          }
        } else {
          setLinkedArrVooId('');
        }
      } else {
        setLinkedArrVooId('');
      }
    } else if (isOpen && !vooInicial) {
      const initialTipoMovimento = tipoMovimento || 'ARR';
      let initialAeroportoOperacao = '';

      if (initialTipoMovimento === 'ARR' && aeroportosAcesso.length === 1) {
        initialAeroportoOperacao = aeroportosAcesso[0].codigo_icao;
      }

      setFormData((_prev) => ({
        tipo_movimento: initialTipoMovimento,
        numero_voo: '',
        data_operacao: new Date().toISOString().split('T')[0],
        horario_previsto: '',
        horario_real: '',
        aeroporto_operacao: initialAeroportoOperacao,
        registo_aeronave: '',
        companhia_aerea: '',
        aeroporto_origem_destino: '',
        tipo_voo: 'Regular',
        status: 'Programado',
        passageiros_local: 0,
        passageiros_transito_transbordo: 0,
        passageiros_transito_direto: 0,
        passageiros_infant: 0,
        passageiros_total: 0,
        tripulacao: 0,
        carga_kg: 0,
        observacoes: '',
        aeronave_no_hangar: false,
        requer_iluminacao_extra: false
      }));
      setLinkedArrVooId('');
    }
    setErrors({});
    setDuplicateWarning(null);
    setMilitaryWarning(null);
  }, [vooInicial, isOpen, tipoMovimento, voosLigados, aeroportosAcesso]);

  // --- Derived data ---
  // Busca autoritativa de ARRs no servidor (independente do cache de ~1000 voos
  // da pagina): garante que a chegada recem-criada / de qualquer data apareca
  // para linkar, sem precisar de F5.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (formData.tipo_movimento !== 'DEP' || !formData.data_operacao) { setServerArrVoos([]); return; }
      try {
        // Busca os arrivals LIVRES (nao ligados) ate a data da partida. Sao POUCOS (so os
        // linkaveis — a maioria ja esta ligada), entao os 300 mais recentes cobrem inclusive
        // chegadas ANTIGAS livres (ex.: ARR de 27/jun de aviao parado 15 dias). Antes a busca
        // trazia os 300 mais recentes de TODOS -> so ~4 dias -> perdia a chegada antiga livre.
        const q = {
          tipo_movimento: 'ARR',
          deleted_at: { $is: null },
          voo_ligado_id: { $is: null },
          data_operacao: { $lte: formData.data_operacao },
        };
        if (formData.registo_aeronave) q.registo_aeronave = formData.registo_aeronave;
        const res = await Voo.filter(q, '-data_operacao', 300);
        if (!cancelled) setServerArrVoos(res || []);
      } catch (e) {
        console.error('Erro ao buscar ARRs no servidor:', e);
        if (!cancelled) setServerArrVoos([]);
      }
    })();
    return () => { cancelled = true; };
  }, [formData.tipo_movimento, formData.data_operacao, formData.registo_aeronave]);

  // Lista mesclada (cache da pagina + busca fresca do servidor), dedupe por id.
  // Usada no dropdown E no preenchimento/validacao do ARR vinculado, para que
  // ARRs vindos so do servidor tambem preencham campos e validem horario.
  const arrCandidatos = useMemo(() => {
    const merged = [...voos];
    const seen = new Set(voos.map(v => v.id));
    for (const v of serverArrVoos) { if (!seen.has(v.id)) { merged.push(v); seen.add(v.id); } }
    return merged;
  }, [voos, serverArrVoos]);

  const voosArrDisponíveis = useMemo(
    () => filterVoosArr(arrCandidatos, formData, voosLigados, vooInicial),
    [arrCandidatos, formData.tipo_movimento, formData.data_operacao, formData.horario_real, formData.horario_previsto, formData.registo_aeronave, voosLigados, vooInicial]
  );

  const horarioMinimoDep = useMemo(() => {
    if (formData.tipo_movimento === 'DEP' && linkedArrVooId) {
      const arrVoo = arrCandidatos.find((v) => v.id === linkedArrVooId);
      if (arrVoo) return arrVoo.horario_real || arrVoo.horario_previsto;
    }
    return undefined;
  }, [formData.tipo_movimento, linkedArrVooId, arrCandidatos]);

  // --- Handlers ---
  const handleLinkedVooChange = (vooArrId) => {
    setLinkedArrVooId(vooArrId);
    if (errors.linked_arr_voo) {
      setErrors((prev) => ({ ...prev, linked_arr_voo: '' }));
    }

    if (vooArrId) {
      const vooArr = arrCandidatos.find((v) => v.id === vooArrId);
      if (vooArr) {
        setFormData((prev) => ({
          ...prev,
          companhia_aerea: vooArr.companhia_aerea,
          registo_aeronave: vooArr.registo_aeronave,
          aeroporto_operacao: vooArr.aeroporto_operacao,
          aeroporto_origem_destino: ''
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        companhia_aerea: '',
        registo_aeronave: '',
        aeroporto_operacao: '',
        aeroporto_origem_destino: prev.tipo_movimento === 'DEP' ? '' : prev.aeroporto_origem_destino
      }));
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      if (field === 'companhia_aerea') {
        if (isMilitaryCompany(value)) {
          newData.tipo_voo = 'Militar';
        }
        if (prev.tipo_movimento === 'DEP') {
          setLinkedArrVooId('');
          newData.registo_aeronave = '';
          newData.aeroporto_operacao = '';
        } else {
          newData.registo_aeronave = '';
        }
      }

      if (field === 'tipo_movimento' && prev.tipo_movimento !== value) {
        setLinkedArrVooId('');
        newData.registo_aeronave = '';
        newData.companhia_aerea = '';
        newData.aeroporto_origem_destino = '';
        newData.aeroporto_operacao = '';

        if (value === 'ARR' && aeroportosAcesso.length === 1) {
          newData.aeroporto_operacao = aeroportosAcesso[0].codigo_icao;
        }
      }

      if (field === 'data_operacao' && prev.tipo_movimento === 'DEP') {
        setLinkedArrVooId('');
        newData.companhia_aerea = '';
        newData.registo_aeronave = '';
        newData.aeroporto_operacao = '';
        newData.aeroporto_origem_destino = '';
      }

      return newData;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Calculate total passengers automatically
  useEffect(() => {
    const total = (parseInt(formData.passageiros_local) || 0) +
      (parseInt(formData.passageiros_transito_transbordo) || 0) +
      (parseInt(formData.passageiros_transito_direto) || 0) +
      (parseInt(formData.passageiros_infant) || 0);

    if (total !== formData.passageiros_total) {
      setFormData((prev) => ({ ...prev, passageiros_total: total }));
    }
  }, [formData.passageiros_local, formData.passageiros_transito_transbordo, formData.passageiros_transito_direto, formData.passageiros_infant, formData.passageiros_total]);

  // Calculate total bagagem automatically (ARR only)
  useEffect(() => {
    if (formData.tipo_movimento === 'ARR') {
      const total = (parseInt(formData.bagagem_local) || 0) +
        (parseInt(formData.bagagem_transito_transbordo) || 0) +
        (parseInt(formData.bagagem_transito_direto) || 0);
      if (total !== formData.bagagem_total) {
        setFormData((prev) => ({ ...prev, bagagem_total: total }));
      }
    }
  }, [formData.tipo_movimento, formData.bagagem_local, formData.bagagem_transito_transbordo, formData.bagagem_transito_direto, formData.bagagem_total]);

  // --- Validation ---
  const validate = () => {
    const newErrors = {};

    if (!formData.data_operacao) newErrors.data_operacao = t('formVoo.erroDataObrigatoria');
    if (!formData.horario_previsto) newErrors.horario_previsto = t('formVoo.erroHorarioPrevistoObrigatorio');

    if (formData.tipo_movimento === 'DEP') {
      if (!linkedArrVooId) {
        newErrors.linked_arr_voo = t('formVoo.erroVinculoChegadaObrigatorio');
      }

      if (linkedArrVooId) {
        const vooArr = arrCandidatos.find((v) => v.id === linkedArrVooId);
        if (vooArr) {
          const horarioArrReal = vooArr.horario_real || vooArr.horario_previsto;
          const dateTimeArr = createDateTime(vooArr.data_operacao, horarioArrReal, vooArr.horario_previsto);

          const aeroportoOrigem = aeroportosOrigemDestino.find(a => a.codigo_icao === vooArr.aeroporto_origem_destino);
          const aeroportoDestino = aeroportosOrigemDestino.find(a => a.codigo_icao === formData.aeroporto_origem_destino);
          const aeroportoOp = aeroportos.find(a => a.codigo_icao === formData.aeroporto_operacao);
          const isInternacional = (aeroportoOrigem && aeroportoOrigem.pais !== 'AO') ||
                                  (aeroportoDestino && aeroportoDestino.pais !== 'AO') ||
                                  (aeroportoOp && aeroportoOp.pais !== 'AO');
          // Permanência mínima entre a chegada e a partida (turnaround). Doméstico reduzido de 20 para 10 min a
          // 13/10/2026 (operadores com turnaround curto não conseguiam lançar os voos). Internacional mantém 30 min.
          const minMinutos = isInternacional ? 30 : 10;
          const tipoLabel = isInternacional ? t('formVoo.tipoInternacional') : t('formVoo.tipoDomestico');

          if (formData.horario_previsto) {
            const dateTimeDepPrevisto = createDateTime(formData.data_operacao, formData.horario_previsto, formData.horario_previsto);
            if (dateTimeArr && dateTimeDepPrevisto && dateTimeDepPrevisto <= dateTimeArr) {
              newErrors.horario_previsto = `${t('formVoo.erroHorarioPrevistoAnterior')} (${horarioArrReal}).`;
            } else if (dateTimeArr && dateTimeDepPrevisto) {
              const diffMin = (dateTimeDepPrevisto - dateTimeArr) / 60000;
              if (diffMin < minMinutos) {
                newErrors.horario_previsto = `${t('formVoo.erroPermMinima1')} ${tipoLabel} ${t('formVoo.erroPermMinima2')} ${minMinutos} ${t('formVoo.erroPermMinima3')} ${Math.round(diffMin)} min.`;
              }
            }
          }

          if (formData.horario_real) {
            const dateTimeDepReal = createDateTime(formData.data_operacao, formData.horario_real, formData.horario_previsto);
            if (dateTimeArr && dateTimeDepReal && dateTimeDepReal <= dateTimeArr) {
              newErrors.horario_real = `${t('formVoo.erroHorarioRealAnterior')} (${horarioArrReal}).`;
            } else if (dateTimeArr && dateTimeDepReal) {
              const diffMin = (dateTimeDepReal - dateTimeArr) / 60000;
              if (diffMin < minMinutos) {
                newErrors.horario_real = `${t('formVoo.erroPermMinima1')} ${tipoLabel} ${t('formVoo.erroPermMinima2')} ${minMinutos} ${t('formVoo.erroPermMinima3')} ${Math.round(diffMin)} min.`;
              }
            }
          }
        }
      }

      if (!formData.numero_voo) newErrors.numero_voo = t('formVoo.erroNumeroVooObrigatorio');
      if (!formData.aeroporto_origem_destino) newErrors.aeroporto_origem_destino = t('formVoo.erroAeroportoDestinoObrigatorio');

      if (formData.registo_alterado) {
        if (!formData.registo_dep) {
          newErrors.registo_dep = t('formVoo.erroRegistoDepObrigatorio');
        } else {
          const arrVoo = arrCandidatos.find(v => v.id === linkedArrVooId);
          if (arrVoo && formData.registo_dep === arrVoo.registo_aeronave) {
            newErrors.registo_dep = t('formVoo.erroRegistoDepIgualArr');
          }
        }
      }
    } else {
      if (!formData.numero_voo) newErrors.numero_voo = t('formVoo.erroNumeroVooObrigatorio');
      if (!formData.companhia_aerea) newErrors.companhia_aerea = t('formVoo.erroCompanhiaObrigatoria');
      if (!formData.aeroporto_operacao) newErrors.aeroporto_operacao = t('formVoo.erroAeroportoOperacaoObrigatorio');
      if (!formData.registo_aeronave) newErrors.registo_aeronave = t('formVoo.erroRegistoObrigatorio');
      if (!formData.aeroporto_origem_destino) newErrors.aeroporto_origem_destino = t('formVoo.erroAeroportoOrigemObrigatorio');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Submit ---
  const performSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsLoading(true);
    try {
      let registoToSubmit = formData.registo_aeronave;

      if (formData.registo_aeronave) {
        const normalized = normalizeAircraftRegistration(formData.registo_aeronave);
        if (!normalized) {
          setErrors((prev) => ({ ...prev, registo_aeronave: t('formVoo.erroFormatoRegistoInvalido') }));
          setIsLoading(false);
          return;
        }
        registoToSubmit = normalized;
      }

      let numeroVooToSubmit = formData.numero_voo;
      if (formData.numero_voo) {
        numeroVooToSubmit = normalizeFlightNumber(formData.numero_voo);
        if (!numeroVooToSubmit || numeroVooToSubmit.length === 0) {
          setErrors((prev) => ({ ...prev, numero_voo: t('formVoo.erroNumeroVooObrigatorioNorm') }));
          setIsLoading(false);
          return;
        }
      }

      const registoFinal = formData.registo_alterado && formData.registo_dep
        ? normalizeAircraftRegistration(formData.registo_dep) || formData.registo_dep
        : registoToSubmit;

      const { registo_dep: _registo_dep, registo_alterado: _registo_alterado, ...formDataClean } = formData;
      const vooDataToSubmit = {
        ...formDataClean,
        registo_aeronave: registoFinal,
        numero_voo: numeroVooToSubmit,
      };

      await onSubmit({
        vooData: vooDataToSubmit,
        linkedArrVooId: linkedArrVooId || null
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar voo:', error);
      const errorMessage = error?.message || '';
      if (errorMessage.includes('unique') || errorMessage.includes('duplicate') || errorMessage.includes('duplicado')) {
        setAlertInfo({ isOpen: true, type: 'error', title: t('formVoo.alertVooDuplicadoTitulo'), message: t('formVoo.alertVooDuplicadoMsg') });
      } else {
        setAlertInfo({ isOpen: true, type: 'error', title: t('formVoo.alertErroSalvarTitulo'), message: t('formVoo.alertErroSalvarMsg') });
      }
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  // Verificação AUTORITATIVA contra o banco no momento de salvar.
  // A lista em memória (`voos`) pode estar desatualizada (logo após outro
  // lançamento, ou em sessões paralelas), deixando duplicados passarem.
  // Esta consulta fresca pega esses casos.
  const checkDuplicateVooDB = useCallback(async () => {
    if (!formData.registo_aeronave || !formData.data_operacao || !formData.aeroporto_operacao || !formData.horario_previsto) return null;
    const horarioParaComparar = formData.horario_real || formData.horario_previsto;
    const dateTimeAtual = createDateTime(formData.data_operacao, horarioParaComparar, formData.horario_previsto);
    if (!dateTimeAtual) return null;
    let candidatos = [];
    try {
      candidatos = await Voo.filter({
        registo_aeronave: formData.registo_aeronave,
        tipo_movimento: formData.tipo_movimento,
        aeroporto_operacao: formData.aeroporto_operacao,
        data_operacao: formData.data_operacao,
        deleted_at: null,
      });
    } catch (e) {
      console.error('Erro na verificação de duplicado (BD):', e);
      return null;
    }
    const match = (candidatos || []).find((voo) => {
      if (vooInicial && voo.id === vooInicial.id) return false;
      const vooHorario = voo.horario_real || voo.horario_previsto;
      const dt = createDateTime(voo.data_operacao, vooHorario, voo.horario_previsto);
      if (!dt) return false;
      return Math.abs(differenceInMinutes(dateTimeAtual, dt)) <= DUPLICATE_TOLERANCE_MINUTES;
    });
    if (!match) return null;
    return {
      voo: match,
      message: `${t('formVoo.avisoVooDuplicado1')} ${match.tipo_movimento} ${t('formVoo.avisoVooDuplicado2')} ${match.registo_aeronave} ${t('formVoo.avisoVooDuplicado3')} ${match.aeroporto_operacao} ${t('formVoo.avisoVooDuplicado4')} ${match.data_operacao} ${t('formVoo.avisoVooDuplicado5')} ${match.horario_real || match.horario_previsto} (${t('formVoo.avisoVooDuplicado6')} ${match.numero_voo}). ${t('formVoo.avisoVooDuplicado7')}`
    };
  }, [formData, vooInicial, t]);

  // Aviso de "chegada em aberto": um aviao nao pode CHEGAR de novo sem ter PARTIDO.
  // Ao lancar uma ARR, se o ultimo movimento dessa matricula (antes desta data/hora)
  // for uma CHEGADA ainda SEM partida (voo_ligado_id nulo), avisa — provavel partida
  // nao lancada ou chegada duplicada. (Causa raiz de ~518 chegadas penduradas.)
  const checkOpenArrivalDB = useCallback(async () => {
    if (formData.tipo_movimento !== 'ARR') return null;
    if (!formData.registo_aeronave || !formData.data_operacao) return null;
    const hAtual = formData.horario_real || formData.horario_previsto || '23:59';
    let anteriores = [];
    try {
      anteriores = await Voo.filter({
        registo_aeronave: formData.registo_aeronave,
        deleted_at: null,
        data_operacao: { $lte: formData.data_operacao },
      }, '-data_operacao', 30);
    } catch (e) {
      console.error('Erro na verificacao de chegada em aberto:', e);
      return null;
    }
    const ultimo = (anteriores || [])
      .filter((v) => !(vooInicial && v.id === vooInicial.id))
      .map((v) => ({ v, key: `${v.data_operacao}T${v.horario_real || v.horario_previsto || '00:00'}` }))
      .filter((x) => x.key < `${formData.data_operacao}T${hAtual}`)
      .sort((a, b) => b.key.localeCompare(a.key))[0]?.v;
    if (!ultimo) return null;
    if (ultimo.tipo_movimento === 'ARR' && !ultimo.voo_ligado_id) {
      return {
        voo: ultimo,
        message: `${formData.registo_aeronave} ja tem uma CHEGADA em ${ultimo.data_operacao}${ultimo.numero_voo ? ` (${ultimo.numero_voo})` : ''} ainda SEM PARTIDA registada. Um aviao nao chega duas vezes sem partir — verifique se falta lancar a PARTIDA dessa visita, ou se esta chegada e duplicada.`,
      };
    }
    return null;
  }, [formData, vooInicial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Aviso em memória; se não houver, faz a verificação autoritativa no banco.
    // Inclui o aviso de "chegada em aberto" (aviao nao pode chegar 2x sem partir).
    const aviso = duplicateWarning || await checkDuplicateVooDB() || await checkOpenArrivalDB();

    if (aviso && setAlertInfo) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: t('formVoo.alertDuplicidadeTitulo'),
        message: `${aviso.message}\n\n${t('formVoo.alertDuplicidadeConfirmar')}`,
        showCancel: true,
        confirmText: t('formVoo.alertDuplicidadeConfirmarBtn'),
        onConfirm: async () => {
          setAlertInfo(prev => ({ ...prev, isOpen: false }));
          await performSave();
        }
      });
      return;
    }

    await performSave();
  };

  // --- Options ---
  const aeroportoOperacaoOptions = useMemo(() => {
    return aeroportosAcesso.map((a) => ({ value: a.codigo_icao, label: `${a.codigo_icao} — ${a.nome}` }));
  }, [aeroportosAcesso]);

  const aeroportoOrigemDestinoOptions = useMemo(() => {
    if (!Array.isArray(aeroportosOrigemDestino)) return [];
    return aeroportosOrigemDestino.map((a) => ({
      value: a.codigo_icao,
      label: `${a.codigo_icao} - ${a.nome}`,
      displayLabel: a.codigo_icao
    }));
  }, [aeroportosOrigemDestino]);

  const tipoMovimentoOptions = [
    { value: 'ARR', label: t('formVoo.tipoMovChegada') },
    { value: 'DEP', label: t('formVoo.tipoMovPartida') }
  ];

  const tipoVooOptions = [
    { value: 'Regular', label: t('formVoo.tipoVooRegular') },
    { value: 'Não Regular', label: t('formVoo.tipoVooNaoRegular') },
    { value: 'Humanitário', label: t('formVoo.tipoVooHumanitario') },
    { value: 'Charter', label: t('formVoo.tipoVooCharter') },
    { value: 'Carga', label: t('formVoo.tipoVooCarga') },
    { value: 'Privado', label: t('formVoo.tipoVooPrivado') },
    { value: 'Militar', label: t('formVoo.tipoVooMilitar') },
    { value: 'Oficial', label: t('formVoo.tipoVooOficial') },
    { value: 'Técnico', label: t('formVoo.tipoVooTecnico') },
    { value: 'Outro', label: t('formVoo.tipoVooOutro') }
  ];

  const statusOptions = [
    { value: 'Programado', label: t('formVoo.statusProgramado') },
    { value: 'Realizado', label: t('formVoo.statusRealizado') },
    { value: 'Cancelado', label: t('formVoo.statusCancelado') }
  ];

  const voosArrOptions = useMemo(() => [
    { value: '', label: t('formVoo.selecioneVooChegada') },
    ...voosArrDisponíveis.map((voo) => ({
      value: voo.id,
      label: `${voo.numero_voo} (${voo.registo_aeronave || 'N/A'}) - ${voo.data_operacao} ${voo.horario_previsto}${voo.horario_real ? ` (${voo.horario_real})` : ''} - ${voo.aeroporto_origem_destino} → ${voo.aeroporto_operacao}`
    }))],
    [voosArrDisponíveis]
  );

  // --- Render ---
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vooInicial ? t('formVoo.editarVoo') : t('formVoo.novoVoo')}
          </DialogTitle>
        </DialogHeader>

        {duplicateWarning && (
          <Alert className="border-yellow-300 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">
              <strong>{t('formVoo.possívelDuplicidade')}:</strong> {duplicateWarning.message}
            </AlertDescription>
          </Alert>
        )}

        {militaryWarning && (
          <Alert className={militaryWarning.type === 'warning' ? 'border-orange-300 bg-orange-50' : 'border-blue-300 bg-blue-50'}>
            <AlertTriangle className={`h-4 w-4 ${militaryWarning.type === 'warning' ? 'text-orange-600' : 'text-blue-600'}`} />
            <AlertDescription className={`text-sm ${militaryWarning.type === 'warning' ? 'text-orange-800' : 'text-blue-800'}`}>
              {militaryWarning.message}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {formData.tipo_movimento === 'ARR' &&
            <ArrivalSection
              formData={formData}
              errors={errors}
              onChange={handleInputChange}
              tipoMovimentoOptions={tipoMovimentoOptions}
              statusOptions={statusOptions}
              tipoVooOptions={tipoVooOptions}
              aeroportoOperacaoOptions={aeroportoOperacaoOptions}
              aeroportoOrigemDestinoOptions={aeroportoOrigemDestinoOptions}
              aeroportosAcesso={aeroportosAcesso}
              vooInicial={vooInicial}
              searchCompanhias={searchCompanhias}
              getCompanhiaInicial={getCompanhiaInicial}
              searchRegistos={searchRegistos}
              getRegistoInicial={getRegistoInicial}
              onShowCreateCompanhia={() => setShowCreateCompanhia(true)}
              onShowCreateRegisto={() => setShowCreateRegisto(true)}
              onShowCreateAeroporto={() => setShowCreateAeroporto(true)}
            />
          }

          {formData.tipo_movimento === 'DEP' &&
            <DepartureSection
              formData={formData}
              errors={errors}
              onChange={handleInputChange}
              tipoMovimentoOptions={tipoMovimentoOptions}
              statusOptions={statusOptions}
              tipoVooOptions={tipoVooOptions}
              voosArrOptions={voosArrOptions}
              linkedArrVooId={linkedArrVooId}
              onLinkedVooChange={handleLinkedVooChange}
              horarioMinimoDep={horarioMinimoDep}
              voos={voos}
              searchRegistos={searchRegistos}
              getRegistoInicial={getRegistoInicial}
              searchAeroportos={searchAeroportos}
              getAeroportoInicial={getAeroportoInicial}
              onShowCreateAeroporto={() => setShowCreateAeroporto(true)}
            />
          }

          {(formData.tipo_movimento === 'ARR' || formData.tipo_movimento === 'DEP') &&
            <PassengersSection formData={formData} onChange={handleInputChange} />
          }

          {(formData.tipo_movimento === 'ARR' || formData.tipo_movimento === 'DEP') &&
            <BaggageSection formData={formData} onChange={handleInputChange} />
          }
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading || isSubmitting}>
              {t('formVoo.cancelar')}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isLoading || isSubmitting ? t('formVoo.salvando') : vooInicial ? t('formVoo.atualizarVoo') : t('formVoo.criarVoo')}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modais para criacao rapida */}
      <Dialog open={showCreateAeroporto} onOpenChange={setShowCreateAeroporto}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('formVoo.adicionarNovoAeroporto')}</DialogTitle>
          </DialogHeader>
          <FormAeroporto onSave={handleCreateAeroporto} onCancel={() => setShowCreateAeroporto(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateCompanhia} onOpenChange={setShowCreateCompanhia}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('formVoo.adicionarNovaCompanhia')}</DialogTitle>
          </DialogHeader>
          <FormCompanhia onSave={handleCreateCompanhia} onCancel={() => setShowCreateCompanhia(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateRegisto} onOpenChange={setShowCreateRegisto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('formVoo.adicionarNovoRegisto')}</DialogTitle>
          </DialogHeader>
          <FormRegisto
            onSave={handleCreateRegisto}
            onCancel={() => setShowCreateRegisto(false)}
            modelos={modelos}
            companhias={companhias}
            initialCompanhiaIcao={formData.companhia_aerea}
          />
        </DialogContent>
      </Dialog>
    </Dialog>);
}
