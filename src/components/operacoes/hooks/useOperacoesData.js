import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { hasUserProfile, getAeroportosPermitidos } from '@/components/lib/userUtils';
import { ConfiguracaoSistema } from '@/entities/ConfiguracaoSistema';
import { useAeroportos, useCompanhias, useAeronaves, useModelosAeronave, useTarifasPouso, useTarifasPermanencia, useOutrasTarifas, useImpostos } from '@/components/lib/useStaticData';
import { useCompanyView } from '@/lib/CompanyViewContext';
import { useAuth } from '@/lib/AuthContext';
import { useVoos } from '@/hooks/useVoos';
import { useVoosLigados } from '@/hooks/useVoosLigados';
import { useCalculosTarifa } from '@/hooks/useCalculosTarifa';
import { useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';

// Helper: filtra tarifas por empresa_id
function filterTarifasByEmpresa(tarifas, empresaId) {
  if (!empresaId) return tarifas;
  const empresaTarifas = tarifas.filter(t => t.empresa_id === empresaId);
  const globalTarifas = tarifas.filter(t => !t.empresa_id);
  return empresaTarifas.length > 0 ? empresaTarifas : globalTarifas;
}

/**
 * Hook that manages all data loading and derived data for Operacoes page.
 */
export function useOperacoesData() {
  const { effectiveEmpresaId } = useCompanyView();
  const { user } = useAuth();
  const effectiveEmpresaIdRef = useRef(effectiveEmpresaId);
  effectiveEmpresaIdRef.current = effectiveEmpresaId;

  const [configuracaoSistema, setConfiguracaoSistema] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Static data hooks
  const { data: aeroportosCache = [], isLoading: isLoadingAeroportos } = useAeroportos();
  const { data: companhiasCache = [], isLoading: isLoadingCompanhias } = useCompanhias();
  const { data: aeronavesCache = [], isLoading: isLoadingAeronaves } = useAeronaves();
  const { data: modelosCache = [], isLoading: isLoadingModelos } = useModelosAeronave();
  const { data: tarifasPousoCache = [], isLoading: isLoadingTarifasPouso } = useTarifasPouso();
  const { data: tarifasPermanenciaCache = [], isLoading: isLoadingTarifasPermanencia } = useTarifasPermanencia();
  const { data: outrasTarifasCache = [], isLoading: isLoadingOutrasTarifas } = useOutrasTarifas();
  const { data: impostosCache = [], isLoading: isLoadingImpostos } = useImpostos();

  const empresaId = effectiveEmpresaId || user?.empresa_id;
  const queryClient = useQueryClient();

  // Main entity data via TanStack Query
  const { data: voos = [], isLoading: isLoadingVoos } = useVoos({ empresaId });
  const { data: voosLigados = [], isLoading: isLoadingVoosLigados } = useVoosLigados({ empresaId });
  const { data: calculosTarifa = [], isLoading: isLoadingCalculos } = useCalculosTarifa({ empresaId });

  const isLoadingAll = isLoading || isLoadingVoos || isLoadingVoosLigados || isLoadingCalculos;

  const loadData = useCallback(async () => {
    if (hasUserProfile(user, 'gestor_empresa')) {
      window.location.href = createPageUrl('Credenciamento');
      return;
    }
    setIsLoading(true);
    try {
      const configData = await ConfiguracaoSistema.list().catch(() => []);
      const configuracaoSistemaData = configData.length > 0 ? configData[0] : { taxa_cambio_usd_aoa: 850 };
      setConfiguracaoSistema(configuracaoSistemaData);
    } catch (error) {
      console.error('Erro ao carregar configuracao:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData, effectiveEmpresaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // R-01: Derive data from TanStack cache via useMemo
  const todosAeroportos = useMemo(() => aeroportosCache || [], [aeroportosCache]);
  const aeroportos = useMemo(() => {
    if (!aeroportosCache?.length || !user) return [];
    const allAngolan = aeroportosCache.filter(a => a.pais === 'AO');
    return getAeroportosPermitidos(user, allAngolan, effectiveEmpresaIdRef.current);
  }, [aeroportosCache, user]);
  const companhias = useMemo(() => companhiasCache || [], [companhiasCache]);
  const aeronaves = useMemo(() => aeronavesCache || [], [aeronavesCache]);
  const modelosAeronave = useMemo(() => modelosCache || [], [modelosCache]);

  const empId = effectiveEmpresaIdRef.current || user?.empresa_id;
  const tarifasPouso = useMemo(() => filterTarifasByEmpresa(tarifasPousoCache || [], empId), [tarifasPousoCache, empId]);
  const tarifasPermanencia = useMemo(() => filterTarifasByEmpresa(tarifasPermanenciaCache || [], empId), [tarifasPermanenciaCache, empId]);
  const outrasTarifas = useMemo(() => filterTarifasByEmpresa(outrasTarifasCache || [], empId), [outrasTarifasCache, empId]);
  const impostos = useMemo(() => filterTarifasByEmpresa(impostosCache || [], empId), [impostosCache, empId]);

  // Deduped valid linked flights
  const voosLigadosValidos = useMemo(() => {
    const seen = new Set();
    return voosLigados.filter(vooLigado => {
      if (seen.has(vooLigado.id)) return false;
      seen.add(vooLigado.id);
      const vooArrExiste = voos.some(v => v.id === vooLigado.id_voo_arr);
      const vooDepExiste = voos.some(v => v.id === vooLigado.id_voo_dep);
      return vooArrExiste && vooDepExiste;
    });
  }, [voos, voosLigados]);

  // Configuration object for tariff calculations
  const configuracao = useMemo(() => ({
    aeroportos: todosAeroportos,
    aeronaves: aeronaves,
    tarifasPouso: tarifasPouso,
    tarifasPermanencia: tarifasPermanencia,
    outrasTarifas: outrasTarifas,
    impostos: impostos,
    taxaCambio: configuracaoSistema?.taxa_cambio_usd_aoa || 850
  }), [todosAeroportos, aeronaves, tarifasPouso, tarifasPermanencia, outrasTarifas, impostos, configuracaoSistema]);

  return {
    // Context
    user,
    effectiveEmpresaId,
    effectiveEmpresaIdRef,
    empresaId,
    queryClient,

    // Loading
    isLoading,
    isLoadingAll,
    loadData,

    // Config
    configuracaoSistema,
    configuracao,

    // Main data
    voos,
    voosLigados,
    calculosTarifa,
    voosLigadosValidos,

    // Static/derived data
    todosAeroportos,
    aeroportos,
    companhias,
    companhiasCache,
    aeronaves,
    modelosAeronave,
    tarifasPouso,
    tarifasPermanencia,
    outrasTarifas,
    impostos,
  };
}
