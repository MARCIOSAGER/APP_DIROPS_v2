/**
 * Cache para tarifas frequentemente usadas
 * Reduz lookups em arrays e melhora performance
 */
class TariffCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutos
  }

  generateKey(type, ...params) {
    return `${type}:${params.join(':').toLowerCase()}`;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Verificar se expirou
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear() {
    this.cache.clear();
  }

  // Criar índices para lookups rápidos
  buildTarifaPosusoIndex(tarifas) {
    const key = this.generateKey('index', 'pouso', tarifas.length);
    let index = this.get(key);

    if (!index) {
      index = {};
      tarifas.forEach(t => {
        if (t.status === 'ativa') {
          const indexKey = `${t.categoria_aeroporto}`;
          if (!index[indexKey]) index[indexKey] = [];
          index[indexKey].push(t);
        }
      });
      this.set(key, index);
    }

    return index;
  }

  buildTarifaPermanenciaIndex(tarifas) {
    const key = this.generateKey('index', 'permanencia', tarifas.length);
    let index = this.get(key);

    if (!index) {
      index = {};
      tarifas.forEach(t => {
        if (t.status === 'ativa') {
          const indexKey = t.categoria_aeroporto;
          index[indexKey] = t; // Única tarifa por categoria
        }
      });
      this.set(key, index);
    }

    return index;
  }

  buildOutrasTarifasIndex(tarifas) {
    const key = this.generateKey('index', 'outras', tarifas.length);
    let index = this.get(key);

    if (!index) {
      index = {};
      tarifas.forEach(t => {
        if (t.status === 'ativa') {
          const indexKey = `${t.tipo}:${t.categoria_aeroporto}`;
          if (!index[indexKey]) index[indexKey] = [];
          index[indexKey].push(t);
        }
      });
      this.set(key, index);
    }

    return index;
  }
}

export const tariffCache = new TariffCache();