import { describe, it, expect } from 'vitest';
import { hashPassword } from '../hashPassword';

describe('hashPassword', () => {
  it('returns a 64-character hex string (SHA-256)', async () => {
    const result = await hashPassword('test123');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic (same input gives same output)', async () => {
    const a = await hashPassword('mypassword');
    const b = await hashPassword('mypassword');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', async () => {
    const a = await hashPassword('password1');
    const b = await hashPassword('password2');
    expect(a).not.toBe(b);
  });

  it('handles empty string', async () => {
    const result = await hashPassword('');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    // SHA-256 of empty string is a known constant
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('handles unicode characters', async () => {
    const result = await hashPassword('senha-com-acentos-ção');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles long strings', async () => {
    const longStr = 'a'.repeat(10000);
    const result = await hashPassword(longStr);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});
