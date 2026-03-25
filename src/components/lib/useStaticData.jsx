import { useQuery } from '@tanstack/react-query';
import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { RegistoAeronave } from '@/entities/RegistoAeronave';
import { ModeloAeronave } from '@/entities/ModeloAeronave';
import { useCompanyView } from '@/lib/CompanyViewContext';

// Cache de 5 minutos para dados que podem mudar
const STATIC_CACHE_TIME = 1000 * 60 * 5; // 5 minutos

export function useAeroportos() {
  const { effectiveEmpresaId } = useCompanyView();
  return useQuery({
    queryKey: ['aeroportos', effectiveEmpresaId],
    queryFn: () => Aeroporto.list(),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useCompanhias() {
  const { effectiveEmpresaId } = useCompanyView();
  return useQuery({
    queryKey: ['companhias', effectiveEmpresaId],
    queryFn: () => CompanhiaAerea.list(),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useAeronaves() {
  const { effectiveEmpresaId } = useCompanyView();
  return useQuery({
    queryKey: ['aeronaves', effectiveEmpresaId],
    queryFn: () => RegistoAeronave.list(),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useModelosAeronave() {
  const { effectiveEmpresaId } = useCompanyView();
  return useQuery({
    queryKey: ['modelos', effectiveEmpresaId],
    queryFn: () => ModeloAeronave.list(),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useTarifasPouso() {
  const { effectiveEmpresaId } = useCompanyView();
  return useQuery({
    queryKey: ['tarifas-pouso', effectiveEmpresaId],
    queryFn: () => import('@/entities/TarifaPouso').then(({ TarifaPouso }) => TarifaPouso.list()),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useTarifasPermanencia() {
  const { effectiveEmpresaId } = useCompanyView();
  return useQuery({
    queryKey: ['tarifas-permanencia', effectiveEmpresaId],
    queryFn: () => import('@/entities/TarifaPermanencia').then(({ TarifaPermanencia }) => TarifaPermanencia.list()),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}

export function useOutrasTarifas() {
  const { effectiveEmpresaId } = useCompanyView();
  return useQuery({
    queryKey: ['outras-tarifas', effectiveEmpresaId],
    queryFn: () => import('@/entities/OutraTarifa').then(({ OutraTarifa }) => OutraTarifa.list()),
    staleTime: STATIC_CACHE_TIME,
    gcTime: STATIC_CACHE_TIME * 2,
    refetchOnWindowFocus: false,
  });
}
