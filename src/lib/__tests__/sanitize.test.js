import { describe, it, expect } from 'vitest';
import { sanitizeHtml, safeRedirectUrl, sanitizeFilename } from '../sanitize';

// ── sanitizeHtml ──────────────────────────────────────────────────────
describe('sanitizeHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });

  it('preserves allowed tags', () => {
    const input = '<b>bold</b> <i>italic</i> <a href="https://x.com">link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<b>bold</b>');
    expect(result).toContain('<i>italic</i>');
    expect(result).toContain('<a');
  });

  it('strips script tags (XSS)', () => {
    const input = '<script>alert("xss")</script><b>safe</b>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<b>safe</b>');
  });

  it('strips event handlers', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
  });

  it('strips javascript: URLs in href', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('strips data attributes', () => {
    const input = '<div data-exploit="payload">safe</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data-exploit');
  });

  it('allows table tags', () => {
    const input = '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>';
    expect(sanitizeHtml(input)).toContain('<table>');
    expect(sanitizeHtml(input)).toContain('<td>');
  });

  it('strips style tags', () => {
    const input = '<style>body{display:none}</style><p>text</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<style');
    expect(result).toContain('<p>text</p>');
  });
});

// ── safeRedirectUrl ───────────────────────────────────────────────────
describe('safeRedirectUrl', () => {
  it('returns fallback for falsy input', () => {
    expect(safeRedirectUrl(null)).toBe('/');
    expect(safeRedirectUrl('')).toBe('/');
    expect(safeRedirectUrl(undefined)).toBe('/');
  });

  it('returns custom fallback', () => {
    expect(safeRedirectUrl(null, '/dashboard')).toBe('/dashboard');
  });

  it('allows relative paths starting with /', () => {
    expect(safeRedirectUrl('/dashboard')).toBe('/dashboard');
    expect(safeRedirectUrl('/a/b?q=1#h')).toBe('/a/b?q=1#h');
  });

  it('blocks protocol-relative URLs (//)', () => {
    expect(safeRedirectUrl('//evil.com/path')).toBe('/');
  });

  it('blocks absolute URLs to different origins', () => {
    expect(safeRedirectUrl('https://evil.com/steal')).toBe('/');
  });

  it('allows same-origin absolute URLs', () => {
    // jsdom origin is http://localhost:3000
    const result = safeRedirectUrl(`${window.location.origin}/dashboard?x=1`);
    expect(result).toBe('/dashboard?x=1');
  });

  it('returns fallback for protocol-relative URLs', () => {
    expect(safeRedirectUrl('//evil.com/steal')).toBe('/');
  });
});

// ── sanitizeFilename ──────────────────────────────────────────────────
describe('sanitizeFilename', () => {
  it('returns "arquivo" for falsy input', () => {
    expect(sanitizeFilename(null)).toBe('arquivo');
    expect(sanitizeFilename('')).toBe('arquivo');
    expect(sanitizeFilename(undefined)).toBe('arquivo');
  });

  it('strips path traversal sequences', () => {
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('..\\..\\windows\\system32')).not.toContain('..');
  });

  it('replaces forbidden characters', () => {
    const result = sanitizeFilename('file<>:"/\\|?*name.txt');
    expect(result).not.toMatch(/[<>:"/\\|?*]/);
    expect(result).toContain('name.txt');
  });

  it('strips leading dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('hidden');
    expect(sanitizeFilename('...dots')).toBe('dots');
  });

  it('preserves normal filenames', () => {
    expect(sanitizeFilename('report-2024.pdf')).toBe('report-2024.pdf');
    expect(sanitizeFilename('my_file (1).docx')).toBe('my_file (1).docx');
  });

  it('returns "arquivo" if all characters are stripped', () => {
    expect(sanitizeFilename('...')).toBe('arquivo');
  });
});
