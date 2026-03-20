import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import Combobox from '@/components/ui/combobox';
import AsyncCombobox from '@/components/ui/async-combobox';
import { Plus, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { normalizeAircraftRegistration, normalizeFlightNumber, createDateTime } from '@/components/lib/utils';
import { notifyAdminsCreation } from '@/components/lib/notificacoes';
import { getAeroportosPermitidos, isSuperAdmin } from '@/components/lib/userUtils';
import { differenceInMinutes } from 'date-fns';
import { useI18n } from '@/components/lib/i18n';

// Importar entidades corretas
import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { RegistoAeronave } from '@/entities/RegistoAeronave';

// Importar os formulários COMPLETOS
import { FormAeroporto } from './config/AeroportosConfig';
import { FormCompanhia } from './config/CompanhiasConfig';
import { FormRegisto } from './config/RegistosAeronaveConfig';

// Intervalo de tolerância para considerar voos duplicados (em minutos)
const DUPLICATE_TOLERANCE_MINUTES = 15;

// Cache de companhias (módulo-level, carregado uma vez)
let _companhiasCache = null;
let _companhiasCacheLoading = null;
async function loadCompanhiasCache() {
  if (_companhiasCache) return _companhiasCache;
  if (_companhiasCacheLoading) return _companhiasCacheLoading;
  _companhiasCacheLoading = CompanhiaAerea.list().then(data => {
    _companhiasCache = Array.isArray(data) ? data : [];
    _companhiasCacheLoading = null;
    return _companhiasCache;
  }).catch(() => {
    _companhiasCacheLoading = null;
    return [];
  });
  return _companhiasCacheLoading;
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
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevenir múltiplos submits
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [militaryWarning, setMilitaryWarning] = useState(null); // Novo estado para aviso militar

  // States para modais de criação rápida
  const [showCreateAeroporto, setShowCreateAeroporto] = useState(false);
  const [showCreateCompanhia, setShowCreateCompanhia] = useState(false);
  const [showCreateRegisto, setShowCreateRegisto] = useState(false);

  const [linkedArrVooId, setLinkedArrVooId] = useState('');

  // Lista de companhias militares/oficiais
  const MILITARY_COMPANIES = ['FANA', 'MINDEF'];

  // Função para verificar se a companhia é militar
  const isMilitaryCompany = (companhiaIcao) => {
    return MILITARY_COMPANIES.includes(companhiaIcao?.toUpperCase());
  };

  // Função para verificar inconsistências entre companhia e tipo de voo
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

  // Verificar consistência quando companhia ou tipo de voo mudar
  useEffect(() => {
    checkMilitaryConsistency();
  }, [checkMilitaryConsistency]);

  // Aeroportos que o usuário tem acesso (empresa-based)
  // O prop "aeroportos" já vem filtrado por empresa/acesso do Operacoes.jsx
  const aeroportosAcesso = useMemo(() => {
    if (!currentUser || !Array.isArray(aeroportos)) {
      return [];
    }

    const permitidos = getAeroportosPermitidos(currentUser, aeroportos);
    // Para admin/superadmin: preferir SGA, mas usar todos os permitidos se nenhum tem isSGA
    if (isSuperAdmin(currentUser) || (currentUser.role === 'admin' || (currentUser.perfis && currentUser.perfis.includes('administrador')))) {
      const sgaAeroportos = permitidos.filter((a) => a.isSGA === true);
      // Se não há aeroportos com isSGA, usar todos os permitidos (já filtrados por empresa)
      const baseList = sgaAeroportos.length > 0 ? sgaAeroportos : permitidos;
      // Se editando, garantir que o aeroporto do voo está incluído
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

  // Auto-selecionar aeroporto se o usuário tem acesso a apenas um
  useEffect(() => {
    if (aeroportosAcesso.length === 1 && !formData.aeroporto_operacao) {
      setFormData((prev) => ({
        ...prev,
        aeroporto_operacao: aeroportosAcesso[0].codigo_icao
      }));
    }
  }, [aeroportosAcesso, formData.aeroporto_operacao]);

  // Função para verificar duplicidade de voo
  const checkDuplicateVoo = useCallback(() => {
    // Só verificar se os campos essenciais estiverem preenchidos
    if (!formData.registo_aeronave || !formData.data_operacao || !formData.aeroporto_operacao || !formData.horario_previsto) {
      setDuplicateWarning(null);
      return;
    }

    // Horário a ser usado para comparação (priorizar horário real se existir)
    const horarioParaComparar = formData.horario_real || formData.horario_previsto;

    // Criar datetime completo para o voo atual
    const dateTimeAtual = createDateTime(formData.data_operacao, horarioParaComparar, formData.horario_previsto);
    
    if (!dateTimeAtual) {
      setDuplicateWarning(null);
      return;
    }

    // Filtrar voos que tenham os mesmos campos base
    const potentialDuplicates = voos.filter(voo => {
      // Não comparar com o próprio voo se estiver editando
      if (vooInicial && voo.id === vooInicial.id) {
        return false;
      }

      // Mesma matrícula, tipo de movimento e aeroporto
      if (
        voo.registo_aeronave === formData.registo_aeronave &&
        voo.tipo_movimento === formData.tipo_movimento &&
        voo.aeroporto_operacao === formData.aeroporto_operacao
      ) {
        // Verificar se o horário está dentro do intervalo de tolerância
        const vooHorario = voo.horario_real || voo.horario_previsto;
        
        try {
          // Criar datetime completo para o voo existente
          const dateTimeVooExistente = createDateTime(voo.data_operacao, vooHorario, voo.horario_previsto);
          
          if (!dateTimeVooExistente) return false;
          
          const diffMinutos = Math.abs(differenceInMinutes(dateTimeAtual, dateTimeVooExistente));
          
          return diffMinutos <= DUPLICATE_TOLERANCE_MINUTES;
        } catch (error) {
          console.error('Erro ao comparar horários:', error);
          return false;
        }
      }

      return false;
    });

    if (potentialDuplicates.length > 0) {
      const duplicateVoo = potentialDuplicates[0];
      setDuplicateWarning({
        voo: duplicateVoo,
        message: `${t('formVoo.avisoVooDuplicado1')} ${duplicateVoo.tipo_movimento} ${t('formVoo.avisoVooDuplicado2')} ${duplicateVoo.registo_aeronave} ${t('formVoo.avisoVooDuplicado3')} ${duplicateVoo.aeroporto_operacao} ${t('formVoo.avisoVooDuplicado4')} ${duplicateVoo.data_operacao} ${t('formVoo.avisoVooDuplicado5')} ${duplicateVoo.horario_real || duplicateVoo.horario_previsto} (${t('formVoo.avisoVooDuplicado6')} ${duplicateVoo.numero_voo}). ${t('formVoo.avisoVooDuplicado7')}`
      });
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.registo_aeronave, formData.data_operacao, formData.tipo_movimento, formData.aeroporto_operacao, formData.horario_previsto, formData.horario_real, voos, vooInicial]);

  // Acionar verificação de duplicidade quando campos relevantes mudarem
  useEffect(() => {
    checkDuplicateVoo();
  }, [checkDuplicateVoo, formData.registo_aeronave, formData.data_operacao, formData.tipo_movimento, formData.aeroporto_operacao, formData.horario_previsto, formData.horario_real]);


  // Pre-warm companhias cache when form opens
  useEffect(() => {
    if (isOpen) loadCompanhiasCache();
  }, [isOpen]);

  // Load data when editing or reset for new flight
  useEffect(() => {
    if (vooInicial && isOpen) {
      // Auto-corrigir tipo de voo se a companhia for militar
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
        combustivel_litros: vooInicial.combustivel_litros || 0
      });

      // If editing a DEP flight, check if it's already linked
      if (vooInicial.tipo_movimento === 'DEP') {
        const existingLink = voosLigados.find((vl) => vl.id_voo_dep === vooInicial.id);
        if (existingLink) {
          setLinkedArrVooId(existingLink.id_voo_arr);
          // Carregar dados de troca de registo se existir
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
      // Reset form for new flight
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
    setMilitaryWarning(null); // Clear military warning on form load/reset
  }, [vooInicial, isOpen, tipoMovimento, voosLigados, aeroportosAcesso]);

  // Buscar voos ARR disponíveis para vincular
  const voosArrDisponíveis = useMemo(() => {
    if (formData.tipo_movimento !== 'DEP') return [];
    if (!formData.data_operacao) return [];

    const depDate = new Date(formData.data_operacao);
    const depTime = formData.horario_real || formData.horario_previsto;

    let filteredVoos = voos.filter((voo) => {
      if (voo.tipo_movimento !== 'ARR' || voo.status === 'Cancelado') {
        return false;
      }

      const arrDate = new Date(voo.data_operacao);
      
      // Calcular diferença em dias
      const diffDays = Math.floor((depDate.getTime() - arrDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Voo ARR deve ser anterior ou no mesmo dia do DEP (sem limite de dias)
      if (diffDays < 0) {
        return false;
      }

      // Se for no mesmo dia E tiver horário DEP definido, ARR deve ser antes
      if (diffDays === 0 && depTime) {
        const arrTime = voo.horario_real || voo.horario_previsto;
        if (arrTime >= depTime) {
          return false;
        }
      }

      return true;
    });

    // Excluir voos já ligados (exceto se for edição)
    const currentLinkedArrId = vooInicial?.id ?
      voosLigados.find((vl) => vl.id_voo_dep === vooInicial.id)?.id_voo_arr :
      null;

    const voosJaLigadosExcludingCurrent = new Set(
      voosLigados
        .filter((vl) => vl.id_voo_dep !== vooInicial?.id)
        .map((vl) => vl.id_voo_arr)
    );

    return filteredVoos
      .filter((voo) => !voosJaLigadosExcludingCurrent.has(voo.id) || voo.id === currentLinkedArrId)
      .sort((a, b) => {
        // Ordenar por data e hora, mais recentes primeiro
        const dateA = `${a.data_operacao}T${a.horario_real || a.horario_previsto}`;
        const dateB = `${b.data_operacao}T${b.horario_real || b.horario_previsto}`;
        return dateB.localeCompare(dateA); 
      });
  }, [voos, formData.tipo_movimento, formData.data_operacao, formData.horario_real, formData.horario_previsto, voosLigados, vooInicial]);

  // Calcular horário mínimo apenas para DEP (baseado no voo ARR ligado)
  const horarioMinimoDep = useMemo(() => {
    if (formData.tipo_movimento === 'DEP' && linkedArrVooId) {
      const arrVoo = voos.find((v) => v.id === linkedArrVooId);
      if (arrVoo) {
        return arrVoo.horario_real || arrVoo.horario_previsto;
      }
    }
    return undefined;
  }, [formData.tipo_movimento, linkedArrVooId, voos]);

  const handleLinkedVooChange = (vooArrId) => {
    setLinkedArrVooId(vooArrId);

    // Clear error when user selects an option
    if (errors.linked_arr_voo) {
      setErrors((prev) => ({ ...prev, linked_arr_voo: '' }));
    }

    if (vooArrId) {
      const vooArr = voos.find((v) => v.id === vooArrId);
      if (vooArr) {
        // Pré-preencher campos com base no voo de chegada
        setFormData((prev) => ({
          ...prev,
          companhia_aerea: vooArr.companhia_aerea,
          registo_aeronave: vooArr.registo_aeronave,
          aeroporto_operacao: vooArr.aeroporto_operacao,
          // For DEP, aeroporto_origem_destino is the actual destination, not the ARR's origin.
          // Clear if it was auto-filled from the ARR's origin. Otherwise, keep user input.
          // This logic might need adjustment if users expect the destination to be copied from ARR's origin
          // for the *next* flight's origin, which is not what 'aeroporto_origem_destino' means for DEP.
          // The current outline implies this field is manually selected for DEP.
          // So, for DEP, we should NOT auto-fill aeroporto_origem_destino from ARR's origin/destination.
          // It should be cleared or left to user input. Clearing makes more sense here for DEP.
          aeroporto_origem_destino: '' // Clear destination for DEP when linking
        }));
      }
    } else {
      // Se desvincular, limpar campos automáticos
      setFormData((prev) => ({
        ...prev,
        companhia_aerea: '',
        registo_aeronave: '',
        aeroporto_operacao: '', // Limpar, já que não é mais auto-preenchido
        aeroporto_origem_destino: prev.tipo_movimento === 'DEP' ? '' : prev.aeroporto_origem_destino // Only clear destination if DEP
      }));
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      // Reset vinculação or auto-filled fields when relevant fields change
      if (field === 'companhia_aerea') {
        // Se mudou para uma companhia militar, auto-preencher tipo de voo
        if (isMilitaryCompany(value)) {
          newData.tipo_voo = 'Militar';
        }

        if (prev.tipo_movimento === 'DEP') {
          // If changing company on a DEP flight, it breaks the link
          setLinkedArrVooId('');
          newData.registo_aeronave = '';
          newData.aeroporto_operacao = '';
        } else {
          // ARR flight, changing company clears registration
          newData.registo_aeronave = '';
        }
      }

      if (field === 'tipo_movimento' && prev.tipo_movimento !== value) {
        setLinkedArrVooId(''); // Always clear linking when type changes
        newData.registo_aeronave = ''; // Clear registration
        newData.companhia_aerea = ''; // Clear company
        newData.aeroporto_origem_destino = ''; // Clear origin/destination
        newData.aeroporto_operacao = ''; // Clear operation airport

        // Auto-fill aeroporto_operacao if ARR and only one access airport
        if (value === 'ARR' && aeroportosAcesso.length === 1) {
          newData.aeroporto_operacao = aeroportosAcesso[0].codigo_icao;
        }
      }

      // If data_operacao changes, clear linkedArrVooId if it's a DEP flight,
      // as the available ARR flights might change.
      if (field === 'data_operacao' && prev.tipo_movimento === 'DEP') {
        setLinkedArrVooId('');
        newData.companhia_aerea = '';
        newData.registo_aeronave = '';
        newData.aeroporto_operacao = '';
        newData.aeroporto_origem_destino = '';
      }

      return newData;
    });

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Calculate total passengers automatically
  useEffect(() => {
    const total = (parseInt(formData.passageiros_local) || 0) + (
    parseInt(formData.passageiros_transito_transbordo) || 0) + (
    parseInt(formData.passageiros_transito_direto) || 0);

    if (total !== formData.passageiros_total) {
      setFormData((prev) => ({ ...prev, passageiros_total: total }));
    }
  }, [
  formData.passageiros_local,
  formData.passageiros_transito_transbordo,
  formData.passageiros_transito_direto,
  formData.passageiros_total]
  );

  // Calculate total bagagem automatically (ARR only — DEP edits bagagem_total directly)
  useEffect(() => {
    if (formData.tipo_movimento === 'ARR') {
      const total = (parseInt(formData.bagagem_local) || 0) +
        (parseInt(formData.bagagem_transito_transbordo) || 0) +
        (parseInt(formData.bagagem_transito_direto) || 0);
      if (total !== formData.bagagem_total) {
        setFormData((prev) => ({ ...prev, bagagem_total: total }));
      }
    }
  }, [
    formData.tipo_movimento,
    formData.bagagem_local,
    formData.bagagem_transito_transbordo,
    formData.bagagem_transito_direto,
    formData.bagagem_total
  ]);

  const validate = () => {
    const newErrors = {};

    if (!formData.data_operacao) newErrors.data_operacao = t('formVoo.erroDataObrigatoria');
    if (!formData.horario_previsto) newErrors.horario_previsto = t('formVoo.erroHorarioPrevistoObrigatorio');

    // REMOVIDA: Validação que impedia horário real anterior ao previsto (voos podem antecipar)
    // Agora permitimos que o horário real seja antes do previsto

    if (formData.tipo_movimento === 'DEP') {
      if (!linkedArrVooId) {
        newErrors.linked_arr_voo = t('formVoo.erroVinculoChegadaObrigatorio');
      }

      // Validação crítica: Horários DEP não podem ser anteriores OU IGUAIS aos horários ARR
      if (linkedArrVooId) {
        const vooArr = voos.find((v) => v.id === linkedArrVooId);
        if (vooArr) {
          const horarioArrReal = vooArr.horario_real || vooArr.horario_previsto;

          // Criar datetimes completos para comparação precisa
          const dateTimeArr = createDateTime(vooArr.data_operacao, horarioArrReal, vooArr.horario_previsto);
          
          // Determinar tipo de operação para tempo mínimo
          const aeroportoOrigem = aeroportosOrigemDestino.find(a => a.codigo_icao === vooArr.aeroporto_origem_destino);
          const aeroportoDestino = aeroportosOrigemDestino.find(a => a.codigo_icao === formData.aeroporto_origem_destino);
          const aeroportoOp = aeroportos.find(a => a.codigo_icao === formData.aeroporto_operacao);
          const isInternacional = (aeroportoOrigem && aeroportoOrigem.pais !== 'AO') ||
                                  (aeroportoDestino && aeroportoDestino.pais !== 'AO') ||
                                  (aeroportoOp && aeroportoOp.pais !== 'AO');
          const minMinutos = isInternacional ? 30 : 20;
          const tipoLabel = isInternacional ? t('formVoo.tipoInternacional') : t('formVoo.tipoDomestico');

          // Validar horário previsto DEP
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

          // Validar horário real DEP (se preenchido)
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

      // Validação troca de registo
      if (formData.registo_alterado) {
        if (!formData.registo_dep) {
          newErrors.registo_dep = t('formVoo.erroRegistoDepObrigatorio');
        } else {
          const arrVoo = voos.find(v => v.id === linkedArrVooId);
          if (arrVoo && formData.registo_dep === arrVoo.registo_aeronave) {
            newErrors.registo_dep = t('formVoo.erroRegistoDepIgualArr');
          }
        }
      }

    } else {// ARR flight
      if (!formData.numero_voo) newErrors.numero_voo = t('formVoo.erroNumeroVooObrigatorio');
      if (!formData.companhia_aerea) newErrors.companhia_aerea = t('formVoo.erroCompanhiaObrigatoria');
      if (!formData.aeroporto_operacao) newErrors.aeroporto_operacao = t('formVoo.erroAeroportoOperacaoObrigatorio');
      if (!formData.registo_aeronave) newErrors.registo_aeronave = t('formVoo.erroRegistoObrigatorio');
      if (!formData.aeroporto_origem_destino) newErrors.aeroporto_origem_destino = t('formVoo.erroAeroportoOrigemObrigatorio');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const performSave = async () => {
    // Prevenir múltiplas submissões
    if (isSubmitting) return;

    setIsSubmitting(true);
    setIsLoading(true);
    try {
      let registoToSubmit = formData.registo_aeronave;

      // Normalizar registo da aeronave se presente
      if (formData.registo_aeronave) {
        const normalized = normalizeAircraftRegistration(formData.registo_aeronave);
        if (!normalized) {
          // If normalization returns null/undefined for a non-empty string, it's invalid format.
          setErrors((prev) => ({ ...prev, registo_aeronave: t('formVoo.erroFormatoRegistoInvalido') }));
          setIsLoading(false);
          return;
        }
        registoToSubmit = normalized;
      }

      // Normalizar número do voo
      let numeroVooToSubmit = formData.numero_voo;
      if (formData.numero_voo) {
        numeroVooToSubmit = normalizeFlightNumber(formData.numero_voo);
        
        if (!numeroVooToSubmit || numeroVooToSubmit.length === 0) {
          setErrors((prev) => ({ ...prev, numero_voo: t('formVoo.erroNumeroVooObrigatorioNorm') }));
          setIsLoading(false);
          return;
        }
      }

      // Se houve troca de registo, usar o registo DEP
      const registoFinal = formData.registo_alterado && formData.registo_dep
        ? normalizeAircraftRegistration(formData.registo_dep) || formData.registo_dep
        : registoToSubmit;

      // Remove campos internos que não existem na tabela voo (até migration ser executada)
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
      
      // Verificar se é erro de duplicação da constraint
      const errorMessage = error?.message || '';
      if (errorMessage.includes('unique') || errorMessage.includes('duplicate') || errorMessage.includes('duplicado')) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('formVoo.alertVooDuplicadoTitulo'),
          message: t('formVoo.alertVooDuplicadoMsg')
        });
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('formVoo.alertErroSalvarTitulo'),
          message: t('formVoo.alertErroSalvarMsg')
        });
      }
    } finally {
      setIsLoading(false);
      setIsSubmitting(false); // Reabilitar submissão após conclusão
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    // Se houver aviso de duplicidade, pedir confirmação antes de salvar
    if (duplicateWarning) {
      if (setAlertInfo) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: t('formVoo.alertDuplicidadeTitulo'),
          message: `${duplicateWarning.message}\n\n${t('formVoo.alertDuplicidadeConfirmar')}`,
          showCancel: true,
          confirmText: t('formVoo.alertDuplicidadeConfirmarBtn'),
          onConfirm: async () => {
            setAlertInfo(prev => ({ ...prev, isOpen: false }));
            await performSave();
          }
        });
      }
      return;
    }

    await performSave();
  };

  // Handlers para criação com formulários completos
  const handleCreateAeroporto = async (data) => {
    try {
      // Normalizar e validar código ICAO
      const codigoIcaoNormalizado = data.codigo_icao?.trim().toUpperCase();
      
      // Verificar duplicados - normalizar código ICAO para comparação
      const aeroportoExistente = aeroportosOrigemDestino.find(
        (a) => a.codigo_icao?.trim().toUpperCase() === codigoIcaoNormalizado
      );

      if (aeroportoExistente) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: t('formVoo.alertAeroportoDuplicadoTitulo'),
          message: `${t('formVoo.alertAeroportoDuplicadoMsg1')} "${data.codigo_icao}". ${t('formVoo.alertNome')} ${aeroportoExistente.nome}.`
        });
        return;
      }

      // Validar e normalizar país para código ISO de 2 letras
      let paisCode = data.pais?.trim().toUpperCase();
      
      // Se o utilizador digitou o nome completo, tentar converter
      if (paisCode && paisCode.length > 2) {
        const paisMapping = {
          'ANGOLA': 'AO',
          'PORTUGAL': 'PT',
          'BRASIL': 'BR',
          'SOUTH AFRICA': 'ZA',
          'NAMIBIA': 'NA',
          'ZAMBIA': 'ZM',
          'CONGO': 'CG',
          'DRC': 'CD' // Democratic Republic of Congo
        };
        
        paisCode = paisMapping[paisCode] || paisCode.substring(0, 2); // Fallback to first 2 chars if not in map
      }
      
      if (!paisCode || paisCode.length !== 2) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('formVoo.alertPaisInvalidoTitulo'),
          message: t('formVoo.alertPaisInvalidoMsg')
        });
        return;
      }

      // Atualizar dados com país normalizado
      const dataToSave = {
        ...data,
        codigo_icao: codigoIcaoNormalizado,
        pais: paisCode
      };

      const novoAeroporto = await Aeroporto.create(dataToSave);

      // Notificar administradores
      setTimeout(() => {
        notifyAdminsCreation('aeroporto', novoAeroporto, currentUser);
      }, 100);

      // Atualização otimizada - não recarregar tudo
      if (onRefreshData) {
        // Usar setTimeout para não bloquear a UI
        setTimeout(() => onRefreshData(['aeroportos']), 50);
      }

      if (!formData.aeroporto_origem_destino) {
        setFormData((prev) => ({ ...prev, aeroporto_origem_destino: novoAeroporto.codigo_icao }));
      }

      setShowCreateAeroporto(false);
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: t('formVoo.alertAeroportoCriadoTitulo'),
        message: `${t('formVoo.alertAeroportoCriadoMsg1')} "${novoAeroporto.nome}" ${t('formVoo.alertCriadoSucesso')}`
      });
    } catch (error) {
      console.error('Erro ao criar aeroporto:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('formVoo.alertErroAeroportoTitulo'),
        message: error.message || t('formVoo.alertErroAeroportoMsg')
      });
    }
  };

  const handleCreateCompanhia = async (data) => {
    try {
      // Normalizar código ICAO
      const codigoIcaoNormalizado = data.codigo_icao?.trim().toUpperCase();
      
      // Verificar duplicados
      const companhiaExistente = companhias.find(
        (c) => c.codigo_icao?.trim().toUpperCase() === codigoIcaoNormalizado
      );

      if (companhiaExistente) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: t('formVoo.alertCompanhiaDuplicadaTitulo'),
          message: `${t('formVoo.alertCompanhiaDuplicadaMsg1')} "${data.codigo_icao}". ${t('formVoo.alertNome')} ${companhiaExistente.nome}.`
        });
        return;
      }

      const novaCompanhia = await CompanhiaAerea.create(data);

      // Notificar administradores
      setTimeout(() => {
        notifyAdminsCreation('companhia', novaCompanhia, currentUser);
      }, 100);

      // Atualização otimizada
      if (onRefreshData) {
        setTimeout(() => onRefreshData(['companhias']), 50);
      }

      setFormData((prev) => ({
        ...prev,
        companhia_aerea: novaCompanhia.codigo_icao,
        registo_aeronave: ''
      }));
      setShowCreateCompanhia(false);
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: t('formVoo.alertCompanhiaCriadaTitulo'),
        message: `${t('formVoo.alertCompanhiaCriadaMsg1')} "${novaCompanhia.nome}" ${t('formVoo.alertCriadoSucesso')}`
      });
    } catch (error) {
      console.error('Erro ao criar companhia:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('formVoo.alertErroCompanhiaTitulo'),
        message: t('formVoo.alertErroCompanhiaMsg')
      });
    }
  };

  const handleCreateRegisto = async (data) => {
    try {
      // Normalizar registo
      const registoNormalizado = normalizeAircraftRegistration(data.registo);
      
      if (!registoNormalizado) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('formVoo.alertFormatoInvalidoTitulo'),
          message: t('formVoo.alertFormatoRegistoMsg')
        });
        return;
      }

      // Verificar duplicados
      const registoExistente = aeronaves.find(
        (r) => normalizeAircraftRegistration(r.registo) === registoNormalizado
      );

      if (registoExistente) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: t('formVoo.alertRegistoDuplicadoTitulo'),
          message: `${t('formVoo.alertRegistoDuplicadoMsg')} "${data.registo}".`
        });
        return;
      }

      // Criar com registo normalizado
      const dataToSave = {
        ...data,
        registo: registoNormalizado
      };

      const novoRegisto = await RegistoAeronave.create({ ...dataToSave, empresa_id: currentUser?.empresa_id });

      // Notificar administradores
      setTimeout(() => {
        notifyAdminsCreation('registo', novoRegisto, currentUser);
      }, 100);

      // Atualização otimizada
      if (onRefreshData) {
        setTimeout(() => onRefreshData(['aeronaves']), 50);
      }

      setFormData((prev) => ({ ...prev, registo_aeronave: novoRegisto.registo }));
      setShowCreateRegisto(false);
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: t('formVoo.alertRegistoCriadoTitulo'),
        message: `${t('formVoo.alertRegistoCriadoMsg1')} "${novoRegisto.registo}" ${t('formVoo.alertCriadoSucesso')}`
      });
    } catch (error) {
      console.error('Erro ao criar registo:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('formVoo.alertErroRegistoTitulo'),
        message: t('formVoo.alertErroRegistoMsg')
      });
    }
  };

  // Prepare options for selects with safety checks
  const aeroportoOperacaoOptions = useMemo(() => {
    return aeroportosAcesso.map((a) => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }));
  }, [aeroportosAcesso]);

  const aeroportoOrigemDestinoOptions = useMemo(() => {
    if (!Array.isArray(aeroportosOrigemDestino)) return [];
    return aeroportosOrigemDestino.map((a) => ({
      value: a.codigo_icao,
      label: `${a.codigo_icao} - ${a.nome}`, // Label completo no dropdown
      displayLabel: a.codigo_icao // Label simplificado quando selecionado
    }));
  }, [aeroportosOrigemDestino]);


  // Funções para lazy loading de companhias
  const searchCompanhias = async (searchTerm) => {
    try {
      if (!searchTerm || searchTerm.length < 2) return [];

      const allCompanhias = await loadCompanhiasCache();

      const searchLower = searchTerm.toLowerCase();
      return allCompanhias
        .filter(c =>
          c && (
            c.nome?.toLowerCase().includes(searchLower) ||
            c.codigo_icao?.toLowerCase().includes(searchLower) ||
            c.codigo_iata?.toLowerCase().includes(searchLower)
          )
        )
        .slice(0, 50)
        .map(c => ({
          value: c.codigo_icao || '',
          label: `${c.nome || 'Sem nome'} (${c.codigo_icao || 'N/A'})`
        }));
    } catch (err) {
      console.error('Erro ao pesquisar companhias:', err);
      return [];
    }
  };

  const getCompanhiaInicial = async (codigoIcao) => {
    if (!codigoIcao) return null;

    try {
      const allCompanhias = await loadCompanhiasCache();
      const companhia = allCompanhias.find(c => c && c.codigo_icao === codigoIcao);
      if (companhia) {
        return {
          value: companhia.codigo_icao,
          label: `${companhia.nome || 'Sem nome'} (${companhia.codigo_icao})`
        };
      }
    } catch (err) {
      console.error('Erro ao carregar companhia inicial:', err);
    }

    return null;
  };

  // Funções para lazy loading de aeroportos
  const searchAeroportos = async (searchTerm) => {
    const searchLower = searchTerm.toLowerCase();
    const source = aeroportosOrigemDestino?.length > 0 ? aeroportosOrigemDestino : [];
    return source
      .filter(a =>
        a.nome?.toLowerCase().includes(searchLower) ||
        a.codigo_icao?.toLowerCase().includes(searchLower) ||
        a.codigo_iata?.toLowerCase().includes(searchLower) ||
        a.cidade?.toLowerCase().includes(searchLower)
      )
      .slice(0, 50)
      .map(a => ({
        value: a.codigo_icao,
        label: `${a.codigo_icao} - ${a.nome}`,
        displayLabel: a.codigo_icao
      }));
  };

  const getAeroportoInicial = async (codigoIcao) => {
    if (!codigoIcao) return null;
    const aeroporto = aeroportosOrigemDestino.find(a => a.codigo_icao === codigoIcao);
    if (aeroporto) {
      return { 
        value: aeroporto.codigo_icao, 
        label: `${aeroporto.codigo_icao} - ${aeroporto.nome}`,
        displayLabel: aeroporto.codigo_icao 
      };
    }
    try {
      const results = await Aeroporto.filter({ codigo_icao: codigoIcao });
      if (results.length > 0) {
        const a = results[0];
        return { 
          value: a.codigo_icao, 
          label: `${a.codigo_icao} - ${a.nome}`,
          displayLabel: a.codigo_icao 
        };
      }
    } catch (err) {
      console.error('Erro ao carregar aeroporto inicial:', err);
    }
    return null;
  };

  // Funções para lazy loading de registos
  const searchRegistos = async (searchTerm) => {
    try {
      if (!formData.companhia_aerea) return [];

      // Find company in cache first, fallback to prop
      const allCompanhias = await loadCompanhiasCache();
      const companhiaSelecionada = allCompanhias.find(c => c.codigo_icao === formData.companhia_aerea)
        || companhias.find(c => c.codigo_icao === formData.companhia_aerea);
      if (!companhiaSelecionada) return [];

      const results = await RegistoAeronave.filter({ id_companhia_aerea: companhiaSelecionada.id });
      const searchLower = (searchTerm || '').toLowerCase();
      return results
        .filter(r => !searchLower || r.registo?.toLowerCase().includes(searchLower))
        .slice(0, 50)
        .map(r => ({ value: r.registo, label: r.registo }));
    } catch (err) {
      console.error('Erro ao pesquisar registos:', err);
      return [];
    }
  };

  const getRegistoInicial = async (registo) => {
    if (!registo) return null;
    const aeronave = aeronaves.find(a => a.registo === registo);
    if (aeronave) {
      return { value: aeronave.registo, label: aeronave.registo };
    }
    try {
      const results = await RegistoAeronave.filter({ registo: registo });
      if (results.length > 0) {
        const r = results[0];
        return { value: r.registo, label: r.registo };
      }
    } catch (err) {
      console.error('Erro ao carregar registo inicial:', err);
    }
    return null;
  };

  const tipoMovimentoOptions = [
  { value: 'ARR', label: t('formVoo.tipoMovChegada') },
  { value: 'DEP', label: t('formVoo.tipoMovPartida') }];


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
  { value: 'Outro', label: t('formVoo.tipoVooOutro') }];


  const statusOptions = [
    { value: 'Programado', label: t('formVoo.statusProgramado') },
    { value: 'Realizado', label: t('formVoo.statusRealizado') },
    { value: 'Cancelado', label: t('formVoo.statusCancelado') }
  ];

  const voosArrOptions = useMemo(() => [
  { value: '', label: t('formVoo.selecioneVooChegada') }, // Changed to mandatory based on validation
  ...voosArrDisponíveis.map((voo) => ({
    value: voo.id,
    label: `${voo.numero_voo} (${voo.registo_aeronave || 'N/A'}) - ${voo.data_operacao} ${voo.horario_previsto}${voo.horario_real ? ` (${voo.horario_real})` : ''} - ${voo.aeroporto_origem_destino} → ${voo.aeroporto_operacao}`
  }))],
  [voosArrDisponíveis]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vooInicial ? t('formVoo.editarVoo') : t('formVoo.novoVoo')}
          </DialogTitle>
        </DialogHeader>

        {/* Alerta de Duplicidade */}
        {duplicateWarning && (
          <Alert className="border-yellow-300 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">
              <strong>{t('formVoo.possívelDuplicidade')}:</strong> {duplicateWarning.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Novo: Alerta de Inconsistência Militar */}
        {militaryWarning && (
          <Alert className={militaryWarning.type === 'warning' ? 'border-orange-300 bg-orange-50' : 'border-blue-300 bg-blue-50'}>
            <AlertTriangle className={`h-4 w-4 ${militaryWarning.type === 'warning' ? 'text-orange-600' : 'text-blue-600'}`} />
            <AlertDescription className={`text-sm ${militaryWarning.type === 'warning' ? 'text-orange-800' : 'text-blue-800'}`}>
              {militaryWarning.message}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* --- Chegada (ARR) View --- */}
          {formData.tipo_movimento === 'ARR' &&
          <>
              {/* --- Linha 1: Informações Principais --- */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_operacao">{t('formVoo.dataOperacao')} *</Label>
                  <Input
                  id="data_operacao"
                  type="date"
                  value={formData.data_operacao}
                  onChange={(e) => handleInputChange('data_operacao', e.target.value)}
                  className={errors.data_operacao ? 'border-red-500' : ''} />

                  {errors.data_operacao && <p className="text-red-500 text-sm">{errors.data_operacao}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_movimento">{t('formVoo.tipoMovimento')} *</Label>
                  <Select
                  id="tipo_movimento"
                  options={tipoMovimentoOptions}
                  value={formData.tipo_movimento}
                  onValueChange={(value) => handleInputChange('tipo_movimento', value)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_voo">{t('formVoo.numeroVoo')} *</Label>
                  <Input
                  id="numero_voo"
                  value={formData.numero_voo}
                  onChange={(e) => handleInputChange('numero_voo', e.target.value)}
                  placeholder="Ex: DT123"
                  className={errors.numero_voo ? 'border-red-500' : ''} />

                  {errors.numero_voo && <p className="text-red-500 text-sm">{errors.numero_voo}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t('formVoo.status')}</Label>
                  <Select
                  id="status"
                  options={statusOptions}
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)} />

                </div>
              </div>

              {/* --- Linha 2: Companhia e Horários --- */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companhia_aerea">{t('formVoo.companhiaAerea')} *</Label>
                  <AsyncCombobox
                  id="companhia_aerea"
                  value={formData.companhia_aerea}
                  onValueChange={(value) => handleInputChange('companhia_aerea', value)}
                  placeholder={t('formVoo.pesquisarCompanhia')}
                  searchPlaceholder={t('formVoo.digitarNomeCodigo')}
                  noResultsMessage={t('formVoo.nenhumaCompanhia')}
                  onSearch={searchCompanhias}
                  getInitialOption={getCompanhiaInicial}
                  minSearchLength={2}
                  className={errors.companhia_aerea ? 'border-red-500' : ''} />

                  <button
                  type="button"
                  onClick={() => setShowCreateCompanhia(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">

                    <Plus className="w-3 h-3" />
                    {t('formVoo.criarNovaCompanhia')}
                  </button>
                  {errors.companhia_aerea && <p className="text-red-500 text-sm">{errors.companhia_aerea}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registo_aeronave">{t('formVoo.registo')} *</Label>
                  <AsyncCombobox
                  id="registo_aeronave"
                  value={formData.registo_aeronave}
                  onValueChange={(value) => handleInputChange('registo_aeronave', value)}
                  placeholder={formData.companhia_aerea ? t('formVoo.pesquisar') : t('formVoo.selecioneCompanhia')}
                  searchPlaceholder={t('formVoo.procurarRegisto')}
                  noResultsMessage={t('formVoo.nenhumRegisto')}
                  onSearch={searchRegistos}
                  getInitialOption={getRegistoInicial}
                  minSearchLength={1}
                  disabled={!formData.companhia_aerea}
                  className={errors.registo_aeronave ? 'border-red-500' : ''} />

                  {formData.companhia_aerea &&
                <button
                  type="button"
                  onClick={() => setShowCreateRegisto(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">

                      <Plus className="w-3 h-3" />
                      {t('formVoo.criarNovoRegisto')}
                    </button>
                }
                  {errors.registo_aeronave && <p className="text-red-500 text-sm">{errors.registo_aeronave}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario_previsto" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('formVoo.horarioSTA')} *</Label>
                  <Input
                  id="horario_previsto"
                  type="time"
                  step="300"
                  value={formData.horario_previsto}
                  onChange={(e) => handleInputChange('horario_previsto', e.target.value)}
                  className={errors.horario_previsto ? 'border-red-500' : ''} />

                  {errors.horario_previsto && <p className="text-red-500 text-sm">{errors.horario_previsto}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario_real" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('formVoo.horarioReal')}</Label>
                  <Input
                  id="horario_real"
                  type="time"
                  step="60"
                  value={formData.horario_real}
                  onChange={(e) => handleInputChange('horario_real', e.target.value)}
                  className={errors.horario_real ? 'border-red-500' : ''} />

                  {errors.horario_real && <p className="text-red-500 text-sm">{errors.horario_real}</p>}
                </div>
              </div>

              {/* --- Linha 3: Rota --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aeroporto_operacao">{t('formVoo.aeroportoOperacao')} *</Label>
                  <Combobox
                  id="aeroporto_operacao"
                  options={aeroportoOperacaoOptions}
                  value={formData.aeroporto_operacao}
                  onValueChange={(value) => handleInputChange('aeroporto_operacao', value)}
                  placeholder={aeroportosAcesso.length === 0 ? t('formVoo.nenhumAeroporto') : t('formVoo.pesquisarAeroporto')}
                  searchPlaceholder={t('formVoo.procurarAeroporto')}
                  noResultsMessage={t('formVoo.nenhumAeroportoEncontrado')}
                  className={errors.aeroporto_operacao ? 'border-red-500' : ''}
                  disabled={aeroportosAcesso.length === 1 && !vooInicial} />

                  {aeroportosAcesso.length === 0 &&
                <p className="text-xs text-red-500">
                      ⚠️ {t('formVoo.semAcessoAeroporto')}
                    </p>
                }
                  {errors.aeroporto_operacao && <p className="text-red-500 text-sm">{errors.aeroporto_operacao}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aeroporto_origem_destino">
                    {formData.tipo_movimento === 'ARR' ? `${t('formVoo.origem')} *` : `${t('formVoo.destino')} *`}
                  </Label>
                  <Combobox
                  id="aeroporto_origem_destino"
                  options={aeroportoOrigemDestinoOptions}
                  value={formData.aeroporto_origem_destino}
                  onValueChange={(value) => handleInputChange('aeroporto_origem_destino', value)}
                  placeholder={t('formVoo.pesquisarAeroporto')}
                  searchPlaceholder={t('formVoo.procurarAeroporto')}
                  noResultsMessage={t('formVoo.nenhumAeroportoEncontrado')}
                  className={errors.aeroporto_origem_destino ? 'border-red-500' : ''}
                  useDisplayLabel={true} />

                  <button
                  type="button"
                  onClick={() => setShowCreateAeroporto(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">

                    <Plus className="w-3 h-3" />
                    {t('formVoo.naoEncontrouCriar')}
                  </button>
                  {errors.aeroporto_origem_destino && <p className="text-red-500 text-sm">{errors.aeroporto_origem_destino}</p>}
                </div>
              </div>

              {/* --- Linha 4: Stand + Checkboxes Especiais --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="posicao_stand">{t('formVoo.posicaoStand')}</Label>
                  <Input
                    id="posicao_stand"
                    value={formData.posicao_stand}
                    onChange={(e) => handleInputChange('posicao_stand', e.target.value)}
                    placeholder="Ex: A1"
                  />
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="aeronave_no_hangar"
                    checked={formData.aeronave_no_hangar}
                    onCheckedChange={(checked) => handleInputChange('aeronave_no_hangar', checked)}
                  />
                  <Label htmlFor="aeronave_no_hangar" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    {t('formVoo.hangar')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="requer_iluminacao_extra"
                    checked={formData.requer_iluminacao_extra}
                    onCheckedChange={(checked) => handleInputChange('requer_iluminacao_extra', checked)}
                  />
                  <Label htmlFor="requer_iluminacao_extra" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    {t('formVoo.iluminacaoExtra')}
                  </Label>
                </div>
              </div>

              {/* --- Linha 5: Detalhes Adicionais --- */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo_voo">{t('formVoo.tipoVoo')}</Label>
                  <Combobox
                    id="tipo_voo"
                    options={tipoVooOptions}
                    value={formData.tipo_voo}
                    onValueChange={(value) => handleInputChange('tipo_voo', value)}
                    placeholder={t('formVoo.selecioneTipoVoo')}
                    searchPlaceholder={t('formVoo.pesquisarTipoVoo')}
                    noResultsMessage={t('formVoo.nenhumTipoVoo')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tripulacao">{t('formVoo.tripulacao')}</Label>
                  <Input
                  id="tripulacao"
                  type="number"
                  min="0"
                  value={formData.tripulacao}
                  onChange={(e) => handleInputChange('tripulacao', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="carga_kg">{t('formVoo.cargaKg')}</Label>
                  <Input
                  id="carga_kg"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.carga_kg}
                  onChange={(e) => handleInputChange('carga_kg', parseFloat(e.target.value) || 0)} />

                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="observacoes">{t('formVoo.observacoes')}</Label>
                  <Input
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleInputChange('observacoes', e.target.value)}
                  placeholder={t('formVoo.observacoesPlaceholder')} />

                </div>
              </div>
            </>
          }

          {/* --- Partida (DEP) View --- */}
          {formData.tipo_movimento === 'DEP' &&
          <>
              {/* --- Linha 1: Data, Tipo, Vinculação --- */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_operacao">{t('formVoo.dataOperacao')} *</Label>
                  <Input
                  id="data_operacao"
                  type="date"
                  value={formData.data_operacao}
                  onChange={(e) => handleInputChange('data_operacao', e.target.value)}
                  className={errors.data_operacao ? 'border-red-500' : ''} />

                  {errors.data_operacao && <p className="text-red-500 text-sm">{errors.data_operacao}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_movimento">{t('formVoo.tipoMovimento')} *</Label>
                  <Select
                  id="tipo_movimento"
                  options={tipoMovimentoOptions}
                  value={formData.tipo_movimento}
                  onValueChange={(value) => handleInputChange('tipo_movimento', value)} />

                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="linked_arr_voo">{t('formVoo.vooVinculado')} *</Label>
                  <Combobox
                  id="linked_arr_voo"
                  options={voosArrOptions}
                  value={linkedArrVooId}
                  onValueChange={handleLinkedVooChange}
                  placeholder={!formData.data_operacao ? t('formVoo.preenchaDataPrimeiro') : t('formVoo.pesquisarVoo')}
                  searchPlaceholder={t('formVoo.procurarVoo')}
                  noResultsMessage={t('formVoo.nenhumVooDisponivel')}
                  disabled={!formData.data_operacao}
                  className={`${errors.linked_arr_voo ? 'border-red-500' : ''}`}
                  maxHeight="200px" />

                  {errors.linked_arr_voo && <p className="text-red-500 text-sm">{errors.linked_arr_voo}</p>}
                </div>
              </div>

              {/* --- Linha 2: Detalhes do Voo e Status --- */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero_voo">{t('formVoo.numeroVoo')} *</Label>
                  <Input
                  id="numero_voo"
                  value={formData.numero_voo}
                  onChange={(e) => handleInputChange('numero_voo', e.target.value)}
                  placeholder="Ex: DT123"
                  className={errors.numero_voo ? 'border-red-500' : ''} />

                  {errors.numero_voo && <p className="text-red-500 text-sm">{errors.numero_voo}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario_previsto" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('formVoo.horarioSTD')} *</Label>
                  <Input
                  id="horario_previsto"
                  type="time"
                  step="300"
                  value={formData.horario_previsto}
                  onChange={(e) => handleInputChange('horario_previsto', e.target.value)}
                  className={errors.horario_previsto ? 'border-red-500' : ''}
                  min={horarioMinimoDep} />

                  {errors.horario_previsto && <p className="text-red-500 text-sm">{errors.horario_previsto}</p>}
                  {horarioMinimoDep &&
                <p className="text-xs text-slate-500">
                      {t('formVoo.devePosteriorChegada')} ({horarioMinimoDep})
                    </p>
                }
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario_real" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('formVoo.horarioReal')}</Label>
                  <Input
                  id="horario_real"
                  type="time"
                  step="60"
                  value={formData.horario_real}
                  onChange={(e) => handleInputChange('horario_real', e.target.value)}
                  min={horarioMinimoDep}
                  className={errors.horario_real ? 'border-red-500' : ''} />

                  {errors.horario_real && <p className="text-red-500 text-sm">{errors.horario_real}</p>}
                  {horarioMinimoDep &&
                <p className="text-xs text-slate-500">
                      {t('formVoo.devePosteriorChegada')} ({horarioMinimoDep})
                    </p>
                }
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t('formVoo.status')}</Label>
                  <Select
                  id="status"
                  options={statusOptions}
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)} />

                </div>
              </div>

              {/* --- Linha 3: Stand + Checkboxes Especiais --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="posicao_stand_dep">{t('formVoo.posicaoStand')}</Label>
                  <Input
                    id="posicao_stand_dep"
                    value={formData.posicao_stand}
                    onChange={(e) => handleInputChange('posicao_stand', e.target.value)}
                    placeholder="Ex: A1"
                  />
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="aeronave_no_hangar_dep"
                    checked={formData.aeronave_no_hangar}
                    onCheckedChange={(checked) => handleInputChange('aeronave_no_hangar', checked)}
                  />
                  <Label htmlFor="aeronave_no_hangar_dep" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    {t('formVoo.hangar')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="requer_iluminacao_extra_dep"
                    checked={formData.requer_iluminacao_extra}
                    onCheckedChange={(checked) => handleInputChange('requer_iluminacao_extra', checked)}
                  />
                  <Label htmlFor="requer_iluminacao_extra_dep" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    {t('formVoo.iluminacaoExtra')}
                  </Label>
                </div>
              </div>

              {/* --- Secção Troca de Registo (apenas DEP) --- */}
              {formData.tipo_movimento === 'DEP' && linkedArrVooId && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="registo_alterado"
                      checked={formData.registo_alterado}
                      onCheckedChange={(checked) => {
                        handleInputChange('registo_alterado', checked);
                        if (!checked) {
                          const arrVoo = voos.find(v => v.id === linkedArrVooId);
                          if (arrVoo) {
                            handleInputChange('registo_aeronave', arrVoo.registo_aeronave);
                          }
                          handleInputChange('registo_dep', '');
                        }
                      }}
                    />
                    <Label htmlFor="registo_alterado" className="text-sm font-semibold leading-none cursor-pointer text-orange-700">
                      {t('formVoo.houveAlteracaoRegisto')}
                    </Label>
                  </div>
                  {formData.registo_alterado && (
                    <div className="pl-6 space-y-3">
                      <Alert className="bg-orange-50 border-orange-200">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800 text-sm">
                          {t('formVoo.registoOriginalARR')} <strong>{voos.find(v => v.id === linkedArrVooId)?.registo_aeronave}</strong>.
                          {t('formVoo.indiquaRegistoDEP')}
                        </AlertDescription>
                      </Alert>
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 max-w-md space-y-1">
                        <Label className="text-xs">{t('formVoo.registoAeronaveDEP')} *</Label>
                        <AsyncCombobox
                          id="registo_dep"
                          value={formData.registo_dep}
                          onValueChange={(value) => {
                            handleInputChange('registo_dep', value);
                            handleInputChange('registo_aeronave', value);
                          }}
                          placeholder={t('formVoo.pesquisarRegisto')}
                          searchPlaceholder={t('formVoo.procurarRegisto')}
                          noResultsMessage={t('formVoo.nenhumRegisto')}
                          onSearch={searchRegistos}
                          getInitialOption={getRegistoInicial}
                          minSearchLength={1}
                          className={errors.registo_dep ? 'border-red-500' : ''}
                        />
                        {errors.registo_dep && <p className="text-red-500 text-sm">{errors.registo_dep}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- Secção Combustível (apenas DEP) --- */}
              {formData.tipo_movimento === 'DEP' && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="combustivel_utilizado"
                      checked={formData.combustivel_utilizado}
                      onCheckedChange={(checked) => handleInputChange('combustivel_utilizado', checked)}
                    />
                    <Label htmlFor="combustivel_utilizado" className="text-sm font-semibold leading-none cursor-pointer text-amber-700">
                      {t('formVoo.abastecimentoCombustivel')}
                    </Label>
                  </div>
                  {formData.combustivel_utilizado && (
                    <div className="grid grid-cols-2 gap-3 pl-6 bg-amber-50 p-3 rounded-lg border border-amber-200 max-w-md">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('formVoo.combustivelTipo')}</Label>
                        <select
                          value={formData.combustivel_tipo}
                          onChange={(e) => handleInputChange('combustivel_tipo', e.target.value)}
                          className="w-full h-9 px-2 py-1 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 border-slate-200"
                        >
                          <option value="JET-A1">JET-A1</option>
                          <option value="AVGAS">AVGAS</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('formVoo.combustivelLitros')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.combustivel_litros || ''}
                          onChange={(e) => handleInputChange('combustivel_litros', parseFloat(e.target.value) || 0)}
                          className="h-9"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- Linha 4: Destino e Outros --- */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aeroporto_origem_destino">
                    {formData.tipo_movimento === 'ARR' ? `${t('formVoo.origem')} *` : `${t('formVoo.destino')} *`}
                  </Label>
                  <AsyncCombobox
                  id="aeroporto_origem_destino"
                  value={formData.aeroporto_origem_destino}
                  onValueChange={(value) => handleInputChange('aeroporto_origem_destino', value)}
                  placeholder={t('formVoo.pesquisarAeroporto')}
                  searchPlaceholder={t('formVoo.digitarNomeCodigo')}
                  noResultsMessage={t('formVoo.nenhumAeroportoEncontrado')}
                  onSearch={searchAeroportos}
                  getInitialOption={getAeroportoInicial}
                  minSearchLength={2}
                  className={errors.aeroporto_origem_destino ? 'border-red-500' : ''}
                  useDisplayLabel={true} />

                  <button
                  type="button"
                  onClick={() => setShowCreateAeroporto(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">

                    <Plus className="w-3 h-3" />
                    {t('formVoo.naoEncontrouCriar')}
                  </button>
                  {errors.aeroporto_origem_destino && <p className="text-red-500 text-sm">{errors.aeroporto_origem_destino}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_voo">{t('formVoo.tipoVoo')}</Label>
                  <Combobox
                    id="tipo_voo"
                    options={tipoVooOptions}
                    value={formData.tipo_voo}
                    onValueChange={(value) => handleInputChange('tipo_voo', value)}
                    placeholder={t('formVoo.selecioneTipoVoo')}
                    searchPlaceholder={t('formVoo.pesquisarTipoVoo')}
                    noResultsMessage={t('formVoo.nenhumTipoVoo')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tripulacao">{t('formVoo.tripulacao')}</Label>
                  <Input
                  id="tripulacao"
                  type="number"
                  min="0"
                  value={formData.tripulacao}
                  onChange={(e) => handleInputChange('tripulacao', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="carga_kg">{t('formVoo.cargaKg')}</Label>
                  <Input
                  id="carga_kg"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.carga_kg}
                  onChange={(e) => handleInputChange('carga_kg', parseFloat(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">{t('formVoo.observacoes')}</Label>
                  <Input
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleInputChange('observacoes', e.target.value)}
                  placeholder={t('formVoo.observacoesPlaceholderDEP')} />

                </div>
              </div>
            </>
          }

          {/* Passenger Information - Always visible for both types when applicable */}
          {(formData.tipo_movimento === 'ARR' || formData.tipo_movimento === 'DEP') &&
          <div className="space-y-4">
              <h3 className="text-lg font-medium pt-4 border-t">{t('formVoo.informacoesPassageiros')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="passageiros_local">{t('formVoo.passageirosLocais')}</Label>
                  <Input
                  id="passageiros_local"
                  type="number"
                  min="0"
                  value={formData.passageiros_local}
                  onChange={(e) => handleInputChange('passageiros_local', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="passageiros_transito_transbordo">{t('formVoo.transitoTransbordo')}</Label>
                  <Input
                  id="passageiros_transito_transbordo"
                  type="number"
                  min="0"
                  value={formData.passageiros_transito_transbordo}
                  onChange={(e) => handleInputChange('passageiros_transito_transbordo', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="passageiros_transito_direto">{t('formVoo.transitoDireto')}</Label>
                  <Input
                  id="passageiros_transito_direto"
                  type="number"
                  min="0"
                  value={formData.passageiros_transito_direto}
                  onChange={(e) => handleInputChange('passageiros_transito_direto', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="passageiros_total">{t('formVoo.totalCalculado')}</Label>
                  <Input
                  id="passageiros_total"
                  type="number"
                  value={formData.passageiros_total}
                  disabled
                  className="bg-gray-100" />

                </div>
              </div>
            </div>
          }

          {/* Bagagem Information */}
          {(formData.tipo_movimento === 'ARR' || formData.tipo_movimento === 'DEP') &&
          <div className="space-y-4">
              <h3 className="text-lg font-medium pt-4 border-t">{t('formVoo.informacoesBagagem')}</h3>
              {formData.tipo_movimento === 'ARR' ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_local">{t('formVoo.bagagemLocal')}</Label>
                    <Input
                    id="bagagem_local"
                    type="number"
                    min="0"
                    value={formData.bagagem_local}
                    onChange={(e) => handleInputChange('bagagem_local', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_transito_transbordo">{t('formVoo.transitoTransbordo')}</Label>
                    <Input
                    id="bagagem_transito_transbordo"
                    type="number"
                    min="0"
                    value={formData.bagagem_transito_transbordo}
                    onChange={(e) => handleInputChange('bagagem_transito_transbordo', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_transito_direto">{t('formVoo.transitoDireto')}</Label>
                    <Input
                    id="bagagem_transito_direto"
                    type="number"
                    min="0"
                    value={formData.bagagem_transito_direto}
                    onChange={(e) => handleInputChange('bagagem_transito_direto', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_total">{t('formVoo.totalCalculado')}</Label>
                    <Input
                    id="bagagem_total"
                    type="number"
                    value={formData.bagagem_total}
                    disabled
                    className="bg-gray-100" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_total">{t('formVoo.totalBagagens')}</Label>
                    <Input
                    id="bagagem_total"
                    type="number"
                    min="0"
                    value={formData.bagagem_total}
                    onChange={(e) => handleInputChange('bagagem_total', parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              )}
            </div>
          }
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading || isSubmitting}>
              {t('formVoo.cancelar')}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || isSubmitting} className="bg-[#169c41] hover:bg-[#128a36] text-white">
            {isLoading || isSubmitting ? t('formVoo.salvando') : vooInicial ? t('formVoo.atualizarVoo') : t('formVoo.criarVoo')}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modais para criação com formulários completos */}
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
            initialCompanhiaIcao={formData.companhia_aerea} // Pass the current selected company to pre-fill
          />
        </DialogContent>
      </Dialog>
    </Dialog>);

}