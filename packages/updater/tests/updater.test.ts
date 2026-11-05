/**
 * LynxFita Updater: Real X.509 mTLS Authority & Module Federation Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { LynxFitaContext, CompilerService } from '@lynxfita/core';
import {
  generateEcKeyPair,
  createX509Certificate,
  CertificateRevocationList,
  MtlsRbacLedger,
  AuthorityService,
  FederationService
} from '../dist/index.js';

test('Authentic X.509 Certificate generation and native verification', () => {
  const rootKp = generateEcKeyPair();
  const rootCa = createX509Certificate({
    subjectCn: 'LynxFita Test Root CA',
    issuerCn: 'LynxFita Test Root CA',
    publicKey: rootKp.publicKey,
    signingPrivateKey: rootKp.privateKey,
    serialNumber: 1,
    role: 'root'
  });

  const rootCert = new X509Certificate(rootCa.pem);
  assert.equal(rootCert.subject, 'CN=LynxFita Test Root CA');
  assert.equal(rootCert.issuer, 'CN=LynxFita Test Root CA');

  const clientKp = generateEcKeyPair();
  const clientCertBundle = createX509Certificate({
    subjectCn: 'LynxFita Top-Patron Client',
    issuerCn: 'LynxFita Test Root CA',
    publicKey: clientKp.publicKey,
    signingPrivateKey: rootKp.privateKey,
    serialNumber: 202,
    role: 'top-patron'
  });

  const clientCert = new X509Certificate(clientCertBundle.pem);
  assert.equal(clientCert.subject, 'CN=LynxFita Top-Patron Client');
  assert.equal(clientCert.issuer, 'CN=LynxFita Test Root CA');

  // Verify signature cryptographically using Root CA public key
  const valid = clientCert.verify(rootCert.publicKey);
  assert.equal(valid, true);
});

test('CertificateRevocationList revocation and serial verification', () => {
  const crl = new CertificateRevocationList();
  const serial1 = '0123456789ABCDEF';
  const serial2 = 'FEDCBA9876543210';

  assert.equal(crl.isRevoked(serial1), false);
  assert.equal(crl.isRevoked(serial2), false);

  crl.revoke(serial1);
  assert.equal(crl.isRevoked(serial1), true);
  assert.equal(crl.isRevoked(serial2), false);
  assert.equal(crl.getRevokedCount(), 1);
});

test('MtlsRbacLedger cryptographic ledger chain and Ed25519 signatures', () => {
  const ledger = new MtlsRbacLedger();

  const cert1 = ledger.issueCertificate('device-alpha', 'hw-seed-1234', ['viewer']);
  assert.equal(cert1.deviceId, 'device-alpha');
  assert.ok(cert1.chainSignature.length > 0);
  assert.deepEqual(cert1.roles, ['viewer']);

  const cert2 = ledger.issueCertificate('device-beta', 'hw-seed-5678', ['top-patron', 'canary']);
  assert.equal(cert2.deviceId, 'device-beta');
  assert.deepEqual(cert2.roles, ['top-patron', 'canary']);

  // Verify full SHA-256 block chain and Ed25519 signatures
  const chainValid = ledger.verifyLedgerChainIntegrity();
  assert.equal(chainValid, true);
});

test('AuthorityService mTLS server and client certificate verification', async () => {
  const ctx = new LynxFitaContext();
  const authSvc = new AuthorityService(ctx);
  const pki = authSvc.getPki();

  const port = await authSvc.startServer(0);
  assert.ok(port > 0);

  const verification = authSvc.verifyClientCertificate(pki.topPatronCert.pem);
  assert.equal(verification.valid, true);
  assert.equal(verification.role, 'top-patron');
  assert.equal(verification.revoked, false);

  // Revoke client certificate on live CRL
  authSvc.revokeCertificate(pki.topPatronCert.serialNumber);
  const revokedVerification = authSvc.verifyClientCertificate(pki.topPatronCert.pem);
  assert.equal(revokedVerification.valid, false);
  assert.equal(revokedVerification.revoked, true);

  authSvc.stopServer();
});

test('FederationService bundle reconciliation and rollback on CRL revocation', async () => {
  const ctx = new LynxFitaContext();
  const compiler = new CompilerService(ctx);
  const authSvc = new AuthorityService(ctx);
  const fedSvc = new FederationService(ctx);
  const pki = authSvc.getPki();

  assert.equal(fedSvc.getActiveVersion(), '1.0.0-embedded');

  // Reconcile top patron client cert -> resolves to 2.2.0-canary-patron
  const result1 = await fedSvc.reconcile(pki.topPatronCert.pem);
  assert.equal(result1.activeVersion, '2.2.0-canary-patron');
  assert.equal(result1.source, 'remote-federated');
  assert.equal(fedSvc.getActiveVersion(), '2.2.0-canary-patron');

  // Revoke top patron client cert on live CRL -> triggers automatic rollback to baseline
  authSvc.revokeCertificate(pki.topPatronCert.serialNumber);
  // Wait a microtask for event loop dispatch
  await new Promise(r => setTimeout(r, 10));
  assert.equal(fedSvc.getActiveVersion(), '1.0.0-embedded');
});
