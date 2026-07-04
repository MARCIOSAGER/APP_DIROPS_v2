import { supabase } from '@/lib/supabaseClient';
import { invalidateEntityQueries } from '@/lib/query-client';

// On-premise: DB is local, fetch bigger pages = fewer round-trips
const PAGE_SIZE = 5000;

async function fetchAll(query) {
  let allData = [];
  let from = 0;

  while (true) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

function applyFilters(query, filters) {
  Object.entries(filters).forEach(([key, value]) => {
    if (value === null) {
      query = query.is(key, null);
    } else if (Array.isArray(value)) {
      query = query.in(key, value);
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([op, opValue]) => {
        switch (op) {
          case '$eq':
            query = opValue === null ? query.is(key, null) : query.eq(key, opValue);
            break;
          case '$neq':
          case '$ne':
            query = query.neq(key, opValue);
            break;
          case '$gt':
            query = query.gt(key, opValue);
            break;
          case '$gte':
            query = query.gte(key, opValue);
            break;
          case '$lt':
            query = query.lt(key, opValue);
            break;
          case '$lte':
            query = query.lte(key, opValue);
            break;
          case '$in':
            query = query.in(key, opValue);
            break;
          case '$contains':
            query = query.contains(key, opValue);
            break;
          case '$like':
          case '$ilike':
            query = query.ilike(key, opValue);
            break;
          case '$is':
            query = query.is(key, opValue);
            break;
          case '$not':
            query = query.not(key, 'is', opValue);
            break;
          default:
            console.warn(`[createEntity] Unknown filter operator: ${op}`);
        }
      });
    } else {
      query = query.eq(key, value);
    }
  });
  return query;
}

function applyOrder(query, orderBy) {
  if (orderBy) {
    const desc = orderBy.startsWith('-');
    const column = desc ? orderBy.slice(1) : orderBy;
    query = query.order(column, { ascending: !desc });
  } else {
    query = query.order('created_date', { ascending: false });
  }
  return query;
}

let _cachedEmail = null;
let _cachedEmailTime = 0;
const EMAIL_CACHE_TTL = 60000;

async function getCurrentUserEmail() {
  if (_cachedEmail && Date.now() - _cachedEmailTime < EMAIL_CACHE_TTL) {
    return _cachedEmail;
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    _cachedEmail = user?.email || null;
    _cachedEmailTime = Date.now();
    return _cachedEmail;
  } catch {
    return null;
  }
}

export function createEntity(tableName) {
  return {
    // === Original methods (backward compatible) ===

    async list(orderBy, limit, select = '*') {
      let query = supabase.from(tableName).select(select);
      query = applyOrder(query, orderBy);

      if (limit) {
        query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }

      return fetchAll(query);
    },

    async filter(filters, orderBy, limit, skip, select = '*') {
      let query = supabase.from(tableName).select(select);
      query = applyFilters(query, filters);
      query = applyOrder(query, orderBy);

      if (limit) {
        const from = skip || 0;
        query = query.range(from, from + limit - 1);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }

      return fetchAll(query);
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async create(record) {
      // *_by columns aren't universal (users/empresa/etc. don't have them);
      // callers that care about audit tracking pass them explicitly.
      const payload = {
        ...record,
        created_date: record.created_date || new Date().toISOString(),
      };
      // id nulo/vazio quebra o DEFAULT do Postgres (NULL explícito != coluna omitida).
      // Omitir deixa o uuid_generate_v4() gerar o id.
      if (payload.id == null || payload.id === '') delete payload.id;
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao criar ${tableName}: ${error.message}`);
      invalidateEntityQueries(tableName);
      return data;
    },

    /**
     * Insert multiple records in a single round-trip.
     * Returns the array of created rows.
     */
    async bulkCreate(records) {
      if (!Array.isArray(records) || records.length === 0) return [];
      const now = new Date().toISOString();
      const payload = records.map(r => {
        const row = { ...r, created_date: r.created_date || now };
        if (row.id == null || row.id === '') delete row.id;
        return row;
      });
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select();
      if (error) throw new Error(`Erro ao criar ${tableName} em lote: ${error.message}`);
      invalidateEntityQueries(tableName);
      return data || [];
    },

    async update(id, changes) {
      // *_by columns aren't universal — see create() comment.
      const payload = {
        ...changes,
        updated_date: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao atualizar ${tableName}: ${error.message}`);
      invalidateEntityQueries(tableName);
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw new Error(`Erro ao eliminar ${tableName}: ${error.message}`);
      invalidateEntityQueries(tableName);
    },

    // === New professional methods ===

    /**
     * Paginated query with server-side count.
     * Returns { data: [], total: number, page, pageSize }
     */
    async paginate({ filters = {}, orderBy, page = 1, pageSize = 50, select = '*' } = {}) {
      let query = supabase.from(tableName).select(select, { count: 'exact' });
      query = applyFilters(query, filters);
      query = applyOrder(query, orderBy);

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },

    /**
     * Count records with optional filters (no data transfer).
     */
    async count(filters = {}) {
      let query = supabase.from(tableName).select('id', { count: 'exact', head: true });
      query = applyFilters(query, filters);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },

    /**
     * Find first matching record.
     */
    async findOne(filters, orderBy) {
      let query = supabase.from(tableName).select('*');
      query = applyFilters(query, filters);
      query = applyOrder(query, orderBy);
      query = query.limit(1).maybeSingle();
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  };
}
