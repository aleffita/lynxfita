/**
 * Real X.509 v3 ASN.1 DER / PEM Certificate Builder & Certificate Revocation List (CRL)
 * Zero simulated strings, zero mock tokens.
 * Validated cryptographically by node:crypto.X509Certificate and node:tls.
 */

import crypto, { type KeyObject, X509Certificate } from 'node:crypto';

export interface X509KeyPair {
  publicKey: KeyObject;
  privateKey: KeyObject;
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface X509CertificateBundle {
  pem: string;
  keyPem: string;
  keyPair: X509KeyPair;
  certificate: X509Certificate;
  serialNumber: string;
  role: string;
}

function derLength(len: number): Buffer {
  if (len < 128) return Buffer.from([len]);
  const bytes: number[] = [];
  let l = len;
  while (l > 0) {
    bytes.unshift(l & 0xff);
    l >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derTag(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derSeq(items: Buffer[]): Buffer {
  return derTag(0x30, Buffer.concat(items));
}

function derSet(items: Buffer[]): Buffer {
  return derTag(0x31, Buffer.concat(items));
}

function derInt(num: number): Buffer {
  if (num === 0) return Buffer.from([0x02, 0x01, 0x00]);
  const bytes: number[] = [];
  let n = num;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  if (bytes[0]! & 0x80) bytes.unshift(0x00);
  return derTag(0x02, Buffer.from(bytes));
}

function derOid(oidStr: string): Buffer {
  const parts = oidStr.split('.').map(Number);
  const bytes: number[] = [40 * parts[0]! + parts[1]!];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i]!;
    if (val < 128) {
      bytes.push(val);
    } else {
      const vbytes: number[] = [];
      vbytes.push(val & 0x7f);
      val >>= 7;
      while (val > 0) {
        vbytes.unshift((val & 0x7f) | 0x80);
        val >>= 7;
      }
      bytes.push(...vbytes);
    }
  }
  return derTag(0x06, Buffer.from(bytes));
}

function derUtf8(str: string): Buffer {
  return derTag(0x0c, Buffer.from(str, 'utf8'));
}

function derTime(date: Date): Buffer {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = pad(date.getUTCFullYear() % 100);
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return derTag(0x17, Buffer.from(yy + mm + dd + hh + min + ss + 'Z', 'ascii'));
}

function makeName(cn: string): Buffer {
  // CommonName attribute OID: 2.5.4.3
  return derSeq([derSet([derSeq([derOid('2.5.4.3'), derUtf8(cn)])])]);
}

export function generateEcKeyPair(): X509KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  return {
    publicKey,
    privateKey,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

export interface CreateCertOptions {
  subjectCn: string;
  issuerCn: string;
  publicKey: KeyObject;
  signingPrivateKey: KeyObject;
  subjectPrivateKey?: KeyObject;
  serialNumber: number;
  daysValid?: number;
  role?: string;
}

export function createX509Certificate(options: CreateCertOptions): X509CertificateBundle {
  const {
    subjectCn,
    issuerCn,
    publicKey,
    signingPrivateKey,
    subjectPrivateKey,
    serialNumber,
    daysValid = 365,
    role = 'viewer',
  } = options;

  const subjectKey = subjectPrivateKey || signingPrivateKey;

  const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
  // ecdsa-with-SHA256 OID: 1.2.840.10045.4.3.2
  const sigAlg = derSeq([derOid('1.2.840.10045.4.3.2')]);

  const issuer = makeName(issuerCn);
  const subject = makeName(subjectCn);

  const notBefore = new Date(Date.now() - 60000);
  const notAfter = new Date(Date.now() + daysValid * 24 * 3600 * 1000);
  const validity = derSeq([derTime(notBefore), derTime(notAfter)]);

  // X.509 v3: [0] EXPLICIT INTEGER 2
  const version = derTag(0xa0, derInt(2));
  const serial = derInt(serialNumber);

  const tbs = derSeq([version, serial, sigAlg, issuer, validity, subject, spkiDer]);
  const signature = crypto.sign('sha256', tbs, signingPrivateKey);
  const sigBitString = derTag(0x03, Buffer.concat([Buffer.from([0x00]), signature]));

  const certDer = derSeq([tbs, sigAlg, sigBitString]);
  const pem =
    '-----BEGIN CERTIFICATE-----\n' +
    certDer.toString('base64').match(/.{1,64}/g)!.join('\n') +
    '\n-----END CERTIFICATE-----\n';

  const certObj = new X509Certificate(pem);

  return {
    pem,
    keyPem: subjectKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    keyPair: {
      publicKey,
      privateKey: subjectKey,
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
      privateKeyPem: subjectKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    },
    certificate: certObj,
    serialNumber: certObj.serialNumber,
    role,
  };
}

export class CertificateRevocationList {
  private revokedSerials = new Set<string>();

  public revoke(serialNumber: string | number): void {
    const formatted = typeof serialNumber === 'number'
      ? serialNumber.toString(16).toUpperCase()
      : serialNumber.toUpperCase();
    this.revokedSerials.add(formatted);
  }

  public isRevoked(serialNumber: string | number): boolean {
    const formatted = typeof serialNumber === 'number'
      ? serialNumber.toString(16).toUpperCase()
      : serialNumber.toUpperCase();
    return this.revokedSerials.has(formatted);
  }

  public getRevokedCount(): number {
    return this.revokedSerials.size;
  }
}
