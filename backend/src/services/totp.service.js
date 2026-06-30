/**
 * TOTP service — RFC 6238 implementation using Node.js built-in crypto.
 * No extra dependencies required.
 */

import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let result = '';
  let bits = 0;
  let value = 0;
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

function base32Decode(str) {
  const normalized = str.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const buffer = [];
  let bits = 0;
  let value = 0;
  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      buffer.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(buffer);
}

function generateHotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // Write 64-bit big-endian counter
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  buf.writeUInt32BE(hi, 0);
  buf.writeUInt32BE(lo, 4);
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buf);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
}

/**
 * Generate a new random TOTP secret (base32 encoded).
 */
export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/**
 * Build the otpauth URI for use in QR codes.
 */
export function buildTotpUri(secret, email, issuer) {
  const enc = encodeURIComponent;
  return `otpauth://totp/${enc(issuer)}:${enc(email)}?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Verify a TOTP token against a secret.
 * Accepts codes from ±1 time step (30s window) to handle clock drift.
 */
export function verifyTotp(secret, token) {
  if (!secret || !token || !/^\d{6}$/.test(token)) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    if (generateHotp(secret, step + i) === token) return true;
  }
  return false;
}

export default { generateTotpSecret, buildTotpUri, verifyTotp };
