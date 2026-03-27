import { useState, useMemo, useCallback } from 'react';
import { addDays } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { fetchCalculoMap } from '@/hooks/useCalculosTarifa';

/**
 * Hook that manages all filter state, sort state, and derived filtered/sorted lists for Operacoes page.
 */
export function useOperacoesFilters({
  voos,
  voosLigados,
  voosLigadosValidos,
  calculosTarifa,
  companhias,
  aeroportos,
  todosAeroportos,
  user,
  effectiveEmpresaIdRef,
  empresaId,
  queryClient,
  setAlertInfo,
  t,
}) {
  // --- Voos tab filters ---
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    tipoMovimento: 'todos',
    status: 'todos',
    companhia: 'todos',
    aeroporto: 'todos',
    tipoVoo: 'todos',
    statusVinculacao: 'todos',
    busca: '',
    passageirosMin: '',
    passageirosMax: '',
    cargaMin: '',
    cargaMax: '',
    origem: 'todos'
  });
  const [isFiltering, setIsFiltering] = useState(false);

  // --- Voos Ligados tab filters ---
  const [filtrosLigados, setFiltrosLigados] = useState({
    dataInicio: '',
    dataFim: '',
    companhia: 'todos',
    aeroportos: [],
    tipoVoo: 'todos',
    statusCalculo: 'todos',
    permanenciaMin: '',
    permanenciaMax: '',
    busca: ''
  });
  const [isFilteringLigados, setIsFilteringLigados] = useState(false);

  // --- Voos Sem Link tab state ---
  const [voosSemLink, setVoosSemLink] = useState([]);
  const [isLoadingSemLink, setIsLoadingSemLink] = useState(false);
  const [isLinkingAuto, setIsLinkingAuto] = useState(false);
  const [filtrosSemLink, setFiltrosSemLink] = useState({
    dataInicio: '',
    dataFim: '',
    tipoMovimento: 'todos',
    companhia: 'todos',
    busca: ''
  });
  const [semLinkLoaded, setSemLinkLoaded] = useState(false);

  // --- Sort state ---
  const [sortField, setSortField] = useState('data_operacao');
  const [sortDirection, setSortDirection] = useState('desc');
  const [sortFieldLigados, setSortFieldLigados] = useState('horario_arr');
  const [sortDirectionLigados, setSortDirectionLigados] = useState('desc');

  // --- Handlers ---

  const handleFilterChange = useCallback((field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleFilterChangeLigados = useCallback((field, value) => {
    setFiltrosLigados(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleFilterChangeSemLink = useCallback((field, value) => {
    setFiltrosSemLink(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSort = useCallback((field) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  const handleSortLigados = useCallback((field) => {
    setSortFieldLigados(prev => {
      if (prev === field) {
        setSortDirectionLigados(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDirectionLigados('asc');
      return field;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFiltros({
      dataInicio: '',
      dataFim: '',
      tipoMovimento: 'todos',
      status: 'todos',
      companhia: 'todos',
      aeroporto: 'todos',
      tipoVoo: 'todos',
      statusVinculacao: 'todos',
      busca: '',
      passageirosMin: '',
      passageirosMax: '',
      cargaMin: '',
      cargaMax: '',
      origem: 'todos'
    });
    setIsFiltering(false);
    queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
    queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
  }, [queryClient, empresaId]);

  const clearFiltersLigados = useCallback(() => {
    setFiltrosLigados({
      dataInicio: '',
      dataFim: '',
      companhia: 'todos',
      aeroportos: [],
      tipoVoo: 'todos',
      statusCalculo: 'todos',
      permanenciaMin: '',
      permanenciaMax: '',
      busca: ''
    });
    setIsFilteringLigados(false);
    queryClient.invalidateQueries({ queryKey: ['voos', empresaId] });
    queryClient.invalidateQueries({ queryKey: ['voos-ligados', empresaId] });
    queryClient.invalidateQueries({ queryKey: ['calculos-tarifa', empresaId] });
  }, [queryClient, empresaId]);

  // --- Server-side search: Voos ---
  const handleBuscarVoos = useCallback(async () => {
    setIsFiltering(true);
    try {
      const query = { deleted_at: { $is: null } };
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      if (empId) query.empresa_id = empId;

      if (filtros.dataInicio) query.data_operacao = { ...query.data_operacao, $gte: filtros.dataInicio };
      if (filtros.dataFim) query.data_operacao = { ...query.data_operacao, $lte: filtros.dataFim };

      if (filtros.tipoMovimento !== 'todos') query.tipo_movimento = filtros.tipoMovimento;
      if (filtros.status !== 'todos') query.status = filtros.status;
      if (filtros.tipoVoo !== 'todos') query.tipo_voo = filtros.tipoVoo;
      if (filtros.aeroporto !== 'todos') query.aeroporto_operacao = filtros.aeroporto;

      if (filtros.origem === 'flightaware') query.created_by = { $ilike: '%FlightAware%' };
      else if (filtros.origem === 'sistema') query.created_by = { $ilike: '%import%' };
      else if (filtros.origem === 'manual') query.created_by = { $is: null };

      if (filtros.companhia !== 'todos' && filtros.companhia !== 'outro') {
        const comp = companhias.find(c => c.codigo_icao === filtros.companhia);
        const codes = [filtros.companhia];
        if (comp?.codigo_iata && comp.codigo_iata !== filtros.companhia) codes.push(comp.codigo_iata);
        query.companhia_aerea = { $in: codes };
      }

      if (filtros.passageirosMin) query.passageiros_total = { ...query.passageiros_total, $gte: parseInt(filtros.passageirosMin) };
      if (filtros.passageirosMax) query.passageiros_total = { ...query.passageiros_total, $lte: parseInt(filtros.passageirosMax) };

      if (filtros.cargaMin) query.carga_kg = { ...query.carga_kg, $gte: parseFloat(filtros.cargaMin) };
      if (filtros.cargaMax) query.carga_kg = { ...query.carga_kg, $lte: parseFloat(filtros.cargaMax) };

      let data;
      if (filtros.busca) {
        let q = supabase.from('voo').select('*');
        q = q.is('deleted_at', null);
        if (query.empresa_id) q = q.eq('empresa_id', query.empresa_id);
        if (query.data_operacao?.$gte) q = q.gte('data_operacao', query.data_operacao.$gte);
        if (query.data_operacao?.$lte) q = q.lte('data_operacao', query.data_operacao.$lte);
        if (query.tipo_movimento) q = q.eq('tipo_movimento', query.tipo_movimento);
        if (query.status) q = q.eq('status', query.status);
        if (query.tipo_voo) q = q.eq('tipo_voo', query.tipo_voo);
        if (query.aeroporto_operacao) q = q.eq('aeroporto_operacao', query.aeroporto_operacao);
        if (query.companhia_aerea?.$in) q = q.in('companhia_aerea', query.companhia_aerea.$in);
        if (query.created_by?.$ilike) q = q.ilike('created_by', query.created_by.$ilike);
        else if (query.created_by?.$is === null) q = q.is('created_by', null);
        q = q.or(`numero_voo.ilike.%${filtros.busca}%,registo_aeronave.ilike.%${filtros.busca}%`);
        q = q.order('data_operacao', { ascending: false });
        const PAGE = 500;
        let all = [];
        let from = 0;
        while (true) {
          const { data: batch, error } = await q.range(from, from + PAGE - 1);
          if (error) throw error;
          if (!batch || batch.length === 0) break;
          all = all.concat(batch);
          if (batch.length < PAGE) break;
          from += PAGE;
        }
        data = all;
      } else {
        data = await Voo.filter(query, '-data_operacao');
      }
      queryClient.setQueryData(['voos', empresaId], data);
      const empIdVl = effectiveEmpresaIdRef.current || user?.empresa_id;
      if (empIdVl) {
        const vlData = await VooLigado.filter({ empresa_id: empId }, '-created_date');
        queryClient.setQueryData(['voos-ligados', empresaId], vlData);
      }
    } catch (error) {
      console.error('Erro ao filtrar voos:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('operacoes.erro_filtrar'),
        message: t('operacoes.erro_filtrar_msg')
      });
    } finally {
      setIsFiltering(false);
    }
  }, [filtros, user, companhias, t, effectiveEmpresaIdRef, empresaId, queryClient, setAlertInfo]);

  // --- Server-side search: Voos Ligados ---
  const handleBuscarLigados = useCallback(async () => {
    setIsFilteringLigados(true);
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;

      const vooQuery = { deleted_at: { $is: null } };
      if (empId) vooQuery.empresa_id = empId;
      if (filtrosLigados.dataInicio) {
        vooQuery.data_operacao = { ...vooQuery.data_operacao, $gte: filtrosLigados.dataInicio };
      }
      if (filtrosLigados.dataFim) {
        vooQuery.data_operacao = { ...vooQuery.data_operacao, $lte: filtrosLigados.dataFim };
      }

      const voosData = await Voo.filter(vooQuery, '-data_operacao');
      queryClient.setQueryData(['voos', empresaId], voosData);

      const vlFilters = empId ? { empresa_id: empId } : {};
      const [vlData, calculosData] = await Promise.all([
        VooLigado.filter(vlFilters, '-created_date'),
        empId
          ? fetchCalculoMap(empId)
          : Promise.resolve([]),
      ]);

      queryClient.setQueryData(['voos-ligados', empresaId], vlData);
      queryClient.setQueryData(['calculos-tarifa', empresaId], calculosData);
    } catch (error) {
      console.error('❌ Erro ao buscar voos ligados:', error);
    } finally {
      setIsFilteringLigados(false);
    }
  }, [filtrosLigados.dataInicio, filtrosLigados.dataFim, user, effectiveEmpresaIdRef, empresaId, queryClient]);

  // --- Voos Sem Link ---
  const voosSemLinkComputed = useMemo(() => {
    if (!voos.length) return [];
    const linkedVooIds = new Set();
    voosLigados.forEach(vl => {
      linkedVooIds.add(vl.id_voo_arr);
      linkedVooIds.add(vl.id_voo_dep);
    });
    return voos.filter(v => !linkedVooIds.has(v.id) && v.status !== 'Cancelado');
  }, [voos, voosLigados]);

  const loadVoosSemLink = useCallback(async () => {
    setIsLoadingSemLink(true);
    try {
      const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
      if (!empId) return;

      const { data, error } = await supabase.rpc('get_voos_sem_link', {
        p_empresa_id: empId,
        p_data_inicio: filtrosSemLink.dataInicio || null,
        p_data_fim: filtrosSemLink.dataFim || null,
        p_tipo: filtrosSemLink.tipoMovimento === 'todos' ? null : filtrosSemLink.tipoMovimento,
        p_companhia: filtrosSemLink.companhia === 'todos' ? null : filtrosSemLink.companhia,
        p_registo: filtrosSemLink.registo === 'todos' || !filtrosSemLink.registo ? null : filtrosSemLink.registo,
        p_busca: filtrosSemLink.busca || null,
      });

      if (error) throw error;
      setVoosSemLink(data || []);
      setSemLinkLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar voos sem link:', error);
    } finally {
      setIsLoadingSemLink(false);
    }
  }, [filtrosSemLink, user, effectiveEmpresaIdRef]);

  const semLinkStats = useMemo(() => {
    const source = semLinkLoaded ? voosSemLink : voosSemLinkComputed;
    const arrCount = source.filter(v => v.tipo_movimento === 'ARR').length;
    const depCount = source.filter(v => v.tipo_movimento === 'DEP').length;

    const arrVoos = source.filter(v => v.tipo_movimento === 'ARR');
    const depVoos = source.filter(v => v.tipo_movimento === 'DEP');
    let sugestoes = 0;
    arrVoos.forEach(arr => {
      if (!arr.registo_aeronave) return;
      const arrDate = new Date(arr.data_operacao);
      const hasMatch = depVoos.some(dep =>
        dep.registo_aeronave === arr.registo_aeronave &&
        new Date(dep.data_operacao) >= arrDate &&
        new Date(dep.data_operacao) <= addDays(arrDate, 7)
      );
      if (hasMatch) sugestoes++;
    });

    return { total: source.length, arr: arrCount, dep: depCount, sugestoes };
  }, [voosSemLink, voosSemLinkComputed, semLinkLoaded]);

  const getSugestoesPar = useCallback((voo) => {
    const source = semLinkLoaded ? voosSemLink : voosSemLinkComputed;
    if (!voo.registo_aeronave) return [];
    const vooDate = new Date(voo.data_operacao);

    if (voo.tipo_movimento === 'ARR') {
      return source.filter(v => {
        if (v.tipo_movimento !== 'DEP' || v.registo_aeronave !== voo.registo_aeronave || v.id === voo.id) return false;
        const vDate = new Date(v.data_operacao);
        if (vDate < vooDate || vDate > addDays(vooDate, 7)) return false;
        if (v.data_operacao === voo.data_operacao) {
          const depTime = v.horario_real || v.horario_previsto || '23:59';
          const arrTime = voo.horario_real || voo.horario_previsto || '00:00';
          if (depTime <= arrTime) return false;
        }
        return true;
      }).sort((a, b) => new Date(a.data_operacao) - new Date(b.data_operacao));
    } else {
      return source.filter(v => {
        if (v.tipo_movimento !== 'ARR' || v.registo_aeronave !== voo.registo_aeronave || v.id === voo.id) return false;
        const vDate = new Date(v.data_operacao);
        if (vDate > vooDate || vDate < addDays(vooDate, -7)) return false;
        if (v.data_operacao === voo.data_operacao) {
          const arrTime = v.horario_real || v.horario_previsto || '00:00';
          const depTime = voo.horario_real || voo.horario_previsto || '23:59';
          if (arrTime >= depTime) return false;
        }
        return true;
      }).sort((a, b) => new Date(b.data_operacao) - new Date(a.data_operacao));
    }
  }, [voosSemLink, voosSemLinkComputed, semLinkLoaded]);

  // --- Filtered + sorted voos ---
  const voosFiltrados = useMemo(() => {
    let filtered = voos;

    if (filtros.companhia === 'outro') {
      const knownCompanyCodes = new Set();
      companhias.forEach(c => { if (c.codigo_icao) knownCompanyCodes.add(c.codigo_icao); if (c.codigo_iata) knownCompanyCodes.add(c.codigo_iata); });
      filtered = filtered.filter(voo => voo.companhia_aerea && !knownCompanyCodes.has(voo.companhia_aerea));
    }

    if (filtros.busca) {
      const buscaLower = filtros.busca.toLowerCase();
      filtered = filtered.filter(voo =>
        voo.numero_voo?.toLowerCase().includes(buscaLower) ||
        voo.registo_aeronave?.toLowerCase().includes(buscaLower)
      );
    }

    if (filtros.statusVinculacao !== 'todos') {
      filtered = filtered.filter(voo => {
        const isLinked = voosLigados.some((vl) => {
          const isLinkedToThisVoo = vl.id_voo_arr === voo.id || vl.id_voo_dep === voo.id;
          if (!isLinkedToThisVoo) return false;
          const vooArrExiste = voos.some(v => v.id === vl.id_voo_arr);
          const vooDepExiste = voos.some(v => v.id === vl.id_voo_dep);
          return vooArrExiste && vooDepExiste;
        });

        if (filtros.statusVinculacao === 'ligado') return isLinked;
        if (filtros.statusVinculacao === 'sem_link') return !isLinked && voo.status !== 'Cancelado';
        return true;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;

      if (sortField === 'updated_date') {
        aValue = a.updated_date || a.created_date || '';
        bValue = b.updated_date || b.created_date || '';
      } else {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1;

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue), 'pt', { numeric: true });
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [voos, filtros, sortField, sortDirection, companhias, voosLigados]);

  // --- Filtered + sorted voos ligados ---
  const voosLigadosFiltrados = useMemo(() => {
    const filtered = voosLigadosValidos.filter(vl => {
      const arrVoo = voos.find(v => v.id === vl.id_voo_arr);
      const depVoo = voos.find(v => v.id === vl.id_voo_dep);

      if (!arrVoo || !depVoo) return false;

      const dataMatch = (!filtrosLigados.dataInicio || arrVoo.data_operacao >= filtrosLigados.dataInicio) &&
                       (!filtrosLigados.dataFim || arrVoo.data_operacao <= filtrosLigados.dataFim);

      const companhiaFiltro = filtrosLigados.companhia;
      const companhiaMatch = companhiaFiltro === 'todos' ||
                            depVoo.companhia_aerea === companhiaFiltro ||
                            companhias.some(c => (c.codigo_icao === companhiaFiltro || c.codigo_iata === companhiaFiltro) &&
                              (c.codigo_icao === depVoo.companhia_aerea || c.codigo_iata === depVoo.companhia_aerea));

      const aeroportoMatch = !filtrosLigados.aeroportos ||
                            filtrosLigados.aeroportos.length === 0 ||
                            filtrosLigados.aeroportos.includes(arrVoo.aeroporto_operacao);

      const tipoVooMatch = filtrosLigados.tipoVoo === 'todos' ||
                          depVoo.tipo_voo === filtrosLigados.tipoVoo;

      const calculo = calculosTarifa.find(ct => ct.voo_ligado_id === vl.id || ct.voo_id === depVoo?.id);
      let statusCalculoMatch = true;
      if (filtrosLigados.statusCalculo !== 'todos') {
        if (filtrosLigados.statusCalculo === 'com_calculo') {
          statusCalculoMatch = calculo && calculo.tipo_tarifa !== 'Voo Isento de Tarifas';
        } else if (filtrosLigados.statusCalculo === 'sem_calculo') {
          statusCalculoMatch = !calculo;
        } else if (filtrosLigados.statusCalculo === 'isento') {
          statusCalculoMatch = calculo && calculo.tipo_tarifa === 'Voo Isento de Tarifas';
        } else if (filtrosLigados.statusCalculo === 'zerado') {
          statusCalculoMatch = calculo && (calculo.total_tarifa === 0 || calculo.total_tarifa_usd === 0) && calculo.tipo_tarifa !== 'Voo Isento de Tarifas';
        }
      }

      const tempoPermanenciaHoras = vl.tempo_permanencia_min / 60;
      const permanenciaMinMatch = !filtrosLigados.permanenciaMin ||
                                 tempoPermanenciaHoras >= parseFloat(filtrosLigados.permanenciaMin);
      const permanenciaMaxMatch = !filtrosLigados.permanenciaMax ||
                                 tempoPermanenciaHoras <= parseFloat(filtrosLigados.permanenciaMax);

      const buscaMatch = !filtrosLigados.busca ||
                        arrVoo.numero_voo?.toLowerCase().includes(filtrosLigados.busca.toLowerCase()) ||
                        depVoo.numero_voo?.toLowerCase().includes(filtrosLigados.busca.toLowerCase()) ||
                        depVoo.registo_aeronave?.toLowerCase().includes(filtrosLigados.busca.toLowerCase());

      return dataMatch && companhiaMatch && aeroportoMatch && tipoVooMatch &&
             statusCalculoMatch && permanenciaMinMatch && permanenciaMaxMatch && buscaMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const arrVooA = voos.find(v => v.id === a.id_voo_arr);
      const depVooA = voos.find(v => v.id === a.id_voo_dep);
      const arrVooB = voos.find(v => v.id === b.id_voo_arr);
      const depVooB = voos.find(v => v.id === b.id_voo_dep);

      let aValue, bValue;

      switch (sortFieldLigados) {
        case 'numero_voo':
          aValue = depVooA?.numero_voo || '';
          bValue = depVooB?.numero_voo || '';
          break;
        case 'horario_arr':
          aValue = arrVooA?.data_operacao && arrVooA?.horario_real ? `${arrVooA.data_operacao}T${arrVooA.horario_real}` : '';
          bValue = arrVooB?.data_operacao && arrVooB?.horario_real ? `${arrVooB.data_operacao}T${arrVooB.horario_real}` : '';
          break;
        case 'horario_dep':
          aValue = depVooA?.data_operacao && depVooA?.horario_real ? `${depVooA.data_operacao}T${depVooA.horario_real}` : '';
          bValue = depVooB?.data_operacao && depVooB?.horario_real ? `${depVooB.data_operacao}T${depVooB.horario_real}` : '';
          break;
        case 'registo_aeronave':
          aValue = depVooA?.registo_aeronave || '';
          bValue = depVooB?.registo_aeronave || '';
          break;
        case 'companhia_aerea':
          aValue = depVooA?.companhia_aerea || '';
          bValue = depVooB?.companhia_aerea || '';
          break;
        case 'tempo_permanencia_min':
          aValue = a.tempo_permanencia_min || 0;
          bValue = b.tempo_permanencia_min || 0;
          break;
        case 'total_tarifa': {
          const calculoA = calculosTarifa.find(ct => ct.voo_ligado_id === a.id || ct.voo_id === depVooA?.id);
          const calculoB = calculosTarifa.find(ct => ct.voo_ligado_id === b.id || ct.voo_id === depVooB?.id);
          aValue = calculoA?.total_tarifa || 0;
          bValue = calculoB?.total_tarifa || 0;
          break;
        }
        case 'updated_date': {
          const calcA = calculosTarifa.find(ct => ct.voo_ligado_id === a.id || ct.voo_id === depVooA?.id);
          const calcB = calculosTarifa.find(ct => ct.voo_ligado_id === b.id || ct.voo_id === depVooB?.id);
          aValue = calcA?.updated_date || depVooA?.updated_date || '';
          bValue = calcB?.updated_date || depVooB?.updated_date || '';
          break;
        }
        default:
          aValue = '';
          bValue = '';
      }

      if (aValue === null || aValue === undefined) return sortDirectionLigados === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDirectionLigados === 'asc' ? 1 : -1;

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue), 'pt', { numeric: true });
      }

      return sortDirectionLigados === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [voosLigadosValidos, voos, calculosTarifa, filtrosLigados, sortFieldLigados, sortDirectionLigados, companhias]);

  // --- Select options ---
  const companhiaOptions = useMemo(() => {
    const options = [{ value: 'todos', label: t('operacoes.todas_companhias') }];
    const knownCompanyCodes = new Set();
    companhias.forEach(c => {
      options.push({ value: c.codigo_icao, label: `${c.nome} (${c.codigo_icao})` });
      knownCompanyCodes.add(c.codigo_icao);
    });
    const hasOtherCompanies = voos.some(voo => voo.companhia_aerea && !knownCompanyCodes.has(voo.companhia_aerea));
    if (hasOtherCompanies) {
      options.push({ value: 'outro', label: t('operacoes.outra_companhia') });
    }
    return options;
  }, [companhias, voos, t]);

  const aeroportoOptions = useMemo(() => ([
    { value: 'todos', label: t('operacoes.todos_aeroportos') },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))
  ]), [aeroportos, t]);

  const tipoMovimentoOptions = useMemo(() => [
      { value: "todos", label: t('operacoes.todos') },
      { value: "ARR", label: t('operacoes.chegada') },
      { value: "DEP", label: t('operacoes.partida') },
  ], [t]);

  const tipoVooOptions = useMemo(() => [
    { value: 'todos', label: t('operacoes.todos') },
    { value: 'Regular', label: t('operacoes.regular') },
    { value: 'Não Regular', label: t('operacoes.nao_regular') },
    { value: 'Humanitário', label: t('operacoes.humanitario') },
    { value: 'Charter', label: t('operacoes.charter') },
    { value: 'Carga', label: t('operacoes.carga') },
    { value: 'Privado', label: t('operacoes.privado') },
    { value: 'Militar', label: t('operacoes.militar') },
    { value: 'Oficial', label: t('operacoes.oficial') },
    { value: 'Técnico', label: t('operacoes.tecnico') },
    { value: 'Outro', label: t('operacoes.outro') }
  ], [t]);

  const statusOptions = useMemo(() => ([
    { value: 'todos', label: t('operacoes.todos') },
    { value: 'Programado', label: t('operacoes.programado') },
    { value: 'Realizado', label: t('operacoes.realizado') },
    { value: 'Cancelado', label: t('operacoes.cancelado') },
  ]), [t]);

  const statusVinculacaoOptions = useMemo(() => [
    { value: 'todos', label: t('operacoes.todos_voos') },
    { value: 'ligado', label: t('operacoes.apenas_ligados') },
    { value: 'sem_link', label: t('operacoes.apenas_sem_link') }
  ], [t]);

  return {
    // Voos filters
    filtros,
    isFiltering,
    handleFilterChange,
    handleBuscarVoos,
    clearFilters,

    // Voos Ligados filters
    filtrosLigados,
    isFilteringLigados,
    handleFilterChangeLigados,
    handleBuscarLigados,
    clearFiltersLigados,

    // Sem Link
    voosSemLink,
    voosSemLinkComputed,
    isLoadingSemLink,
    isLinkingAuto,
    setIsLinkingAuto,
    filtrosSemLink,
    semLinkLoaded,
    loadVoosSemLink,
    semLinkStats,
    getSugestoesPar,
    handleFilterChangeSemLink,

    // Sort
    sortField,
    sortDirection,
    handleSort,
    sortFieldLigados,
    sortDirectionLigados,
    handleSortLigados,

    // Filtered/sorted results
    voosFiltrados,
    voosLigadosFiltrados,

    // Select options
    companhiaOptions,
    aeroportoOptions,
    tipoMovimentoOptions,
    tipoVooOptions,
    statusOptions,
    statusVinculacaoOptions,
  };
}
