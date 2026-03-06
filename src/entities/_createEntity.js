import { supabase } from '@/lib/supabaseClient';

const PAGE_SIZE = 1000;

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
      // Operator-based filters: { $eq: x, $gte: y, $lte: z, ... }
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

export function createEntity(tableName) {
  return {
    async list(orderBy, limit) {
      let query = supabase.from(tableName).select('*');

      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const column = desc ? orderBy.slice(1) : orderBy;
        query = query.order(column, { ascending: !desc });
      } else {
        query = query.order('created_date', { ascending: false });
      }

      if (limit) {
        query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }

      return fetchAll(query);
    },

    async filter(filters, orderBy, limit, skip) {
      let query = supabase.from(tableName).select('*');

      query = applyFilters(query, filters);

      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const column = desc ? orderBy.slice(1) : orderBy;
        query = query.order(column, { ascending: !desc });
      }

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
      const { data, error } = await supabase
        .from(tableName)
        .insert({
          ...record,
          created_date: record.created_date || new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, changes) {
      const { data, error } = await supabase
        .from(tableName)
        .update({
          ...changes,
          updated_date: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  };
}
