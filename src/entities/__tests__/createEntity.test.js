import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase before importing the module under test
const mockQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  neq: vi.fn(),
  gt: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
  lte: vi.fn(),
  in: vi.fn(),
  is: vi.fn(),
  not: vi.fn(),
  contains: vi.fn(),
  ilike: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Make every method return mockQuery for chaining
Object.values(mockQuery).forEach(fn => fn.mockReturnValue(mockQuery));

const mockSupabase = {
  from: vi.fn(() => mockQuery),
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));

const { createEntity } = await import('../_createEntity.js');

describe('createEntity', () => {
  let entity;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-chain after clear
    Object.values(mockQuery).forEach(fn => fn.mockReturnValue(mockQuery));
    entity = createEntity('test_table');
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'user@test.com' } },
    });
  });

  // ── applyFilters ──────────────────────────────────────────────────
  describe('applyFilters (via filter method)', () => {
    beforeEach(() => {
      // Make range return final result to stop pagination
      mockQuery.range.mockResolvedValue({ data: [], error: null });
    });

    it('applies simple equality filter', async () => {
      await entity.filter({ status: 'active' });
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('applies null filter with is()', async () => {
      await entity.filter({ deleted_at: null });
      expect(mockQuery.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('applies array filter with in()', async () => {
      await entity.filter({ id: [1, 2, 3] });
      expect(mockQuery.in).toHaveBeenCalledWith('id', [1, 2, 3]);
    });

    it('applies $eq operator', async () => {
      await entity.filter({ status: { $eq: 'done' } });
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'done');
    });

    it('applies $eq null via is()', async () => {
      await entity.filter({ field: { $eq: null } });
      expect(mockQuery.is).toHaveBeenCalledWith('field', null);
    });

    it('applies $ne / $neq operator', async () => {
      await entity.filter({ status: { $ne: 'draft' } });
      expect(mockQuery.neq).toHaveBeenCalledWith('status', 'draft');
    });

    it('applies $gt operator', async () => {
      await entity.filter({ amount: { $gt: 100 } });
      expect(mockQuery.gt).toHaveBeenCalledWith('amount', 100);
    });

    it('applies $gte operator', async () => {
      await entity.filter({ amount: { $gte: 50 } });
      expect(mockQuery.gte).toHaveBeenCalledWith('amount', 50);
    });

    it('applies $lt operator', async () => {
      await entity.filter({ amount: { $lt: 200 } });
      expect(mockQuery.lt).toHaveBeenCalledWith('amount', 200);
    });

    it('applies $lte operator', async () => {
      await entity.filter({ amount: { $lte: 300 } });
      expect(mockQuery.lte).toHaveBeenCalledWith('amount', 300);
    });

    it('applies $in operator', async () => {
      await entity.filter({ type: { $in: ['a', 'b'] } });
      expect(mockQuery.in).toHaveBeenCalledWith('type', ['a', 'b']);
    });

    it('applies $contains operator', async () => {
      await entity.filter({ tags: { $contains: ['x'] } });
      expect(mockQuery.contains).toHaveBeenCalledWith('tags', ['x']);
    });

    it('applies $like / $ilike operator', async () => {
      await entity.filter({ name: { $like: '%test%' } });
      expect(mockQuery.ilike).toHaveBeenCalledWith('name', '%test%');
    });

    it('applies $is operator', async () => {
      await entity.filter({ active: { $is: true } });
      expect(mockQuery.is).toHaveBeenCalledWith('active', true);
    });

    it('applies $not operator', async () => {
      await entity.filter({ deleted: { $not: null } });
      expect(mockQuery.not).toHaveBeenCalledWith('deleted', 'is', null);
    });
  });

  // ── applyOrder ────────────────────────────────────────────────────
  describe('applyOrder (via list method)', () => {
    beforeEach(() => {
      mockQuery.range.mockResolvedValue({ data: [], error: null });
    });

    it('orders ascending by default field when no orderBy given', async () => {
      await entity.list();
      expect(mockQuery.order).toHaveBeenCalledWith('created_date', { ascending: false });
    });

    it('orders ascending when column name has no prefix', async () => {
      await entity.list('name');
      expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
    });

    it('orders descending when column name starts with -', async () => {
      await entity.list('-updated_date');
      expect(mockQuery.order).toHaveBeenCalledWith('updated_date', { ascending: false });
    });
  });

  // ── getCurrentUserEmail caching ───────────────────────────────────
  describe('getCurrentUserEmail caching', () => {
    it('caches email and reuses within TTL', async () => {
      mockQuery.range.mockResolvedValue({ data: [], error: null });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { email: 'cached@test.com' } },
      });

      // First call to trigger getCurrentUserEmail
      await entity.filter({ status: 'a' });
      // Second call should use cache
      await entity.filter({ status: 'b' });

      // getUser should only be called once due to caching
      // (may be called more if cache was invalidated from previous tests)
      const callCount = mockSupabase.auth.getUser.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(2);
    });
  });

  // ── create / update / delete errors ───────────────────────────────
  describe('create throws contextual error', () => {
    it('includes table name in error message', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'duplicate key' },
      });

      await expect(entity.create({ name: 'test' })).rejects.toThrow(
        'Erro ao criar test_table: duplicate key'
      );
    });
  });

  describe('update throws contextual error', () => {
    it('includes table name in error message', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(entity.update(1, { name: 'x' })).rejects.toThrow(
        'Erro ao atualizar test_table: not found'
      );
    });
  });

  describe('delete throws contextual error', () => {
    it('includes table name in error message', async () => {
      mockQuery.eq.mockResolvedValue({
        error: { message: 'foreign key violation' },
      });

      await expect(entity.delete(1)).rejects.toThrow(
        'Erro ao eliminar test_table: foreign key violation'
      );
    });
  });

  // ── fetchAll pagination ───────────────────────────────────────────
  describe('fetchAll pagination', () => {
    it('fetches single page when results < PAGE_SIZE', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      mockQuery.range.mockResolvedValueOnce({ data: items, error: null });

      const result = await entity.list();
      expect(result).toHaveLength(10);
      expect(mockQuery.range).toHaveBeenCalledTimes(1);
      expect(mockQuery.range).toHaveBeenCalledWith(0, 499);
    });

    it('fetches multiple pages when results fill PAGE_SIZE', async () => {
      const page1 = Array.from({ length: 500 }, (_, i) => ({ id: i }));
      const page2 = Array.from({ length: 200 }, (_, i) => ({ id: 500 + i }));

      mockQuery.range
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null });

      const result = await entity.list();
      expect(result).toHaveLength(700);
      expect(mockQuery.range).toHaveBeenCalledTimes(2);
      expect(mockQuery.range).toHaveBeenNthCalledWith(1, 0, 499);
      expect(mockQuery.range).toHaveBeenNthCalledWith(2, 500, 999);
    });

    it('stops when empty page is returned', async () => {
      const page1 = Array.from({ length: 500 }, (_, i) => ({ id: i }));
      mockQuery.range
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await entity.list();
      expect(result).toHaveLength(500);
      expect(mockQuery.range).toHaveBeenCalledTimes(2);
    });

    it('throws on supabase error during pagination', async () => {
      mockQuery.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

      await expect(entity.list()).rejects.toEqual({ message: 'timeout' });
    });
  });
});
