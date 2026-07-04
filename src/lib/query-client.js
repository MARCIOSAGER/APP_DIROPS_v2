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

// Mapa tabela (entidade) -> chave-base de react-query usada na UI.
// invalidateQueries faz prefix-match, entao a chave-base ['voos'] tambem
// invalida ['voos', empresaId] etc.
const ENTITY_QUERY_KEYS = {
	aeroporto: ['aeroportos'],
	companhia_aerea: ['companhias'],
	registo_aeronave: ['aeronaves'],
	modelo_aeronave: ['modelos'],
	tarifa_pouso: ['tarifas-pouso'],
	tarifa_permanencia: ['tarifas-permanencia'],
	outra_tarifa: ['outras-tarifas'],
	imposto: ['impostos'],
	voo: ['voos'],
	voo_ligado: ['voos-ligados'],
	calculo_tarifa: ['calculos-tarifa'],
	ocorrencia_safety: ['ocorrencias'],
};

// Chamado pela camada de entidades apos create/update/delete/bulkCreate.
// Garante que listas em cache reflitam a mudanca sem precisar de F5.
// DEBOUNCED por tabela (300ms): um loop de N creates (ex.: import) dispara
// apenas 1 refetch no fim, em vez de N. Nunca lanca.
const _invalTimers = {};
export function invalidateEntityQueries(tableName) {
	if (!tableName) return;
	if (_invalTimers[tableName]) clearTimeout(_invalTimers[tableName]);
	_invalTimers[tableName] = setTimeout(() => {
		delete _invalTimers[tableName];
		try {
			const keys = ENTITY_QUERY_KEYS[tableName];
			if (keys) {
				for (const k of keys) queryClientInstance.invalidateQueries({ queryKey: [k] });
			}
			// Fallback: tambem invalida pela propria tabela (caso algum hook use a chave crua).
			queryClientInstance.invalidateQueries({ queryKey: [tableName] });
		} catch {
			/* no-op */
		}
	}, 300);
}
