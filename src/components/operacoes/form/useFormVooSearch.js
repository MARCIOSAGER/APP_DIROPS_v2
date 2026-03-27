import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { RegistoAeronave } from '@/entities/RegistoAeronave';

// Cache de companhias (modulo-level, carregado uma vez)
let _companhiasCache = null;
let _companhiasCacheLoading = null;

export async function loadCompanhiasCache() {
  if (_companhiasCache) return _companhiasCache;
  if (_companhiasCacheLoading) return _companhiasCacheLoading;
  _companhiasCacheLoading = CompanhiaAerea.list().then(data => {
    _companhiasCache = Array.isArray(data) ? data : [];
    _companhiasCacheLoading = null;
    return _companhiasCache;
  }).catch(() => {
    _companhiasCacheLoading = null;
    return [];
  });
  return _companhiasCacheLoading;
}

/**
 * Hook that provides async search and initial-option-lookup functions
 * for companhias, aeroportos, and registos.
 */
export default function useFormVooSearch({
  formData,
  companhias,
  aeronaves,
  aeroportosOrigemDestino
}) {

  // --- Companhias ---
  const searchCompanhias = async (searchTerm) => {
    try {
      if (!searchTerm || searchTerm.length < 2) return [];

      const allCompanhias = await loadCompanhiasCache();

      const searchLower = searchTerm.toLowerCase();
      return allCompanhias
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
      const allCompanhias = await loadCompanhiasCache();
      const companhia = allCompanhias.find(c => c && c.codigo_icao === codigoIcao);
      if (companhia) {
        return {
          value: companhia.codigo_icao,
          label: `${companhia.nome || 'Sem nome'} (${companhia.codigo_icao})`
        };
      }
    } catch (err) {
      console.error('Erro ao carregar companhia inicial:', err);
    }
    return null;
  };

  // --- Aeroportos ---
  const searchAeroportos = async (searchTerm) => {
    const searchLower = searchTerm.toLowerCase();
    const source = aeroportosOrigemDestino?.length > 0 ? aeroportosOrigemDestino : [];
    return source
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

  // --- Registos ---
  const searchRegistos = async (searchTerm, allCompanies = false) => {
    try {
      if (!formData.companhia_aerea && !allCompanies) return [];

      let results;
      if (allCompanies) {
        if (!searchTerm) return [];
        results = await RegistoAeronave.filter({ registo: { $like: `%${searchTerm}%` } });
      } else {
        const allCompanhias = await loadCompanhiasCache();
        const companhiaSelecionada = allCompanhias.find(c => c.codigo_icao === formData.companhia_aerea)
          || companhias.find(c => c.codigo_icao === formData.companhia_aerea);
        if (!companhiaSelecionada) return [];
        results = await RegistoAeronave.filter({ id_companhia_aerea: companhiaSelecionada.id });
      }

      const searchLower = (searchTerm || '').toLowerCase();
      return results
        .filter(r => !searchLower || r.registo?.toLowerCase().includes(searchLower))
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

  return {
    searchCompanhias,
    getCompanhiaInicial,
    searchAeroportos,
    getAeroportoInicial,
    searchRegistos,
    getRegistoInicial
  };
}
