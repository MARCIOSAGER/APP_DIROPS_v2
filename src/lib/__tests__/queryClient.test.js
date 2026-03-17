import { describe, it, expect } from 'vitest';
import { queryClientInstance } from '../query-client.js';

describe('queryClientInstance', () => {
  const defaults = queryClientInstance.getDefaultOptions();

  describe('default query options', () => {
    it('has staleTime of 2 minutes', () => {
      expect(defaults.queries.staleTime).toBe(1000 * 60 * 2);
    });

    it('has gcTime of 10 minutes', () => {
      expect(defaults.queries.gcTime).toBe(1000 * 60 * 10);
    });

    it('has retry set to 2', () => {
      expect(defaults.queries.retry).toBe(2);
    });

    it('has refetchOnWindowFocus disabled', () => {
      expect(defaults.queries.refetchOnWindowFocus).toBe(false);
    });
  });

  describe('default mutation options', () => {
    it('has retry set to 1', () => {
      expect(defaults.mutations.retry).toBe(1);
    });
  });

  describe('retryDelay', () => {
    const retryDelay = defaults.queries.retryDelay;

    it('is a function', () => {
      expect(typeof retryDelay).toBe('function');
    });

    it('returns 1000ms for first attempt (index 0)', () => {
      expect(retryDelay(0)).toBe(1000);
    });

    it('returns 2000ms for second attempt (index 1)', () => {
      expect(retryDelay(1)).toBe(2000);
    });

    it('returns 4000ms for third attempt (index 2)', () => {
      expect(retryDelay(2)).toBe(4000);
    });

    it('caps at 10000ms for high attempt indices', () => {
      expect(retryDelay(5)).toBe(10000);
      expect(retryDelay(10)).toBe(10000);
    });

    it('follows exponential backoff pattern: 1000 * 2^n', () => {
      for (let i = 0; i < 4; i++) {
        expect(retryDelay(i)).toBe(Math.min(1000 * 2 ** i, 10000));
      }
    });
  });
});
