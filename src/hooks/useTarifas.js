import { useQuery } from '@tanstack/react-query';
import { TarifaPouso } from '@/entities/TarifaPouso';
import { TarifaPermanencia } from '@/entities/TarifaPermanencia';
import { OutraTarifa } from '@/entities/OutraTarifa';
import { Imposto } from '@/entities/Imposto';
import { TarifaRecurso } from '@/entities/TarifaRecurso';

// Helper: fetch tarifas scoped to empresa + global (null empresa_id) for fallback
async function fetchTarifasScoped(Entity, empresaId) {
  if (!empresaId) return Entity.list();
  const [empresaData, globalData] = await Promise.all([
    Entity.filter({ empresa_id: { $eq: empresaId } }),
    Entity.filter({ empresa_id: { $is: null } }),
  ]);
  return empresaData.length > 0 ? empresaData : globalData;
}

export function useTarifas({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['tarifas', empresaId],
    queryFn: async () => {
      const [
        tarifasPousoData,
        tarifasPermanenciaData,
        outrasTarifasData,
        impostosData,
        tarifasRecursosData,
      ] = await Promise.all([
        fetchTarifasScoped(TarifaPouso, empresaId),
        fetchTarifasScoped(TarifaPermanencia, empresaId),
        fetchTarifasScoped(OutraTarifa, empresaId),
        fetchTarifasScoped(Imposto, empresaId),
        fetchTarifasScoped(TarifaRecurso, empresaId),
      ]);
      return {
        tarifasPouso: tarifasPousoData,
        tarifasPermanencia: tarifasPermanenciaData,
        outrasTarifas: outrasTarifasData,
        impostos: impostosData,
        tarifasRecursos: tarifasRecursosData || [],
      };
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
