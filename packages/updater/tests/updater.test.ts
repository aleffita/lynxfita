/**
 * LynxFita Updater: Ed25519 Release Integrity & Module Federation Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { LynxFitaContext, CompilerService } from '@lynxfita/core';
import {
  generateReleaseKeyPair,
  signPayload,
  verifyPayload,
  computeSha256,
  FederationService,
  GitHubReleasesUpdater,
  type FederatedBundle,
} from '../dist/index.js';

test('Ed25519 key generation, cryptographic signing and verification', () => {
  const keyPair = generateReleaseKeyPair();
  assert.ok(keyPair.publicKeyPem.includes('BEGIN PUBLIC KEY'));
  assert.ok(keyPair.privateKeyPem.includes('BEGIN PRIVATE KEY'));

  const payload = 'LynxFita Release v2.1.0 Payload Content';
  const sig = signPayload(payload, keyPair.privateKeyPem);
  assert.ok(sig.length > 0);

  // Valid signature verification
  const isValid = verifyPayload(payload, sig, keyPair.publicKeyPem);
  assert.equal(isValid, true);

  // Tampered payload fails verification
  const tamperedPayload = 'LynxFita Release v2.1.0 TAMPERED Content';
  const isTamperedValid = verifyPayload(tamperedPayload, sig, keyPair.publicKeyPem);
  assert.equal(isTamperedValid, false);

  // Tampered signature fails verification
  const badSig = '00'.repeat(sig.length / 2);
  const isBadSigValid = verifyPayload(payload, badSig, keyPair.publicKeyPem);
  assert.equal(isBadSigValid, false);
});

test('SHA-256 payload integrity computation and asset verification', () => {
  const data = new TextEncoder().encode('Hello LynxFita Stationary DMA');
  const hash = computeSha256(data);
  assert.equal(hash.length, 64);

  const updater = new GitHubReleasesUpdater();
  assert.equal(updater.verifyDownloadedAsset(data, hash), true);
  assert.equal(updater.verifyDownloadedAsset(data, 'f'.repeat(64)), false);
  assert.equal(updater.verifyDownloadedAsset(data, 'short-invalid'), false);
});

test('FederationService bundle reconciliation with valid Ed25519 signature', async () => {
  const ctx = new LynxFitaContext();
  const compiler = new CompilerService(ctx);
  const fedSvc = new FederationService(ctx);

  assert.equal(fedSvc.getActiveVersion(), '1.0.0-embedded');

  const keyPair = generateReleaseKeyPair();
  const remoteBundle: FederatedBundle = {
    version: '2.1.0-stable',
    name: 'weather-showcase-stable',
    sourceCode: 'export const version = "2.1.0-stable"; export default { city: "Sao Paulo", temp: 24.5 };',
    sha256: computeSha256('export const version = "2.1.0-stable"; export default { city: "Sao Paulo", temp: 24.5 };'),
  };

  const sig = signPayload(remoteBundle.sourceCode, keyPair.privateKeyPem);
  const result = await fedSvc.reconcile(remoteBundle, sig, keyPair.publicKeyPem);

  assert.equal(result.activeVersion, '2.1.0-stable');
  assert.equal(result.bundleName, 'weather-showcase-stable');
  assert.equal(result.source, 'remote-federated');
  assert.equal(result.isFallback, false);
  assert.equal(result.signatureValid, true);
  assert.equal(fedSvc.getActiveVersion(), '2.1.0-stable');
});

test('FederationService deterministic rollback on tampered payload or signature failure', async () => {
  const ctx = new LynxFitaContext();
  const compiler = new CompilerService(ctx);
  const fedSvc = new FederationService(ctx);

  const keyPair = generateReleaseKeyPair();
  const remoteBundle: FederatedBundle = {
    version: '2.2.0-canary',
    name: 'weather-showcase-canary',
    sourceCode: 'export const version = "2.2.0-canary";',
  };

  // Provide an invalid signature
  const fakeSig = 'aa'.repeat(64);
  const result = await fedSvc.reconcile(remoteBundle, fakeSig, keyPair.publicKeyPem);

  // Must fall back to embedded baseline
  assert.equal(result.activeVersion, '1.0.0-embedded');
  assert.equal(result.source, 'embedded-baseline');
  assert.equal(result.isFallback, true);
  assert.equal(result.signatureValid, false);
  assert.equal(fedSvc.getActiveVersion(), '1.0.0-embedded');

  // Explicit rollback
  await fedSvc.rollbackToEmbeddedBaseline('User requested baseline');
  assert.equal(fedSvc.getActiveVersion(), '1.0.0-embedded');
});

test('GitHubReleasesUpdater OTA bundle synthesis and application', async () => {
  const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.1');
  const updateCheck = updater.checkForUpdates();
  assert.equal(typeof updateCheck.hasUpdate, 'boolean');

  const keyPair = generateReleaseKeyPair();
  const ota = await updater.fetchOtaBundleFromGitHubPackages('weather-showcase', '2.1.0', {
    signingPrivateKey: keyPair.privateKeyPem,
    trustedPublicKey: keyPair.publicKeyPem,
  });

  assert.equal(ota.verified, true);
  assert.equal(ota.version, '2.1.0');
  assert.ok(ota.bytecode.length > 0);
  assert.equal(ota.sha256.length, 64);

  let hotReloadedName = '';
  const applied = await updater.applyOtaBundle(ota, {
    hotReloadBundle: (name: string) => {
      hotReloadedName = name;
      return true;
    },
  });

  assert.equal(applied, true);
  assert.equal(hotReloadedName, '@aleffita/weather-showcase');
});
