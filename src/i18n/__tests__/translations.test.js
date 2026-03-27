import { describe, it, expect } from 'vitest';
import { translations } from '../index';

// ── Translations structure ───────────────────────────────────────────
describe('i18n translations', () => {
  it('exports a translations object', () => {
    expect(translations).toBeDefined();
    expect(typeof translations).toBe('object');
  });

  it('has both pt and en locales', () => {
    expect(translations).toHaveProperty('pt');
    expect(translations).toHaveProperty('en');
  });

  it('pt and en are non-empty objects', () => {
    expect(Object.keys(translations.pt).length).toBeGreaterThan(0);
    expect(Object.keys(translations.en).length).toBeGreaterThan(0);
  });
});

// ── Key parity between pt and en ─────────────────────────────────────
describe('pt/en key parity', () => {
  const ptKeys = Object.keys(translations.pt).sort();
  const enKeys = Object.keys(translations.en).sort();

  it('both locales have the same number of keys', () => {
    expect(ptKeys.length).toBe(enKeys.length);
  });

  it('every pt key exists in en', () => {
    const missingInEn = ptKeys.filter(k => !translations.en.hasOwnProperty(k));
    expect(missingInEn, `Keys in pt but missing in en: ${missingInEn.join(', ')}`).toEqual([]);
  });

  it('every en key exists in pt', () => {
    const missingInPt = enKeys.filter(k => !translations.pt.hasOwnProperty(k));
    expect(missingInPt, `Keys in en but missing in pt: ${missingInPt.join(', ')}`).toEqual([]);
  });
});

// ── Value quality checks ─────────────────────────────────────────────
describe('translation value quality', () => {
  it('no pt values are empty strings', () => {
    const emptyKeys = Object.entries(translations.pt)
      .filter(([, v]) => v === '')
      .map(([k]) => k);
    expect(emptyKeys, `Empty pt values: ${emptyKeys.slice(0, 10).join(', ')}`).toEqual([]);
  });

  it('no en values are empty strings', () => {
    const emptyKeys = Object.entries(translations.en)
      .filter(([, v]) => v === '')
      .map(([k]) => k);
    expect(emptyKeys, `Empty en values: ${emptyKeys.slice(0, 10).join(', ')}`).toEqual([]);
  });

  it('pt and en values are not identical for common words (spot check)', () => {
    // At least some keys should differ between languages.
    // We check a sample — if all were identical it would mean copy-paste, not translation.
    const diffCount = Object.keys(translations.pt).filter(
      k => translations.pt[k] !== translations.en[k]
    ).length;
    // At least 10% should differ (very conservative threshold)
    const totalKeys = Object.keys(translations.pt).length;
    expect(diffCount).toBeGreaterThan(totalKeys * 0.1);
  });
});
