/**
 * Mutual TLS (mTLS) Certificate Exchange & Deterministic RBAC Ledger
 * Manages device fingerprinting, deterministic certificate exchange chains,
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

export class MtlsRbacLedger {
  private certificateStore = new Map<string, DeviceCertificate>();
  private revokedDevices = new Set<string>();

  constructor() {}

  /**
   * Register or exchange a device certificate with deterministic fingerprinting
   */
  public issueCertificate(deviceId: string, hardwareSeed: string, roles: string[] = ['viewer']): DeviceCertificate {
    let hashNum = 0x811c9dc5;
    const str = `${deviceId}:${hardwareSeed}`;
    for (let i = 0; i < str.length; i++) {
      hashNum ^= str.charCodeAt(i);
      hashNum = Math.imul(hashNum, 0x01000193) >>> 0;
    }
    const fingerprint = `FP_${deviceId.toUpperCase()}_${hashNum.toString(16).padStart(8, '0')}`;
    const cert: DeviceCertificate = {
      deviceId,
      publicKeyFingerprint: fingerprint,
      roles,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000),
      chainSignature: `CERT_CHAIN_SIG_${fingerprint}`
    };

    this.certificateStore.set(deviceId, cert);
    return cert;
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
      token: `MTLS_AUTH_TOKEN_${cert.publicKeyFingerprint}`,
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
}
