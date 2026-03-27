/**
 * Hash a password using SHA-256 via the Web Crypto API.
 * Returns a hex-encoded string.
 *
 * NOTE: SHA-256 is NOT a substitute for bcrypt/argon2 on the server side.
 * This is a client-side mitigation so passwords are never stored or compared
 * in plaintext.  A future improvement should move validation to an Edge
 * Function that uses bcrypt.
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
