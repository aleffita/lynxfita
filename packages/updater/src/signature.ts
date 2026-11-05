/**
 * LynxFita Release Integrity & Ed25519 Cryptographic Signatures
 * Zero third-party dependencies — uses standard node:crypto Ed25519 & SHA-256.
 */

import {
  generateKeyPairSync,
  sign,
  verify,
  createHash,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
} from 'node:crypto';

export interface ReleaseKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

/**
 * Generate a new Ed25519 key pair for release signing
 */
export function generateReleaseKeyPair(): ReleaseKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

/**
 * Compute SHA-256 hex digest of arbitrary binary or string data
 */
export function computeSha256(data: Uint8Array | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Sign payload using Ed25519 private key.
 * Returns lowercase hexadecimal signature string.
 */
export function signPayload(payload: Uint8Array | string, privateKey: string | KeyObject): string {
  const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload);
  const key = typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;
  // In RFC 8032 / Node.js crypto, algorithm must be null for Ed25519
  const sig = sign(null, data, key);
  return sig.toString('hex');
}

/**
 * Verify Ed25519 signature over payload using public key.
 */
export function verifyPayload(
  payload: Uint8Array | string,
  signatureHex: string,
  publicKey: string | KeyObject
): boolean {
  try {
    const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload);
    const key = typeof publicKey === 'string' ? createPublicKey(publicKey) : publicKey;
    const sig = Buffer.from(signatureHex, 'hex');
    return verify(null, data, key, sig);
  } catch {
    return false;
  }
}
