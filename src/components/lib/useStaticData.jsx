import { useQuery } from '@tanstack/react-query';
import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { RegistoAeronave } from '@/entities/RegistoAeronave';
import { ModeloAeronave } from '@/entities/ModeloAeronave';

// Cache de 5 minutos para dados que podem mudar
const STATIC_CACHE_TIME = 1000 * 60 * 5; // 5 minutos

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

export async function useTarifas() {
  const [tarifasPouso, tarifasPermanencia, outrasTarifas] = await Promise.all([
    useQuery({
      queryKey: ['tarifas-pouso'],
      queryFn: () => import('@/entities/TarifaPouso').then(({ TarifaPouso }) => TarifaPouso.list()),
      staleTime: STATIC_CACHE_TIME,
      gcTime: STATIC_CACHE_TIME * 2,
      refetchOnWindowFocus: false,
    }),
    useQuery({
      queryKey: ['tarifas-permanencia'],
      queryFn: () => import('@/entities/TarifaPermanencia').then(({ TarifaPermanencia }) => TarifaPermanencia.list()),
      staleTime: STATIC_CACHE_TIME,
      gcTime: STATIC_CACHE_TIME * 2,
      refetchOnWindowFocus: false,
    }),
    useQuery({
      queryKey: ['outras-tarifas'],
      queryFn: () => import('@/entities/OutraTarifa').then(({ OutraTarifa }) => OutraTarifa.list()),
      staleTime: STATIC_CACHE_TIME,
      gcTime: STATIC_CACHE_TIME * 2,
      refetchOnWindowFocus: false,
    }),
  ]);

  return { tarifasPouso, tarifasPermanencia, outrasTarifas };
}