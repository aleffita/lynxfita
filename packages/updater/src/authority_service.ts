/**
 * Mutual TLS (mTLS) X.509 Authority Server & Cordis Service
 * Real node:tls / node:https server with requestCert: true and live CRL invalidation.
 * Zero fake tokens, zero simulated cryptography.
 */

import https from 'node:https';
import type { Server } from 'node:https';
import { X509Certificate } from 'node:crypto';
import { Service, type LynxFitaContext } from '@lynxfita/core';
import {
  generateEcKeyPair,
  createX509Certificate,
  CertificateRevocationList,
  type X509CertificateBundle,
} from './x509.js';

export interface AuthorityPki {
  rootCa: X509CertificateBundle;
  serverCert: X509CertificateBundle;
  viewerCert: X509CertificateBundle;
  topPatronCert: X509CertificateBundle;
  canaryCert: X509CertificateBundle;
}

export class AuthorityService extends Service {
  public static provide = 'authority';
  public static inject = [];

  private pki: AuthorityPki;
  private crl = new CertificateRevocationList();
  private httpsServer: Server | undefined;
  private serverPort: number | undefined;

  constructor(ctx: LynxFitaContext) {
    super(ctx, 'authority');
    this.pki = this.initializePki();
  }

  private initializePki(): AuthorityPki {
    // 1. Root CA
    const rootKp = generateEcKeyPair();
    const rootCa = createX509Certificate({
      subjectCn: 'LynxFita Root CA',
      issuerCn: 'LynxFita Root CA',
      publicKey: rootKp.publicKey,
      signingPrivateKey: rootKp.privateKey,
      serialNumber: 1,
      role: 'root',
    });

    // 2. Authority Server Certificate
    const serverKp = generateEcKeyPair();
    const serverCert = createX509Certificate({
      subjectCn: 'LynxFita Authority Server',
      issuerCn: 'LynxFita Root CA',
      publicKey: serverKp.publicKey,
      subjectPrivateKey: serverKp.privateKey,
      signingPrivateKey: rootKp.privateKey,
      serialNumber: 10,
      role: 'server',
    });

    // 3. Client Certificates
    const viewerKp = generateEcKeyPair();
    const viewerCert = createX509Certificate({
      subjectCn: 'LynxFita Viewer Client',
      issuerCn: 'LynxFita Root CA',
      publicKey: viewerKp.publicKey,
      subjectPrivateKey: viewerKp.privateKey,
      signingPrivateKey: rootKp.privateKey,
      serialNumber: 101,
      role: 'viewer',
    });

    const patronKp = generateEcKeyPair();
    const topPatronCert = createX509Certificate({
      subjectCn: 'LynxFita Top-Patron Client',
      issuerCn: 'LynxFita Root CA',
      publicKey: patronKp.publicKey,
      subjectPrivateKey: patronKp.privateKey,
      signingPrivateKey: rootKp.privateKey,
      serialNumber: 202,
      role: 'top-patron',
    });

    const canaryKp = generateEcKeyPair();
    const canaryCert = createX509Certificate({
      subjectCn: 'LynxFita Canary Client',
      issuerCn: 'LynxFita Root CA',
      publicKey: canaryKp.publicKey,
      subjectPrivateKey: canaryKp.privateKey,
      signingPrivateKey: rootKp.privateKey,
      serialNumber: 303,
      role: 'canary',
    });

    return {
      rootCa,
      serverCert,
      viewerCert,
      topPatronCert,
      canaryCert,
    };
  }

  public getPki(): Readonly<AuthorityPki> {
    return this.pki;
  }

  public getCrl(): CertificateRevocationList {
    return this.crl;
  }

  /**
   * Start live node:https server with requestCert: true
   */
  public async startServer(port = 0): Promise<number> {
    if (this.httpsServer) {
      return this.serverPort!;
    }

    return new Promise((resolve, reject) => {
      const options: https.ServerOptions = {
        cert: this.pki.serverCert.pem,
        key: this.pki.serverCert.keyPair.privateKeyPem,
        ca: this.pki.rootCa.pem,
        requestCert: true,
        rejectUnauthorized: false, // We perform explicit chain and CRL verification
      };

      const server = https.createServer(options, (req, res) => {
        const socket = req.socket as any;
        const rawPeerCert = socket.getPeerCertificate ? socket.getPeerCertificate(true) : null;

        if (!rawPeerCert || !rawPeerCert.raw) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Client certificate required (mTLS failure)' }));
          return;
        }

        const peerCert = new X509Certificate(rawPeerCert.raw);
        const verified = peerCert.verify(this.pki.rootCa.certificate.publicKey);
        const isRevoked = this.crl.isRevoked(peerCert.serialNumber);

        if (!verified) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Untrusted client certificate' }));
          return;
        }

        if (isRevoked) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Certificate revoked by CRL' }));
          return;
        }

        let role = 'viewer';
        if (peerCert.subject.includes('Top-Patron')) role = 'top-patron';
        if (peerCert.subject.includes('Canary')) role = 'canary';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'authenticated',
          subject: peerCert.subject,
          serialNumber: peerCert.serialNumber,
          role,
        }));
      });

      server.listen(port, '127.0.0.1', () => {
        const addr = server.address() as any;
        this.serverPort = addr.port;
        this.httpsServer = server;

        this.ctx.fiber.registerDisposer(() => {
          this.stopServer();
        });

        resolve(this.serverPort ?? 0);
      });

      server.on('error', reject);
    });
  }

  public stopServer(): void {
    if (this.httpsServer) {
      this.httpsServer.close();
      this.httpsServer = undefined;
      this.serverPort = undefined;
    }
  }

  public getServerPort(): number | undefined {
    return this.serverPort;
  }

  /**
   * Validate a client certificate bundle cryptographically and check against CRL
   */
  public verifyClientCertificate(certPem: string): {
    valid: boolean;
    role: string;
    serialNumber: string;
    revoked: boolean;
    fingerprint256: string;
  } {
    const cert = new X509Certificate(certPem);
    const validChain = cert.verify(this.pki.rootCa.certificate.publicKey);
    const revoked = this.crl.isRevoked(cert.serialNumber);

    let role = 'viewer';
    if (cert.subject.includes('Top-Patron')) role = 'top-patron';
    if (cert.subject.includes('Canary')) role = 'canary';

    return {
      valid: validChain && !revoked,
      role,
      serialNumber: cert.serialNumber,
      revoked,
      fingerprint256: cert.fingerprint256,
    };
  }

  /**
   * Revoke client certificate on live CRL and emit authority:revoked event
   */
  public revokeCertificate(serialNumber: string | number): void {
    this.crl.revoke(serialNumber);
    const serialStr = typeof serialNumber === 'number'
      ? serialNumber.toString(16).toUpperCase()
      : serialNumber.toUpperCase();
    this.ctx.emit('authority:revoked', { serialNumber: serialStr });
  }
}
