import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 3,       // 3 min (was 2 min — tuned for slow connectivity)
			gcTime: 1000 * 60 * 15,          // 15 min (was 10 min — keep cache warm)
			refetchOnWindowFocus: false,      // keep unchanged
			refetchOnReconnect: true,         // add — refetch when network returns
			networkMode: 'offlineFirst',      // add — serve cache when offline instead of error
			retry: 2,
			retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
		},
		mutations: {
			retry: 1,
			networkMode: 'offlineFirst',      // add — consistent with queries
		},
	},
});
