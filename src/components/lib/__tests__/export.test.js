import { describe, it, expect } from 'vitest';
import { downloadAsCSV, downloadAsExcel } from '../export';

// downloadAsCSV and downloadAsExcel rely heavily on DOM APIs (Blob,
// URL.createObjectURL, document.createElement('a').click(), XLSX dynamic import).
// The testable pure logic is the input validation guard at the top of each function.
// The CSV string-building and file download triggering are side-effect-heavy and
// best covered by integration/E2E tests.

// ── downloadAsCSV — input validation ─────────────────────────────────
describe('downloadAsCSV', () => {
  describe('rejects invalid input', () => {
    it('returns false for null', () => {
      expect(downloadAsCSV(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(downloadAsCSV(undefined)).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(downloadAsCSV([])).toBe(false);
    });

    it('returns false for non-array (string)', () => {
      expect(downloadAsCSV('string')).toBe(false);
    });

    it('returns false for non-array (number)', () => {
      expect(downloadAsCSV(123)).toBe(false);
    });

    it('returns false for array of primitives', () => {
      expect(downloadAsCSV([1, 2, 3])).toBe(false);
    });

    it('returns false for array of strings', () => {
      expect(downloadAsCSV(['a', 'b'])).toBe(false);
    });

    it('returns false for array containing null', () => {
      expect(downloadAsCSV([null])).toBe(false);
    });

    it('returns false for object (not array)', () => {
      expect(downloadAsCSV({ a: 1 })).toBe(false);
    });
  });
});

// ── downloadAsExcel — input validation ───────────────────────────────
describe('downloadAsExcel', () => {
  describe('rejects invalid input', () => {
    it('returns false for null', async () => {
      expect(await downloadAsExcel(null)).toBe(false);
    });

    it('returns false for undefined', async () => {
      expect(await downloadAsExcel(undefined)).toBe(false);
    });

    it('returns false for empty array', async () => {
      expect(await downloadAsExcel([])).toBe(false);
    });

    it('returns false for non-array (string)', async () => {
      expect(await downloadAsExcel('string')).toBe(false);
    });

    it('returns false for array of primitives', async () => {
      expect(await downloadAsExcel([1, 2, 3])).toBe(false);
    });

    it('returns false for array containing null', async () => {
      expect(await downloadAsExcel([null])).toBe(false);
    });
  });
});
