import { useQuery } from '@tanstack/react-query';
import { CacheVooFlightAware } from '@/entities/CacheVooFlightAware';

/**
 * Fetches CacheVooFlightAware (primary), keyed by airport/date/status filters.
 * Disabled by default — call refetch() after user sets filters.
 */
export function useCacheFlightAware({ airportIcao, startDate, endDate, statusFilter, enabled = false } = {}) {
  return useQuery({
    queryKey: ['cacheFlightAware', airportIcao, startDate, endDate, statusFilter],
    queryFn: async () => {
      const filters = { airport_icao: airportIcao };
      if (startDate) filters.data_voo = { $gte: startDate };
      if (endDate) filters.data_voo = { ...filters.data_voo, $lte: endDate };
      if (statusFilter && statusFilter !== 'todos') filters.status = statusFilter;

      return CacheVooFlightAware.filter(filters, '-data_voo');
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
