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
import { getAeroportosPermitidos } from '@/components/lib/userUtils';
import { differenceInMinutes } from 'date-fns';

// Importar entidades corretas
import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { RegistoAeronave } from '@/entities/RegistoAeronave';

// Importar os formulários COMPLETOS
import { FormAeroporto } from './config/AeroportosConfig';
import { FormCompanhia } from './config/CompanhiasConfig';
import { FormRegisto } from './config/RegistosAeronaveConfig';

const STATUS_CONFIG = {
  'Programado': { label: 'Programado' },
  'Realizado': { label: 'Realizado' },
  'Cancelado': { label: 'Cancelado' }
};

// Intervalo de tolerância para considerar voos duplicados (em minutos)
const DUPLICATE_TOLERANCE_MINUTES = 15;

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
        message: `⚠️ A companhia ${formData.companhia_aerea} é uma companhia militar. O tipo de voo deveria ser "Militar" para garantir isenção de tarifas.`
      });
    } else if (!isCompanyMilitary && isFlightTypeMilitary) {
      setMilitaryWarning({
        type: 'info',
        message: `ℹ️ Voos do tipo "${formData.tipo_voo}" são isentos de tarifas aeroportuárias.`
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
  const aeroportosAcesso = useMemo(() => {
    if (!currentUser || !Array.isArray(aeroportos)) {
      return [];
    }

    const permitidos = getAeroportosPermitidos(currentUser, aeroportos);
    // Para FormVoo, filtrar apenas aeroportos SGA se for admin/superadmin
    if (currentUser.role === 'admin' || (currentUser.perfis && currentUser.perfis.includes('administrador'))) {
      return permitidos.filter((a) => a.isSGA === true);
    }
    return permitidos;
  }, [aeroportos, currentUser]);

  // Auto-selecionar aeroporto se o usuário tem acesso a apenas um (para ARR)
  useEffect(() => {
    if (formData.tipo_movimento === 'ARR' && aeroportosAcesso.length === 1 && !formData.aeroporto_operacao && !vooInicial) {
      setFormData((prev) => ({
        ...prev,
        aeroporto_operacao: aeroportosAcesso[0].codigo_icao
      }));
    }
  }, [aeroportosAcesso, formData.aeroporto_operacao, formData.tipo_movimento, vooInicial]);

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
        message: `Já existe um voo ${duplicateVoo.tipo_movimento} para a aeronave ${duplicateVoo.registo_aeronave} em ${duplicateVoo.aeroporto_operacao} no dia ${duplicateVoo.data_operacao} às ${duplicateVoo.horario_real || duplicateVoo.horario_previsto} (voo ${duplicateVoo.numero_voo}). Verifique se não é uma duplicidade.`
      });
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.registo_aeronave, formData.data_operacao, formData.tipo_movimento, formData.aeroporto_operacao, formData.horario_previsto, formData.horario_real, voos, vooInicial]);

  // Acionar verificação de duplicidade quando campos relevantes mudarem
  useEffect(() => {
    checkDuplicateVoo();
  }, [checkDuplicateVoo, formData.registo_aeronave, formData.data_operacao, formData.tipo_movimento, formData.aeroporto_operacao, formData.horario_previsto, formData.horario_real]);


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

      setFormData((prev) => ({
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

    if (!formData.data_operacao) newErrors.data_operacao = 'Data da operação é obrigatória';
    if (!formData.horario_previsto) newErrors.horario_previsto = 'Horário previsto é obrigatório';

    // REMOVIDA: Validação que impedia horário real anterior ao previsto (voos podem antecipar)
    // Agora permitimos que o horário real seja antes do previsto

    if (formData.tipo_movimento === 'DEP') {
      if (!linkedArrVooId) {
        newErrors.linked_arr_voo = 'É obrigatório vincular um voo de chegada para criar uma partida.';
      }

      // Validação crítica: Horários DEP não podem ser anteriores OU IGUAIS aos horários ARR
      if (linkedArrVooId) {
        const vooArr = voos.find((v) => v.id === linkedArrVooId);
        if (vooArr) {
          const horarioArrReal = vooArr.horario_real || vooArr.horario_previsto;

          // Criar datetimes completos para comparação precisa
          const dateTimeArr = createDateTime(vooArr.data_operacao, horarioArrReal, vooArr.horario_previsto);
          
          // Validar horário previsto DEP
          if (formData.horario_previsto) {
            const dateTimeDepPrevisto = createDateTime(formData.data_operacao, formData.horario_previsto, formData.horario_previsto);
            
            if (dateTimeArr && dateTimeDepPrevisto && dateTimeDepPrevisto <= dateTimeArr) {
              newErrors.horario_previsto = `O horário previsto de partida deve ser posterior ao horário de chegada (${horarioArrReal}).`;
            }
          }

          // Validar horário real DEP (se preenchido)
          if (formData.horario_real) {
            const dateTimeDepReal = createDateTime(formData.data_operacao, formData.horario_real, formData.horario_previsto);
            
            if (dateTimeArr && dateTimeDepReal && dateTimeDepReal <= dateTimeArr) {
              newErrors.horario_real = `O horário real de partida deve ser posterior ao horário de chegada (${horarioArrReal}).`;
            }
          }
        }
      }

      if (!formData.numero_voo) newErrors.numero_voo = 'Número do voo é obrigatório';
      if (!formData.aeroporto_origem_destino) newErrors.aeroporto_origem_destino = 'Aeroporto de destino é obrigatório';

      // Validação troca de registo
      if (formData.registo_alterado) {
        if (!formData.registo_dep) {
          newErrors.registo_dep = 'Indique o registo da aeronave que partiu.';
        } else {
          const arrVoo = voos.find(v => v.id === linkedArrVooId);
          if (arrVoo && formData.registo_dep === arrVoo.registo_aeronave) {
            newErrors.registo_dep = 'O registo DEP deve ser diferente do registo ARR.';
          }
        }
      }

    } else {// ARR flight
      if (!formData.numero_voo) newErrors.numero_voo = 'Número do voo é obrigatório';
      if (!formData.companhia_aerea) newErrors.companhia_aerea = 'Companhia aérea é obrigatória';
      if (!formData.aeroporto_operacao) newErrors.aeroporto_operacao = 'Aeroporto de operação é obrigatória';
      if (!formData.registo_aeronave) newErrors.registo_aeronave = 'Registo da aeronave é obrigatório';
      if (!formData.aeroporto_origem_destino) newErrors.aeroporto_origem_destino = 'Aeroporto de origem é obrigatório';
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
          setErrors((prev) => ({ ...prev, registo_aeronave: 'O formato do registo da aeronave é inválido.' }));
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
          setErrors((prev) => ({ ...prev, numero_voo: 'O número do voo é obrigatório.' }));
          setIsLoading(false);
          return;
        }
      }

      // Se houve troca de registo, usar o registo DEP
      const registoFinal = formData.registo_alterado && formData.registo_dep
        ? normalizeAircraftRegistration(formData.registo_dep) || formData.registo_dep
        : registoToSubmit;

      // Remove campos internos que não existem na tabela voo (até migration ser executada)
      const { registo_dep, registo_alterado, ...formDataClean } = formData;
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
          title: 'Voo Duplicado',
          message: 'Já existe um voo com este número, data, tipo de movimento e aeroporto. Não é possível criar voos duplicados.'
        });
      } else {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: 'Erro ao salvar voo',
          message: 'Ocorreu um erro ao salvar o voo. Tente novamente mais tarde.'
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
          title: 'Possível Duplicidade Detectada',
          message: `${duplicateWarning.message}\n\nTem certeza que deseja continuar e salvar este voo mesmo assim?`,
          showCancel: true,
          confirmText: 'Sim, Salvar Mesmo Assim',
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
          title: 'Aeroporto Duplicado',
          message: `Já existe um aeroporto com o código ICAO "${data.codigo_icao}". Nome: ${aeroportoExistente.nome}.`
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
          title: 'Código de País Inválido',
          message: 'O código do país deve ter exatamente 2 letras (ex: AO para Angola, PT para Portugal).'
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
        title: 'Aeroporto Criado!',
        message: `O aeroporto "${novoAeroporto.nome}" foi criado com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao criar aeroporto:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Criar Aeroporto',
        message: error.message || 'Não foi possível criar o aeroporto. Verifique se todos os campos obrigatórios estão preenchidos corretamente.'
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
          title: 'Companhia Duplicada',
          message: `Já existe uma companhia com o código ICAO "${data.codigo_icao}". Nome: ${companhiaExistente.nome}.`
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
        title: 'Companhia Criada!',
        message: `A companhia "${novaCompanhia.nome}" foi criada com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao criar companhia:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Criar Companhia',
        message: 'Não foi possível criar a companhia. Verifique os dados e tente novamente.'
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
          title: 'Formato Inválido',
          message: 'O formato do registo da aeronave é inválido. Use o formato: D2ABC (sem hífens ou espaços).'
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
          title: 'Registo Duplicado',
          message: `Já existe uma aeronave com o registo "${data.registo}".`
        });
        return;
      }

      // Criar com registo normalizado
      const dataToSave = {
        ...data,
        registo: registoNormalizado
      };

      const novoRegisto = await RegistoAeronave.create(dataToSave);

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
        title: 'Registo Criado!',
        message: `O registo "${novoRegisto.registo}" foi criado com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao criar registo:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Criar Registo',
        message: 'Não foi possível criar o registo. Tente novamente.'
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

  const companhiaOptions = useMemo(() => {
    if (!Array.isArray(companhias)) return [];
    return companhias.map((c) => ({ value: c.codigo_icao, label: `${c.nome} (${c.codigo_icao})` }));
  }, [companhias]);

  // Funções para lazy loading de companhias
  const searchCompanhias = async (searchTerm) => {
    try {
      if (!searchTerm || searchTerm.length < 2) return [];
      
      const results = await CompanhiaAerea.list();
      
      if (!Array.isArray(results)) {
        console.warn('CompanhiaAerea.list() não retornou array:', results);
        return [];
      }
      
      const searchLower = searchTerm.toLowerCase();
      return results
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
      // Primeiro tentar encontrar no cache local
      if (Array.isArray(companhias)) {
        const companhia = companhias.find(c => c && c.codigo_icao === codigoIcao);
        if (companhia) {
          return { 
            value: companhia.codigo_icao, 
            label: `${companhia.nome || 'Sem nome'} (${companhia.codigo_icao})` 
          };
        }
      }
      
      // Se não encontrar, buscar no banco
      const results = await CompanhiaAerea.filter({ codigo_icao: codigoIcao });
      if (Array.isArray(results) && results.length > 0) {
        const c = results[0];
        return { 
          value: c.codigo_icao || codigoIcao, 
          label: `${c.nome || 'Sem nome'} (${c.codigo_icao || codigoIcao})` 
        };
      }
    } catch (err) {
      console.error('Erro ao carregar companhia inicial:', err);
    }
    
    return null;
  };

  // Funções para lazy loading de aeroportos
  const searchAeroportos = async (searchTerm) => {
    try {
      const results = await Aeroporto.list();
      const searchLower = searchTerm.toLowerCase();
      return results
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
    } catch (err) {
      console.error('Erro ao pesquisar aeroportos:', err);
      return [];
    }
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
      
      const companhiaSelecionada = companhias.find((c) => c.codigo_icao === formData.companhia_aerea);
      if (!companhiaSelecionada) return [];

      const results = await RegistoAeronave.filter({ id_companhia_aerea: companhiaSelecionada.id });
      const searchLower = searchTerm.toLowerCase();
      return results
        .filter(r => r.registo?.toLowerCase().includes(searchLower))
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
  { value: 'ARR', label: 'Chegada (ARR)' },
  { value: 'DEP', label: 'Partida (DEP)' }];


  const tipoVooOptions = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Não Regular', label: 'Não Regular' },
  { value: 'Humanitário', label: 'Humanitário' },
  { value: 'Charter', label: 'Charter' },
  { value: 'Carga', label: 'Carga' },
  { value: 'Privado', label: 'Privado' },
  { value: 'Militar', label: 'Militar' },
  { value: 'Oficial', label: 'Oficial' },
  { value: 'Técnico', label: 'Técnico' },
  { value: 'Outro', label: 'Outro' }];


  const statusOptions = Object.entries(STATUS_CONFIG).map(([key, config]) => ({
    value: key,
    label: config.label
  }));

  const voosArrOptions = useMemo(() => [
  { value: '', label: 'Selecione um voo de chegada para vincular' }, // Changed to mandatory based on validation
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
            {vooInicial ? 'Editar Voo' : 'Novo Voo'}
          </DialogTitle>
        </DialogHeader>

        {/* Alerta de Duplicidade */}
        {duplicateWarning && (
          <Alert className="border-yellow-300 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">
              <strong>Possível Duplicidade:</strong> {duplicateWarning.message}
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
                  <Label htmlFor="data_operacao">Data da Operação *</Label>
                  <Input
                  id="data_operacao"
                  type="date"
                  value={formData.data_operacao}
                  onChange={(e) => handleInputChange('data_operacao', e.target.value)}
                  className={errors.data_operacao ? 'border-red-500' : ''} />

                  {errors.data_operacao && <p className="text-red-500 text-sm">{errors.data_operacao}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_movimento">Tipo de Movimento *</Label>
                  <Select
                  id="tipo_movimento"
                  options={tipoMovimentoOptions}
                  value={formData.tipo_movimento}
                  onValueChange={(value) => handleInputChange('tipo_movimento', value)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_voo">Número do Voo *</Label>
                  <Input
                  id="numero_voo"
                  value={formData.numero_voo}
                  onChange={(e) => handleInputChange('numero_voo', e.target.value)}
                  placeholder="Ex: DT123"
                  className={errors.numero_voo ? 'border-red-500' : ''} />

                  {errors.numero_voo && <p className="text-red-500 text-sm">{errors.numero_voo}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
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
                  <Label htmlFor="companhia_aerea">Companhia Aérea *</Label>
                  <AsyncCombobox
                  id="companhia_aerea"
                  value={formData.companhia_aerea}
                  onValueChange={(value) => handleInputChange('companhia_aerea', value)}
                  placeholder="Pesquisar companhia..."
                  searchPlaceholder="Digite nome ou código ICAO..."
                  noResultsMessage="Nenhuma companhia encontrada"
                  onSearch={searchCompanhias}
                  getInitialOption={getCompanhiaInicial}
                  minSearchLength={2}
                  className={errors.companhia_aerea ? 'border-red-500' : ''} />

                  <button
                  type="button"
                  onClick={() => setShowCreateCompanhia(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">

                    <Plus className="w-3 h-3" />
                    Criar nova companhia
                  </button>
                  {errors.companhia_aerea && <p className="text-red-500 text-sm">{errors.companhia_aerea}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registo_aeronave">Registo *</Label>
                  <AsyncCombobox
                  id="registo_aeronave"
                  value={formData.registo_aeronave}
                  onValueChange={(value) => handleInputChange('registo_aeronave', value)}
                  placeholder={formData.companhia_aerea ? "Pesquisar..." : "Selecione companhia"}
                  searchPlaceholder="Procurar registo..."
                  noResultsMessage="Nenhum registo"
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
                      Criar novo registo
                    </button>
                }
                  {errors.registo_aeronave && <p className="text-red-500 text-sm">{errors.registo_aeronave}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario_previsto" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Horário STA UTC *</Label>
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
                  <Label htmlFor="horario_real" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Horário Real UTC</Label>
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
                  <Label htmlFor="aeroporto_operacao">Aeroporto de Operação *</Label>
                  <Combobox
                  id="aeroporto_operacao"
                  options={aeroportoOperacaoOptions}
                  value={formData.aeroporto_operacao}
                  onValueChange={(value) => handleInputChange('aeroporto_operacao', value)}
                  placeholder={aeroportosAcesso.length === 0 ? "Nenhum aeroporto" : "Pesquisar aeroporto..."}
                  searchPlaceholder="Procurar aeroporto..."
                  noResultsMessage="Nenhum aeroporto encontrado"
                  className={errors.aeroporto_operacao ? 'border-red-500' : ''}
                  disabled={aeroportosAcesso.length === 1 && !vooInicial} />

                  {aeroportosAcesso.length === 0 &&
                <p className="text-xs text-red-500">
                      ⚠️ Você não tem acesso a nenhum aeroporto. Contacte o administrador.
                    </p>
                }
                  {errors.aeroporto_operacao && <p className="text-red-500 text-sm">{errors.aeroporto_operacao}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aeroporto_origem_destino">
                    {formData.tipo_movimento === 'ARR' ? 'Origem *' : 'Destino *'}
                  </Label>
                  <Combobox
                  id="aeroporto_origem_destino"
                  options={aeroportoOrigemDestinoOptions}
                  value={formData.aeroporto_origem_destino}
                  onValueChange={(value) => handleInputChange('aeroporto_origem_destino', value)}
                  placeholder="Pesquisar aeroporto..."
                  searchPlaceholder="Procurar aeroporto..."
                  noResultsMessage="Nenhum aeroporto encontrado"
                  className={errors.aeroporto_origem_destino ? 'border-red-500' : ''}
                  useDisplayLabel={true} />

                  <button
                  type="button"
                  onClick={() => setShowCreateAeroporto(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 pt-1">

                    <Plus className="w-3 h-3" />
                    Não encontrou? Criar novo aeroporto
                  </button>
                  {errors.aeroporto_origem_destino && <p className="text-red-500 text-sm">{errors.aeroporto_origem_destino}</p>}
                </div>
              </div>

              {/* --- Linha 4: Stand + Checkboxes Especiais --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="posicao_stand">Posição Stand</Label>
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
                    Hangar (Isenta estacionamento)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="requer_iluminacao_extra"
                    checked={formData.requer_iluminacao_extra}
                    onCheckedChange={(checked) => handleInputChange('requer_iluminacao_extra', checked)}
                  />
                  <Label htmlFor="requer_iluminacao_extra" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    Sinal.Luz Xtra (Cobra iluminação)
                  </Label>
                </div>
              </div>

              {/* --- Linha 5: Detalhes Adicionais --- */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo_voo">Tipo de Voo</Label>
                  <Combobox
                    id="tipo_voo"
                    options={tipoVooOptions}
                    value={formData.tipo_voo}
                    onValueChange={(value) => handleInputChange('tipo_voo', value)}
                    placeholder="Selecione o tipo de voo"
                    searchPlaceholder="Pesquisar tipo de voo..."
                    noResultsMessage="Nenhum tipo de voo encontrado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tripulacao">Tripulação</Label>
                  <Input
                  id="tripulacao"
                  type="number"
                  min="0"
                  value={formData.tripulacao}
                  onChange={(e) => handleInputChange('tripulacao', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="carga_kg">Carga (kg)</Label>
                  <Input
                  id="carga_kg"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.carga_kg}
                  onChange={(e) => handleInputChange('carga_kg', parseFloat(e.target.value) || 0)} />

                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Input
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleInputChange('observacoes', e.target.value)}
                  placeholder="Observações adicionais sobre o voo" />

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
                  <Label htmlFor="data_operacao">Data da Operação *</Label>
                  <Input
                  id="data_operacao"
                  type="date"
                  value={formData.data_operacao}
                  onChange={(e) => handleInputChange('data_operacao', e.target.value)}
                  className={errors.data_operacao ? 'border-red-500' : ''} />

                  {errors.data_operacao && <p className="text-red-500 text-sm">{errors.data_operacao}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_movimento">Tipo de Movimento *</Label>
                  <Select
                  id="tipo_movimento"
                  options={tipoMovimentoOptions}
                  value={formData.tipo_movimento}
                  onValueChange={(value) => handleInputChange('tipo_movimento', value)} />

                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="linked_arr_voo">Voo Vinculado *</Label>
                  <Combobox
                  id="linked_arr_voo"
                  options={voosArrOptions}
                  value={linkedArrVooId}
                  onValueChange={handleLinkedVooChange}
                  placeholder={!formData.data_operacao ? "Preencha a data primeiro" : "Pesquisar voo..."}
                  searchPlaceholder="Procurar voo..."
                  noResultsMessage="Nenhum voo disponível"
                  disabled={!formData.data_operacao}
                  className={`${errors.linked_arr_voo ? 'border-red-500' : ''}`}
                  maxHeight="200px" />

                  {errors.linked_arr_voo && <p className="text-red-500 text-sm">{errors.linked_arr_voo}</p>}
                </div>
              </div>

              {/* --- Linha 2: Detalhes do Voo e Status --- */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero_voo">Número do Voo *</Label>
                  <Input
                  id="numero_voo"
                  value={formData.numero_voo}
                  onChange={(e) => handleInputChange('numero_voo', e.target.value)}
                  placeholder="Ex: DT123"
                  className={errors.numero_voo ? 'border-red-500' : ''} />

                  {errors.numero_voo && <p className="text-red-500 text-sm">{errors.numero_voo}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario_previsto" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Horário STD UTC *</Label>
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
                      Deve ser posterior ao voo de chegada ({horarioMinimoDep})
                    </p>
                }
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario_real" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Horário Real UTC</Label>
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
                      Deve ser posterior ao voo de chegada ({horarioMinimoDep})
                    </p>
                }
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
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
                  <Label htmlFor="posicao_stand_dep">Posição Stand</Label>
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
                    Hangar (Isenta estacionamento)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="requer_iluminacao_extra_dep"
                    checked={formData.requer_iluminacao_extra}
                    onCheckedChange={(checked) => handleInputChange('requer_iluminacao_extra', checked)}
                  />
                  <Label htmlFor="requer_iluminacao_extra_dep" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    Sinal.Luz Xtra (Cobra iluminação)
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
                      Houve alteração de registo (troca de aeronave)
                    </Label>
                  </div>
                  {formData.registo_alterado && (
                    <div className="pl-6 space-y-3">
                      <Alert className="bg-orange-50 border-orange-200">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800 text-sm">
                          O registo original (ARR) é <strong>{voos.find(v => v.id === linkedArrVooId)?.registo_aeronave}</strong>.
                          Indique abaixo o registo da aeronave que efetivamente partiu.
                        </AlertDescription>
                      </Alert>
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 max-w-md space-y-1">
                        <Label className="text-xs">Registo da Aeronave DEP *</Label>
                        <AsyncCombobox
                          id="registo_dep"
                          value={formData.registo_dep}
                          onValueChange={(value) => {
                            handleInputChange('registo_dep', value);
                            handleInputChange('registo_aeronave', value);
                          }}
                          placeholder="Pesquisar registo..."
                          searchPlaceholder="Procurar registo..."
                          noResultsMessage="Nenhum registo"
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
                      Abastecimento de Combustível
                    </Label>
                  </div>
                  {formData.combustivel_utilizado && (
                    <div className="grid grid-cols-2 gap-3 pl-6 bg-amber-50 p-3 rounded-lg border border-amber-200 max-w-md">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
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
                        <Label className="text-xs">Litros</Label>
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
                    {formData.tipo_movimento === 'ARR' ? 'Origem *' : 'Destino *'}
                  </Label>
                  <AsyncCombobox
                  id="aeroporto_origem_destino"
                  value={formData.aeroporto_origem_destino}
                  onValueChange={(value) => handleInputChange('aeroporto_origem_destino', value)}
                  placeholder="Pesquisar a..."
                  searchPlaceholder="Digite nome ou código ICAO..."
                  noResultsMessage="Nenhum aeroporto encontrado"
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
                    Não encontrou? Criar novo aeroporto
                  </button>
                  {errors.aeroporto_origem_destino && <p className="text-red-500 text-sm">{errors.aeroporto_origem_destino}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_voo">Tipo de Voo</Label>
                  <Combobox
                    id="tipo_voo"
                    options={tipoVooOptions}
                    value={formData.tipo_voo}
                    onValueChange={(value) => handleInputChange('tipo_voo', value)}
                    placeholder="Selecione o tipo de voo"
                    searchPlaceholder="Pesquisar tipo de voo..."
                    noResultsMessage="Nenhum tipo de voo encontrado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tripulacao">Tripulação</Label>
                  <Input
                  id="tripulacao"
                  type="number"
                  min="0"
                  value={formData.tripulacao}
                  onChange={(e) => handleInputChange('tripulacao', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="carga_kg">Carga (kg)</Label>
                  <Input
                  id="carga_kg"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.carga_kg}
                  onChange={(e) => handleInputChange('carga_kg', parseFloat(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Input
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleInputChange('observacoes', e.target.value)}
                  placeholder="Observações adicionais" />

                </div>
              </div>
            </>
          }

          {/* Passenger Information - Always visible for both types when applicable */}
          {(formData.tipo_movimento === 'ARR' || formData.tipo_movimento === 'DEP') &&
          <div className="space-y-4">
              <h3 className="text-lg font-medium pt-4 border-t">Informações de Passageiros</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="passageiros_local">Passageiros Locais</Label>
                  <Input
                  id="passageiros_local"
                  type="number"
                  min="0"
                  value={formData.passageiros_local}
                  onChange={(e) => handleInputChange('passageiros_local', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="passageiros_transito_transbordo">Trânsito c/ Transbordo</Label>
                  <Input
                  id="passageiros_transito_transbordo"
                  type="number"
                  min="0"
                  value={formData.passageiros_transito_transbordo}
                  onChange={(e) => handleInputChange('passageiros_transito_transbordo', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="passageiros_transito_direto">Trânsito Direto</Label>
                  <Input
                  id="passageiros_transito_direto"
                  type="number"
                  min="0"
                  value={formData.passageiros_transito_direto}
                  onChange={(e) => handleInputChange('passageiros_transito_direto', parseInt(e.target.value) || 0)} />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="passageiros_total">Total (Calculado)</Label>
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
              <h3 className="text-lg font-medium pt-4 border-t">Informações de Bagagem</h3>
              {formData.tipo_movimento === 'ARR' ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_local">Bagagem Local</Label>
                    <Input
                    id="bagagem_local"
                    type="number"
                    min="0"
                    value={formData.bagagem_local}
                    onChange={(e) => handleInputChange('bagagem_local', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_transito_transbordo">Trânsito c/ Transbordo</Label>
                    <Input
                    id="bagagem_transito_transbordo"
                    type="number"
                    min="0"
                    value={formData.bagagem_transito_transbordo}
                    onChange={(e) => handleInputChange('bagagem_transito_transbordo', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_transito_direto">Trânsito Direto</Label>
                    <Input
                    id="bagagem_transito_direto"
                    type="number"
                    min="0"
                    value={formData.bagagem_transito_direto}
                    onChange={(e) => handleInputChange('bagagem_transito_direto', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bagagem_total">Total (Calculado)</Label>
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
                    <Label htmlFor="bagagem_total">Total de Bagagens</Label>
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
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || isSubmitting} className="bg-[#169c41] hover:bg-[#128a36] text-white">
            {isLoading || isSubmitting ? 'Salvando...' : vooInicial ? 'Atualizar Voo' : 'Criar Voo'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modais para criação com formulários completos */}
      <Dialog open={showCreateAeroporto} onOpenChange={setShowCreateAeroporto}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Aeroporto</DialogTitle>
          </DialogHeader>
          <FormAeroporto onSave={handleCreateAeroporto} onCancel={() => setShowCreateAeroporto(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateCompanhia} onOpenChange={setShowCreateCompanhia}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Companhia Aérea</DialogTitle>
          </DialogHeader>
          <FormCompanhia onSave={handleCreateCompanhia} onCancel={() => setShowCreateCompanhia(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateRegisto} onOpenChange={setShowCreateRegisto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Registo de Aeronave</DialogTitle>
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