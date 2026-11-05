import { createHash, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';

/**
 * Mutual TLS (mTLS) Certificate Exchange & Deterministic RBAC Ledger
 * Manages device fingerprinting, cryptographic certificate exchange chains,
 * and role-based access control for privileged bundle distribution.
 */

export interface DeviceCertificate {
  deviceId: string;
  publicKeyFingerprint: string;
  roles: string[];
  issuedAt: number;
  expiresAt: number;
  chainSignature: string;
}

export interface AccessToken {
  token: string;
  deviceId: string;
  grantedRoles: string[];
  validUntil: number;
}

export interface LedgerBlock {
  index: number;
  timestamp: number;
  deviceId: string;
  fingerprint: string;
  roles: string[];
  previousEntryHash: string;
  entryHash: string;
  signature: string;
}

export class MtlsRbacLedger {
  private certificateStore = new Map<string, DeviceCertificate>();
  private revokedDevices = new Set<string>();
  private ledgerChain: LedgerBlock[] = [];
  private authorityPublicKey: KeyObject;
  private authorityPrivateKey: KeyObject;

  constructor() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    this.authorityPublicKey = publicKey;
    this.authorityPrivateKey = privateKey;
  }

  /**
   * Register or exchange a device certificate with deterministic fingerprinting
   * and append an immutable block to the cryptographic SHA-256 ledger chain.
   */
  public issueCertificate(deviceId: string, hardwareSeed: string, roles: string[] = ['viewer']): DeviceCertificate {
    const hash = createHash('sha256')
      .update(`${deviceId}:${hardwareSeed}`)
      .digest('hex');
    const fingerprint = `FP_${deviceId.toUpperCase()}_${hash.substring(0, 16).toUpperCase()}`;

    const previousEntryHash = this.ledgerChain.length === 0
      ? '0'.repeat(64)
      : this.ledgerChain[this.ledgerChain.length - 1]!.entryHash;

    const blockIndex = this.ledgerChain.length;
    const now = Date.now();

    const entryContent = JSON.stringify({
      index: blockIndex,
      timestamp: now,
      deviceId,
      fingerprint,
      roles,
      previousEntryHash
    });

    const entryHash = createHash('sha256').update(entryContent).digest('hex');
    const rawSignature = sign(null, Buffer.from(entryHash, 'utf-8'), this.authorityPrivateKey);
    const signatureHex = rawSignature.toString('hex');

    const cert: DeviceCertificate = {
      deviceId,
      publicKeyFingerprint: fingerprint,
      roles,
      issuedAt: now,
      expiresAt: now + (365 * 24 * 60 * 60 * 1000),
      chainSignature: signatureHex
    };

    const block: LedgerBlock = {
      index: blockIndex,
      timestamp: now,
      deviceId,
      fingerprint,
      roles,
      previousEntryHash,
      entryHash,
      signature: signatureHex
    };

    this.ledgerChain.push(block);
    this.certificateStore.set(deviceId, cert);
    return cert;
  }

  /**
   * Verify cryptographic integrity of the entire SHA-256 hash-chain and Ed25519 signatures
   */
  public verifyLedgerChainIntegrity(): boolean {
    for (let i = 0; i < this.ledgerChain.length; i++) {
      const current = this.ledgerChain[i]!;
      const expectedPrevHash = (i === 0) ? '0'.repeat(64) : this.ledgerChain[i - 1]!.entryHash;

      if (current.previousEntryHash !== expectedPrevHash) {
        return false;
      }

      const expectedContent = JSON.stringify({
        index: current.index,
        timestamp: current.timestamp,
        deviceId: current.deviceId,
        fingerprint: current.fingerprint,
        roles: current.roles,
        previousEntryHash: current.previousEntryHash
      });

      const recalculatedHash = createHash('sha256').update(expectedContent).digest('hex');
      if (recalculatedHash !== current.entryHash) {
        return false;
      }

      const sigBuffer = Buffer.from(current.signature, 'hex');
      const isValidSig = verify(null, Buffer.from(current.entryHash, 'utf-8'), this.authorityPublicKey, sigBuffer);
      if (!isValidSig) {
        return false;
      }
    }
    return true;
  }

  /**
   * Verify device identity and authorize access based on RBAC roles
   */
  public authenticateDevice(deviceId: string, requiredRole: string): AccessToken {
    if (this.revokedDevices.has(deviceId)) {
      throw new Error(`Device ${deviceId} has been revoked in the mTLS ledger`);
    }

    const cert = this.certificateStore.get(deviceId);
    if (!cert) {
      throw new Error(`Device ${deviceId} not found in certificate store`);
    }

    if (Date.now() > cert.expiresAt) {
      throw new Error(`Certificate for device ${deviceId} has expired`);
    }

    if (!cert.roles.includes(requiredRole) && !cert.roles.includes('admin')) {
      throw new Error(`RBAC Authorization failed: device lacks role '${requiredRole}'`);
    }

    return {
      token: `${cert.publicKeyFingerprint}_${cert.chainSignature.substring(0, 32)}`,
      deviceId,
      grantedRoles: cert.roles,
      validUntil: Date.now() + 3600000 // 1 hour token
    };
  }

  public revokeDevice(deviceId: string): void {
    this.revokedDevices.add(deviceId);
  }

  public isRevoked(deviceId: string): boolean {
    return this.revokedDevices.has(deviceId);
  }

  public getLedgerLength(): number {
    return this.ledgerChain.length;
  }
}
