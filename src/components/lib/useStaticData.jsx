import { useQuery } from '@tanstack/react-query';
import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { RegistoAeronave } from '@/entities/RegistoAeronave';
import { ModeloAeronave } from '@/entities/ModeloAeronave';

// Cache global — these tables are not partitioned by empresa,
// so the queryKey is empresa-independent. Switching empresa view
// no longer triggers redundant refetches.
const STATIC_CACHE_TIME = 1000 * 60 * 5;

export function useAeroportos() {
  return useQuery({
    queryKey: ['aeroportos'],
    queryFn: () => Aeroporto.list(),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useCompanhias() {
  return useQuery({
    queryKey: ['companhias'],
    queryFn: () => CompanhiaAerea.list(),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useAeronaves() {
  return useQuery({
    queryKey: ['aeronaves'],
    queryFn: () => RegistoAeronave.list(),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useModelosAeronave() {
  return useQuery({
    queryKey: ['modelos'],
    queryFn: () => ModeloAeronave.list(),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

// Tariff hooks include empresa-scoped + global rows (empresa_id IS NULL).
// Client code (useOperacoesData / filterTarifasByEmpresa) handles the filter.
export function useTarifasPouso() {
  return useQuery({
    queryKey: ['tarifas-pouso'],
    queryFn: () => import('@/entities/TarifaPouso').then(({ TarifaPouso }) => TarifaPouso.list()),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useTarifasPermanencia() {
  return useQuery({
    queryKey: ['tarifas-permanencia'],
    queryFn: () => import('@/entities/TarifaPermanencia').then(({ TarifaPermanencia }) => TarifaPermanencia.list()),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useOutrasTarifas() {
  return useQuery({
    queryKey: ['outras-tarifas'],
    queryFn: () => import('@/entities/OutraTarifa').then(({ OutraTarifa }) => OutraTarifa.list()),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useImpostos() {
  return useQuery({
    queryKey: ['impostos'],
    queryFn: () => import('@/entities/Imposto').then(({ Imposto }) => Imposto.list()),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}
