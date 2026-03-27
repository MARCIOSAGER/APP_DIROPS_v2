import { describe, it, expect } from 'vitest';
import { PDF } from '../pdfTemplate';

// ── PDF Design Tokens ────────────────────────────────────────────────
// The PDF template module exports a constants object (PDF) with design tokens.
// The rendering functions (addHeader, addFooter, addTable, etc.) require a
// jsPDF instance and are side-effect-heavy, so we only test the pure
// configuration object here.

describe('PDF design tokens', () => {
  it('exports a non-null object', () => {
    expect(PDF).toBeDefined();
    expect(typeof PDF).toBe('object');
  });

  describe('colors', () => {
    it('contains all required color keys', () => {
      const requiredColors = [
        'primary', 'primaryLight', 'primaryBorder',
        'dark', 'body', 'muted', 'light', 'separator',
        'bgStripe', 'white', 'black',
        'success', 'danger', 'warning',
        'tableHeader', 'tableHeaderFg',
      ];
      for (const key of requiredColors) {
        expect(PDF.colors, `missing color: ${key}`).toHaveProperty(key);
      }
    });

    it('every color is a 3-element RGB array with values 0-255', () => {
      for (const [name, rgb] of Object.entries(PDF.colors)) {
        expect(Array.isArray(rgb), `${name} should be an array`).toBe(true);
        expect(rgb.length, `${name} should have 3 elements`).toBe(3);
        for (const val of rgb) {
          expect(val, `${name} values should be 0-255`).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(255);
        }
      }
    });
  });

  describe('font sizes', () => {
    it('contains all required size keys', () => {
      const requiredSizes = ['title', 'subtitle', 'body', 'small', 'caption', 'tiny'];
      for (const key of requiredSizes) {
        expect(PDF.font, `missing font size: ${key}`).toHaveProperty(key);
      }
    });

    it('sizes are positive numbers in descending order', () => {
      expect(PDF.font.title).toBeGreaterThan(PDF.font.subtitle);
      expect(PDF.font.subtitle).toBeGreaterThan(PDF.font.body);
      expect(PDF.font.body).toBeGreaterThan(PDF.font.small);
      expect(PDF.font.small).toBeGreaterThan(PDF.font.caption);
      expect(PDF.font.caption).toBeGreaterThan(PDF.font.tiny);
      expect(PDF.font.tiny).toBeGreaterThan(0);
    });
  });

  describe('margins', () => {
    it('has top, bottom, left, right as positive numbers', () => {
      for (const key of ['top', 'bottom', 'left', 'right']) {
        expect(PDF.margin[key]).toBeGreaterThan(0);
        expect(typeof PDF.margin[key]).toBe('number');
      }
    });
  });

  describe('page dimensions', () => {
    it('portrait is taller than wide (A4)', () => {
      expect(PDF.page.portrait.h).toBeGreaterThan(PDF.page.portrait.w);
    });

    it('landscape is wider than tall (A4)', () => {
      expect(PDF.page.landscape.w).toBeGreaterThan(PDF.page.landscape.h);
    });

    it('portrait and landscape share the same dimensions swapped', () => {
      expect(PDF.page.portrait.w).toBe(PDF.page.landscape.h);
      expect(PDF.page.portrait.h).toBe(PDF.page.landscape.w);
    });
  });

  describe('logo defaults', () => {
    it('has positive width and height', () => {
      expect(PDF.logo.width).toBeGreaterThan(0);
      expect(PDF.logo.height).toBeGreaterThan(0);
    });
  });

  describe('headerBar', () => {
    it('has a positive height', () => {
      expect(PDF.headerBar.height).toBeGreaterThan(0);
    });
  });
});
